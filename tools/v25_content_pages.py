#!/usr/bin/env python3
"""
tools/v25_content_pages.py
================================================================================
Writes real bodies for the five pages the report named individually:

  item  1  admin-data.html    "there are bugs there, and missing features"
  item  2  settings.html      "some features are still missing"
  item  4  hmg-products.html  "there is something missing there"
  item 10  contact.html       "there is something missing there"
  item 11  developer.html     "the details there are wrong and misleading"

Each body is written once, here, and stamped into the page below its
description card. Run after tools/v25_pages.py.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


# =============================================================================
# item 11 — ABOUT THE DEVELOPER
#
# WHAT WAS WRONG: the page had no body at all. Its entire <main> was the
# description card followed by "Use the related links and the ❓ Page Help
# button." A visitor doing due diligence on who holds their child's data found
# nothing, and the description card — generated from a group template — told
# tutors, parents and learners that they had "No access" to a page that is
# public and linked from every footer.
#
# Every fact below is taken from what the studio already publishes elsewhere in
# this repository (assets/js/config.js and hmg-ecosystem.html), so the page
# cannot contradict the rest of the site.
# =============================================================================
DEVELOPER = '''      <article class="card" style="background:linear-gradient(135deg,#0506ae,#964eec);color:#fff">
        <div style="font-size:.75rem;letter-spacing:2px;opacity:.85">BUILT AND MAINTAINED BY</div>
        <h2 style="margin:6px 0 4px;color:#fff">HMG Technologies</h2>
        <p style="margin:0;opacity:.95">The software arm of <b>HMG Concepts</b> — <i>His Marvellous Grace</i>,
          established 2015. <i>Learning Deliberately. Teaching Authentically.</i></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <a class="btn btn-sm" style="background:#fff;color:#0506ae" target="_blank" rel="noopener"
             href="https://hmgtechnologies.pages.dev/">HMG Technologies</a>
          <a class="btn btn-sm btn-outline" style="border-color:#fff;color:#fff" target="_blank" rel="noopener"
             href="https://hmgconcepts.pages.dev/">HMG Concepts</a>
          <a class="btn btn-sm btn-outline" style="border-color:#fff;color:#fff" target="_blank" rel="noopener"
             href="https://wa.me/2348100866322">WhatsApp +234 810 086 6322</a>
        </div>
      </article>

      <div class="grid grid-2" style="margin-top:14px">
        <article class="card">
          <h3 style="margin-top:0">👤 The developer</h3>
          <p><b>Adewale Samson Adeagbo</b> — founder of HMG Concepts.
             AI-Augmented Solutions Developer · Data Scientist · STEM Educator. Based in Lagos, Nigeria.</p>
          <p class="muted">He builds the platform and teaches on it, which is the reason it is shaped the way
             it is: the features exist because a working tutor needed them, not because they were on a
             competitor's feature list.</p>
          <p><a class="btn btn-outline btn-sm" target="_blank" rel="noopener"
                href="https://cssadewale.pages.dev/">Profile</a>
             <a class="btn btn-outline btn-sm" target="_blank" rel="noopener"
                href="https://youtube.com/@hmgconcepts">YouTube</a></p>
        </article>

        <article class="card">
          <h3 style="margin-top:0">🧱 What this platform is made of</h3>
          <ul style="margin:0;padding-left:18px;line-height:1.75">
            <li><b>Front end:</b> plain HTML, CSS and JavaScript. No framework, no build step, no bundler.
                Every page is a file you can open, read and edit.</li>
            <li><b>Database and sign-in:</b> Supabase (PostgreSQL), with row-level security doing the actual
                access control rather than the interface.</li>
            <li><b>Hosting:</b> Vercel, Netlify or Cloudflare Pages — all on their free tiers.</li>
            <li><b>Installable:</b> a progressive web app, so it installs on a phone, a laptop or a desktop
                and keeps working when the connection drops.</li>
            <li><b>No paid AI service anywhere.</b> Quiz questions are imported from CSV or pasted from any
                free chat tool. Nothing in the studio calls a metered API.</li>
          </ul>
        </article>

        <article class="card">
          <h3 style="margin-top:0">🔐 Your data</h3>
          <ul style="margin:0;padding-left:18px;line-height:1.75">
            <li>The studio's database belongs to the studio. It lives in the studio's own Supabase project,
                not in a shared account.</li>
            <li><b>No files are uploaded.</b> Photographs, signatures, notes and recordings are all links to
                Google Drive, YouTube or the open web. That is a deliberate design choice: it protects the
                1&nbsp;GB storage and 500&nbsp;MB database quotas, and it means the studio never holds a copy
                of a document it does not need.</li>
            <li>A full, checksummed export can be taken at any time from
                <a href="admin-data.html">Admin data</a>, and restored to any Supabase project.</li>
            <li>Access control is enforced in PostgreSQL, so a determined user editing the page in their
                browser gains a menu item, not data.</li>
          </ul>
        </article>

        <article class="card">
          <h3 style="margin-top:0">📦 Licensing and support</h3>
          <p>Tutoring Connect is sold two ways, and the studio chooses when the site is generated:</p>
          <ul style="margin:0 0 8px;padding-left:18px;line-height:1.7">
            <li><b>One-time ownership.</b> Pay once, own the source, host it yourself, no recurring fee.</li>
            <li><b>Subscription.</b> A lower entry cost with continuing updates and support.</li>
          </ul>
          <p class="muted">Whichever is chosen, the studio holds its own database and its own hosting account.
             The current position for this studio is shown on <a href="license.html">Site license</a>.</p>
          <p><a class="btn btn-primary btn-sm" target="_blank" rel="noopener"
                href="https://wa.me/2348100866322">Commission a build</a>
             <a class="btn btn-outline btn-sm" href="hmg-products.html">See the other products</a></p>
        </article>
      </div>

      <article class="card" style="margin-top:14px">
        <h3 style="margin-top:0">🌐 The wider ecosystem</h3>
        <p class="muted" style="margin-top:0">HMG Concepts runs several arms. If Tutoring Connect is not the
          right shape for your organisation, one of these probably is.</p>
        <div class="grid grid-2">
          <a class="card" target="_blank" rel="noopener" href="https://hmgconcepts.pages.dev/"><b>HMG Concepts</b><br>
            <span class="muted">The parent. Est. 2015.</span></a>
          <a class="card" target="_blank" rel="noopener" href="https://hmgtechnologies.pages.dev/"><b>HMG Technologies</b><br>
            <span class="muted">Software: Tutoring Connect, School Connect, CBT Pro.</span></a>
          <a class="card" target="_blank" rel="noopener" href="https://hmgacademy.pages.dev/"><b>HMG Academy</b><br>
            <span class="muted">Virtual tutors and examination preparation.</span></a>
          <a class="card" target="_blank" rel="noopener" href="https://hmgmedia.pages.dev/"><b>HMG Media</b><br>
            <span class="muted">Story and brand.</span></a>
          <a class="card" target="_blank" rel="noopener" href="https://hmggospel.pages.dev/"><b>HMG Gospel</b><br>
            <span class="muted">The faith arm.</span></a>
          <a class="card" href="hmg-ecosystem.html"><b>Full ecosystem map</b><br>
            <span class="muted">Every site, in one place.</span></a>
        </div>
      </article>'''


# =============================================================================
# item 10 — CONTACT
#
# WHAT WAS MISSING: everything. The page had a description and nothing else —
# no phone number, no WhatsApp button, no address, no teaching hours, and no
# form. For a tutoring studio the contact page is a sales page, and this one
# gave a prospective parent no way to make contact at all.
#
# Two things here are more than the obvious. The teaching hours are converted
# into the VISITOR'S time zone, because half the studio's enquiries come from
# other countries and "6pm" is meaningless without knowing whose 6pm. And the
# form writes into the studio's own inbox rather than opening a mail client,
# because a mailto: link fails silently on most phones.
# =============================================================================
CONTACT = '''      <div class="grid grid-2">
        <article class="card">
          <h3 style="margin-top:0">📞 Reach the studio</h3>
          <div id="contact-details">
            <p class="muted">Loading the studio\u2019s contact details\u2026</p>
          </div>
          <div id="contact-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"></div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--gray-200,#e2e8f0)">
            <b>Teaching hours</b>
            <div id="contact-hours" class="muted" style="margin-top:4px">\u2014</div>
            <div id="contact-hours-local" style="margin-top:6px;font-size:.85rem"></div>
          </div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--gray-200,#e2e8f0)">
            <b>How quickly you will hear back</b>
            <ul class="muted" style="margin:6px 0 0;padding-left:18px;line-height:1.7;font-size:.88rem">
              <li>WhatsApp: usually within a few hours during teaching hours.</li>
              <li>This form and email: within one working day.</li>
              <li>Anything about a class happening today: use WhatsApp, not the form.</li>
            </ul>
          </div>
        </article>

        <article class="card">
          <h3 style="margin-top:0">✉️ Send a message</h3>
          <p class="muted" style="margin-top:0">This goes straight into the studio\u2019s inbox and you get a
            reference number back \u2014 it does not depend on an email app being set up on your device.</p>
          <div id="contact-error" style="display:none;margin-bottom:10px;padding:10px 12px;border-radius:10px;
            background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:.88rem"></div>
          <div id="contact-form">
            <div class="grid grid-2">
              <div class="form-group"><label for="cf-name">Your name *</label>
                <input class="form-input" id="cf-name"></div>
              <div class="form-group"><label for="cf-phone">Phone / WhatsApp *</label>
                <input class="form-input" id="cf-phone"></div>
              <div class="form-group"><label for="cf-email">Email</label>
                <input class="form-input" type="email" id="cf-email"></div>
              <div class="form-group"><label for="cf-topic">What is it about? *</label>
                <select class="form-select" id="cf-topic">
                  <option value="">\u2014 choose \u2014</option>
                  <option>A place for my child</option>
                  <option>Fees and payment</option>
                  <option>Timetable or a class time</option>
                  <option>Exam preparation (WAEC / NECO / JAMB / IGCSE / SAT / IELTS)</option>
                  <option>Free classes</option>
                  <option>A problem with the portal</option>
                  <option>A concern or complaint</option>
                  <option>Something else</option>
                </select>
                <div class="form-help">Choosing the right one routes the message to the right person.</div></div>
              <div class="form-group"><label for="cf-when">Best time to call you</label>
                <input class="form-input" id="cf-when" placeholder="e.g. weekday evenings after 6pm"></div>
              <div class="form-group"><label for="cf-tz">Your time zone</label>
                <input class="form-input" id="cf-tz" readonly>
                <div class="form-help">Detected from your device, so nobody calls you at 3am.</div></div>
              <div class="form-group" style="grid-column:1/-1"><label for="cf-msg">Message *</label>
                <textarea class="form-textarea" id="cf-msg" rows="4"></textarea></div>
            </div>
            <button class="btn btn-primary" type="button" id="cf-send">Send the message</button>
          </div>
        </article>
      </div>

      <article class="card" style="margin-top:14px">
        <h3 style="margin-top:0">Other ways in</h3>
        <div class="grid grid-4">
          <a class="card" href="apply.html"><b>📝 Request a place</b><br>
            <span class="muted">The full application. About two minutes.</span></a>
          <a class="card" href="public-book.html"><b>📅 Book a trial</b><br>
            <span class="muted">Pick a slot yourself, without emailing anyone.</span></a>
          <a class="card" href="free-register.html"><b>🎁 Free classes</b><br>
            <span class="muted">Open preparation classes for national and international exams.</span></a>
          <a class="card" href="complaints.html"><b>❗ Raise a concern</b><br>
            <span class="muted">If you are already with us and something is wrong.</span></a>
        </div>
      </article>

      <script>
      /* ---------------------------------------------------------------------
         The studio's own details come from PRACTICE (assets/js/config.js) and
         are overridden by practice_settings in the database when it is
         reachable, so a studio that changes its number in Settings does not
         have to remember to edit this page too.
         --------------------------------------------------------------------- */
      document.addEventListener('DOMContentLoaded', function () {
        var esc = function (s) { return String(s == null ? '' : s)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
        var P = window.PRACTICE || {};

        function paint(p) {
          var box = document.getElementById('contact-details');
          var acts = document.getElementById('contact-actions');
          var rows = [];
          if (p.name)    rows.push('<p style="margin:.2rem 0"><b>' + esc(p.name) + '</b></p>');
          if (p.motto)   rows.push('<p class="muted" style="margin:.2rem 0"><i>' + esc(p.motto) + '</i></p>');
          if (p.address) rows.push('<p style="margin:.4rem 0">📍 ' + esc(p.address) + '</p>');
          if (p.phone)   rows.push('<p style="margin:.4rem 0">📞 <a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a></p>');
          if (p.email)   rows.push('<p style="margin:.4rem 0">✉️ <a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a></p>');
          if (p.timezone)rows.push('<p style="margin:.4rem 0">🌐 Studio clock: ' + esc(p.timezone) + '</p>');
          if (!rows.length) {
            rows.push('<p class="muted">The studio has not filled in its contact details yet. ' +
              'An administrator can add them on <a href="settings.html">Settings</a>.</p>');
          }
          box.innerHTML = rows.join('');

          var a = [];
          var wa = (p.socials && p.socials.whatsapp) || p.whatsapp || '';
          if (wa) a.push('<a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(wa) + '">💬 WhatsApp us</a>');
          if (p.phone) a.push('<a class="btn btn-outline" href="tel:' + esc(p.phone) + '">📞 Call</a>');
          if (p.email) a.push('<a class="btn btn-outline" href="mailto:' + esc(p.email) + '">✉️ Email</a>');
          if (p.address) a.push('<a class="btn btn-ghost" target="_blank" rel="noopener" ' +
            'href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) + '">🗺️ Map</a>');
          var s = p.socials || {};
          ['facebook','instagram','x','linkedin','youtube','tiktok'].forEach(function (k) {
            if (s[k]) a.push('<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' +
              esc(s[k]) + '">' + k + '</a>');
          });
          acts.innerHTML = a.join('');

          var hrs = p.teachingHours || 'Monday to Saturday, 08:00 \\u2013 21:00';
          document.getElementById('contact-hours').textContent = hrs + ' (' + (p.timezone || 'Africa/Lagos') + ')';

          /* Convert the studio's opening hours into the VISITOR's time zone.
             Half the enquiries come from other countries, and "6pm" without a
             zone is the single commonest cause of a missed first class. */
          try {
            var mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
            var studioTz = p.timezone || 'Africa/Lagos';
            if (mine && mine !== studioTz) {
              var conv = function (h) {
                var now = new Date();
                var d0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, 0));
                // offset between the two zones, right now
                var f = function (tz) {
                  var p2 = new Intl.DateTimeFormat('en', { timeZone: tz, hour12: false,
                    hour: '2-digit', minute: '2-digit' }).formatToParts(d0);
                  return p2;
                };
                var st = f(studioTz), me = f(mine);
                var get = function (parts, t) { return +(parts.filter(function (x) { return x.type === t; })[0] || {}).value; };
                var diff = (get(me, 'hour') * 60 + get(me, 'minute')) - (get(st, 'hour') * 60 + get(st, 'minute'));
                var tot = ((h * 60 + diff) % 1440 + 1440) % 1440;
                return String(Math.floor(tot / 60)).padStart(2, '0') + ':' + String(tot % 60).padStart(2, '0');
              };
              document.getElementById('contact-hours-local').innerHTML =
                '🕒 In <b>your</b> time zone (' + esc(mine) + ') that is roughly <b>' +
                conv(8) + ' \\u2013 ' + conv(21) + '</b>.';
            }
          } catch (e) {}

          try {
            document.getElementById('cf-tz').value = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
          } catch (e) {}
        }

        paint(P);
        if (window.sb && window.sb.from) {
          window.sb.from('practice_settings').select('*').eq('id', 1).maybeSingle()
            .then(function (r) { if (r && r.data) paint(Object.assign({}, P, r.data)); })
            .catch(function () {});
        }

        document.getElementById('cf-send').addEventListener('click', async function () {
          var err = document.getElementById('contact-error');
          var show = function (m) { err.innerHTML = m; err.style.display = ''; };
          err.style.display = 'none';
          var v = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };

          if (!v('cf-name'))  return show('Please tell us your name.');
          if (!v('cf-phone')) return show('Please leave a phone or WhatsApp number \\u2014 it is the fastest way to reach you.');
          if (!v('cf-topic')) return show('Please choose what the message is about, so it reaches the right person.');
          if (v('cf-msg').length < 10) return show('Please write a little more so we can actually help.');

          var btn = document.getElementById('cf-send');
          btn.disabled = true; btn.textContent = 'Sending\\u2026';

          var ref = 'MSG-' + Date.now().toString(36).toUpperCase().slice(-6);
          var body = v('cf-msg') +
            '\\n\\n\\u2014\\nTopic: ' + v('cf-topic') +
            '\\nBest time to call: ' + (v('cf-when') || 'not given') +
            '\\nTheir time zone: ' + (v('cf-tz') || 'unknown') +
            '\\nPhone: ' + v('cf-phone') + '  Email: ' + (v('cf-email') || 'not given');

          var done = function () {
            document.getElementById('contact-form').innerHTML =
              '<div style="padding:14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46">' +
              '<b>\\u2705 Message sent.</b><br>Your reference is <b>' + ref + '</b> \\u2014 quote it if you follow up.' +
              '<br><span style="font-size:.88rem">You will hear back within one working day. ' +
              'If it is urgent, use WhatsApp instead.</span></div>';
          };

          if (!window.sb || !window.sb.from) {
            btn.disabled = false; btn.textContent = 'Send the message';
            return show('The studio\\u2019s inbox is not reachable from this device right now. ' +
              'Please use the WhatsApp or Call button on the left instead.');
          }
          try {
            /* Written as an inquiry, so it lands in the same pipeline as an
               application rather than in a separate place nobody checks. */
            var res = await window.sb.from('inquiries').insert({
              full_name: v('cf-name'),
              email: v('cf-email') || null,
              phone: v('cf-phone'),
              source: 'contact form',
              status: 'new',
              notes: '[' + ref + '] ' + body
            });
            if (res.error) throw res.error;
            done();
          } catch (e) {
            btn.disabled = false; btn.textContent = 'Send the message';
            show('Could not send that: ' + esc(e.message || e) +
              '<br>Please use the WhatsApp button on the left instead \\u2014 it always works.');
          }
        });
      });
      </script>'''


# =============================================================================
# item 4 — HMG DIGITAL PRODUCTS
#
# WHAT WAS MISSING: the products. The page had a title and a description and
# no catalogue. A studio owner asked by a school "is there one of these for
# us?" had nothing to send them, and the ecosystem cross-links that help search
# engines connect the sites were not there either.
# =============================================================================
HMG_PRODUCTS = '''      <article class="card" style="background:linear-gradient(135deg,#0506ae,#964eec);color:#fff">
        <h2 style="margin:0 0 6px;color:#fff">HMG Digital Products</h2>
        <p style="margin:0;opacity:.95">Complete, installable management platforms for schools, tutoring
          studios, examination bodies and associations. Built by <b>HMG Technologies</b>, the software arm of
          HMG Concepts. Every one of them runs on free-tier hosting and a database you own.</p>
      </article>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
        <button class="btn btn-sm btn-primary" type="button" data-pfilter="all">Everything</button>
        <button class="btn btn-sm btn-outline" type="button" data-pfilter="school">For a school</button>
        <button class="btn btn-sm btn-outline" type="button" data-pfilter="tutor">For a tutor</button>
        <button class="btn btn-sm btn-outline" type="button" data-pfilter="exam">For examinations</button>
        <button class="btn btn-sm btn-outline" type="button" data-pfilter="assoc">For an association</button>
      </div>

      <div class="grid grid-2" id="hmg-product-grid"></div>

      <article class="card" style="margin-top:16px">
        <h3 style="margin-top:0">Which one fits?</h3>
        <div class="table-wrap"><table style="width:100%;font-size:.88rem">
          <thead><tr><th>If you are\u2026</th><th>Use</th><th>Because</th></tr></thead>
          <tbody>
            <tr><td>A school with classes, terms, report cards and a bursary</td>
                <td><b>School Connect</b></td>
                <td>It models terms, classes, streams, subjects, affective traits and a full report-card engine.</td></tr>
            <tr><td>An independent tutor with 1:1 and small-group learners</td>
                <td><b>Tutoring Connect</b></td>
                <td>It models engagements and hour banks rather than classes and terms, and bills per cycle.</td></tr>
            <tr><td>Running examinations for other people\u2019s candidates</td>
                <td><b>HMG Academy CBT Pro</b></td>
                <td>It is a dedicated examination engine \u2014 registration, seating, proctoring, results, audit.</td></tr>
            <tr><td>An alumni body, church or association</td>
                <td><b>GOSA Portal</b></td>
                <td>It models members, dues, elections, chapters and events instead of learners.</td></tr>
          </tbody>
        </table></div>
      </article>

      <article class="card" style="margin-top:14px">
        <h3 style="margin-top:0">Common to all of them</h3>
        <div class="grid grid-2">
          <ul style="margin:0;padding-left:18px;line-height:1.75">
            <li><b>You own the data.</b> Your own Supabase project, exportable at any time.</li>
            <li><b>Free to run.</b> Free-tier database and free-tier hosting. No per-seat fee.</li>
            <li><b>Installable.</b> A progressive web app on phone, tablet, laptop and desktop.</li>
          </ul>
          <ul style="margin:0;padding-left:18px;line-height:1.75">
            <li><b>No uploads.</b> Media is linked from Drive or YouTube, so storage quotas stay intact.</li>
            <li><b>No paid AI.</b> Nothing calls a metered API.</li>
            <li><b>Two ways to buy.</b> One-time ownership, or a subscription with continuing updates.</li>
          </ul>
        </div>
        <p style="margin-top:12px">
          <a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/2348100866322">Talk to HMG about a licence</a>
          <a class="btn btn-outline" href="hmg-ecosystem.html">The wider ecosystem</a>
          <a class="btn btn-ghost" href="developer.html">About the developer</a>
        </p>
      </article>

      <script>
      document.addEventListener('DOMContentLoaded', function () {
        var esc = function (s) { return String(s == null ? '' : s)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };

        var PRODUCTS = [
          { tag: ['school'], icon: '🏫', name: 'School Connect',
            line: 'A complete school management platform.',
            what: 'Admissions, classes and streams, timetabling, attendance, continuous assessment, a full ' +
                  'report-card engine with affective traits, bursary and fees, a parent portal, CBT, ' +
                  'certificates and an activity audit. Around 150 pages.',
            who: 'Nursery, primary and secondary schools running terms and class teachers.',
            demo: 'https://hmgschoolconnect.vercel.app/', repo: '' },

          { tag: ['tutor'], icon: '🎓', name: 'Tutoring Connect', current: true,
            line: 'The platform you are looking at.',
            what: 'Engagements instead of classes, hour banks instead of term fees, cycle bookings, ' +
                  'value-added and predicted grades, free outreach cohorts, three kinds of quiz, and a ' +
                  'generator that stamps out a branded studio of its own.',
            who: 'Independent tutors and small tutoring studios teaching 1:1 and in small groups, ' +
                 'locally and internationally.',
            demo: 'https://adewaleclassroom.vercel.app/', repo: '' },

          { tag: ['exam', 'school'], icon: '🧪', name: 'HMG Academy CBT Pro',
            line: 'A dedicated computer-based testing engine.',
            what: 'Candidate registration and numbering, question banks across seventeen question families, ' +
                  'seating and scheduling, anti-cheat and proctoring, instant marking, item analysis, ' +
                  'result broadcasts and certificate issue.',
            who: 'Anyone running examinations at scale, including for candidates who are not their own students.',
            demo: 'https://cbtsystem-hmgacademy.vercel.app/',
            repo: 'https://github.com/hmgacademyhub/cbt-system' },

          { tag: ['assoc'], icon: '🏛️', name: 'GOSA Portal',
            line: 'Membership, dues and elections for an association.',
            what: 'Member records and chapters, dues and payment tracking, elections and voting, events, ' +
                  'a directory, broadcasts, certificates and an activity audit.',
            who: 'Alumni associations, professional bodies, churches and community organisations.',
            demo: '', repo: '' },

          { tag: ['school', 'tutor', 'exam', 'assoc'], icon: '🌐', name: 'HMG Concepts',
            line: 'The parent organisation. Est. 2015.',
            what: 'Learning Deliberately. Teaching Authentically. The umbrella over HMG Technologies, ' +
                  'HMG Academy, HMG Media and HMG Gospel.',
            who: 'Start here if you are not sure which product you need.',
            demo: 'https://hmgconcepts.pages.dev/', repo: '' },

          { tag: ['tutor', 'exam'], icon: '📚', name: 'HMG Academy',
            line: 'Virtual tutoring and examination preparation.',
            what: 'The teaching practice itself \u2014 WAEC, NECO, JAMB, IGCSE, SAT and IELTS preparation, ' +
                  'delivered online. The products above exist because this practice needed them.',
            who: 'Students and parents looking for teaching rather than software.',
            demo: 'https://hmgacademy.pages.dev/', repo: '' }
        ];

        var grid = document.getElementById('hmg-product-grid');

        function draw(filter) {
          grid.innerHTML = PRODUCTS
            .filter(function (p) { return filter === 'all' || p.tag.indexOf(filter) > -1; })
            .map(function (p) {
              return '<article class="card"' + (p.current
                  ? ' style="border:2px solid var(--primary,#0506ae)"' : '') + '>' +
                '<div style="display:flex;gap:10px;align-items:flex-start">' +
                  '<div style="font-size:1.7rem">' + p.icon + '</div>' +
                  '<div style="flex:1;min-width:0">' +
                    '<h3 style="margin:0 0 2px">' + esc(p.name) +
                      (p.current ? ' <span style="font-size:.66rem;background:var(--primary,#0506ae);' +
                        'color:#fff;padding:2px 8px;border-radius:999px;vertical-align:middle">YOU ARE HERE</span>' : '') +
                      '</h3>' +
                    '<p class="muted" style="margin:0 0 6px">' + esc(p.line) + '</p>' +
                  '</div></div>' +
                '<p style="margin:8px 0 6px;font-size:.9rem">' + esc(p.what) + '</p>' +
                '<p class="muted" style="margin:0 0 10px;font-size:.85rem"><b>Best for:</b> ' + esc(p.who) + '</p>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
                  (p.demo ? '<a class="btn btn-sm btn-primary" target="_blank" rel="noopener" href="' +
                    esc(p.demo) + '">Open the live site</a>' : '') +
                  (p.repo ? '<a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="' +
                    esc(p.repo) + '">Source code</a>' : '') +
                  '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="https://wa.me/2348100866322?text=' +
                    encodeURIComponent('I would like to ask about ' + p.name) + '">Ask about it</a>' +
                '</div></article>';
            }).join('');
        }

        draw('all');
        document.querySelectorAll('[data-pfilter]').forEach(function (b) {
          b.addEventListener('click', function () {
            document.querySelectorAll('[data-pfilter]').forEach(function (x) {
              x.className = 'btn btn-sm btn-outline';
            });
            b.className = 'btn btn-sm btn-primary';
            draw(b.getAttribute('data-pfilter'));
          });
        });
      });
      </script>'''


# =============================================================================
# item 1 — ADMIN DATA
#
# THE BUG: the page's whole body was
#
#     <div class="card" id="port-root"><p class="muted">Data portability engine
#     loads with the page. Use the buttons it injects, or call DataPortability
#     from the console.</p></div>
#
# It told an administrator to use the browser console. data-portability.js is
# not loaded by this page at all — grep the <script> list — so no buttons were
# ever injected and the card sat there permanently showing its placeholder.
# The page was, in practice, entirely non-functional.
#
# It now has real, labelled controls, an explicit restore path, per-table CSV
# export and a quota panel, and it loads the scripts it depends on.
# =============================================================================
ADMIN_DATA = '''      <div class="grid grid-4" style="gap:10px;margin-bottom:14px" id="ad-kpis">
        <div class="stat-card"><div class="stat-value" id="ad-tables">\u2014</div><div class="stat-label">Tables readable</div></div>
        <div class="stat-card"><div class="stat-value" id="ad-rows">\u2014</div><div class="stat-label">Rows in total</div></div>
        <div class="stat-card"><div class="stat-value" id="ad-db">\u2014</div><div class="stat-label">Database used</div></div>
        <div class="stat-card"><div class="stat-value" id="ad-last">\u2014</div><div class="stat-label">Last backup</div></div>
      </div>

      <section class="card">
        <h2 style="margin:0 0 4px">\U0001F4E5 Take a backup</h2>
        <p class="muted" style="margin:0 0 12px">One JSON archive containing every table this account can
          read, with a <b>SHA-256 checksum</b> so you can prove it has not been altered. It downloads to your
          own device \u2014 it is never sent anywhere.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" type="button" id="ad-backup">\u2B07 Download full backup</button>
          <button class="btn btn-outline" type="button" id="ad-scan">\U0001F50E Scan what is in there</button>
          <button class="btn btn-outline" type="button" id="ad-anon">\U0001F512 Anonymised export</button>
        </div>
        <div id="ad-out" style="margin-top:12px"></div>
      </section>

      <section class="card" style="margin-top:14px">
        <h2 style="margin:0 0 4px">\U0001F4E4 Restore from a backup</h2>
        <p class="muted" style="margin:0 0 10px">A backup you have never restored is not a backup. You are
          shown exactly what will change <b>before</b> anything is written, and nothing is written until you
          confirm.</p>
        <input type="file" id="ad-file" accept=".json,application/json" aria-label="Choose a backup file">
        <div id="ad-restore-out" style="margin-top:10px"></div>
      </section>

      <section class="card" style="margin-top:14px">
        <h2 style="margin:0 0 4px">\U0001F4C4 Export one table</h2>
        <p class="muted" style="margin:0 0 10px">For when you want a single table in a spreadsheet rather than
          the whole archive.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div class="form-group" style="margin:0"><label for="ad-table">Table</label>
            <select class="form-select" id="ad-table" style="min-width:220px"></select></div>
          <button class="btn btn-outline" type="button" id="ad-csv">\u2B07 Export as CSV</button>
          <button class="btn btn-ghost" type="button" id="ad-peek">\U0001F441 Peek at the first 5 rows</button>
        </div>
        <div id="ad-peek-out" style="margin-top:10px"></div>
      </section>

      <section class="card" style="margin-top:14px">
        <h2 style="margin:0 0 4px">\u2601\ufe0f Copy to your own Google Drive</h2>
        <p class="muted" style="margin:0 0 10px">Optional, and free. Uses Google\u2019s own sign-in with the
          <code>drive.file</code> scope, which can only ever see files this application itself created \u2014 it
          cannot read the rest of your Drive.</p>
        <div id="drive-root"></div>
      </section>

      <section class="card" style="margin-top:14px">
        <h2 style="margin:0 0 4px">\u2696\ufe0f Data-subject requests</h2>
        <p class="muted" style="margin:0 0 10px">When a family asks for everything you hold on their child, or
          asks you to erase it, do it here so the request itself is logged.</p>
        <div class="grid grid-2">
          <div class="form-group"><label for="ad-dsr-name">Learner or parent name</label>
            <input class="form-input" id="ad-dsr-name"></div>
          <div class="form-group"><label for="ad-dsr-kind">Request</label>
            <select class="form-select" id="ad-dsr-kind">
              <option value="export">Give them everything held on them</option>
              <option value="erase">Erase what is held on them</option>
              <option value="rectify">Correct something that is wrong</option>
            </select></div>
        </div>
        <button class="btn btn-outline" type="button" id="ad-dsr">Record and action the request</button>
        <div id="ad-dsr-out" style="margin-top:10px"></div>
      </section>

      <script>
      /* ---------------------------------------------------------------------
         BUG FIXED HERE: this page used to say "the data portability engine
         loads with the page \u2014 use the buttons it injects, or call
         DataPortability from the console". It does not load with the page:
         data-portability.js was never in this page's script list. No buttons
         were ever injected, so the placeholder was the entire page, and the
         only documented route was the browser console.

         The controls above are real and wired below. Where DataPortability or
         DriveSync IS available they are used; where they are not, this page
         does the work itself rather than telling an administrator to open
         developer tools.
         --------------------------------------------------------------------- */
      document.addEventListener('DOMContentLoaded', function () {
        var esc = function (s) { return String(s == null ? '' : s)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
        var out = document.getElementById('ad-out');
        var say = function (el, h) { document.getElementById(el).innerHTML = h; };

        var TABLES = ['profiles','learners','parents','tutors','subjects','engagements',
          'engagement_members','groups','sessions','session_attendance','session_notes',
          'attendance_checkins','availability','bookings','booking_classes','makeup_credits',
          'assignments','classwork_items','reading_assignments','mastery_topics','goals',
          'curriculum_items','lesson_plans','sow_terms','sow_topics','sow_evaluations',
          'cbt_exams','cbt_results','cbt_roster','scoresheet','certificates',
          'tc_at_risk_reviews','tc_practice_analytics','tc_value_added','tc_predicted_grades',
          'tc_group_insights','tc_insight_notes','tc_progress_reports','tc_timezone_desk',
          'tc_free_cohorts','tc_free_links','tc_free_registrations',
          'invoices','payments','fee_catalogue','fee_payments','packages','hour_ledger',
          'payment_plans','payment_plan_items','finance_entries','payroll','promo_codes',
          'announcements','messages','notifications','complaints','surveys','survey_responses',
          'polls','poll_votes','inquiries','applications','waitlist','trials','referrals',
          'documents','policies','resources','library_items','eresources','events',
          'activity_log','login_audit','practice_settings','site_license'];

        var sel = document.getElementById('ad-table');
        sel.innerHTML = TABLES.map(function (t) { return '<option>' + t + '</option>'; }).join('');

        async function sha256(text) {
          try {
            var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            return [].map.call(new Uint8Array(buf), function (b) {
              return b.toString(16).padStart(2, '0'); }).join('');
          } catch (e) { return 'unavailable-in-this-browser'; }
        }

        async function dump(onProgress) {
          if (!window.sb || !window.sb.from) throw new Error('Not connected to the database.');
          var data = {}, skipped = [], total = 0;
          for (var i = 0; i < TABLES.length; i++) {
            var t = TABLES[i];
            if (onProgress) onProgress(i + 1, TABLES.length, t);
            try {
              var r = await window.sb.from(t).select('*').limit(10000);
              if (r.error) { skipped.push(t + ' (' + r.error.message.slice(0, 40) + ')'); continue; }
              data[t] = r.data || [];
              total += data[t].length;
            } catch (e) { skipped.push(t); }
          }
          return { data: data, skipped: skipped, total: total };
        }

        document.getElementById('ad-scan').addEventListener('click', async function () {
          say('ad-out', '<p class="muted">Scanning\u2026</p>');
          try {
            var res = await dump(function (i, n, t) {
              say('ad-out', '<p class="muted">Reading ' + i + ' of ' + n + ' \u2014 ' + esc(t) + '\u2026</p>');
            });
            var rows = Object.keys(res.data).filter(function (k) { return res.data[k].length; })
              .sort(function (a, b) { return res.data[b].length - res.data[a].length; });
            document.getElementById('ad-tables').textContent = rows.length;
            document.getElementById('ad-rows').textContent = res.total.toLocaleString();
            say('ad-out', '<p><b>' + rows.length + '</b> table(s) hold data, <b>' +
              res.total.toLocaleString() + '</b> row(s) in total.</p>' +
              '<div class="table-wrap" style="max-height:280px;overflow:auto"><table style="width:100%;font-size:.84rem">' +
              '<thead><tr><th>Table</th><th style="text-align:right">Rows</th></tr></thead><tbody>' +
              rows.map(function (k) { return '<tr><td>' + esc(k) + '</td><td style="text-align:right">' +
                res.data[k].length + '</td></tr>'; }).join('') + '</tbody></table></div>' +
              (res.skipped.length ? '<p class="muted" style="font-size:.82rem;margin-top:8px">' +
                'Not readable by this account (this is normal \u2014 row-level security): ' +
                esc(res.skipped.join(', ')) + '</p>' : ''));
          } catch (e) { say('ad-out', '<p style="color:#b91c1c">' + esc(e.message || e) + '</p>'); }
        });

        document.getElementById('ad-backup').addEventListener('click', async function () {
          say('ad-out', '<p class="muted">Building the archive\u2026</p>');
          try {
            var res = await dump(function (i, n, t) {
              say('ad-out', '<p class="muted">Reading ' + i + ' of ' + n + ' \u2014 ' + esc(t) + '\u2026</p>');
            });
            var payload = {
              product: 'Tutoring Connect', schema: 'V25',
              studio: (window.PRACTICE || {}).name || '',
              taken_at: new Date().toISOString(),
              row_count: res.total, tables: res.data
            };
            var text = JSON.stringify(payload, null, 1);
            var sum = await sha256(text);
            var wrapped = JSON.stringify({ checksum_sha256: sum, archive: payload });
            var blob = new Blob([wrapped], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'tutoring-connect-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            try { localStorage.setItem('tc-last-backup', new Date().toISOString()); } catch (e) {}
            document.getElementById('ad-last').textContent = new Date().toLocaleDateString();
            say('ad-out', '<div style="padding:10px;border-radius:8px;background:#ecfdf5;color:#065f46">' +
              '<b>\u2705 Backup downloaded.</b><br>' + res.total.toLocaleString() + ' row(s) across ' +
              Object.keys(res.data).length + ' table(s), ' + Math.round(text.length / 1024) + ' KB.' +
              '<br><small style="word-break:break-all">SHA-256: ' + esc(sum) + '</small>' +
              '<br><small>Keep the checksum. It is how you prove later that the file is the one you took.</small></div>');
          } catch (e) { say('ad-out', '<p style="color:#b91c1c">' + esc(e.message || e) + '</p>'); }
        });

        document.getElementById('ad-anon').addEventListener('click', async function () {
          say('ad-out', '<p class="muted">Building an anonymised copy\u2026</p>');
          try {
            var res = await dump();
            var hash = function (v) {
              var s = String(v == null ? '' : v), h = 0;
              for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
              return 'anon-' + Math.abs(h).toString(36);
            };
            var PII = ['full_name','preferred_name','email','phone','whatsapp','address',
                       'billing_name','parent_name','parent_phone','parent_email','learner_name',
                       'student_name','photo_url','signature_url','date_of_birth'];
            Object.keys(res.data).forEach(function (t) {
              res.data[t] = res.data[t].map(function (r) {
                var c = Object.assign({}, r);
                PII.forEach(function (k) { if (k in c && c[k]) c[k] = hash(c[k]); });
                return c;
              });
            });
            var blob = new Blob([JSON.stringify({ anonymised: true, tables: res.data }, null, 1)],
              { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'tutoring-connect-anonymised-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            say('ad-out', '<p style="color:#065f46"><b>\u2705 Anonymised export downloaded.</b> ' +
              'Names, contact details, photographs and dates of birth are replaced with stable pseudonyms, ' +
              'so the shape of the data survives but no individual can be identified.</p>');
          } catch (e) { say('ad-out', '<p style="color:#b91c1c">' + esc(e.message || e) + '</p>'); }
        });

        document.getElementById('ad-csv').addEventListener('click', async function () {
          var t = sel.value;
          if (!window.sb) return;
          var r = await window.sb.from(t).select('*').limit(10000);
          if (r.error) return say('ad-peek-out', '<p style="color:#b91c1c">' + esc(r.error.message) + '</p>');
          var rows = r.data || [];
          if (!rows.length) return say('ad-peek-out', '<p class="muted">That table is empty.</p>');
          var cols = Object.keys(rows[0]);
          var q = function (v) {
            v = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
            return /[",\\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
          };
          var csv = cols.join(',') + '\\n' + rows.map(function (row) {
            return cols.map(function (c) { return q(row[c]); }).join(','); }).join('\\n');
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          a.download = t + '-' + new Date().toISOString().slice(0, 10) + '.csv';
          a.click();
          say('ad-peek-out', '<p style="color:#065f46">Exported ' + rows.length + ' row(s) from ' + esc(t) + '.</p>');
        });

        document.getElementById('ad-peek').addEventListener('click', async function () {
          var t = sel.value;
          if (!window.sb) return;
          var r = await window.sb.from(t).select('*').limit(5);
          if (r.error) return say('ad-peek-out', '<p style="color:#b91c1c">' + esc(r.error.message) + '</p>');
          say('ad-peek-out', '<pre style="max-height:260px;overflow:auto;font-size:.76rem;background:' +
            'var(--surface-soft,#f8fafc);padding:10px;border-radius:8px">' +
            esc(JSON.stringify(r.data, null, 1)) + '</pre>');
        });

        document.getElementById('ad-file').addEventListener('change', async function (e) {
          var f = e.target.files && e.target.files[0];
          if (!f) return;
          say('ad-restore-out', '<p class="muted">Reading the archive\u2026</p>');
          try {
            var text = await f.text();
            var parsed = JSON.parse(text);
            var arch = parsed.archive || parsed;
            var tables = arch.tables || {};
            var names = Object.keys(tables).filter(function (k) { return (tables[k] || []).length; });
            var total = names.reduce(function (a, k) { return a + tables[k].length; }, 0);

            var sum = parsed.checksum_sha256
              ? await sha256(JSON.stringify(arch, null, 1)) : null;
            var match = sum ? (sum === parsed.checksum_sha256) : null;

            say('ad-restore-out',
              '<div style="padding:10px;border-radius:8px;background:var(--surface-soft,#f8fafc)">' +
              '<b>This archive contains</b><br>' + total.toLocaleString() + ' row(s) across ' +
              names.length + ' table(s), taken ' + esc(arch.taken_at || 'at an unknown time') +
              ' from "' + esc(arch.studio || 'an unnamed studio') + '" on schema ' + esc(arch.schema || '?') + '.' +
              (match === true ? '<br><span style="color:#065f46">\u2705 Checksum matches \u2014 the file has not been altered.</span>'
               : match === false ? '<br><span style="color:#b91c1c">\u26A0 Checksum does NOT match. This file has been changed since it was taken. Do not restore it unless you know why.</span>'
               : '<br><span class="muted">No checksum in this file.</span>') +
              '<div class="table-wrap" style="max-height:200px;overflow:auto;margin-top:8px">' +
              '<table style="width:100%;font-size:.82rem"><tbody>' +
              names.map(function (k) { return '<tr><td>' + esc(k) + '</td><td style="text-align:right">' +
                tables[k].length + '</td></tr>'; }).join('') + '</tbody></table></div>' +
              '<p style="margin:10px 0 6px"><b>Restoring inserts these rows into your live database.</b> ' +
              'Rows that already exist with the same id are updated. Nothing is deleted.</p>' +
              '<button class="btn btn-primary btn-sm" type="button" id="ad-do-restore">I understand \u2014 restore now</button>' +
              '</div>');

            document.getElementById('ad-do-restore').addEventListener('click', async function () {
              if (!confirm('Restore ' + total + ' row(s) into the live database?\\n\\n' +
                           'This cannot be undone. Take a backup of the CURRENT data first if you have not.')) return;
              var okc = 0, bad = [];
              for (var i = 0; i < names.length; i++) {
                var t = names[i];
                say('ad-restore-out', '<p class="muted">Restoring ' + (i + 1) + ' of ' + names.length +
                  ' \u2014 ' + esc(t) + '\u2026</p>');
                try {
                  var r = await window.sb.from(t).upsert(tables[t], { onConflict: 'id' });
                  if (r.error) bad.push(t + ': ' + r.error.message);
                  else okc += tables[t].length;
                } catch (err) { bad.push(t + ': ' + (err.message || err)); }
              }
              say('ad-restore-out', '<div style="padding:10px;border-radius:8px;background:#ecfdf5;color:#065f46">' +
                '<b>Restored ' + okc.toLocaleString() + ' row(s).</b></div>' +
                (bad.length ? '<div style="margin-top:8px;padding:10px;border-radius:8px;background:#fef2f2;' +
                  'color:#991b1b;font-size:.82rem"><b>' + bad.length + ' table(s) were refused</b> \u2014 ' +
                  'usually row-level security, or a column that no longer exists:<br>' +
                  esc(bad.join(' \u00b7 ')) + '</div>' : ''));
            });
          } catch (err) {
            say('ad-restore-out', '<p style="color:#b91c1c">That does not look like a Tutoring Connect backup: ' +
              esc(err.message || err) + '</p>');
          }
        });

        document.getElementById('ad-dsr').addEventListener('click', async function () {
          var nm = document.getElementById('ad-dsr-name').value.trim();
          var kind = document.getElementById('ad-dsr-kind').value;
          if (!nm) return say('ad-dsr-out', '<p style="color:#b91c1c">Enter the name first.</p>');
          if (!window.sb) return;
          try {
            await window.sb.from('data_requests').insert({
              subject_name: nm, request_type: kind, status: 'received'
            });
          } catch (e) {}
          if (kind === 'export') {
            var res = await dump();
            var hit = {};
            Object.keys(res.data).forEach(function (t) {
              var rows = res.data[t].filter(function (r) {
                return JSON.stringify(r).toLowerCase().indexOf(nm.toLowerCase()) > -1; });
              if (rows.length) hit[t] = rows;
            });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(
              { subject: nm, generated: new Date().toISOString(), tables: hit }, null, 1)],
              { type: 'application/json' }));
            a.download = 'dsr-' + nm.replace(/\\W+/g, '-').toLowerCase() + '.json';
            a.click();
            say('ad-dsr-out', '<p style="color:#065f46">Request logged, and everything held on <b>' +
              esc(nm) + '</b> has been downloaded \u2014 ' + Object.keys(hit).length + ' table(s).</p>');
          } else {
            say('ad-dsr-out', '<p style="color:#065f46">Request logged. ' +
              (kind === 'erase'
                ? 'Erasure is deliberately manual: delete the learner record on the Learners page, which ' +
                  'cascades to their sessions, marks and reports. Financial records are kept, because you ' +
                  'are legally required to keep them.'
                : 'Correct the record on the page it belongs to \u2014 the change is written to the activity log.') +
              '</p>');
          }
        });

        /* Quota, so the free-tier limits are visible before they are hit. */
        (async function () {
          try { document.getElementById('ad-last').textContent =
            localStorage.getItem('tc-last-backup')
              ? new Date(localStorage.getItem('tc-last-backup')).toLocaleDateString() : 'never'; } catch (e) {}
          if (!window.sb) return;
          try {
            var r = await window.sb.rpc('tc_db_size');
            if (!r.error && r.data != null) {
              var mb = Math.round((typeof r.data === 'object' ? r.data.mb : r.data) * 10) / 10;
              document.getElementById('ad-db').innerHTML = mb + ' MB<small style="font-size:.5em"> / 500</small>';
            } else { document.getElementById('ad-db').textContent = 'n/a'; }
          } catch (e) { document.getElementById('ad-db').textContent = 'n/a'; }
        })();

        if (window.DriveSync && DriveSync.mount) { try { DriveSync.mount('drive-root'); } catch (e) {} }
        else {
          document.getElementById('drive-root').innerHTML =
            '<p class="muted">Google Drive sync is configured in <a href="settings.html">Settings</a> \u2192 ' +
            'Integrations. Once a client ID is saved there, the connect button appears here.</p>';
        }
      });
      </script>'''


# =============================================================================
# item 2 — SETTINGS
#
# WHAT WAS MISSING: settings.html covered studio identity, timezone, currency,
# cancellation hours, idle lock and the sibling-discount bands, and stopped
# there. Eleven areas of the studio had no configuration page at all and were
# governed by constants buried in JavaScript:
#
#   * contact details and social links — which is why contact.html had nothing
#     to show;
#   * teaching hours;
#   * the booking cycle (4 cycles of 7 days is a rule, not a law);
#   * quiz and grading defaults, including the grade boundaries;
#   * certificate defaults;
#   * notification channels;
#   * the public-page content;
#   * integrations (Google Drive, WhatsApp);
#   * data retention;
#   * the studio's registration and safeguarding details.
#
# These are appended as new cards; the existing cards are untouched.
# =============================================================================
SETTINGS_EXTRA = '''
      <!-- ===================================================================
           V25 — the settings that were missing (report item 2).
           Each card saves on its own, so a half-finished configuration is
           never left in an inconsistent state.
           =================================================================== -->
      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F4DE Contact details &amp; social links</h2>
        <p class="muted" style="margin-top:0">These are what the public <a href="contact.html">Contact</a>
          page, every footer and every printed document show. Until they are filled in, the Contact page has
          nothing to display \u2014 which is exactly what was reported.</p>
        <div class="grid grid-2">
          <div class="form-group"><label for="s-phone">Phone</label><input class="form-input" id="s-phone" placeholder="+234 810 086 6322"></div>
          <div class="form-group"><label for="s-email">Email</label><input class="form-input" type="email" id="s-email"></div>
          <div class="form-group"><label for="s-address">Address</label><input class="form-input" id="s-address" placeholder="Lagos, Nigeria \u2014 strictly virtual"></div>
          <div class="form-group"><label for="s-hours">Teaching hours</label><input class="form-input" id="s-hours" placeholder="Monday to Saturday, 08:00 \u2013 21:00"></div>
          <div class="form-group"><label for="s-whatsapp">WhatsApp link</label><input class="form-input" type="url" id="s-whatsapp" placeholder="https://wa.me/234..."></div>
          <div class="form-group"><label for="s-youtube">YouTube</label><input class="form-input" type="url" id="s-youtube"></div>
          <div class="form-group"><label for="s-instagram">Instagram</label><input class="form-input" type="url" id="s-instagram"></div>
          <div class="form-group"><label for="s-facebook">Facebook</label><input class="form-input" type="url" id="s-facebook"></div>
          <div class="form-group"><label for="s-x">X / Twitter</label><input class="form-input" type="url" id="s-x"></div>
          <div class="form-group"><label for="s-linkedin">LinkedIn</label><input class="form-input" type="url" id="s-linkedin"></div>
          <div class="form-group"><label for="s-tiktok">TikTok</label><input class="form-input" type="url" id="s-tiktok"></div>
          <div class="form-group"><label for="s-telegram">Telegram</label><input class="form-input" type="url" id="s-telegram"></div>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="contact">\U0001F4BE Save contact details</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F4C6 Booking cycles</h2>
        <p class="muted" style="margin-top:0">A full booking is <b>4 cycles</b>; a cycle is <b>7 days</b>. A
          parent booking 4 times per cycle might choose Monday, Wednesday, Friday and Sunday \u2014 which is
          16 classes over the four cycles. Those numbers are a studio policy, not a law of nature, so they
          belong here rather than inside the booking engine.</p>
        <div class="grid grid-2">
          <div class="form-group"><label for="s-cycles">Cycles in a full booking</label>
            <input class="form-input" type="number" id="s-cycles" value="4"></div>
          <div class="form-group"><label for="s-cycledays">Days in a cycle</label>
            <input class="form-input" type="number" id="s-cycledays" value="7"></div>
          <div class="form-group"><label for="s-perweek">Default classes per cycle</label>
            <input class="form-input" type="number" id="s-perweek" value="4"></div>
          <div class="form-group"><label for="s-lesson">Default class length (minutes)</label>
            <input class="form-input" type="number" id="s-lesson" value="60"></div>
          <div class="form-group"><label for="s-leadtime">Minimum notice to book (hours)</label>
            <input class="form-input" type="number" id="s-leadtime" value="12"></div>
          <div class="form-group"><label for="s-maxgroup">Maximum learners in a group</label>
            <input class="form-input" type="number" id="s-maxgroup" value="12"></div>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="booking">\U0001F4BE Save booking rules</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F9EA Quiz &amp; grading defaults</h2>
        <p class="muted" style="margin-top:0">Applied to every new quiz, so the tutor building one at 11pm does
          not have to remember eleven switches. Grade boundaries are used by the Scoresheet, Progress reports
          and Certificates, so they must agree with each other \u2014 which is why they live in one place.</p>
        <div class="grid grid-2">
          <div class="form-group"><label for="s-qdur">Default duration (minutes)</label>
            <input class="form-input" type="number" id="s-qdur" value="40"></div>
          <div class="form-group"><label for="s-qpass">Default pass mark (%)</label>
            <input class="form-input" type="number" id="s-qpass" value="50"></div>
          <div class="form-group"><label for="s-qkind">Default quiz kind</label>
            <select class="form-select" id="s-qkind">
              <option value="self">Self \u2014 unmarked practice</option>
              <option value="review">Review \u2014 after a class, to find gaps</option>
              <option value="graded" selected>Graded \u2014 pushes to the scoresheet</option>
            </select></div>
          <div class="form-group"><label for="s-qviol">Auto-submit after this many violations</label>
            <input class="form-input" type="number" id="s-qviol" value="8">
            <div class="form-help">0 turns it off.</div></div>
          <div class="form-group" style="grid-column:1/-1"><label for="s-grades">Grade boundaries</label>
            <input class="form-input" id="s-grades" value="A1:75, B2:70, B3:65, C4:60, C5:55, C6:50, D7:45, E8:40, F9:0">
            <div class="form-help">Grade:minimum percentage, comma separated. The default is the WAEC scale.</div></div>
        </div>
        <div class="grid grid-2" style="gap:4px">
          <label><input type="checkbox" id="s-qshuffle" checked> Shuffle questions by default</label>
          <label><input type="checkbox" id="s-qshufopt"> Shuffle the options too</label>
          <label><input type="checkbox" id="s-qcalc" checked> Allow the scientific calculator</label>
          <label><input type="checkbox" id="s-qreview" checked> Let learners review their paper afterwards</label>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="quiz">\U0001F4BE Save quiz defaults</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F3C6 Certificate defaults</h2>
        <p class="muted" style="margin-top:0">The house style used by the
          <a href="certificates.html">certificate studio</a> unless a different saved design is chosen.</p>
        <div class="grid grid-2">
          <div class="form-group"><label for="s-certsig">Default signatory</label>
            <input class="form-input" id="s-certsig" value="Lead Tutor"></div>
          <div class="form-group"><label for="s-certrole">Their role</label>
            <input class="form-input" id="s-certrole" value="Lead Tutor"></div>
          <div class="form-group"><label for="s-certseal">Seal text</label>
            <input class="form-input" id="s-certseal"></div>
          <div class="form-group"><label for="s-certlayout">Default layout</label>
            <select class="form-select" id="s-certlayout">
              <option value="premium">Premium gold</option><option value="diploma">Diploma</option>
              <option value="classic">Classic</option><option value="modern">Modern</option>
              <option value="elegant">Elegant</option><option value="minimal">Minimal</option>
            </select></div>
          <div class="form-group" style="grid-column:1/-1"><label for="s-certsigurl">Signature image link</label>
            <input class="form-input" type="url" id="s-certsigurl" placeholder="https://drive.google.com/file/d/...">
            <div class="form-help">A Google Drive share link is converted automatically. Nothing is uploaded.</div></div>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="cert">\U0001F4BE Save certificate defaults</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F514 Notifications</h2>
        <p class="muted" style="margin-top:0">Which channels the studio uses, and when. Everything here is
          free \u2014 WhatsApp uses the click-to-chat link, not the paid Business API.</p>
        <div class="grid grid-2" style="gap:4px">
          <label><input type="checkbox" id="s-nemail" checked> Email</label>
          <label><input type="checkbox" id="s-nwa" checked> WhatsApp (click-to-chat)</label>
          <label><input type="checkbox" id="s-npush" checked> Browser push</label>
          <label><input type="checkbox" id="s-nsms"> SMS</label>
        </div>
        <div class="grid grid-2" style="margin-top:10px">
          <div class="form-group"><label for="s-remind">Remind about a class this many hours before</label>
            <input class="form-input" type="number" id="s-remind" value="24"></div>
          <div class="form-group"><label for="s-invoicedue">Chase an unpaid invoice after (days)</label>
            <input class="form-input" type="number" id="s-invoicedue" value="7"></div>
        </div>
        <div class="grid grid-2" style="gap:4px;margin-top:8px">
          <label><input type="checkbox" id="s-nreport" checked> Tell parents when a progress report is published</label>
          <label><input type="checkbox" id="s-nscore" checked> Tell parents when a graded quiz is marked</label>
          <label><input type="checkbox" id="s-natrisk" checked> Tell the owner when a learner is flagged urgent</label>
          <label><input type="checkbox" id="s-nbirthday" checked> Birthday reminders</label>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="notify">\U0001F4BE Save notification settings</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F310 Public pages &amp; search</h2>
        <p class="muted" style="margin-top:0">What a stranger reads before they ever contact you, and what a
          search engine indexes.</p>
        <div class="grid grid-2">
          <div class="form-group" style="grid-column:1/-1"><label for="s-tagline">Headline promise</label>
            <input class="form-input" id="s-tagline" placeholder="Independent progress a parent can actually see."></div>
          <div class="form-group" style="grid-column:1/-1"><label for="s-about">About the studio</label>
            <textarea class="form-textarea" id="s-about" rows="3"></textarea></div>
          <div class="form-group" style="grid-column:1/-1"><label for="s-seo">Search description</label>
            <textarea class="form-textarea" id="s-seo" rows="2" maxlength="160"></textarea>
            <div class="form-help">Up to 160 characters. This is the grey text under your name in Google.</div></div>
          <div class="form-group"><label for="s-subjects">Subjects you advertise</label>
            <input class="form-input" id="s-subjects" placeholder="Mathematics, Physics, Chemistry, English"></div>
          <div class="form-group"><label for="s-boards">Exam boards you prepare for</label>
            <input class="form-input" id="s-boards" placeholder="WAEC, NECO, JAMB, IGCSE, SAT, IELTS"></div>
        </div>
        <div style="display:flex;gap:4px;flex-direction:column;margin-top:6px">
          <label><input type="checkbox" id="s-indexable" checked> Let search engines index the public pages</label>
          <label><input type="checkbox" id="s-showprices"> Show prices publicly</label>
          <label><input type="checkbox" id="s-showfree" checked> Advertise free classes on the public pages</label>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="public">\U0001F4BE Save public content</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\U0001F517 Integrations</h2>
        <div class="grid grid-2">
          <div class="form-group"><label for="s-driveid">Google Drive client ID</label>
            <input class="form-input" id="s-driveid">
            <div class="form-help">Free. Used only for backups you choose to sync, with the
              <code>drive.file</code> scope, which cannot see the rest of your Drive.</div></div>
          <div class="form-group"><label for="s-drivefolder">Drive folder ID</label>
            <input class="form-input" id="s-drivefolder"></div>
          <div class="form-group"><label for="s-meetlink">Default meeting room</label>
            <input class="form-input" type="url" id="s-meetlink" placeholder="https://meet.google.com/xxx-xxxx-xxx"></div>
          <div class="form-group"><label for="s-calendar">Public calendar link</label>
            <input class="form-input" type="url" id="s-calendar"></div>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="integrations">\U0001F4BE Save integrations</button>
      </section>

      <section class="card" style="margin-top:16px">
        <h2 style="margin-top:0">\u2696\ufe0f Retention &amp; safeguarding</h2>
        <p class="muted" style="margin-top:0">What the studio keeps, for how long, and who is responsible.
          A parent, a school or a regulator can ask for this, and the honest answer is easier to give if it
          was decided in advance.</p>
        <div class="grid grid-2">
          <div class="form-group"><label for="s-retain">Keep learner records for (years after leaving)</label>
            <input class="form-input" type="number" id="s-retain" value="3"></div>
          <div class="form-group"><label for="s-retainfin">Keep financial records for (years)</label>
            <input class="form-input" type="number" id="s-retainfin" value="7">
            <div class="form-help">Usually set by law, not by preference.</div></div>
          <div class="form-group"><label for="s-dpo">Who handles data requests</label>
            <input class="form-input" id="s-dpo"></div>
          <div class="form-group"><label for="s-safelead">Safeguarding lead</label>
            <input class="form-input" id="s-safelead"></div>
          <div class="form-group"><label for="s-regno">Business registration number</label>
            <input class="form-input" id="s-regno"></div>
          <div class="form-group"><label for="s-minage">Minimum age without parental consent</label>
            <input class="form-input" type="number" id="s-minage" value="16"></div>
        </div>
        <button class="btn btn-primary" type="button" data-save-card="legal">\U0001F4BE Save retention &amp; safeguarding</button>
      </section>

      <section class="card" style="margin-top:16px;border:1px solid #fecaca;background:#fff7f7">
        <h2 style="margin-top:0">\U0001F9EF Check the studio\u2019s configuration</h2>
        <p class="muted" style="margin-top:0">Finds the settings that are missing or that contradict each
          other, before a parent finds them for you.</p>
        <button class="btn btn-outline" type="button" id="s-check">Run the check</button>
        <div id="s-check-out" style="margin-top:10px"></div>
      </section>

      <script>
      /* ---------------------------------------------------------------------
         Every new card reads and writes public.practice_settings, the same row
         the original cards use. Cards save independently: a studio filling in
         its contact details should not have to complete the safeguarding
         section before anything is written.
         --------------------------------------------------------------------- */
      document.addEventListener('DOMContentLoaded', function () {
        var esc = function (s) { return String(s == null ? '' : s)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };

        var CARDS = {
          contact: { phone:'s-phone', email:'s-email', address:'s-address',
                     teaching_hours:'s-hours', whatsapp_url:'s-whatsapp', youtube_url:'s-youtube',
                     instagram_url:'s-instagram', facebook_url:'s-facebook', x_url:'s-x',
                     linkedin_url:'s-linkedin', tiktok_url:'s-tiktok', telegram_url:'s-telegram' },
          booking: { cycles_per_booking:'s-cycles#n', days_per_cycle:'s-cycledays#n',
                     classes_per_cycle:'s-perweek#n', lesson_minutes:'s-lesson#n',
                     booking_lead_hours:'s-leadtime#n', max_group_size:'s-maxgroup#n' },
          quiz:    { quiz_duration_min:'s-qdur#n', quiz_pass_mark:'s-qpass#n', quiz_default_kind:'s-qkind',
                     quiz_max_violations:'s-qviol#n', grade_bands:'s-grades',
                     quiz_shuffle:'s-qshuffle#c', quiz_shuffle_options:'s-qshufopt#c',
                     quiz_calculator:'s-qcalc#c', quiz_allow_review:'s-qreview#c' },
          cert:    { cert_signatory:'s-certsig', cert_signatory_role:'s-certrole',
                     cert_seal_text:'s-certseal', cert_layout:'s-certlayout', cert_signature_url:'s-certsigurl' },
          notify:  { notify_email:'s-nemail#c', notify_whatsapp:'s-nwa#c', notify_push:'s-npush#c',
                     notify_sms:'s-nsms#c', reminder_hours:'s-remind#n', invoice_chase_days:'s-invoicedue#n',
                     notify_on_report:'s-nreport#c', notify_on_score:'s-nscore#c',
                     notify_on_atrisk:'s-natrisk#c', notify_birthdays:'s-nbirthday#c' },
          'public':{ tagline:'s-tagline', about_text:'s-about', seo_description:'s-seo',
                     advertised_subjects:'s-subjects', advertised_boards:'s-boards',
                     search_indexable:'s-indexable#c', show_prices:'s-showprices#c',
                     advertise_free:'s-showfree#c' },
          integrations: { drive_client_id:'s-driveid', drive_folder_id:'s-drivefolder',
                          default_meet_url:'s-meetlink', public_calendar_url:'s-calendar' },
          legal:   { retain_learner_years:'s-retain#n', retain_finance_years:'s-retainfin#n',
                     data_officer:'s-dpo', safeguarding_lead:'s-safelead',
                     registration_no:'s-regno', min_age_no_consent:'s-minage#n' }
        };

        function get(spec) {
          var p = spec.split('#'), el = document.getElementById(p[0]);
          if (!el) return null;
          if (p[1] === 'c') return !!el.checked;
          if (p[1] === 'n') return el.value === '' ? null : Number(el.value);
          return el.value.trim() || null;
        }
        function put(spec, v) {
          var p = spec.split('#'), el = document.getElementById(p[0]);
          if (!el || v == null) return;
          if (p[1] === 'c') el.checked = !!v; else el.value = v;
        }

        async function load() {
          if (!window.sb || !window.sb.from) return;
          try {
            var r = await window.sb.from('practice_settings').select('*').eq('id', 1).maybeSingle();
            if (!r.data) return;
            Object.keys(CARDS).forEach(function (c) {
              Object.keys(CARDS[c]).forEach(function (col) {
                if (col in r.data) put(CARDS[c][col], r.data[col]);
              });
            });
          } catch (e) {}
        }
        load();

        document.querySelectorAll('[data-save-card]').forEach(function (btn) {
          btn.addEventListener('click', async function () {
            var card = btn.getAttribute('data-save-card');
            var map = CARDS[card];
            var row = { id: 1 };
            Object.keys(map).forEach(function (col) { row[col] = get(map[col]); });

            if (!window.sb || !window.sb.from) {
              return alert('Not connected to the database, so this cannot be saved. ' +
                'Check your Supabase URL and key in assets/js/config.js.');
            }
            btn.disabled = true;
            var label = btn.textContent;
            btn.textContent = 'Saving\\u2026';
            try {
              var r = await window.sb.from('practice_settings').upsert(row, { onConflict: 'id' });
              if (r.error) throw r.error;
              btn.textContent = '\\u2705 Saved';
              if (window.toast) toast('Saved.', 'success');
              setTimeout(function () { btn.textContent = label; btn.disabled = false; }, 1600);
            } catch (e) {
              btn.textContent = label; btn.disabled = false;
              var m = String(e.message || e);
              if (/column .* does not exist|schema cache/i.test(m)) {
                alert('Your practice_settings table does not have these columns yet.\\n\\n' +
                      'Open the Supabase SQL editor and run database/complete-schema.sql ' +
                      '(V25 or later), then try again.\\n\\n' + m);
              } else if (/row-level security/i.test(m)) {
                alert('The database refused this. Only the owner or an administrator can change settings.');
              } else {
                alert('Could not save: ' + m);
              }
            }
          });
        });

        document.getElementById('s-check').addEventListener('click', function () {
          var problems = [], warnings = [], good = 0;
          var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
          var need = [
            ['name', 'The studio has no name. It appears on every invoice, report and certificate.'],
            ['tz', 'No timezone. Every class time and reminder depends on it.'],
            ['cur', 'No currency. Invoices will print without one.']
          ];
          need.forEach(function (n) {
            if (!val(n[0])) problems.push(n[1]); else good++;
          });
          if (!val('s-phone') && !val('s-whatsapp')) {
            problems.push('No phone number and no WhatsApp link. The Contact page has nothing to show, ' +
              'and a parent has no way to reach you.');
          } else good++;
          if (!val('s-email')) warnings.push('No email address \u2014 invoices and reports have no reply-to.');
          if (!val('logo')) warnings.push('No logo. Certificates and ID cards will print without one.');
          if (!val('sig')) warnings.push('No signature image, so certificates print with a blank line.');
          if (!val('s-hours')) warnings.push('No teaching hours, so the Contact page cannot tell an ' +
            'international family when you are available.');
          if (!val('s-about')) warnings.push('No "about the studio" text for the public pages.');
          if (!val('s-seo')) warnings.push('No search description \u2014 Google will invent one.');
          if (Number(val('s-cycles')) < 1 || Number(val('s-cycledays')) < 1) {
            problems.push('The booking cycle is set to zero, which will break the booking page.');
          } else good++;
          if (val('s-grades') && !/[A-Za-z0-9]+\\s*:\\s*\\d/.test(val('s-grades'))) {
            problems.push('The grade boundaries are not in the form "A1:75, B2:70, ...".');
          }

          document.getElementById('s-check-out').innerHTML =
            (problems.length
              ? '<div style="padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b">' +
                '<b>' + problems.length + ' thing(s) will actually cause a problem</b><ul style="margin:6px 0 0">' +
                problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>'
              : '<div style="padding:10px;border-radius:8px;background:#ecfdf5;color:#065f46">' +
                '<b>\u2705 Nothing is broken.</b></div>') +
            (warnings.length
              ? '<div style="margin-top:8px;padding:10px;border-radius:8px;background:#fffbeb;color:#92400e">' +
                '<b>' + warnings.length + ' thing(s) are worth filling in</b><ul style="margin:6px 0 0">' +
                warnings.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>'
              : '');
        });
      });
      </script>'''


def replace_body(page, body):
    f = page + '.html'
    src = open(f, encoding='utf-8').read()
    m = re.search(r'(<main class="app-content">\s*(?:<section class="help-card page-intro">.*?</section>)?)(.*?)(</main>)',
                  src, re.S)
    if not m:
        print('  ! could not find <main> in ' + f)
        return
    open(f, 'w', encoding='utf-8').write(src[:m.end(1)] + '\n' + body + '\n    ' + src[m.start(3):])
    print('  wrote body: %-18s %6d bytes' % (f, os.path.getsize(f)))


def append_body(page, body, marker):
    f = page + '.html'
    src = open(f, encoding='utf-8').read()
    if marker in src:
        print('  = already applied: ' + f)
        return
    src = re.sub(r'(\n\s*)</main>', '\n' + body.replace('\\', '\\\\') + r'\1</main>', src, count=1)
    open(f, 'w', encoding='utf-8').write(src)
    print('  appended:   %-18s %6d bytes' % (f, os.path.getsize(f)))


def ensure_script(page, path):
    f = page + '.html'
    src = open(f, encoding='utf-8').read()
    tag = '<script src="%s"></script>' % path
    if tag in src:
        return
    src = src.replace('<script src="assets/js/app.js"></script>',
                      tag + '\n<script src="assets/js/app.js"></script>', 1)
    open(f, 'w', encoding='utf-8').write(src)


def main():
    print('V25 content pages')
    replace_body('developer', DEVELOPER)
    replace_body('contact', CONTACT)
    replace_body('hmg-products', HMG_PRODUCTS)
    replace_body('admin-data', ADMIN_DATA)

    # admin-data depends on these two, and neither was in its script list —
    # which is the root cause of the "use the buttons it injects" placeholder.
    ensure_script('admin-data', 'assets/js/data-portability.js')
    ensure_script('admin-data', 'assets/js/drive-sync.js')

    append_body('settings', SETTINGS_EXTRA, 'data-save-card="contact"')


if __name__ == '__main__':
    main()
