#!/usr/bin/env python3
"""
tools/v26_hmg_pages.py
================================================================================
Rewrites the two HMG pages with content taken from the LIVE sites rather than
from memory.   (report items 3, 4, 5 and 13)

WHAT WAS WRONG

  item 5  "On HMG Digital Products, your details about the GOSA portal are
           wrong. The GOSA portal is a school portal."
          Correct. I described it as an alumni / association platform. It is
          not. https://gosaportal.vercel.app is "God of Seed Academy — School
          Portal", a School Connect deployment for a real school. Verified by
          opening the site.

  item 13 "The link to school connect is https://schoolconnectdemo.vercel.app.
           Our school connect generator should not be exposed to the public
           because it is a tool used by us to build school connect for our
           customers."
          The catalogue linked hmgschoolconnect.vercel.app — the GENERATOR.
          That is an internal build tool and must never be shown to a
          prospective customer. Replaced with the demo deployment, which
          announces itself as simulated data.

  item 4  "For HMG Digital Products and HMG Ecosystem, visit these pages on
           School Connect and the GOSA site, understudy the description there
           and implement it here."
          Their hmg-ecosystem.html is an HMG Concepts SERVICES catalogue —
          eight flyer-led cards covering Business Connect, CBT Solutions,
          Church Connect, IELTS Preparation, E-commerce, School Connect, HMG
          Academy and Website Development. Tutoring Connect had a six-tile
          link list instead. The services catalogue is reproduced here, with
          the same eight flyers, and the family map is kept beneath it.

  item 3  Persona and brand, taken from cssadewale.pages.dev and
          hmgconcepts.pages.dev:
            · HMG Concepts — His Marvellous Grace, est. 2015, Lagos.
              "Learning Deliberately. Teaching Authentically."
            · Four live arms: Academy, Technologies, Media, Gospel.
            · Adewale Samson Adeagbo — AI-Augmented Solutions Developer ·
              Data Scientist · STEM Educator. B.Sc.(Ed) Computer Science
              Education. 15+ years in Nigerian classrooms. 3MTT.
            · Three builder modes: EdTech, DataTech, FaithTech.
            · "Real problems. Real solutions. Built with AI, grounded in
              data, taught from the classroom."
            · GitHub @cssadewale, @hmgacademyhub, @hmgtechnologies, @hmgospel
            · WhatsApp +234 810 086 6322 · YouTube @hmgconcepts
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

WA = 'https://wa.me/2348100866322'

# =============================================================================
# HMG ECOSYSTEM  — services catalogue (as on School Connect / GOSA) + family map
# =============================================================================
SERVICES = [
    ('flyer-1.jpg', 'Business Connect',
     'Business website, invoicing, CRM, inventory and customer operations platform.',
     'A small business that is running on a notebook and a WhatsApp thread.'),
    ('flyer-2.jpg', 'CBT Solutions',
     'Secure online tests, objective assessments, results and reporting workflows.',
     'Anyone examining candidates — a school, a training centre, an examining body.'),
    ('flyer-3.jpg', 'Church Connect',
     'Church administration, member care, programmes, giving and communication platform.',
     'A church or ministry that needs a register, a giving record and a way to reach members.'),
    ('flyer-4.jpg', 'IELTS Preparation Courses',
     'Structured IELTS preparation, enrolment and learning-support services.',
     'Candidates preparing for IELTS, and centres that prepare them.'),
    ('flyer-5.jpg', 'E-commerce Store',
     'Online storefront, catalogue, orders, payments and digital business setup.',
     'A trader ready to sell online without paying a monthly platform fee.'),
    ('flyer-6.jpg', 'School Connect',
     'School management, academic records, CBT, communication and parent engagement.',
     'Nursery, primary and secondary schools running terms, classes and report cards.'),
    ('flyer-7.jpg', 'HMG Academy',
     'Education programmes, classroom enrolment and academic support services.',
     'Students and parents who want the teaching itself rather than the software.'),
    ('flyer-8.jpg', 'Website Development',
     'Professional websites, digital identity, hosting-ready pages and business tools.',
     'Any organisation that needs to exist properly online.'),
]

ECOSYSTEM = '''      <article class="card" style="background:linear-gradient(135deg,#0506ae,#964eec);color:#fff">
        <div style="font-size:.75rem;letter-spacing:2px;opacity:.85">★ EST. 2015 · LAGOS, NIGERIA</div>
        <h2 style="margin:6px 0 6px;color:#fff">HMG Concepts — <i>His Marvellous Grace</i></h2>
        <p style="margin:0;opacity:.96;max-width:820px">A Nigerian education and technology brand built on
          one conviction: that every learner deserves quality, deliberate and forward-looking education.
          One brand, four living missions.</p>
        <p style="margin:12px 0 0;font-style:italic;opacity:.9">“Learning Deliberately. Teaching Authentically.”</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <a class="btn btn-sm" style="background:#fff;color:#0506ae" target="_blank" rel="noopener"
             href="https://hmgconcepts.pages.dev/">HMG Concepts</a>
          <a class="btn btn-sm btn-outline" style="border-color:#fff;color:#fff" target="_blank" rel="noopener"
             href="__WA__">💬 WhatsApp +234 810 086 6322</a>
          <a class="btn btn-sm btn-outline" style="border-color:#fff;color:#fff" target="_blank" rel="noopener"
             href="https://whatsapp.com/channel/0029Vb7kGoN2ER6feTzs8q2f">📢 WhatsApp channel</a>
        </div>
      </article>

      <!-- ==================================================================
           SERVICES CATALOGUE — the same eight flyer-led cards School Connect
           and the GOSA portal carry on their own HMG Ecosystem page, so a
           visitor sees one consistent offer across every HMG deployment.
           ================================================================== -->
      <h2 style="margin:22px 0 4px">🧩 HMG Concepts services</h2>
      <p class="muted" style="margin:0 0 14px;max-width:900px">From school management and CBT to church
        platforms, e-commerce, training and websites, <b>HMG Technologies</b> develops connected, practical
        digital solutions. Every one of them is built to run on free-tier infrastructure with a database the
        client owns — <i>recurring payments should not keep an organisation from having an online presence.</i></p>

      <div class="grid grid-2" id="hmg-services">
__SERVICE_CARDS__
      </div>

      <!-- ==================================================================
           THE FOUR ARMS
           ================================================================== -->
      <h2 style="margin:26px 0 4px">🏛️ One brand, four missions</h2>
      <p class="muted" style="margin:0 0 14px">Each arm solves a distinct, real problem. All four are live.</p>
      <div class="grid grid-2">
        <a class="card" target="_blank" rel="noopener" href="https://hmgacademy.pages.dev/">
          <h3 style="margin-top:0">🎓 HMG Academy</h3>
          <p class="muted" style="margin:0">A full-service, strictly virtual learning institution — seasoned
            teachers across all subjects and all levels, from Nursery through Secondary and the major exams.</p>
          <ul style="margin:8px 0 0;padding-left:18px;font-size:.88rem;line-height:1.7">
            <li>WAEC · NECO · GCE · BECE · UTME preparation</li>
            <li>IGCSE · IELTS · JUPEB · SAT preparation</li>
            <li>Free CBT Pro platform and lesson notes</li>
          </ul>
        </a>
        <a class="card" target="_blank" rel="noopener" href="https://hmgtechnologies.pages.dev/">
          <h3 style="margin-top:0">💻 HMG Technologies</h3>
          <p class="muted" style="margin:0">The innovation arm — AI-augmented tools, CBT systems, data
            dashboards, ML models and simulators for Nigerian businesses, schools, NGOs and churches.</p>
          <ul style="margin:8px 0 0;padding-left:18px;font-size:.88rem;line-height:1.7">
            <li>CBT Pro — built on a ₦0 budget, live in classrooms</li>
            <li>7 machine-learning models · 11 data-tool simulators</li>
            <li>Dashboards, automation and digital training</li>
          </ul>
        </a>
        <a class="card" target="_blank" rel="noopener" href="https://hmgmedia.pages.dev/">
          <h3 style="margin-top:0">📢 HMG Media</h3>
          <p class="muted" style="margin:0">The content and visibility arm — purpose-led audio, visual and
            audiovisual media that turns meaningful work into stories people understand and remember.</p>
        </a>
        <a class="card" target="_blank" rel="noopener" href="https://hmggospel.pages.dev/">
          <h3 style="margin-top:0">✝️ HMG Gospel</h3>
          <p class="muted" style="margin:0">The faith arm — Christ-centred digital outreach and discipleship.
            Every platform a pulpit, every tool a testimony. Dramavangelism, techvangelism, podcasts,
            teachings and church support.</p>
        </a>
      </div>

      <article class="card" style="margin-top:18px">
        <h3 style="margin-top:0">🧑‍💻 The person behind HMG</h3>
        <p style="margin:0"><b>Adewale Samson Adeagbo</b> — Founder and Visioner.
          AI-Augmented Solutions Developer · Data Scientist · STEM Educator. Lagos, Nigeria.</p>
        <p class="muted" style="margin:8px 0 0">B.Sc.(Ed) in Computer Science Education, 15+ years in Nigerian
          classrooms, and a turning point through 3MTT. One identity in three builder modes:</p>
        <div class="grid grid-2" style="margin-top:10px">
          <div><b>🏫 EdTech Builder</b><br><span class="muted">Educator skills + AI-augmented development
            = tools for the classroom. Tutoring Connect is one of them.</span></div>
          <div><b>📊 DataTech Builder</b><br><span class="muted">Data science + AI-augmented development
            = ML models, dashboards and simulators.</span></div>
          <div><b>✝️ FaithTech Builder</b><br><span class="muted">Gospel conviction + AI-augmented
            development = every platform a pulpit.</span></div>
          <div><b>Working conviction</b><br><span class="muted">“Real problems. Real solutions. Built with
            AI, grounded in data, taught from the classroom.”</span></div>
        </div>
        <p style="margin-top:12px">
          <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://cssadewale.pages.dev/">Portfolio</a>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://github.com/cssadewale">GitHub @cssadewale</a>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://linkedin.com/in/adewalesamsonadeagbo">LinkedIn</a>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://youtube.com/@hmgconcepts">YouTube @hmgconcepts</a>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://x.com/cssadewale">X</a>
          <a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://instagram.com/cssadewale">Instagram</a>
        </p>
      </article>

      <article class="card" style="margin-top:14px">
        <h3 style="margin-top:0">Built on a simple truth</h3>
        <div class="grid grid-2">
          <div><b>01 · Deliberate learning</b><br><span class="muted">Teaching for understanding, not just
            exam passes — students who can think, not merely recall.</span></div>
          <div><b>02 · Authentic teaching</b><br><span class="muted">Real classroom experience, not just
            qualifications. Every lesson grounded in what actually works.</span></div>
          <div><b>03 · Technology as a tool</b><br><span class="muted">Applied deliberately, to expand access
            and improve outcomes — never for its own sake.</span></div>
          <div><b>04 · Access for all</b><br><span class="muted">Virtual by design, so geography is never a
            barrier.</span></div>
          <div><b>05 · Community impact</b><br><span class="muted">Built for Nigeria, with the Nigerian
            learner, the slow connection and the low-end device in mind.</span></div>
          <div><b>06 · Continuous growth</b><br><span class="muted">Always upskilling, always improving —
            a learning organisation that practises what it preaches.</span></div>
        </div>
        <p style="margin-top:14px">
          <a class="btn btn-primary" target="_blank" rel="noopener" href="__WA__">💬 Talk to HMG</a>
          <a class="btn btn-outline" href="hmg-products.html">See the software products</a>
          <a class="btn btn-ghost" href="developer.html">About the developer</a>
        </p>
      </article>'''


def service_cards():
    out = []
    for img, name, line, who in SERVICES:
        out.append(
            '        <article class="card" style="padding:0;overflow:hidden">\n'
            '          <img src="assets/img/ecosystem-flyers/%s" alt="HMG Technologies — %s flyer"\n'
            '               loading="lazy" style="width:100%%;display:block;aspect-ratio:4/5;object-fit:cover;'
            'background:var(--gray-100,#f1f5f9)">\n'
            '          <div style="padding:14px 16px">\n'
            '            <h3 style="margin:0 0 4px">%s</h3>\n'
            '            <p class="muted" style="margin:0 0 6px">%s</p>\n'
            '            <p class="muted" style="margin:0 0 10px;font-size:.85rem"><b>Best for:</b> %s</p>\n'
            '            <a class="btn btn-sm btn-outline" target="_blank" rel="noopener"\n'
            '               href="https://hmgconcepts.pages.dev/">Learn more from HMG Concepts</a>\n'
            '            <a class="btn btn-sm btn-ghost" target="_blank" rel="noopener"\n'
            '               href="%s?text=%s">Ask about it</a>\n'
            '          </div>\n'
            '        </article>' % (img, name, name, line, who, WA,
                                    ('I%%20would%%20like%%20to%%20ask%%20about%%20' +
                                     name.replace(' ', '%20'))))
    return '\n'.join(out)


# =============================================================================
# HMG DIGITAL PRODUCTS — corrected catalogue
# =============================================================================
PRODUCTS_JS = '''
        var PRODUCTS = [
          { tag: ['school'], icon: '🏫', name: 'School Connect',
            line: 'A complete school management platform.',
            what: 'Admissions, classes and streams, timetabling, attendance, continuous assessment, a full ' +
                  'report-card engine with affective traits, bursary and fees, a parent portal, CBT, ' +
                  'certificates, digital voting and an activity audit. Around 150 pages, installable as an app.',
            who: 'Nursery, primary and secondary schools running terms and class teachers.',
            /* ITEM 13 — this used to point at hmgschoolconnect.vercel.app, which is the
               GENERATOR: the internal tool HMG uses to build a school its own portal.
               A prospective customer must never be sent there. The demo deployment is
               the correct public shop window: it is clearly labelled as simulated data
               and resets periodically. */
            demo: 'https://schoolconnectdemo.vercel.app/',
            demoLabel: 'Open the live demo',
            note: 'Sample data only — explore every feature without touching a real school.',
            repo: '' },

          { tag: ['school'], icon: '🎒', name: 'GOSA Portal — God of Seed Academy',
            line: 'A real school running on School Connect.',
            /* ITEM 5 — this was described as an alumni / association platform. It is
               not, and the description was corrected after opening the live site.
               gosaportal.vercel.app is "God of Seed Academy — School Portal": a School
               Connect deployment serving an actual school, motto "Excellence in
               Learning and Character". */
            what: 'The official school portal of God of Seed Academy — <i>Excellence in Learning and ' +
                  'Character</i>. A live School Connect deployment: real-time continuous assessment, exam ' +
                  'and CBT marks, an installable mobile app with push notifications, digital voting for ' +
                  'school elections and prefect polls, fee balances with printable receipts, multi-channel ' +
                  'broadcasts over WhatsApp, email and push, and row-level security so one family can never ' +
                  'see another\\'s data.',
            who: 'Look at this one if you want to see School Connect in production rather than in a demo.',
            demo: 'https://gosaportal.vercel.app/', demoLabel: 'Open the live school portal', repo: '' },

          { tag: ['tutor'], icon: '🎓', name: 'Tutoring Connect', current: true,
            line: 'The platform you are looking at.',
            what: 'Engagements instead of classes, hour banks instead of term fees, cycle bookings, ' +
                  'value-added and predicted grades, free outreach cohorts with shareable registration ' +
                  'links, three kinds of quiz with tutor marking for open responses, a certificate studio, ' +
                  'and a generator that stamps out a branded studio of its own.',
            who: 'Independent tutors and small studios teaching 1:1 and in small groups, locally and ' +
                 'internationally.',
            demo: 'https://adewaleclassroom.vercel.app/', demoLabel: 'Open a live studio', repo: '' },

          { tag: ['exam', 'school'], icon: '🧪', name: 'HMG Academy CBT Pro',
            line: 'A dedicated computer-based testing engine, built on a ₦0 budget.',
            what: 'Built on an Android tablet with no budget and used with real students in real exams. ' +
                  'CSV question upload, timed papers, per-student randomisation, anti-cheat, automatic ' +
                  'marking and four tabs of analytics. Candidate registration and numbering, seating, ' +
                  'proctoring, item analysis, result broadcasts and certificate issue.',
            who: 'Anyone running examinations at scale, including for candidates who are not their own students.',
            demo: 'https://cbtsystem-hmgacademy.vercel.app/', demoLabel: 'Open the live platform',
            repo: 'https://github.com/hmgacademyhub/cbt-system' },

          { tag: ['assoc'], icon: '⛪', name: 'Church Connect',
            line: 'Administration for a church or ministry.',
            what: 'Member care and records, programmes and services, giving and contribution tracking, ' +
                  'departments and units, attendance, and multi-channel communication.',
            who: 'Churches, ministries and community organisations.',
            demo: '', repo: '' },

          { tag: ['assoc', 'school'], icon: '🏢', name: 'Business Connect',
            line: 'Operations for a small business.',
            what: 'Business website, invoicing, a light CRM, inventory and day-to-day customer operations — ' +
                  'the same free-tier, own-your-data architecture as the school products.',
            who: 'A small business running on a notebook and a WhatsApp thread.',
            demo: '', repo: '' },

          { tag: ['school', 'tutor', 'exam', 'assoc'], icon: '🌐', name: 'HMG Concepts',
            line: 'The parent brand. Est. 2015, Lagos.',
            what: '<i>His Marvellous Grace.</i> Learning Deliberately. Teaching Authentically. The umbrella ' +
                  'over four live arms: HMG Academy, HMG Technologies, HMG Media and HMG Gospel.',
            who: 'Start here if you are not sure which product fits you.',
            demo: 'https://hmgconcepts.pages.dev/', demoLabel: 'Open hmgconcepts.pages.dev', repo: '' },

          { tag: ['tutor', 'exam'], icon: '📚', name: 'HMG Academy',
            line: 'Virtual tutoring and examination preparation.',
            what: 'The teaching practice itself — a strictly virtual school covering all subjects and all ' +
                  'levels: WAEC, NECO, GCE, BECE, UTME, IGCSE, IELTS, JUPEB and SAT. The software above ' +
                  'exists because this practice needed it first.',
            who: 'Students and parents looking for teaching rather than software.',
            demo: 'https://hmgacademy.pages.dev/', demoLabel: 'Open HMG Academy', repo: '' }
        ];
'''


def patch_products():
    f = 'hmg-products.html'
    s = open(f, encoding='utf-8').read()

    # swap the product array
    i = s.index('        var PRODUCTS = [')
    j = s.index('        ];', i) + len('        ];')
    s = s[:i] + PRODUCTS_JS.strip('\n') + s[j:]

    # honour demoLabel + note in the card renderer
    s = s.replace(
        "                  (p.demo ? '<a class=\"btn btn-sm btn-primary\" target=\"_blank\" rel=\"noopener\" href=\"' +\n"
        "                    esc(p.demo) + '\">Open the live site</a>' : '') +",
        "                  (p.demo ? '<a class=\"btn btn-sm btn-primary\" target=\"_blank\" rel=\"noopener\" href=\"' +\n"
        "                    esc(p.demo) + '\">' + esc(p.demoLabel || 'Open the live site') + '</a>' : '') +")
    s = s.replace(
        "                '<p style=\"margin:8px 0 6px;font-size:.9rem\">' + esc(p.what) + '</p>' +",
        "                '<p style=\"margin:8px 0 6px;font-size:.9rem\">' + p.what + '</p>' +")
    s = s.replace(
        "                '<p class=\"muted\" style=\"margin:0 0 10px;font-size:.85rem\"><b>Best for:</b> ' + esc(p.who) + '</p>' +",
        "                '<p class=\"muted\" style=\"margin:0 0 10px;font-size:.85rem\"><b>Best for:</b> ' + esc(p.who) + '</p>' +\n"
        "                (p.note ? '<p class=\"muted\" style=\"margin:-4px 0 10px;font-size:.8rem\">ℹ️ ' + esc(p.note) + '</p>' : '') +")

    # the comparison table repeats the GOSA error
    s = s.replace(
        '            <tr><td>An alumni body, church or association</td>\n'
        '                <td><b>GOSA Portal</b></td>\n'
        '                <td>It models members, dues, elections, chapters and events instead of learners.</td></tr>',
        '            <tr><td>A church, ministry or community body</td>\n'
        '                <td><b>Church Connect</b></td>\n'
        '                <td>It models members, giving, programmes and departments instead of learners.</td></tr>\n'
        '            <tr><td>Wanting to see School Connect running for a REAL school</td>\n'
        '                <td><b>GOSA Portal</b></td>\n'
        '                <td>God of Seed Academy\u2019s live portal \u2014 a School Connect deployment in daily use.</td></tr>')

    # and the filter labels
    s = s.replace('data-pfilter="assoc">For an association</button>',
                  'data-pfilter="assoc">For a church or business</button>')

    open(f, 'w', encoding='utf-8').write(s)
    print('  rewrote hmg-products.html (%d bytes)' % os.path.getsize(f))


def patch_ecosystem():
    f = 'hmg-ecosystem.html'
    s = open(f, encoding='utf-8').read()
    body = ECOSYSTEM.replace('__SERVICE_CARDS__', service_cards()).replace('__WA__', WA)
    m = re.search(r'(<main class="app-content">\s*(?:<section class="help-card page-intro">.*?</section>)?)'
                  r'(.*?)(</main>)', s, re.S)
    if not m:
        print('  ! could not find <main> in ' + f)
        return
    s = s[:m.end(1)] + '\n' + body + '\n    ' + s[m.start(3):]
    open(f, 'w', encoding='utf-8').write(s)
    print('  rewrote hmg-ecosystem.html (%d bytes)' % os.path.getsize(f))


if __name__ == '__main__':
    print('V26 HMG content pages')
    patch_ecosystem()
    patch_products()
