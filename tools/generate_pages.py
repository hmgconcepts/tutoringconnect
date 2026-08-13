#!/usr/bin/env python3
"""Generate Tutoring Connect HTML pages from the module catalog."""
from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]

# Parse MODULES from catalog.js without executing JS
cat = (ROOT / "assets/js/catalog.js").read_text(encoding="utf-8")
# crude: extract id, name, group, file, desc via regex objects
mods = []
for m in re.finditer(
    r"\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*group:\s*'([^']+)',\s*file:\s*'([^']+)',\s*desc:\s*'([^']*)'",
    cat,
):
    mods.append({"id": m[1], "name": m[2], "group": m[3], "file": m[4], "desc": m[5]})

NAV = [
    ("dashboard", "Dashboard", "dashboard.html"),
    ("engagements", "Engagements", "engagements.html"),
    ("learners", "Learners", "learners.html"),
    ("groups", "Groups", "groups.html"),
    ("calendar", "Calendar", "calendar.html"),
    ("sessions", "Sessions", "sessions.html"),
    ("insights", "Insights Lab", "insights.html"),
    ("learner_360", "Learner 360", "learner-360.html"),
    ("mastery", "Mastery", "mastery.html"),
    ("assignments", "Homework", "assignments.html"),
    ("practice", "Practice tests", "practice.html"),
    ("packages", "Hour banks", "packages.html"),
    ("invoices", "Invoices", "invoices.html"),
    ("inbox", "Inbox", "inbox.html"),
    ("inquiries", "Inquiries", "inquiries.html"),
    ("settings", "Settings", "settings.html"),
    ("feature_guide", "Feature guide", "feature-guide.html"),
]

SCRIPTS = """
<link rel="stylesheet" href="assets/css/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Source+Serif+4:wght@500;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/config.js"></script>
<script src="assets/js/catalog.js"></script>
<script src="assets/js/license.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/crud.js"></script>
<script src="assets/js/insights.js"></script>
<script src="assets/js/cbt.js"></script>
<script src="assets/js/super.js"></script>
<link rel="manifest" href="manifest.json">
"""

def nav_html(active=""):
    bits = []
    for mid, label, href in NAV:
        cls = ' class="active"' if mid == active else ""
        bits.append(f'<a href="{href}" data-module="{mid}"{cls}><span class="app-nav-icon">▸</span>{label}</a>')
    return "\n".join(bits)

def shell(title, body, active="", extra_js=""):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} • Tutoring Connect</title>
{SCRIPTS}
</head>
<body>
<div class="app-layout">
  <aside class="app-sidebar">
    <div class="app-brand"><img data-logo src="assets/img/logo.svg" alt=""><div><strong data-practice-name>Tutoring Connect</strong><span class="muted">Studio</span></div></div>
    <nav class="app-nav">{nav_html(active)}</nav>
  </aside>
  <div class="app-main">
    <header class="app-topbar">
      <button class="mobile-toggle" type="button">☰</button>
      <h1 class="app-page-title">{title}</h1>
      <div class="user-chip"><span data-user-name></span> · <span data-user-role></span>
        <button class="btn btn-sm btn-ghost" id="btn-dark" type="button">Theme</button>
        <button class="btn btn-sm btn-ghost" type="button" onclick="App.signOut()">Sign out</button>
      </div>
    </header>
    <main class="app-content">{body}</main>
  </div>
</div>
<div class="pwa-install"><strong>Install the studio app</strong><p class="muted">Get session reminders even when the tab is closed.</p>
  <div class="pwa-install-actions"><button class="btn btn-ghost" type="button" onclick="PWAInstall.hide()">Not now</button>
  <button class="btn btn-accent" type="button" onclick="PWAInstall.install()">Install</button></div></div>
{extra_js}
</body></html>
"""

CRUD_MAP = {
    "engagements": "engagements", "learners": "learners", "groups": "groups", "parents": "parents",
    "tutors": "tutors", "subjects": "subjects", "inquiries": "inquiries", "waitlist": "waitlist",
    "trials": "trials", "sessions": "sessions", "attendance": "attendance", "session_notes": "session_notes",
    "goals": "goals", "mastery": "mastery", "methodologies": "methodologies", "curriculum": "curriculum",
    "assignments": "assignments", "packages": "packages", "invoices": "invoices", "payments": "payments",
    "announcements": "announcements", "inbox": "inbox", "complaints": "complaints", "polls": "polls",
    "resources": "resources", "flashcards": "flashcards", "exam_targets": "exam_targets", "documents": "documents",
}

SPECIAL = {
    "insights", "learner_360", "group_insights", "atrisk", "calendar", "practice", "cbt_exam",
    "feature_guide", "progress_reports", "analytics", "apply", "bookings", "timezones",
    "predictions", "value_added", "platform_health", "admin_data", "cbt_prompts",
}

def module_body(m):
    crud_id = CRUD_MAP.get(m["id"])
    extra = ""
    if crud_id:
        extra = f'<div id="crud-root"></div><script>document.addEventListener("DOMContentLoaded",()=>CRUD.renderList("{crud_id}"));</script>'
    else:
        extra = f'''<div class="card" id="module-root"><p class="muted">Records for this module live in Supabase. Use + Add once the database is connected. Preview mode shows the workflow only.</p>
        <p>Related: open <a href="insights.html">Insights Lab</a> or <a href="learner-360.html">Learner 360</a>.</p></div>'''
    return f'''
    <section class="help-card"><strong>What this page is</strong>
      <p>{m["desc"]}</p>
      <p class="muted">Independence rule: every 1:1 student and every group is its own engagement. Scores, hours, curriculum and invoices never spill into another engagement.</p>
    </section>
    {extra}
    '''

# --- write module pages ---
for m in mods:
    if m["id"] in SPECIAL:
        continue
    html = shell(m["name"], module_body(m), m["id"])
    (ROOT / m["file"]).write_text(html, encoding="utf-8")

print("wrote", len(mods) - len(SPECIAL), "module pages")
