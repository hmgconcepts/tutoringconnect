#!/usr/bin/env python3
"""Custom workflow pages — keep tutoring-specific engines, wrap in v16 shell."""
import sys
sys.path.insert(0, '/home/user/tutoring-connect/tools')
from rebuild_pages import page, feature_card, crud_block, head, ROOT

# ---- APPLY ----
page('apply.html', 'Request a place', 'Public inquiry and coded application form for ADEWALE CLASSROOM.',
     feature_card('Public inquiry / application link',
                  'Parents request tutoring here. If the URL has <code>?code=</code>, the form posts through <code>tc_submit_application</code> (expiry, max uses, counter). Without a code it lands in Inquiries. No account required.',
                  ['Open this page or a coded link', 'Fill parent + learner + subject', 'Submit — RPC or inquiries insert', 'Studio converts to a trial, then an engagement'],
                  [('application-links.html', 'Create a code'), ('inquiries.html', 'Staff pipeline'), ('login.html', 'Already have access')]) + '''
      <div class="card" style="max-width:640px">
        <p id="link-intro" class="muted">General inquiry. A studio code in the URL customises this form.</p>
        <form id="app-form">
          <div class="grid grid-2">
            <div class="form-group"><label>Parent name</label><input class="form-input" name="parent_name" required></div>
            <div class="form-group"><label>Email</label><input class="form-input" type="email" name="email" required></div>
            <div class="form-group"><label>WhatsApp</label><input class="form-input" name="phone"></div>
            <div class="form-group"><label>Learner name</label><input class="form-input" name="learner_name" required></div>
            <div class="form-group"><label>Subject wanted</label><input class="form-input" name="subject" placeholder="IGCSE Maths, SAT, WAEC English…"></div>
            <div class="form-group"><label>1:1 or group</label>
              <select class="form-select" name="kind"><option value="one_on_one">One-to-one</option><option value="group">Group</option><option value="unsure">Not sure</option></select></div>
            <div class="form-group"><label>Timezone</label><input class="form-input" name="timezone" value="Africa/Lagos"></div>
            <div class="form-group" style="grid-column:1/-1"><label>Notes / goals</label><textarea class="form-textarea" name="notes"></textarea></div>
          </div>
          <button class="btn btn-primary" type="submit">Submit application</button>
        </form>
        <p id="app-ok" hidden class="badge badge-ok">Received. The studio will contact you on WhatsApp or email.</p>
      </div>
''', extra_js=r'''
const code = new URLSearchParams(location.search).get('code') || '';
(async () => {
  if (!code || !window.sb) return;
  const { data } = await sb.from('application_links').select('*').eq('code', code).maybeSingle();
  if (data) {
    document.getElementById('link-intro').innerHTML = '<b>'+TC.esc(data.title)+'</b> — '+TC.esc(data.intro||'')+' · '+TC.esc(data.subject||'')+' · '+TC.esc(data.kind||'');
    const sub = document.querySelector('[name=subject]'); if (sub && data.subject) sub.value = data.subject;
    const k = document.querySelector('[name=kind]'); if (k && data.kind) k.value = data.kind;
  }
})();
document.getElementById('app-form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const row = Object.fromEntries(fd.entries());
  if (!window.sb) { toast('Preview only — connect Supabase to accept live applications.','warning'); return; }
  if (code) {
    const { data, error } = await sb.rpc('tc_submit_application', { p_code: code, p_row: row });
    if (error) { toast(error.message,'danger'); return; }
  } else {
    const { error } = await sb.from('inquiries').insert({
      parent_name: row.parent_name, email: row.email, phone: row.phone, learner_name: row.learner_name,
      subject: row.subject, kind: row.kind, timezone: row.timezone, source: 'apply.html', notes: row.notes, status: 'new'
    });
    if (error) { toast(error.message,'danger'); return; }
  }
  document.getElementById('app-ok').hidden = false;
  toast('Application received','success');
  e.target.reset();
};
''')

# ---- EXAM REGISTER ----
page('exam-register.html', 'Exam registration', 'Register for WAEC, NECO, UTME, IGCSE, IELTS, SAT and more. Passport is a Drive link.',
     feature_card('Local + international exam registration',
                  'WAEC, NECO, GCE, NABTEB, BECE, UTME/JAMB, IGCSE, IELTS, TOEFL, SAT, GRE, GMAT, JUPEB. Passport photograph is a Google Drive link with preview — never an upload into the 500 MB database.',
                  ['Open a studio exam link or pick a board', 'Fill candidate details', 'Paste Drive passport URL', 'Submit — staff see it on Exam links'],
                  [('exam-links.html', 'Staff: create links'), ('apply.html', 'Tutoring application')]) + '''
      <div class="card" style="max-width:720px">
        <form id="ex-form">
          <div class="grid grid-2">
            <div class="form-group"><label>Full name</label><input class="form-input" name="full_name" required></div>
            <div class="form-group"><label>Student ID (if already enrolled)</label><input class="form-input" name="student_no" placeholder="TC-0001"></div>
            <div class="form-group"><label>Email</label><input class="form-input" type="email" name="email"></div>
            <div class="form-group"><label>Phone</label><input class="form-input" name="phone"></div>
            <div class="form-group"><label>Date of birth</label><input class="form-input" type="date" name="dob"></div>
            <div class="form-group"><label>Sex</label><select class="form-select" name="sex"><option></option><option>F</option><option>M</option></select></div>
            <div class="form-group"><label>Board</label>
              <select class="form-select" name="board">
                <option>WAEC</option><option>NECO</option><option>GCE</option><option>NABTEB</option><option>BECE</option>
                <option>UTME / JAMB</option><option>IGCSE</option><option>IELTS</option><option>TOEFL</option>
                <option>SAT</option><option>GRE</option><option>GMAT</option><option>JUPEB</option>
              </select></div>
            <div class="form-group"><label>Series / sitting</label><input class="form-input" name="series" placeholder="May/June 2027"></div>
            <div class="form-group"><label>Preferred centre</label><input class="form-input" name="centre"></div>
            <div class="form-group"><label>Subjects (comma separated)</label><input class="form-input" name="subjects"></div>
            <div class="form-group"><label>Passport photo (Drive link)</label><input class="form-input" name="photo_url" placeholder="https://drive.google.com/…"></div>
            <div class="form-group"><label>Supporting doc (Drive)</label><input class="form-input" name="doc_url"></div>
            <div class="form-group"><label>Guardian</label><input class="form-input" name="guardian"></div>
            <div class="form-group" style="grid-column:1/-1"><label>Notes</label><textarea class="form-textarea" name="notes"></textarea></div>
          </div>
          <div id="pass-prev"></div>
          <button class="btn btn-primary" type="submit">Submit registration</button>
        </form>
      </div>
''', extra_js=r'''
const code = new URLSearchParams(location.search).get('code') || '';
document.querySelector('[name=photo_url]').onchange = function(){
  if (window.Media) document.getElementById('pass-prev').innerHTML = Media.card(this.value, 'Passport preview');
};
document.getElementById('ex-form').onsubmit = async (e) => {
  e.preventDefault();
  const row = Object.fromEntries(new FormData(e.target).entries());
  row.code = code;
  if (!window.sb) { toast('Preview only. Connect Supabase to store registrations.','warning'); return; }
  const { error } = await sb.from('exam_registrations').insert(row);
  if (error) toast(error.message,'danger'); else { toast('Registration submitted','success'); e.target.reset(); }
};
''')

# ---- EXAM LINKS ----
page('exam-links.html', 'Exam registration links', 'Shareable codes for WAEC, NECO, UTME, IGCSE, IELTS, SAT and more.',
     feature_card('Shareable exam registration links',
                  'Create a code, share the public form. Passport stays a Drive link. Counters and expiry match School Connect admissions links.',
                  ['Create a link', 'Share exam-register.html?code=', 'Candidates submit', 'Review on this page'],
                  [('exam-register.html', 'Public form')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Code</label><input class="form-input" id="code" placeholder="waec2027"></div>
          <div class="form-group"><label>Title</label><input class="form-input" id="title" placeholder="WAEC May/June 2027"></div>
          <div class="form-group"><label>Board</label><input class="form-input" id="board" value="WAEC"></div>
          <div class="form-group"><label>Series</label><input class="form-input" id="series"></div>
          <div class="form-group"><label>Expires</label><input class="form-input" id="exp" type="date"></div>
          <div class="form-group"><label>Max uses</label><input class="form-input" id="max" type="number"></div>
          <div class="form-group" style="grid-column:1/-1"><label>Intro</label><textarea class="form-textarea" id="intro"></textarea></div>
        </div>
        <button class="btn btn-primary" type="button" id="mk">Create link</button>
        <p id="share" class="muted"></p>
      </div>
      <h3 style="margin-top:18px">Links</h3><div id="list"></div>
      <h3 style="margin-top:18px">Registrations</h3><div id="regs"></div>
''', extra_js=r'''
async function load(){
  if(!window.sb) return;
  const {data}=await sb.from('exam_reg_links').select('*').order('created_at',{ascending:false});
  document.getElementById('list').innerHTML=(data||[]).map(l=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(l.title||l.code)}</b> · ${TC.esc(l.board||'')} · uses ${l.uses||0}/${l.max_uses||'∞'} · <a href="exam-register.html?code=${encodeURIComponent(l.code)}">open form</a></div>`).join('')||'<p class="muted">No links yet.</p>';
  const r=await sb.from('exam_registrations').select('*').order('created_at',{ascending:false}).limit(40);
  document.getElementById('regs').innerHTML=(r.data||[]).map(x=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(x.full_name)}</b> · ${TC.esc(x.board)} ${TC.esc(x.series||'')} · ${TC.esc(x.subjects||'')} · ${x.photo_url?`<a href="${TC.esc(x.photo_url)}" target="_blank">passport</a>`:''}</div>`).join('')||'<p class="muted">None yet.</p>';
}
document.getElementById('mk').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const row={code:document.getElementById('code').value.trim(),title:document.getElementById('title').value,board:document.getElementById('board').value,series:document.getElementById('series').value,intro:document.getElementById('intro').value,expires_on:document.getElementById('exp').value||null,max_uses:Number(document.getElementById('max').value||0)||null,status:'open'};
  if(!row.code){toast('Need a code','warning');return;}
  const {error}=await sb.from('exam_reg_links').insert(row);
  if(error) toast(error.message,'danger'); else { toast('Link created','success'); document.getElementById('share').innerHTML='Share <code>exam-register.html?code='+TC.esc(row.code)+'</code>'; load(); }
};
document.addEventListener('DOMContentLoaded', load);
''')

# ---- SESSION COMPLETE ----
page('session-complete.html', 'Complete a class', 'Mark a booked class done, write feedback, tick SOW topics.',
     feature_card('After class — tutor marks complete',
                  'Pick a scheduled booking class, write what was taught, tick SOW topics covered. Feedback appears on parent and learner dashboards and feeds insights. Completing a linked session also deducts the hour bank.',
                  ['Pick the class', 'Write feedback + topics', 'Save — status becomes done', 'Parent/learner see it on the dashboard'],
                  [('bookings.html', 'Timetable'), ('sow.html', 'Scheme of work'), ('insights.html', 'Insights')]) + '''
      <div class="card">
        <div class="form-group"><label>Class</label><select class="form-select" id="cls"></select></div>
        <div class="form-group"><label>What was taught / feedback</label><textarea class="form-textarea" id="fb" rows="4"></textarea></div>
        <div class="form-group"><label>SOW topics covered (hold Ctrl/⌘ for several)</label><select class="form-select" id="topics" multiple size="6"></select></div>
        <button class="btn btn-primary" type="button" id="go">Mark complete</button>
      </div>
''', extra_js=r'''
async function boot(){
  if(!window.sb) return;
  const {data}=await sb.from('booking_classes').select('*').in('status',['scheduled','done']).order('scheduled_at').limit(80);
  document.getElementById('cls').innerHTML=(data||[]).map(c=>`<option value="${c.id}">Cycle ${c.cycle_no} · ${new Date(c.scheduled_at).toLocaleString()} · ${c.status}</option>`).join('');
  const t=await sb.from('sow_topics').select('id,topic,week_no').order('week_no').limit(200);
  document.getElementById('topics').innerHTML=(t.data||[]).map(x=>`<option value="${x.id}">W${x.week_no||'?'} · ${TC.esc(x.topic)}</option>`).join('');
}
document.getElementById('go').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const id=document.getElementById('cls').value;
  const ids=[...document.getElementById('topics').selectedOptions].map(o=>o.value);
  const {error}=await sb.from('booking_classes').update({
    status:'done', tutor_feedback:document.getElementById('fb').value,
    topics_covered:[...document.getElementById('topics').selectedOptions].map(o=>o.textContent).join('; '),
    sow_topic_ids: ids, completed_at: new Date().toISOString()
  }).eq('id', id);
  if(error) toast(error.message,'danger'); else toast('Class marked complete. Feedback is on parent and learner dashboards.','success');
};
document.addEventListener('DOMContentLoaded', boot);
''')

# ---- SOW ----
page('sow.html', 'Scheme of work', 'Term topics, coverage, per-learner evaluation, scoresheet push.',
     feature_card('Term scheme of work',
                  'At term start enter every subject topic. Follow coverage, evaluate each learner on each topic, push scores into the scoresheet. Groups share the topic list; scores stay individual.',
                  ['Create a term on an engagement', 'Add topics', 'Assign reading to the next topic', 'Evaluate each learner', 'Scores appear on the scoresheet'],
                  [('reading.html', 'Reading assignments'), ('session-complete.html', 'Tick after class'), ('scoresheet.html', 'Scoresheet')]) + '''
      <div class="card">
        <h3>New term</h3>
        <div class="grid grid-2">
          <div class="form-group"><label>Engagement</label><select class="form-select" id="eng"></select></div>
          <div class="form-group"><label>Subject</label><input class="form-input" id="subj"></div>
          <div class="form-group"><label>Term label</label><input class="form-input" id="term" placeholder="2026 Term 1"></div>
          <div class="form-group"><label>Starts</label><input class="form-input" id="st" type="date"></div>
        </div>
        <button class="btn btn-primary" type="button" id="mk-term">Create term</button>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Add topic</h3>
        <div class="grid grid-2">
          <div class="form-group"><label>Term</label><select class="form-select" id="term-sel"></select></div>
          <div class="form-group"><label>Week #</label><input class="form-input" id="wk" type="number"></div>
          <div class="form-group" style="grid-column:1/-1"><label>Topic</label><input class="form-input" id="topic"></div>
          <div class="form-group" style="grid-column:1/-1"><label>Objectives</label><textarea class="form-textarea" id="obj"></textarea></div>
        </div>
        <button class="btn btn-outline" type="button" id="mk-topic">Add topic</button>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Evaluate a learner</h3>
        <div class="grid grid-2">
          <div class="form-group"><label>Topic</label><select class="form-select" id="ev-topic"></select></div>
          <div class="form-group"><label>Learner</label><select class="form-select" id="ev-learner"></select></div>
          <div class="form-group"><label>Score %</label><input class="form-input" id="ev-score" type="number"></div>
          <div class="form-group"><label>Comment</label><input class="form-input" id="ev-c"></div>
        </div>
        <button class="btn btn-accent" type="button" id="mk-ev">Save evaluation (pushes scoresheet)</button>
      </div>
      <div id="sow-list" style="margin-top:12px"></div>
''', extra_js=r'''
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name').order('name');
  document.getElementById('eng').innerHTML=(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('');
  const t=await sb.from('sow_terms').select('*').order('created_at',{ascending:false});
  document.getElementById('term-sel').innerHTML=(t.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.term_label)} · ${TC.esc(x.subject)}</option>`).join('');
  const tp=await sb.from('sow_topics').select('*').order('week_no');
  document.getElementById('ev-topic').innerHTML=(tp.data||[]).map(x=>`<option value="${x.id}">W${x.week_no||'?'} · ${TC.esc(x.topic)}</option>`).join('');
  const l=await sb.from('learners').select('id,full_name,student_no').order('full_name');
  document.getElementById('ev-learner').innerHTML=(l.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.full_name)} · ${TC.esc(x.student_no||'')}</option>`).join('');
  document.getElementById('sow-list').innerHTML=(tp.data||[]).map(x=>`<div class="card" style="margin-bottom:8px"><b>Week ${x.week_no||'—'}</b> · ${TC.esc(x.topic)} · <span class="badge">${TC.esc(x.status)}</span></div>`).join('')||'<p class="muted">No topics yet.</p>';
}
document.getElementById('mk-term').onclick=async()=>{
  const {error}=await sb.from('sow_terms').insert({engagement_id:document.getElementById('eng').value||null,subject:document.getElementById('subj').value,term_label:document.getElementById('term').value,started_on:document.getElementById('st').value||null});
  if(error) toast(error.message,'danger'); else { toast('Term created','success'); boot(); }
};
document.getElementById('mk-topic').onclick=async()=>{
  const {error}=await sb.from('sow_topics').insert({term_id:document.getElementById('term-sel').value,week_no:Number(document.getElementById('wk').value||0),topic:document.getElementById('topic').value,objectives:document.getElementById('obj').value,status:'planned'});
  if(error) toast(error.message,'danger'); else { toast('Topic added','success'); boot(); }
};
document.getElementById('mk-ev').onclick=async()=>{
  const topic=document.getElementById('ev-topic').value, learner=document.getElementById('ev-learner').value, score=Number(document.getElementById('ev-score').value||0);
  const {error}=await sb.from('sow_evaluations').insert({topic_id:topic,learner_id:learner,score,comment:document.getElementById('ev-c').value});
  if(error){ toast(error.message,'danger'); return; }
  await sb.from('scoresheet').insert({learner_id:learner,source:'sow',source_id:topic,title:'SOW evaluation',score,max_score:100,pct:score,taken_on:new Date().toISOString().slice(0,10)});
  toast('Evaluation saved and pushed to the scoresheet','success');
};
document.addEventListener('DOMContentLoaded', boot);
''')

# ---- PRACTICE / QUIZ MANAGER ----
page('practice.html', 'Quizzes — Self / Review / Graded', 'Three quiz kinds. 17+15 types. Graded auto-pushes the scoresheet.',
     feature_card('Self, Review, Graded',
                  '<b>Self</b> = iterative practice, off the scoresheet. <b>Review</b> = diagnose after class, off the scoresheet. <b>Graded</b> = official paper; trigger <code>tc_push_cbt_to_scoresheet</code> writes the ledger. Learners sit with student ID TC-0001.',
                  ['Paste a CSV from a prompt pack (or write items)', 'Set kind + anti-cheat + code', 'Share the code', 'Learner opens Take quiz'],
                  [('cbt-exam.html', 'Take quiz'), ('cbt-prompts.html', 'Prompt packs'), ('cbt-multi.html', 'Multi-subject'), ('scoresheet.html', 'Scoresheet')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Title</label><input class="form-input" id="title"></div>
          <div class="form-group"><label>Code</label><input class="form-input" id="code" placeholder="ADC-MATH-01"></div>
          <div class="form-group"><label>Kind</label>
            <select class="form-select" id="kind"><option value="self">Self (practice)</option><option value="review">Review (after class)</option><option value="graded" selected>Graded (scoresheet)</option></select></div>
          <div class="form-group"><label>Duration (min)</label><input class="form-input" id="mins" type="number" value="40"></div>
          <div class="form-group"><label>Subject</label><input class="form-input" id="subj"></div>
          <div class="form-group"><label>Engagement</label><select class="form-select" id="eng"></select></div>
          <div class="form-group" style="grid-column:1/-1"><label>Questions CSV</label><textarea class="form-textarea" id="csv" rows="8" placeholder="question,type,subject,a,b,c,d,answer,mark,explanation"></textarea></div>
        </div>
        <label><input type="checkbox" id="tab" checked> Tab-focus watch</label>
        <label><input type="checkbox" id="copy" checked> Block copy</label>
        <p><button class="btn btn-primary" type="button" id="save">Save quiz</button>
           <button class="btn btn-outline" type="button" id="parse">Parse CSV preview</button></p>
        <div id="prev"></div>
      </div>
      <h3 style="margin-top:16px">Saved quizzes</h3><div id="list"></div>
''', extra_js=r'''
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name').order('name');
  document.getElementById('eng').innerHTML='<option value=""></option>'+(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('');
  const q=await sb.from('cbt_exams').select('id,title,code,quiz_kind,status').order('created_at',{ascending:false}).limit(40);
  document.getElementById('list').innerHTML=(q.data||[]).map(x=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(x.title)}</b> · code <code>${TC.esc(x.code||'')}</code> · ${TC.esc(x.quiz_kind)} · <a href="cbt-exam.html">sit</a></div>`).join('')||'<p class="muted">None yet.</p>';
}
document.getElementById('parse').onclick=()=>{
  const qs=CBT.parseCSV(document.getElementById('csv').value);
  document.getElementById('prev').innerHTML='<p>'+qs.length+' questions · types: '+[...new Set(qs.map(q=>q.type))].join(', ')+'</p>';
};
document.getElementById('save').onclick=async()=>{
  const qs=CBT.parseCSV(document.getElementById('csv').value);
  if(!qs.length){toast('Paste a CSV (or use a prompt pack).','warning');return;}
  if(!window.sb){toast('Preview only. Connect Supabase to save.','warning');return;}
  const {error}=await sb.from('cbt_exams').insert({
    title:document.getElementById('title').value, code:document.getElementById('code').value,
    quiz_kind:document.getElementById('kind').value, duration_min:Number(document.getElementById('mins').value||40),
    subject:document.getElementById('subj').value, engagement_id:document.getElementById('eng').value||null,
    questions:qs, anti_cheat:{tab_focus:document.getElementById('tab').checked,block_copy:document.getElementById('copy').checked},
    push_to_scoresheet: document.getElementById('kind').value==='graded', status:'open', show_review:true
  });
  if(error) toast(error.message,'danger'); else { toast('Quiz saved. Share the code.','success'); boot(); }
};
document.addEventListener('DOMContentLoaded', boot);
''')

# ---- CBT PROMPTS ----
page('cbt-prompts.html', 'Question bank prompts', 'Copy-paste packs for any free chat. No AI API.',
     feature_card('Ten prompt packs — you paste them into a free chat',
                  'Simple, Intermediate, Advanced, Auto-Graded Ultimate Pack, Self, Review, Graded, Reading article, Reading video, Reading pack. The studio never calls a paid model.',
                  ['Pick a pack + topic + count', 'Copy the prompt', 'Paste into ChatGPT / Gemini / Claude (your account)', 'Paste the CSV back into Quizzes'],
                  [('practice.html', 'Save the CSV as a quiz'), ('reading.html', 'Reading assignments')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Pack</label>
            <select class="form-select" id="pack">
              <option value="simple">Simple (MCQ + T/F)</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="enterprise">Auto-Graded Ultimate Pack</option>
              <option value="self">Self-Quiz</option>
              <option value="review">Review-Quiz</option>
              <option value="graded">Graded-Quiz</option>
              <option value="reading_article">Reading — article</option>
              <option value="reading_video">Reading — video</option>
              <option value="reading_pack">Reading — pack</option>
            </select></div>
          <div class="form-group"><label>Topic</label><input class="form-input" id="topic" value="Quadratic equations"></div>
          <div class="form-group"><label>Count</label><input class="form-input" id="n" type="number" value="10"></div>
          <div class="form-group"><label>Level / class</label><input class="form-input" id="lv" value="IGCSE / SS2"></div>
          <div class="form-group" style="grid-column:1/-1"><label>Source link (for reading packs)</label><input class="form-input" id="src" placeholder="https://… or Drive / YouTube"></div>
        </div>
        <button class="btn btn-primary" type="button" id="build">Build prompt</button>
        <button class="btn btn-outline" type="button" id="copy">Copy</button>
        <textarea class="form-textarea" id="out" rows="16" style="margin-top:12px"></textarea>
      </div>
''', extra_js=r'''
function build(){
  document.getElementById('out').value = CBT.promptPack(
    document.getElementById('pack').value,
    document.getElementById('topic').value,
    Number(document.getElementById('n').value||10),
    document.getElementById('lv').value,
    { source: document.getElementById('src').value }
  );
}
document.getElementById('build').onclick=build;
document.getElementById('copy').onclick=async()=>{ await navigator.clipboard.writeText(document.getElementById('out').value); toast('Copied — paste into any free chat','success'); };
document.addEventListener('DOMContentLoaded', build);
''')

# ---- READING ----
page('reading.html', 'Reading assignments', 'Pre-class article/video/PDF/playlist links tied to the next SOW topic.',
     feature_card('Read → Self-Quiz → class',
                  'Assign https / Drive / YouTube links. Learners tick items. Then sit a Self-Quiz. Nothing is uploaded into Postgres.',
                  ['Pick engagement + SOW topic', 'Add article/video/PDF links', 'Learner ticks done', 'Self-Quiz checks they actually read'],
                  [('sow.html', 'Topics'), ('practice.html', 'Self-Quiz'), ('cbt-prompts.html', 'Reading prompts')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Engagement</label><select class="form-select" id="eng"></select></div>
          <div class="form-group"><label>SOW topic</label><select class="form-select" id="topic"></select></div>
          <div class="form-group"><label>Title</label><input class="form-input" id="title"></div>
          <div class="form-group"><label>Due</label><input class="form-input" id="due" type="date"></div>
          <div class="form-group"><label>Item title</label><input class="form-input" id="it"></div>
          <div class="form-group"><label>Kind</label><select class="form-select" id="kind"><option>article</option><option>video</option><option>pdf</option><option>playlist</option></select></div>
          <div class="form-group" style="grid-column:1/-1"><label>URL</label><input class="form-input" id="url" placeholder="https:// or Drive / YouTube"></div>
        </div>
        <div id="prev"></div>
        <button class="btn btn-primary" type="button" id="save">Save assignment + item</button>
      </div>
      <div id="list" style="margin-top:12px"></div>
''', extra_js=r'''
document.getElementById('url').onchange=function(){ if(window.Media) document.getElementById('prev').innerHTML=Media.card(this.value,'Preview'); };
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name');
  document.getElementById('eng').innerHTML=(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('');
  const t=await sb.from('sow_topics').select('id,topic,week_no');
  document.getElementById('topic').innerHTML='<option value=""></option>'+(t.data||[]).map(x=>`<option value="${x.id}">W${x.week_no||'?'} · ${TC.esc(x.topic)}</option>`).join('');
  const a=await sb.from('reading_assignments').select('*').order('created_at',{ascending:false}).limit(20);
  document.getElementById('list').innerHTML=(a.data||[]).map(x=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(x.title)}</b> · due ${x.due_on||'—'} · ${x.status}</div>`).join('')||'<p class="muted">None yet.</p>';
}
document.getElementById('save').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const {data,error}=await sb.from('reading_assignments').insert({engagement_id:document.getElementById('eng').value||null,sow_topic_id:document.getElementById('topic').value||null,title:document.getElementById('title').value,due_on:document.getElementById('due').value||null,status:'open'}).select().single();
  if(error){toast(error.message,'danger');return;}
  const u=document.getElementById('url').value;
  if(u) await sb.from('reading_items').insert({assignment_id:data.id,kind:document.getElementById('kind').value,title:document.getElementById('it').value||document.getElementById('title').value,url:u});
  toast('Reading assignment saved','success'); boot();
};
document.addEventListener('DOMContentLoaded', boot);
''')

# ---- FORUM ----
page('forum.html', 'Group forum', 'Discussion threads scoped to a group engagement only.',
     feature_card('Group forum — not for 1:1',
                  'Only <b>group</b> engagements have a forum. Tutor or learner can open a thread; everyone in that group can reply. 1:1 contracts stay private.',
                  ['Pick a group engagement', 'Open a thread', 'Reply', 'Pin important threads'],
                  [('groups.html', 'Groups'), ('stream.html', 'Class stream')]) + '''
      <div class="card">
        <div class="form-group"><label>Group engagement</label><select class="form-select" id="eng"></select></div>
        <div class="form-group"><label>Thread title</label><input class="form-input" id="title"></div>
        <div class="form-group"><label>First post</label><textarea class="form-textarea" id="body"></textarea></div>
        <button class="btn btn-primary" type="button" id="mk">Open thread</button>
      </div>
      <div id="threads" style="margin-top:12px"></div>
''', extra_js=r'''
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name,kind').eq('kind','group');
  document.getElementById('eng').innerHTML=(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('')||'<option value="">No group engagements yet</option>';
  const t=await sb.from('forum_threads').select('*').order('created_at',{ascending:false}).limit(30);
  document.getElementById('threads').innerHTML=(t.data||[]).map(x=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(x.title)}</b><p>${TC.esc(x.body||'')}</p><small>${TC.esc(x.author_name||'')} · ${x.created_at||''}</small></div>`).join('')||'<p class="muted">No threads. Forums only exist on group engagements.</p>';
}
document.getElementById('mk').onclick=async()=>{
  if(!document.getElementById('eng').value){toast('Create a group engagement first.','warning');return;}
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const p=window.TC_PROFILE||{};
  const {error}=await sb.from('forum_threads').insert({engagement_id:document.getElementById('eng').value,title:document.getElementById('title').value,body:document.getElementById('body').value,author_name:p.full_name||'Member',author_role:p.role||'learner'});
  if(error) toast(error.message,'danger'); else { toast('Thread opened','success'); boot(); }
};
document.addEventListener('DOMContentLoaded', boot);
''')

# ---- STREAM / CLASSWORK ----
page('stream.html', 'Class stream', 'Google Classroom-style feed. Link previews only. No Gemini.',
     feature_card('Stream — announcements, questions, materials, scheduled posts',
                  'Classroom-style feed per engagement. Schedule a post with publish_at. Media is a link with a thumbnail. Comment-only return lives on Classwork.',
                  ['Pick an engagement', 'Post announcement / question / material', 'Optional future publish time', 'Learners see it on their stream'],
                  [('classwork.html', 'Classwork by topic'), ('forum.html', 'Group forum')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Engagement</label><select class="form-select" id="eng"></select></div>
          <div class="form-group"><label>Kind</label><select class="form-select" id="kind"><option>announcement</option><option>question</option><option>material</option></select></div>
          <div class="form-group"><label>Title</label><input class="form-input" id="title"></div>
          <div class="form-group"><label>Publish at</label><input class="form-input" id="at" type="datetime-local"></div>
          <div class="form-group" style="grid-column:1/-1"><label>Body</label><textarea class="form-textarea" id="body"></textarea></div>
          <div class="form-group" style="grid-column:1/-1"><label>Media URL</label><input class="form-input" id="media"></div>
        </div>
        <div id="prev"></div>
        <button class="btn btn-primary" type="button" id="post">Post to stream</button>
      </div>
      <div id="feed" style="margin-top:12px"></div>
''', extra_js=r'''
document.getElementById('media').onchange=function(){ if(window.Media) document.getElementById('prev').innerHTML=Media.card(this.value,'Preview'); };
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name');
  document.getElementById('eng').innerHTML=(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('');
  const p=await sb.from('stream_posts').select('*').order('publish_at',{ascending:false}).limit(30);
  document.getElementById('feed').innerHTML=(p.data||[]).map(x=>`<article class="card" style="margin-bottom:8px"><div class="muted">${TC.esc(x.kind)} · ${x.publish_at||''}</div><h3>${TC.esc(x.title||'')}</h3><p>${TC.esc(x.body||'')}</p>${x.media_url&&window.Media?Media.card(x.media_url,''):''}</article>`).join('')||'<p class="muted">Empty stream.</p>';
}
document.getElementById('post').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const {error}=await sb.from('stream_posts').insert({engagement_id:document.getElementById('eng').value||null,kind:document.getElementById('kind').value,title:document.getElementById('title').value,body:document.getElementById('body').value,media_url:document.getElementById('media').value,publish_at:document.getElementById('at').value||new Date().toISOString()});
  if(error) toast(error.message,'danger'); else { toast('Posted','success'); boot(); }
};
document.addEventListener('DOMContentLoaded', boot);
''')

page('classwork.html', 'Classwork', 'Work organised by topic. Comment-only return, skills tags. No Gemini.',
     feature_card('Classwork by topic',
                  'Assignments, quizzes and materials grouped by SOW topic. Comment-only return (no grade) is supported. Skills tags help Insights. Links only.',
                  ['Pick engagement + topic', 'Add item (assignment / quiz / material)', 'Optional points and skills', 'Learner submits a Drive link'],
                  [('stream.html', 'Stream'), ('assignments.html', 'Homework'), ('sow.html', 'Topics')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Engagement</label><select class="form-select" id="eng"></select></div>
          <div class="form-group"><label>Topic</label><input class="form-input" id="topic"></div>
          <div class="form-group"><label>Kind</label><select class="form-select" id="kind"><option>assignment</option><option>quiz</option><option>material</option></select></div>
          <div class="form-group"><label>Title</label><input class="form-input" id="title"></div>
          <div class="form-group"><label>Due</label><input class="form-input" id="due" type="date"></div>
          <div class="form-group"><label>Points (blank = comment only)</label><input class="form-input" id="pts" type="number"></div>
          <div class="form-group"><label>Skills tags</label><input class="form-input" id="skills" placeholder="algebra, exam-technique"></div>
          <div class="form-group"><label>Material URL</label><input class="form-input" id="media"></div>
        </div>
        <button class="btn btn-primary" type="button" id="save">Add classwork</button>
      </div>
      <div id="list" style="margin-top:12px"></div>
''', extra_js=r'''
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name');
  document.getElementById('eng').innerHTML=(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('');
  const r=await sb.from('classwork_items').select('*').order('created_at',{ascending:false}).limit(40);
  document.getElementById('list').innerHTML=(r.data||[]).map(x=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(x.title)}</b> · ${TC.esc(x.topic||'')} · ${x.points==null?'comment only':(x.points+' pts')} · ${TC.esc(x.skills||'')}</div>`).join('')||'<p class="muted">No classwork yet.</p>';
}
document.getElementById('save').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const pts=document.getElementById('pts').value;
  const {error}=await sb.from('classwork_items').insert({engagement_id:document.getElementById('eng').value||null,topic:document.getElementById('topic').value,kind:document.getElementById('kind').value,title:document.getElementById('title').value,due_on:document.getElementById('due').value||null,points:pts===''?null:Number(pts),skills:document.getElementById('skills').value,media_url:document.getElementById('media').value});
  if(error) toast(error.message,'danger'); else { toast('Classwork added','success'); boot(); }
};
document.addEventListener('DOMContentLoaded', boot);
''')

# ---- SCORESHEET / INSIGHTS / 360 ----
page('scoresheet.html', 'Scoresheet', 'Single ledger of graded quizzes, SOW evaluations and homework.',
     feature_card('One ledger, family-safe',
                  'Graded quizzes auto-push via trigger. SOW evaluations and homework can be added here. Parents see only linked children. Learners see only themselves.',
                  None, [('practice.html', 'Graded quizzes'), ('sow.html', 'SOW evaluations'), ('learner-360.html', 'Learner 360')]) + '''
      <div id="sheet"></div>
''', extra_js=r'''
document.addEventListener('DOMContentLoaded', async () => {
  const box=document.getElementById('sheet');
  if(!window.sb){ box.innerHTML='<p class="muted">Connect Supabase to load the scoresheet. Preview: Graded quizzes push here automatically.</p>'; return; }
  const q=new URLSearchParams(location.search).get('learner');
  let qry=sb.from('scoresheet').select('*').order('taken_on',{ascending:false}).limit(80);
  if(q) qry=qry.eq('learner_id', q);
  const {data,error}=await qry;
  if(error){ box.innerHTML='<p class="muted">'+TC.esc(error.message)+'</p>'; return; }
  box.innerHTML='<div class="table-wrap"><table><thead><tr><th>Date</th><th>Title</th><th>Subject</th><th>Score</th><th>%</th><th>Source</th></tr></thead><tbody>'+
    (data||[]).map(r=>`<tr><td>${r.taken_on||''}</td><td>${TC.esc(r.title||'')}</td><td>${TC.esc(r.subject||'')}</td><td>${r.score||0}/${r.max_score||0}</td><td><b>${r.pct||0}%</b></td><td>${TC.esc(r.source||'')}</td></tr>`).join('')+
    '</tbody></table></div>' || '<p class="muted">No scores yet.</p>';
});
''')

page('insights.html', 'Insights Lab', 'Value-added, OLS prediction, six at-risk rules. Formulas you can read.',
     feature_card('Heavy insights — still free',
                  'Value-added = current − baseline. Prediction = ordinary least squares on the last N scores × fortnights to the exam. Six at-risk rules are listed on the dashboard. No AI API.',
                  None, [('learner-360.html', 'One learner'), ('at-risk.html', 'Rule board'), ('predictions.html', 'OLS forecast'), ('value-added.html', 'Baseline delta')]) + '''
      <div class="grid grid-2">
        <article class="card"><h3>Score trajectory</h3><div id="line"></div></article>
        <article class="card"><h3>Flags</h3><div id="flags"></div>
          <p class="muted">attendance &lt; 80% · idle ≥ 14d · hours &lt; 2 · homework &lt; 60% · last 3 declining · &gt;40% topics &lt; 50%</p></article>
      </div>
      <article class="card" style="margin-top:12px"><h3>Methodology</h3><pre id="meth" style="white-space:pre-wrap"></pre></article>
''', extra_js=r'''
document.addEventListener('DOMContentLoaded', () => {
  const demo = Insights.demoContext();
  Insights.svgLine(document.getElementById('line'), demo.scores);
  const flags = Insights.flags(demo);
  document.getElementById('flags').innerHTML = flags.map(f => '<span class="badge badge-'+(f.level==='bad'?'bad':'warn')+'">'+TC.esc(f.text)+'</span>').join(' ') || '<span class="muted">No flags on the sample.</span>';
  document.getElementById('meth').textContent = Insights.methodology ? Insights.methodology(demo) : 'value_added = current_avg - baseline\\nprediction = OLS(last N scores) projected to exam date\\nat-risk = 6 transparent rules in insights.js';
});
''')

page('learner-360.html', 'Learner 360', 'Identity, engagements, hours, scores, mastery, flags, invoices.',
     feature_card('One child, one page',
                  'Family-safe. A parent only opens their own children. A group average never hides this child.',
                  None, [('scoresheet.html', 'Scoresheet'), ('bookings.html', 'Classes'), ('insights.html', 'Insights')]) + '''
      <div class="form-group"><label>Learner</label><select class="form-select" id="who"></select></div>
      <div id="p360"></div>
''', extra_js=r'''
async function paint(id){
  const box=document.getElementById('p360');
  if(!window.sb || !id){ box.innerHTML='<p class="muted">Connect Supabase and pick a learner. Preview uses Insights sample flags.</p>'; return; }
  const {data:l}=await sb.from('learners').select('*').eq('id',id).maybeSingle();
  const sc=await sb.from('scoresheet').select('*').eq('learner_id',id).order('taken_on',{ascending:false}).limit(8);
  const em=await sb.from('engagement_members').select('engagement_id,status').eq('learner_id',id);
  box.innerHTML=`<div class="card"><h2>${TC.esc(l.full_name||'')} · ${TC.esc(l.student_no||'')}</h2>
    <p>${TC.esc(l.year_group||'')} · ${TC.esc(l.timezone||'')} · ${TC.esc(l.school_name||'')}</p>
    <p>${TC.esc(l.learning_style||'')}</p>
    <h3>Recent scores</h3>${(sc.data||[]).map(s=>`<div>${s.taken_on} · ${TC.esc(s.title||'')} · <b>${s.pct||0}%</b></div>`).join('')||'<p class="muted">None</p>'}
    <h3>Engagements</h3><p>${(em.data||[]).length} seat(s)</p>
    <p><a class="btn btn-outline" href="scoresheet.html?learner=${id}">Full scoresheet</a>
       <a class="btn btn-outline" href="bookings.html?learner=${id}">Classes</a></p></div>`;
}
document.addEventListener('DOMContentLoaded', async () => {
  if(!window.sb) return;
  const {data}=await sb.from('learners').select('id,full_name,student_no').order('full_name');
  const sel=document.getElementById('who');
  sel.innerHTML=(data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.full_name)} · ${TC.esc(x.student_no||'')}</option>`).join('');
  const q=new URLSearchParams(location.search).get('learner');
  if(q) sel.value=q;
  sel.onchange=()=>paint(sel.value);
  if(sel.value) paint(sel.value);
});
''')

# ---- ADMIN DATA / HEALTH ----
page('admin-data.html', 'Admin data', 'Backup, restore, Drive sync, table browser. SHA-256 sealed.',
     feature_card('Data sovereignty',
                  'Local JSON backup/restore, portable sealed archives, Google Drive sync (GIS + drive.file). Never upload source files into the 500 MB database. See docs/GOOGLE-DRIVE-SYNC-GUIDE.md.',
                  ['Export a sealed archive', 'Optionally sync to Drive', 'Restore into the same or a new project'],
                  [('platform-health.html', 'Health'), ('storage.html', 'Storage'), ('activity-log.html', 'Audit')]) + '''
      <div class="card" id="port-root"><p class="muted">Data portability engine loads with the page. Use the buttons it injects, or call DataPortability from the console.</p></div>
      <div class="card" style="margin-top:12px" id="drive-root"></div>
''', extra_js=r'''
document.addEventListener('DOMContentLoaded', () => {
  try { if (window.DataPortability) DataPortability.init(window.sb); } catch(e) {}
  try { if (window.DriveSync && DriveSync.renderPanel) DriveSync.renderPanel(document.getElementById('drive-root')); } catch(e) {}
});
''', require='admin')

page('platform-health.html', 'Platform health', 'Keep-alive, DB size, Drive, license, idle lock, lockdown, login audit.',
     feature_card('Owner cockpit',
                  'If every tile is green the studio is healthy. Heartbeat writes tc_heartbeat via tc_keep_alive. Idle lock and emergency lockdown live in practice_settings.',
                  None, [('admin-data.html', 'Backups'), ('settings.html', 'Settings'), ('license.html', 'License')]) + '''
      <div class="grid grid-3">
        <div class="stat-card"><div class="stat-value" id="hb">—</div><div class="stat-label">Last heartbeat</div></div>
        <div class="stat-card"><div class="stat-value" id="pc">—</div><div class="stat-label">Ping count</div></div>
        <div class="stat-card"><div class="stat-value" id="src">—</div><div class="stat-label">Last source</div></div>
      </div>
      <p style="margin-top:12px">
        <button class="btn btn-primary" type="button" id="ping">💓 Manual heartbeat</button>
        <button class="btn btn-outline" type="button" id="lock">🚨 Toggle lockdown</button>
      </p>
      <div id="audit" style="margin-top:12px"></div>
''', extra_js=r'''
async function load(){
  if(!window.sb){ document.getElementById('hb').textContent='offline'; return; }
  const {data}=await sb.from('tc_heartbeat').select('*').eq('id',1).maybeSingle();
  if(data){ document.getElementById('hb').textContent=new Date(data.last_ping).toLocaleString(); document.getElementById('pc').textContent=data.ping_count; document.getElementById('src').textContent=data.last_source||'—'; }
  const a=await sb.from('login_audit').select('*').order('created_at',{ascending:false}).limit(12);
  document.getElementById('audit').innerHTML='<h3>Login audit</h3>'+(a.data||[]).map(x=>`<div>${x.created_at||''} · ${TC.esc(x.email||'')} · ${TC.esc(x.event||'')}</div>`).join('')||'<p class="muted">No audit rows (run v4 schema).</p>';
}
document.getElementById('ping').onclick=async()=>{
  if(!window.sb) return;
  await sb.rpc('tc_keep_alive',{src:'manual'});
  toast('Heartbeat written','success'); load();
};
document.getElementById('lock').onclick=async()=>{
  if(!window.sb) return;
  const {data}=await sb.from('practice_settings').select('lockdown_mode').eq('id',1).maybeSingle();
  const next=!(data&&data.lockdown_mode);
  await sb.from('practice_settings').upsert({id:1,lockdown_mode:next});
  toast(next?'Lockdown ON — non-admins are blocked':'Lockdown OFF','warning');
};
document.addEventListener('DOMContentLoaded', load);
''', require='admin')

# ---- APPLICATION LINKS ----
page('application-links.html', 'Application links', 'Expiring, limited-use codes for a subject, 1:1 or group.',
     feature_card('Robust application URLs',
                  'Each code has its own copy, expiry, max uses and counter. Public form is apply.html?code=',
                  ['Create a code', 'Share the URL', 'Parent submits', 'RPC increments uses and writes inquiries'],
                  [('apply.html', 'Public form'), ('inquiries.html', 'Pipeline')]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Code</label><input class="form-input" id="code" placeholder="igcse-maths"></div>
          <div class="form-group"><label>Title</label><input class="form-input" id="title"></div>
          <div class="form-group"><label>Subject</label><input class="form-input" id="subj"></div>
          <div class="form-group"><label>Kind</label><select class="form-select" id="kind"><option value="one_on_one">1:1</option><option value="group">Group</option></select></div>
          <div class="form-group"><label>Expires</label><input class="form-input" id="exp" type="date"></div>
          <div class="form-group"><label>Max uses</label><input class="form-input" id="max" type="number"></div>
          <div class="form-group" style="grid-column:1/-1"><label>Intro</label><textarea class="form-textarea" id="intro"></textarea></div>
        </div>
        <button class="btn btn-primary" type="button" id="mk">Create link</button>
        <p id="share"></p>
      </div>
      <div id="list" style="margin-top:12px"></div>
''', extra_js=r'''
async function load(){
  if(!window.sb) return;
  const {data}=await sb.from('application_links').select('*').order('created_at',{ascending:false});
  document.getElementById('list').innerHTML=(data||[]).map(l=>`<div class="card" style="margin-bottom:8px"><b>${TC.esc(l.title)}</b> · <code>${TC.esc(l.code)}</code> · ${l.uses||0}/${l.max_uses||'∞'} · <a href="apply.html?code=${encodeURIComponent(l.code)}">open</a></div>`).join('')||'<p class="muted">None yet.</p>';
}
document.getElementById('mk').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const row={code:document.getElementById('code').value.trim(),title:document.getElementById('title').value,subject:document.getElementById('subj').value,kind:document.getElementById('kind').value,intro:document.getElementById('intro').value,expires_on:document.getElementById('exp').value||null,max_uses:Number(document.getElementById('max').value||0)||null,status:'open'};
  const {error}=await sb.from('application_links').insert(row);
  if(error) toast(error.message,'danger'); else { toast('Link created','success'); document.getElementById('share').innerHTML='Share <a href="apply.html?code='+encodeURIComponent(row.code)+'">apply.html?code='+TC.esc(row.code)+'</a>'; load(); }
};
document.addEventListener('DOMContentLoaded', load);
''')

print('specials written')
print('exam-register', (ROOT/'exam-register.html').exists(), (ROOT/'exam-register.html').stat().st_size if (ROOT/'exam-register.html').exists() else 0)
