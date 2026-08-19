#!/usr/bin/env python3
"""
tools/build_nav_model.py
================================================================================
Generates assets/js/nav-model.js — the ONE canonical description of the
navigation pane.

WHY THIS EXISTS
--------------------------------------------------------------------------------
The navigation pane used to be 126 hand-written <a> tags repeated verbatim in
128 HTML files, filtered at runtime by TWO independent systems that disagreed
with each other (App.applyRoleNav and RBAC.apply). Three separate defects came
out of that arrangement, all of them reported:

  * "the pages on the navigation pane keep changing when the pane is accessed"
    Both filters mutate style.display on the same elements. App re-shows what
    its own rules allow; RBAC only ever hides. Whichever ran last won, and
    which ran last depended on how quickly the Supabase session resolved. The
    same account genuinely saw a different menu on different page loads.

  * "when a public page is selected, pages that should not be in that role's
    pane appear"
    Before the session resolves, App.currentRole is 'guest' and RBAC refuses to
    act on an unknown role (correctly — acting on it was the V23 lockout bug).
    So for the first few hundred milliseconds of EVERY page load the pane
    showed the full 126-item administrator menu to everyone.

  * "the icons or pages are scattered, unordered"
    ensureEssentialNav() appended anything missing to the END of the pane,
    below the last section heading, and normalizeNavOrder() re-sorted links
    in place on every call.

The fix is structural, not another patch on top: describe the menu ONCE, here,
and have assets/js/nav.js rebuild the pane from that description. A rebuild is
idempotent — running it ten times produces byte-identical markup — so the pane
cannot drift, cannot reorder itself and cannot gain or lose an item.

This script also fixes content defects found while auditing the old markup:

  * THREE separate items were all labelled "Learners" (learners.html,
    family-links.html and my-children.html). Two of them are now named for
    what they actually are.
  * cbt-review.html, site-index.html and flyer.html are real, reachable pages
    that appeared nowhere in the pane at all.
  * Every single item used the same "•" bullet as its icon, which is why the
    report describes the icons as interchangeable. Every item now has an icon
    that means something.
  * Section headings mixed styles ("◈ Core" against "• Comms") and grouped
    "About the developer" with "Storage manager". The sections below are
    grouped by what a person is trying to DO.

Run:  python3 tools/build_nav_model.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ==============================================================================
# THE CANONICAL MENU
#
# Order here IS the order on screen. Each item is:
#     (module_id, href, label, icon, audience)
#
# `audience` is a coarse hint used only when the role is not yet known, so the
# first paint of a page shows something honest instead of the full admin menu:
#     'public' — safe for anyone, signed in or not
#     'user'   — any signed-in account
#     'staff'  — tutors and administrators
#     'admin'  — administrators / owner only
#
# The AUTHORITATIVE decision is still RBAC.level(href, role) at runtime. This
# field only governs the pre-session paint.
# ==============================================================================
SECTIONS = [
    ("🏠", "My studio", [
        ("dashboard",        "dashboard.html",        "Dashboard",                    "🏠", "user"),
        ("profile",          "profile.html",          "My profile",                   "👤", "user"),
        ("notifications",    "notifications.html",    "Notifications",                "🔔", "user"),
        ("inbox",            "inbox.html",            "Inbox",                        "📥", "user"),
        ("messages",         "messages.html",         "Messaging (WA / Email / SMS)", "💬", "staff"),
        ("change_password",  "change-password.html",  "Change password",              "🔑", "user"),
        ("install",          "install.html",          "Install the app",              "📲", "public"),
    ]),

    ("👥", "People", [
        ("learners",      "learners.html",      "Learners",              "🎓", "staff"),
        ("parents",       "parents.html",       "Parents & guardians",   "👪", "staff"),
        ("tutors",        "tutors.html",        "Tutors",                "🧑‍🏫", "staff"),
        ("groups",        "groups.html",        "Groups & cohorts",      "👥", "staff"),
        ("engagements",   "engagements.html",   "Engagements",           "🤝", "staff"),
        ("subjects",      "subjects.html",      "Subjects",              "📘", "staff"),
        # Renamed: this page links a parent account to a child record. Calling
        # it "Learners" made three menu items share one label.
        ("family_links",  "family-links.html",  "Parent–child links",    "🔗", "staff"),
        ("my_children",   "my-children.html",   "My children",           "🧒", "user"),
        ("directory",     "directory.html",     "Directory",             "📇", "staff"),
        ("idcards",       "idcards.html",       "Learner cards",         "🪪", "staff"),
        ("birthdays",     "birthdays.html",     "Birthdays",             "🎂", "staff"),
    ]),

    ("🗓️", "Scheduling", [
        ("calendar",         "calendar.html",         "Calendar",                    "📅", "user"),
        ("sessions",         "sessions.html",         "Sessions",                    "🗒️", "staff"),
        ("bookings",         "bookings.html",         "Cycle bookings",              "📆", "user"),
        ("public_book",      "public-book.html",      "Public self-booking",         "🌍", "public"),
        ("availability",     "availability.html",     "Availability",                "⏱️", "staff"),
        ("attendance",       "attendance.html",       "Attendance",                  "✅", "staff"),
        ("session_complete", "session-complete.html", "Complete a class",            "🏁", "staff"),
        ("session_notes",    "session-notes.html",    "Session notes",               "📝", "staff"),
        ("makeups",          "makeups.html",          "Make-up sessions",            "🔄", "staff"),
        ("makeup_credits",   "makeup-credits.html",   "Makeup credit bank",          "🎟️", "user"),
        ("cancellations",    "cancellations.html",    "Cancellations",               "🚫", "staff"),
        ("meetings",         "meetings.html",         "Meeting links",               "🔗", "staff"),
        ("whiteboard",       "whiteboard.html",       "Whiteboard rooms",            "🖊️", "staff"),
        ("reminders",        "reminders.html",        "Lesson reminders + calendar", "⏰", "user"),
        ("rooms",            "rooms.html",            "Rooms / locations",           "🏫", "staff"),
        ("substitutions",    "substitutions.html",    "Cover tutors",                "🔁", "staff"),
        ("timezones",        "timezones.html",        "Timezone desk",               "🌐", "staff"),
        ("events",           "events.html",           "Workshops & events",          "🎪", "staff"),
    ]),

    ("📚", "Teaching", [
        ("curriculum",      "curriculum.html",      "Curriculum maps",        "🗺️", "staff"),
        ("sow",             "sow.html",             "Scheme of work",         "📋", "staff"),
        ("lesson_plans",    "lesson-plans.html",    "Lesson plans",           "📄", "staff"),
        ("methodologies",   "methodologies.html",   "Methodologies",          "🧭", "staff"),
        ("diagnostics",     "diagnostics.html",     "Diagnostics",            "🩺", "staff"),
        ("goals",           "goals.html",           "Goals & learning plans", "🎯", "staff"),
        ("mastery",         "mastery.html",         "Topic mastery",          "🧩", "staff"),
        ("assignments",     "assignments.html",     "Homework",               "📌", "staff"),
        ("classwork",       "classwork.html",       "Classwork",              "✏️", "user"),
        ("reading",         "reading.html",         "Reading assignments",    "📖", "user"),
        ("stream",          "stream.html",          "Class stream",           "📢", "user"),
        ("rubrics",         "rubrics.html",         "Rubrics",                "📏", "staff"),
        ("accommodations",  "accommodations.html",  "Accommodations / SEN",   "♿", "staff"),
        ("learning_styles", "learning-styles.html", "Learning styles",        "🧠", "staff"),
        ("study_log",       "study-log.html",       "Study log / timer",      "⏳", "user"),
        ("flashcards",      "flashcards.html",      "Spaced practice",        "🃏", "staff"),
        ("gamification",    "gamification.html",    "Streaks & badges",       "🏅", "staff"),
    ]),

    ("🧪", "Quizzes & CBT", [
        ("practice",     "practice.html",     "Quizzes — Self / Review / Graded", "🧪", "user"),
        ("cbt_exam",     "cbt-exam.html",     "Take a quiz",                      "▶️", "public"),
        ("cbt_review",   "cbt-review.html",   "Review my paper",                  "🔍", "user"),
        ("cbt_multi",    "cbt-multi.html",    "Multi-subject CBT builder",        "🧮", "staff"),
        ("cbt_prompts",  "cbt-prompts.html",  "Question bank prompts",            "💡", "staff"),
        ("cbt_results",  "cbt-results.html",  "CBT results & audit",              "📊", "staff"),
        ("exam_targets", "exam-targets.html", "Exam targets",                     "🎯", "staff"),
        ("exam_register","exam-register.html","Exam registration",                "🖊️", "public"),
        ("exam_links",   "exam-links.html",   "Exam registration links",          "🔗", "staff"),
    ]),

    ("📈", "Progress & analytics", [
        ("scoresheet",       "scoresheet.html",       "Scoresheet",         "🧾", "user"),
        ("progress_reports", "progress-reports.html", "Progress reports",   "📄", "user"),
        ("learner_360",      "learner-360.html",      "Learner 360",        "🔭", "user"),
        ("insights",         "insights.html",         "Insights Lab",       "🔬", "user"),
        ("analytics",        "analytics.html",        "Practice analytics", "📈", "staff"),
        ("group_insights",   "group-insights.html",   "Group insights",     "👨‍👩‍👧‍👦", "staff"),
        ("at_risk",          "at-risk.html",          "At-risk board",      "⚠️", "staff"),
        ("predictions",      "predictions.html",      "Predicted grades",   "🔮", "staff"),
        ("value_added",      "value-added.html",      "Value-added",        "📐", "staff"),
        ("transcripts",      "transcripts.html",      "Transcripts",        "🗃️", "user"),
        ("certificates",     "certificates.html",     "Certificates",       "🏆", "user"),
        ("portfolio",        "portfolio.html",        "Learner portfolio",  "🗂️", "user"),
    ]),

    ("📖", "Resources", [
        ("resources",  "resources.html",  "Resource library",    "📚", "staff"),
        ("library",    "library.html",    "Digital library",     "🏛️", "staff"),
        ("lms",        "lms.html",        "Mini LMS",            "💻", "staff"),
        ("eresources", "eresources.html", "E-resources / notes", "🗒️", "staff"),
    ]),

    # ------------------------------------------------------------------------
    # NEW SECTION (report item 8). Free outreach classes taught on YouTube,
    # Zoom, Google Meet or Free Conference with a WhatsApp/Telegram group
    # alongside, aimed at national and international examinations.
    # ------------------------------------------------------------------------
    ("🎁", "Free & outreach classes", [
        ("free_classes",  "free-classes.html",  "Free class cohorts",  "🎁", "staff"),
        ("free_register", "free-register.html", "Free class sign-up",  "🖊️", "public"),
    ]),

    ("💳", "Money", [
        ("invoices",        "invoices.html",        "Invoices",                "🧾", "user"),
        ("payments",        "payments.html",        "Payments",                "💵", "staff"),
        ("payment_history", "payment-history.html", "Payment history",         "🕓", "user"),
        ("payment_plans",   "payment-plans.html",   "Payment plans",           "📑", "staff"),
        ("wallet",          "wallet.html",          "Prepaid wallet",          "👛", "user"),
        ("packages",        "packages.html",        "Hour banks",              "⏲️", "staff"),
        ("fees",            "fees.html",            "Fee catalogue",           "🏷️", "staff"),
        ("products",        "products.html",        "Books & materials",       "📦", "staff"),
        ("scholarships",    "scholarships.html",    "Scholarships & discounts","🎓", "staff"),
        ("finance",         "finance.html",         "Practice finance",        "📊", "admin"),
        ("payroll",         "payroll.html",         "Tutor payroll",           "💼", "admin"),
    ]),

    ("📣", "Communication", [
        ("announcements",   "announcements.html",   "Announcements",       "📣", "user"),
        ("broadcasts",      "broadcasts.html",      "Result broadcasts",   "📡", "staff"),
        ("forum",           "forum.html",           "Group forum",         "🗣️", "user"),
        ("polls",           "polls.html",           "Polls",               "📊", "staff"),
        ("voting",          "voting.html",          "Voting & polls",      "🗳️", "user"),
        ("surveys",         "surveys.html",         "Surveys & CSAT",      "📝", "user"),
        ("complaints",      "complaints.html",      "Complaints",          "❗", "user"),
        ("helpdesk",        "helpdesk.html",        "Help desk",           "🎧", "user"),
        ("parent_meetings", "parent-meetings.html", "Parent conferences",  "🤝", "staff"),
        ("gallery",         "gallery.html",         "Gallery",             "🖼️", "staff"),
        ("reviews",         "reviews.html",         "Reviews & testimonials", "⭐", "staff"),
    ]),

    ("✉️", "Enrolment & growth", [
        ("apply",             "apply.html",             "Request a place",       "✉️", "public"),
        ("application_links", "application-links.html", "Application links",     "🔗", "admin"),
        ("inquiries",         "inquiries.html",         "Inquiries",             "📨", "staff"),
        ("trials",            "trials.html",            "Trial lessons",         "🎬", "staff"),
        ("waitlist",          "waitlist.html",          "Waitlist",              "⏳", "staff"),
        ("onboarding",        "onboarding.html",        "Onboarding checklists", "🧳", "staff"),
        ("referrals",         "referrals.html",         "Referrals",             "🎁", "staff"),
    ]),

    ("🗂️", "Records & compliance", [
        ("documents",       "documents.html",       "Contracts & consent",    "📃", "staff"),
        ("policies",        "policies.html",        "Policies",               "📕", "staff"),
        ("compliance",      "compliance.html",      "Compliance",             "☑️", "admin"),
        ("safeguarding",    "safeguarding.html",    "Safeguarding log",       "🛡️", "admin"),
        ("security_centre", "security-centre.html", "Security & compliance",  "🔒", "admin"),
        ("approvals",       "approvals.html",       "Approvals",              "👍", "admin"),
        ("activity_log",    "activity-log.html",    "Activity log",           "📜", "admin"),
        ("leave",           "leave.html",           "Tutor leave",            "🌴", "staff"),
    ]),

    ("⚙️", "Administration", [
        ("settings",        "settings.html",        "Settings",         "⚙️", "admin"),
        ("admin_data",      "admin-data.html",      "Admin data",       "🗄️", "admin"),
        ("storage",         "storage.html",         "Storage manager",  "💾", "admin"),
        ("platform_health", "platform-health.html", "Platform health",  "💚", "admin"),
        ("status_manager",  "status-manager.html",  "Roles & status",   "🎚️", "admin"),
        ("license",         "license.html",         "Site license",     "📜", "admin"),
    ]),

    ("🌐", "HMG Concepts", [
        ("hmg_products",  "hmg-products.html",  "HMG Digital Products", "🛍️", "public"),
        ("hmg_ecosystem", "hmg-ecosystem.html", "HMG Ecosystem",        "🌐", "public"),
    ]),

    ("❓", "Help & information", [
        ("feature_guide", "feature-guide.html", "Feature guide",       "📘", "public"),
        ("site_index",    "site-index.html",    "All pages A–Z",       "🔤", "public"),
        ("about",         "about.html",         "About the studio",    "ℹ️", "public"),
        ("contact",       "contact.html",       "Contact",             "📞", "public"),
        ("developer",     "developer.html",     "About the developer", "🧑‍💻", "public"),
        ("flyer",         "flyer.html",         "Printable flyer",     "🖨️", "public"),
    ]),
]


def build():
    items = []
    model = []
    seen_id, seen_href = set(), set()
    for icon, title, entries in SECTIONS:
        sect = {"icon": icon, "title": title, "items": []}
        for mid, href, label, ico, aud in entries:
            if mid in seen_id:
                sys.exit("duplicate module id: %s" % mid)
            if href in seen_href:
                sys.exit("duplicate href: %s" % href)
            seen_id.add(mid)
            seen_href.add(href)
            sect["items"].append({"id": mid, "href": href, "label": label,
                                  "icon": ico, "aud": aud})
            items.append(href)
        model.append(sect)

    # ---- Guard: every menu target must be a page that exists. A menu that
    # links to a 404 is worse than a menu that omits the page.
    missing = [h for h in items if not os.path.exists(os.path.join(ROOT, h))]
    if missing:
        print("  ! menu targets that do not exist yet: %s" % ", ".join(missing))

    # ---- Guard: every page that should be reachable IS in the menu.
    NOT_IN_MENU = {
        "index.html",            # the public landing page, reached by the logo
        "login.html",            # reached when signed out
        "forgot-password.html",  # reached from login
        "offline.html",          # shown by the service worker
        "builder.html",          # generator-only, never in a generated studio
        "cbt-exam.html",         # in the menu, listed here only for clarity
    }
    all_pages = {f for f in os.listdir(ROOT) if f.endswith(".html")}
    orphans = sorted(all_pages - set(items) - NOT_IN_MENU)
    if orphans:
        print("  ! pages reachable by URL but absent from the menu: %s"
              % ", ".join(orphans))

    js = '''/* ==========================================================================
   nav-model.js — the canonical navigation menu.  GENERATED FILE.
   --------------------------------------------------------------------------
   Do not edit by hand. Edit tools/build_nav_model.py and re-run:

       python3 tools/build_nav_model.py

   This file is the single description of what is in the navigation pane, in
   what order, under which heading, with which icon. assets/js/nav.js rebuilds
   the pane from it on every role change, which is what makes the pane
   deterministic: the same role always produces byte-identical markup.

   Each item:
     id    module id, also used by the page-access manager and saved views
     href  the page
     label what the user reads
     icon  a glyph that means something (every item used to be a "•")
     aud   pre-session audience hint: public | user | staff | admin
           Used ONLY for the first paint, before the role is known, so the
           pane never flashes the full administrator menu at a parent.
           The real decision is RBAC.level(href, role).
   ========================================================================== */
(function (w) {
  'use strict';
  w.TC_NAV_MODEL = %s;
  w.TC_NAV_MODEL_VERSION = 'V25';
})(window);
''' % json.dumps(model, ensure_ascii=False, indent=2)

    out = os.path.join(ROOT, "assets", "js", "nav-model.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(js)

    # A plain JSON copy alongside it. Tools and tests read THIS rather than
    # trying to regex a JavaScript file for a balanced bracket, which is how a
    # test-suite parse error crept in the first time round.
    with open(os.path.join(ROOT, "assets", "js", "nav-model.json"), "w",
              encoding="utf-8") as fh:
        json.dump(model, fh, ensure_ascii=False, indent=2)
    total = sum(len(s["items"]) for s in model)
    print("  wrote %s — %d sections, %d items" % (out, len(model), total))
    return model


if __name__ == "__main__":
    build()
