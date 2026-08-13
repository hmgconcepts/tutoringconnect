#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/user/tutoring-connect/tools')
from rebuild_pages import page, feature_card

page('reminders.html', 'Lesson reminders + calendar',
     'Free WhatsApp/email/SMS compose and .ics download for Google, Outlook and Apple Calendar. No paid Calendar API.',
     feature_card('Reminders the paid tools charge for',
                  'TutorBird and Teachworks bill for SMS/email reminders and Google Calendar sync. Here: compose <code>wa.me</code> / <code>mailto:</code> / <code>sms:</code> with date, time and duration already written, and download a standard <b>.ics</b> that Google, Outlook and Apple import. No Calendar API.',
                  ['Page loads scheduled 4-cycle classes', 'Compose WhatsApp / email / SMS', 'Download .ics and import', 'Parents can download the same file'],
                  [('bookings.html', 'Cycle bookings'), ('calendar.html', 'Calendar'), ('messages.html', 'Free channels')]) + '''
      <p>
        <button class="btn btn-primary" type="button" id="dl">Download .ics (next classes)</button>
        <button class="btn btn-outline" type="button" id="wa">WhatsApp reminder</button>
        <button class="btn btn-outline" type="button" id="em">Email reminder</button>
        <button class="btn btn-outline" type="button" id="sm">SMS reminder</button>
      </p>
      <div id="list" class="muted">Loading scheduled classes…</div>
''', extra_js=r'''
let rows=[];
function line(c){
  const when=new Date(c.scheduled_at);
  return 'Cycle '+c.cycle_no+' · class '+c.seq_in_cycle+' · '+when.toLocaleString()+' · '+(c.duration_minutes||60)+' min · '+c.status;
}
async function load(){
  const box=document.getElementById('list');
  if(!window.sb){ box.innerHTML='<p>Connect Supabase to load live classes. You can still test .ics from a sample.</p>';
    rows=[{id:'demo',cycle_no:1,seq_in_cycle:1,scheduled_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:60,status:'scheduled'}];
    box.innerHTML=rows.map(c=>'<div class="card" style="margin:8px 0">'+line(c)+'</div>').join(''); return; }
  const {data}=await sb.from('booking_classes').select('*').eq('status','scheduled').order('scheduled_at').limit(40);
  rows=data||[];
  box.innerHTML=rows.length?rows.map(c=>'<div class="card" style="margin:8px 0">'+line(c)+'</div>').join(''):'<p>No scheduled classes. Create a 4-cycle booking first.</p>';
}
function body(){
  const p=(window.PRACTICE&&PRACTICE.name)||'ADEWALE CLASSROOM';
  return p+' — upcoming classes:\n'+rows.slice(0,8).map(line).join('\n')+'\nPlease confirm or reply if you need a makeup.';
}
document.getElementById('dl').onclick=async()=>{
  if(!window.ICS){toast('ics.js missing','danger');return;}
  const ics=await ICS.fromBookingClasses(rows);
  ICS.download(ics,'tutoring-classes.ics');
  toast('Imported into Google Calendar via Settings → Import','success');
};
document.getElementById('wa').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(body()));
document.getElementById('em').onclick=()=>window.open('mailto:?subject='+encodeURIComponent('Class reminder')+'&body='+encodeURIComponent(body()));
document.getElementById('sm').onclick=()=>window.open('sms:?body='+encodeURIComponent(body()));
document.addEventListener('DOMContentLoaded', load);
''')

page('study-log.html', 'Study log / session timer',
     'Learner timer for minutes on task. TutorBird study-log parity. No AI.',
     feature_card('Minutes on task, not just class time',
                  'TutorBird ships a study log with a timer. Learners start/stop here per subject. Rows are per learner — never smeared across a group. Feeds diligence on Learner 360.',
                  ['Pick subject / topic', 'Start. Study. Stop.', 'Save notes', 'Tutor reviews on 360'],
                  [('flashcards.html', 'Spaced cards'), ('reading.html', 'Reading'), ('learner-360.html', '360')]) + '''
      <div class="card" style="max-width:560px">
        <div class="form-group"><label>Learner</label><select class="form-select" id="who"></select></div>
        <div class="form-group"><label>Subject / topic</label><input class="form-input" id="topic" placeholder="Quadratic equations"></div>
        <div class="stat-card"><div class="stat-value" id="clock">00:00</div><div class="stat-label">Elapsed</div></div>
        <p>
          <button class="btn btn-primary" type="button" id="start">Start</button>
          <button class="btn btn-outline" type="button" id="stop">Stop &amp; save</button>
        </p>
        <div class="form-group"><label>Notes</label><textarea class="form-textarea" id="notes"></textarea></div>
      </div>
      <div id="log" style="margin-top:12px"></div>
''', extra_js=r'''
let t0=0, tick=null, elapsed=0;
function fmt(ms){ const s=Math.floor(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
async function boot(){
  if(!window.sb) return;
  const {data}=await sb.from('learners').select('id,full_name,student_no').order('full_name');
  document.getElementById('who').innerHTML=(data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.full_name)} · ${TC.esc(x.student_no||'')}</option>`).join('');
  const q=new URLSearchParams(location.search).get('learner'); if(q) document.getElementById('who').value=q;
  list();
}
async function list(){
  if(!window.sb){ document.getElementById('log').innerHTML='<p class="muted">Connect Supabase to persist the log. The timer still works in this browser.</p>'; return; }
  const id=document.getElementById('who').value;
  let q=sb.from('study_logs').select('*').order('started_at',{ascending:false}).limit(20);
  if(id) q=q.eq('learner_id', id);
  const {data}=await q;
  document.getElementById('log').innerHTML=(data||[]).map(r=>`<div class="card" style="margin:8px 0"><b>${r.minutes||0} min</b> · ${TC.esc(r.topic||'')} · ${r.started_at||''}<div class="muted">${TC.esc(r.notes||'')}</div></div>`).join('')||'<p class="muted">No study blocks yet.</p>';
}
document.getElementById('start').onclick=()=>{ t0=Date.now(); clearInterval(tick); tick=setInterval(()=>{ elapsed=Date.now()-t0; document.getElementById('clock').textContent=fmt(elapsed); },250); };
document.getElementById('stop').onclick=async()=>{
  clearInterval(tick);
  const minutes=Math.max(1, Math.round(elapsed/60000));
  if(!window.sb){ toast('Preview: '+minutes+' min. Connect Supabase to save.','warning'); return; }
  const {error}=await sb.from('study_logs').insert({learner_id:document.getElementById('who').value||null,topic:document.getElementById('topic').value,minutes,notes:document.getElementById('notes').value,started_at:new Date(t0||Date.now()).toISOString()});
  if(error) toast(error.message,'danger'); else { toast('Saved '+minutes+' min','success'); list(); }
};
document.addEventListener('DOMContentLoaded', boot);
document.getElementById('who').onchange=list;
''')

page('makeup-credits.html', 'Makeup credit bank',
     'When the studio cancels, the family earns a credit on that engagement. Spent on a makeup. Never smeared across siblings.',
     feature_card('Makeup credits — TutorBird parity, free',
                  'When WE cancel inside policy, add a +credit on this engagement. When you deliver the makeup, add a −credit. Separate from prepaid hour banks. Siblings never share a credit.',
                  ['Studio cancels → +1 credit on the engagement', 'Run the makeup → −1 credit + create the session', 'Balance = sum of deltas'],
                  [('makeups.html', 'Make-up sessions'), ('cancellations.html', 'Cancellations'), ['bookings.html', 'Cycle bookings']]) + '''
      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Engagement</label><select class="form-select" id="eng"></select></div>
          <div class="form-group"><label>Delta</label>
            <select class="form-select" id="delta"><option value="1">+1 credit (we cancelled)</option><option value="-1">−1 credit (makeup taken)</option></select></div>
          <div class="form-group" style="grid-column:1/-1"><label>Reason</label><input class="form-input" id="reason" placeholder="Tutor ill / makeup delivered 13 Aug"></div>
        </div>
        <button class="btn btn-primary" type="button" id="save">Post to ledger</button>
        <h3 style="margin-top:16px">Balance: <span id="bal">—</span></h3>
      </div>
      <div id="list" style="margin-top:12px"></div>
''', extra_js=r'''
async function boot(){
  if(!window.sb) return;
  const e=await sb.from('engagements').select('id,name').order('name');
  document.getElementById('eng').innerHTML=(e.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.name)}</option>`).join('');
  list();
}
async function list(){
  if(!window.sb) return;
  const id=document.getElementById('eng').value;
  const {data}=await sb.from('makeup_credits').select('*').eq('engagement_id',id).order('created_at',{ascending:false});
  const bal=(data||[]).reduce((a,r)=>a+Number(r.delta||0),0);
  document.getElementById('bal').textContent=bal;
  document.getElementById('list').innerHTML=(data||[]).map(r=>`<div class="card" style="margin:8px 0">${r.delta>0?'+':''}${r.delta} · ${TC.esc(r.reason||'')} · ${r.created_at||''}</div>`).join('')||'<p class="muted">No credits yet on this engagement.</p>';
}
document.getElementById('save').onclick=async()=>{
  if(!window.sb){toast('Connect Supabase','warning');return;}
  const {error}=await sb.from('makeup_credits').insert({engagement_id:document.getElementById('eng').value,delta:Number(document.getElementById('delta').value),reason:document.getElementById('reason').value});
  if(error) toast(error.message,'danger'); else { toast('Ledger updated','success'); list(); }
};
document.addEventListener('DOMContentLoaded', boot);
document.getElementById('eng').onchange=list;
''')

page('public-book.html', 'Public self-booking',
     'Parents pick an open slot from tutor availability. No Calendly fee. Lands as an inquiry.',
     feature_card('Open slots without Calendly',
                  'TutorBird and Calendly charge for public booking pages. This page shows tutor availability. A parent picks a weekday/time and leaves contact details. You confirm and expand a 4-cycle booking. No login required to request.',
                  ['Publish this page', 'Parent picks a slot and submits', 'Row lands in Inquiries', 'You convert to a cycle booking'],
                  [('availability.html', 'Set availability'), ['bookings.html', 'Confirm the cycle'], ['apply.html', 'Full application']]) + '''
      <div class="card" style="max-width:640px">
        <div class="grid grid-2">
          <div class="form-group"><label>Parent name</label><input class="form-input" id="pn" required></div>
          <div class="form-group"><label>WhatsApp</label><input class="form-input" id="ph"></div>
          <div class="form-group"><label>Email</label><input class="form-input" id="em" type="email"></div>
          <div class="form-group"><label>Learner name</label><input class="form-input" id="ln"></div>
          <div class="form-group"><label>Preferred weekday (0=Sun)</label><input class="form-input" id="wd" type="number" value="6"></div>
          <div class="form-group"><label>Preferred time</label><input class="form-input" id="tm" type="time" value="16:00"></div>
          <div class="form-group"><label>Times per cycle</label><select class="form-select" id="tpc"><option value="1">1 → 4 classes</option><option value="2" selected>2 → 8 classes</option></select></div>
          <div class="form-group"><label>Subject</label><input class="form-input" id="sub"></div>
        </div>
        <h3>Open availability</h3>
        <div id="avail" class="muted">Loading…</div>
        <p><button class="btn btn-primary" type="button" id="go">Request this slot</button></p>
      </div>
''', extra_js=r'''
async function boot(){
  const box=document.getElementById('avail');
  if(!window.sb){ box.textContent='Connect Supabase to show live availability. Parents can still leave a request.'; return; }
  const {data}=await sb.from('availability').select('*').limit(40);
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  box.innerHTML=(data||[]).length?(data||[]).map(a=>`<div>${days[a.weekday]||a.weekday} · ${a.start_time||''}–${a.end_time||''} · ${TC.esc(a.timezone||'Africa/Lagos')}</div>`).join(''):'<p>No published slots yet. Ask the studio to fill Availability.</p>';
}
document.getElementById('go').onclick=async()=>{
  const notes='SELF-BOOK slot weekday='+document.getElementById('wd').value+' time='+document.getElementById('tm').value+' tpc='+document.getElementById('tpc').value;
  if(!window.sb){ toast('Preview only. Connect Supabase to store the request.','warning'); return; }
  const {error}=await sb.from('inquiries').insert({parent_name:document.getElementById('pn').value,email:document.getElementById('em').value,phone:document.getElementById('ph').value,learner_name:document.getElementById('ln').value,subject:document.getElementById('sub').value,kind:'one_on_one',timezone:'Africa/Lagos',source:'public-book',notes,status:'new'});
  if(error) toast(error.message,'danger'); else toast('Request received. The studio will confirm and expand a 4-cycle booking.','success');
};
document.addEventListener('DOMContentLoaded', boot);
''')

print('v5 pages written')
