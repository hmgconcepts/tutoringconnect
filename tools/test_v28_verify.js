/* ============================================================================
   test_v28_verify.js — V28 regression checks
   ----------------------------------------------------------------------------
   Run:  node tools/test_v28_verify.js [repo]
   Covers: roles & status manager, settings parity cards, ops-register
   columns, RLS on the public registers, ops-desk KPI strips, read-only field
   hiding, CRUD def enrichment, generator manifest.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2] || __dirname.replace(/[\\/]tools$/, '');

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) pass++; else { fail++; console.log('  ✗ ' + label); } }
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const has = (f, re) => { try { return re.test(rd(f)); } catch (e) { return false; } };

/* ---------- 1. Roles & Status Manager ---------- */
const sql = rd('database/complete-schema.sql');
const v28sec = sql.slice(sql.indexOf('-- TUTORING CONNECT — V28'), sql.indexOf('-- SCHEMA REGISTRY'));
ok(/create or replace function public\.tc_admin_list_profiles/.test(v28sec), 'sql: tc_admin_list_profiles');
ok(/create or replace function public\.tc_admin_set_role_status/.test(v28sec), 'sql: tc_admin_set_role_status');
ok(/cannot_change_self/.test(v28sec), 'sql: no self role-change guard');
ok(/role_status_change/.test(v28sec), 'sql: role changes are audited');
ok(fs.existsSync(path.join(ROOT, 'assets/js/status-manager.js')), 'js: status-manager.js exists');
ok(has('status-manager.html', /id="status-root"/), 'status-manager.html: mounted');
ok(has('status-manager.html', /status-manager\.js/), 'status-manager.html: loads the module');
ok(has('settings.html', /data-save-card="ids"/) && /learner_id_prefix/.test(rd('settings.html')),
   'settings: learner-ID numbering card');
ok(has('settings.html', /s-enforce2fa/) && /enforce_2fa/.test(rd('settings.html')),
   'settings: 2FA card');
ok(has('settings.html', /s-geolat/) && /enforce_geo/.test(rd('settings.html')),
   'settings: geofence card');
ok(has('settings.html', /s-license-summary/), 'settings: license summary card');
ok(/learner_id_prefix/.test(v28sec) && /enforce_2fa/.test(v28sec) && /enforce_geo/.test(v28sec),
   'sql: settings columns');

/* ---------- 2. Ops-register columns ---------- */
for (const [tbl, col] of [['rooms','capacity'],['substitutions','cover_tutor_name'],
  ['sessions','meeting_url'],['sessions','outcome'],['session_attendance','note'],
  ['assignments','due_on'],['products','price'],['scholarships','active'],
  ['payments','method'],['exam_reg_links','max_uses'],['exam_registrations','full_name'],
  ['badges','awarded_on'],['rubrics','criteria'],['subjects','exam_board'],
  ['gallery','featured'],['complaints','priority'],['messages','read'],
  ['classwork_items','due_on'],['stream_posts','status'],['library_items','url'],
  ['lms_lessons','status'],['eresources','url'],['resources','url'],
  ['parent_meetings','meeting_url'],['trials','scheduled_at'],['waitlist','offered_on'],
  ['inquiries','owner'],['helpdesk_tickets','priority'],['events','starts_at'],
  ['reviews','published'],['announcements','pinned']]) {
  ok(new RegExp("\\('" + tbl + "','" + col + " [a-z0-9_ ]+'\\)").test(v28sec),
     'sql: ' + tbl + '.' + col);
}

/* ---------- 3. RLS on public registers ---------- */
for (const t of ['products','scholarships','gallery','events','reviews']) {
  ok(/alter table public\.%I enable row level security/.test(v28sec) &&
     new RegExp("'products','scholarships','gallery','events'").test(v28sec) &&
     (t === 'reviews' ? /alter table public.reviews enable row level security/.test(v28sec) : true),
     'sql: RLS enabled on ' + t);
}
ok(/reviews_public[\s\S]*?published = true/.test(v28sec), 'sql: reviews public = published only');

/* ---------- 4. Ops-desk KPI strips ---------- */
ok(fs.existsSync(path.join(ROOT, 'assets/js/ops-desk.js')), 'js: ops-desk.js exists');
const od = rd('assets/js/ops-desk.js');
for (const p of ['sessions','attendance','calendar','meetings','cancellations','makeups',
  'makeup-credits','session-notes','rooms','substitutions','birthdays','directory',
  'my-children','subjects','engagements','groups','reminders','events','curriculum',
  'sow','assignments','classwork','reading','stream','rubrics','accommodations',
  'study-log','flashcards','gamification','exam-targets','exam-links','exam-register',
  'scoresheet','certificates','portfolio','library','lms','eresources','free-classes',
  'payment-history','packages','fees','products','scholarships','finance','payroll',
  'broadcasts','forum','complaints','helpdesk','parent-meetings','gallery','reviews',
  'inquiries','trials','waitlist','onboarding','referrals','approvals']) {
  ok(new RegExp("^    '" + p + "':", 'm').test(od), 'ops-desk: covers ' + p);
}
const pagesWithOps = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && has(f, /ops-desk\.js/));
ok(pagesWithOps.length >= 100, 'pages: ops-desk loaded on ' + pagesWithOps.length + ' pages');

/* ---------- 5. Read-only field hiding (item 21) ---------- */
const rbac = rd('assets/js/rbac.js');
ok(/closest\('\.form-group'\)/.test(rbac), 'rbac: read-only hides the .form-group of disabled fields');
ok(/data-tc-ro-hidden/.test(rbac), 'rbac: hidden wrappers marked for restore');

/* ---------- 6. CRUD def enrichment ---------- */
const crud = rd('assets/js/crud.js');
ok(/products: \{ table: 'products', title: 'Book \/ material'/.test(crud), 'crud: products def enriched');
ok(/complaints: \{ table: 'complaints'[\s\S]*?priority/.test(crud), 'crud: complaints def enriched');
ok(/gamification: \{ table: 'badges'[\s\S]*?awarded_on/.test(crud), 'crud: gamification def enriched');
ok(/rubrics: \{ table: 'rubrics'[\s\S]*?owner/.test(crud), 'crud: rubrics def enriched');

/* ---------- 7. Generator manifest ---------- */
if (fs.existsSync(path.join(ROOT, 'assets/js/generator.js'))) {
  const gen = rd('assets/js/generator.js');
  ok(/ops-desk\.js/.test(gen) && /status-manager\.js/.test(gen), 'generator: V28 scripts in always-files');
  ok(/v28-admin-and-ops-enrichment\.sql/.test(gen), 'generator: V28 SQL pack in always-files');
}

/* ---------- 8. Schema registry ---------- */
ok(/values \(1, 'V(2[89])'/.test(sql) && /v28-admin-and-ops-enrichment/.test(sql),
   'schema: registry (V28/V29) includes the v28 pack');

console.log('\n=== V28 VERIFY · ' + (ROOT.endsWith('tutoringconnect') ? 'generator' : 'client') + ' ===');
console.log('  pass ' + pass + '  fail ' + fail);
process.exit(fail ? 1 : 0);
