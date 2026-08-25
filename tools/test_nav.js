/* test_nav.js — run against ANY repo:  node tools/test_nav.js <repo-path>
   Added in V25. sync_all.sh runs it against the generator AND the
   generated client site before packaging, because the suite used to be
   zipped with nothing ever having been executed against the client copy. */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const R=(process.argv[2]||require('path').resolve(__dirname,'..')).replace(/\/$/,'')+'/';
function load(page, role){
  const dom=new JSDOM(fs.readFileSync(R+page,'utf8'),{runScripts:'outside-only',url:'https://x.test/'+page});
  const w=dom.window;
  w.localStorage.clear();
  const run=f=>w.eval(fs.readFileSync(R+'assets/js/'+f,'utf8'));
  run('nav-model.js'); run('rbac.js'); run('nav.js');
  if(role) { w.TCNav.rememberRole(role); w.TCNav.render(role); }
  else w.TCNav.render();
  return w;
}
let fail=0, pass=0;
function ok(c,m){ if(c){pass++;} else {fail++;console.log('FAIL: '+m);} }

// 1. determinism: 10 renders identical
{
  const w=load('about.html','tutor');
  const nav=w.document.querySelector('.app-nav');
  const first=nav.innerHTML;
  for(let i=0;i<10;i++) w.TCNav.render('tutor');
  ok(nav.innerHTML===first,'nav must be byte-identical after 10 renders');
  console.log('tutor links:', nav.querySelectorAll('a[data-module-id]').length);
}
// 2. role isolation
const counts={};
for(const r of ['admin','tutor','parent','student']){
  const w=load('about.html',r);
  const nav=w.document.querySelector('.app-nav');
  const ids=[...nav.querySelectorAll('a[data-module-id]')].map(a=>a.dataset.moduleId);
  counts[r]=ids.length;
  ok(ids.includes('dashboard'), r+' must be able to reach the dashboard');
  if(r!=='admin'){
    ['payroll','finance','settings','admin_data','storage','license'].forEach(bad=>
      ok(!ids.includes(bad), r+' must NOT see '+bad));
  }
  if(r==='parent'||r==='student'){
    ['learners','engagements','tutors','sessions','at_risk','group_insights','predictions']
      .forEach(bad=>ok(!ids.includes(bad), r+' must NOT see '+bad));
  }
  if(r==='student') ok(!ids.includes('invoices'),'student must not see invoices');
  if(r==='parent') ok(ids.includes('invoices'),'parent should see invoices');
}
console.log('counts',counts);
ok(counts.admin>counts.tutor && counts.tutor>counts.parent,'admin > tutor > parent');
// 3. no role => public only
{
  const w=load('about.html',null);
  const ids=[...w.document.querySelectorAll('.app-nav a[data-module-id]')].map(a=>a.dataset.moduleId);
  ok(!ids.includes('learners'),'unresolved role must not show learners');
  ok(ids.includes('about'),'unresolved role should still show About');
  console.log('public links:',ids.length, ids.join(','));
}
// 4. same nav on a public page as on a private one, for the same role
{
  const a=load('about.html','parent'), b=load('scoresheet.html','parent');
  const ia=[...a.document.querySelectorAll('.app-nav a')].map(x=>x.dataset.moduleId).join(',');
  const ib=[...b.document.querySelectorAll('.app-nav a')].map(x=>x.dataset.moduleId).join(',');
  ok(ia===ib,'parent nav must be identical on a public page and a private page');
}
// 5. no empty section headings, no duplicate hrefs
{
  const w=load('about.html','tutor');
  const nav=w.document.querySelector('.app-nav');
  const kids=[...nav.children];
  kids.forEach((el,i)=>{
    if(el.tagName!=='BUTTON') return;
    let n=0; for(let j=i+1;j<kids.length;j++){ if(kids[j].tagName==='BUTTON')break; if(kids[j].tagName==='A')n++; }
    ok(n>0,'section "'+el.textContent+'" must not be empty');
  });
  const hrefs=[...nav.querySelectorAll('a')].map(a=>a.getAttribute('href'));
  ok(new Set(hrefs).size===hrefs.length,'no duplicate links in the pane');
}
// 6. every menu target exists
{
  const w=load('about.html','admin');
  const missing=[...w.document.querySelectorAll('.app-nav a')].map(a=>a.getAttribute('href'))
    .filter(h=>h&&!fs.existsSync(R+h));
  ok(missing.length===0,'all menu targets exist; missing='+missing);
}
// 7. cached role removes the flash
{
  const dom=new JSDOM(fs.readFileSync(R+'about.html','utf8'),{runScripts:'outside-only',url:'https://x.test/about.html'});
  const w=dom.window; w.localStorage.setItem('tc-role','parent');
  w.eval(fs.readFileSync(R+'assets/js/nav-model.js','utf8'));
  w.eval(fs.readFileSync(R+'assets/js/rbac.js','utf8'));
  w.eval(fs.readFileSync(R+'assets/js/nav.js','utf8'));
  w.TCNav.render();
  const ids=[...w.document.querySelectorAll('.app-nav a')].map(a=>a.dataset.moduleId);
  ok(!ids.includes('payroll'),'first paint with a cached parent role must not show payroll');
  ok(ids.length>6,'cached role should paint the parent menu, not just public');
}
console.log('\npass '+pass+'  fail '+fail);
process.exit(fail?1:0);
