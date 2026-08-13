/* In-browser ZIP generator — emits a parent-facing client site (never the builder). */
const Generator = {
  PRICING: {
    currency: '₦',
    base: 35000,
    perModule: 4500,
    addons: [
      { id: 'onboarding', name: 'Onboarding & training call', price: 15000 },
      { id: 'custom_theme', name: 'Custom theme from brand guide', price: 12000 },
      { id: 'data_import', name: 'Learner / parent CSV import', price: 10000 },
      { id: 'drive_setup', name: 'Google Drive backup setup', price: 8000 }
    ]
  },
  pageFile(id) {
    const m = (window.TC.MODULES || []).find(x => x.id === id);
    return m ? m.file : id.replace(/_/g, '-') + '.html';
  },
  async load(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return '';
    return res.text();
  },
  configJS(cfg) {
    const theme = cfg.theme || { id: 'lumen', primary: '#134e4a', accent: '#d97706' };
    return `window.TC = window.TC || {};
window.PRACTICE = ${JSON.stringify({
      name: cfg.name, shortName: cfg.shortName || cfg.name, motto: cfg.motto || '',
      theme, layout: cfg.layout || 'sidebar', font: cfg.font,
      address: cfg.address || '', phone: cfg.phone || '', email: cfg.email || '',
      siteUrl: cfg.siteUrl || '', timezone: cfg.timezone || 'Africa/Lagos',
      currency: cfg.currency || '₦', logoExt: cfg.logoExt || 'svg',
      logoUrl: cfg.logoUrl || 'assets/img/logo.svg',
      socials: cfg.socials || {},
      hmg: {
        concepts: 'https://hmgconcepts.pages.dev/',
        technologies: 'https://hmgtechnologies.pages.dev/',
        academy: 'https://hmgacademy.pages.dev/',
        media: 'https://hmgmedia.pages.dev/',
        gospel: 'https://hmggospel.pages.dev/',
        founder: 'https://cssadewale.pages.dev/'
      },
      license: cfg.license || { model: 'lifetime', status: 'active' },
      demo: { enabled: !!cfg.demo }
    }, null, 2)};
window.TC.esc = function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};
const SUPABASE_URL = ${JSON.stringify(cfg.supabaseUrl || 'YOUR_SUPABASE_URL')};
const SUPABASE_ANON_KEY = ${JSON.stringify(cfg.supabaseKey || 'YOUR_SUPABASE_ANON_KEY')};
window.sb = null;
if (window.supabase && SUPABASE_URL && !String(SUPABASE_URL).includes('YOUR_') && SUPABASE_ANON_KEY && !String(SUPABASE_ANON_KEY).includes('YOUR_')) {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
}
window.TC_CONFIRM_FREE_EMAIL = true; window.TC_CONFIRM_FREE_WA = true; window.TC_CONFIRM_FREE_SMS = true;
console.log('[Tutoring Connect] config —', window.PRACTICE.name);
`;
  },
  ALWAYS_FILES: [
    'login.html','dashboard.html','about.html','contact.html','apply.html','install.html','offline.html',
    'forgot-password.html','change-password.html','profile.html','feature-guide.html','developer.html',
    'hmg-ecosystem.html','hmg-products.html','notifications.html',
    'assets/css/style.css',
    'assets/js/app.js','assets/js/crud.js','assets/js/insights.js','assets/js/super.js',
    'assets/js/cbt.js','assets/js/proctor.js','assets/js/drive-sync.js','assets/js/data-portability.js',
    'assets/js/bookings-engine.js','assets/js/catalog.js','assets/js/license.js',
    'assets/js/media.js','assets/js/brand.js','assets/js/notifications.js','assets/js/pwa-install.js',
    'assets/js/site-help.js','assets/js/assistant-kb.js','assets/js/ics.js','assets/js/chatbot.js','assets/js/ai-assistant.js','assets/js/security-guard.js',
    'assets/js/voting.js','assets/js/enterprise.js','assets/js/analytics.js',
    'database/complete-schema.sql','database/keep-alive.sql','database/drive-sync.sql',
    'database/storage-offload.sql','database/v2-tutoring-ops.sql','database/v3-classroom-exams.sql',
    'database/v4-enterprise-parity.sql','database/v5-ops-parity.sql','database/v6-cbt-modes.sql',
    'DEPLOYMENT-GUIDE.md','README.md','FEATURE-CATALOG.md','SUPABASE_FREE_TIER_PROTECTION.md',
    'docs/GOOGLE-DRIVE-SYNC-GUIDE.md','docs/ONBOARDING-GUIDE.md','docs/INSIGHTS-METHODOLOGY.md',
    'manifest.json','sw.js','robots.txt','sitemap.xml','_headers','.nojekyll',
    'api/keepalive.js','vercel.json',
    '.github/workflows/keep-supabase-alive.yml',
    '.github/workflows/supabase-auto-restore.yml',
    'supabase/functions/ping/index.ts'
  ],
  ALWAYS_PAGES: [
    'engagements.html','learners.html','insights.html','learner-360.html','calendar.html',
    'bookings.html','session-complete.html','sow.html','practice.html','cbt-exam.html','cbt-multi.html',
    'cbt-prompts.html','cbt-review.html','scoresheet.html','reading.html','forum.html','apply.html',
    'application-links.html','admin-data.html','platform-health.html','storage.html','dashboard.html',
    'exam-register.html','exam-links.html','stream.html','classwork.html','settings.html',
    'hmg-ecosystem.html','hmg-products.html','developer.html','voting.html','profile.html',
    'analytics.html','inbox.html','announcements.html','parents.html',
    'reminders.html','study-log.html','makeup-credits.html','public-book.html','license.html'
  ],
  async go(cfg, onProgress) {
    if (!window.JSZip) throw new Error('JSZip did not load. Check your network (CDN).');
    const zip = new JSZip();
    const files = this.ALWAYS_FILES.slice();
    const selected = new Set(cfg.modules || []);
    (window.TC.MODULES || []).forEach(m => {
      if (selected.has(m.id) || ['feature_guide', 'apply', 'hmg_ecosystem'].includes(m.id)) {
        if (m.file && !files.includes(m.file)) files.push(m.file);
      }
    });
    this.ALWAYS_PAGES.forEach(f => { if (!files.includes(f)) files.push(f); });
    let n = 0;
    for (const f of files) {
      if (f === 'index.html' || f === 'builder.html' || f === 'generator.js' || f === 'wizard.js') continue;
      const txt = await this.load(f);
      if (txt) zip.file(f, txt);
      n++;
      if (onProgress) onProgress(n, files.length, f);
    }
    const logo = await fetch('assets/img/logo.svg').then(r => r.ok ? r.text() : '');
    if (logo) zip.file('assets/img/logo.svg', logo);
    try {
      const pngRes = await fetch('assets/img/logo.png');
      if (pngRes.ok) zip.file('assets/img/logo.png', await pngRes.arrayBuffer());
    } catch (_) {}
    const clientIndex = await this.load('site-index.html');
    if (clientIndex) zip.file('index.html', clientIndex);
    zip.file('assets/js/config.js', this.configJS(cfg));
    zip.file('PRACTICE.json', JSON.stringify(cfg, null, 2));
    const origin = String(cfg.siteUrl || '').replace(/\/$/, '') || 'https://adewaleclassroom.example';
    zip.file('robots.txt', 'User-agent: *\nAllow: /\nAllow: /about.html\nAllow: /apply.html\nAllow: /feature-guide.html\nAllow: /hmg-ecosystem.html\nDisallow: /admin-data.html\nDisallow: /safeguarding.html\nSitemap: ' + origin + '/sitemap.xml\n');
    zip.file('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + ['/', '/about.html', '/apply.html', '/feature-guide.html', '/login.html', '/hmg-ecosystem.html', '/hmg-products.html', '/developer.html', '/exam-register.html']
        .map(p => '  <url><loc>' + origin + p + '</loc><changefreq>weekly</changefreq></url>').join('\n')
      + '\n</urlset>\n');
    zip.file('manifest.json', JSON.stringify({
      name: cfg.name || 'ADEWALE CLASSROOM',
      short_name: cfg.shortName || 'ADC',
      start_url: 'dashboard.html',
      display: 'standalone',
      background_color: '#f7f4ef',
      theme_color: (cfg.theme && cfg.theme.primary) || '#134e4a',
      icons: [
        { src: 'assets/img/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: 'assets/img/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
      ]
    }, null, 2));
    if (String(cfg.buildType || cfg.build_type || '').toLowerCase() === 'modern') {
      this.writeModernScaffold(zip, cfg);
    }
    return zip.generateAsync({ type: 'blob' });
  },
  writeModernScaffold(zip, cfg) {
    const name = cfg.name || 'ADEWALE CLASSROOM';
    const nl = String.fromCharCode(10);
    zip.file('modern/README.md', '# ' + name + ' — modern delivery' + nl + nl +
      'Traditional static files remain at the ZIP root.' + nl +
      'modern/ is a Next.js wrapper (School Connect pattern).' + nl +
      '1. cd modern && npm install' + nl +
      '2. Copy root HTML + assets into modern/public/' + nl +
      '3. npm run dev or deploy modern/ to Vercel.' + nl +
      'Supabase + RLS stay the authority. No paid AI API.' + nl);
    zip.file('modern/package.json', JSON.stringify({
      private: true, name: 'tutoring-connect-modern',
      scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
      dependencies: { next: '14.2.5', react: '18.3.1', 'react-dom': '18.3.1' }
    }, null, 2));
    zip.file('modern/next.config.js', 'module.exports = { trailingSlash: true };' + nl);
    zip.file('modern/app/layout.js', 'export const metadata = { title: ' + JSON.stringify(name) + ' };' + nl +
      'export default function RootLayout({ children }) { return children; }' + nl);
    zip.file('modern/app/page.js', 'export default function Page(){ return null; }' + nl);
  },
  estimate(cfg, addons) {
    const n = (cfg && cfg.modules && cfg.modules.length) || 0;
    const lines = [
      { label: 'Base studio platform', amount: this.PRICING.base },
      { label: n + ' selected modules', amount: n * this.PRICING.perModule }
    ];
    (addons || []).forEach(id => {
      const a = this.PRICING.addons.find(x => x.id === id);
      if (a) lines.push({ label: a.name, amount: a.price });
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    return { currency: this.PRICING.currency, lines, total };
  },
  normalizeCfg(cfg) {
    cfg = Object.assign({}, cfg || {});
    cfg.name = cfg.name || cfg.schoolName || 'ADEWALE CLASSROOM';
    cfg.shortName = cfg.shortName || cfg.admissionAcronym || 'ADC';
    cfg.motto = cfg.motto || cfg.schoolMotto || '';
    cfg.timezone = cfg.timezone || 'Africa/Lagos';
    cfg.currency = cfg.currency || '₦';
    cfg.logoUrl = cfg.logoUrl || 'assets/img/logo.svg';
    const theme = (window.TC && TC.THEMES || []).find(t => t.id === cfg.themeId) || (window.TC && TC.THEMES && TC.THEMES[0]) || { id: 'lumen', primary: '#134e4a', accent: '#d97706' };
    cfg.theme = { id: theme.id, primary: theme.primary, accent: theme.accent };
    const font = (window.TC && TC.FONTS || []).find(f => f.id === cfg.fontId) || (window.TC && TC.FONTS && TC.FONTS[0]);
    if (font) cfg.font = font;
    cfg.socials = {
      facebook: cfg.socialFacebook || '',
      instagram: cfg.socialInstagram || '',
      x: cfg.socialTwitter || '',
      linkedin: cfg.socialLinkedIn || '',
      youtube: cfg.socialYouTube || '',
      tiktok: cfg.socialTikTok || '',
      whatsapp: cfg.socialWhatsApp || ''
    };
    cfg.license = {
      model: cfg.licenseModel || 'lifetime',
      plan: cfg.licensePlan || (cfg.licenseModel === 'subscription' ? (cfg.licenseCycle || 'termly') : 'One-time ownership'),
      status: 'active',
      expires_on: cfg.licenseExpires || null,
      grace_days: Number(cfg.licenseGrace || 7),
      renew_url: cfg.licenseRenewUrl || 'https://wa.me/2348100866322?text=Renew%20Tutoring%20Connect',
      registryUrl: cfg.licenseRegistryUrl || ''
    };
    cfg.buildType = cfg.buildType || 'traditional';
    cfg.demo = cfg.demoMode === 'yes';
    return cfg;
  },
  async build(raw) {
    const cfg = this.normalizeCfg(raw);
    const blob = await this.go(cfg);
    const slug = String(cfg.shortName || cfg.name || 'studio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'studio';
    return { blob, fileName: slug + '-tutoring-connect.zip' };
  }
};
window.Generator = Generator;
