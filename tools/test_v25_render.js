/* test_v25_render.js — run against ANY repo:  node tools/test_v25_render.js <repo-path>
   Added in V25. sync_all.sh runs it against the generator AND the
   generated client site before packaging, because the suite used to be
   zipped with nothing ever having been executed against the client copy. */
const {JSDOM}=require('jsdom'); const fs=require('fs');
const R=(process.argv[2]||require('path').resolve(__dirname,'..')).replace(/\/$/,'')+'/';
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL: '+m));};

async function page(f, role, mount){
  const dom=new JSDOM(fs.readFileSync(R+f,'utf8'),{runScripts:'outside-only',url:'https://x.test/'+f});
  const w=dom.window;
  w.PRACTICE={name:'ADEWALE CLASSROOM',timezone:'Africa/Lagos'};
  w.sb=null;
  ['nav-model.js','rbac.js','nav.js','desk-kit.js','cert-studio.js','cbt-manage.js','free-classes.js']
    .forEach(s=>w.eval(fs.readFileSync(R+'assets/js/'+s,'utf8')));
  w.TCNav.rememberRole(role); w.TCNav.render(role);
  if(mount) await w.Desk.mount(mount);
  return w;
}

(async()=>{
  // --- every desk mounts, renders a form and a list, without a database ---
  const DESKS=[['at-risk.html','at_risk'],['value-added.html','value_added'],
    ['predictions.html','predictions'],['group-insights.html','group_insights'],
    ['scoresheet.html','scoresheet'],['progress-reports.html','progress_reports'],
    ['timezones.html','timezones'],['analytics.html','practice_analytics'],
    ['insights.html','insights']];
  for(const [f,k] of DESKS){
    const w=await page(f,'tutor',k);
    const host=w.document.getElementById('desk-root');
    ok(!!host,`${f}: desk-root exists`);
    const inputs=host.querySelectorAll('input,select,textarea').length;
    const save=host.querySelector('[data-desk="save"]');
    ok(inputs>=5,`${f}: the entry form has fields (${inputs})`);
    ok(!!save,`${f}: there is a Save button`);
    ok(/Add a/.test(host.textContent),`${f}: the form is labelled`);
    ok(host.querySelectorAll('.stat-card').length>0,`${f}: the summary strip renders`);
    ok(/Connect Supabase|Heads up/.test(host.textContent),
       `${f}: says honestly that it needs a database, instead of failing silently`);
  }

  // --- a parent gets read-only, not an entry form ---
  {
    const w=await page('scoresheet.html','parent','scoresheet');
    const host=w.document.getElementById('desk-root');
    ok(!host.querySelector('[data-desk="save"]'),'parent: no Save button on the scoresheet desk');
    ok(/View only/.test(host.textContent),'parent: told plainly it is view only');
  }

  // --- certificate studio renders all six layouts with no database ---
  {
    const w=await page('certificates.html','admin');
    await w.CertStudio.mount('cert-root');
    const box=w.document.getElementById('ct-preview');
    ok(!!box && box.innerHTML.length>500,'cert: a preview renders');
    for(const L of ['premium','diploma','classic','modern','elegant','minimal']){
      const h=w.CertStudio.html({name:'Test Learner',layout:L,code:'TC-AAAA-BBBB',
        title:'CERTIFICATE OF ACHIEVEMENT',body:'has done well.',pc:'#0506ae',ac:'#964eec'});
      ok(h.length>400 && h.indexOf('Test Learner')>-1, 'cert: layout "'+L+'" renders the name');
      ok(h.indexOf('TC-AAAA-BBBB')>-1, 'cert: layout "'+L+'" prints the verification code');
    }
    // Drive link conversion
    const h=w.CertStudio.html({name:'X',layout:'classic',
      sig:'https://drive.google.com/file/d/ABC123/view'});
    ok(h.indexOf('uc?export=view')>-1 && h.indexOf('id=ABC123')>-1,'cert: a Drive share link becomes a direct image');
  }

  // --- CBT lifecycle strip ---
  {
    const w=await page('practice.html','tutor');
    const open={id:'1',title:'T',code:'C',is_open:true,questions:[]};
    const shut={id:'2',title:'T',code:'C',is_open:false,questions:[]};
    const arch={id:'3',title:'T',code:'C',is_archived:true,questions:[]};
    ok(/Open/.test(w.CBTManage.badge(open)),'cbt: an open paper is badged Open');
    ok(/Closed/.test(w.CBTManage.badge(shut)),'cbt: a closed paper is badged Closed');
    ok(/Archived/.test(w.CBTManage.badge(arch)),'cbt: an archived paper is badged Archived');
    const b1=w.CBTManage.buttons(open), b2=w.CBTManage.buttons(shut);
    ok(/data-cbtm="close"/.test(b1),'cbt: an open paper offers Close');
    ok(/data-cbtm="open"/.test(b2),'cbt: a closed paper offers Open');
    ['preview','questions','results','share','archive'].forEach(a=>
      ok(new RegExp('data-cbtm="'+a+'"').test(b1),'cbt: "'+a+'" is offered'));
    ok(/data-cbtm="unarchive"/.test(w.CBTManage.buttons(arch)),'cbt: an archived paper offers Unarchive');
  }

  // --- free classes ---
  {
    const w=await page('free-classes.html','admin');
    await w.FreeClasses.mount('free-root');
    const h=w.document.getElementById('free-root');
    ok(/fc-name/.test(h.innerHTML),'free: the cohort form renders');
    ['fc-meet','fc-yt','fc-wa','fc-tg','fc-platform','fc-board'].forEach(id=>
      ok(h.querySelector('#'+id),'free: field "'+id+'" exists'));
    ok(!h.querySelector('input[type=file]'),'free: no file upload anywhere');
  }
  {
    const w=await page('free-register.html','');
    await w.FreeClasses.mountPublic('free-reg-root');
    const h=w.document.getElementById('free-reg-root');
    ok(/No registration link/.test(h.textContent),
       'free: without a token the public page explains itself instead of erroring');
  }

  console.log('\npass '+pass+'  fail '+fail);
  process.exit(fail?1:0);
})();
