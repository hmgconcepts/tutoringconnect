#!/usr/bin/env python3
"""Rebuild every Tutoring Connect page with a School Connect–parity shell.
Preserves special-page workflows. Does not touch builder/index/site-index.
"""
from pathlib import Path
import html

ROOT = Path('/home/user/tutoring-connect')

NAV = [
    ('dashboard', '⌂', 'Dashboard', 'dashboard.html', 'any'),
    ('engagements', '◈', 'Engagements', 'engagements.html', 'admin tutor staff'),
    ('learners', '◎', 'Learners', 'learners.html', 'any'),
    ('groups', '👥', 'Groups', 'groups.html', 'admin tutor staff'),
    ('parents', '👪', 'Parents', 'parents.html', 'admin tutor staff'),
    ('tutors', '👨‍🏫', 'Tutors', 'tutors.html', 'admin'),
    ('subjects', '📖', 'Subjects', 'subjects.html', 'admin tutor staff'),
    ('inquiries', '✉', 'Inquiries', 'inquiries.html', 'admin tutor staff'),
    ('calendar', '▦', 'Calendar', 'calendar.html', 'any'),
    ('bookings', '📅', 'Cycle bookings', 'bookings.html', 'any'),
    ('sessions', '🗓️', 'Sessions', 'sessions.html', 'any'),
    ('session_complete', '✅', 'Complete a class', 'session-complete.html', 'admin tutor staff'),
    ('attendance', '📋', 'Attendance', 'attendance.html', 'any'),
    ('sow', '📑', 'Scheme of work', 'sow.html', 'admin tutor staff'),
    ('practice', '📝', 'Quizzes', 'practice.html', 'admin tutor staff'),
    ('cbt_exam', '🖊', 'Take quiz', 'cbt-exam.html', 'any'),
    ('reading', '📚', 'Reading', 'reading.html', 'any'),
    ('scoresheet', '📒', 'Scoresheet', 'scoresheet.html', 'any'),
    ('stream', '📡', 'Stream', 'stream.html', 'any'),
    ('classwork', '📂', 'Classwork', 'classwork.html', 'any'),
    ('forum', '💬', 'Group forum', 'forum.html', 'any'),
    ('insights', '▣', 'Insights Lab', 'insights.html', 'any'),
    ('learner_360', '◎', 'Learner 360', 'learner-360.html', 'any'),
    ('analytics', '📊', 'Analytics', 'analytics.html', 'admin'),
    ('packages', '◷', 'Hour banks', 'packages.html', 'any'),
    ('invoices', '🧾', 'Invoices', 'invoices.html', 'any'),
    ('inbox', '📥', 'Inbox', 'inbox.html', 'any'),
    ('announcements', '📢', 'Announcements', 'announcements.html', 'any'),
    ('notifications', '🔔', 'Notifications', 'notifications.html', 'any'),
    ('voting', '🗳️', 'Voting', 'voting.html', 'any'),
    ('apply', '📝', 'Apply', 'apply.html', 'any'),
    ('exam_links', '🎫', 'Exam links', 'exam-links.html', 'admin tutor staff'),
    ('settings', '⚙️', 'Settings', 'settings.html', 'admin'),
    ('admin_data', '🗃️', 'Admin data', 'admin-data.html', 'admin'),
    ('platform_health', '🛡️', 'Health', 'platform-health.html', 'admin'),
    ('feature_guide', '📘', 'Feature guide', 'feature-guide.html', 'any'),
    ('hmg_ecosystem', '🌐', 'HMG Ecosystem', 'hmg-ecosystem.html', 'any'),
]

SCRIPTS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'assets/js/config.js',
    'assets/js/catalog.js',
    'assets/js/license.js',
    'assets/js/media.js',
    'assets/js/brand.js',
    'assets/js/notifications.js',
    'assets/js/pwa-install.js',
    'assets/js/site-help.js',
    'assets/js/assistant-kb.js',
    'assets/js/ics.js',
    'assets/js/chatbot.js',
    'assets/js/ai-assistant.js',
    'assets/js/security-guard.js',
    'assets/js/voting.js',
    'assets/js/enterprise.js',
    'assets/js/crud.js',
    'assets/js/insights.js',
    'assets/js/cbt.js',
    'assets/js/proctor.js',
    'assets/js/bookings-engine.js',
    'assets/js/analytics.js',
    'assets/js/super.js',
    'assets/js/app.js',
]

# Extra modules to ensure exist (beyond NAV)
EXTRA_PAGES = {
    'waitlist': ('Waitlist', 'Growth', 'Hold demand when a slot or group is full. Promote into an engagement with one click.', 'waitlist'),
    'trials': ('Trial lessons', 'Growth', 'Free or paid diagnostic trial. Captures baseline score and fit notes before a package is sold.', 'trials'),
    'onboarding': ('Onboarding checklists', 'Growth', 'Consent, goals interview, diagnostic, first package, first session — tracked per engagement.', 'onboarding'),
    'availability': ('Availability', 'Sessions', 'Weekly tutor availability in the tutor’s timezone. Used by cycle booking and conflict checks.', 'availability'),
    'makeups': ('Make-up sessions', 'Sessions', 'Policy-aware make-ups. Hours can be restored or consumed depending on who cancelled.', 'makeups'),
    'cancellations': ('Cancellations', 'Sessions', 'Who cancelled, notice hours, fee applied, hours returned. Transparent for parents.', 'cancellations'),
    'session-notes': ('Session notes', 'Sessions', 'Per-session, optionally per-learner notes. Shareable to the parent portal. Drive recording link.', 'session_notes'),
    'meetings': ('Meeting links', 'Sessions', 'Jitsi (free), Google Meet or Zoom links stored per session. No paid classroom required.', 'meetings'),
    'whiteboard': ('Whiteboard rooms', 'Sessions', 'Free Excalidraw / Jamboard / FigJam links per engagement.', 'whiteboard'),
    'diagnostics': ('Diagnostics', 'Learning', 'Baseline tests at the start of an engagement. Locks the value-added starting point.', 'diagnostics'),
    'goals': ('Goals & learning plans', 'Learning', 'SMART goals and a living plan per engagement and per learner.', 'goals'),
    'mastery': ('Topic mastery', 'Learning', 'Topic-by-topic heatmap (0–100) per learner. Independent even inside a group.', 'mastery'),
    'methodologies': ('Methodologies', 'Learning', 'Spaced retrieval, worked examples, CRA, exam-technique drills. Attach one to each engagement.', 'methodologies'),
    'curriculum': ('Curriculum maps', 'Learning', 'Independent scheme of work per engagement — not a shared school class list.', 'curriculum'),
    'lesson-plans': ('Lesson plans', 'Learning', 'Objectives, resources, checks for understanding. Linked to a session and a methodology.', 'lesson_plans'),
    'assignments': ('Homework', 'Learning', 'Set, collect (Drive link), mark, and score. Completion rate feeds insights.', 'assignments'),
    'cbt-prompts': ('Question bank prompts', 'Learning', 'Copy-paste prompts for any free chat to emit CSV questions. The platform never calls a paid AI.', None),
    'cbt-multi': ('Multi-subject CBT', 'Learning', 'One sitting, subject tabs (UTME-style). Shared timer, per-subject breakdown, same anti-cheat.', None),
    'cbt-review': ('Quiz review + PDF', 'Learning', 'After a quiz the learner sees every item, their answer, the key and the explanation, then saves a study PDF.', None),
    'progress-reports': ('Progress reports', 'Learning', 'Parent-ready branded reports: hours, attendance, mastery, value-added, next steps.', None),
    'group-insights': ('Group insights', 'Analytics', 'Shared-session analytics plus a fairness view: who is being left behind inside the group.', None),
    'at-risk': ('At-risk board', 'Analytics', 'Six transparent rules. No AI.', None),
    'exam-targets': ('Exam targets', 'Analytics', 'Target exam, date, board, predicted vs target grade.', 'exam_targets'),
    'predictions': ('Predicted grades', 'Analytics', 'Transparent linear projection from the last N scores toward the exam date.', None),
    'value-added': ('Value-added', 'Analytics', 'Current average minus diagnostic baseline.', None),
    'learning-styles': ('Learning styles', 'Learning', 'Observed notes — a working memory for the tutor, not a quiz religion.', 'learning_styles'),
    'accommodations': ('Accommodations / SEN', 'Learning', 'Extra time, reader, rest breaks. Printed onto practice tests and reports.', 'accommodations'),
    'resources': ('Resource library', 'Learning', 'Drive / YouTube / PDF links scoped to an engagement. No file uploads.', 'resources'),
    'flashcards': ('Spaced practice', 'Learning', 'SM-2 spaced repetition. Cards belong to a learner, not a group.', 'flashcards'),
    'certificates': ('Certificates', 'Learning', 'Printable milestone certificates with a verification code.', 'certificates'),
    'portfolio': ('Learner portfolio', 'Learning', 'Best work, recordings, marked scripts — Drive links curated for applications.', 'portfolio'),
    'payments': ('Payments', 'Finance', 'Record bank / cash / Paystack / Flutterwave / Stripe checkout links.', 'payments'),
    'payment-history': ('Payment history', 'Finance', 'Family-safe history and printable receipts.', 'payments'),
    'fees': ('Fee catalogue', 'Finance', 'Rate cards: 1:1 vs group, subject premiums, weekend rates, trial fees.', 'fees'),
    'scholarships': ('Scholarships & discounts', 'Finance', 'Sibling discount, hardship, referral credit — applied per engagement.', 'scholarships'),
    'products': ('Books & materials', 'Finance', 'Past papers, workbooks, kits sold alongside tutoring.', 'products'),
    'payroll': ('Tutor payroll', 'Finance', 'Hours × rate, bonuses, deductions.', 'payroll'),
    'finance': ('Practice finance', 'Finance', 'Income / expense ledger and simple P&L.', 'finance'),
    'referrals': ('Referrals', 'Growth', 'Track who referred whom and the credit granted.', 'referrals'),
    'messages': ('Messaging (WA / Email / SMS)', 'Comms', 'Free device-native WhatsApp, email BCC and SMS links. No Twilio bill.', 'messages'),
    'complaints': ('Complaints', 'Comms', 'Submit → route → resolve. Evidence as Drive links.', 'complaints'),
    'surveys': ('Surveys & CSAT', 'Comms', 'After-trial and termly parent pulse.', 'surveys'),
    'parent-meetings': ('Parent conferences', 'Comms', 'Book a review slot, attach the latest 360 and report.', 'parent_meetings'),
    'reviews': ('Reviews & testimonials', 'Growth', 'Collect and optionally publish reviews on the public site (SEO).', 'reviews'),
    'broadcasts': ('Result broadcasts', 'Comms', 'One-click share of a score or report via free channels.', 'broadcasts'),
    'gallery': ('Gallery', 'Media', 'Drive photos and YouTube recaps. No base64 in the database.', 'gallery'),
    'birthdays': ('Birthdays', 'Media', 'Upcoming learner and tutor birthdays.', 'birthdays'),
    'directory': ('Directory', 'Media', 'Searchable people directory, role-filtered.', 'directory'),
    'helpdesk': ('Help desk', 'Ops', 'IT / scheduling / billing tickets.', 'helpdesk'),
    'documents': ('Contracts & consent', 'Ops', 'Service agreement, safeguarding consent — Drive links + status.', 'documents'),
    'policies': ('Policies', 'Ops', 'Cancellation, refund, safeguarding, late policy.', 'policies'),
    'idcards': ('Learner cards', 'Media', 'Printable branded cards with QR. Photo is a Drive link.', 'idcards'),
    'flyer': ('Marketing flyer', 'Growth', 'Printable admissions flyer. Free lead-gen.', 'flyer'),
    'events': ('Workshops & events', 'Sessions', 'One-off workshops, bootcamps, exam clinics.', 'events'),
    'polls': ('Polls', 'Comms', 'Schedule votes, topic votes, anonymous parent polls.', 'polls'),
    'library': ('Digital library', 'Learning', 'Catalogued reading / past-paper links with optional comprehension score.', 'library'),
    'lms': ('Mini LMS', 'Learning', 'Courses, lessons, completion — scoped to an engagement.', 'lms'),
    'eresources': ('E-resources / notes', 'Learning', 'Study materials as Drive or web links, organised by subject and engagement.', 'eresources'),
    'gamification': ('Streaks & badges', 'Learning', 'Homework streaks, mastery badges. Transparent point log.', 'gamification'),
    'rubrics': ('Rubrics', 'Learning', 'Criteria and scale for essays and projects.', 'rubrics'),
    'transcripts': ('Transcripts', 'Learning', 'Cumulative record across independent engagements.', 'transcripts'),
    'safeguarding': ('Safeguarding log', 'Ops', 'Confidential incidents. Admin/tutor only. Never in the parent nav.', 'safeguarding'),
    'compliance': ('Compliance', 'Ops', 'DBS/background checks, insurance, data-protection tasks.', 'compliance'),
    'substitutions': ('Cover tutors', 'Ops', 'Assign cover when a tutor is away. Hours still belong to the engagement.', 'substitutions'),
    'rooms': ('Rooms / locations', 'Ops', 'In-person rooms or virtual standing rooms. Conflict check.', 'rooms'),
    'timezones': ('Timezone desk', 'Ops', 'Convert a slot across learner, parent and tutor zones (Africa/Lagos default).', None),
    'storage': ('Storage manager', 'Platform', 'Watch the free 500 MB. Archive then purge old logs.', None),
    'activity-log': ('Activity log', 'Platform', 'Who created, edited, deleted, signed in.', None),
    'approvals': ('Approvals', 'Platform', 'Approve parent/learner/tutor self-signups.', None),
    'status-manager': ('Role & status', 'Platform', 'Change role/status with an audit row.', None),
    'license': ('Site license', 'Platform', 'Lifetime or subscription lock.', None),
    'application-links': ('Application links', 'Growth', 'Expiring, limited-use application URLs for a subject, 1:1 or group.', None),
    'exam-register': ('Public exam form', 'Growth', 'Candidate form opened by an exam link. Local and international boards.', None),
    'hmg-products': ('HMG Digital Products', 'HMG Concepts', 'Product catalogue and contact paths for the ecosystem.', None),
    'profile': ('My profile', 'Account', 'Your name, phone, timezone, Drive photo, password.', None),
    'leave': ('Tutor leave', 'Ops', 'Tutors request leave. Only an administrator can approve or reject.', 'leave'),
    'voting': ('Voting & polls', 'Comms', 'Anonymous or named ballots. Live tally. Multi-channel notify when a poll opens.', None),
    'developer': ('About the developer', 'HMG Concepts', 'Adewale Samson Adeagbo — HMG Concepts / HMG Technologies.', None),
    'about': ('About this studio', 'Public', 'Public SEO page. Points to the studio AND the HMG Concepts ecosystem.', None),
    'contact': ('Contact', 'Public', 'WhatsApp, email and address for this studio.', None),
    'install': ('Install the app', 'Public', 'PWA install for Chrome, Edge, Android and iOS Safari.', None),
    'offline': ('You are offline', 'Public', 'Cached shell so the studio still opens without a network.', None),
    'forgot-password': ('Reset password', 'Public', 'Supabase Auth email reset. Free. No paid SMS OTP.', None),
    'change-password': ('Change password', 'Account', 'Update your password. Strength meter is local.', None),
    'login': ('Sign in', 'Public', 'Email, student ID (TC-0001) or name. New accounts wait for approval.', None),
}

RELATED = {
    'engagements': [('learners.html', 'Add learners'), ('bookings.html', 'Sell a 4-cycle booking'), ('packages.html', 'Attach an hour bank'), ('sow.html', 'Write the scheme of work')],
    'learners': [('parents.html', 'Link a parent'), ('engagements.html', 'Seat them on an engagement'), ('learner-360.html', 'Open 360'), ('idcards.html', 'Print a card')],
    'bookings': [('session-complete.html', 'Mark a class done'), ('invoices.html', 'Raise the invoice'), ('calendar.html', 'See the timetable'), ('packages.html', 'Debit the hour bank')],
    'practice': [('cbt-exam.html', 'Learner sits the quiz'), ('cbt-prompts.html', 'Copy a prompt pack'), ('scoresheet.html', 'Graded results land here'), ('sow.html', 'Align to topics')],
    'sow': [('reading.html', 'Assign pre-class reading'), ('session-complete.html', 'Tick topics after class'), ('scoresheet.html', 'Push evaluations'), ('curriculum.html', 'Curriculum map')],
    'insights': [('learner-360.html', 'One child'), ('at-risk.html', 'Rule board'), ('predictions.html', 'OLS forecast'), ('value-added.html', 'Baseline delta')],
    'apply': [('application-links.html', 'Make a shareable code'), ('inquiries.html', 'See the pipeline'), ('trials.html', 'Book a diagnostic')],
}

WORKFLOWS = {
    'engagements': ['Create the engagement (1:1 or group)', 'Add members (never share a sibling’s data)', 'Attach methodology + SOW + hour bank', 'Sell a 4-cycle booking', 'Teach → complete class → insights'],
    'bookings': ['Pick learner + engagement', 'Choose times per cycle (1 = 4 classes, 2 = 8)', 'Set duration and hourly rate', 'Save — SQL expands 4 cycles', 'Tutor, parent and learner all see date / time / duration'],
    'practice': ['Choose Self, Review or Graded', 'Paste CSV from a prompt pack (or write items)', 'Share the quiz code', 'Learner sits with student ID TC-0001', 'Graded results auto-push to the scoresheet'],
    'sow': ['Open the engagement', 'Enter every topic for the term', 'Assign reading to the next topic', 'After class, evaluate each learner', 'Scores appear on the scoresheet and 360'],
    'apply': ['Admin creates an application link (optional code)', 'Parent opens apply.html or apply.html?code=', 'Form posts via tc_submit_application', 'Row lands in applications + inquiries', 'Convert to a trial, then an engagement'],
}


def esc(s):
    return html.escape(str(s or ''), quote=True)


def nav_html(active):
    bits = []
    for mid, icon, label, href, allow in NAV:
        cls = ' class="active"' if mid.replace('_', '-') == active.replace('_', '-') or href.startswith(active) else ''
        bits.append(
            f'<a href="{href}" data-module-id="{mid}" data-module="{mid}" data-role-allow="{allow}"{cls}>'
            f'<span class="app-nav-icon">{icon}</span><span>{label}</span></a>'
        )
    return '\n      '.join(bits)


def head(title, desc, extra_css=''):
    scripts = '\n'.join(f'<script src="{s}"></script>' for s in SCRIPTS)
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} • ADEWALE CLASSROOM</title>
<meta name="description" content="{esc(desc)}">
<meta name="theme-color" content="#134e4a">
<meta name="author" content="HMG Technologies · HMG Concepts">
<link rel="icon" type="image/svg+xml" href="assets/img/logo.svg">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="assets/img/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Source+Serif+4:wght@600;800&display=swap" rel="stylesheet">
<meta property="og:title" content="{esc(title)} • ADEWALE CLASSROOM">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="assets/css/style.css">
<style>
.help-card{{background:linear-gradient(135deg,#ecfdf5,#fff7ed);border:1px solid #d1fae5;border-radius:16px;padding:16px 18px;margin-bottom:16px}}
.help-card p{{margin:.4rem 0 0;color:#334155;line-height:1.55}}
.workflow{{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}}
.workflow span{{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:4px 10px;font-size:.78rem;font-weight:700}}
.related{{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}}
.pwa-install-banner{{display:none;position:fixed;left:16px;right:16px;bottom:16px;z-index:9990;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 40px rgba(15,23,42,.18);padding:12px 14px;gap:12px;align-items:center}}
.pwa-install-banner.show{{display:flex}}
.toast-container{{position:fixed;right:16px;top:16px;z-index:10001;display:flex;flex-direction:column;gap:8px}}
.toast{{background:#0f172a;color:#fff;border-radius:12px;padding:10px 14px;max-width:360px}}
.toast-success{{background:#166534}}.toast-danger{{background:#991b1b}}.toast-warning{{background:#92400e}}
.modal-backdrop{{display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;align-items:center;justify-content:center;padding:20px}}
.modal-backdrop.show{{display:flex}}
.modal{{background:#fff;border-radius:16px;max-width:720px;width:100%;max-height:90vh;overflow:auto}}
.modal-header,.modal-footer{{padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:8px}}
.modal-body{{padding:18px}}
.notif-dropdown.show{{display:block!important}}
{extra_css}
</style>
{scripts}
</head>
'''


def shell_open(active, title, require='any'):
    return f'''<body>
<div class="app-layout" data-require-role="{require}" id="app-layout">
  <aside class="app-sidebar" id="app-sidebar">
    <div class="app-brand"><img data-logo src="assets/img/logo.svg" alt=""><div><strong data-practice-name>ADEWALE CLASSROOM</strong><span class="muted">Tutoring Connect</span></div></div>
    <nav class="app-nav">
      {nav_html(active)}
    </nav>
  </aside>
  <div class="app-main">
    <header class="app-topbar">
      <button class="mobile-toggle" type="button" aria-label="Menu">☰</button>
      <h1 class="app-page-title">{esc(title)}</h1>
      <div class="user-chip"><strong id="user-display-name" data-user-name></strong>
        <span id="user-display-role" data-user-role></span>
        <button class="btn btn-sm btn-ghost" id="btn-dark" type="button">Theme</button>
        <button class="btn btn-sm btn-ghost" type="button" data-signout onclick="App.signOut()">Sign out</button></div>
    </header>
    <main class="app-content">
'''


def shell_close(extra_js=''):
    return f'''    </main>
  </div>
</div>
<div id="toast-container" class="toast-container"></div>
<script>
{extra_js}
</script>
</body>
</html>
'''


def feature_card(title, body, steps=None, related=None):
    wf = ''
    if steps:
        wf = '<div class="workflow">' + ''.join(f'<span>{i+1}. {esc(s)}</span>' for i, s in enumerate(steps)) + '</div>'
    rel = ''
    if related:
        rel = '<div class="related">' + ''.join(f'<a class="btn btn-outline btn-sm" href="{h}">{esc(l)}</a>' for h, l in related) + '</div>'
    return f'''      <section class="help-card">
        <strong>{esc(title)}</strong>
        <p>{body}</p>
        {wf}
        {rel}
      </section>
'''


def crud_block(module_id):
    return f'''      <div id="crud-root"></div>
      <script>document.addEventListener('DOMContentLoaded',()=>{{ if(window.CRUD) CRUD.renderList({module_id!r}); }});</script>
'''


def page(path, title, desc, body, extra_js='', require='any', extra_css=''):
    active = Path(path).stem
    html_out = head(title, desc, extra_css) + shell_open(active, title, require) + body + shell_close(extra_js)
    (ROOT / path).write_text(html_out)
    return len(html_out)


# ---------- special bodies ----------
def body_dashboard():
    return '''      <section class="help-card"><strong>How to read this board</strong>
        <p>Admin/tutor: whole practice. Parent: only your children. Learner: only you. 1:1 and group engagements stay independent — a group average never hides a child who is falling behind. Next classes come from the 4-cycle booking timetable.</p></section>
      <div id="dash-actions" class="card" style="display:none;margin-bottom:14px;border-color:#f59e0b"><h3 style="margin:0 0 8px">Action needed today</h3><div id="dash-actions-body"></div></div>
      <div class="grid grid-4" id="kpi-row">
        <div class="stat-card"><div class="stat-value" id="k-eng">—</div><div class="stat-label">Active engagements</div></div>
        <div class="stat-card"><div class="stat-value" id="k-ses">—</div><div class="stat-label">Sessions this week</div></div>
        <div class="stat-card"><div class="stat-value" id="k-risk">—</div><div class="stat-label">At-risk flags</div></div>
        <div class="stat-card"><div class="stat-value" id="k-hrs">—</div><div class="stat-label">Hours left (sum)</div></div>
      </div>
      <div id="dash-quick-links" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"></div>
      <div class="grid grid-2" style="margin-top:8px">
        <article class="card" data-dash-role="parent"><h3>Your children</h3><div id="dash-parent-kids">Loading linked learners…</div></article>
        <article class="card"><h3>Score trajectory</h3><div id="dash-line"></div></article>
        <article class="card"><h3>Your next classes (4-cycle booking)</h3><div id="dash-classes" class="muted">Loading timetable…</div></article>
        <article class="card"><h3>At-risk (readable rules)</h3><div id="dash-flags"></div>
          <p class="muted" style="margin-top:8px">attendance &lt; 80% · idle ≥ 14d · hours &lt; 2 · homework &lt; 60% · last 3 declining · &gt;40% topics &lt; 50%</p></article>
      </div>
      <div id="dash-live" class="dash-live"></div>
      <div id="dash-announcements"></div>
'''


def body_generic(title, desc, module_id, key):
    steps = WORKFLOWS.get(key) or WORKFLOWS.get(module_id)
    related = RELATED.get(key) or RELATED.get(module_id)
    b = feature_card(title, desc, steps, related)
    if module_id:
        b += crud_block(module_id)
    else:
        b += '      <p class="muted">Use the related links and the ❓ Page Help button. Connect Supabase to load live rows.</p>\n'
    return b


def body_analytics():
    return feature_card(
        'Practice analytics — formulas, not an AI black box',
        'Studio-wide KPIs: utilisation, inquiry→trial→active conversion, revenue, score-band distribution, attendance trend. Chart.js when the CDN loads; SVG bars if it does not. No paid analytics service.',
        ['Connect Supabase', 'Teach and invoice as usual', 'This page aggregates counts', 'Drill into Insights Lab for one child'],
        [('insights.html', 'Insights Lab'), ('value-added.html', 'Value-added'), ('at-risk.html', 'At-risk board')]
    ) + '''      <div class="grid grid-4">
        <div class="stat-card"><div class="stat-value" id="kpi-learners">—</div><div class="stat-label">Learners</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-tutors">—</div><div class="stat-label">Tutors</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-engagements">—</div><div class="stat-label">Engagements</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-sessions">—</div><div class="stat-label">Sessions</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-exams">—</div><div class="stat-label">Quizzes</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-results">—</div><div class="stat-label">Sittings</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-inquiries">—</div><div class="stat-label">Inquiries</div></div>
        <div class="stat-card"><div class="stat-value" id="kpi-fees">—</div><div class="stat-label">Collected</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <article class="card"><h3>Score bands</h3><canvas id="chart-cbt" height="180"></canvas></article>
        <article class="card"><h3>New learners</h3><canvas id="chart-enrol" height="180"></canvas></article>
        <article class="card"><h3>Attendance %</h3><canvas id="chart-attendance" height="180"></canvas></article>
        <article class="card"><h3>Inquiry funnel</h3><canvas id="chart-funnel" height="180"></canvas></article>
        <article class="card"><h3>Fees</h3><canvas id="chart-fees" height="180"></canvas></article>
      </div>
      <div id="analytics-insights" style="margin-top:16px"></div>
'''


def body_bookings():
    return feature_card(
        'Full booking = 4 cycles × 7 days',
        'A <b>cycle</b> is 7 days. A <b>full booking</b> is 4 cycles (28 days). 2 times per cycle = <b>8 classes</b>. 1 time per cycle = <b>4 classes</b>. Amount = hourly rate × (minutes/60) × classes. The same numbers appear on the tutor, parent and learner dashboards with date, time and duration.',
        WORKFLOWS['bookings'],
        RELATED['bookings']
    ) + '''      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Learner</label><select class="form-select" id="learner_id"></select></div>
          <div class="form-group"><label>Engagement</label><select class="form-select" id="engagement_id"></select></div>
          <div class="form-group"><label>Start of cycle 1</label><input class="form-input" id="started_on" type="date"></div>
          <div class="form-group"><label>Times per cycle</label>
            <select class="form-select" id="tpc"><option value="1">1 class / cycle → 4 classes</option><option value="2" selected>2 classes / cycle → 8 classes</option><option value="3">3 classes / cycle → 12 classes</option></select>
          </div>
          <div class="form-group"><label>Duration (minutes)</label><input class="form-input" id="dur" type="number" value="60"></div>
          <div class="form-group"><label>Hourly rate</label><input class="form-input" id="rate" type="number" value="8000"></div>
          <div class="form-group"><label>First weekday (0=Sun … 6=Sat)</label><input class="form-input" id="wd" type="number" value="6"></div>
          <div class="form-group"><label>First time</label><input class="form-input" id="tm" type="time" value="16:00"></div>
          <div class="form-group"><label>Second weekday (if 2×)</label><input class="form-input" id="wd2" type="number" value="3"></div>
          <div class="form-group"><label>Second time</label><input class="form-input" id="tm2" type="time" value="16:00"></div>
        </div>
        <div id="quote"></div>
        <button class="btn btn-primary" type="button" id="save">Create booking &amp; generate 4-cycle timetable</button>
      </div>
      <h3 style="margin-top:18px">Upcoming classes</h3>
      <div id="upcoming"></div>
'''


BOOKINGS_JS = r'''
async function fillRefs(){
  if(!window.sb) return;
  const l=await sb.from('learners').select('id,full_name,student_no').order('full_name').limit(400);
  const e=await sb.from('engagements').select('id,name,hourly_rate').order('name').limit(400);
  const lp=document.getElementById('learner_id'), ep=document.getElementById('engagement_id');
  if(lp) lp.innerHTML='<option value=""></option>'+(l.data||[]).map(x=>`<option value="${x.id}">${TC.esc(x.full_name)} ${x.student_no?('· '+x.student_no):''}</option>`).join('');
  if(ep) ep.innerHTML='<option value=""></option>'+(e.data||[]).map(x=>`<option value="${x.id}" data-rate="${x.hourly_rate||''}">${TC.esc(x.name)}</option>`).join('');
  const q=new URLSearchParams(location.search);
  if(q.get('learner')&&lp) lp.value=q.get('learner');
  if(ep) ep.onchange=()=>{ const o=ep.selectedOptions[0]; if(o&&o.dataset.rate) document.getElementById('rate').value=o.dataset.rate; paintQ(); };
}
function q(){ return Bookings.quote({ timesPerCycle: document.getElementById('tpc').value, cycleCount: 4, durationMin: document.getElementById('dur').value, hourlyRate: document.getElementById('rate').value }); }
function paintQ(){ if(window.Bookings) Bookings.renderBreakdown(document.getElementById('quote'), q(), (window.PRACTICE&&PRACTICE.currency)||'₦'); }
['tpc','dur','rate'].forEach(id => { const el=document.getElementById(id); if(el) el.onchange = paintQ; });
document.addEventListener('DOMContentLoaded', () => { paintQ(); fillRefs(); loadUp(); });
document.getElementById('save').onclick = async () => {
  const row = {
    learner_id: document.getElementById('learner_id').value || null,
    engagement_id: document.getElementById('engagement_id').value || null,
    started_on: document.getElementById('started_on').value,
    times_per_cycle: Number(document.getElementById('tpc').value),
    cycle_count: 4,
    duration_minutes: Number(document.getElementById('dur').value),
    hourly_rate: Number(document.getElementById('rate').value),
    weekday: Number(document.getElementById('wd').value),
    slot_time: document.getElementById('tm').value,
    weekday_2: Number(document.getElementById('wd2').value),
    slot_time_2: document.getElementById('tm2').value,
    currency: (window.PRACTICE&&PRACTICE.currency)||'₦',
    status: 'active'
  };
  if (!row.started_on) { toast('Pick the start of cycle 1', 'warning'); return; }
  if (!window.sb) { toast('Preview quote only. Connect Supabase to generate the 4-cycle timetable.', 'warning'); return; }
  const { error } = await window.sb.from('booking_blocks').insert(row);
  if (error) toast(error.message, 'danger'); else { toast('Booking created. Classes expanded for 4 cycles.', 'success'); loadUp(); }
};
async function loadUp() {
  if (!window.sb) return;
  const { data } = await window.sb.from('booking_classes').select('*').order('scheduled_at').limit(40);
  document.getElementById('upcoming').innerHTML = (data||[]).map(c => `<div class="card" style="margin-bottom:8px">
    <b>Cycle ${c.cycle_no} · class ${c.seq_in_cycle}</b>
    <div>${new Date(c.scheduled_at).toLocaleString()} · ${c.duration_minutes} min · <span class="badge">${c.status}</span></div>
    ${c.tutor_feedback ? `<p>${TC.esc(c.tutor_feedback)}</p>` : ''}
  </div>`).join('') || '<p class="muted">No classes yet.</p>';
}
'''


def body_settings():
    return feature_card(
        'Brand, access, accessibility — no file bytes',
        'Logo and signatures are Drive or https links. 2FA is email OTP via Supabase Auth (free). Language and high-contrast live in this browser. Cancellation hours and default timezone feed Cycle bookings. Idle lock and emergency lockdown sync from this row.',
        ['Set name, motto, timezone, currency', 'Paste logo URL (Drive preview works)', 'Save to practice_settings', 'Every page hydrates the brand'],
        [('platform-health.html', 'Health & lockdown'), ('admin-data.html', 'Drive backup'), ('approvals.html', 'Approve accounts')]
    ) + '''      <div class="card">
        <div class="grid grid-2">
          <div class="form-group"><label>Studio name</label><input class="form-input" id="name"></div>
          <div class="form-group"><label>Motto</label><input class="form-input" id="motto"></div>
          <div class="form-group"><label>Logo URL (https or Drive)</label><input class="form-input" id="logo"></div>
          <div class="form-group"><label>Lead tutor signature URL</label><input class="form-input" id="sig"></div>
          <div class="form-group"><label>Timezone</label><input class="form-input" id="tz"></div>
          <div class="form-group"><label>Currency</label><input class="form-input" id="cur"></div>
          <div class="form-group"><label>Cancellation hours</label><input class="form-input" id="ch" type="number" value="12"></div>
          <div class="form-group"><label>Idle lock (minutes, 0=off)</label><input class="form-input" id="idle" type="number" value="30"></div>
        </div>
        <div id="logo-prev"></div>
        <p>
          <button class="btn btn-ghost" type="button" id="dark">Toggle dark mode</button>
          <button class="btn btn-ghost" type="button" id="hc">Toggle high contrast</button>
          <button class="btn btn-primary" type="button" id="save">Save to database</button>
        </p>
      </div>
'''


SETTINGS_JS = r'''
const p = window.PRACTICE || {};
const setv=(id,v)=>{ const el=document.getElementById(id); if(el&&v!=null) el.value=v; };
setv('name', p.name); setv('motto', p.motto); setv('logo', p.logoUrl); setv('tz', p.timezone||'Africa/Lagos'); setv('cur', p.currency||'₦');
document.getElementById('logo').onchange = () => {
  if (window.Media) document.getElementById('logo-prev').innerHTML = Media.card(document.getElementById('logo').value, 'Logo preview');
};
document.getElementById('dark').onclick = () => App.toggleDarkMode();
document.getElementById('hc').onclick = () => document.body.classList.toggle('sc-high-contrast');
document.getElementById('save').onclick = async () => {
  if (!window.sb) return toast('Saved locally only. Connect Supabase for shared settings.','warning');
  const { error } = await window.sb.from('practice_settings').upsert({
    id: 1, name: document.getElementById('name').value, motto: document.getElementById('motto').value,
    timezone: document.getElementById('tz').value, currency: document.getElementById('cur').value,
    cancellation_hours: Number(document.getElementById('ch').value||12),
    idle_lock_minutes: Number(document.getElementById('idle').value||30),
    signature_url: document.getElementById('sig').value, logo_url: document.getElementById('logo').value
  });
  if (error) toast(error.message,'danger'); else toast('Settings saved','success');
};
'''


def body_feature_guide():
    return '''      <section class="help-card"><strong>Every module, explained</strong>
        <p>This page is generated from the live catalogue. Nothing here calls a paid AI API. Media is always a link. An engagement is independent.</p></section>
      <div id="guide-root">Loading catalogue…</div>
'''


FEATURE_JS = r'''
document.addEventListener('DOMContentLoaded', () => {
  const mods = (window.TC && TC.MODULES) || [];
  const groups = {};
  mods.forEach(m => { (groups[m.group] = groups[m.group] || []).push(m); });
  const root = document.getElementById('guide-root');
  root.innerHTML = Object.keys(groups).map(g => {
    return '<h2 style="margin:22px 0 10px">'+TC.esc(g)+'</h2><div class="grid grid-2">' +
      groups[g].map(m => '<a class="card" href="'+m.file+'" style="text-decoration:none;color:inherit"><h3 style="margin:0 0 6px">'+TC.esc(m.name)+'</h3><p class="muted" style="margin:0">'+TC.esc(m.desc)+'</p></a>').join('') +
      '</div>';
  }).join('');
});
'''


def body_about():
    return '''      <article class="card" style="max-width:820px">
        <p class="muted">A product of <b>HMG Technologies</b>, a subsidiary of <b>HMG Concepts</b> (<i>His Marvellous Grace</i>). Founder: Adewale Samson Adeagbo.</p>
        <h2 data-practice-name>ADEWALE CLASSROOM</h2>
        <p data-practice-motto></p>
        <p>Independent 1:1 and group tutoring for Nigerian and international learners. Parents hired the tutor personally. Each contract has its own curriculum, hour bank, goals, fees and analytics.</p>
        <p><a class="btn btn-primary" href="login.html">Sign in to portal</a>
           <a class="btn btn-outline" href="apply.html">Request a place</a>
           <a class="btn btn-ghost" href="https://hmgconcepts.pages.dev/" target="_blank" rel="noopener">HMG Concepts</a></p>
      </article>
'''


def body_hmg():
    return '''      <section class="help-card"><strong>HMG CONCEPTS Ecosystem</strong>
        <p>Tutoring Connect is operated by <b>HMG Technologies</b> within the HMG Concepts Ecosystem. Motto: <i>Recurring payments should not keep your schools from having online presences.</i></p></section>
      <div class="grid grid-2">
        <a class="card" href="https://hmgconcepts.pages.dev/" target="_blank" rel="noopener"><h3>HMG Concepts</h3><p>His Marvellous Grace. Est. 2015. Learning Deliberately. Teaching Authentically.</p></a>
        <a class="card" href="https://hmgtechnologies.pages.dev/" target="_blank" rel="noopener"><h3>HMG Technologies</h3><p>Parent of Tutoring Connect and School Connect.</p></a>
        <a class="card" href="https://hmgacademy.pages.dev/" target="_blank" rel="noopener"><h3>HMG Academy</h3><p>Virtual tutors and exam prep.</p></a>
        <a class="card" href="https://hmgmedia.pages.dev/" target="_blank" rel="noopener"><h3>HMG Media</h3><p>Story and brand.</p></a>
        <a class="card" href="https://hmggospel.pages.dev/" target="_blank" rel="noopener"><h3>HMG Gospel</h3><p>Faith arm of the ecosystem.</p></a>
        <a class="card" href="https://cssadewale.pages.dev/" target="_blank" rel="noopener"><h3>Adewale Samson Adeagbo</h3><p>Founder. AI-Augmented Solutions Developer · Data Scientist · STEM Educator. Lagos.</p></a>
      </div>
      <p style="margin-top:16px"><a class="btn btn-primary" href="https://wa.me/2348100866322" target="_blank" rel="noopener">WhatsApp HMG +234 810 086 6322</a></p>
'''


def body_notifications():
    return feature_card(
        'Multi-channel notifications — still free',
        'In-app bell, browser push after PWA install, plus compose-to-device email / WhatsApp / SMS. No OneSignal bill. Audience filters keep family messages closed.',
        ['Create a notice (or let a module fire one)', 'Bell badge updates in realtime', 'Optional push after install', 'mailto: / wa.me / sms: for outreach'],
        [('announcements.html', 'Announcements'), ('inbox.html', 'Inbox'), ('install.html', 'Install the app')]
    ) + '''      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-outline btn-sm" type="button" onclick="Notifications.requestPermission()">Enable browser push</button>
        <button class="btn btn-outline btn-sm" type="button" onclick="Notifications.markAllRead()">Mark all read</button>
      </div>
      <div id="notif-page-list"></div>
'''


def body_voting():
    return feature_card(
        'Voting & polls',
        'Prefect-style or studio polls: single, multi, ranked. Anonymous mode. Live tally via Supabase realtime. Parents and learners can vote; tutors create polls.',
        ['Create a poll', 'Share with the audience', 'Cast a ballot', 'Watch the live tally'],
        [('polls.html', 'Simple polls'), ('announcements.html', 'Announce a vote'), ('surveys.html', 'Longer surveys')]
    ) + '''      <div id="voting-root"></div>
'''


VOTING_JS = r'''
document.addEventListener('DOMContentLoaded', () => {
  if (typeof VotingUI !== 'undefined' && VotingUI.renderPollList) VotingUI.renderPollList();
  else if (window.CRUD) CRUD.renderList('polls');
});
'''


def body_profile():
    return feature_card(
        'Your profile',
        'Name, phone, timezone, Drive photo. Password change uses Supabase Auth. Photo is a link — never a byte in the 500 MB database.',
        None,
        [('change-password.html', 'Change password'), ('notifications.html', 'Notifications')]
    ) + '''      <div class="card" style="max-width:560px">
        <div class="form-group"><label>Full name</label><input class="form-input" id="fn"></div>
        <div class="form-group"><label>Phone / WhatsApp</label><input class="form-input" id="ph"></div>
        <div class="form-group"><label>Timezone</label><input class="form-input" id="tz" placeholder="Africa/Lagos"></div>
        <div class="form-group"><label>Photo URL (Drive)</label><input class="form-input" id="phu"></div>
        <div id="ph-prev"></div>
        <button class="btn btn-primary" type="button" id="sv">Save profile</button>
      </div>
'''


PROFILE_JS = r'''
document.addEventListener('DOMContentLoaded', () => {
  const p = window.TC_PROFILE || {};
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
  set('fn', p.full_name); set('ph', p.phone); set('tz', p.timezone||'Africa/Lagos'); set('phu', p.photo_url);
  document.getElementById('sv').onclick = async () => {
    if(!window.sb || !p.id){ toast('Sign in with Supabase to save.','warning'); return; }
    const { error } = await sb.from('profiles').update({
      full_name: document.getElementById('fn').value,
      phone: document.getElementById('ph').value,
      timezone: document.getElementById('tz').value,
      photo_url: document.getElementById('phu').value
    }).eq('id', p.id);
    if(error) toast(error.message,'danger'); else toast('Profile saved','success');
  };
});
'''


def body_login():
    # login is public — write a standalone public page, not the app shell
    return None


# Public pages handled separately
PUBLIC_STANDALONE = {'login', 'index', 'site-index', 'builder', 'cbt-exam', 'apply', 'exam-register', 'forgot-password', 'offline', 'install', 'contact'}


def write_login():
    html_out = head('Sign in', 'Sign in to ADEWALE CLASSROOM — official tutoring portal.') + '''<body>
<header class="public-nav" style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px">
  <a href="index.html" class="app-brand" style="border:0;padding:0"><img data-logo src="assets/img/logo.svg" width="36" alt=""><strong data-practice-name>ADEWALE CLASSROOM</strong></a>
  <nav><a href="about.html">About</a> · <a href="apply.html">Apply</a> · <a href="install.html">Install</a></nav>
</header>
<main class="container" style="max-width:480px;padding:48px 16px">
  <h1 class="serif">Studio sign in</h1>
  <p class="muted" data-practice-motto></p>
  <div style="display:flex;gap:8px;margin:16px 0">
    <button class="btn btn-primary" type="button" data-auth-tab="signin">Sign in</button>
    <button class="btn btn-ghost" type="button" data-auth-tab="signup">Request access</button>
  </div>
  <form id="form-signin" class="card" data-auth-panel="in">
    <div class="form-group"><label>Email, name or student ID (TC-0001)</label><input class="form-input" name="email" required autocomplete="username"></div>
    <div class="form-group"><label>Password</label><input class="form-input" type="password" name="password" required autocomplete="current-password"></div>
    <button class="btn btn-primary" type="submit">Sign in</button>
    <p class="help"><a href="forgot-password.html">Forgot password?</a></p>
  </form>
  <form id="form-signup" class="card" data-auth-panel="up" hidden>
    <div class="form-group"><label>Full name</label><input class="form-input" name="full_name" required></div>
    <div class="form-group"><label>Email</label><input class="form-input" type="email" name="email" required></div>
    <div class="form-group"><label>Phone</label><input class="form-input" name="phone"></div>
    <div class="form-group"><label>I am a</label>
      <select class="form-select" name="role">
        <option value="parent">Parent</option>
        <option value="student">Learner</option>
        <option value="tutor">Tutor</option>
        <option value="admin">Studio admin</option>
      </select>
    </div>
    <div class="form-group"><label>Password (min 8)</label><input class="form-input" type="password" name="password" minlength="8" required></div>
    <button class="btn btn-primary" type="submit">Request access</button>
    <p class="help">An admin approves you before sign-in works. That keeps family data closed.</p>
  </form>
</main>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/config.js"></script>
<script src="assets/js/catalog.js"></script>
<script src="assets/js/security-guard.js"></script>
<script src="assets/js/pwa-install.js"></script>
<script src="assets/js/app.js"></script>
</body></html>'''
    # login already included scripts in head() — that's ok, duplicate config is harmless but let's keep head scripts
    (ROOT / 'login.html').write_text(html_out)


def main():
    n = 0
    n += page('dashboard.html', 'Dashboard', 'Role-aware studio hub for ADEWALE CLASSROOM.', body_dashboard())
    n += page('analytics.html', 'Practice analytics', 'Studio KPIs, conversion, score bands. No AI API.', body_analytics())
    n += page('bookings.html', 'Cycle bookings', 'Full booking = 4 cycles × 7 days.', body_bookings(), BOOKINGS_JS)
    n += page('settings.html', 'Settings', 'Brand, timezone, accessibility, idle lock.', body_settings(), SETTINGS_JS, require='admin')
    n += page('feature-guide.html', 'Feature guide', 'Every Tutoring Connect module explained.', body_feature_guide(), FEATURE_JS)
    n += page('about.html', 'About', 'ADEWALE CLASSROOM — a product of HMG Technologies / HMG Concepts.', body_about(), require='')
    n += page('hmg-ecosystem.html', 'HMG Ecosystem', 'HMG Concepts, Technologies, Academy, Media, Gospel.', body_hmg())
    n += page('notifications.html', 'Notifications', 'In-app bell, push, email, WhatsApp, SMS.', body_notifications())
    n += page('voting.html', 'Voting & polls', 'Anonymous or named studio polls with live tally.', body_voting(), VOTING_JS)
    n += page('profile.html', 'My profile', 'Your studio profile.', body_profile(), PROFILE_JS)

    # catalog-driven extras
    for slug, (title, group, desc, mid) in EXTRA_PAGES.items():
        fn = slug + '.html'
        if fn in {'login.html', 'index.html', 'about.html', 'feature-guide.html', 'hmg-ecosystem.html',
                  'notifications.html', 'voting.html', 'profile.html', 'settings.html', 'analytics.html',
                  'bookings.html', 'dashboard.html'}:
            continue
        if fn in {'cbt-exam.html', 'apply.html', 'exam-register.html', 'builder.html', 'site-index.html'}:
            continue  # keep / rewrite separately
        key = slug
        n += page(fn, title, desc, body_generic(title, desc, mid, key))

    # NAV pages not already written
    written = {p.name for p in ROOT.glob('*.html')}
    for mid, icon, label, href, allow in NAV:
        if href in written:
            continue
        n += page(href, label, label + ' — ADEWALE CLASSROOM', body_generic(label, label, mid, mid.replace('-', '_')))

    write_login()
    print('rebuilt pages, last bytes sample', n)
    print('html count', len(list(ROOT.glob('*.html'))))


if __name__ == '__main__':
    main()
