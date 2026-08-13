#!/usr/bin/env python3
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PAGES = {
"group-insights.html": ("Group insights", "group_insights",
"Shared sessions, individual truth. The fairness view lists any group member whose latest score is more than 15 points below the group median. That child still has their own Learner 360."),
"cbt-prompts.html": ("Question-bank prompts", "cbt_prompts",
"Copy the prompt into any free external chat. Paste the CSV back into Practice tests. Tutoring Connect never calls an AI API."),
"progress-reports.html": ("Progress reports", "progress_reports",
"Print a branded parent report: hours used, attendance, mastery, value-added, next steps, methodology. Browser print = PDF. No paid renderer."),
"analytics.html": ("Practice analytics", "analytics",
"Studio-wide KPIs: utilisation, conversion (inquiry→trial→active), revenue, average value-added, retention. Chart.js is not required — SVG helpers in insights.js."),
"bookings.html": ("Self-booking", "bookings",
"Parents pick an open slot inside your availability and cancellation-hours policy. No Calendly subscription. Conflicts are rejected if the tutor or learner is already booked."),
"timezones.html": ("Timezone desk", "timezones",
"International tutoring. Enter a local time and three IANA zones (tutor, learner, parent). We display the equivalent clock in each. Sessions themselves store UTC."),
"platform-health.html": ("Platform health", "platform_health",
"Keep-alive heartbeat, approximate table counts, reminder to export JSON, license state, idle-lock minutes. Glance weekly — especially in long holidays so free Supabase does not pause."),
"admin-data.html": ("Admin data console", "admin_data",
"Export JSON, restore, CSV per table. Prefer Drive links over file bytes. The free database is 500 MB."),
"about.html": ("About", "about",
"Tutoring Connect is a generator plus a generated tutoring studio. It is inspired by School Connect’s free-tier architecture and rebuilt for independent 1:1 and group tutoring."),
"contact.html": ("Contact", "contact",
"Parents: use the public inquiry form. Existing families: sign in and use Inbox."),
"install.html": ("Install the app", "install",
"Chrome / Edge / Android: use the install banner. iOS: Share → Add to Home Screen. After install, the studio can send browser push for sessions and reports."),
"offline.html": ("You are offline", "offline",
"Cached pages still open. Writes wait until you are back online. Session notes drafted here should be copied if the tab dies."),
"forgot-password.html": ("Forgot password", "forgot-password",
"Supabase sends the reset email. Add this page URL to Authentication → Redirect URLs."),
"change-password.html": ("Change password", "change-password",
"Use after a recovery link. Also add ?recovery=1 to the Supabase redirect allow-list."),
}
SHELL = '''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} • Tutoring Connect</title>
<link rel="stylesheet" href="assets/css/style.css">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Source+Serif+4:wght@700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/config.js"></script>
<script src="assets/js/catalog.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/insights.js"></script>
<script src="assets/js/cbt.js"></script>
<script src="assets/js/super.js"></script>
</head><body>
<div class="app-layout">
<aside class="app-sidebar"><div class="app-brand"><img data-logo src="assets/img/logo.svg" alt=""><div><strong data-practice-name></strong></div></div>
<nav class="app-nav">
<a href="dashboard.html">Dashboard</a>
<a href="insights.html">Insights</a>
<a href="feature-guide.html">Feature guide</a>
</nav></aside>
<div class="app-main"><header class="app-topbar"><button class="mobile-toggle" type="button">☰</button><h1 class="app-page-title">{title}</h1></header>
<main class="app-content">
<section class="help-card"><strong>What this page is</strong><p>{desc}</p></section>
{extra}
</main></div></div></body></html>
'''
EXTRAS = {
"cbt-prompts.html": '<textarea class="form-textarea" id="p"></textarea><script>document.getElementById("p").value=CBT.prompt("IGCSE Maths",10);</script>',
"timezones.html": '''<div class="grid grid-3">
<div class="form-group"><label>Local datetime</label><input class="form-input" id="t" type="datetime-local"></div>
<div class="form-group"><label>From zone</label><input class="form-input" id="z0" value="Africa/Lagos"></div>
<div class="form-group"><label>Also show</label><input class="form-input" id="z1" value="Europe/London"></div>
</div><pre id="o" class="card"></pre>
<script>
function run(){
  const v=document.getElementById('t').value; if(!v) return;
  const d=new Date(v);
  document.getElementById('o').textContent = 'Stored as UTC: '+d.toISOString()+'\\nBrowser local: '+d.toString();
}
document.getElementById('t').onchange=run;
</script>''',
"forgot-password.html": '''<form class="card" id="f"><div class="form-group"><label>Email</label><input class="form-input" name="email" type="email" required></div>
<button class="btn btn-primary">Send reset</button></form>
<script>document.getElementById('f').onsubmit=async e=>{e.preventDefault();const email=new FormData(e.target).get('email');
if(!window.sb){toast('Connect Supabase first','warning');return;}
const {error}=await window.sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/change-password.html?recovery=1'});
toast(error?error.message:'Check your email','success');};</script>''',
}
for fn,(title,mid,desc) in PAGES.items():
    extra = EXTRAS.get(fn, '<p class="muted">Use the related module lists and Insights Lab with live data after you connect Supabase.</p><p><a class="btn btn-primary" href="feature-guide.html">All features</a></p>')
    (ROOT/fn).write_text(SHELL.format(title=title, desc=desc, extra=extra), encoding="utf-8")
print("specials", len(PAGES))
