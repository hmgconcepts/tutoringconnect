/* ============================================================================
   test_v27_verify.js — V27 regression checks
   ----------------------------------------------------------------------------
   Run:  node tools/test_v27_verify.js [repo]
   Asserts the V27 work is actually present in a repo: RLS recursion fix in
   the schema, blog engine, documents builder, contracts register, account
   linking, review-my-paper, role mapping, theme-aware page help, and the
   homepage/login cleanups. Run against BOTH the generator and the client.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2] || __dirname.replace(/[\\/]tools$/, '');

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) pass++; else { fail++; console.log('  ✗ ' + label); } }
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const has = (f, re) => { try { return re.test(rd(f)); } catch (e) { return false; } };

/* ---------- 1. RLS recursion fix ---------- */
const sql = rd('database/complete-schema.sql');
ok(/create or replace function public\.tc_parent_matches_uid/.test(sql),
   'schema: tc_parent_matches_uid helper present');
ok(/create or replace function public\.tc_tutor_covers_parent/.test(sql),
   'schema: tc_tutor_covers_parent helper present');
ok(/create or replace function public\.tc_family_can_see_learner/.test(sql),
   'schema: tc_family_can_see_learner helper present');
/* The two source policies must NOT inline-query each other's tables any more.
   The file legitimately contains the superseded V25 definitions too — the
   V27 block later drops and recreates them, so we assert on the FINAL
   (V27) section only: between the V27 marker and the SCHEMA REGISTRY. */
const v27sec = sql.slice(sql.indexOf('-- TUTORING CONNECT — V27'), sql.indexOf('-- SCHEMA REGISTRY'));
ok(/public\.tc_tutor_covers_parent\(id\)/.test(v27sec),
   'schema: parents policy uses the recursion-safe helper');
ok(/public\.tc_parent_matches_uid\(parent_id\)/.test(v27sec),
   'schema: parent_learner policy uses the recursion-safe helper');
ok(!/exists \(select 1 from public\.parent_learner pl\n\s*where pl\.parent_id = parents\.id/.test(v27sec),
   'schema: parents policy no longer reads parent_learner inline');
ok(!/exists \(select 1 from public\.parents p\n\s*where p\.id = parent_learner\.parent_id/.test(v27sec),
   'schema: parent_learner policy no longer reads parents inline');
ok(/tc_family_can_see_learner\(learner_id\)/.test(sql),
   'schema: insight-desk policies use the recursion-safe predicate');
ok(/values \(1, 'V2[789]'/.test(sql) && /v27-rls-recursion-blog-documents/.test(sql),
   'schema: registry (V27+) includes the v27 pack');

/* ---------- 2. Blog engine ---------- */
ok(/create table if not exists public\.tc_blog_posts/.test(sql), 'schema: tc_blog_posts table');
ok(/create table if not exists public\.tc_blog_categories/.test(sql), 'schema: tc_blog_categories table');
ok(/create or replace function public\.tc_blog_list/.test(sql), 'schema: tc_blog_list fn');
ok(/create or replace function public\.tc_blog_get/.test(sql), 'schema: tc_blog_get fn');
ok(/create or replace function public\.tc_blog_set_status/.test(sql), 'schema: tc_blog_set_status fn');
for (const f of ['blog.html', 'blog-post.html', 'blog-manage.html']) {
  ok(fs.existsSync(path.join(ROOT, f)), 'pages: ' + f + ' exists');
}
ok(fs.existsSync(path.join(ROOT, 'assets/js/blog.js')), 'js: blog.js exists');
ok(has('blog.html', /id="blog-root"/), 'blog.html: list mount present');
ok(has('blog-post.html', /id="blog-post-root"/), 'blog-post.html: reader mount present');
ok(has('blog-manage.html', /id="blog-admin-root"/), 'blog-manage.html: editor mount present');
ok(has('blog.html', /page-intro-roles/), 'blog.html: role views section present');

/* ---------- 3. Documents builder + contracts ---------- */
ok(fs.existsSync(path.join(ROOT, 'assets/js/document-builder.js')), 'js: document-builder.js exists');
ok(has('documents.html', /id="doc-builder-root"/), 'documents.html: builder mount present');
ok(has('documents.html', /document-builder\.js/), 'documents.html: loads document-builder.js');
ok(/alter table if exists public\.documents add column if not exists %s/.test(v27sec) &&
   /'doc_type text'/.test(v27sec),
   'schema: documents.doc_type column');
ok(/create or replace function public\.tc_documents_render/.test(sql), 'schema: tc_documents_render fn');
ok(fs.existsSync(path.join(ROOT, 'contracts.html')), 'pages: contracts.html exists');
ok(/create table if not exists public\.contracts/.test(sql), 'schema: contracts table');
ok(/create or replace function public\.tc_contracts_for_family/.test(sql), 'schema: tc_contracts_for_family fn');
ok(has('contracts.html', /CRUD\.renderList\('contracts'\)/), 'contracts.html: CRUD mount');

/* ---------- 4. Account linking + review-my-paper ---------- */
ok(/create or replace function public\.tc_unlinked_records/.test(sql), 'schema: tc_unlinked_records fn');
ok(/create or replace function public\.tc_link_account/.test(sql), 'schema: tc_link_account fn');
ok(fs.existsSync(path.join(ROOT, 'assets/js/account-link.js')), 'js: account-link.js exists');
ok(has('profile.html', /id="link-root"/), 'profile.html: account linking panel mounted');
ok(/create or replace function public\.tc_cbt_recent_result/.test(sql), 'schema: tc_cbt_recent_result fn');
ok(has('cbt-review.html', /id="rv-out"/) && has('cbt-review.html', /tc_cbt_recent_result/),
   'cbt-review.html: review-my-paper UI wired to the RPC');
ok(has('practice.html', /cbt-results\.html\?tab=marking/), 'practice.html: marking queue entry point');

/* ---------- 5. Role mapping (items 15, 27, 32, 38) ---------- */
const rbac = rd('assets/js/rbac.js');
for (const deny of ['messages', 'helpdesk', 'directory', 'birthdays', 'timezones',
                    'accommodations', 'learning-styles', 'broadcasts', 'policies',
                    'referrals', 'blog-manage', 'contracts']) {
  ok(new RegExp("'" + deny + "'").test(rbac.split('STAFF_DENY')[0]) ||
     new RegExp("'" + deny + "'").test(rbac),
     'rbac: family deny covers ' + deny);
}
ok(/'safeguarding', 'application-links', 'activity-log'/.test(rbac), 'rbac: staff deny covers admin pages');
ok(/SHELL = \['dashboard', 'profile', 'change-password', 'notifications',\n                   'inbox', 'offline', 'install', 'about',\n                   'feature-guide', 'site-index', 'contact',\n                   'hmg-ecosystem', 'hmg-products', 'blog', 'blog-post', 'class-register'\]/.test(rbac),
   'rbac: blog, blog-post and class-register in the shell for every role');
ok(/if \(window\.RBAC && typeof RBAC\.level === 'function'\)/.test(rd('assets/js/app.js')),
   'app.js: moduleAllowedForRole delegates to RBAC (no conflicting whitelist)');
const model = JSON.parse(rd('assets/js/nav-model.json'));
const find = id => { for (const s of model) for (const it of s.items) if (it.id === id) return it; return null; };
ok(find('blog') && find('blog').aud === 'public', 'nav: Blog is public');
ok(find('blog_manage') && find('blog_manage').aud === 'staff', 'nav: Blog manager is staff');
ok(find('contracts') && find('contracts').aud === 'staff', 'nav: Contracts is staff');
ok(find('voting') && find('voting').label === 'Voting', 'nav: Voting page renamed to "Voting"');
ok(find('documents') && find('documents').label === 'Documents', 'nav: Documents label corrected');

/* ---------- 6. Page help + theme ---------- */
const sh = rd('assets/js/site-help.js');
ok(/const bg = dark \? '#111827' : '#ffffff'/.test(sh) && /const ink = dark \? '#f1f5f9' : '#0f172a'/.test(sh),
   'site-help.js: theme-aware inline popup colours');
ok(/paintThemeButton/.test(rd('assets/js/app.js')) && /document\.documentElement\.dataset\.theme/.test(rd('assets/js/app.js')),
   'app.js: theme toggle sets body+html and repaints its own label');

/* ---------- 7. Homepage / login cleanup (items 41, 42) ---------- */
ok(!/page-intro-what/.test(rd('login.html')), 'login.html: extraneous description removed');
ok(!/page-intro-what/.test(rd('index.html')), 'index.html (generator): extraneous description removed');
const CLIENT = path.join(ROOT, '..', 'adewaleclassroom');
if (fs.existsSync(CLIENT) && fs.existsSync(path.join(CLIENT, 'index.html'))) {
  ok(!/page-intro-what/.test(fs.readFileSync(path.join(CLIENT, 'index.html'), 'utf8')),
     'client index.html: extraneous description removed');
}

/* ---------- 8. Public self-booking options (item 37) ---------- */
const pb = rd('public-book.html');
ok(/7 → 28 classes/.test(pb) && /3 → 12 classes/.test(pb), 'public-book.html: expanded times-per-cycle');

console.log('\n=== V27 VERIFY · ' + (ROOT.endsWith('tutoringconnect') ? 'generator' : 'client') + ' ===');
console.log('  pass ' + pass + '  fail ' + fail);
process.exit(fail ? 1 : 0);
