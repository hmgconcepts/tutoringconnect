/* test_v26_verify.js — run against ANY repo:  node tools/test_v26_verify.js <repo>
   Verifies the V26 fixes in a BUILT repo rather than in the source tree,
   using the three CSV files the user actually reported the bugs with. */
const {JSDOM}=require('jsdom'),fs=require('fs');
const R=(process.argv[2]||'/home/user/fixed/adewaleclassroom')+'/';
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('FAIL: '+m));};

// ---- item 9 against the real CSVs, in the CLIENT build ----
const fx='/home/user/fixed/tutoringconnect/tools/fixtures-csv/';
for(const f of fs.readdirSync(fx)){
  const dom=new JSDOM('<div id=root></div>',{runScripts:'outside-only',url:'https://x.test/'});
  const w=dom.window;
  w.TC={esc:s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))};
  ['cbt-types.js','cbt.js'].forEach(s=>w.eval(fs.readFileSync(R+'assets/js/'+s,'utf8')));
  const qs=w.CBT.parseCSV(fs.readFileSync(fx+f,'utf8'));
  const root=w.document.getElementById('root');
  root.innerHTML=qs.map((q,i)=>w.CBT.renderQuestion(q,i,false)).join('');
  root.querySelectorAll('.cbt-q').forEach((c,i)=>c._q=qs[i]);
  try{w.CBTTypes.activate(w.document)}catch(e){}
  const a=w.CBT.collectAnswers(root);
  const r=w.CBT.grade(qs,a);
  ok(r.got===0, `client build: ${f} blank paper scores 0 (got ${r.got}/${r.max})`);
  const answered=Object.keys(a).filter(k=>!w.CBTTypes.isBlank(a[k])).length;
  ok(answered===0, `client build: ${f} palette reports 0 answered (got ${answered})`);
  const broken=qs.filter(q=>!q.tutor_marked && !w.CBTTypes.hasKey(q)).length;
  ok(broken===0, `client build: ${f} no unkeyed machine-markable question (${broken})`);
  // and a REAL attempt still scores properly
  const first=root.querySelector('.cbt-q input[type=radio]');
  if(first){ first.checked=true;
    const a2=w.CBT.collectAnswers(root);
    ok(Object.keys(a2).filter(k=>!w.CBTTypes.isBlank(a2[k])).length===1,
       `client build: ${f} answering ONE question registers exactly one answer`);
  }
}

// ---- item 8: popups get an explicit colour in both themes ----
{
  const css=fs.readFileSync(R+'assets/css/style.css','utf8');
  ok(/body\[data-theme="dark"\][^{]*#cbtm-modal/.test(css),'client build: dark popups use body[data-theme]');
  ok(/\.tc-popup[^{]*\{[\s\S]{0,300}color:/.test(css),'client build: .tc-popup has a colour');
}

// ---- item 1 in the client build ----
{
  const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://x.test/'});
  const w=dom.window; w.eval(fs.readFileSync(R+'assets/js/cbt-exam-kit.js','utf8'));
  ok(Math.abs(w.ExamKit.calc.evaluate('logb(8,2)')-3)<1e-9,'client build: logb(8,2)=3');
  w.ExamKit.trackFields(); w.ExamKit.toggleMathKeyboard();
  const n=w.document.querySelectorAll('#tc-mathkb [data-s]').length;
  ok(n>=250,'client build: maths keyboard has '+n+' symbols');
}
// ---- new pages/scripts present ----
['assets/js/cbt-marking.js','assets/js/scope-check.js','assets/img/ecosystem-flyers/flyer-1.jpg']
  .forEach(p=>ok(fs.existsSync(R+p),'client build ships '+p));
ok(fs.readFileSync(R+'hmg-products.html','utf8').includes('schoolconnectdemo.vercel.app'),
   'client build: School Connect demo link');
ok(!/href=["'][^"']*hmgschoolconnect/.test(fs.readFileSync(R+'hmg-products.html','utf8')),
   'client build: generator not exposed');

console.log('\npass '+pass+'  fail '+fail);
process.exit(fail?1:0);
