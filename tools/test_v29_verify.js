/* ============================================================================
   test_v29_verify.js — V29 regression checks (social registration links)
   ----------------------------------------------------------------------------
   Run:  node tools/test_v29_verify.js [repo]
   Covers: schema tables/RPCs/RLS, admin studio page, public landing page,
   nav/RBAC/catalog wiring, generator manifest, SEO, registry.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2] || __dirname.replace(/[\\/]tools$/, '');

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) pass++; else { fail++; console.log('  ✗ ' + label); } }
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const has = (f, re) => { try { return re.test(rd(f)); } catch (e) { return false; } };

const sql = rd('database/complete-schema.sql');
const v29sec = sql.slice(sql.indexOf('-- TUTORING CONNECT — V29'), sql.indexOf('-- SCHEMA REGISTRY'));

/* ---------- 1. Schema ---------- */
ok(/create table if not exists public\.tc_class_links/.test(v29sec), 'sql: tc_class_links table');
ok(/create table if not exists public\.tc_class_registrations/.test(v29sec), 'sql: tc_class_registrations table');
for (const fn of ['tc_class_link_get','tc_class_register','tc_class_links_my','tc_class_regs_for','tc_class_reg_status','tc_class_link_set_status']) {
  ok(new RegExp('create or replace function public\\.' + fn).test(v29sec), 'sql: ' + fn);
}
ok(/check \(kind in \('paid','free'\)\)/.test(v29sec), 'sql: kind paid/free check');
ok(/tc_class_links_public on public\.tc_class_links[\s\S]*?using \(status = 'open'\)/.test(v29sec), 'sql: public reads only open links');
ok(/reg_no       text not null unique/.test(v29sec), 'sql: unique reg_no');
ok(/values \(1, 'V29'/.test(sql) && /v29-social-registration-links/.test(sql), 'schema: registry upserts V29 with the v29 pack');

/* ---------- 2. Admin studio ---------- */
ok(fs.existsSync(path.join(ROOT, 'class-links.html')), 'pages: class-links.html exists');
ok(fs.existsSync(path.join(ROOT, 'assets/js/class-links.js')), 'js: class-links.js exists');
ok(has('class-links.html', /id="class-links-root"/), 'class-links.html: mount present');
ok(has('class-links.html', /class-links\.js/), 'class-links.html: loads the module');
const cl = rd('assets/js/class-links.js');
for (const net of ['wa.me','facebook.com/sharer','twitter.com/intent','linkedin.com/sharing','t.me/share','mailto:']) {
  ok(cl.indexOf(net) > -1, 'class-links.js: share via ' + net);
}
ok(/navigator\.clipboard\.writeText/.test(cl), 'class-links.js: copy-link button');
ok(/cl-qr/.test(cl), 'class-links.js: QR toggle');
ok(/tc_class_links_my/.test(cl), 'class-links.js: calls tc_class_links_my');
ok(/tc_class_regs_for/.test(cl), 'class-links.js: calls tc_class_regs_for');
ok(/tc_class_reg_status/.test(cl), 'class-links.js: calls tc_class_reg_status');
ok(/tc_class_link_set_status/.test(cl), 'class-links.js: calls tc_class_link_set_status');

/* ---------- 3. Public landing ---------- */
ok(fs.existsSync(path.join(ROOT, 'class-register.html')), 'pages: class-register.html exists');
ok(fs.existsSync(path.join(ROOT, 'assets/js/class-register.js')), 'js: class-register.js exists');
ok(has('class-register.html', /id="class-reg-root"/), 'class-register.html: mount present');
ok(has('class-register.html', /class-register\.js/), 'class-register.html: loads the module');
const cr = rd('assets/js/class-register.js');
ok(/tc_class_link_get/.test(cr), 'class-register.js: calls tc_class_link_get');
ok(/tc_class_register/.test(cr), 'class-register.js: calls tc_class_register');
ok(/clr-consent/.test(cr), 'class-register.js: guardian consent checkbox');
ok(/REG-/.test(cr) || /reg_no/.test(cr), 'class-register.js: shows registration number');
ok(/Forward this class/.test(cr), 'class-register.js: forward-on-whatsapp button');

/* ---------- 4. Wiring ---------- */
const nav = JSON.parse(rd('assets/js/nav-model.json'));
const found = (() => { for (const s of nav) for (const it of s.items) if (it.id === 'class_links') return it; return null; })();
ok(found && found.aud === 'staff', 'nav: Class registration links is staff');
const rbac = rd('assets/js/rbac.js');
ok(/'class-register'/.test(rbac), 'rbac: class-register is public');
ok(/'class-links'/.test(rbac), 'rbac: class-links denied to families');
ok(/'class_links'/.test(rd('assets/js/catalog.js')), 'catalog: class links module present');
ok(/"class-links\.html"/.test(rd('assets/js/page-guide.js')) && /"class-register\.html"/.test(rd('assets/js/page-guide.js')),
   'page-guide: both pages documented');
if (fs.existsSync(path.join(ROOT, 'assets/js/generator.js'))) {
  const gen = rd('assets/js/generator.js');
  ok(/class-links\.js/.test(gen) && /class-register\.js/.test(gen) && /v29-social-registration-links\.sql/.test(gen),
     'generator: V29 files in always-files');
}
if (fs.existsSync(path.join(ROOT, 'tools/build_seo.py'))) {
  ok(/class-register\.html/.test(rd('tools/build_seo.py')), 'seo: class-register is indexable');
}

console.log('\n=== V29 VERIFY · ' + (ROOT.endsWith('tutoringconnect') ? 'generator' : 'client') + ' ===');
console.log('  pass ' + pass + '  fail ' + fail);
process.exit(fail ? 1 : 0);
