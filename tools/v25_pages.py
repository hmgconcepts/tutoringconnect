#!/usr/bin/env python3
"""
tools/v25_pages.py
================================================================================
Applies the V25 changes to every page in the studio.

WHAT IT DOES, AND WHY

 1. REPLACES THE NAVIGATION MARKUP  (report items 3, 5, 7)
    Every page carried the same 126 hand-written <a> tags — about 23 KB of
    duplicated markup per page, 3 MB across the studio. They are replaced with
    an empty <nav class="app-nav"> that assets/js/nav.js fills from
    assets/js/nav-model.js. One description, one renderer, no drift. A
    <noscript> fallback points at the A–Z page index so the studio is still
    navigable with JavaScript switched off.

 2. LOADS THE NEW MODULES
    nav-model.js, nav.js, desk-kit.js, cert-studio.js, cbt-manage.js and
    free-classes.js are added to every page, in the right order (the model
    before the renderer).

 3. REBUILDS EVERY PAGE DESCRIPTION  (report item 6)
    The page-intro card at the head of each page is regenerated from
    assets/js/page-guide.js. That file is itself regenerated first, with the
    fixes described in tools/build_page_guide.py: the "main actions available
    here are: Sign out, Theme" sentence is gone, role views are derived from
    the real access model instead of being boilerplate that told a visitor the
    public About page was closed to them, and Related links now come from the
    navigation model instead of the first six alphabetical siblings.

 4. FILLS IN THE STUB PAGES  (report items 1, 2, 4, 9, 10, 11, 12-20, 22)
    Nine pages whose entire <main> was "Use the related links and the ❓ Page
    Help button" get a real, working body.

 5. CREATES THE TWO NEW PAGES  (report item 8)
    free-classes.html and free-register.html.

Run from the repo root:  python3 tools/v25_pages.py
"""
import glob
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

# =============================================================================
# 1. The scripts every page must load, and where they go
# =============================================================================
NEW_SCRIPTS = [
    # nav-model MUST precede nav.js — the renderer reads the model at load.
    ('assets/js/nav-model.js',   'assets/js/app.js'),
    ('assets/js/nav.js',         'assets/js/rbac.js'),
    ('assets/js/desk-kit.js',    'assets/js/rbac.js'),
    ('assets/js/cert-studio.js', 'assets/js/rbac.js'),
    ('assets/js/cbt-manage.js',  'assets/js/rbac.js'),
    ('assets/js/free-classes.js','assets/js/rbac.js'),
]

NAV_REPLACEMENT = '''<nav class="app-nav" id="app-nav" aria-label="Studio menu" data-nav="model">
      <noscript><a href="site-index.html">All pages A\u2013Z</a></noscript>
    </nav>'''


def patch_scripts(src):
    """Insert the new <script> tags once, in dependency order."""
    for path, after in NEW_SCRIPTS:
        tag = '<script src="%s"></script>' % path
        if tag in src:
            continue
        anchor = '<script src="%s"></script>' % after
        if anchor in src:
            # nav-model goes BEFORE app.js; everything else AFTER rbac.js.
            if path.endswith('nav-model.js'):
                src = src.replace(anchor, tag + '\n' + anchor, 1)
            else:
                src = src.replace(anchor, anchor + '\n' + tag, 1)
        else:
            src = src.replace('</head>', tag + '\n</head>', 1)
    return src


def patch_nav(src):
    """Swap the 23 KB of duplicated links for an empty, JS-filled pane."""
    return re.sub(r'<nav class="app-nav"[^>]*>.*?</nav>', NAV_REPLACEMENT, src,
                  count=1, flags=re.S)


def patch_theme_color(src):
    """The theme colour meta said #4f46e5 on every page — a leftover from the
    template the studio was cloned from. It is what a phone paints round the
    installed PWA, so it was the one place the brand was visibly wrong."""
    return src.replace('<meta name="theme-color" content="#4f46e5">',
                       '<meta name="theme-color" content="#0506ae">')


# =============================================================================
# 2. Page descriptions, regenerated from the guide  (report item 6)
# =============================================================================
BADGES = {
    'public':     ('#0f766e', '\U0001F30D Public page'),
    'code-gated': ('#7c2d12', '\U0001F511 Quiz code required'),
    'family':     ('#0506ae', '\U0001F46A Family view'),
    'staff':      ('#334155', '\U0001F393 Staff only'),
    'owner':      ('#7f1d1d', '\U0001F510 Owner / admin only'),
}


def load_guide():
    src = open('assets/js/page-guide.js', encoding='utf-8').read()
    i = src.index('var PAGE_GUIDE = ') + len('var PAGE_GUIDE = ')
    # The file continues after the object literal, so decode just the object
    # rather than trying to regex a balanced brace.
    obj, _ = json.JSONDecoder().raw_decode(src[i:])
    return obj


def intro_html(page, g):
    """One page-intro card. Clear, specific, and free of the boilerplate the
    report asked to be removed."""
    colour, badge = BADGES.get(g.get('access', 'staff'), BADGES['staff'])
    title = g.get('title') or page.replace('-', ' ').title()

    how = g.get('how') or []
    rel = [r for r in (g.get('related') or []) if os.path.exists(r + '.html')][:6]
    rv = g.get('roleViews') or {}

    parts = ['      <section class="help-card page-intro">',
             '        <div class="page-intro-head"><strong>%s</strong>'
             '<span class="page-intro-badge" style="background:%s">%s</span></div>'
             % (title, colour, badge),
             '        <p class="page-intro-what">%s</p>' % g.get('detail', '')]

    if g.get('audience'):
        parts.append('        <p class="page-intro-who"><b>Who it is for.</b> %s</p>'
                     % g['audience'])
    if g.get('why'):
        parts.append('        <p class="page-intro-why"><b>Why it matters.</b> %s</p>'
                     % g['why'])

    if how:
        parts.append('        <details class="page-intro-how"><summary>How to use this page</summary><ol>'
                     + ''.join('<li>%s</li>' % s for s in how) + '</ol></details>')

    # Role views are shown per page now, so nobody has to guess what a parent
    # will see when they open the same URL.
    if rv:
        parts.append('        <details class="page-intro-roles"><summary>What each role sees here</summary><ul>'
                     + ''.join('<li><b>%s:</b> %s</li>' % (k.title(), v)
                               for k, v in rv.items() if v) + '</ul></details>')

    if rel:
        parts.append('        <p class="page-intro-rel"><b>Related:</b> '
                     + ' \u00b7 '.join('<a href="%s.html">%s</a>' % (r, r.replace('-', ' '))
                                       for r in rel) + '</p>')

    parts.append('      </section>')
    return '\n'.join(parts)


def patch_intro(src, page, guide):
    g = guide.get(page)
    if not g:
        return src
    new = intro_html(page, g)
    # Match at ANY indentation. The six pages that have no .app-content —
    # index, login, site-index, cbt-exam, cbt-multi and builder — indent their
    # intro card differently, so a fixed six-space prefix silently skipped
    # them and left the old boilerplate in place on exactly the pages a
    # stranger sees first.
    if '<section class="help-card page-intro">' in src:
        return re.sub(r'[ \t]*<section class="help-card page-intro">.*?</section>',
                      lambda _: new, src, count=1, flags=re.S)
    return src.replace('<main class="app-content">',
                       '<main class="app-content">\n' + new, 1)


# =============================================================================
# 3. Real bodies for the pages that shipped as stubs
# =============================================================================
def desk(key, note=''):
    return ('      <div id="desk-root"></div>\n'
            + (('      <p class="muted" style="margin-top:10px;font-size:.85rem">%s</p>\n' % note) if note else '')
            + '      <script>document.addEventListener(\'DOMContentLoaded\',function(){'
              'if(window.Desk)Desk.mount(\'%s\');});</script>' % key)


BODIES = {
    # ---- report item 12 -----------------------------------------------------
    'at-risk': desk('at_risk',
        'Flags are raised automatically by six published rules \u2014 falling scores, attendance below 80%, '
        'missing homework, no activity for 14 days, fewer than two hours taught, and more than 40% of topics '
        'below 50%. There is no AI anywhere in this. Every review you record here is what turns a flag into '
        'an action you can show a parent.'),

    # ---- report item 14 -----------------------------------------------------
    'value-added': desk('value_added',
        'Value added is computed by the database from the scores you enter, never typed, so the figure on '
        'screen can never disagree with the numbers behind it.'),

    # ---- report item 15 -----------------------------------------------------
    'predictions': desk('predictions',
        'Predictions are made on the scale that applies to the exam, not as a percentage. Publish one only '
        'when you are content for a parent to quote it back to you.'),

    # ---- report item 16 -----------------------------------------------------
    'group-insights': desk('group_insights',
        'These entries belong to the group. Anything true of one child in it belongs on the At-risk board '
        'or in that learner\u2019s progress report instead.'),

    # ---- report item 18 -----------------------------------------------------
    'scoresheet': '''      <div id="sheet"></div>
      <div id="desk-root" style="margin-top:14px"></div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        if(window.Desk)Desk.mount('scoresheet');
      });</script>''',

    # ---- report item 20 -----------------------------------------------------
    'progress-reports': desk('progress_reports',
        'A report prints with a DRAFT watermark until its status is set to published, so a half-written '
        'comment cannot reach a family by accident.'),

    # ---- report item 9 ------------------------------------------------------
    'timezones': desk('timezones',
        'The live clocks use your own browser\u2019s time-zone database, so daylight saving is always correct '
        'and nobody has to maintain a table of offsets.'),

    # ---- report item 13: keep the existing analytics, ADD the practice desk --
    'analytics': None,     # handled specially below (appended, not replaced)
    'insights': None,      # handled specially below (appended, not replaced)

    # ---- report item 19 -----------------------------------------------------
    'certificates': '''      <div id="cert-root"></div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        if(window.CertStudio)CertStudio.mount('cert-root');
      });</script>''',
}


def patch_body(src, page):
    body = BODIES.get(page)
    if not body:
        return src
    # Replace everything in <main> AFTER the intro card.
    m = re.search(r'(<main class="app-content">\s*(?:<section class="help-card page-intro">.*?</section>)?)(.*?)(</main>)',
                  src, re.S)
    if not m:
        return src
    return src[:m.start(2)] + '\n' + body + '\n    ' + src[m.end(2):]


def append_body(src, extra):
    """Add to the end of <main> without disturbing what is already there."""
    return re.sub(r'(\n\s*)</main>', '\n' + extra + r'\1</main>', src, count=1)


# =============================================================================
# 4. The two new pages
# =============================================================================
def shell(template_page, title, page_title, body, public=False):
    src = open(template_page, encoding='utf-8').read()
    src = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, src, count=1, flags=re.S)
    src = re.sub(r'<h1 class="app-page-title">.*?</h1>',
                 '<h1 class="app-page-title">%s</h1>' % page_title, src, count=1, flags=re.S)
    if public:
        src = src.replace('<meta name="robots" content="noindex,nofollow">',
                          '<meta name="robots" content="index,follow">')
        src = src.replace('data-require-role="any"', 'data-require-role="public"')
        # A public page must not sit behind the sign-in guard.
        src = src.replace('<script src="assets/js/auth-guard.js"></script>', '')
    m = re.search(r'(<main class="app-content">)(.*?)(</main>)', src, re.S)
    src = src[:m.end(1)] + '\n' + body + '\n    ' + src[m.start(3):]
    return src


FREE_CLASSES_BODY = '''      <div id="free-root"></div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        if(window.FreeClasses)FreeClasses.mount('free-root');
      });</script>'''

FREE_REGISTER_BODY = '''      <div id="free-reg-root"></div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        if(window.FreeClasses)FreeClasses.mountPublic('free-reg-root');
      });</script>'''


# =============================================================================
# main
# =============================================================================
def main():
    print('V25 page build')

    # -- the nav model first: the guide's Related links are derived from it ---
    subprocess.run([sys.executable, 'tools/build_nav_model.py'], check=True)
    subprocess.run([sys.executable, 'tools/build_page_guide.py'], check=True)
    guide = load_guide()

    # -- create the new pages, from an existing shell ------------------------
    if not os.path.exists('free-classes.html'):
        open('free-classes.html', 'w', encoding='utf-8').write(
            shell('at-risk.html', 'Free class cohorts \u2022 ADEWALE CLASSROOM',
                  'Free class cohorts', FREE_CLASSES_BODY))
        print('  created free-classes.html')
    if not os.path.exists('free-register.html'):
        open('free-register.html', 'w', encoding='utf-8').write(
            shell('at-risk.html', 'Register for a free class \u2022 ADEWALE CLASSROOM',
                  'Register for a free class', FREE_REGISTER_BODY, public=True))
        print('  created free-register.html')

    # the two new pages need guide entries, so rebuild it now that they exist
    subprocess.run([sys.executable, 'tools/build_nav_model.py'], check=True)
    subprocess.run([sys.executable, 'tools/build_page_guide.py'], check=True)
    guide = load_guide()

    n_nav = n_scr = n_intro = n_body = 0
    for f in sorted(glob.glob('*.html')):
        page = f[:-5]
        src = orig = open(f, encoding='utf-8').read()

        if re.search(r'<nav class="app-nav"[^>]*>', src) and 'data-nav="model"' not in src:
            src = patch_nav(src)
            n_nav += 1

        before = src
        src = patch_scripts(src)
        if src != before:
            n_scr += 1

        src = patch_theme_color(src)

        if '<main class="app-content">' in src or 'page-intro' in src:
            before = src
            src = patch_intro(src, page, guide)
            if src != before:
                n_intro += 1

            before = src
            src = patch_body(src, page)

            # ---- report item 13: analytics keeps its charts and GAINS a desk
            if page == 'analytics' and 'desk-root' not in src:
                src = append_body(src, '''      <section class="card" style="margin-top:18px">
        <h2 style="margin:0 0 4px">\u270f\ufe0f Record practice done off the platform</h2>
        <p class="muted" style="margin:0">Quizzes sat here are counted automatically. Past papers,
          worksheets and anything set by a school are not \u2014 and for an exam-preparation studio that is
          most of the practice there is. Log it below and it joins the figures above.</p>
      </section>
      <div id="desk-root"></div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        if(window.Desk)Desk.mount('practice_analytics');
      });</script>''')

            # ---- report item 17: insights keeps its charts and GAINS a desk
            if page == 'insights' and 'desk-root' not in src:
                src = append_body(src, '''      <section class="card" style="margin-top:18px">
        <h2 style="margin:0 0 4px">\U0001F52C The lab notebook</h2>
        <p class="muted" style="margin:0">Write the hypothesis down <b>before</b> you act on it, with the
          evidence, the action and how you will know whether it worked. Then come back and record what
          actually happened \u2014 that last step is what separates a studio that improves from one that
          merely has opinions.</p>
      </section>
      <div id="desk-root"></div>
      <script>document.addEventListener('DOMContentLoaded',function(){
        if(window.Desk)Desk.mount('insights');
      });</script>''')

            if src != before:
                n_body += 1

        if src != orig:
            open(f, 'w', encoding='utf-8').write(src)

    print('  nav replaced on   %d pages' % n_nav)
    print('  scripts added to  %d pages' % n_scr)
    print('  intros rebuilt on %d pages' % n_intro)
    print('  bodies filled on  %d pages' % n_body)


if __name__ == '__main__':
    main()
