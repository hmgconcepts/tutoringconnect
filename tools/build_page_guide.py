#!/usr/bin/env python3
"""
build_page_guide.py — Tutoring Connect V8

Generates assets/js/page-guide.js: a detailed, structured guide entry for EVERY
page in the studio. This is the single source of truth consumed by
  * chatbot.js      (the Studio Assistant)
  * site-help.js    (the "?" help button on every page)
  * feature-guide.html / site-index.html

Why generated rather than hand-written: there are 128 pages and they change.
A generated guide can never drift out of sync with the pages that actually
ship, and a missing page becomes impossible rather than merely unlikely.

Run from the repo root:  python3 tools/build_page_guide.py
"""
import json, re, glob, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# --------------------------------------------------------------------------
# 1. Scrape every page that actually exists
# --------------------------------------------------------------------------
def scrape():
    out = []
    for f in sorted(glob.glob('*.html')):
        s = open(f, encoding='utf-8', errors='ignore').read()
        def cl(m): return re.sub(r'\s+', ' ', re.sub('<[^>]+>', '', m.group(1))).strip() if m else ''
        title = cl(re.search(r'<title>(.*?)</title>', s, re.S))
        h1 = cl(re.search(r'class="page-title"[^>]*>(.*?)<', s, re.S) or re.search(r'<h1[^>]*>(.*?)<', s, re.S))
        tabs = sorted(set(re.findall(r'data-tab="([^"]+)"', s)))
        btns = sorted(set(b.strip() for b in re.findall(r'>\s*([A-Z][A-Za-z /&+-]{2,28})\s*</button>', s)))
        tables = len(re.findall(r'<table', s))
        forms = len(re.findall(r'<form', s))
        # ------------------------------------------------------------------
        # ITEM 6 — "remove irrelevant details on each page description".
        #
        # The scraper picked up every <button> on the page, including the ones
        # that belong to the SHELL rather than to the page. The result was that
        # 116 of 128 page descriptions ended with the sentence
        #
        #     "The main actions available here are: Sign out, Theme."
        #
        # which is true of every page in the studio, tells the reader nothing,
        # and — worse — was the ONLY "actions" sentence on the stub pages, so
        # the description of the At-risk board announced that its main actions
        # were signing out and changing the theme.
        #
        # Shell controls are now excluded. If nothing page-specific remains,
        # the sentence is dropped entirely rather than padded.
        # ------------------------------------------------------------------
        CHROME = {
            'close', 'cancel', 'ok', 'send', 'x', 'sign out', 'signout',
            'theme', 'toggle theme', 'toggle dark mode', 'dark mode', 'menu',
            'help', 'page help', 'about this page', 'back', 'next', 'previous',
            'install', 'install app', 'notifications', 'search', 'clear',
            'refresh', 'reload', 'print', 'toggle high contrast', 'skip to content'
        }
        out.append(dict(file=f, page=f[:-5], title=title, h1=h1, tabs=tabs[:8],
                        actions=[b for b in btns if b.strip().lower() not in CHROME][:8],
                        tables=tables, forms=forms))
    return out

# --------------------------------------------------------------------------
# 2. Pull the module catalogue (118 curated descriptions) out of catalog.js
# --------------------------------------------------------------------------
def modules():
    s = open('assets/js/catalog.js', encoding='utf-8').read()
    m = re.search(r'const MODULES = \[(.*?)\n  \];', s, re.S)
    out = {}
    for blk in re.findall(r'\{[^{}]*\}', m.group(1)):
        d = dict(re.findall(r"(\w+):\s*'((?:[^'\\]|\\.)*)'", blk))
        if d.get('file'):
            d['desc'] = d.get('desc', '').replace("\\'", "'")
            out[d['file']] = d
    return out

# --------------------------------------------------------------------------
# 3. Access model — must mirror assets/js/auth-guard.js exactly
# --------------------------------------------------------------------------
PUBLIC = {'index', 'login', 'about', 'contact', 'apply', 'register', 'signup',
          'forgot-password', 'offline', 'install', 'feature-guide', 'hmg-ecosystem',
          'hmg-products', 'developer', 'flyer', 'exam-register', 'public-book',
          'site-index'}
CODE_GATED = {'cbt-exam', 'cbt-multi', 'cbt-review'}
FAMILY = {'my-children', 'dashboard', 'scoresheet', 'insights', 'learner-360', 'calendar', 'bookings',
          'reading', 'practice', 'study-log', 'notifications', 'inbox', 'announcements',
          'profile', 'stream', 'classwork', 'invoices', 'payment-history',
          'progress-reports', 'certificates', 'transcripts', 'portfolio', 'forum',
          'voting', 'surveys', 'change-password', 'reminders', 'makeup-credits'}
OWNER_ONLY = {'admin-data', 'activity-log', 'safeguarding', 'compliance',
              'platform-health', 'storage', 'approvals', 'status-manager', 'payroll',
              'finance', 'license', 'settings', 'application-links'}

ACCESS_TEXT = {
 'public':     "Open to anyone, no sign-in needed. It is deliberately indexed by search engines so families can find the studio.",
 'code-gated': "Reachable without a portal password, but useless without a valid quiz code plus the learner's student ID. The code is the gate.",
 'family':     "Requires sign-in. Parents see only their own children; a learner sees only themselves. Row Level Security enforces this in the database, not just in the interface.",
 'staff':      "Requires sign-in as a tutor, admin or owner. Families cannot open it and the database refuses their queries even if they try the URL directly.",
 'owner':      "Owner/admin only. These pages control money, safeguarding, audit or platform configuration, so they sit behind the highest role check."}

AUDIENCE = {
 'Core': "Owner, admin and tutors do the data entry. Parents and learners only ever see their own linked records.",
 'Growth': "Owner and admin — this is business development. Families never see the pipeline.",
 'Sessions': "Tutors run this day to day. Parents and learners see their own sessions and nothing else.",
 'Learning': "Tutors author the content, learners work through it, parents watch the progress.",
 'Analytics': "Owner, admin and tutors see the full picture. A parent sees the same analysis narrowed to their own child.",
 'Finance': "Owner and admin. A parent sees only their own invoices, payments and receipts.",
 'Communication': "Everyone, scoped by role — staff broadcast, families receive and reply.",
 'Media & ops': "Owner and admin, for running the studio as a compliant business.",
 'Platform': "Owner and admin. This is configuration and governance, not day-to-day teaching."}

WHY = {
 'Core': "This is master data. If it is wrong here it is wrong everywhere downstream — bookings, invoices, analytics and reports all read from it.",
 'Growth': "Tutoring income is won or lost at the top of the funnel. Recording every enquiry means you can see which channel actually produces paying families.",
 'Sessions': "Attendance is what deducts hours from the hour bank, which is what justifies the invoice. Get this right and billing disputes disappear.",
 'Learning': "This is the actual teaching product. Everything a parent judges you on — scores, mastery, homework — originates from what is planned here.",
 'Analytics': "Parents pay for visible progress. These pages turn raw scores into an argument a parent can read, audit and trust.",
 'Finance': "Cash flow keeps the studio alive. Because hours, rates and sessions are already in the system, the money side is arithmetic rather than guesswork.",
 'Communication': "Most churn is silence. A parent who hears from you weekly renews; one who hears nothing assumes nothing is happening.",
 'Media & ops': "These registers are what a parent, a school or an inspector asks to see. Keeping them current is cheap; reconstructing them later is not.",
 'Platform': "Configuration decides who can see what. A mistake here is a privacy incident, so every change is written to the activity log."}

HOW = {
 'Core': ["Open the page — the list loads with a search box and filters at the top.",
          "Click <b>Add / New</b> to create a record. Only the marked fields are required; the rest can be completed later.",
          "Click any row to open the full record, edit it inline, and save.",
          "Use <b>Export CSV</b> whenever you want a copy — the data belongs to the studio, not the platform."],
 'Growth': ["New enquiries land here automatically from the public Apply form and the contact form.",
            "Triage each one: assign an owner, set a status, add a note about what was discussed.",
            "Convert a warm enquiry into a trial lesson, then into a full engagement once they commit.",
            "Watch the funnel counts at the top — they show you exactly where prospects go cold."],
 'Sessions': ["Choose the date range or the engagement you are working on.",
              "Create or open a session and set the date, time, duration and tutor.",
              "Mark attendance — this is the step that deducts hours from the hour bank.",
              "Write session notes so the parent has a permanent record of what was actually taught."],
 'Learning': ["Pick the engagement, and the learner if it is a group.",
              "Add or import the items you need — topics, tasks, questions or reading links.",
              "Publish, so the learner sees it on their own dashboard.",
              "Track completion and scores as the work comes back in."],
 'Analytics': ["Select the learner, group or period you want to examine.",
               "Read the headline numbers first, then open the charts underneath.",
               "Every figure is a published formula, never a black box — open the methodology note to see the arithmetic.",
               "Print or export the view and take it into a parent conference."],
 'Finance': ["Set your rates and packages once in the fee catalogue.",
             "Generate the invoice from a booking or an hour bank — the maths is done for you.",
             "Record each payment as it arrives and issue the receipt.",
             "Reconcile the totals at month end against your bank."],
 'Communication': ["Write the message and choose the audience — a role, an engagement, or one person.",
                   "Send in-app: the bell and the push notification fire immediately.",
                   "For WhatsApp, email or SMS the platform opens your own device app, so there is no paid gateway and no per-message cost.",
                   "Check the delivery log afterwards to confirm who actually received it."],
 'Media & ops': ["Open the register and read the current entries.",
                 "Add a new record with the date, the responsible person and any supporting link.",
                 "Keep evidence as a Drive or https link rather than an upload — that is what protects your free storage quota.",
                 "Review on a schedule; several of these registers are exactly what an inspector asks for."],
 'Platform': ["Only an owner or admin should change anything on this page.",
              "Read the note beside each setting before you touch it.",
              "Save, then reload any normal page to confirm the change took effect.",
              "If something looks wrong afterwards, the activity log records who changed what and when."]}


# --------------------------------------------------------------------------
# 3b. SECTION MODEL (V9)
# The pages render their content with JavaScript, so there is almost no static
# section markup to scrape. Section descriptions are therefore MODELLED from
# the page archetype rather than guessed — every module of a given group shares
# the same shell, so this is accurate rather than decorative.
# --------------------------------------------------------------------------
SECTIONS = {
 'list': [
   ('Page header', 'The title, a one-line purpose, and the ? Page Help button that opens this same explanation inside the app.'),
   ('Toolbar / filters', 'Search box, status and date filters, and the Add / New button. Filters narrow the list below without reloading the page.'),
   ('Records table', 'Every record you are allowed to see. Parents and learners are filtered to their own rows by the database itself, not by hiding buttons.'),
   ('Row actions', 'Open, edit, duplicate or delete a record. Deleting asks for confirmation and is written to the activity log.'),
   ('Record form (modal)', 'Opens over the list. Required fields are marked; everything else can be completed later.'),
   ('Export', 'Download the current view as CSV. Your data is always portable — nothing is locked in.'),
 ],
 'analytics': [
   ('Selector strip', 'Choose the learner, group, subject or period you want to analyse.'),
   ('Headline figures', 'The KPI tiles. Read these first — they summarise the whole view.'),
   ('Charts', 'SVG charts drawn locally, with a table fallback if a chart cannot render.'),
   ('Methodology note', 'The published formula behind every number. Nothing here is a black box, so you can defend any figure to a parent.'),
   ('Print / export', 'Produces a clean, chrome-free layout suitable for a parent conference.'),
 ],
 'form': [
   ('Introduction', 'Explains who the form is for and what happens after submission.'),
   ('Form fields', 'The information being collected. Validation runs as you type.'),
   ('Submit', 'Writes the record and shows a confirmation. Public forms submit through a security-definer function, never direct table access.'),
   ('What happens next', 'Where the submission lands and who reviews it.'),
 ],
 'settings': [
   ('Section groups', 'Related settings are grouped into cards; each control has a note explaining its effect.'),
   ('Save', 'Applies changes for every device at once — these are stored in the database, not in your browser.'),
   ('Danger zone', 'Irreversible or high-impact actions, deliberately separated and confirmation-gated.'),
 ],
 'public': [
   ('Hero', 'The headline promise and the primary call to action.'),
   ('Proof', 'Statistics and feature cards that answer "why should I trust this studio?".'),
   ('Call to action', 'Sign in, or request a place.'),
   ('Footer', 'Contact details, social links and the HMG Concepts ecosystem links, which also help search engines connect the sites.'),
 ],
}

ROLE_VIEWS = {
 'Core': {'owner': 'Full read/write across every record.',
          'tutor': 'Read/write for the engagements they teach.',
          'parent': 'Only their own children appear.',
          'learner': 'Only their own record appears.'},
 'Growth': {'owner': 'Full pipeline and conversion figures.',
            'tutor': 'Usually read-only; may add notes after a trial.',
            'parent': 'No access.', 'learner': 'No access.'},
 'Sessions': {'owner': 'Every session in the studio.',
              'tutor': 'Their own timetable, attendance and notes.',
              'parent': "Their child's classes, dates, times and amounts.",
              'learner': 'Their own upcoming and past classes.'},
 'Learning': {'owner': 'Everything, plus quality oversight.',
              'tutor': 'Authors and marks the work.',
              'parent': 'Sees what was set and whether it was completed.',
              'learner': 'Does the work and sees their feedback.'},
 'Analytics': {'owner': 'Studio-wide analysis and at-risk board.',
               'tutor': 'Their own learners.',
               'parent': 'The same analysis narrowed to their own child.',
               'learner': 'Their own progress only.'},
 'Finance': {'owner': 'All money: invoices, payments, payroll, totals.',
             'tutor': 'Their own payroll only.',
             'parent': 'Their own invoices, payments and receipts.',
             'learner': 'No access.'},
 'Communication': {'owner': 'Broadcast to any audience.',
                   'tutor': 'Message their own families.',
                   'parent': 'Receive and reply.', 'learner': 'Receive and reply.'},
 'Media & ops': {'owner': 'Full access — these are the compliance registers.',
                 'tutor': 'Limited, task-dependent.',
                 'parent': 'No access.', 'learner': 'No access.'},
 'Platform': {'owner': 'Full configuration control.',
              'tutor': 'No access.', 'parent': 'No access.', 'learner': 'No access.'},
}

TASKS = {
 'learners.html': ['add a new learner', 'find a student ID', 'record an accommodation', 'export the learner list'],
 'attendance.html': ['mark attendance', 'record an absence', 'fix a wrong attendance mark'],
 'bookings.html': ['create a booking', 'work out the amount due', 'see how many classes remain'],
 'invoices.html': ['raise an invoice', 'print an invoice', 'chase an unpaid invoice'],
 'payments.html': ['record a payment', 'issue a receipt'],
 'scoresheet.html': ['see my child\'s scores', 'check a graded quiz result', 'print a score report'],
 'practice.html': ['create a quiz', 'import questions from CSV', 'set a graded quiz'],
 'cbt-exam.html': ['take a quiz', 'enter a quiz code', 'save my result as PDF'],
 'sessions.html': ['schedule a class', 'add a meeting link', 'cancel a class'],
 'engagements.html': ['create a 1:1 contract', 'create a group', 'set an hourly rate'],
 'parents.html': ['link a parent to a child', 'give a parent portal access'],
 'approvals.html': ['approve a new account', 'reject a sign-up'],
 'admin-data.html': ['back up the studio', 'restore a backup', 'set up Google Drive sync'],
 'platform-health.html': ['check keep-alive health', 'stop the project pausing', 'write a heartbeat'],
 'settings.html': ['change the studio name', 'change the logo', 'set the timezone'],
 'inbox.html': ['message a parent', 'reply to a message'],
 'reading.html': ['set reading before a class', 'add a YouTube or Drive link'],
 'insights.html': ['prove progress to a parent', 'check who is at risk'],
 'exam-register.html': ['register for WAEC or IGCSE', 'upload a passport photo link'],
 'apply.html': ['request a place', 'apply for tutoring'],
 'install.html': ['install the app', 'get class reminders'],
 'login.html': ['sign in', 'reset my password'],
}

FAQS = {
 'bookings.html': [('How is the amount calculated?',
                    'Amount = hours x hourly rate, where hours = classes x duration. A full booking is 4 cycles of 7 days, so 2 classes per cycle gives 8 classes.'),
                   ('Can a parent see this?', 'Yes — the parent sees the same dates, times, duration and amount on their own dashboard.')],
 'scoresheet.html': [('Where do these scores come from?',
                      'Graded quizzes push themselves here automatically via a database trigger, alongside scheme-of-work evaluations and homework marks.'),
                     ('Can another family see my child\'s scores?',
                      'No. Row Level Security filters every query by family in the database itself, so even a typed URL returns nothing.')],
 'practice.html': [('Does this use AI?', 'No. There is no paid AI API anywhere in the platform. Questions are imported from CSV or pasted from any free chat tool.'),
                   ('What are the three quiz modes?', 'Self (unmarked practice), Review (answers plus explanations plus PDF) and Graded (auto-pushes to the scoresheet).')],
 'admin-data.html': [('Where are backups stored?', 'A sealed SHA-256 JSON archive downloads to your device, and optionally syncs to your own Google Drive folder.'),
                     ('Does Drive sync cost anything?', 'No. It uses the free Google Identity Services flow and the drive.file scope, which can only see files this app created.')],
 'platform-health.html': [('Why would the project pause?', 'Supabase pauses a free project after 7 days without database activity. The keep-alive layers prevent that.'),
                          ('What if it already paused?', 'Open the Supabase dashboard and press Restore. Data is safe — but a project left paused is eventually deleted.')],
}

# ---------------------------------------------------------------------------
# ITEM 6 — per-page role views, derived rather than boilerplate.
#
# roleViews used to be looked up by GROUP, which produced statements that were
# simply false. The "About" page — which is public, linked from every footer
# and deliberately indexed by search engines — carried:
#
#     tutor: "No access."   parent: "No access."   learner: "No access."
#
# A page description that contradicts what the reader can plainly see is worse
# than no description. Role views are now computed from the same access model
# the application enforces.
# ---------------------------------------------------------------------------
SHELL_PAGES = {'dashboard', 'profile', 'change-password', 'notifications',
               'inbox', 'messages', 'offline', 'install', 'about',
               'feature-guide', 'site-index', 'contact', 'helpdesk',
               'hmg-ecosystem', 'hmg-products'}

def role_views(pg, access):
    """What each role actually gets on this page, in one honest sentence each."""
    if access == 'public':
        return {'owner':   'Full access, and can edit the content behind it in Settings.',
                'tutor':   'Full access — it is a public page.',
                'parent':  'Full access — it is a public page.',
                'learner': 'Full access — it is a public page.'}
    if access == 'code-gated':
        return {'owner':   'Can open any paper and see every candidate.',
                'tutor':   'Can open the papers assigned to them.',
                'parent':  'No access — a parent does not sit the paper.',
                'learner': 'Opens their own paper with the quiz code and their student ID.'}
    if pg in SHELL_PAGES:
        return {'owner': 'Full access.', 'tutor': 'Full access.',
                'parent': 'Their own view of it.', 'learner': 'Their own view of it.'}
    if access == 'owner':
        return {'owner':   'Full access.',
                'tutor':   'No access — this page controls money, audit or configuration.',
                'parent':  'No access.', 'learner': 'No access.'}
    if access == 'family':
        return {'owner':   'Full access across every learner.',
                'tutor':   'Full access for the learners assigned to them.',
                'parent':  'Read-only, and only for their own children.',
                'learner': 'Read-only, and only their own record.'}
    return {'owner':   'Full access.',
            'tutor':   'Full access for the learners and groups assigned to them, and nothing else.',
            'parent':  'No access.', 'learner': 'No access.'}


# ---------------------------------------------------------------------------
# ITEM 6 — related links that are actually related.
#
# `related` was filled with the first six alphabetical siblings from the same
# catalogue group. That is how the About page came to recommend "activity-log,
# admin-data, approvals" to a prospective parent. Related pages now come from
# the navigation model, which groups pages by what a person is trying to do.
# ---------------------------------------------------------------------------
def nav_neighbours():
    """page -> (section title, [sibling pages in menu order])"""
    path = os.path.join(ROOT, 'assets', 'js', 'nav-model.js')
    if not os.path.exists(path):
        return {}
    src = open(path, encoding='utf-8').read()
    m = re.search(r'w\.TC_NAV_MODEL = (\[.*?\]);', src, re.S)
    if not m:
        return {}
    model = json.loads(m.group(1))
    out = {}
    for sect in model:
        pages = [i['href'][:-5] for i in sect['items']]
        for p in pages:
            out[p] = (sect['title'], [q for q in pages if q != p])
    return out


def archetype(pg, grp, access):
    if access == 'public': return 'public'
    if pg in ('settings', 'platform-health', 'license', 'status-manager'): return 'settings'
    if grp == 'Analytics': return 'analytics'
    if pg in ('apply', 'exam-register', 'public-book', 'contact', 'login',
              'forgot-password', 'change-password', 'profile'): return 'form'
    return 'list'

CUSTOM = json.load(open('tools/page_guide_custom.json', encoding='utf-8')) \
         if os.path.exists('tools/page_guide_custom.json') else {}

def build():
    pages, mods = scrape(), modules()
    neigh = nav_neighbours()
    by_group = collections.defaultdict(list)
    for p in pages:
        m = mods.get(p['file'])
        by_group[(m or {}).get('group', 'Platform')].append(p['page'])

    guide = {}
    for p in pages:
        f, pg = p['file'], p['page']
        m = mods.get(f)
        grp = (m or {}).get('group', 'Platform')

        if pg in PUBLIC: access = 'public'
        elif pg in CODE_GATED: access = 'code-gated'
        elif pg in OWNER_ONLY: access = 'owner'
        elif pg in FAMILY: access = 'family'
        else: access = 'staff'

        c = CUSTOM.get(f, {})
        base = c.get('purpose') or (m or {}).get('desc') or (p['h1'] + ' module.')
        title = p['h1'] or p['title'] or pg

        # Compose a genuinely page-specific narrative rather than boilerplate.
        detail = [base]
        if p['tabs']:
            detail.append("This page is organised into %d sections: %s." %
                          (len(p['tabs']), ', '.join('<b>%s</b>' % t for t in p['tabs'])))
        if p['actions']:
            detail.append("What you can do here: %s." %
                          ', '.join('<b>%s</b>' % a for a in p['actions']))
        if p['forms'] and not p['tabs']:
            detail.append("It is form-driven — you fill a form and save; the record appears in the list immediately.")
        detail.append(ACCESS_TEXT[access])

        # builder/wizard pages exist only in the generator; a CLIENT build must
        # never link to them or the ZIP ships a broken link.
        GENERATOR_ONLY = {'builder'}
        # Menu neighbours first (semantically related), catalogue group second.
        sect_title, sect_sibs = neigh.get(pg, (None, []))
        siblings = [x for x in sect_sibs if x not in GENERATOR_ONLY][:6]
        if not siblings:
            siblings = [x for x in by_group[grp] if x != pg and x not in GENERATOR_ONLY][:6]
        if c.get('related'):
            siblings = c['related'][:6]

        arch = archetype(pg, grp, access)
        guide[pg] = dict(
            page=pg, file=f, title=title, group=grp, access=access,
            archetype=arch,
            sections=[{'name': n, 'what': wtxt} for n, wtxt in SECTIONS[arch]],
            roleViews=c.get('roleViews') or role_views(pg, access),
            tasks=TASKS.get(f, []),
            faqs=[{'q': q, 'a': a} for q, a in FAQS.get(f, [])],
            purpose=base,
            detail=' '.join(detail),
            audience=c.get('audience') or AUDIENCE.get(grp, AUDIENCE['Platform']),
            why=c.get('why') or WHY.get(grp, WHY['Platform']),
            how=c.get('how') or HOW.get(grp, HOW['Platform']),
            connects=c.get('connects') or (
                "Found under <b>%s</b> in the menu%s. Every record is scoped to the engagement "
                "it belongs to, so one learner's data never appears inside another's, and a "
                "tutor sees only the learners assigned to them." %
                (sect_title or grp,
                 (", next to " + ', '.join(siblings[:4])) if siblings else '')),
            related=siblings,
            actions=p['actions'], tabs=p['tabs'])
    return guide

def main():
    g = build()
    js = ("/* ============================================================================\n"
          "   page-guide.js — AUTO-GENERATED by tools/build_page_guide.py. Do not edit by hand.\n"
          "   A detailed guide entry for every page in the studio: what it is, who it is\n"
          "   for, why it matters, how to use it, and what it connects to.\n"
          "   Consumed by chatbot.js (Studio Assistant), site-help.js, feature-guide.html.\n"
          "   ==========================================================================*/\n"
          "(function (w) {\n  var PAGE_GUIDE = " + json.dumps(g, indent=1, ensure_ascii=False) + ";\n"
          "  w.TC = w.TC || {};\n  w.TC.PAGE_GUIDE = PAGE_GUIDE;\n  w.PAGE_GUIDE = PAGE_GUIDE;\n})(window);\n")
    open('assets/js/page-guide.js', 'w', encoding='utf-8').write(js)
    print("page-guide.js: %d pages" % len(g))
    print("access mix:", dict(collections.Counter(v['access'] for v in g.values())))
    print("avg detail length: %d chars" % (sum(len(v['detail']) for v in g.values()) / len(g)))
    short = [k for k, v in g.items() if len(v['detail']) < 200]
    print("entries under 200 chars:", len(short), short[:8])
    print("with sections:", sum(1 for v in g.values() if v.get('sections')))
    print("with role views:", sum(1 for v in g.values() if v.get('roleViews')))
    print("with tasks:", sum(1 for v in g.values() if v.get('tasks')))
    print("with FAQs:", sum(1 for v in g.values() if v.get('faqs')))
    tot = sum(len(v.get('sections', [])) for v in g.values())
    print("total documented sections:", tot)

if __name__ == '__main__':
    main()
