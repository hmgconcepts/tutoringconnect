/* ============================================================================
   test_generator.js — headless harness for the Tutoring Connect builder.
   ----------------------------------------------------------------------------
   Runs Generator.go() outside a browser by stubbing the three browser things
   it depends on: window, fetch (served from the local working tree) and JSZip.
   This lets us verify the ACTUAL ZIP a client would receive - traditional and
   modern - instead of trusting that the wizard "probably" works.

   Usage:  node tools/test_generator.js            (traditional)
           node tools/test_generator.js modern     (Next.js build)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

// ---- minimal browser shims ------------------------------------------------
global.window = global;
global.JSZip = JSZip;
global.document = {
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
  querySelector: () => null, querySelectorAll: () => [], head: { appendChild() {} },
  body: null, addEventListener() {}, documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {} } },
  readyState: 'complete', getElementById: () => null
};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
global.location = { pathname: '/index.html', origin: 'https://example.test', search: '' };
global.navigator = { userAgent: 'node' };
global.console.log = console.log;

// fetch() reads straight from the working tree, exactly like the real builder
// reads from its own origin.
global.fetch = async (url) => {
  const clean = String(url).split('?')[0].replace(/^\.?\//, '');
  const p = path.join(ROOT, clean);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    return { ok: false, status: 404, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  }
  const buf = fs.readFileSync(p);
  return { ok: true, status: 200, text: async () => buf.toString('utf8'), arrayBuffer: async () => buf };
};

// ---- load the real catalog + generator ------------------------------------
require(path.join(ROOT, 'assets/js/catalog.js'));
require(path.join(ROOT, 'assets/js/generator.js'));

const buildType = process.argv[2] === 'modern' ? 'modern' : 'traditional';

const cfg = {
  name: 'Test Academy', shortName: 'TA',
  motto: 'Independent progress. Visible to parents.',
  theme: window.TC.THEMES.find(t => t.id === 'oxford-amber') || window.TC.THEMES[0],
  font: window.TC.FONTS[1], layout: 'academy',
  address: 'Lagos, Nigeria', phone: '2348100000000', email: 'hello@test.example',
  siteUrl: 'https://testacademy.vercel.app', timezone: 'Africa/Lagos', currency: '\u20a6',
  logoExt: 'svg', logoUrl: 'assets/img/logo.png',
  socials: { whatsapp: 'https://wa.me/2348100000000', instagram: 'https://instagram.com/test' },
  supabaseUrl: 'https://abcd.supabase.co', supabaseKey: 'eyJtest',
  modules: ['engagements', 'learners', 'bookings', 'practice'],
  buildType
};

(async () => {
  const t0 = Date.now();
  let progress = 0;
  const blob = await window.Generator.go(cfg, () => { progress++; });
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(await blob.arrayBuffer());
  const out = path.join(ROOT, 'tools', `_test-build-${buildType}.zip`);
  fs.writeFileSync(out, buf);

  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);

  const R = { pass: [], fail: [], warn: [] };
  const ok = (c, m) => (c ? R.pass : R.fail).push(m);
  const warn = (c, m) => { if (!c) R.warn.push(m); };

  console.log(`\n=== BUILD: ${buildType} =============================================`);
  console.log(`files: ${names.length}   size: ${(buf.length / 1024 / 1024).toFixed(2)} MB   time: ${Date.now() - t0}ms   progress ticks: ${progress}`);

  // ---- structural assertions ----
  ok(names.includes('index.html'), 'index.html present (client landing)');
  ok(!names.includes('builder.html'), 'builder.html EXCLUDED from client build');
  ok(!names.includes('assets/js/generator.js'), 'generator.js EXCLUDED');
  ok(!names.includes('assets/js/wizard.js'), 'wizard.js EXCLUDED');
  ok(names.includes('assets/js/config.js'), 'config.js present');
  ok(names.includes('assets/js/app.js'), 'app.js present');
  ok(names.includes('assets/js/theme-engine.js'), 'theme-engine.js present');
  ok(names.includes('assets/js/auth-guard.js'), 'auth-guard.js present');
  ok(names.includes('assets/js/page-guide.js'), 'page-guide.js present');
  ok(names.includes('assets/js/seo.js'), 'seo.js present');
  ok(names.includes('assets/css/style.css'), 'style.css present');
  ok(names.includes('assets/css/layouts.css'), 'layouts.css present');
  ok(names.includes('database/complete-schema.sql'), 'complete-schema.sql present');
  ok(names.includes('database/v7-family-access-fix.sql'), 'v7 RLS fix present');
  ok(names.includes('database/v9-keepalive-and-drive.sql'), 'v9 keep-alive + Drive SQL present');
  ok(names.includes('assets/js/keepalive-monitor.js'), 'keep-alive monitor present');
  ok(names.includes('docs/KEEP-ALIVE-GUIDE.md'), 'keep-alive runbook present');
  ok(names.includes('docs/GOOGLE-DRIVE-SYNC-GUIDE.md'), 'Drive sync guide present');
  ok(names.includes('.github/workflows/keepalive-watchdog.yml'), 'keep-alive watchdog workflow present');
  ok(names.includes('.github/workflows/keep-supabase-alive.yml'), 'keep-alive writer workflow present');
  ok(names.includes('.github/workflows/db-backup.yml'), 'scheduled backup workflow present');
  ok(names.includes('supabase/functions/ping/index.ts'), 'edge ping function present');
  ok(names.includes('api/keepalive.js'), 'vercel keep-alive route present');
  ok(names.includes('manifest.json'), 'manifest.json present');
  ok(names.includes('sw.js'), 'service worker present');
  ok(names.includes('robots.txt'), 'robots.txt present');
  ok(names.includes('sitemap.xml'), 'sitemap.xml present');
  ok(names.includes('SEO-SETUP.md'), 'SEO-SETUP.md present');
  ok(names.includes('BUILD-MANIFEST.json'), 'BUILD-MANIFEST.json present');
  ok(names.includes('DEPLOYMENT-GUIDE.md'), 'deployment guide present');

  const driveJs = await zip.file('assets/js/drive-sync.js').async('string');
  ok(/renderPanel/.test(driveJs), 'shipped drive-sync.js contains renderPanel (was missing in V8)');
  const kaSql = await zip.file('database/v9-keepalive-and-drive.sql').async('string');
  ok(/tc_keep_alive_status/.test(kaSql), 'shipped SQL exposes the keep-alive status RPC');
  const wf = await zip.file('.github/workflows/keep-supabase-alive.yml').async('string');
  ok(/\*\/2 \* \*/.test(wf), 'shipped workflow pings every 2 days');

  const pages = names.filter(n => /^[^/]+\.html$/.test(n));
  ok(pages.length >= 120, `all-inclusive page set (${pages.length} pages)`);

  // ---- branding correctness ----
  const config = await zip.file('assets/js/config.js').async('string');
  ok(config.includes('Test Academy'), 'config.js carries the client name');
  ok(config.includes('abcd.supabase.co'), 'config.js carries the Supabase URL');
  ok(!config.includes('ADEWALE CLASSROOM'), 'config.js has no other client leaked into it');

  const mani = JSON.parse(await zip.file('manifest.json').async('string'));
  ok(mani.name === 'Test Academy', `manifest rebranded (${mani.name})`);
  ok(mani.theme_color === cfg.theme.primary, `manifest theme_color matches theme (${mani.theme_color})`);

  // ---- SEO correctness ----
  const robots = await zip.file('robots.txt').async('string');
  ok(robots.includes('Sitemap: https://testacademy.vercel.app/sitemap.xml'), 'robots.txt points at the sitemap');
  ok(robots.includes('Disallow: /dashboard.html'), 'robots.txt blocks private pages');
  ok(/User-agent: Googlebot/.test(robots) && /User-agent: Bingbot/.test(robots), 'robots.txt names Google + Bing');
  const sm = await zip.file('sitemap.xml').async('string');
  ok(sm.includes('https://testacademy.vercel.app/about.html'), 'sitemap uses the real site URL');
  ok(!sm.includes('/dashboard.html'), 'sitemap excludes private pages');

  // ---- every referenced local asset must exist in the ZIP ----
  const set = new Set(names);
  const missing = new Set();
  for (const p of pages) {
    const html = await zip.file(p).async('string');
    const refs = [...html.matchAll(/(?:src|href)="([^"#:?]+\.(?:js|css|svg|png|json))"/g)].map(m => m[1]);
    refs.forEach(r => { const c = r.replace(/^\.?\//, ''); if (!set.has(c)) missing.add(`${p} -> ${r}`); });
  }
  ok(missing.size === 0, `no broken asset references (${missing.size} broken)`);
  if (missing.size) [...missing].slice(0, 10).forEach(m => console.log('    BROKEN:', m));

  // ---- internal page links must resolve ----
  const badLinks = new Set();
  for (const p of pages) {
    const html = await zip.file(p).async('string');
    [...html.matchAll(/href="([a-z0-9-]+\.html)"/g)].map(m => m[1])
      .forEach(l => { if (!set.has(l)) badLinks.add(`${p} -> ${l}`); });
  }
  ok(badLinks.size === 0, `no broken internal page links (${badLinks.size} broken)`);
  if (badLinks.size) [...badLinks].slice(0, 10).forEach(m => console.log('    BROKEN LINK:', m));

  // ---- modern build ----
  if (buildType === 'modern') {
    ok(names.includes('modern/package.json'), 'modern/package.json present');
    ok(names.includes('modern/next.config.js'), 'modern/next.config.js present');
    ok(names.includes('modern/app/page.js'), 'modern/app/page.js present');
    const mirrored = names.filter(n => n.startsWith('modern/public/'));
    ok(mirrored.length > 100, `modern/public auto-mirrored (${mirrored.length} files, no manual copying)`);
    ok(mirrored.includes('modern/public/index.html'), 'modern/public/index.html mirrored');
    ok(mirrored.includes('modern/public/assets/js/app.js'), 'modern/public app.js mirrored');
    const rd = await zip.file('modern/README.md').async('string');
    ok(!/Copy the root portal files/.test(rd), 'modern README no longer asks for manual copying');
  }

  const bm = JSON.parse(await zip.file('BUILD-MANIFEST.json').async('string'));
  // The manifest describes the TRADITIONAL payload; modern/public is a mirror
  // of it, plus the Next.js scaffold, plus the manifest itself.
  // modern/public/** is an untracked mirror; the manifest counts everything
  // else in the archive (including the modern/ Next.js scaffold itself).
  const core = names.filter(n => !n.startsWith('modern/public/') && n !== 'BUILD-MANIFEST.json');
  ok(bm.counts.total === core.length, `manifest count matches core payload (${bm.counts.total} vs ${core.length})`);
  if (buildType === 'modern') {
    ok(bm.mirroredToModernPublic > 100, `manifest records the mirror (${bm.mirroredToModernPublic} files)`);
  }
  console.log('  manifest counts:', JSON.stringify(bm.counts));

  console.log(`\n  PASS ${R.pass.length}`);
  R.pass.forEach(m => console.log('   \u2713 ' + m));
  if (R.warn.length) { console.log(`\n  WARN ${R.warn.length}`); R.warn.forEach(m => console.log('   ! ' + m)); }
  if (R.fail.length) { console.log(`\n  FAIL ${R.fail.length}`); R.fail.forEach(m => console.log('   \u2717 ' + m)); }
  console.log(`\n  RESULT: ${R.fail.length ? 'FAILED' : 'ALL CHECKS PASSED'}\n`);
  fs.unlinkSync(out);
  process.exit(R.fail.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
