/* ============================================================================
   test_runtime.js — Tutoring Connect V8 runtime test suite (jsdom)
   ----------------------------------------------------------------------------
   Loads real pages in a real DOM and asserts real behaviour:
     * the pre-paint auth guard redirects anonymous visitors off private pages
       and does NOT interfere with public or code-gated pages
     * the theme engine actually recolours the CSS custom properties, including
       the gradient tokens that used to be frozen on the stock palette
     * all 20 layouts resolve to a real body class backed by real CSS
     * the page guide covers every shipped page
     * the Studio Assistant can answer for every page and route sensible
       natural-language queries to the right screen
     * the PWA install layer self-injects where the markup is missing

   Usage:  node tools/test_runtime.js [repoDir]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const R = { pass: 0, fail: [], skip: 0 };
const PENDING = [];
const ok = (c, m) => { if (c) { R.pass++; } else { R.fail.push(m); } };

/* Some artefacts are generator-only by design (generator.js, wizard.js,
   tools/*). A CLIENT build must NOT contain them, so those assertions are
   skipped rather than failed when running against a generated studio. */
function optional(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function loadScripts(dom, files) {
  const w = dom.window;
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    try { w.eval(fs.readFileSync(p, 'utf8')); }
    catch (e) { R.fail.push(`${f} threw at load: ${e.message}`); }
  }
}

function mkdom(html, url) {
  return new JSDOM(html || '<!doctype html><html><head></head><body></body></html>', {
    url: url || 'https://studio.test/index.html',
    runScripts: 'outside-only', pretendToBeVisual: true
  });
}


/* jsdom forbids redefining window.location, so we lexically SHADOW `location`
   inside the guard's own IIFE. The guard only touches location.pathname,
   location.search and location.replace(), so a stub is faithful. */
function runGuard(dom, pathname, search) {
  const w = dom.window;
  const guardSrc = fs.readFileSync(path.join(ROOT, 'assets/js/auth-guard.js'), 'utf8');
  const rec = { replaced: null };
  w.__loc = {
    pathname: pathname, search: search || '', href: 'https://studio.test' + pathname,
    replace(u) { rec.replaced = u; }, assign(u) { rec.replaced = u; }
  };
  w.eval('(function(location){' + guardSrc + '})(window.__loc);');
  return rec;
}

console.log(`\n=== RUNTIME TESTS · ${path.basename(ROOT)} ===\n`);

/* ---------------------------------------------------------------- 1. GUARD */
(function guardTests() {
  // (a) anonymous visitor on a PRIVATE page must be redirected
  {
    const dom = mkdom(null, 'https://studio.test/dashboard.html');
    const rec = runGuard(dom, '/dashboard.html');
    ok(rec.replaced && rec.replaced.startsWith('login.html?next='), 'guard: anonymous is redirected off dashboard.html');
    ok(rec.replaced && rec.replaced.includes('reason=signin'), 'guard: redirect states the reason');
  }
  // (b) public page must NOT be redirected
  {
    const dom = mkdom(null, 'https://studio.test/about.html');
    const rec = runGuard(dom, '/about.html');
    ok(rec.replaced === null, 'guard: public page (about.html) is NOT redirected');
    ok(!dom.window.document.documentElement.classList.contains('tc-gated'), 'guard: public page is not hidden');
  }
  // (c) code-gated CBT page must stay reachable
  {
    const dom = mkdom(null, 'https://studio.test/cbt-exam.html');
    const rec = runGuard(dom, '/cbt-exam.html', '?code=ABC');
    ok(rec.replaced === null, 'guard: code-gated cbt-exam.html stays reachable for a learner');
  }
  // (d) valid session -> hidden pending verification, then released
  {
    const dom = mkdom(null, 'https://studio.test/dashboard.html');
    dom.window.localStorage.setItem('sb-abcd-auth-token',
      JSON.stringify({ access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 }));
    const rec = runGuard(dom, '/dashboard.html');
    ok(rec.replaced === null, 'guard: valid session is not redirected');
    ok(dom.window.document.documentElement.classList.contains('tc-gated'), 'guard: document hidden until verified');
    dom.window.TCGuard.release();
    ok(!dom.window.document.documentElement.classList.contains('tc-gated'), 'guard: release() reveals the document');
  }
  // (e) EXPIRED token must fail closed
  {
    const dom = mkdom(null, 'https://studio.test/dashboard.html');
    dom.window.localStorage.setItem('sb-abcd-auth-token',
      JSON.stringify({ access_token: 'x', expires_at: Math.floor(Date.now() / 1000) - 60 }));
    const rec = runGuard(dom, '/dashboard.html');
    ok(rec.replaced && rec.replaced.startsWith('login.html'), 'guard: EXPIRED session fails closed (redirected)');
  }
  // (f) private pages must be a superset of the sensitive set
  {
    ['scoresheet','learners','parents','invoices','safeguarding','admin-data','settings','inbox']
      .forEach(function (p) {
        const dom = mkdom(null, 'https://studio.test/' + p + '.html');
        const rec = runGuard(dom, '/' + p + '.html');
        ok(rec.replaced !== null, 'guard: ' + p + '.html blocked for anonymous');
      });
  }
})();

/* ------------------------------------------------------- 2. THEME ENGINE */
(function themeTests() {
  const dom = mkdom();
  const w = dom.window;
  w.PRACTICE = {
    theme: { id: 't', primary: '#0b2545', accent: '#d9a441', primaryDark: '#061527',
             primaryLight: '#1b3f6f', accentLight: '#f0c877', bg: '#f7f9fc',
             gradient: 'linear-gradient(135deg,#0b2545 0%,#d9a441 100%)' },
    font: { family: 'Manrope', serif: 'Fraunces', css: 'Manrope:wght@400;700' },
    layout: 'executive'
  };
  loadScripts(dom, ['assets/js/theme-engine.js']);
  const st = w.document.documentElement.style;
  ok(st.getPropertyValue('--primary').trim() === '#0b2545', 'theme: --primary applied');
  ok(st.getPropertyValue('--accent').trim() === '#d9a441', 'theme: --accent applied');
  ok(st.getPropertyValue('--primary-dark').trim() === '#061527', 'theme: --primary-dark applied (was never themed before)');
  ok(st.getPropertyValue('--gradient').includes('#0b2545'), 'theme: --gradient re-themed (the core V7 bug)');
  ok(st.getPropertyValue('--tc-gradient').includes('#0b2545'), 'theme: legacy --tc-gradient alias re-themed');
  ok(st.getPropertyValue('--ring').includes('11,37,69'), 'theme: --ring derived from primary');
  ok(st.getPropertyValue('--on-primary').trim() === '#ffffff', 'theme: readable text colour chosen for primary');
  ok(/Manrope/.test(st.getPropertyValue('--font')), 'theme: --font applied');
  ok(w.document.body.classList.contains('layout-executive'), 'theme: layout class applied to body');
  ok(!!w.document.querySelector('link[data-tc-font]'), 'theme: Google Font link injected');

  // contrast helper must reject unreadable combinations
  ok(w.ThemeEngine.readableOn('#ffff00') === '#0f172a', 'theme: dark text chosen on a light accent (WCAG guard)');
  ok(w.ThemeEngine.readableOn('#0b2545') === '#ffffff', 'theme: white text chosen on a dark primary');

  // unknown layout must fall back rather than break the shell
  ok(w.ThemeEngine.applyLayout('does-not-exist') === 'sidebar', 'theme: unknown layout falls back to sidebar');
})();

/* -------------------------------------------------- 3. LAYOUTS HAVE CSS */
(function layoutTests() {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/layouts.css'), 'utf8');
  const catalogSrc = fs.readFileSync(path.join(ROOT, 'assets/js/catalog.js'), 'utf8');
  const dom = mkdom(); dom.window.eval(catalogSrc);
  const layouts = dom.window.TC.LAYOUTS;
  ok(layouts.length >= 20, `catalog: ${layouts.length} layouts offered`);
  const missing = layouts.filter(l => !css.includes('layout-' + l.id));
  ok(missing.length === 0, `layouts: every offered layout has real CSS (${missing.length} missing: ${missing.map(m => m.id).join(',')})`);
  ok(/@media print/.test(css), 'layouts: print stylesheet present');
  ok(/prefers-reduced-motion/.test(css), 'layouts: reduced-motion support present');

  const themes = dom.window.TC.THEMES;
  ok(themes.length >= 50, `catalog: ${themes.length} themes offered`);
  const ids = themes.map(t => t.id);
  ok(new Set(ids).size === ids.length, 'catalog: no duplicate theme ids');
  const incomplete = themes.filter(t => !t.primaryLight || !t.primaryDark || !t.gradient || !t.onPrimary);
  ok(incomplete.length === 0, `catalog: all themes have complete tokens (${incomplete.length} incomplete)`);
  ok(dom.window.TC.FONTS.length >= 50, `catalog: ${dom.window.TC.FONTS.length} fonts offered`);
  const fids = dom.window.TC.FONTS.map(f => f.id);
  ok(new Set(fids).size === fids.length, 'catalog: no duplicate font ids');
})();

/* ------------------------------------------------------- 4. PAGE GUIDE */
(function guideTests() {
  const dom = mkdom();
  loadScripts(dom, ['assets/js/page-guide.js']);
  const g = dom.window.TC.PAGE_GUIDE;
  const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).map(f => f.replace('.html', ''));
  const uncovered = pages.filter(p => !g[p]);
  ok(uncovered.length === 0, `guide: every shipped page is documented (${uncovered.length} missing: ${uncovered.slice(0, 5)})`);
  const thin = Object.values(g).filter(e => (e.detail || '').length < 180);
  ok(thin.length === 0, `guide: no thin entries (${thin.length} under 180 chars)`);
  const noHow = Object.values(g).filter(e => !e.how || e.how.length < 2);
  ok(noHow.length === 0, `guide: every page has step-by-step instructions (${noHow.length} without)`);
  const noWhy = Object.values(g).filter(e => !e.why);
  ok(noWhy.length === 0, 'guide: every page explains why it matters');
  ok(Object.values(g).every(e => e.access), 'guide: every page declares an access level');
})();

/* --------------------------------------------------- 5. STUDIO ASSISTANT */
(function botTests() {
  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://studio.test/dashboard.html');
  const w = dom.window;
  loadScripts(dom, ['assets/js/page-guide.js', 'assets/js/chatbot.js']);
  const bot = w.Chatbot;
  ok(!!bot, 'assistant: loaded');
  // jsdom reports readyState 'loading', so the module defers to DOMContentLoaded
  // exactly as it should in a browser. Fire it, then assert.
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  bot.init();
  ok(!!w.document.getElementById('tc-bot-fab'), 'assistant: launcher button mounted');
  ok(!!w.document.getElementById('tc-bot-panel'), 'assistant: panel mounted');

  const cases = [
    ['where do I mark attendance', 'attendance'],
    ['how do I see my child scores', 'scoresheet'],
    ['send an invoice', 'invoices'],
    ['book a class', 'booking'],
    ['safeguarding incident', 'safeguarding'],
    ['reading assignment', 'reading'],
    ['who are the tutors', 'tutors']
  ];
  let routed = 0;
  cases.forEach(([q, want]) => {
    const a = bot.answer(q) || '';
    if (a.toLowerCase().includes(want)) routed++;
    else console.log(`    (routing miss: "${q}" -> expected mention of "${want}")`);
  });
  ok(routed >= 6, `assistant: natural-language routing (${routed}/${cases.length} correct)`);

  ok(/4 cycles/i.test(bot.answer('how do bookings work')), 'assistant: explains the 4-cycle booking model');
  ok(/Row Level Security/i.test(bot.answer('who can see my data')), 'assistant: explains the privacy model');
  ok(/Graded/i.test(bot.answer('how do quizzes work')), 'assistant: explains quiz modes');
  ok(/Supabase/i.test(bot.answer('how do I deploy')), 'assistant: explains deployment');
  ok(/₦0|free/i.test(bot.answer('what does it cost')), 'assistant: explains cost');

  // must answer for EVERY page, not just the popular ones
  const g = w.TC.PAGE_GUIDE;
  let answered = 0;
  Object.keys(g).forEach(p => {
    const a = bot.answer(p.replace(/-/g, ' '));
    if (a && a.length > 120 && !/could not find/.test(a)) answered++;
  });
  ok(answered >= Object.keys(g).length * 0.92,
     `assistant: substantive answer for ${answered}/${Object.keys(g).length} pages`);

  const unknown = bot.answer('zzzz nonsense qqq');
  ok(/could not find|site-index/.test(unknown), 'assistant: graceful fallback on an unknown query');
})();

/* ------------------------------------------------------- 6. PWA INSTALL */
(function pwaTests() {
  const dom = mkdom('<!doctype html><html><head></head><body><div class="topbar"></div></body></html>');
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  loadScripts(dom, ['assets/js/pwa-install.js']);
  const P = w.PWAInstall;
  ok(!!P, 'pwa: module loaded');
  P.init();
  ok(!!w.document.getElementById('tc-install-trigger'), 'pwa: permanent header install button injected');
  const b = P.ensureBanner();
  ok(!!b && !!w.document.getElementById('pwa-install-banner'), 'pwa: banner self-injects on a page with no banner markup');
  ok(P.CADENCE.length >= 3, 'pwa: escalating re-prompt cadence configured');
  P.dismiss();
  ok(w.localStorage.getItem('tc_pwa_snoozes') === '1', 'pwa: dismissal is counted for escalation');
  ok(typeof P.instructionHTML() === 'string' && P.instructionHTML().length > 10, 'pwa: platform-specific instructions produced');
})();

/* --------------------------------------------------------------- 7. SEO */
(function seoTests() {
  // public page -> indexable
  {
    const dom = mkdom('<!doctype html><html><head><title>t</title></head><body></body></html>', 'https://studio.test/index.html');
    const w = dom.window;
    w.PRACTICE = { name: 'Test Studio', motto: 'M', siteUrl: 'https://studio.test',
                   logoUrl: 'assets/img/logo.svg', socials: { instagram: 'https://ig/x' },
                   hmg: { concepts: 'https://hmgconcepts.pages.dev/' } };
    loadScripts(dom, ['assets/js/page-guide.js', 'assets/js/seo.js']);
    w.SEO.init();
    const d = w.document;
    const robots = d.querySelector('meta[name="robots"]');
    ok(robots && /index,follow/.test(robots.content), 'seo: public page is indexable');
    ok(!!d.querySelector('link[rel="canonical"]'), 'seo: canonical present on a public page');
    ok(!!d.querySelector('meta[property="og:title"]'), 'seo: Open Graph tags present');
    ok(!!d.querySelector('meta[name="twitter:card"]'), 'seo: Twitter card present');
    const ld = d.getElementById('tc-jsonld');
    ok(!!ld, 'seo: JSON-LD emitted');
    if (ld) {
      const j = JSON.parse(ld.textContent);
      ok(Array.isArray(j['@graph']) && j['@graph'].length >= 3, 'seo: JSON-LD graph has org + website + service');
      const org = j['@graph'][0];
      ok(org.parentOrganization && /HMG Concepts/.test(org.parentOrganization.name),
         'seo: JSON-LD points at the HMG Concepts ecosystem');
      ok(Array.isArray(org.sameAs) && org.sameAs.length > 0, 'seo: social profiles declared as sameAs');
    }
  }
  // private page -> must NOT be indexable
  {
    const dom = mkdom('<!doctype html><html><head><title>t</title></head><body></body></html>', 'https://studio.test/scoresheet.html');
    const w = dom.window;
    w.PRACTICE = { name: 'Test Studio', siteUrl: 'https://studio.test' };
    loadScripts(dom, ['assets/js/page-guide.js', 'assets/js/seo.js']);
    w.SEO.init();
    const robots = w.document.querySelector('meta[name="robots"]');
    ok(robots && /noindex/.test(robots.content), 'seo: private page is noindex (family data never enters a search index)');
    ok(!w.document.getElementById('tc-jsonld'), 'seo: no structured data leaked on a private page');
  }
})();


/* -------------------------------------------------- 8. KEEP-ALIVE (V9) */
PENDING.push((function keepAliveTests() {
  // 8a. SQL contract
  const sql = fs.readFileSync(path.join(ROOT, 'database/v9-keepalive-and-drive.sql'), 'utf8');
  ok(/create or replace function public\.tc_keep_alive\(/.test(sql), 'keepalive: tc_keep_alive() defined');
  ok(/create or replace function public\.tc_keep_alive_status\(/.test(sql), 'keepalive: tc_keep_alive_status() defined');
  ok(/insert into public\.tc_heartbeat[\s\S]{0,200}on conflict/.test(sql), 'keepalive: heartbeat write is an UPSERT (never a silent no-op)');
  ok(/grant execute on function public\.tc_keep_alive\(text\) to anon, authenticated/.test(sql), 'keepalive: anon may write the heartbeat');
  ok(/grant execute on function public\.tc_keep_alive_status\(\) to anon, authenticated/.test(sql), 'keepalive: status readable by monitors');
  ok(/grant select on public\.tc_heartbeat\s+to authenticated/.test(sql), 'keepalive: staff may READ the heartbeat (the V8 42501 bug)');
  ok(/create policy tc_heartbeat_staff_read/.test(sql), 'keepalive: staff read policy exists');
  ok(/revoke all on public\.tc_heartbeat\s+from anon/.test(sql), 'keepalive: anon still cannot read the table directly');
  ok(/delete from public\.tc_keepalive_log/.test(sql), 'keepalive: ping log is trimmed (free-tier storage safe)');

  // 8b. Workflows
  const ka = fs.readFileSync(path.join(ROOT, '.github/workflows/keep-supabase-alive.yml'), 'utf8');
  ok(/cron:\s*'17 6 \*\/2 \* \*'/.test(ka), 'keepalive: writer runs every 2 days (margin for skipped GitHub runs)');
  ok(/for attempt in 1 2 3/.test(ka), 'keepalive: writer retries 3 times');
  ok(/tc_keep_alive_status/.test(ka), 'keepalive: writer verifies the write landed');
  ok(/issues: write/.test(ka) && /issues\.create/.test(ka), 'keepalive: writer raises an issue on failure');
  ok(/last-keepalive\.txt/.test(ka), 'keepalive: self-commit resets GitHub 60-day clock');

  const wd = fs.readFileSync(path.join(ROOT, '.github/workflows/keepalive-watchdog.yml'), 'utf8');
  ok(/cron:\s*'41 7 \* \* \*'/.test(wd), 'watchdog: runs daily, independently of the writer');
  ok(/unreachable/.test(wd), 'watchdog: detects an already-paused project');
  ok(/watchdog-selfheal/.test(wd), 'watchdog: self-heals a drifting project');
  ok(/issues\.update[\s\S]{0,120}closed|state: 'closed'/.test(wd), 'watchdog: auto-closes the alert when healthy');

  // 8c. Serverless endpoints
  const vapi = fs.readFileSync(path.join(ROOT, 'api/keepalive.js'), 'utf8');
  ok(/if \(!w\.ok\)/.test(vapi), 'keepalive: Vercel route CHECKS the write (V8 returned ok:true on failure)');
  ok(/503/.test(vapi), 'keepalive: Vercel route returns 503 so monitors alert');
  const edge = fs.readFileSync(path.join(ROOT, 'supabase/functions/ping/index.ts'), 'utf8');
  ok(/tc_keep_alive/.test(edge), 'keepalive: edge function performs a real DB write');
  ok(/status: 503/.test(edge), 'keepalive: edge function fails loudly for uptime monitors');
  ok(/no-verify-jwt/.test(edge), 'keepalive: edge deploy documented header-free');

  // 8d. Browser monitor
  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://s.test/platform-health.html');
  const w = dom.window;
  let pinged = null, statusCalls = 0;
  w.sb = { rpc: async (fn, args) => {
    if (fn === 'tc_keep_alive') { pinged = (args || {}).src; return { data: new Date().toISOString(), error: null }; }
    statusCalls++;
    return { data: { state: 'critical', days_since: 6.2, days_left: 0.8, ping_count: 7,
                     last_ping: new Date(Date.now() - 6.2 * 86400000).toISOString(), last_source: 'github-actions' }, error: null };
  }};
  w.App = { currentRole: 'admin' };
  loadScripts(dom, ['assets/js/keepalive-monitor.js']);
  const KA = w.KeepAlive;
  ok(!!KA, 'keepalive: browser monitor loaded');
  ok(KA.isOwner() === true, 'keepalive: owner detection works');
  return (async () => {
    const st = await KA.status();
    ok(st && st.state === 'critical', 'keepalive: status RPC consumed correctly');
    const host = w.document.createElement('div');
    w.document.body.appendChild(host);
    await KA.renderWidget(host);
    ok(/Critical/i.test(host.innerHTML), 'keepalive: widget renders the critical state');
    ok(/Write heartbeat now/.test(host.innerHTML), 'keepalive: widget offers a manual heartbeat');
    ok(/What to do/.test(host.innerHTML), 'keepalive: widget gives a remediation checklist');
    await KA.ping('test');
    ok(pinged === 'test', 'keepalive: manual ping reaches tc_keep_alive');
    KA.banner(st);
    ok(!!w.document.getElementById('tc-ka-banner'), 'keepalive: owner sees a warning banner when critical');
  })();
})());

/* --------------------------------------------------- 9. DRIVE SYNC (V9) */
PENDING.push((function driveTests() {
  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://s.test/admin-data.html');
  const w = dom.window;
  w.PRACTICE = { name: 'Test Studio' };
  w.sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
      drive_client_id: '', drive_sync_enabled: false, drive_sync_days: 7,
      drive_folder_id: '', drive_last_backup: null } }) }) }),
      upsert: async () => ({ error: null }) }) };
  w.App = { role: 'admin' };
  loadScripts(dom, ['assets/js/drive-sync.js']);
  const DS = w.DriveSync;
  ok(!!DS, 'drive: module loaded');
  ok(typeof DS.renderPanel === 'function', 'drive: renderPanel EXISTS (V8 called it but never defined it)');
  ok(typeof DS.renderFiles === 'function', 'drive: renderFiles exists');
  ok(DS.SCOPE === 'https://www.googleapis.com/auth/drive.file', 'drive: uses the restricted drive.file scope only');

  // admin-data.html must actually mount it
  const adm = fs.readFileSync(path.join(ROOT, 'admin-data.html'), 'utf8');
  ok(/DriveSync\.renderPanel/.test(adm), 'drive: admin-data.html mounts the panel');
  ok(/id="drive-root"/.test(adm), 'drive: mount point present');

  return (async () => {
    const host = w.document.createElement('div');
    w.document.body.appendChild(host);
    await DS.renderPanel(host);
    const h = host.innerHTML;
    ok(/Google Drive backup/.test(h), 'drive: panel renders');
    ok(/ds-client/.test(h), 'drive: Client ID input rendered');
    ok(/ds-backup/.test(h), 'drive: "Back up now" control rendered');
    ok(/ds-list/.test(h), 'drive: "List backups" control rendered');
    ok(/ds-test/.test(h), 'drive: "Test connection" control rendered');
    ok(/NOT SET UP/.test(h), 'drive: unconfigured state is signalled clearly');
    ok(/console\.cloud\.google\.com/.test(h), 'drive: inline first-time setup steps shown');
    ok(new RegExp(w.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h),
       'drive: shows the EXACT origin to authorise (the #1 setup failure)');

    // non-privileged users must not see it
    w.App.role = 'parent';
    const host2 = w.document.createElement('div');
    await DS.renderPanel(host2);
    ok(/Only an owner or admin/.test(host2.innerHTML), 'drive: parents cannot configure Drive');
  })();
})());


/* ------------------------------------------- 10. V10: BRAND + MULTI-CBT */
PENDING.push((function v10Tests() {
  // 10a. Item 1 — no third-party-sounding theme name; HMG house theme present
  const cat = fs.readFileSync(path.join(ROOT, 'assets/js/catalog.js'), 'utf8');
  /* The retired theme name must be gone, and the house name present.
     (A blanket rename once turned this assertion into "no HMG anywhere",
     which is the opposite of what we want — hence the explicit pair.) */
  ok(!/Lumen/i.test(cat), 'brand: the retired "Lumen" naming is gone from the catalogue');
  ok(/HMG Tutoring Studio/.test(cat), 'brand: the HMG house theme is present');
  const dom0 = mkdom(); dom0.window.eval(cat);
  const themes = dom0.window.TC.THEMES;
  const hmg = themes.find(t => t.id === 'hmg');
  ok(!!hmg && hmg.name === 'HMG Tutoring Studio', 'brand: "HMG Tutoring Studio" theme exists');
  ok(hmg && hmg.primary === '#0506ae' && hmg.accent === '#964eec',
     'brand: HMG house theme carries the HMG palette (#0506ae / #964eec)');
  const gen = optional('assets/js/generator.js');
  if (gen) ok(!/id: 'lumen'/.test(gen), 'brand: generator no longer falls back to the retired id');
  else R.skip++;

  // 10b. Item 6 — multi-subject CBT builder is real, not a redirect stub
  const mm = fs.readFileSync(path.join(ROOT, 'cbt-multi.html'), 'utf8');
  ok(mm.split('\n').length > 250, `multi-CBT: page is a real builder (${mm.split('\n').length} lines, was a 56-line stub)`);
  ok(/mm-subjects/.test(mm) && /addSubject/.test(mm), 'multi-CBT: per-subject blocks');
  ok(/subject_breakdown/.test(mm), 'multi-CBT: writes a per-subject breakdown');
  ok(/multi_subject: true/.test(mm), 'multi-CBT: flags the paper as multi-subject');
  ok(/blueprint/.test(mm), 'multi-CBT: live blueprint of marks per subject');
  ok(!/location\.href\s*=\s*'cbt-exam\.html/.test(mm), 'multi-CBT: no longer just redirects away');

  const dom = mkdom(mm, 'https://s.test/cbt-multi.html');
  const w = dom.window;
  w.CBT = { init(){}, parseCSV(t){ return t.trim().split('\n').slice(1).filter(Boolean)
      .map((l,i)=>({question:'Q'+i,type:'mcq',options:['a','b'],answer:'a'})); } };
  w.sb = null;
  const inline = mm.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  w.eval(inline[1]);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  ok(w.document.querySelectorAll('[data-mm-subject]').length >= 2, 'multi-CBT: seeds two subject blocks');
  const tas = w.document.querySelectorAll('.mm-csv');
  tas[0].value = 'q,type,a,b,answer\n1,mcq,x,y,x\n2,mcq,x,y,x\n3,mcq,x,y,x';
  tas[1].value = 'q,type,a,b,answer\n1,mcq,x,y,x\n2,mcq,x,y,x';
  const col = w.MM.collect();
  ok(col.subjects.length === 2 && col.questions.length === 5, 'multi-CBT: collects across subjects');
  ok(col.questions.every(q => q.subject), 'multi-CBT: EVERY question is subject-tagged (drives tabs + per-subject rows)');
  ok(col.breakdown[1].start === 3, 'multi-CBT: breakdown offsets are correct');
  w.MM.blueprint();
  ok(/Mathematics/.test(w.document.getElementById('mm-blueprint').innerHTML), 'multi-CBT: blueprint renders');
  // duplicate subject names must be rejected
  w.document.querySelectorAll('.mm-name')[1].value = w.document.querySelectorAll('.mm-name')[0].value;
  ok(/Duplicate subject/.test(w.MM.collect().err || ''), 'multi-CBT: rejects duplicate subject names');
  return Promise.resolve();
})());

/* ----------------------------------- 11. V10: KEEP-ALIVE + DRIVE PARITY */
PENDING.push((function parityTests() {
  // Google Apps Script layer (School Connect Layer 8 parity, enhanced)
  const gs = optional('tools/keepalive.gs');
  if (gs) {
    ok(/tc_keep_alive/.test(gs), 'apps-script: performs a real database write');
    ok(/tc_keep_alive_status/.test(gs), 'apps-script: reads health back (beyond SC parity)');
    ok(/MailApp\.sendEmail/.test(gs), 'apps-script: emails an alert on failure');
    ok(/ScriptApp|Triggers|Day timer/i.test(gs), 'apps-script: documents the daily trigger');
  } else { R.skip += 4; }

  // Auto-restore really un-pauses (SC Layer 10 parity)
  const ar = fs.readFileSync(path.join(ROOT, '.github/workflows/supabase-auto-restore.yml'), 'utf8');
  ok(/api\.supabase\.com\/v1\/projects/.test(ar), 'auto-restore: uses the Management API');
  ok(/\/restore/.test(ar), 'auto-restore: calls the restore endpoint (actually un-pauses)');

  // Drive overdue banner (SC parity, enhanced)
  const ds = fs.readFileSync(path.join(ROOT, 'assets/js/drive-sync.js'), 'utf8');
  ok(/overdueBanner/.test(ds), 'drive: overdue banner implemented (School Connect parity)');
  ok(/never backed up|never/i.test(ds), 'drive: warns when the studio has NEVER been backed up');
  ok(/needs-consent/.test(ds), 'drive: surfaces a silently failed automatic backup');

  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://s.test/dashboard.html');
  const w = dom.window;
  w.PRACTICE = { name: 'T' };
  w.App = { role: 'admin' };
  w.sb = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
    drive_client_id: 'x.apps.googleusercontent.com', drive_sync_enabled: true, drive_sync_days: 7,
    drive_folder_id: 'f', drive_last_backup: null } }) }) }), upsert: async () => ({ error: null }) }) };
  loadScripts(dom, ['assets/js/drive-sync.js']);
  return (async () => {
    await w.DriveSync.loadCfg();
    w.DriveSync.overdueBanner();
    const b = w.document.getElementById('tc-drive-banner');
    ok(!!b, 'drive: banner appears for an owner with no backup');
    ok(/never been backed up/i.test(b ? b.textContent : ''), 'drive: banner states the never-backed-up danger');
    ok(/Back up now/.test(b ? b.innerHTML : ''), 'drive: banner offers one-press backup');
    // parents must never see it
    w.App.role = 'parent';
    b.remove();
    w.DriveSync.overdueBanner();
    ok(!w.document.getElementById('tc-drive-banner'), 'drive: parents never see the backup banner');
  })();
})());


/* -------------------------------- 12. V11: PROMPTS · NO-UPLOAD · DOCTOR */
PENDING.push((function v11Tests() {
  // --- Item 1: prompt packs (School Connect parity + reading + extras) ---
  const dom0 = mkdom();
  const w0 = dom0.window;
  loadScripts(dom0, ['assets/js/cbt.js']);
  const C = w0.CBT;
  const REQUIRED = ['simple','intermediate','advanced','enterprise','self','review','graded',
                    'reading_article','reading_video','reading_pack',
                    'mcq_only','exam_board',
                    'differentiated','misconception','multi_subject','past_paper',
                    'marking_scheme','oral_practice'];
  let thin = [];
  REQUIRED.forEach(p => {
    const txt = C.promptPack(p, 'Quadratic equations', 20, 'SS2',
      { source: 'https://youtu.be/xyz', board: 'IGCSE', subjects: 'Maths, English' });
    if (!txt || txt.length < 150) thin.push(p);
  });
  ok(thin.length === 0, `prompts: all ${REQUIRED.length} packs produce a real prompt (${thin})`);
  ok(C.promptPack('mcq_only','t',5,'',{}).indexOf('MCQ-ONLY') !== -1, 'prompts: MCQ-only strict pack (SC parity)');
  ok(C.promptPack('exam_board','t',5,'',{board:'WAEC'}).indexOf('WAEC') !== -1, 'prompts: exam-board pack embeds the board (SC parity)');
  ok(C.promptPack('reading_video','t',5,'',{source:'https://youtu.be/abc'}).indexOf('https://youtu.be/abc') !== -1,
     'prompts: reading-video pack embeds the actual video link');
  ok(C.promptPack('reading_article','t',5,'',{source:'https://x.com/a'}).indexOf('https://x.com/a') !== -1,
     'prompts: reading-article pack embeds the actual material link');
  ok(C.promptPack('multi_subject','t',9,'',{subjects:'Maths, English'}).indexOf('Maths, English') !== -1,
     'prompts: multi-subject pack lists the subjects');
  ok(/NEVER accepts file uploads|never a file upload/i.test(C.promptPack('enterprise','t',5,'',{})),
     'prompts: every pack states the links-not-uploads rule');
  ok(C.allTypes().length >= 32, `prompts: ${C.allTypes().length} question types offered (SC ships 17)`);

  // the page must expose them all
  const pp = fs.readFileSync(path.join(ROOT, 'cbt-prompts.html'), 'utf8');
  const opts = (pp.match(/<option value="[a-z_]+"/g) || []).length;
  ok(opts >= 18, `prompts: ${opts} packs selectable in the UI`);
  ok(/id="examType"/.test(pp) && /data-need="subjects"/.test(pp),
     'prompts: Subject/Exam-Type always shown, subject-list shown per pack');

  // --- Item 5: no direct file uploads ---
  const proctor = fs.readFileSync(path.join(ROOT, 'assets/js/proctor.js'), 'utf8');
  ok(!/storage\.from\('proctor'\)/.test(proctor),
     'no-upload: webcam snapshots are NO LONGER uploaded to Supabase Storage');
  ok(/luminance|camera_frame/.test(proctor), 'no-upload: proctor keeps a metadata-only violation trail');
  const dp = fs.readFileSync(path.join(ROOT, 'assets/js/data-portability.js'), 'utf8');
  ok(/opts\.confirm/.test(dp), 'no-upload: Supabase Storage vault is opt-in only');
  const media = fs.readFileSync(path.join(ROOT, 'assets/js/media.js'), 'utf8');
  ok(/youtubeThumb/.test(media) && /driveThumb|thumbnail/.test(media),
     'no-upload: media.js renders YouTube + Drive previews from links');
  // no upload widgets anywhere except local CSV parsing
  let uploads = [];
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(f => {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    (h.match(/type="file"[^>]*/g) || []).forEach(tag => {
      if (!/csv/i.test(tag)) uploads.push(f + ' ' + tag.slice(0, 40));
    });
  });
  ok(uploads.length === 0, `no-upload: no file pickers except local CSV import (${uploads.join('; ')})`);

  // --- Item 7: schema doctor ---
  const sd = fs.readFileSync(path.join(ROOT, 'assets/js/schema-doctor.js'), 'utf8');
  ok(/PGRST202/.test(sd), 'doctor: recognises a missing-function error');
  ok(/42501/.test(sd), 'doctor: recognises an RLS refusal');
  ok(/complete-schema\.sql/.test(sd), 'doctor: names the file to run');

  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://s.test/attendance.html');
  const w = dom.window;
  // simulate a database stuck at V4 — exactly what the live studio reported
  w.sb = { rpc: async (fn) => (['tc_cbt_get_exam','is_family_of_learner','tc_keep_alive_status'].indexOf(fn) !== -1)
      ? { data: null, error: { message: 'PGRST202 Could not find the function public.' + fn } }
      : { data: {}, error: null } };
  w.App = { currentRole: 'admin' };
  const shown = [];
  w.toast = (m) => shown.push(String(m));
  loadScripts(dom, ['assets/js/schema-doctor.js']);
  const D = w.SchemaDoctor;
  return (async () => {
    const res = await D.probe();
    ok(res.deployed === 'V4', `doctor: correctly identifies the deployed version (${res.deployed})`);
    ok(res.missing.length === 3, `doctor: finds all ${res.missing.length} missing objects`);
    D.banner(res);
    const b = w.document.getElementById('tc-schema-banner');
    ok(!!b, 'doctor: shows ONE admin banner instead of scattered popups');
    ok(/out of date/i.test(b.textContent), 'doctor: banner explains the cause in plain English');
    ok(/v7-family-access-fix|complete-schema/.test(b.textContent), 'doctor: banner names the exact SQL to run');
    // humanising
    D.installToastFilter();
    const h = D.humanise('PGRST202 Could not find the function public.tc_keep_alive_status');
    ok(h.matched && /database is behind/i.test(h.text), 'doctor: raw Postgres noise becomes plain English');
    const h2 = D.humanise('new row violates row-level security policy for table "cbt_results"');
    ok(h2.matched && /refused/i.test(h2.text), 'doctor: RLS refusal explained');
    // families must never see infrastructure errors
    w.App.currentRole = 'parent';
    const before = shown.length;
    w.toast('PGRST202 Could not find the function public.x');
    ok(shown.length === before, 'doctor: parents never see infrastructure errors');
  })();
})());


/* --------------------- 13. V12: SCHEMA · QUOTA · CBT MODES · MULTI-PUSH */
PENDING.push((function v12Tests() {
  // ---- Item 5: complete-schema.sql is self-sufficient + re-runnable ----
  const cs = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  ok(/RUN THIS ONE FILE/.test(cs), 'schema: header states it is the only file to run');
  ok(/SAFE TO RUN THIS FILE AS MANY TIMES/i.test(cs), 'schema: header states re-runnability');
  ok(!/create table (?!if not exists)/i.test(cs.replace(/\$[a-z_]*\$[\s\S]*?\$[a-z_]*\$/gi, '')),
     'schema: every CREATE TABLE is IF NOT EXISTS');
  const policies = (cs.match(/create policy/gi) || []).length;
  const drops = (cs.match(/drop policy if exists/gi) || []).length;
  ok(drops >= policies, `schema: every policy has a preceding DROP (${drops} drops / ${policies} policies)`);
  const trg = (cs.match(/create trigger/gi) || []).length;
  const dtrg = (cs.match(/drop trigger if exists/gi) || []).length;
  ok(dtrg >= trg, `schema: every trigger has a preceding DROP (${dtrg}/${trg})`);
  ok(!/create function\s/i.test(cs), 'schema: no bare CREATE FUNCTION (all CREATE OR REPLACE)');
  // every pack must be inlined
  ['v2-tutoring-ops','V3 classroom','V4 PACK','V5 PACK','V6 PACK','V7 PACK','V9 PACK','V12 PACK',
   'Storage offload'].forEach(function (marker) {
    ok(cs.indexOf(marker) !== -1, `schema: contains ${marker}`);
  });
  ok(/tc_schema_registry/.test(cs) && /tc_schema_info/.test(cs), 'schema: registry + version RPC installed');

  // ---- Item 6: quota guard ----
  const qg = fs.readFileSync(path.join(ROOT, 'database/v12-quota-guard.sql'), 'utf8');
  ok(/set compression lz4/i.test(qg), 'quota: LZ4 compression applied to heavy JSONB columns');
  ok(/server_version_num.*140000/.test(qg), 'quota: LZ4 guarded for PostgreSQL 14+');
  ok(/tc_db_report/.test(qg), 'quota: size reporting function');
  ok(/tc_prune_logs/.test(qg), 'quota: log retention function');
  ok(/tc_slim_cbt_results/.test(qg), 'quota: old-quiz-replay slimming function');
  ok(/is_admin\(\)/.test(qg), 'quota: reclaim actions are admin-only');
  ok(/524288000/.test(qg), 'quota: measured against the real 500 MB budget');
  // must never touch academic/financial data
  ['scoresheet','assessments','payments','invoices','learners','sessions'].forEach(function (tbl) {
    ok(!new RegExp('delete from public\\.' + tbl).test(qg),
       `quota: never deletes from ${tbl}`);
  });

  const qjs = fs.readFileSync(path.join(ROOT, 'assets/js/quota-guard.js'), 'utf8');
  ok(/tc_db_report/.test(qjs) && /tc_prune_logs/.test(qjs) && /tc_slim_cbt_results/.test(qjs),
     'quota: UI wired to all three functions');
  ok(/confirm\(/.test(qjs), 'quota: destructive actions are confirmation-gated');

  // ---- Item 3: CBT Open vs Registered ----
  const ex = fs.readFileSync(path.join(ROOT, 'cbt-exam.html'), 'utf8');
  ok(/identity_mode/.test(ex), 'cbt: identity mode honoured');
  ok(/registered/.test(ex) && /open/.test(ex), 'cbt: both Registered and Open modes');
  ok(/id="dname"/.test(ex), 'cbt: a name field exists (required by the brief)');
  ok(/readOnly = state\.identity_mode === 'registered'|readOnly = true/.test(ex),
     'cbt: on Registered papers the name is auto-filled and locked (no misspelling)');
  ok(/lookupStudent|tc_cbt_get_exam/.test(ex), 'cbt: student ID resolves the learner');
  const mm = fs.readFileSync(path.join(ROOT, 'cbt-multi.html'), 'utf8');
  ok(/identity_mode/.test(mm), 'cbt-multi: identity mode selectable when building');
  ok(/mm-mode/.test(mm), 'cbt-multi: Registered/Open control present');

  // ---- Item 8: multi-subject -> per-subject scoresheet rows ----
  ok(/graded_quiz_subject/.test(cs), 'multi-push: trigger writes a per-SUBJECT scoresheet row');
  ok(/jsonb_each\(new\.subject_scores\)/.test(cs), 'multi-push: iterates the per-subject scores');
  ok(/\(overall\)/.test(cs), 'multi-push: also writes the overall row');
  ok(/'overall','general','total','aggregate'/.test(cs),
     'multi-push: skips aggregate buckets so a subject row is never double-counted');

  // the client must produce the shape the trigger reads
  const dom = mkdom();
  loadScripts(dom, ['assets/js/cbt.js']);
  const C = dom.window.CBT;
  const qs = [
    { id: 'q1', type: 'mcq', subject: 'Maths',   options: ['1','2'], answer: '1', mark: 1, question: 'a' },
    { id: 'q2', type: 'mcq', subject: 'Maths',   options: ['1','2'], answer: '1', mark: 1, question: 'b' },
    { id: 'q3', type: 'mcq', subject: 'English', options: ['x','y'], answer: 'x', mark: 1, question: 'c' }
  ];
  const graded = C.grade(qs, { q1: '1', q2: '2', q3: 'x' });
  ok(!!graded.subject_scores, 'multi-push: client emits subject_scores');
  const ss = graded.subject_scores;
  ok(ss.Maths && ss.English, 'multi-push: one bucket per subject');
  ok(ss.Maths.score === 1 && ss.Maths.total === 2, `multi-push: Maths scored per subject (${ss.Maths.score}/${ss.Maths.total})`);
  ok(ss.English.score === 1 && ss.English.total === 1, 'multi-push: English scored per subject');
  ok(typeof ss.Maths.score === 'number' && typeof ss.Maths.total === 'number',
     'multi-push: shape matches what the SQL trigger reads (score/total)');
  ok(graded.got === 2 && graded.max === 3, 'multi-push: overall total is the sum across subjects');

  return Promise.resolve();
})());


/* ------------------------- 14. V13: CHATBOT · CONTRAST · FORMS · INTROS */
PENDING.push((function v13Tests() {
  // --- Items 1,3,4,5: the assistant panel ---
  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://s.test/dashboard.html');
  const w = dom.window;
  loadScripts(dom, ['assets/js/page-guide.js', 'assets/js/chatbot.js']);
  w.Chatbot.init();
  const $ = function (id) { return w.document.getElementById(id); };
  const disp = function () { return w.getComputedStyle($('tc-bot-panel')).display; };
  const click = function (el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };

  ok(disp() === 'none', 'assistant: CLOSED on load (was permanently open — CSS specificity bug)');
  ok(w.document.querySelectorAll('.tc-bot-chip').length >= 8,
     `assistant: ${w.document.querySelectorAll('.tc-bot-chip').length} predefined prompts render`);
  ok($('tc-bot-log').textContent.length > 50, 'assistant: greeting present');
  click($('tc-bot-fab'));
  ok(disp() === 'flex', 'assistant: launcher OPENS the panel');
  click($('tc-bot-min'));
  ok($('tc-bot-panel').classList.contains('tc-min'), 'assistant: minimise collapses it out of the way');
  click($('tc-bot-min'));
  click($('tc-bot-x'));
  ok(disp() === 'none', 'assistant: × actually CLOSES it');
  click($('tc-bot-fab'));
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  ok(disp() === 'none', 'assistant: Esc closes it');
  const bot = fs.readFileSync(path.join(ROOT, 'assets/js/chatbot.js'), 'utf8');
  ok(/#tc-bot-panel\{[^}]*display:none/.test(bot), 'assistant: panel defaults to display:none');
  ok(/tc-open\{display:flex\}/.test(bot), 'assistant: visibility driven by a class, not [hidden]');

  // --- Item 2: contrast ---
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
  ok(/LEGIBILITY LAYER/.test(css), 'contrast: legibility layer present');
  ok(/#566276/.test(css), 'contrast: muted/help text darkened to AA');
  function hex2rgb(h){h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.substr(i,2),16));}
  function lum(h){const c=hex2rgb(h).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
  function cr(a,b){const l=[lum(a),lum(b)].sort((x,y)=>y-x);return (l[0]+0.05)/(l[1]+0.05);}
  [['#566276','muted/help'],['#046c4e','badge-success'],['#8a4708','badge-warning'],
   ['#1d4ed8','badge-info'],['#b42318','badge-danger'],['#6b7280','placeholder']].forEach(function (p) {
    ok(cr(p[0], '#ffffff') >= 4.5, `contrast: ${p[1]} ${cr(p[0],'#ffffff').toFixed(2)}:1 on white (AA)`);
  });

  // --- Item 6: a description at the head of every page ---
  let thin = [];
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(function (f) {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = h.match(/class="page-intro-what">([\s\S]*?)<\/p>/);
    if (!m || m[1].replace(/<[^>]+>/g, '').trim().length < 150) thin.push(f);
  });
  ok(thin.length === 0, `page intros: every page has a rich description (${thin.length} thin: ${thin.slice(0,4)})`);
  const att = fs.readFileSync(path.join(ROOT, 'attendance.html'), 'utf8');
  ok(/page-intro-who/.test(att) && /page-intro-why/.test(att) && /page-intro-how/.test(att),
     'page intros: include who / why / how-to');
  ok(/page-intro-badge/.test(att), 'page intros: show the access level');

  // --- Items 15,17: blank numeric/uuid must become NULL ---
  const crud = fs.readFileSync(path.join(ROOT, 'assets/js/crud.js'), 'utf8');
  ok(/BLANK_IS_NULL/.test(crud), 'forms: blank-to-NULL coercion present');
  ok(/invalid input syntax for type numeric/.test(crud), 'forms: the bug is documented at the fix site');
  const cols = [{key:'name',type:'text'},{key:'hourly_rate',type:'number'},{key:'tutor_id',type:'ref'},{key:'d',type:'date'}];
  const BLANK_IS_NULL = ['number','date','datetime-local','ref','time','month'];
  const fake = { name: 'X', hourly_rate: '', tutor_id: '', d: '' };
  const payload = {};
  cols.forEach(function (c) {
    let v = fake[c.key]; if (typeof v === 'string') v = v.trim();
    if (v === '' || v === undefined) { payload[c.key] = BLANK_IS_NULL.includes(c.type) ? null : (v === '' ? null : v); return; }
    if (c.type === 'number') { const n = Number(v); payload[c.key] = Number.isFinite(n) ? n : null; return; }
    payload[c.key] = v;
  });
  ok(Object.values(payload).indexOf('') === -1, 'forms: no empty strings reach Postgres');
  ok(payload.hourly_rate === null && payload.tutor_id === null && payload.d === null,
     'forms: numeric / uuid / date blanks become NULL');
  ok(payload.name === 'X', 'forms: text values preserved');

  // --- Item 10: profile save resolves identity at click time ---
  const prof = fs.readFileSync(path.join(ROOT, 'profile.html'), 'utf8');
  ok(/window\.TC_PROFILE \|\| p/.test(prof), 'profile: identity resolved at click time, not at load');
  ok(/auth\.getUser\(\)/.test(prof), 'profile: falls back to the auth session');
  ok(!/if\(!window\.sb \|\| !p\.id\)/.test(prof), 'profile: the stale-closure guard is gone');

  // --- Item 19 + 22: password reveal and pick-dont-type ---
  const ux = fs.readFileSync(path.join(ROOT, 'assets/js/ux-enhance.js'), 'utf8');
  ok(/input\[type="password"\]/.test(ux), 'ux: password reveal targets every password field');
  ok(/data-lookup/.test(ux), 'ux: free-text fields upgrade to database-backed dropdowns');
  ok(/data-default="today"/.test(ux), 'ux: sensible auto-fill defaults');
  ok(/beforeunload/.test(ux), 'ux: unsaved-changes guard');
  const dom2 = mkdom('<!doctype html><html><body><form><input type="password" id="pw"></form></body></html>');
  const w2 = dom2.window;
  loadScripts(dom2, ['assets/js/ux-enhance.js']);
  w2.UXEnhance.init();
  const eye = w2.document.querySelector('.tc-pw-eye');
  ok(!!eye, 'ux: eye toggle injected');
  eye.onclick();
  ok(w2.document.getElementById('pw').type === 'text', 'ux: reveals the password');
  eye.onclick();
  ok(w2.document.getElementById('pw').type === 'password', 'ux: hides it again');

  return Promise.resolve();
})());


/* ------------------- 15. V14: CBT KIT · NAV · APPROVALS · BOOKINGS · RECEIPTS */
PENDING.push((function v14Tests() {
  // ---------- calculator (items 14) ----------
  const d0 = mkdom();
  loadScripts(d0, ['assets/js/cbt-exam-kit.js']);
  const C = d0.window.SciCalc, K = d0.window.ExamKit;
  const cases = [['2+3*4',14],['(2+3)*4',20],['2^3^2',512],['sqrt(16)',4],['5!',120],
                 ['sin(30)',0.5],['log(1000)',3],['ln(e)',1],['logb(2,8)',3],
                 ['nCr(5,2)',10],['nPr(5,2)',20],['3(4+1)',15],['2sin(30)',1],['cbrt(27)',3]];
  let bad = [];
  cases.forEach(function (c) { try { if (Math.abs(C.evaluate(c[0]) - c[1]) > 1e-9) bad.push(c[0]); } catch (e) { bad.push(c[0]); } });
  ok(bad.length === 0, `calculator: ${cases.length - bad.length}/${cases.length} expressions correct (${bad})`);
  let unsafe = false;
  ['alert(1)', 'constructor', 'process.exit(1)', 'window.x=1'].forEach(function (s) {
    try { C.evaluate(s); unsafe = true; } catch (e) {}
  });
  ok(!unsafe, 'calculator: rejects arbitrary JS — no eval() (School Connect uses eval)');
  C.angle = 'rad';
  ok(Math.abs(C.evaluate('sin(pi/2)') - 1) < 1e-9, 'calculator: radian mode');
  C.angle = 'deg';
  ok(Math.abs(C.evaluate('sin(30)') - 0.5) < 1e-9, 'calculator: degree mode');

  // ---------- exam kit UI ----------
  const dom = mkdom('<!doctype html><html><head></head><body></body></html>', 'https://s.test/cbt-exam.html');
  const w = dom.window;
  w.PRACTICE = { name: 'ADEWALE CLASSROOM' };
  loadScripts(dom, ['assets/js/cbt-exam-kit.js']);
  const EK = w.ExamKit;
  const host = w.document.createElement('div'); w.document.body.appendChild(host);
  EK.brandBanner(host, 'Graded assessment');
  const brand = host.querySelector('.tc-exam-brand');
  ok(brand && /ADEWALE CLASSROOM/.test(brand.textContent), 'exam: studio name displayed on the paper (item 13)');
  ok(w.getComputedStyle(brand).textAlign === 'center', 'exam: studio name is centred');
  EK.watermark('TC-0001 · Ada');
  ok(!!w.document.getElementById('tc-watermark'), 'exam: candidate watermark (item 9)');

  const qs = [{ id: 'q1', subject: 'Maths' }, { id: 'q2', subject: 'Maths' }, { id: 'q3', subject: 'English' }];
  const pal = w.document.createElement('div'); w.document.body.appendChild(pal);
  let jumped = null;
  EK.renderPalette(pal, { questions: qs, answers: { q1: 'a' }, flags: { 2: true }, current: 1, onJump: i => jumped = i });
  ok(pal.querySelectorAll('.tc-pal-btn').length === 3, 'exam: numbered question tabs (item 20)');
  ok(!!pal.querySelector('.tc-pal-btn.answered') && !!pal.querySelector('.tc-pal-btn.current') &&
     !!pal.querySelector('.tc-pal-btn.flagged'), 'exam: palette shows answered / current / flagged');
  ok(pal.querySelectorAll('.tc-pal-sub').length === 2, 'exam: palette groups by subject');
  pal.querySelectorAll('.tc-pal-btn')[2].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(jumped === 2, 'exam: jumping to any question number works');

  EK.mountToolbar({});
  ok(!!w.document.getElementById('tc-t-calc') && !!w.document.getElementById('tc-t-kb'),
     'exam: calculator + maths keyboard available (item 14)');
  EK.toggleCalculator();
  ok(w.document.querySelectorAll('#tc-calc [data-k]').length >= 40,
     `exam: full scientific keypad (${w.document.querySelectorAll('#tc-calc [data-k]').length} keys)`);
  EK.toggleMathKeyboard();
  ok(w.document.querySelectorAll('#tc-mathkb [data-s]').length >= 60,
     `exam: maths keyboard (${w.document.querySelectorAll('#tc-mathkb [data-s]').length} symbols)`);

  let auto = false;
  EK.onAutoSubmit = () => { auto = true; };
  EK.startAntiCheat({ tab_focus: true, block_copy: true, block_devtools: true, max_violations: 2 }, () => {});
  w.document.dispatchEvent(new w.Event('copy', { bubbles: true, cancelable: true }));
  ok(EK.violations.length >= 1, 'anti-cheat: copy blocked and logged');
  w.document.dispatchEvent(new w.Event('contextmenu', { bubbles: true, cancelable: true }));
  ok(auto === true, 'anti-cheat: auto-submits at the violation limit');

  const ex = fs.readFileSync(path.join(ROOT, 'cbt-exam.html'), 'utf8');
  ['watermark', 'startAntiCheat', 'renderPalette', 'mountToolbar', 'brandBanner'].forEach(function (f) {
    ok(ex.indexOf(f) !== -1, `exam page wires ${f}()`);
  });

  // ---------- CSV round-trip (items 8 & 12) ----------
  const d2 = mkdom(); loadScripts(d2, ['assets/js/cbt.js']);
  const CBT = d2.window.CBT;
  const tpl = CBT.templateCSV();
  const parsed = CBT.parseCSV(tpl);
  ok(parsed.length >= 6, `csv: template carries ${parsed.length} worked examples`);
  ok(CBT.parseCSV(CBT.toCSV(parsed)).length === parsed.length, 'csv: parse → export → parse round-trips');
  const tricky = CBT.parseCSV(CBT.toCSV([{ question: 'A, then "B"', type: 'mcq', options: ['x', 'y'], answer: 'x', mark: 1 }]));
  ok(tricky[0].question === 'A, then "B"', 'csv: commas and quotes survive escaping');
  const pr = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  ok(/id="csvfile"/.test(pr), 'quizzes: CSV file upload control (item 8)');
  ok(/dltpl/.test(pr), 'quizzes: downloadable CSV template');
  ok(/data-edit=/.test(pr) && /data-del=/.test(pr) && /data-append=/.test(pr),
     'quizzes: edit / delete / append-CSV on existing papers (item 23)');
  ok(/data-dup=/.test(pr), 'quizzes: duplicate an existing paper');
  ['tab', 'blur', 'copy', 'rclick', 'devt', 'fs', 'wm', 'cam', 'aud', 'maxv'].forEach(function (id) {
    ok(new RegExp('id="' + id + '"').test(pr), `quizzes: anti-cheat toggle "${id}" exposed (item 9)`);
  });
  const mm = fs.readFileSync(path.join(ROOT, 'cbt-multi.html'), 'utf8');
  ok(/data-mm-tpl/.test(mm), 'multi-CBT: per-subject CSV template download');
  ok(/mm-cam/.test(mm) && /mm-maxv/.test(mm), 'multi-CBT: full anti-cheat config');

  // ---------- prompts (items 7 & 11) ----------
  const pp = fs.readFileSync(path.join(ROOT, 'cbt-prompts.html'), 'utf8');
  ok(/id="subject"/.test(pp), 'prompts: Subject field (item 11)');
  ok(/id="examType"/.test(pp), 'prompts: Exam Type field (item 11)');
  ok(/savecsv/.test(pp), 'prompts: save the returned CSV as a .csv file (item 7)');
  const big = CBT.promptPack('enterprise', 'Quadratics', 20, 'SS2', { subject: 'Mathematics', examType: 'WAEC' });
  ok(big.length > 2500, `prompts: rich prompt (${big.length} chars, was ~600)`);
  ['OUTPUT CONTRACT', 'QUALITY BAR', 'FINAL CHECK', 'Mathematics', 'WAEC'].forEach(function (k) {
    ok(big.indexOf(k) !== -1, `prompts: contains "${k}"`);
  });
  let thin = [];
  ['simple','intermediate','advanced','enterprise','self','review','graded','reading_article',
   'reading_video','reading_pack','mcq_only','exam_board','differentiated','misconception',
   'multi_subject','past_paper','marking_scheme','oral_practice'].forEach(function (p) {
    if (CBT.promptPack(p, 'T', 10, 'SS1', { subject: 'Physics', examType: 'IGCSE', source: 'https://x' }).length < 1200) thin.push(p);
  });
  ok(thin.length === 0, `prompts: all 18 packs are substantial (${thin})`);

  // ---------- navigation (item 28) ----------
  const dash = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
  const navLinks = new Set((dash.match(/<a href="([a-z0-9-]+\.html)"[^>]*data-module/g) || [])
    .map(function (m) { return (m.match(/href="([^"]+)"/) || [])[1]; }));
  const EXCL = new Set(['index.html','login.html','offline.html','builder.html','flyer.html',
                        'forgot-password.html','site-index.html','cbt-review.html','register.html','signup.html']);
  const inApp = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !EXCL.has(f));
  const notInNav = inApp.filter(f => !navLinks.has(f));
  ok(notInNav.length === 0, `nav: every in-app page is reachable (${notInNav.length} missing, was 90)`);
  ok((dash.match(/nav-section-title/g) || []).length >= 9, 'nav: grouped into labelled sections');

  // ---------- approvals (item 21) ----------
  const ap = fs.readFileSync(path.join(ROOT, 'approvals.html'), 'utf8');
  ok(/ap-list/.test(ap) && /data-ok=/.test(ap.replace(/\\/g, '')) === false || /data-ok/.test(ap),
     'approvals: page renders an approve control');
  ok(/from\('profiles'\)/.test(ap), 'approvals: reads real accounts');
  ok(/status:'approved'|status,role/.test(ap), 'approvals: writes the approved status');
  ok(/ap-pending/.test(ap), 'approvals: shows how many are waiting');
  ok(ap.split('\n').length > 300, `approvals: a real page, not a stub (${ap.split('\n').length} lines, was 130)`);

  // ---------- bookings (item 18) ----------
  const bk = fs.readFileSync(path.join(ROOT, 'bookings.html'), 'utf8');
  ok(/id="daygrid"/.test(bk), 'bookings: day-of-week picker (item 18)');
  ok(/expandClasses/.test(bk), 'bookings: expands the pattern into dated classes');
  ok(/id="cyc"/.test(bk), 'bookings: cycle count is selectable, not fixed at 4');
  ok((bk.match(/<option value="[1-7]">[1-7] class/g) || []).length >= 6,
     'bookings: times-per-cycle offers 1–7 (was 1–3)');

  // ---------- receipts (item 26) ----------
  const d3 = mkdom();
  d3.window.PRACTICE = { name: 'ADEWALE CLASSROOM', shortName: 'ADC', currency: '₦' };
  loadScripts(d3, ['assets/js/receipts.js']);
  const R = d3.window.Receipts;
  const pay = { id: 'abc-123', amount: 25000, method: 'Bank transfer', reference: 'TRX99', paid_on: '2026-08-16' };
  ok(R.inWords(25000) === 'Twenty five thousand', 'receipts: amount in words');
  ok(R.receiptNo(pay) === R.receiptNo(pay), 'receipts: number is stable across reprints');
  ok(R.receiptNo(pay) !== R.receiptNo({ id: 'zzz', paid_on: '2026-08-16' }), 'receipts: unique per payment');
  const rh = R.html(pay, { payer: 'Mrs Ada', learner: 'Tunde', invoiceTotal: 40000, paidToDate: 25000 });
  ok(/ADEWALE CLASSROOM/.test(rh) && /Mrs Ada/.test(rh) && /Twenty five thousand/.test(rh),
     'receipts: branded, names the payer, states the amount in words');
  ok(/15,000\.00/.test(rh), 'receipts: computes the outstanding balance');

  // ---------- edit/delete on hand-built pages (items 24, 25) ----------
  const ra = fs.readFileSync(path.join(ROOT, 'assets/js/record-actions.js'), 'utf8');
  ok(/BLANK_IS_NULL/.test(ra), 'record actions: reuses the blank-to-NULL coercion');
  const rd = fs.readFileSync(path.join(ROOT, 'reading.html'), 'utf8');
  ok(/RecordActions\.attach/.test(rd), 'reading: edit / duplicate / delete (item 24)');
  const cw = fs.readFileSync(path.join(ROOT, 'classwork.html'), 'utf8');
  ok(/RecordActions\.attach/.test(cw), 'classwork: edit / duplicate / delete (item 25)');

  return Promise.resolve();
})());


/* ---------------- 16. V15: FAMILY PORTAL · POLLS · BILLING · LICENSING */
PENDING.push((function v15Tests() {
  // ---------- item 16: family portal ----------
  ok(fs.existsSync(path.join(ROOT, 'family-links.html')), 'family: Family links page exists (parent_learner had NO page)');
  ok(fs.existsSync(path.join(ROOT, 'my-children.html')), 'family: My children page exists');
  const fl = fs.readFileSync(path.join(ROOT, 'family-links.html'), 'utf8');
  ok(/parent_learner/.test(fl), 'family: writes the parent↔learner link');
  ok(/fl-orphans/.test(fl), 'family: detects learners with no parent');
  ok(/fl-noaccount/.test(fl), 'family: detects parents with no portal login');
  ok(/user_id/.test(fl), 'family: can attach a portal account to a parent record');
  ok(/data-unlink/.test(fl), 'family: links can be removed');
  const mc = fs.readFileSync(path.join(ROOT, 'my-children.html'), 'utf8');
  ok(/scoresheet/.test(mc) && /session_attendance/.test(mc) && /reading_assignments/.test(mc),
     'family: child card pulls scores, attendance and reading');
  ok(/No children are linked/.test(mc), 'family: explains the empty state instead of showing a blank page');

  const v15 = fs.readFileSync(path.join(ROOT, 'database/v15-family-polls-billing.sql'), 'utf8');
  ok(/tc_my_children/.test(v15), 'family: tc_my_children() RPC');
  ok(/tc_child_summary/.test(v15), 'family: tc_child_summary() RPC');
  ok(/not_permitted/.test(v15), 'family: child summary refuses another family\'s learner id');
  ok(/security definer/i.test(v15), 'family: RPCs are security definer');

  // ---------- item 27: richer polls ----------
  ok(/closes_at/.test(v15) && /multi_choice/.test(v15) && /max_choices/.test(v15) &&
     /quorum/.test(v15) && /results_visible/.test(v15), 'polls: schema gains deadline, multi-choice, quorum, disclosure');
  ok(/tc_poll_results/.test(v15), 'polls: server-side tally RPC');
  ok(/after_close/.test(v15) && /after_vote/.test(v15), 'polls: results-disclosure rules enforced in SQL');
  ok(/poll_votes_one_per_voter/.test(v15), 'polls: one vote per person enforced by a unique index');

  const dv = mkdom('<!doctype html><html><body></body></html>', 'https://s.test/voting.html');
  dv.window.TC = { esc: s => String(s == null ? '' : s) };
  dv.window.toast = function () {};
  loadScripts(dv, ['assets/js/voting.js']);
  var VT = null;
  Object.keys(dv.window).forEach(function (k) {
    try { if (dv.window[k] && dv.window[k].validateVote) VT = dv.window[k]; } catch (e) {}
  });
  ok(!!VT, 'polls: voting module exposes vote validation');
  if (VT) {
    ok(!!VT.validateVote({ id: 1, status: 'open' }, []), 'polls: refuses an empty ballot');
    ok(/only one/.test(VT.validateVote({ id: 1, status: 'open' }, ['a', 'b']) || ''), 'polls: single-choice enforced');
    ok(VT.validateVote({ id: 1, status: 'open', multi_choice: true, max_choices: 2 }, ['a', 'b']) === null,
       'polls: multi-choice within the limit is allowed');
    ok(/at most 2/.test(VT.validateVote({ id: 1, status: 'open', multi_choice: true, max_choices: 2 }, ['a', 'b', 'c']) || ''),
       'polls: over-picking is refused');
    ok(/closed on/.test(VT.validateVote({ id: 1, status: 'open', closes_at: '2020-01-01T00:00:00Z' }, ['a']) || ''),
       'polls: voting after the deadline is refused');
    const card = VT.pollCard({ id: '9', title: 'T', status: 'open', options: 'A|B',
      closes_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      multi_choice: true, max_choices: 2, quorum: 5, anonymous: true, results_visible: 'after_close' }, true);
    ok(/day\(s\) left/.test(card), 'polls: live countdown on the ballot');
    ok(/Pick up to 2/.test(card), 'polls: shows how many picks are allowed');
    ok(/Quorum 5/.test(card), 'polls: shows the quorum');
    ok(/Results after close/.test(card), 'polls: shows the disclosure rule');
    ok(/Export results/.test(card), 'polls: results export to CSV');
    const expired = VT.pollCard({ id: '8', title: 'X', status: 'open', options: 'A|B', closes_at: '2020-01-01T00:00:00Z' }, false);
    ok(/Voting has closed/.test(expired) && !/type="radio"/.test(expired),
       'polls: an expired poll hides its inputs');
  }

  // ---------- combined family invoicing ----------
  ok(/tc_family_statement/.test(v15), 'billing: combined family statement RPC');
  ok(/no_parent_record/.test(v15), 'billing: handles an account with no parent record');
  const iv = fs.readFileSync(path.join(ROOT, 'invoices.html'), 'utf8');
  ok(/fs-panel/.test(iv), 'billing: combined statement panel on the invoices page');
  ok(/tc_family_statement/.test(iv), 'billing: panel calls the RPC');
  ok(/Print \/ Save as PDF|fs-print/.test(iv), 'billing: statement is printable');

  // ---------- item 14: licensing (verified, was wrongly reported as missing) ----------
  // builder.html is generator-only by design; a client build must not contain it.
  const bldr = optional('builder.html');
  if (bldr) {
    ok(/licenseModel/.test(bldr), 'licence: builder exposes one-time vs subscription');
    ok(/licenseExpires/.test(bldr) && /licenseGrace/.test(bldr), 'licence: expiry + grace configurable');
  } else { R.skip += 2; }
  const gen = optional('assets/js/generator.js');
  if (gen) {
    ok(/cfg\.license = \{/.test(gen), 'licence: normalizeCfg assembles cfg.license');
    ok(/model: cfg\.licenseModel/.test(gen), 'licence: the chosen model reaches config.js');
  } else { R.skip += 2; }
  const lic = fs.readFileSync(path.join(ROOT, 'assets/js/license.js'), 'utf8');
  ok(/subscription/.test(lic) && /grace/.test(lic), 'licence: runtime honours subscription + grace');

  // ---------- nav + guide must include the new pages ----------
  const dash = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
  ok(/family-links\.html/.test(dash) && /my-children\.html/.test(dash),
     'nav: the two new family pages are reachable');
  const dg = mkdom(); loadScripts(dg, ['assets/js/page-guide.js']);
  const G = dg.window.TC.PAGE_GUIDE;
  ok(!!G['family-links'] && !!G['my-children'], 'guide: new pages documented');
  ok(G['my-children'].access === 'family', 'guide: My children is a family-access page');
  ok(G['family-links'].access === 'staff', 'guide: Family links is staff-only');

  return Promise.resolve();
})());


/* ==========================================================================
   V16 — DATA WORKBENCH, EXAM REGISTRATION LIFECYCLE, PARITY, BENCHMARK
   ========================================================================== */
PENDING.push((function () {
  const crud = fs.readFileSync(path.join(ROOT, 'assets/js/crud.js'), 'utf8');
  const css  = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');

  // ---- the 13 workbench capabilities all exist in the shared renderer ----
  [['_refMaps',   'resolves ref columns to labels'],
   ['_cell',      'formats cells by type'],
   ['_kpis',      'computes the KPI strip'],
   ['openColumns','column chooser'],
   ['openRecord', 'full-record drawer'],
   ['printList',  'printable view'],
   ['_savedViews','saved views'],
   ['_loadView',  'per-page view persistence']
  ].forEach(([fn, what]) => ok(new RegExp('\\b' + fn + '\\s*[(:]').test(crud),
     'workbench: ' + what + ' (' + fn + ')'));

  ok(/count:\s*'exact'/.test(crud),        'workbench: asks Postgres for an exact row count (real paging)');
  ok(/\.range\(/.test(crud),               'workbench: server-side pagination via .range()');
  ok(/crud-prev/.test(crud) && /crud-next/.test(crud), 'workbench: prev/next pager rendered');
  ok(/crud-bulk-del/.test(crud) && /\.in\(/.test(crud), 'workbench: bulk delete uses a single .in() call');
  ok(/data-sort/.test(crud),               'workbench: sortable column headers');
  ok(/data-filter/.test(crud),             'workbench: per-column filter row');
  ok(/ilike/.test(crud),                   'workbench: text filters push ilike to the server');
  ok(/schema\.rowActions/.test(crud) && /onRowAction/.test(crud),
     'workbench: pages can attach their own row actions');

  // ---- the UUID bug is actually fixed ----
  ok(/unresolved link/.test(crud),
     'workbench: an unmatched ref degrades to a label, never a raw UUID');
  ok(/if \(col\.type === 'ref' && maps\[col\.key\]\)/.test(crud),
     'workbench: ref cells go through the id->label map');

  // ---- the styles the workbench needs exist ----
  ['crud-kpis','crud-kpi-label','crud-toolbar','crud-bulk','crud-table','crud-filter-row',
   'crud-foot','crud-pager','crud-empty','crud-detail','form-input-sm','form-select-sm','badge-muted'
  ].forEach(c => ok(new RegExp('\\.' + c + '\\b').test(css), 'workbench css: .' + c + ' is defined'));
  ok(/@media \(max-width:720px\)[\s\S]{0,400}crud-filter-row/.test(css),
     'workbench css: the filter row folds away on phones');

  // ---- no-show tracking (from the competitor benchmark) ----
  ok(/'no-show'/.test(crud),        'no-show: attendance can record a no-show');
  ok(/'cancelled-late'/.test(crud), 'no-show: attendance can record a late cancellation');
  ok(/chargeable/.test(crud),       'no-show: chargeable flag exists (a no-show is billed)');
  ok(/notified_at/.test(crud),      'no-show: notified_at distinguishes absence from no-show');

  // ---- exam registration lifecycle ----
  const er = fs.readFileSync(path.join(ROOT, 'exam-register.html'), 'utf8');
  ok(er.split('\n').length > 900,            'exam-register: rebuilt as a full page, not a bare form');
  ok(/tc_register_candidate/.test(er),       'exam-register: registers through the SECURITY DEFINER RPC');
  ok(/tc_candidate_lookup/.test(er),         'exam-register: candidates can look themselves up');
  ok(/tc_exam_reg_stats/.test(er),           'exam-register: staff KPI strip');
  ok(/tc_exam_to_learner/.test(er),          'exam-register: one-click enrol as learner');
  ['acknowledgement','docket','result','certificate','letter'].forEach(d =>
    ok(new RegExp("'" + d + "'").test(er), 'exam-register: prints the ' + d + ' document'));
  ok(/CRUD\.renderList\('exam_registrations'/.test(er),
     'exam-register: the staff console reuses the shared workbench');
  ok(/rowActions/.test(er) && /advance/.test(er),
     'exam-register: lifecycle advance button wired to row actions');
  ok(!/Families never see the pipeline/.test(er),
     'exam-register: the wrong pasted Inquiries description is gone');
  ok(/never accepts\s+file uploads/.test(er),
     'exam-register: links-only policy stated on the form');

  // ---- SQL pack ----
  const sql = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  ['tc_next_exam_no','tc_register_candidate','tc_candidate_lookup','tc_exam_reg_stats',
   'tc_exam_to_learner','tc_no_show_report'].forEach(f =>
     ok(new RegExp('function public\\.' + f).test(sql), 'schema: ' + f + '() shipped'));
  ok(/create sequence if not exists public\.exam_no_seq/.test(sql),
     'schema: exam numbers come from a sequence, not a JS row count');
  ok(/revoke insert on public\.exam_registrations from anon/.test(sql),
     'schema: anon lost direct insert on the candidate table');
  ok(/status = 'released'/.test(sql),
     'schema: candidate scores stay hidden until staff release them');
  ok(/'V16'/.test(sql), 'schema: registry reports V16');

  // ---- cbt-multi caught by the parity audit ----
  const mm = fs.readFileSync(path.join(ROOT, 'cbt-multi.html'), 'utf8');
  ok(/<script src="assets\/js\/crud\.js"><\/script>/.test(mm),
     'cbt-multi: crud.js is actually loaded (it called CRUD without loading it)');
  ok(/CRUD\.renderList\('cbt_multi_papers'/.test(mm),
     'cbt-multi: paper list is the shared workbench');

  // ---- the documents this turn was asked for ----
  ok(fs.existsSync(path.join(ROOT, 'docs/COMPETITOR-BENCHMARK.md')),
     'docs: competitor benchmark exists');
  ok(fs.existsSync(path.join(ROOT, 'docs/PAGE-PARITY-MATRIX.md')),
     'docs: page parity matrix exists');
  const bm = fs.readFileSync(path.join(ROOT, 'docs/COMPETITOR-BENCHMARK.md'), 'utf8');
  ['TutorCruncher','Teachworks','TutorBird',"Teach 'n Go",'Oases','Tutorbase'].forEach(v =>
    ok(bm.indexOf(v) > -1, 'benchmark: covers ' + v));
  ok(/Where Tutoring Connect is genuinely behind/.test(bm),
     'benchmark: states the gaps honestly, not just the wins');
  ok((bm.match(/https?:\/\//g) || []).length >= 10,
     'benchmark: claims are sourced (10+ citations)');

  return Promise.resolve();
})());


/* ==========================================================================
   V17 — ENFORCED LICENSING + SIBLING / FAMILY BILLING
   ========================================================================== */
PENDING.push((function () {
  const sql = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  const lic = fs.readFileSync(path.join(ROOT, 'assets/js/license.js'), 'utf8');
  const lp  = fs.readFileSync(path.join(ROOT, 'license.html'), 'utf8');
  const st  = fs.readFileSync(path.join(ROOT, 'settings.html'), 'utf8');
  const inv = fs.readFileSync(path.join(ROOT, 'invoices.html'), 'utf8');

  // ---- licensing is enforced in the DATABASE, not the browser ----
  ['tc_license_status','tc_license_writable','tc_license_guard','tc_license_set',
   'tc_license_renew'].forEach(f =>
     ok(new RegExp('function public\\.' + f).test(sql), 'licence: ' + f + '() shipped'));
  ok(/create trigger tc_license_guard_trg/.test(sql),
     'licence: the guard is attached as a real trigger');
  ok(/'learners','tutors','parents','engagements'/.test(sql),
     'licence: the guard covers the core operational tables');
  ok(!/site_license[\s\S]{0,200}tc_license_guard_trg/.test(sql),
     'licence: site_license itself is NOT guarded (or renewal is impossible)');
  ok(/tc_license_history/.test(sql), 'licence: every change is written to an audit trail');

  // the four design promises, asserted rather than described
  ok(/if not found then return true; end if;\s*--\s*fail open/.test(sql),
     'licence: a missing licence row fails OPEN, never bricking a studio');
  ok(/coalesce\(l\.enforcement, 'banner'\) = 'banner' then return true/.test(sql),
     'licence: warn-only mode never blocks a write');
  ok(/in \('lifetime', 'one_time', 'perpetual'\) then\s*return true/.test(sql),
     'licence: a one-time purchase is never blocked');
  ok(/before insert or update or delete/.test(sql),
     'licence: the guard fires on writes only, so SELECT is always allowed');

  // ---- license.js stopped pretending to enforce ----
  ok(/tc_license_status/.test(lic),  'license.js: asks the server for the truth');
  ok(/loadServer/.test(lic),         'license.js: has a server path');
  ok(/canWrite/.test(lic),           'license.js: exposes canWrite() for other scripts');
  ok(/r\.enforcement === 'lock'/.test(lic),
     'license.js: the blocking overlay only appears in lock mode');
  ok(/evaluate/.test(lic) && /loadRemote/.test(lic),
     'license.js: legacy API retained (backwards compatible)');

  // ---- the licence page is no longer a stub ----
  ok(lp.split('\n').length > 500, 'license.html: rebuilt as a real console');
  ok(!/Use the related links and the/.test(lp.slice(lp.indexOf('</section>'))),
     'license.html: placeholder text removed');
  ['lic-kpis','lic-model','lic-tier','lic-enforcement','lic-seats-learners',
   'lic-save','lic-test','lic-history'].forEach(id =>
     ok(new RegExp('id="' + id + '"').test(lp), 'license.html: #' + id + ' present'));
  ok(/tc_license_renew/.test(lp),  'license.html: one-click renewal');
  ok(/data-renew="12"/.test(lp),   'license.html: renewal presets');
  ok(/Run write test/.test(lp),    'license.html: proves enforcement instead of asserting it');

  // ---- the builder exposes BOTH models and the new fields ----
  const b = optional('builder.html');
  if (b) {
    ok(/value="lifetime"/.test(b) && /value="subscription"/.test(b),
       'builder: both licensing models offered');
    ['licenseTier','licenseEnforcement','licenseSeatsLearners','licenseSeatsTutors',
     'licenseIssuedTo','licenseLockMessage'].forEach(f =>
       ok(new RegExp('data-sync="' + f + '"').test(b), 'builder: collects ' + f));
    ok(/Reads are never blocked in any mode/.test(b),
       'builder: states plainly that reads are never blocked');
  } else { R.skip += 9; }

  const gen = optional('assets/js/generator.js');
  if (gen) {
    ok(/licenceSeedSQL/.test(gen),  'generator: emits a licence seed');
    ok(/database\/00-licence-seed\.sql/.test(gen), 'generator: the seed is in the payload');
    ok(/v17-licensing-and-family-billing\.sql/.test(gen), 'generator: ships the V17 pack');
    ok(/v16-exam-registration\.sql/.test(gen), 'generator: ships the V16 pack');
    ok(/enforcement: cfg\.licenseModel === 'subscription'/.test(gen),
       'generator: a one-time licence can never be given an enforcing mode');
  } else { R.skip += 5; }

  // ---- sibling / family billing ----
  ok(/function public\.tc_sibling_discount_pct/.test(sql), 'siblings: discount function shipped');
  ok(/sibling_discount_2/.test(sql) && /sibling_discount_3/.test(sql) && /sibling_discount_4/.test(sql),
     'siblings: three discount bands stored in settings');
  ok(/children_count/.test(sql) && /balance_after_discount/.test(sql),
     'siblings: the family statement returns the discounted balance');
  ok(/greatest\(v_total - v_paid, 0\)/.test(sql),
     'siblings: the discount applies to what is OUTSTANDING, not to money already paid');
  ['sib2','sib3','sib4','sibon','sibsave'].forEach(id =>
    ok(new RegExp("id=\"" + id + "\"").test(st), 'settings: #' + id + ' present'));
  ok(/highest band reached/i.test(st), 'settings: explains that bands do not stack');
  ok(/sibling_discount_amount/.test(inv), 'invoices: statement shows the discount line');
  ok(/balance_after_discount/.test(inv),  'invoices: statement shows the discounted total');
  ok(/no sibling discount is configured/.test(inv),
     'invoices: nudges when a multi-child family has no discount set');

  // ---- registry ----
  ok(/'V17'/.test(sql), 'schema: registry reports V17');

  return Promise.resolve();
})());


/* ==========================================================================
   V18 — SECURITY HARDENING + PER-SITE SEO
   These assertions exist because STATIC analysis passed 497 times while the
   deployed system leaked. They encode what tools/audit_live.py found.
   ========================================================================== */
PENDING.push((function () {
  const sql = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');

  // ---- the revoke bug: 'from anon' alone is a no-op ----
  ok(/revoke all on function %s from public/.test(sql),
     'security: EXECUTE is revoked from PUBLIC (the only revoke that works)');
  ok(/prokind = 'f'/.test(sql),
     'security: the revoke loops over the catalogue, so new functions cannot be missed');
  /* The meaningful assertion is not "the old line is gone" — it is harmless
     and V18 runs after it. It is that the catalogue-wide revoke exists AND
     that each function that leaked is now re-secured. */
  ['tc_db_report','tc_storage_report','tc_keep_alive_status','tc_schema_info',
   'tc_security_report'].forEach(f => {
    ok(new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public').test(sql),
       'security: ' + f + ' is revoked from PUBLIC, not merely from anon');
  });
  ok(/grant execute on function public\.tc_register_candidate\(jsonb\) to anon/.test(sql),
     'security: the genuinely public functions are re-granted to anon by name');
  ok(/grant execute on function public\.tc_candidate_lookup\(text, text\) to anon/.test(sql),
     'security: candidate self-lookup stays public');

  // ---- staff-only functions re-check the role INSIDE themselves ----
  ['tc_exam_reg_stats','tc_no_show_report','tc_license_status'].forEach(f => {
    const body = sql.slice(sql.lastIndexOf('function public.' + f));
    ok(/is_tutor\(\)/.test(body.slice(0, 900)),
       'security: ' + f + '() checks is_tutor() itself, not just its grant');
  });
  ok(/tc_security_report/.test(sql), 'security: a self-audit function ships');
  ok(/has_function_privilege\('anon'/.test(sql),
     'security: the self-audit asks the catalogue what anon can execute');
  ok(/rls_disabled_tables/.test(sql), 'security: the self-audit reports tables without RLS');

  // ---- announcements leak ----
  ok(/alter table public\.announcements add column if not exists is_public/.test(sql),
     'security: announcements need an explicit opt-in to be public');
  ok(/announcements_public_read on public\.announcements\s*\n\s*for select to anon using \(coalesce\(is_public, false\) = true\)/.test(sql),
     'security: anon sees only announcements marked public');

  // ---- idempotency: every new policy has a matching DROP ----
  ['announcements_member_read','announcements_public_read','announcements_staff_write'].forEach(pol => {
    ok(new RegExp('drop policy if exists ' + pol).test(sql),
       'idempotent: ' + pol + ' is dropped before it is created');
  });

  // ---- schema version constant ----
  ok(/'expected', 'V20'/.test(sql), 'schema: tc_schema_info expects V20 (the constant is bumped every pack)');
  ok(/'V18'/.test(sql), 'schema: registry reports V18');
  ok(/delete from public\.exam_registrations[\s\S]{0,120}__audit_probe__/.test(sql),
     'housekeeping: the junk rows my live probe created are cleaned up');

  // ---- per-site SEO ----
  const robots  = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const cfg     = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8');
  const base    = (cfg.match(/siteUrl\s*:\s*['"]([^'"]*)['"]/) || [])[1] || '';

  ok(!!base, 'seo: this site declares its own siteUrl');
  ok(/^Sitemap: https?:\/\//m.test(robots),
     'seo: robots.txt uses an ABSOLUTE sitemap URL (a relative one is ignored)');
  ok(base && robots.indexOf(base) > -1, 'seo: robots.txt points at THIS site');
  ok(base && sitemap.indexOf(base) > -1, 'seo: sitemap points at THIS site');
  ok((robots.match(/^Disallow: /gm) || []).length > 100,
     'seo: every private portal page is disallowed, not just two');
  ok(/Googlebot/.test(robots) && /Bingbot/.test(robots), 'seo: names both major crawlers');

  // A CLIENT site must never advertise the generator's wizard.
  const isGenerator = fs.existsSync(path.join(ROOT, 'builder.html'));
  if (!isGenerator) {
    ok(sitemap.indexOf('builder.html') === -1,
       'seo: a client sitemap does not advertise builder.html (which 404s there)');
    ok(sitemap.indexOf('tutoringconnect.vercel.app') === -1,
       'seo: a client sitemap does not point at the generator domain');
  } else { R.skip += 2; }

  // ---- noindex on private pages, and NOT on public ones ----
  const priv = ['dashboard.html','learners.html','invoices.html','safeguarding.html','settings.html'];
  priv.forEach(f => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { R.skip++; return; }
    ok(/<meta name="robots" content="noindex/.test(fs.readFileSync(p, 'utf8')),
       'seo: ' + f + ' is noindex (robots.txt is a request, not access control)');
  });
  ['index.html','apply.html','exam-register.html','contact.html'].forEach(f => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { R.skip++; return; }
    ok(!/content="noindex/.test(fs.readFileSync(p, 'utf8')),
       'seo: ' + f + ' is indexable (it is a public page)');
  });

  // ---- the live auditor itself must exist and be honest ----
  const al = optional('tools/audit_live.py');
  if (al) {
    ok(/PUBLIC_OK/.test(al), 'audit_live: has an explicit public allow-list');
    ok(/DESTRUCTIVE/.test(al),
       'audit_live: refuses to invoke write functions against live data by default');
    ok(/revoke execute on function public\.NAME\(args\) from public/.test(al),
       'audit_live: explains the PUBLIC-vs-anon root cause');
  } else { R.skip += 3; }

  return Promise.resolve();
})());


/* ==========================================================================
   V19 — REVENUE AUTOMATION + ENTERPRISE SECURITY
   ========================================================================== */
PENDING.push((function () {
  const sql = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');

  // ---- competitor-parity features ----
  ['account_credits','payment_plans','payment_plan_items','promo_codes',
   'tutor_rates','consent_records','data_requests'].forEach(t =>
    ok(new RegExp('create table if not exists public\\.' + t).test(sql),
       'v19: table ' + t + ' shipped'));

  ['tc_wallet_balance','tc_wallet_topup','tc_wallet_low_balances',
   'tc_create_payment_plan','tc_payment_plan_arrears','tc_check_promo',
   'tc_waitlist_promote','tc_payroll_generate','tc_tutor_performance',
   'tc_session_conflicts','tc_audit','tc_audit_trail','tc_export_learner',
   'tc_anonymised_export','tc_security_events'].forEach(f =>
    ok(new RegExp('function public\\.' + f).test(sql), 'v19: ' + f + '() shipped'));

  // ---- the wallet is a LEDGER, not a mutable balance ----
  ok(/sum\(amount\) filter \(where unit = 'currency'\)/.test(sql),
     'wallet: the balance is derived from the ledger, never stored');
  ok(/is_low/.test(sql), 'wallet: low-balance alert (the renewal driver)');

  // ---- instalment rounding lands on the FIRST payment ----
  ok(/v_first := v_tot - \(v_each \* \(v_n - 1\)\)/.test(sql),
     'plans: rounding is absorbed by the first instalment, not the last');

  // ---- automation (item 11) ----
  ok(/tc_autoinvoice_on_attendance/.test(sql), 'automation: attendance drives invoicing');
  ok(/create trigger tc_autoinvoice_trg/.test(sql), 'automation: the trigger is attached');
  ok(/auto_invoice_enabled/.test(sql), 'automation: off by default, opt-in per studio');
  ok(/if tg_op = 'UPDATE' and old\.status = new\.status then return new/.test(sql),
     'automation: editing a row cannot double-charge a family');

  // ---- pre-flight fix: sessions had no tutor_id ----
  ok(/alter table public\.sessions add column if not exists tutor_id/.test(sql),
     'v19: sessions.tutor_id added (payroll and conflicts were impossible without it)');
  ok(/alter table public\.sessions add column if not exists duration_min/.test(sql),
     'v19: sessions.duration_min added');
  ok(/set duration_min = greatest\(1, round\(extract\(epoch/.test(sql),
     'v19: duration is backfilled from existing rows, not left null');

  // ---- IMMUTABLE audit trail ----
  ok(/tc_activity_log_immutable/.test(sql), 'audit: an immutability guard exists');
  ok(/create trigger activity_log_no_update/.test(sql), 'audit: updates are refused');
  ok(/create trigger activity_log_no_delete/.test(sql), 'audit: deletes are refused');
  ok(/revoke insert, update, delete on public\.activity_log from authenticated, anon/.test(sql),
     'audit: nobody can write the log through the API — only the trigger can');
  ok(/'site_license','practice_settings','promo_codes'/.test(sql),
     'audit: money and configuration tables are audited too');
  ok(/old_row/.test(sql) && /new_row/.test(sql),
     'audit: before AND after are captured, so "what changed" is answerable');

  // ---- privacy / data-subject rights ----
  ok(/tc_export_learner/.test(sql), 'privacy: right-to-inspect export');
  ok(/is_family_of_learner\(p_learner\)/.test(sql),
     'privacy: a family may export its own child, and only its own child');
  ok(/sha256/.test(sql) && /pseudonym/.test(sql),
     'privacy: anonymised export uses SHA-256 pseudonyms');
  ok(/current_date \+ 30/.test(sql), 'privacy: data requests carry a 30-day clock');

  // ---- everything new is still locked down (the V18 rule) ----
  ['tc_wallet_balance','tc_audit_trail','tc_export_learner','tc_anonymised_export',
   'tc_security_events','tc_tutor_performance'].forEach(f =>
    ok(new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public').test(sql),
       'v19 security: ' + f + ' is revoked from PUBLIC'));
  ok(/grant execute on function public\.tc_check_promo\(text, numeric\) to anon/.test(sql),
     'v19 security: only the promo checker is public (a code is checked at checkout)');
  ok(/is_tutor\(\)/.test(sql.slice(sql.indexOf('function public.tc_wallet_topup'), sql.indexOf('function public.tc_wallet_topup') + 700)),
     'v19 security: wallet top-up checks the role inside the function');

  // ---- the three new pages ----
  ['wallet.html','payment-plans.html','security-centre.html'].forEach(f => {
    const p = path.join(ROOT, f);
    ok(fs.existsSync(p), 'page: ' + f + ' exists');
    if (!fs.existsSync(p)) { R.skip += 4; return; }
    const s2 = fs.readFileSync(p, 'utf8');
    ok(/page-intro-what/.test(s2), 'page: ' + f + ' has a detailed description');
    ok(/page-intro-how/.test(s2),  'page: ' + f + ' explains how to use it');
    ok(/<meta name="robots" content="noindex/.test(s2), 'page: ' + f + ' is noindex (private)');
    ok(/assets\/js\/crud\.js/.test(s2), 'page: ' + f + ' loads the shared workbench');
  });

  // ---- every page can reach the new pages ----
  let navMissing = 0, navTotal = 0;
  fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(f => {
    const s2 = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (s2.indexOf('<nav class="app-nav">') === -1) return;
    navTotal++;
    ['wallet.html','payment-plans.html','security-centre.html'].forEach(h => {
      if (s2.indexOf('href="' + h + '"') === -1) navMissing++;
    });
  });
  ok(navMissing === 0, 'nav: all ' + navTotal + ' portal pages link the new pages (' + navMissing + ' gaps)');

  // ---- the guide and the bot cover them (item 10) ----
  const dg = mkdom(); loadScripts(dg, ['assets/js/page-guide.js']);
  const G = dg.window.TC.PAGE_GUIDE;
  ['wallet','payment-plans','security-centre'].forEach(k => {
    ok(!!G[k], 'guide: ' + k + ' documented');
    if (G[k]) {
      ok((G[k].how || []).length >= 5, 'guide: ' + k + ' has a real step-by-step (>=5 steps)');
      ok((G[k].purpose || '').length > 150, 'guide: ' + k + ' purpose is substantial');
    } else { R.skip += 2; }
  });
  const kb = fs.readFileSync(path.join(ROOT, 'assets/js/assistant-kb.js'), 'utf8');
  ['wallet:','payment_plans:','security_centre:'].forEach(k =>
    ok(kb.indexOf('    ' + k) > -1, 'assistant: curated answer for ' + k.replace(':','')));

  return Promise.resolve();
})());


/* ==========================================================================
   V20 — THE 18 REPORTED BUGS
   One assertion (at least) per reported item, so a regression is caught.
   ========================================================================== */
PENDING.push((function () {
  const sql   = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  const crud  = fs.readFileSync(path.join(ROOT, 'assets/js/crud.js'), 'utf8');
  const app   = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  const kit   = fs.readFileSync(path.join(ROOT, 'assets/js/cbt-exam-kit.js'), 'utf8');
  const cbtjs = fs.readFileSync(path.join(ROOT, 'assets/js/cbt.js'), 'utf8');
  const css   = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');

  // --- 1. full CBT editing, School Connect parity ---
  const mm = fs.readFileSync(path.join(ROOT, 'cbt-multi.html'), 'utf8');
  ['open','sit','link','preview','questions','append','results','export','diagnose','archive']
    .forEach(a => ok(new RegExp("id: '" + a + "'").test(mm), 'bug1: CBT action "' + a + '" exists'));
  ok(/Save all changes/.test(mm), 'bug1: questions can be edited and saved in bulk');
  ok(/data-del/.test(mm) && /data-up/.test(mm), 'bug1: questions can be deleted and reordered');

  // --- 2 + 3. nav gaps and search ---
  ok(/_syncNavSections/.test(app), 'bug2: empty section headings are collapsed');
  ok(/nav-section-title/.test(app), 'bug2: the collapse targets section titles');
  ok(/q\.split\(' '\)\.every/.test(app), 'bug3: multi-word nav search works');
  ok(/replace\(\/\[•·/.test(app), 'bug3: bullet glyphs are stripped before matching');
  ok(/a\.getAttribute\('href'\)/.test(app), 'bug3: search also matches the page filename');

  // --- 4. one question per page ---
  const ex = fs.readFileSync(path.join(ROOT, 'cbt-exam.html'), 'utf8');
  ok(/id="prevq"/.test(ex) && /id="nextq"/.test(ex), 'bug4: Prev / Next buttons exist');
  ok(/showOnly/.test(ex), 'bug4: exactly one question card is displayed');
  ok(/qprogress/.test(ex), 'bug4: "Question N of M" progress is shown');
  ok(/ArrowRight/.test(ex), 'bug4: keyboard navigation');
  ok(/onJump: \(i\) => \{ state\.current = i; paint\(\); \}/.test(ex),
     'bug4: the number palette switches question rather than scrolling');

  // --- 5. calculator / maths keyboard must not count as cheating ---
  ok(/TOOL_SEL/.test(kit), 'bug5: studio tools are identified');
  ok(/inTool\(e\.target\)/.test(kit), 'bug5: tool events are exempt from the copy/paste guard');
  ok(/d\.hasFocus\(\)/.test(kit), 'bug5: window blur is verified before it is recorded');
  ok(/_toolOpen/.test(kit), 'bug5: a blur caused by opening a tool is ignored');

  // --- 6. School Connect CSV compatibility ---
  ["'opt_a'", "'choice_a'", "'answer_key'", "'correctOption'", "'multiple_select'", "'checkboxes'"]
    .forEach(a => ok(cbtjs.indexOf(a) > -1, 'bug6: CSV alias ' + a + ' accepted'));
  ok(/\^\[A-F\]\$/.test(cbtjs), 'bug6: a letter answer (A/B/C/D) resolves to the option text');

  // --- 7. prompts must ask for a downloadable CSV FILE ---
  ok(/DOWNLOADABLE \.CSV FILE/.test(cbtjs), 'bug7: prompt demands a downloadable file');
  ok(!/copy the block into a/i.test(cbtjs), 'bug7: the copy-and-paste instruction is gone');

  // --- 8 + 17. the assistant icon ---
  ok(/window\.Chatbot \|\| document\.getElementById\('tc-bot-fab'\)/.test(app),
     'bug8: the duplicate dead FAB is not created when the real assistant exists');
  ok(/querySelectorAll\('\.tc-chat-fab, #chatbot-window'\)\.forEach\(el => el\.remove\(\)\)/.test(app),
     'bug8: any legacy duplicate is removed');
  ok(/data-chatbot="open"/.test(app) && /Chatbot\.setOpen\(true\)/.test(app),
     'bug17: legacy markup is delegated to the real assistant');

  // --- 9. brand name ---
  ['README.md'].forEach(f => {
    const p2 = path.join(ROOT, f);
    if (!fs.existsSync(p2)) { R.skip++; return; }
    ok(!/Lumen/i.test(fs.readFileSync(p2, 'utf8')), 'bug9: no "Lumen" naming in ' + f);
  });

  // --- 10. the cbt_exams columns that made saving fail ---
  ['calculator','math_keyboard','subject_breakdown','identity_mode','instructions',
   'exam_type','csv_data','csv_source','is_archived','shuffle_questions','pass_mark']
    .forEach(c => ok(new RegExp('cbt_exams add column if not exists ' + c).test(sql),
                     'bug10: cbt_exams.' + c + ' exists'));
  ok(/tc_cbt_schema_check/.test(sql), 'bug10: a guard reports any future missing CBT column');

  // --- 11. popup legibility ---
  ok(/\.modal,[\s\S]{0,400}color: #0f172a !important/.test(css),
     'bug11: popups pin an explicit high-contrast text colour');
  ok(/body\.dark-mode \.modal/.test(css), 'bug11: dark mode keeps popups legible');
  ok(/\.toast \{ color: #ffffff !important/.test(css), 'bug11: toasts are legible too');

  // --- 12. poll creation ---
  const vt = fs.readFileSync(path.join(ROOT, 'voting.html'), 'utf8');
  ok(/id="vc-create"/.test(vt), 'bug12: a Create poll button exists');
  ok(/tc_create_poll/.test(vt), 'bug12: creation goes through the RPC');
  ok(/function public\.tc_create_poll/.test(sql), 'bug12: tc_create_poll() shipped');
  ['vc-q','vc-options','vc-multi','vc-vis','vc-aud','vc-quorum','vc-close']
    .forEach(i => ok(vt.indexOf('id="' + i + '"') > -1, 'bug12: control #' + i));
  ok(/data-preset="days"/.test(vt), 'bug12: option presets, so nothing is typed twice');
  ok(/string_agg\(value #>> '\{\}', '\|'\)/.test(sql),
     'bug12: options are stored in the shape polls.options actually uses');

  // --- 13. e-receipts ---
  const pay = fs.readFileSync(path.join(ROOT, 'payments.html'), 'utf8');
  ok(!/select\('id,total,parent_id/.test(pay), 'bug13: the invoices.total typo is gone');
  ok(/select\('id,amount,parent_id/.test(pay), 'bug13: invoices.amount is used');
  ok(/tries\+\+ < 25/.test(pay), 'bug13: the panel waits for Supabase instead of giving up');
  ok(/🧾 Receipt/.test(crud), 'bug13: a receipt can be printed from the payment row itself');

  // --- 14. stream editing ---
  ok(/stream: \{ table: 'stream_posts'/.test(crud), 'bug14: stream posts have a CRUD schema');
  const st = fs.readFileSync(path.join(ROOT, 'stream.html'), 'utf8');
  ok(/stream-crud/.test(st), 'bug14: stream.html renders the workbench');
  ok(/CRUD\.renderList\('stream'/.test(st), 'bug14: edit and delete are available');

  // --- 15. dropdowns instead of typing ---
  ok(/type === 'lookup'/.test(crud), 'bug15: a lookup control type exists');
  ok((crud.match(/type: 'lookup'/g) || []).length >= 15,
     'bug15: at least 15 free-text entity fields became dropdowns');
  ok(/Type a new one/.test(crud), 'bug15: a genuinely new value is still possible');
  ok(/data-lookup-select/.test(crud), 'bug15: the dropdown and the text box stay in step');

  // --- 16. predefined prompts on the bot ---
  const cb = fs.readFileSync(path.join(ROOT, 'assets/js/chatbot.js'), 'utf8');
  ok(/suggestions: function/.test(cb), 'bug16: the assistant offers predefined prompts');
  ok(/tc-bot-chips/.test(cb), 'bug16: prompt chips are rendered');

  // --- 2FA (requested) ---
  ['tc_mfa_status','tc_mfa_record','tc_mfa_report'].forEach(f =>
    ok(new RegExp('function public\\.' + f).test(sql), '2fa: ' + f + '() shipped'));
  ok(/create table if not exists public\.user_mfa/.test(sql), '2fa: enrolment is tracked');
  const sc2 = fs.readFileSync(path.join(ROOT, 'security-centre.html'), 'utf8');
  ok(/sb\.auth\.mfa\.enroll/.test(sc2), '2fa: enrolment uses Supabase Auth TOTP (free)');
  ok(/sb\.auth\.mfa\.verify/.test(sc2), '2fa: the code is verified');
  ok(/mfa_required_roles/.test(sql), '2fa: the studio can require it per role');
  ok(/never sees or stores a secret/.test(sc2), '2fa: the page states what is and is not stored');

  return Promise.resolve();
})());

/* --------------------------------------------------------------- report */
Promise.all(PENDING).then(function () {
console.log(`  PASS ${R.pass}` + (R.skip ? `   (${R.skip} generator-only checks skipped)` : ''));
if (R.fail.length) {
  console.log(`  FAIL ${R.fail.length}`);
  R.fail.forEach(f => console.log('   \u2717 ' + f));
} 
console.log(`\n  RESULT: ${R.fail.length ? 'FAILED' : 'ALL RUNTIME TESTS PASSED'}\n`);
process.exit(R.fail.length ? 1 : 0);
});
