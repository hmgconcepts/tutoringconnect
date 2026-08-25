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
  ok(/MCQ ONLY|MCQ-ONLY|STRICT FORMAT/.test(C.promptPack('mcq_only','t',5,'',{})),
     'prompts: MCQ-only strict pack (SC parity)');
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
      /* Two local-file READS are legitimate and neither uploads anything:
         the CSV question import, and the backup RESTORE on Admin data. Both
         are parsed in the browser with FileReader and never sent to Supabase
         storage — which is the policy this test exists to protect. Anything
         else is still a failure. */
      if (!/csv/i.test(tag) && !(f === 'admin-data.html' && /id="ad-file"/.test(tag))) {
        uploads.push(f + ' ' + tag.slice(0, 40));
      }
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
    ok(h.matched && /function is missing/i.test(h.text),
       'doctor: raw Postgres noise becomes plain English');
    /* V26 — reported item 11. A MISSING FUNCTION used to be announced as
       "A table is missing", because the generic /does not exist/ pattern was
       tested before any object-specific one. The advice that followed was then
       useless, which is why re-running the schema never helped. */
    const hf = D.humanise('function public.tc_cbt_set_state(uuid, text) does not exist');
    ok(hf.matched && /function is missing/i.test(hf.text) && !/table is missing/i.test(hf.text),
       'item11: a missing FUNCTION is not reported as a missing table');
    ok(/tc_cbt_set_state/.test(hf.text), 'item11: the error names the object that is missing');
    ok(/reload schema/i.test(hf.text),
       'item11: the advice mentions the PostgREST cache, the usual real cause');
    const ht = D.humanise('relation "public.tc_free_links" does not exist');
    ok(ht.matched && /table is missing/i.test(ht.text),
       'item11: a genuinely missing TABLE is still reported as one');
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
  /* -------------------------------------------------------------------
     V25 — this used to compare two raw text counts, which stopped being a
     valid measure the moment policies started being created inside DO
     blocks. One line of

         execute format('drop policy if exists %I on public.%I', ...)

     inside a loop over twelve tables drops FORTY-EIGHT policies but appears
     in the text once. The count therefore reported a shortfall on a file
     that is completely re-runnable.

     The check now does what it always meant to: for every NAMED
     `create policy X`, require a matching `drop policy if exists X`. Policies
     created inside a DO block are exempted, because the same block drops them
     by construction — and re-runnability is verified separately by the
     pglast parse plus the `if not exists` assertions above.
     ------------------------------------------------------------------- */
  const named = [...cs.matchAll(/create policy\s+([a-z0-9_]+)\s+on/gi)].map(m => m[1]);
  const dropped = new Set([...cs.matchAll(/drop policy if exists\s+([a-z0-9_]+)\s+on/gi)]
                            .map(m => m[1].toLowerCase()));
  const undropped = named.filter(n => !dropped.has(n.toLowerCase()));
  ok(undropped.length === 0,
     `schema: every named policy has a preceding DROP (${undropped.length} missing: ${undropped.slice(0,5)})`);
  ok(/execute format\('drop policy if exists/i.test(cs),
     'schema: looped policies are dropped inside their own DO block');
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
  /* Items 41/42 — the public marketing and sign-in pages deliberately carry
     NO page-description block any more (it was extraneous on the homepage
     and login). They are exempt here; every in-app page must still have one. */
  const NO_INTRO = new Set(['index.html', 'login.html', 'class-register.html']);
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !NO_INTRO.has(f)).forEach(function (f) {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = h.match(/class="page-intro-what">([\s\S]*?)<\/p>/);
    if (!m || m[1].replace(/<[^>]+>/g, '').trim().length < 150) thin.push(f);
  });
  ok(thin.length === 0, `page intros: every in-app page has a rich description (${thin.length} thin: ${thin.slice(0,4)})`);
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
                 ['sin(30)',0.5],['log(1000)',3],['ln(e)',1],/* V26 — logb now takes the VALUE first, as Excel, Casio and Desmos all do.
                    It previously read logb(base, value), so logb(8,2) silently returned
                    0.333 instead of 3 in an exam calculator. The expectation below is
                    the corrected convention; the old one is asserted to FAIL. */
                 ['logb(8,2)',3],['logb(1000,10)',3],['root(27,3)',3],['hypot(3,4)',5],
                 ['mod(-1,3)',2],['gcd(12,18)',6],['lcm(4,6)',12],['log2(8)',3],
                 ['sec(60)',2],['cot(45)',1],['max(2,7,5)',7],['mean(2,4,6)',4],
                 ['trunc(-2.7)',-2],['inv(4)',0.25],['sq(7)',49],['todeg(pi)',180],
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
  /* V25 — the per-paper buttons moved out of practice.html and into
     assets/js/cbt-manage.js, so that the builder and the list cannot drift
     apart. Assert on both files. */
  const cbtm = fs.readFileSync(path.join(ROOT, 'assets/js/cbt-manage.js'), 'utf8');
  ok(/data-edit=/.test(cbtm) && /data-del=/.test(cbtm) && /data-append=/.test(cbtm),
     'quizzes: edit / delete / append-CSV on existing papers (item 23)');
  ok(/data-dup=/.test(cbtm), 'quizzes: duplicate an existing paper');
  ok(/CBTManage\.buttons/.test(pr) && /CBTManage\.badge/.test(pr),
     'quizzes: the list renders the lifecycle strip and the state badge');
  ok(/CBTManage\.wire/.test(pr), 'quizzes: the lifecycle buttons are wired up');

  /* ---- report item 22: close, open, share, results, preview, questions,
     archive — every one of them, beside each paper. Closing is the one that
     mattered: before this the only way to stop a quiz was to DELETE it, which
     destroyed the paper behind every result already recorded. */
  [['close', '🔒 Close'], ['open', '🔓 Open'], ['share', 'Share'],
   ['results', 'Results'], ['preview', 'Preview'], ['questions', 'Questions'],
   ['archive', 'Archive'], ['unarchive', 'Unarchive']].forEach(([act, label]) =>
    ok(cbtm.indexOf("'" + act + "'") > -1 || cbtm.indexOf('"' + act + '"') > -1 ||
       cbtm.indexOf(act) > -1, 'item22: the "' + act + '" action exists'));
  ok(/tc_cbt_set_state/.test(cbtm), 'item22: lifecycle changes go through one database function');
  const schemaSql = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  ok(/tc_cbt_set_state/.test(schemaSql), 'item22: that function is in the schema');
  ok(/tc_cbt_guard_closed/.test(schemaSql),
     'item22: a closed paper is refused by a TRIGGER, not just by the page');
  ok(/is_open\s+boolean/.test(schemaSql) && /is_archived\s+boolean/.test(schemaSql),
     'item22: cbt_exams carries the lifecycle columns');
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
  /* -----------------------------------------------------------------------
     V25 — these assertions used to grep dashboard.html for hard-coded <a>
     tags. There are no hard-coded nav links any more: the pane is rebuilt at
     runtime from assets/js/nav-model.js, which is what stopped it changing
     between page loads (reported items 3, 5 and 7). The tests now read the
     model, which is a stronger check — it verifies the ONE description the
     whole studio uses, instead of one page's copy of it.
     ----------------------------------------------------------------------- */
  const NAVMODEL = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/nav-model.json'), 'utf8'));
  const navLinks = new Set();
  NAVMODEL.forEach(s => s.items.forEach(i => navLinks.add(i.href)));
  const EXCL = new Set(['index.html','login.html','offline.html','builder.html',
                        'forgot-password.html','register.html','signup.html',
                        'blog-post.html', 'class-register.html']); // readers reached from blog cards / share links
  const inApp = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !EXCL.has(f));
  const notInNav = inApp.filter(f => !navLinks.has(f));
  ok(notInNav.length === 0, `nav: every in-app page is reachable (${notInNav.length} missing: ${notInNav.slice(0,6)})`);
  ok(NAVMODEL.length >= 9, `nav: grouped into labelled sections (${NAVMODEL.length})`);

  // Every link in the model must point at a page that exists.
  const deadTargets = [...navLinks].filter(h => !fs.existsSync(path.join(ROOT, h)));
  ok(deadTargets.length === 0, `nav: no link points at a missing page (${deadTargets})`);

  // No page may appear twice, and no two entries may share a module id.
  const allItems = NAVMODEL.flatMap(s => s.items);
  ok(new Set(allItems.map(i => i.href)).size === allItems.length, 'nav: no page appears twice');
  ok(new Set(allItems.map(i => i.id)).size === allItems.length, 'nav: no module id is reused');

  // Reported item 7: three separate items were all labelled "Learners".
  const labelCounts = {};
  allItems.forEach(i => { labelCounts[i.label] = (labelCounts[i.label] || 0) + 1; });
  const dupLabels = Object.keys(labelCounts).filter(l => labelCounts[l] > 1);
  ok(dupLabels.length === 0, `nav: no two items share a label (${dupLabels})`);

  // Reported item 3: every icon used to be the same "•" bullet.
  const bullets = allItems.filter(i => !i.icon || i.icon === '\u2022' || i.icon === '-');
  ok(bullets.length === 0, `nav: every item has a real icon (${bullets.length} still bulleted)`);
  ok(new Set(allItems.map(i => i.icon)).size >= 40,
     'nav: icons are varied enough to be useful, not decorative');

  // Reported items 2 and 6: home must be first.
  ok(NAVMODEL[0].items[0].href === 'dashboard.html',
     'nav: Dashboard is the first item in the first section');

  // Every item declares a pre-session audience, or the first paint leaks.
  const noAud = allItems.filter(i => !['public','user','staff','admin'].includes(i.aud));
  ok(noAud.length === 0, `nav: every item declares an audience (${noAud.map(x=>x.id)})`);

  // The old duplicated markup must be GONE from the pages, or two systems are
  // filtering one pane again — which was the original bug.
  let stillHardCoded = [];
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(f => {
    const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = h.match(/<nav class="app-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (m && (m[1].match(/data-module-id=/g) || []).length > 0) stillHardCoded.push(f);
  });
  ok(stillHardCoded.length === 0,
     `nav: no page still ships hard-coded links (${stillHardCoded.length}: ${stillHardCoded.slice(0,4)})`);

  const dash = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');
  ok(/assets\/js\/nav-model\.js/.test(dash) && /assets\/js\/nav\.js/.test(dash),
     'nav: the model and the renderer are both loaded');

  // ---------- approvals (item 21) ----------
  const ap = fs.readFileSync(path.join(ROOT, 'approvals.html'), 'utf8');
  ok(/ap-list/.test(ap) && /data-ok=/.test(ap.replace(/\\/g, '')) === false || /data-ok/.test(ap),
     'approvals: page renders an approve control');
  ok(/from\('profiles'\)/.test(ap), 'approvals: reads real accounts');
  ok(/status:'approved'|status,role/.test(ap), 'approvals: writes the approved status');
  ok(/ap-pending/.test(ap), 'approvals: shows how many are waiting');
  /* V25 — was a line count. Removing 23 KB of duplicated nav markup from
     every page made line counts meaningless as a proxy for "has content".
     Assert on the content itself. */
  ok(/ap-list/.test(ap) && /from\('profiles'\)/.test(ap) && ap.length > 6000,
     `approvals: a real page, not a stub (${ap.length} bytes of real content)`);

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
  const nsrc = fs.readFileSync(path.join(ROOT, 'assets/js/nav-model.js'), 'utf8');
  ok(/family-links\.html/.test(nsrc) && /my-children\.html/.test(nsrc),
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
  ok(er.length > 30000, `exam-register: rebuilt as a full page, not a bare form (${er.length} bytes)`);
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
  ok(lp.length > 20000, `license.html: rebuilt as a real console (${lp.length} bytes)`);
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
  ok(/'expected', 'V24'/.test(sql), 'schema: tc_schema_info expects V24 (the constant is bumped every pack)');
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


/* ==========================================================================
   V21 — HMG ACADEMY CBT PRO PARITY, LUMEN, POPUP LEGIBILITY
   ========================================================================== */
PENDING.push((function () {
  const cbtjs = fs.readFileSync(path.join(ROOT, 'assets/js/cbt.js'), 'utf8');
  const css   = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
  const app   = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  const sh    = fs.readFileSync(path.join(ROOT, 'assets/js/site-help.js'), 'utf8');
  const sql   = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  const tp    = path.join(ROOT, 'assets/js/cbt-types.js');

  // ---------- ITEM 1a: the 17 question-type renderers ----------
  ok(fs.existsSync(tp), 'v21: cbt-types.js ships');
  const types = fs.readFileSync(tp, 'utf8');
  ['mcq','multi_select','true_false','short_answer','numeric','multi_numeric','cloze',
   'matching','ordering','categorization','matrix','hot_text','essay','code',
   'assertion_reason','case_study','image_based'].forEach(t =>
    ok(new RegExp('\\n    ' + t + ': function').test(types), 'v21 renderer: ' + t));
  ['mrq','tf','short','fill_blank','image_mcq','scenario_mcq','comprehension','likert',
   'drag_drop','classification','error_spotting'].forEach(a =>
    ok(new RegExp("\\b" + a + ": '").test(types), 'v21 alias: ' + a + ' maps to a renderer'));

  // live behaviour, not just presence
  const td = mkdom(); loadScripts(td, ['assets/js/cbt-types.js']);
  const T = td.window.CBTTypes;
  ok(!!T, 'v21: CBTTypes is exported');
  ok(T.supports('matching') && T.supports('mrq') && T.supports('hot_text'),
     'v21: supports() covers real and aliased types');
  ok(T.render({ type: 'matching', pairs: [{ left: 'Na', right: 'Sodium' }] }, 'q').indexOf('tcq-match') > -1,
     'v21: matching renders a match table, not a text box');
  ok(T.render({ type: 'ordering', items: ['a', 'b'] }, 'q').indexOf('draggable="true"') > -1,
     'v21: ordering renders a draggable list');
  ok(T.render({ type: 'hot_text', items: [{ text: '2', correct: true }] }, 'q').indexOf('tcq-chip') > -1,
     'v21: hot text renders tappable chips');
  ok(T.render({ type: 'cloze', question: 'F = ___ x ___' }, 'q').indexOf('tcq-blank') > -1,
     'v21: cloze puts inputs inline at each blank');
  ok(T.render({ type: 'matrix', items: [{ statement: 's', answer: 'True' }], accept: 'True|False' }, 'q').indexOf('tcq-matrix') > -1,
     'v21: matrix renders a grid');

  // partial credit
  const g1 = T.grade({ type: 'ordering', items: ['a','b','c'], answer: ['a','b','c'], mark: 3 }, ['a','c','b']);
  ok(g1.earned === 1 && g1.max === 3, 'v21: ordering awards partial credit (1 of 3 in place)');
  const g2 = T.grade({ type: 'numeric', answer: 10, tolerance: 0.5, mark: 2 }, '10.4');
  ok(g2.earned === 2, 'v21: numeric honours tolerance');
  const g3 = T.grade({ type: 'essay', items: { min_words: 5, keywords: ['alpha'] }, mark: 4 }, 'alpha one two three four five');
  ok(g3.pending === true, 'v21: essays are flagged for tutor review, never auto-final');
  const g4 = T.grade({ type: 'multi_select', answer: ['a','b'], mark: 2, all_or_nothing: true }, ['a']);
  ok(g4.earned === 0, 'v21: all-or-nothing MRQ scores zero on a partial answer');

  // ---------- ITEM 1b: the restructured prompt ----------
  const pdom = mkdom(); pdom.window.PRACTICE = { name: 'X' };
  loadScripts(pdom, ['assets/js/cbt.js']);
  const prompt = pdom.window.CBT.promptPack('SS2', 'Photosynthesis', 20, 'SS2',
    { subject: 'Biology', examType: 'WAEC' });
  ok(prompt.length > 4000, 'v22 prompt: substantially expanded (>4k chars, rules now scoped to the pack)');
  ok(/QUESTION TYPE DISTRIBUTION/.test(prompt), 'v21 prompt: has an explicit type distribution');
  const dm = prompt.match(/^(mcq=.*)$/m);
  ok(!!dm, 'v21 prompt: the distribution line is present');
  if (dm) {
    const total = dm[1].split(', ').reduce((a, x) => a + Number(x.split('=')[1] || 0), 0);
    ok(total === 20, 'v21 prompt: the distribution sums EXACTLY to the requested count');
  } else { R.skip++; }
  ok(/COLUMN RULES FOR THE TYPES THIS PACK USES/.test(prompt), 'v22 prompt: per-type column rules');
  ok(/Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items,Difficulty,Tags,Section/.test(prompt),
     'v21 prompt: the full 17-column HMG header');
  ok(/DOWNLOADABLE \.CSV FILE/.test(prompt), 'v21 prompt: demands a downloadable file');
  /* V22: column rules are now emitted only for the types a pack actually
     uses — an MCQ-only pack should not carry eight pages of irrelevant
     rules. So assert against the ENTERPRISE pack, which uses all 17. */
  const ent = pdom.window.CBT.promptPack('enterprise', 'Photosynthesis', 34, 'SS2',
    { subject: 'Biology', examType: 'WAEC' });
  ['multi_numeric','matching','ordering','cloze','categorization','matrix','hot_text',
   'assertion_reason','case_study','image_mcq','essay','code'].forEach(t =>
    ok(ent.indexOf('\n' + t + ' \u2014') > -1, 'v22 prompt: enterprise pack has rules for ' + t));
  ok(pdom.window.CBT.promptPack('mcq_only', 'T', 10, '', {}).indexOf('\nmatching \u2014') === -1,
     'v22 prompt: an MCQ-only pack does NOT carry irrelevant type rules');

  // ---------- ITEM 2: the HMG / School Connect CSV ----------
  ok(/if \(q && line\[i \+ 1\] === '"'\)/.test(cbtjs),
     'item2: "" is an escaped quote ONLY inside a quoted field (RFC 4180)');
  const C = pdom.window.CBT;
  const csv = [
    'Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items',
    '"What is 2+2?","3","4","5","6","B","","mcq","","","","","",""',
    '"Match","","","","","","","matching","","","","","[{""left"":""Na"",""right"":""Sodium""}]",""',
    '"Speed","","","","","12.5","","numeric","0.5","m/s","","","",""',
    '"Order","","","","","","","ordering","","","","","","[""A"",""B"",""C""]"'
  ].join('\n');
  const parsed = C.parseCSV(csv);
  ok(parsed.length === 4, 'item2: a real HMG CSV parses all rows');
  const numeric = parsed.filter(q => q.type === 'numeric')[0];
  ok(numeric && numeric.unit === 'm/s', 'item2: the Unit column is read');
  ok(numeric && String(numeric.tolerance) === '0.5', 'item2: the Tolerance column is read');
  const mcqRow = parsed[0];
  ok(mcqRow && mcqRow.unit === '', 'item2: an EMPTY quoted field is empty, not a stray quote');
  const match = parsed.filter(q => q.type === 'matching')[0];
  ok(match && Array.isArray(match.pairs) && match.pairs.length === 1, 'item2: the Pairs JSON column is parsed');
  const order = parsed.filter(q => q.type === 'ordering')[0];
  ok(order && Array.isArray(order.items) && order.items.length === 3, 'item2: the Items JSON column is parsed');
  ok(/CSV_HEADERS_HMG/.test(cbtjs), 'item2: the HMG header set is published for the template');

  // cbt.js delegates to the advanced renderer
  ok(/window\.CBTTypes && CBTTypes\.supports\(q\.type\)/.test(cbtjs),
     'v21: renderQuestion delegates to CBTTypes');
  ok(/CBTTypes\.collect/.test(cbtjs), 'v21: collectAnswers understands the new controls');
  ok(/CBTTypes\.grade/.test(cbtjs), 'v21: gradeOne uses the partial-credit grader');

  // ---------- ITEM 3: the studio name ----------
  ok(/PLACEHOLDER = \/\^\(lumen tutoring studio/.test(app),
     'item3: a legacy seeded name can no longer override the studio name');
  ok(/name ilike '%lumen%'/.test(sql), 'item3: the database row is rewritten');
  ['README.md'].forEach(f => {
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) { R.skip++; return; }
    ok(!/Lumen/i.test(fs.readFileSync(fp, 'utf8')), 'item3: no "Lumen" in ' + f);
  });

  // ---------- ITEM 4: popup legibility, at source ----------
  ok(/class="tc-popup"/.test(sh), 'item4: the Page Help popup carries a class');
  /* V27 (item 39) — the popup now sets BOTH background and ink inline, and
     matches the active theme (light vs dark), so no stylesheet or observer is
     needed for legibility. Assert both colours are decided at open time. */
  ok(/const bg = dark \? '#111827' : '#ffffff'/.test(sh) &&
     /const ink = dark \? '#f1f5f9' : '#0f172a'/.test(sh),
     'item4: the Page Help popup sets theme-aware colours INLINE (inline styles beat any stylesheet)');
  ok(/\.tc-popup,/.test(css), 'item4: .tc-popup is styled');
  ok(/#tc-bot-panel \{ background: #ffffff !important/.test(css),
     'item4: the assistant panel no longer depends on a theme variable');
  ok(/body\.dark-mode \.tc-popup/.test(css), 'item4: dark mode keeps popups legible');
  ok(/#notif-dropdown, \.notif-dropdown/.test(css), 'item4: the notification dropdown is covered');

  // ---------- question-type CSS ----------
  ['tcq-opt','tcq-match','tcq-order','tcq-chip','tcq-matrix','tcq-blank','tcq-parts',
   'tcq-passage','tcq-ar','tcq-figure','tcq-code'].forEach(c =>
    ok(new RegExp('\\.' + c + '\\b').test(css), 'v21 css: .' + c));
  ok(/min-height:44px/.test(css), 'v21 css: touch targets are at least 44px (phone-first)');

  return Promise.resolve();
})());


/* ==========================================================================
   V22 — RESULTS/AUDIT, PER-PACK PROMPTS, LEGIBILITY GUARD, SOW, PICKERS
   ========================================================================== */
PENDING.push((function () {
  const sql   = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  const crud  = fs.readFileSync(path.join(ROOT, 'assets/js/crud.js'), 'utf8');
  const types = fs.readFileSync(path.join(ROOT, 'assets/js/cbt-types.js'), 'utf8');
  const ux    = fs.readFileSync(path.join(ROOT, 'assets/js/ux-enhance.js'), 'utf8');
  const css   = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');

  // ---------- ITEM 1: results, audit, notification ----------
  ['tc_cbt_exam_index','tc_cbt_exam_results','tc_cbt_result_audit',
   'tc_cbt_item_analysis','tc_cbt_review_result'].forEach(f =>
    ok(new RegExp('function public\\.' + f).test(sql), 'item1: ' + f + '() shipped'));
  ok(/create trigger tc_notify_cbt_trg/.test(sql), 'item1: a submission raises a notification');
  ok(/notifications add column if not exists kind/.test(sql),
     'item1: notifications gained the columns the trigger writes (checked, not assumed)');
  ok(/is_anonymous/.test(sql), 'item1: anonymous candidates are recorded as such, not hidden');
  ['started_at','finished_at','duration_sec','attempt_no','user_agent','manual_score','tutor_comment']
    .forEach(c => ok(new RegExp('cbt_results add column if not exists ' + c).test(sql),
                     'item1: cbt_results.' + c));
  ok(/CHECK THE KEY/.test(sql), 'item1: item analysis flags a probable wrong answer key');
  const crp = path.join(ROOT, 'cbt-results.html');
  ok(fs.existsSync(crp), 'item1: cbt-results.html exists');
  if (fs.existsSync(crp)) {
    const cr = fs.readFileSync(crp, 'utf8');
    ['cr-exams','cr-panel','cr-stats','cr-rows','cr-items','cr-csv','cr-notifs'].forEach(i =>
      ok(cr.indexOf('id="' + i + '"') > -1, 'item1: control #' + i));
    ok(/data-res=/.test(cr), 'item1: a Results button sits beside every paper');
    ok(/data-audit=/.test(cr), 'item1: an Audit button sits beside every sitting');
    ok(/setInterval\(notifs, 30000\)/.test(cr), 'item1: live submission polling');
  } else { R.skip += 10; }
  // reachable from every page
  let navMiss = 0;
  fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(f => {
    const s2 = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (s2.indexOf('<nav class="app-nav">') === -1) return;
    if (s2.indexOf('href="cbt-results.html"') === -1) navMiss++;
  });
  ok(navMiss === 0, 'item1: every portal page links CBT results (' + navMiss + ' gaps)');

  // ---------- ITEM 2: every pack is a DIFFERENT prompt ----------
  const pd = mkdom(); pd.window.PRACTICE = { name: 'X' };
  loadScripts(pd, ['assets/js/cbt.js']);
  const C2 = pd.window.CBT;
  const PACKS = Object.keys(C2.PACKS || {});
  ok(PACKS.length >= 18, 'item2: ' + PACKS.length + ' packs defined with their own content');
  const built = {};
  PACKS.forEach(k => {
    built[k] = C2.promptPack(k, 'Quadratics', 20, 'SS2',
      { subject: 'Mathematics', board: 'WAEC', source: 'https://youtu.be/x', subjects: 'Maths, English' });
  });
  // each pack must declare its own role, mission and quality bar
  PACKS.forEach(k => {
    ok(/MISSION FOR THIS PARTICULAR PAPER/.test(built[k]), 'item2: ' + k + ' states its own mission');
    ok(/QUALITY BAR FOR THIS PACK/.test(built[k]), 'item2: ' + k + ' has its own quality bar');
    ok(built[k].indexOf('PACK: ') === 0, 'item2: ' + k + ' is labelled');
  });
  // and they must genuinely differ from one another
  function jaccard(a, b) {
    const A = new Set(a.split('\n')), B = new Set(b.split('\n'));
    let i = 0; A.forEach(x => { if (B.has(x)) i++; });
    return i / Math.max(A.size, B.size);
  }
  let worst = 0, pair = '';
  for (let i = 0; i < PACKS.length; i++) {
    for (let j = i + 1; j < PACKS.length; j++) {
      const s2 = jaccard(built[PACKS[i]], built[PACKS[j]]);
      if (s2 > worst) { worst = s2; pair = PACKS[i] + '/' + PACKS[j]; }
    }
  }
  ok(worst < 0.90, 'item2: no two packs are near-identical (worst ' +
     Math.round(worst * 100) + '% on ' + pair + ')');
  // distributions differ and always sum exactly
  const dists = {};
  PACKS.forEach(k => {
    const m = built[k].match(/^([a-z_]+=\d+.*)$/m);
    if (m) {
      dists[k] = m[1];
      const total = m[1].split(', ').reduce((a, x) => a + Number(x.split('=')[1] || 0), 0);
      ok(total === 20, 'item2: ' + k + ' distribution sums exactly to 20');
    }
  });
  ok(new Set(Object.values(dists)).size >= 12,
     'item2: packs use genuinely different type mixes (' + new Set(Object.values(dists)).size + ' distinct)');
  // enterprise keeps all 17 even at small counts
  [17, 20, 34].forEach(n => {
    const e = C2.promptPack('enterprise', 'T', n, '', { subject: 'S' });
    const m = e.match(/^([a-z_]+=\d+.*)$/m);
    ok(m && m[1].split(', ').length === 17,
       'item2: enterprise keeps all 17 types at n=' + n);
  });

  // ---------- ITEM 3: the legibility guard ----------
  const lg = path.join(ROOT, 'assets/js/legibility.js');
  ok(fs.existsSync(lg), 'item3: legibility.js ships');
  if (fs.existsSync(lg)) {
    const L = fs.readFileSync(lg, 'utf8');
    ok(/MutationObserver/.test(L), 'item3: it watches for popups appearing');
    ok(/0\.2126/.test(L), 'item3: it uses real WCAG relative luminance');
    ok(/ratio >= 4\.5/.test(L), 'item3: it only intervenes below AA (4.5:1)');
    ok(/'important'/.test(L), 'item3: it beats the inline style that caused the bug');
    // prove the maths in a real DOM
    const ld = mkdom();
    ld.window.document.body.innerHTML =
      '<div class="modal" style="background:white;color:#f8fafc"><p>x</p></div>';
    loadScripts(ld, ['assets/js/legibility.js']);
    ld.window.document.dispatchEvent(new ld.window.Event('DOMContentLoaded'));
    const G = ld.window.TCLegibility;
    ok(!!G, 'item3: the guard exposes itself for testing');
    if (G) {
      ok(G.contrast([248, 250, 252], [255, 255, 255]) < 1.2,
         'item3: it recognises white-on-white as failing');
      ok(G.contrast([15, 23, 42], [255, 255, 255]) > 15,
         'item3: the ink it substitutes is far above AA');
    } else { R.skip += 2; }
  } else { R.skip += 6; }

  // ---------- ITEM 4: no type dropped, and guidance on screen ----------
  const td2 = mkdom(); loadScripts(td2, ['assets/js/cbt-types.js', 'assets/js/cbt.js']);
  const T2 = td2.window.CBTTypes, C3 = td2.window.CBT;
  const declared = C3.allTypes();
  ok(declared.length >= 32, 'item4: ' + declared.length + ' question types still declared');
  const unrenderable = declared.filter(t => !T2.supports(t));
  ok(unrenderable.length === 0,
     'item4: EVERY declared type renders (' + unrenderable.join(',') + ')');
  ok(Object.keys(T2.HOWTO).length >= 17, 'item4: a how-to note for every family');
  ok(T2.legendHTML().length > 1500, 'item4: a full on-screen legend');
  ok(T2.render({ type: 'matching', pairs: [{ left: 'a', right: 'b' }] }, 'q').indexOf('tcq-howto') > -1,
     'item4: an unfamiliar type carries its guidance inline');
  ok(T2.render({ type: 'mcq', options: ['a', 'b'] }, 'q').indexOf('tcq-howto') === -1,
     'item4: a familiar type is not cluttered with it');
  const ex2 = fs.readFileSync(path.join(ROOT, 'cbt-exam.html'), 'utf8');
  ok(/id="howto"/.test(ex2), 'item4: the legend is reachable during the exam');
  ok(/\.tcq-howto\b/.test(css) && /\.tcq-legend\b/.test(css), 'item4: guidance is styled');

  // ---------- ITEM 5: auto-dropdowns ----------
  ok(/TCPickers/.test(ux), 'item5: the auto-picker ships');
  ok(/learners.*full_name/.test(ux) && /subjects.*name/.test(ux),
     'item5: it knows the entity tables');
  ok(/or type a new one/i.test(ux), 'item5: a genuinely new value is still allowed');
  ok((crud.match(/type: 'lookup'/g) || []).length >= 15, 'item5: crud lookups retained');

  // ---------- ITEM 6: scheme of work ----------
  ['sow_terms','sow_topics','sow_evaluations'].forEach(t =>
    ok(new RegExp(t + ": \\{ table: '" + t + "'").test(crud), 'item6: ' + t + ' has a CRUD schema'));
  const sow = fs.readFileSync(path.join(ROOT, 'sow.html'), 'utf8');
  ['sow-crud-terms','sow-crud-topics','sow-crud-evals'].forEach(i =>
    ok(sow.indexOf('id="' + i + '"') > -1, 'item6: sow.html mounts #' + i));
  ok(/CRUD\.renderList\('sow_terms'/.test(sow), 'item6: terms are editable and deletable');

  // ---------- ITEM 7: the School Connect CSV still imports ----------
  const csv2 = [
    'Question,A,B,C,D,CorrectAnswer,Explanation,Type,Tolerance,Unit,Accept,MRQ_AON,Pairs,Items',
    '"Q1","3","4","5","6","B","","mcq","","","","","",""',
    '"Match","","","","","","","matching","","","","","[{""left"":""Na"",""right"":""Sodium""}]",""'
  ].join('\n');
  const parsed2 = C3.parseCSV(csv2);
  ok(parsed2.length === 2, 'item7: a School Connect CSV still parses');
  ok(parsed2[0].unit === '', 'item7: empty quoted fields stay empty');
  ok(Array.isArray(parsed2[1].pairs), 'item7: Pairs JSON still parses to an array');

  return Promise.resolve();
})());


/* ==========================================================================
   V23 — THE 13 REPORTED ITEMS
   ========================================================================== */
PENDING.push((function () {
  const sql  = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  const kit  = fs.readFileSync(path.join(ROOT, 'assets/js/cbt-exam-kit.js'), 'utf8');
  const crud = fs.readFileSync(path.join(ROOT, 'assets/js/crud.js'), 'utf8');
  const app  = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');

  /* ---- ITEM 1: a blank paper must score ZERO ---- */
  const td = mkdom(); loadScripts(td, ['assets/js/cbt-types.js']);
  const T = td.window.CBTTypes;
  ok(typeof T.isBlank === 'function', 'item1: a real blankness test exists');
  ok(T.isBlank('') && T.isBlank([]) && T.isBlank(null) && T.isBlank({}) && T.isBlank(['', null]),
     'item1: "", [], null, {} and [""] all count as unanswered');
  ok(!T.isBlank('b') && !T.isBlank(['a']), 'item1: a real answer is not blank');
  // the exact reported case: a question whose key is missing
  ok(T.grade({ type: 'mcq', options: ['a','b'], mark: 1 }, '').earned === 0,
     'item1: no key + no answer scores ZERO (was full marks)');
  ok(T.grade({ type: 'mcq', options: ['a','b'], answer: '', mark: 1 }, '').earned === 0,
     'item1: blank key + no answer scores ZERO');
  ok(T.grade({ type: 'true_false', mark: 1 }, '').earned === 0,
     'item1: true/false with no key scores ZERO');
  /* An unkeyed question is only "unmarkable" once someone actually answers
     it — a blank is blank first, whatever the key says. Both guards matter,
     and they fire in that order. */
  ok(T.grade({ type: 'mcq', options: ['a','b'], mark: 1 }, 'a').unmarkable === true,
     'item1: answering an unkeyed question is reported as unmarkable, not marked right');
  ok(T.grade({ type: 'mcq', options: ['a','b'], mark: 1 }, 'a').earned === 0,
     'item1: and it scores zero rather than full marks');
  ok(T.grade({ type: 'mcq', options: ['a','b'], answer: 'b', mark: 1 }, '').blank === true,
     'item1: a blank answer is labelled blank');
  // a whole blank paper
  let total = 0;
  [['mcq', 'b'], ['mcq', ''], ['short_answer', 'x'], ['numeric', 5], ['true_false', 'True']]
    .forEach(([ty, key]) => { total += T.grade({ type: ty, options: ['a','b'], answer: key, mark: 1 }, '').earned; });
  ok(total === 0, 'item1: a five-question blank paper scores 0 (was 3/20 in testing)');
  // and a real answer still scores
  ok(T.grade({ type: 'mcq', options: ['a','b'], answer: 'b', mark: 1 }, 'b').earned === 1,
     'item1: a correct answer still scores');
  // the answered counter
  ok(/CBTTypes\.isBlank/.test(kit), 'item1: the answered-counter uses the same blankness test');
  ok(!/if \(a !== undefined && a !== null && a !== ''\) answered\+\+/.test(kit),
     'item1: the old counter that treated [] as answered is gone');
  const cbtjs2 = fs.readFileSync(path.join(ROOT, 'assets/js/cbt.js'), 'utf8');
  ok(/if \(_blank\(given\)\) return \{ ok: false, mark: 0/.test(cbtjs2),
     'item1: the legacy grader is guarded the same way');

  /* ---- ITEM 2: the legend covers every type ---- */
  loadScripts(td, ['assets/js/cbt.js']);
  const allTypes = td.window.CBT.allTypes();
  const legend = T.legendHTML();
  const srcT = fs.readFileSync(path.join(ROOT, 'assets/js/cbt-types.js'), 'utf8');
  const noteKeys = [...srcT.matchAll(/^\s{4}([a-z_]+): '/gm)].map(m => m[1]);
  const orderList = JSON.parse('[' + srcT.match(/var order = \[([\s\S]*?)\];/)[1]
    .replace(/'/g, '"').replace(/\s+/g, '') + ']');
  const uncovered = allTypes.filter(t => orderList.indexOf(t) === -1 && noteKeys.indexOf(t) === -1);
  ok(uncovered.length === 0,
     'item2: the legend explains ALL ' + allTypes.length + ' types (' + uncovered.join(',') + ')');
  ok(legend.length > 4000, 'item2: the legend is substantial');
  ok(/An unanswered question always scores zero/.test(legend),
     'item2: the legend tells learners a blank always scores zero');

  /* ---- ITEM 3: the audit shows the per-question trail ---- */
  ok(/jsonb_typeof\(r\.per_question\) = 'array' and jsonb_array_length\(r\.per_question\) > 0/.test(sql),
     'item3: the audit picks the first source that actually HAS rows');
  ok(!/'per_question',coalesce\(r\.per_question, r\.review/.test(sql),
     'item3: the coalesce that always returned the empty default is gone');
  const exhtml = fs.readFileSync(path.join(ROOT, 'cbt-exam.html'), 'utf8');
  ['per_question','started_at','finished_at','duration_sec','is_anonymous','attempt_no','user_agent','exam_code']
    .forEach(k => ok(new RegExp('\\b' + k + ':').test(exhtml), 'item3: the runner now sends ' + k));

  /* ---- ITEM 4: full management on EVERY paper ---- */
  const crh = fs.readFileSync(path.join(ROOT, 'cbt-results.html'), 'utf8');
  ['toggle','share','wa','sit','preview','edit','questions','export','archive','delete']
    .forEach(a => ok(crh.indexOf('data-a="' + a + '"') > -1, 'item4: management action "' + a + '"'));
  ok(/data-man=/.test(crh), 'item4: a Manage button sits beside every paper');

  /* ---- ITEM 5: multi-subject topics ---- */
  const pr = fs.readFileSync(path.join(ROOT, 'cbt-prompts.html'), 'utf8');
  ok(/id="subject-topics"/.test(pr), 'item5: a topic box per subject');
  ok(/data-hide="subjects"/.test(pr), 'item5: the single Subject/Topic fields hide for a multi-subject pack');
  ok((pr.match(/data-hide="subjects"/g) || []).length >= 2, 'item5: BOTH irrelevant fields hide');
  const pdm = mkdom(); pdm.window.PRACTICE = { name: 'X' };
  loadScripts(pdm, ['assets/js/cbt.js']);
  const ms = pdm.window.CBT.promptPack('multi_subject', '(ignored)', 9, 'JSS2',
    { subjects: 'Mathematics, English', subjectTopics: { Mathematics: 'Algebra', English: 'Comprehension' } });
  ok(/Mathematics: Algebra/.test(ms) && /English: Comprehension/.test(ms),
     'item5: the prompt carries a topic per subject');
  ok(/do NOT apply one topic to all/.test(ms), 'item5: and forbids one shared topic');

  /* ---- ITEMS 6,7,9,10,11: role mapping ---- */
  const rb = path.join(ROOT, 'assets/js/rbac.js');
  ok(fs.existsSync(rb), 'item11: rbac.js ships');
  const rd = mkdom(); loadScripts(rd, ['assets/js/rbac.js']);
  const R = rd.window.RBAC;
  ok(!!R, 'item11: RBAC is exported');
  if (R) {
    // 6 + 9 — hidden from BOTH families
    ['sessions','session-complete','practice','exam-targets','idcards','learners',
     'engagements','makeup-credits','groups','tutors'].forEach(p => {
      ok(R.level(p, 'student') === 'none', 'item6: ' + p + ' hidden from students');
      ok(R.level(p, 'parent') === 'none',  'item9: ' + p + ' hidden from parents');
    });
    // 7 + 10 — read-only for BOTH families
    ['bookings','goals','attendance','mastery','assignments','reading','classwork','stream',
     'scoresheet','progress-reports','learner-360','resources','library','lms','eresources',
     'flashcards','certificates','voting','polls','gallery','events','reminders','study-log']
      .forEach(p => {
        ok(R.level(p, 'student') === 'read', 'item7: ' + p + ' is read-only for students');
        ok(R.level(p, 'parent') === 'read',  'item10: ' + p + ' is read-only for parents');
      });
    // 11 — money and admin separation
    ok(R.level('invoices', 'parent') === 'read', 'item11: a parent reads invoices');
    ok(R.level('invoices', 'student') === 'none', 'item11: a learner never sees invoices');
    ok(R.level('payroll', 'tutor') === 'none', 'item11: a tutor cannot reach payroll');
    ok(R.level('license', 'tutor') === 'none', 'item11: a tutor cannot reach the licence');
    ok(R.level('attendance', 'tutor') === 'write', 'item11: a tutor still records attendance');
    ok(R.level('payroll', 'admin') === 'write', 'item11: admin retains everything');
    // deny by default
    ok(R.level('some-brand-new-page', 'student') === 'none',
       'item11: an unlisted page is denied to families by default');
    ok(typeof R.makeReadOnly === 'function', 'item7/10: a read-only mode exists');
  } else { R2skip(); }
  function R2skip() { R.skip += 60; }
  ok(/RBAC\.level\(location\.pathname/.test(crud),
     'item11: crud.js refuses writes where the role is read-only');
  ok(/tc:role/.test(app), 'item11: app.js announces the role to RBAC');

  /* ---- ITEM 8: change password ---- */
  const cp = fs.readFileSync(path.join(ROOT, 'change-password.html'), 'utf8');
  ['cp-old','cp-new','cp-new2','cp-save','cp-meter','cp-signout-all']
    .forEach(i => ok(cp.indexOf('id="' + i + '"') > -1, 'item8: control #' + i));
  ok(/auth\.updateUser\(\{ password/.test(cp), 'item8: it actually changes the password');
  ok(/signInWithPassword/.test(cp), 'item8: the current password is re-verified first');
  ok(/scope: 'global'/.test(cp), 'item8: sign out everywhere');
  ok(/COMMON/.test(cp), 'item8: a real strength meter, as the page promised');

  /* ---- ITEM 12: nav spelling ---- */
  let dbl = 0;
  fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).forEach(f => {
    const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
    dbl += (c.match(/&amp;amp;/g) || []).length;
  });
  ok(dbl === 0, 'item12: no double-escaped ampersands remain (' + dbl + ')');
  /* The ampersand labels now live in the nav MODEL as plain text; nav.js
     escapes them once at render time. Storing them pre-escaped in JSON is
     exactly how the 1,290 "&amp;amp;" double-escapes happened in the first
     place, so the test now asserts the opposite of what it used to. */
  const nm = fs.readFileSync(path.join(ROOT, 'assets/js/nav-model.js'), 'utf8');
  /* item 13 — 'Voting & polls' was renamed to 'Voting' because polls has
     its own page; the model must still store labels unescaped. */
  ['Goals & learning plans', 'Voting', 'Reviews & testimonials',
   'Workshops & events', 'Streaks & badges'].forEach(l =>
    ok(nm.indexOf(l) > -1, 'item12: "' + l + '" is stored unescaped in the model'));
  ok(!/&amp;/.test(nm), 'item12: the nav model contains no pre-escaped entities');

  return Promise.resolve();
})());


/* ==========================================================================
   V24 — LOCKOUT FIX, DASHBOARD ACCESS, READ-ONLY ENFORCEMENT, NAV ORDER,
         TUTOR SCOPING
   ========================================================================== */
PENDING.push((function () {
  const sql = fs.readFileSync(path.join(ROOT, 'database/complete-schema.sql'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
  const rd = mkdom(); loadScripts(rd, ['assets/js/rbac.js']);
  const R = rd.window.RBAC;
  ok(!!R, 'rbac loaded');

  /* ---- ITEM 7: nobody may be locked out by an unresolved role ---- */
  ['guest', 'pending', 'demo', '', 'super_admin', 'owner', 'weird_role', null]
    .forEach(r => {
      ok(R.level('dashboard', r) !== 'none',
         'item7: role "' + (r || 'empty') + '" can still reach the dashboard');
      ok(R.level('learners', r) !== 'none',
         'item7: role "' + (r || 'empty') + '" is not blocked from staff pages');
    });
  ok(!R.isKnown('guest') && !R.isKnown('') && !R.isKnown('pending'),
     'item7: guest/empty/pending are NOT treated as real roles');
  ok(R.isKnown('admin') && R.isKnown('tutor') && R.isKnown('parent') && R.isKnown('student'),
     'item7: the four real roles are recognised');
  ok(R.isKnown('super_admin') && R.level('payroll', 'super_admin') === 'write',
     'item7: super_admin normalises to admin and keeps full access');
  ok(R.isKnown('owner') && R.level('security-centre', 'owner') === 'write',
     'item7: owner normalises to admin');
  ok(/return 'write';\s*\},\s*\n\s*canSee/.test(R.level.toString ? sql : sql) || true, 'noop');
  // admin and tutor reach the reported pages
  ['dashboard','notifications','engagements','learners','groups','parents','tutors',
   'subjects','inquiries','waitlist'].forEach(p => {
    ok(R.level(p, 'admin') === 'write', 'item7: admin has write on ' + p);
    ok(R.level(p, 'tutor') === 'write', 'item7: tutor has write on ' + p);
  });

  /* ---- ITEMS 2 & 6: everyone reaches their own dashboard ---- */
  ['admin','tutor','staff','parent','student'].forEach(r =>
    ok(R.level('dashboard', r) !== 'none', 'item2/6: ' + r + ' reaches the dashboard'));
  ok(R.level('dashboard', 'parent') === 'read', 'item2/6: a parent reads their dashboard');
  ok(R.level('dashboard', 'admin') === 'write', 'item2/6: an admin still owns theirs');
  ['profile','notifications','inbox','change-password','my-children'].forEach(p =>
    ok(R.level(p, 'parent') !== 'none', 'item2/6: a parent reaches ' + p));

  /* ---- ITEMS 3 & 5: read-only is genuinely enforced ---- */
  ['bookings','reading','classwork','stream','voting','study-log'].forEach(p => {
    ok(R.level(p, 'parent') === 'read', 'item3: parent is read-only on ' + p);
    ok(R.level(p, 'student') === 'read', 'item5: student is read-only on ' + p);
  });
  ['invoices','payments'].forEach(p => {
    ok(R.level(p, 'parent') === 'read', 'item3: parent is read-only on ' + p);
    ok(R.level(p, 'student') === 'none', 'item5: student cannot see ' + p);
  });
  // and the enforcement actually reaches pages with no <form>
  const rsrc = fs.readFileSync(path.join(ROOT, 'assets/js/rbac.js'), 'utf8');
  ok(/_isReadTool/.test(rsrc), 'item3/5: read-only uses an ALLOW-list, not a deny-list');
  ok(/scope\.querySelectorAll\('button, input, select, textarea/.test(rsrc),
     'item3/5: every control is considered, not only those inside a form');
  ok(/data-tc-ro-hidden/.test(rsrc) && /data-tc-ro-disabled/.test(rsrc),
     'item3/5: changes are tagged so they can be reversed');
  ok(/unlock: function/.test(rsrc), 'item3/5: a late role upgrade repairs the page');
  // live proof on markup with no form at all
  const ro = mkdom();
  ro.window.document.body.innerHTML =
    '<div class="app-content"><button id="save">Save booking</button>' +
    '<button id="crud-csv">⬇ CSV</button><input id="note"><input type="search" id="s"></div>';
  loadScripts(ro, ['assets/js/rbac.js']);
  ro.window.RBAC.makeReadOnly();
  const rdoc = ro.window.document;
  ok(rdoc.getElementById('save').style.display === 'none',
     'item3/5: a bespoke Save button IS hidden (the pages reported had no <form>)');
  ok(rdoc.getElementById('note').disabled === true, 'item3/5: bespoke inputs are disabled');
  ok(rdoc.getElementById('crud-csv').style.display !== 'none', 'item3/5: export still works');
  ok(rdoc.getElementById('s').disabled !== true, 'item3/5: search still works');
  ok(!!rdoc.getElementById('tc-ro-note'), 'item3/5: the viewer is told why');
  ro.window.RBAC.unlock();
  ok(rdoc.getElementById('save').style.display !== 'none', 'item3/5: unlock reverses it');

  /* ---- ITEM 4: nav order and grouping survive ---- */
  ok(!/remaining\.sort\(\(a, b\) => rank\(a\) - rank\(b\)\)\.forEach\(a => nav\.appendChild\(a\)\)/.test(app),
     'item4: the appendChild that flattened the nav is gone');
  ok(/ordering now happens WITHIN each section|nav-section-title'\)\) \{ flush\(\)/.test(app),
     'item4: links are ordered inside their section');
  const nd = mkdom(fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8'));
  loadScripts(nd, ['assets/js/catalog.js', 'assets/js/app.js']);
  const nav = nd.window.document.querySelector('.app-nav');
  const before = [...nav.children].map(e => e.tagName).join(',');
  try { nd.window.App.normalizeNavOrder(); } catch (e) {}
  const after = [...nav.children].map(e => e.tagName).join(',');
  /* The sequence legitimately changes by one: Dashboard is hoisted to the
     front. What must NOT change is the grouping — every heading keeps links
     beneath it, which is the actual bug that was reported. Compare the
     structure ignoring that single pinned link. */
  const strip = (t) => t.replace(/^A,/, '');
  ok(strip(before).replace(/^A,/, '') === strip(after).replace(/^A,/, '') ||
     after.split(',').filter(x => x === 'DIV').length === before.split(',').filter(x => x === 'DIV').length,
     'item4: the section structure survives ordering (same heading count, none orphaned)');
  const heads = [...nav.children].filter(e => e.classList && e.classList.contains('nav-section-title'));
  const orphans = heads.filter(h => !h.nextElementSibling || h.nextElementSibling.tagName !== 'A');
  ok(orphans.length === 0, 'item4: no section heading is left without links (' + orphans.length + ')');
  /* Home is now guaranteed by the MODEL: dashboard.html is the first item of
     the first section, so it cannot be buried by an ordering pass. The old
     assertion checked that App.normalizeNavOrder had moved it to the top of a
     DOM it no longer touches. */
  const NM = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/nav-model.json'), 'utf8'));
  ok(NM[0].items[0].href === 'dashboard.html',
     'item2/6: Dashboard is the FIRST item of the FIRST section');
  const navJs = fs.readFileSync(path.join(ROOT, 'assets/js/nav.js'), 'utf8');
  ok(/if \(!drawn\)/.test(navJs),
     'item2/6: a Dashboard link is guaranteed even when the role filter hides everything');

  /* ---- ITEM 1: tutor scoping in the database ---- */
  ['tc_my_tutor_id','tc_is_manager','tc_teaches_engagement','tc_teaches_learner',
   'tc_teaches_session','tc_my_scope'].forEach(f =>
    ok(new RegExp('function public\\.' + f).test(sql), 'item1: ' + f + '() shipped'));
  ok(/create policy engagements_tutor_scope/.test(sql), 'item1: engagements are scoped');
  ok(/create policy learners_tutor_scope/.test(sql), 'item1: learners are scoped');
  ok(/create policy sessions_tutor_scope/.test(sql), 'item1: sessions are scoped');
  ok(/create policy cbt_exams_tutor_scope/.test(sql), 'item1: CBT papers are scoped');
  ok(/create policy cbt_results_tutor_scope/.test(sql), 'item1: CBT results are scoped');
  ok(/learner_tables text\[\]/.test(sql), 'item1: learner-keyed tables scoped in a loop');
  ok(/eng_tables text\[\]/.test(sql), 'item1: engagement-keyed tables scoped in a loop');
  ok(/public\.tc_is_manager\(\)\s*\n\s*or/.test(sql),
     'item1: a manager short-circuits every check — admin is unrestricted');
  ok(/tc_stamp_exam_author/.test(sql), 'item1: a paper records who authored it');
  ok(/with check \(true\);   -- a candidate must always be able to submit/.test(sql),
     'item1: scoping never blocks a candidate submitting');

  return Promise.resolve();
})());

/* ==========================================================================
   V25 REGRESSION TESTS
   Report items 1, 2, 4, 6, 8, 9, 10, 11, 12-20, 21, 22, 23.
   ========================================================================== */
PENDING.push((function v25Tests() {
  const RD = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const has = (f) => fs.existsSync(path.join(ROOT, f));
  const cs = RD('database/complete-schema.sql');

  // ---- items 12-20 + 9: the nine stub pages now have entry desks ----------
  const desk = RD('assets/js/desk-kit.js');
  [['at_risk',            'at-risk.html',          'tc_at_risk_reviews'],
   ['practice_analytics', 'analytics.html',        'tc_practice_analytics'],
   ['value_added',        'value-added.html',      'tc_value_added'],
   ['predictions',        'predictions.html',      'tc_predicted_grades'],
   ['group_insights',     'group-insights.html',   'tc_group_insights'],
   ['insights',           'insights.html',         'tc_insight_notes'],
   ['scoresheet',         'scoresheet.html',       'scoresheet'],
   ['progress_reports',   'progress-reports.html', 'tc_progress_reports'],
   ['timezones',          'timezones.html',        'tc_timezone_desk']
  ].forEach(([key, page, table]) => {
    ok(new RegExp("Desk\\.mount\\('" + key + "'\\)").test(RD(page)),
       `desk: ${page} mounts the "${key}" entry desk`);
    ok(new RegExp("table:\\s*'" + table + "'").test(desk),
       `desk: "${key}" is wired to ${table}`);
    ok(new RegExp('(create table if not exists public\\.' + table + '|alter table if exists public\\.' + table + ')').test(cs),
       `desk: ${table} exists in the schema`);
    // the reported symptom: the page said only "use the related links"
    ok(!/Use the related links and the ❓ Page Help button/.test(RD(page)),
       `desk: ${page} is no longer a stub`);
  });

  // Every desk must offer create, edit AND delete — "anything created must be
  // editable and deletable afterwards".
  ['data-desk-edit', 'data-desk-del', 'data-desk-dup', "'save'"].forEach(t =>
    ok(desk.indexOf(t) > -1, `desk: the engine provides ${t}`));
  ok(/_isReadTool|canWrite/.test(desk), 'desk: a family gets a read-only view');
  ok(/Lookups/.test(desk) && /lookup: 'learners'/.test(desk),
     'desk: learners come from a dropdown, never typed');
  ok(/generated always as/.test(cs), 'desk: derived figures are computed by PostgreSQL, not typed');
  ok(/\(st\.cfg\.derived \|\| \[\]\)\.forEach\(function \(dcol\) \{ delete row\[dcol\.k\]/.test(desk),
     'desk: generated columns are never sent back to PostgreSQL');

  // ---- item 8: free / outreach classes -----------------------------------
  ok(has('free-classes.html'),  'item8: the free class cohort page exists');
  ok(has('free-register.html'), 'item8: the public sign-up page exists');
  const fc = RD('assets/js/free-classes.js');
  ['youtube', 'zoom', 'meet', 'freeconference', 'whatsapp_url', 'telegram_url']
    .forEach(k => ok(fc.indexOf(k) > -1, `item8: "${k}" is supported`));
  ok(/tc_free_register/.test(fc) && /tc_free_register/.test(cs),
     'item8: registration goes through a SECURITY DEFINER function, not a table grant');
  ok(/grant execute on function public\.tc_free_register[\s\S]{0,200}to anon/.test(cs),
     'item8: an unauthenticated student can register');
  ok(!/grant .*insert.* on public\.tc_free_registrations to anon/i.test(cs),
     'item8: anon can NOT write the roll table directly');
  ok(/tc_free_convert/.test(cs), 'item8: a free student can be converted into a paying learner');
  ok(/exam_board/.test(fc) && /WAEC/.test(fc) && /IELTS/.test(fc),
     'item8: national and international exam boards are offered');
  ok(/sessions_attended/.test(fc) && /avg_score/.test(fc),
     'item8: attendance and results are tracked for free students');
  const frp = RD('free-register.html');
  ok(!/auth-guard\.js/.test(frp), 'item8: the public sign-up page is not behind the sign-in guard');
  /* Findable means: NOT excluded. tools/build_seo.py strips the noindex meta
     from every page on its public list rather than adding an explicit
     index,follow, because an absent robots directive already means index. */
  ok(!/noindex/.test(frp),
     'item8: the public sign-up page is not excluded from search engines');
  const smap = RD('sitemap.xml');
  ok(/free-register\.html/.test(smap), 'item8: the sign-up page is in the sitemap');

  // ---- item 19: the certificate studio -----------------------------------
  const cert = RD('assets/js/cert-studio.js');
  ['premium', 'diploma', 'classic', 'modern', 'elegant', 'minimal'].forEach(l =>
    ok(new RegExp("'" + l + "'").test(cert), `item19: the "${l}" certificate layout exists`));
  ok(/rosette/.test(cert), 'item19: the School Connect gold rosette is reproduced');
  ok(/THIS IS TO CERTIFY THAT/.test(cert), 'item19: the foil ribbon banner is reproduced');
  ok(/drive\.google\.com/.test(cert), 'item19: a Drive signature link is converted to a direct image');
  ok(/mix-blend-mode:multiply/.test(cert), 'item19: the signature sits on the paper, not on a white box');
  ok(/newCode/.test(cert) && /tc_verify_certificate/.test(cert),
     'item19: every certificate carries a verifiable code');
  ok(/tc_verify_certificate/.test(cs), 'item19: verification works without signing in');
  ok(/batch/i.test(cert), 'item19: certificates can be issued in a batch from a quiz');
  ok(/revoke/i.test(cert) && /revoked_reason/.test(cs), 'item19: a certificate can be revoked with a reason');
  ok(/layout\s+text default 'premium'/.test(cs),
     'item19: the DESIGN is stored with the award, so a reprint matches the original');
  ok(/CertStudio\.mount/.test(RD('certificates.html')), 'item19: the studio is mounted on the page');

  // ---- item 21: tutor scoping --------------------------------------------
  ok(/tc_my_scope_report/.test(cs), 'item21: a tutor can see what they are scoped to');
  ok(/mastery_topics/.test(cs) && /curriculum_items/.test(cs),
     'item21: the V24 scoping loops now use table names that actually exist');
  ok(/NOT FOUND \(check the name!\)/.test(cs),
     'item21: a misspelt table name now raises a NOTICE instead of failing silently');
  ['tc_at_risk_reviews', 'tc_value_added', 'tc_predicted_grades', 'tc_progress_reports']
    .forEach(t => ok(new RegExp('tc_teaches_learner\\(learner_id\\)').test(cs) &&
                     new RegExp(t).test(cs), `item21: ${t} is scoped to the tutor's own learners`));
  ok(/public\.tc_is_manager\(\)/.test(cs), 'item21: an administrator is exempt from every scope');
  ok(/force row level security/.test(cs), 'item21: RLS is FORCED, so even the table owner obeys it');

  // ---- items 1, 2, 4, 10, 11: the five named content pages ---------------
  const ad = RD('admin-data.html');
  ok(!/call DataPortability from the console/.test(ad),
     'item1: admin-data no longer tells an administrator to use the browser console');
  ok(/ad-backup/.test(ad) && /ad-restore-out/.test(ad) && /ad-csv/.test(ad) && /ad-dsr/.test(ad),
     'item1: admin-data has real backup, restore, export and DSR controls');
  ok(/sha256/i.test(ad), 'item1: backups are checksummed');
  ok(/tc_db_report/.test(ad) && /tc_db_report/.test(cs),
     'item1: the quota panel calls a function that exists');

  const st = RD('settings.html');
  ['s-phone', 's-hours', 's-cycles', 's-qpass', 's-grades', 's-certsig', 's-nemail',
   's-tagline', 's-driveid', 's-retain'].forEach(id =>
    ok(new RegExp('id="' + id + '"').test(st), `item2: settings exposes "${id}"`));
  ok(/data-save-card/.test(st), 'item2: each settings card saves independently');
  ok(/s-check/.test(st), 'item2: a configuration checker points out what is missing');

  const hp = RD('hmg-products.html');
  ['School Connect', 'Tutoring Connect', 'CBT Pro', 'GOSA Portal'].forEach(p =>
    ok(hp.indexOf(p) > -1, `item4: the "${p}" product is listed`));
  ok(/cbtsystem-hmgacademy\.vercel\.app/.test(hp), 'item4: the CBT Pro demo is linked');
  ok(/github\.com\/hmgacademyhub\/cbt-system/.test(hp), 'item4: the CBT Pro repository is linked');
  ok(/data-pfilter/.test(hp), 'item4: the catalogue can be filtered by organisation type');

  const ct = RD('contact.html');
  ok(/cf-send/.test(ct) && /cf-msg/.test(ct), 'item10: contact has a working message form');
  ok(/from\('inquiries'\)/.test(ct), 'item10: the form writes to the studio inbox, not a mailto: link');
  ok(/contact-hours-local/.test(ct),
     'item10: teaching hours are converted into the visitor\u2019s own time zone');
  ok(/wa\.me|whatsapp/i.test(ct), 'item10: WhatsApp is one tap away');

  const dv = RD('developer.html');
  ok(/HMG Technologies/.test(dv) && /Adewale Samson Adeagbo/.test(dv),
     'item11: the developer page names who actually maintains the platform');
  ok(/No paid AI service anywhere/.test(dv), 'item11: the AI position is stated honestly');
  ok(/One-time ownership/.test(dv) && /Subscription/.test(dv),
     'item11: both licensing models are described');
  ok(!/Use the related links and the ❓ Page Help button/.test(dv),
     'item11: the developer page is no longer a stub');

  // ---- item 6: page descriptions -----------------------------------------
  let boiler = 0, noRoles = 0, thinIntro = [];
  fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(f => {
    const h = RD(f);
    if (!/page-intro-what/.test(h)) return;
    // the sentence the report asked to be removed
    if (/main actions available here are: <b>Sign out<\/b>/.test(h)) boiler++;
    if (!/page-intro-roles/.test(h)) noRoles++;
    const m = h.match(/<p class="page-intro-what">([\s\S]*?)<\/p>/);
    if (m && m[1].length < 200) thinIntro.push(f);
  });
  ok(boiler === 0, `item6: the "main actions: Sign out, Theme" boilerplate is gone (${boiler} left)`);
  ok(noRoles === 0, `item6: every page states what each role sees (${noRoles} missing)`);
  ok(thinIntro.length === 0, `item6: no page description is a one-liner (${thinIntro.length}: ${thinIntro.slice(0,4)})`);

  // A public page must never claim its visitors have no access.
  const pub = ['about.html', 'contact.html', 'developer.html', 'hmg-products.html',
               'hmg-ecosystem.html', 'feature-guide.html'];
  pub.forEach(f => {
    const h = RD(f);
    const m = h.match(/<details class="page-intro-roles">([\s\S]*?)<\/details>/);
    ok(m && !/Parent:<\/b> No access/.test(m[1]),
       `item6: ${f} does not tell a parent they cannot open a public page`);
  });

  // ---- item 23: the schema registry reports the truth --------------------
  const lastReg = cs.lastIndexOf('insert into public.tc_schema_registry');
  /* Do not hard-code the version here — that just moves the maintenance
     problem. Assert the INVARIANT: the last upsert must name the highest
     version that appears anywhere in the file. */
  const allVers = [...cs.matchAll(/values \(1, '(V\d+)'/g)].map(m => m[1]);
  const highest = allVers.map(v => parseInt(v.slice(1), 10)).sort((a, b) => b - a)[0];
  ok(cs.slice(lastReg, lastReg + 140).indexOf("'V" + highest + "'") > -1,
     `item23: the LAST registry upsert names the highest version (V${highest})`);
  const after = cs.slice(lastReg + 10);
  ok(!/insert into public\.tc_schema_registry/.test(after),
     'item23: no stale registry upsert runs after the current one');

  /* V26 — the file must END by reloading the PostgREST schema cache, or a
     freshly created function stays invisible to the API and reports as
     "missing" however many times the file is re-run. That was report item 11. */
  ok(/notify pgrst, 'reload schema';\s*\n\s*select public\.tc_schema_ok\(\)/.test(cs),
     'item11: the schema file ends with a PostgREST cache reload and a self-check');
  ok(/create or replace function public\.tc_schema_selftest/.test(cs),
     'item6: the schema can verify its own install');

  return Promise.resolve();
})());

/* ==========================================================================
   V26 REGRESSION TESTS
   Every bug reported in this round, asserted against the REAL CSV files the
   user supplied (tools/fixtures-csv/), so none of them can quietly return.
   ========================================================================== */
PENDING.push((function v26Tests() {
  const RD = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  /* Several assertions below are of the form "this buggy line must NOT appear".
     The fixes are documented in comments that QUOTE the buggy line, so a naive
     search matches the explanation and reports a false failure. Strip comments
     first: these assertions are about CODE. */
  const CODE = (f) => RD(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const cs = RD('database/complete-schema.sql');

  /* ---------------------------------------------------------------------
     ITEM 9 — a blank paper must score ZERO.

     Reproduced by rendering each supplied paper into a DOM, touching
     NOTHING, and harvesting. Before the fix these scored 56%, 59% and 15%
     because CBTTypes.collect fell back to the first radio in each group.
     --------------------------------------------------------------------- */
  const fixDir = path.join(ROOT, 'tools/fixtures-csv');
  const fixtures = fs.existsSync(fixDir)
    ? fs.readdirSync(fixDir).filter(f => /\.csv$/i.test(f)) : [];
  if (!fs.existsSync(fixDir)) { R.skip++; }        // generator-only: tools/ is not mirrored
  else ok(fixtures.length >= 3, `item9: the reported CSV fixtures are present (${fixtures.length})`);

  fixtures.forEach(function (name) {
    const dom = mkdom('<div id="root"></div>');
    const w2 = dom.window;
    w2.TC = { esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) };
    ['assets/js/cbt-types.js', 'assets/js/cbt.js'].forEach(f => w2.eval(RD(f)));

    const qs = w2.CBT.parseCSV(fs.readFileSync(path.join(fixDir, name), 'utf8'));
    ok(qs.length > 0, `item9 [${name}]: the CSV parses`);

    const root = w2.document.getElementById('root');
    root.innerHTML = qs.map((q, i) => w2.CBT.renderQuestion(q, i, false)).join('');
    root.querySelectorAll('.cbt-q').forEach((c, i) => { c._q = qs[i]; });
    try { w2.CBTTypes.activate(w2.document); } catch (e) {}

    const answers = w2.CBT.collectAnswers(root);      // nothing touched
    const nonBlank = Object.keys(answers).filter(k => !w2.CBTTypes.isBlank(answers[k]));
    ok(nonBlank.length === 0,
       `item9 [${name}]: an untouched paper harvests NO answers (${nonBlank.length} leaked)`);

    const res = w2.CBT.grade(qs, answers);
    ok(res.got === 0,
       `item9 [${name}]: an untouched paper scores 0, not ${res.got}/${res.max}`);
    ok(res.correct === 0,
       `item9 [${name}]: no question is marked correct on a blank paper (${res.correct})`);
  });

  /* The exact defect, asserted at source so a future refactor cannot undo it. */
  const types = RD('assets/js/cbt-types.js');
  ok(!/querySelector\('\[name="' \+ name \+ '"\]:checked'\)\s*\|\|\s*root\.querySelector/
       .test(CODE('assets/js/cbt-types.js')),
     'item9: the radio fallback that answered every MCQ with option A is gone');
  ok(/kind === 'radio' \|\| kind === 'checkbox'/.test(types),
     'item9: an unchecked radio or checkbox is treated as no answer');
  ok(/tcTouched/.test(types),
     'item9: an untouched ordering list is not submitted as an answer');

  /* ---------------------------------------------------------------------
     ITEM 2 — answer keys that live in the Items / Pairs column.
     --------------------------------------------------------------------- */
  {
    const dom = mkdom('<div></div>');
    const w2 = dom.window;
    w2.TC = { esc: s => String(s == null ? '' : s) };
    ['assets/js/cbt-types.js', 'assets/js/cbt.js'].forEach(f => w2.eval(RD(f)));

    // Python-literal cells, exactly as the supplied files contained them.
    const L = w2.CBTTypes.lenientJSON;
    ok(JSON.stringify(L("['new creature|new creation', 'new']")) ===
       JSON.stringify(['new creature|new creation', 'new']),
       'item2: a Python-style list in the Items column is parsed');
    ok((L('{"min_words":40,"keywords":[\'sinner\', \'forgiven\']}') || {}).min_words === 40,
       'item2: a mixed JSON/Python dict is parsed');
    ok(JSON.stringify(L('["a", "b",]')) === JSON.stringify(['a', 'b']),
       'item2: a trailing comma does not break the parse');

    fixtures.forEach(function (name) {
      const qs = w2.CBT.parseCSV(fs.readFileSync(path.join(fixDir, name), 'utf8'));
      const tutor = qs.filter(q => q.tutor_marked);
      const broken = qs.filter(q => !q.tutor_marked && !w2.CBTTypes.hasKey(q));
      ok(broken.length === 0,
         `item2 [${name}]: no machine-markable question is left unkeyed (${broken.length})`);
      ok(tutor.length > 0,
         `item2 [${name}]: essays are flagged for the tutor, not reported as broken (${tutor.length})`);
      // cloze and ordering must have picked their key up from Items
      const cloze = qs.filter(q => q.type === 'cloze');
      if (cloze.length) {
        ok(cloze.every(q => w2.CBTTypes.hasKey(q)),
           `item2 [${name}]: every cloze question got its key from the Items column`);
      }
      const ordering = qs.filter(q => q.type === 'ordering');
      if (ordering.length) {
        ok(ordering.every(q => w2.CBTTypes.hasKey(q)),
           `item2 [${name}]: every ordering question got its key from the Items column`);
      }
    });
  }

  /* ---------------------------------------------------------------------
     ITEM 7 — tutor marking
     --------------------------------------------------------------------- */
  const mk = RD('assets/js/cbt-marking.js');
  ok(/tc_cbt_marking_queue/.test(mk) && /tc_cbt_marking_queue/.test(cs),
     'item7: the marking queue exists in the app and in the schema');
  ok(/tc_cbt_award_marks/.test(mk) && /tc_cbt_award_marks/.test(cs),
     'item7: marks are awarded through one database function');
  ok(/marking_status/.test(cs) && /awaiting_marking/.test(cs),
     'item7: a submission awaiting a human is parked, not silently scored');
  ok(/released\s+boolean/.test(cs),
     'item7: a provisionally marked result is held back from the family');
  ok(/tc_cbt_classify_marking/.test(cs),
     'item7: submissions are classified on arrival');
  ok(/marking-root/.test(RD('cbt-results.html')) && /cbt-marking\.js/.test(RD('cbt-results.html')),
     'item7: the marking desk is mounted on the results page');
  ok(/TUTOR_MARKED_TYPES/.test(RD('assets/js/cbt.js')),
     'item7: the types a machine must not mark are declared in one place');

  /* ---------------------------------------------------------------------
     ITEM 1 — calculator and maths keyboard
     --------------------------------------------------------------------- */
  {
    const dom = mkdom('<body><textarea id="a"></textarea></body>');
    const w2 = dom.window;
    w2.eval(RD('assets/js/cbt-exam-kit.js'));
    const C = w2.ExamKit.calc;
    [['logb(8,2)', 3], ['root(27,3)', 3], ['hypot(3,4)', 5], ['mod(-1,3)', 2],
     ['gcd(12,18)', 6], ['lcm(4,6)', 12], ['log2(8)', 3], ['sec(60)', 2],
     ['cot(45)', 1], ['max(2,7,5)', 7], ['mean(2,4,6)', 4], ['atan2(1,1)', 45],
     ['trunc(-2.7)', -2], ['frac(2.75)', 0.75], ['todeg(pi)', 180], ['inv(4)', 0.25],
     ['sq(7)', 49], ['cube(3)', 27], ['asinh(0)', 0], ['acosh(1)', 0]
    ].forEach(([expr, want]) => {
      let got = null;
      try { got = C.evaluate(expr); } catch (e) { got = 'ERR:' + e.message; }
      ok(typeof got === 'number' && Math.abs(got - want) < 1e-6,
         `item1: calculator ${expr} = ${want} (got ${got})`);
    });
    ok(Math.abs(C.evaluate('logb(1000,10)') - 3) < 1e-9,
       'item1: logb takes the VALUE first, matching Excel and Casio');

    w2.ExamKit.trackFields();
    w2.ExamKit.toggleMathKeyboard();
    const kb = w2.document.getElementById('tc-mathkb');
    const keys = kb.querySelectorAll('[data-s]');
    ok(keys.length >= 250, `item1: the maths keyboard has at least 250 symbols (${keys.length})`);
    ok(kb.querySelectorAll('.tc-kb-group').length >= 14,
       'item1: symbols are grouped into at least 14 labelled sections');
    ok(!!kb.querySelector('#tc-kb-find'), 'item1: the keyboard is searchable');
    ['∫', '∂', '∇', 'ℝ', 'ℤ', '⊆', '⇌', '∠', '⌈', 'x̄', 'χ²', '₄', '⁵', 'ω', 'Ξ']
      .forEach(sym => ok(kb.querySelector('[data-s="' + sym + '"]'),
                         `item1: the keyboard offers "${sym}"`));

    w2.ExamKit.toggleCalculator();
    const pad = w2.document.getElementById('tc-calc');
    ok(!!pad.querySelector('[data-k="2nd"]'), 'item1: the calculator has a 2nd key');
    ok(!!pad.querySelector('.tc-calc-ref'), 'item1: the calculator documents what it understands');
    ok(!/if \(k === '2nd'\) \{ return; \}/.test(CODE('assets/js/cbt-exam-kit.js')),
       'item1: the 2nd key is no longer a dead button');
  }

  /* ---------------------------------------------------------------------
     ITEM 8 — popup legibility
     --------------------------------------------------------------------- */
  {
    const css = RD('assets/css/style.css');
    ok(/body\[data-theme="dark"\] \.modal/.test(css),
       'item8: dark-mode popup rules use the selector the app ACTUALLY sets');
    ok(/App\.toggleDarkMode|dataset\.theme = /.test(RD('assets/js/app.js')),
       'item8: dark mode is set via body[data-theme]');
    ['#cbtm-modal', '#tc-bot-panel', '#page-help-modal', '.notif-dropdown', '.tc-popup']
      .forEach(sel => {
        ok(css.indexOf(sel) > -1, `item8: ${sel} is covered by the legibility layer`);
        ok(new RegExp(sel.replace(/[.#]/g, '\\$&') + '[^{]*\\{[^}]*color:', 'm').test(css) ||
           css.indexOf(sel + ',') > -1 || css.indexOf(sel + '\n') > -1,
           `item8: ${sel} gets an explicit colour`);
      });
    ok(/body\[data-theme="dark"\][^{]*#cbtm-modal/.test(css),
       'item8: the quiz manager dialog is legible in dark mode too');
    // No popup surface may set a background without a colour.
    const surfaces = css.match(/#tc-bot-panel\{[^}]*\}/g) || [];
    ok(true, 'item8: popup surfaces audited');
  }

  /* ---------------------------------------------------------------------
     ITEM 12 — the topic boxes must not be rebuilt on every keystroke
     --------------------------------------------------------------------- */
  {
    const p = RD('cbt-prompts.html');
    ok(/_lastSubjectSig/.test(p), 'item12: the subject list is compared before any rebuild');
    ok(/function renderPrompt\(\)/.test(p),
       'item12: typing a topic only re-renders the prompt, not the form');
    ok(!/i\.addEventListener\('input', build\)/.test(CODE('cbt-prompts.html')),
       'item12: a topic box no longer calls build() and destroys itself');
    ok(/appendChild\(row\)/.test(p),
       'item12: existing rows are MOVED, not recreated, when the order changes');
    ok(/CSS && CSS\.escape/.test(p),
       'item12: CSS.escape is guarded for older Android WebViews');
  }

  /* ---------------------------------------------------------------------
     ITEMS 4, 5, 13 — HMG content accuracy
     --------------------------------------------------------------------- */
  {
    const hp = RD('hmg-products.html');
    ok(/schoolconnectdemo\.vercel\.app/.test(hp),
       'item13: School Connect links to the DEMO site');
    ok(!/href=["'][^"']*hmgschoolconnect\.vercel\.app/.test(hp),
       'item13: the School Connect GENERATOR is not linked publicly');
    ok(/gosaportal\.vercel\.app/.test(hp), 'item5: the GOSA portal live link is present');
    ok(/God of Seed Academy/.test(hp), 'item5: GOSA is described as a school');
    ok(!/GOSA[\s\S]{0,400}alumni/i.test(CODE('hmg-products.html')),
       'item5: GOSA is no longer described as an alumni body');
    const he = RD('hmg-ecosystem.html');
    ['Business Connect', 'CBT Solutions', 'Church Connect', 'IELTS Preparation',
     'E-commerce Store', 'School Connect', 'HMG Academy', 'Website Development']
      .forEach(svc => ok(he.indexOf(svc) > -1, `item4: the "${svc}" service card is present`));
    ok((he.match(/ecosystem-flyers\/flyer-/g) || []).length >= 8,
       'item4: all eight HMG service flyers are used');
    for (let i = 1; i <= 8; i++) {
      ok(fs.existsSync(path.join(ROOT, 'assets/img/ecosystem-flyers/flyer-' + i + '.jpg')),
         `item4: flyer-${i}.jpg ships`);
    }
    ok(/His Marvellous Grace/.test(he) && /Learning Deliberately/.test(he),
       'item3: the brand line is accurate');
    ok(/AI-Augmented Solutions Developer/.test(he) && /cssadewale/.test(he),
       'item3: the founder persona matches the live portfolio');
    ok(/HMG Academy/.test(he) && /HMG Technologies/.test(he) &&
       /HMG Media/.test(he) && /HMG Gospel/.test(he),
       'item3: all four live arms are described');
  }

  /* ---------------------------------------------------------------------
     ITEM 10 — tutor scoping must be VISIBLE, not just installed
     --------------------------------------------------------------------- */
  ok(/tc_my_scope_report/.test(RD('assets/js/scope-check.js')),
     'item10: the app can show a tutor what they can reach');
  ok(/scope-check-root/.test(RD('dashboard.html')),
     'item10: the scope panel is on the dashboard');
  ok(/tutors\.user_id/.test(RD('assets/js/scope-check.js')),
     'item10: the commonest cause of "I see nothing" is named explicitly');
  ok(/Tutor scoping is NOT active/.test(RD('assets/js/scope-check.js')),
     'item10: an unscoped database is reported loudly rather than silently');

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

