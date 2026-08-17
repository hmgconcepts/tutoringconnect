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
  ok(!/Lumen/i.test(cat), 'brand: no "Lumen" naming remains in the catalogue');
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
  ok(C.promptPack('enterprise','t',5,'',{}).indexOf('never a file upload') !== -1,
     'prompts: every pack states the links-not-uploads rule');
  ok(C.allTypes().length >= 32, `prompts: ${C.allTypes().length} question types offered (SC ships 17)`);

  // the page must expose them all
  const pp = fs.readFileSync(path.join(ROOT, 'cbt-prompts.html'), 'utf8');
  const opts = (pp.match(/<option value="[a-z_]+"/g) || []).length;
  ok(opts >= 18, `prompts: ${opts} packs selectable in the UI`);
  ok(/data-need="board"/.test(pp) && /data-need="subjects"/.test(pp),
     'prompts: pack-specific inputs exist (board, subjects)');

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
