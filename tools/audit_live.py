#!/usr/bin/env python3
"""
audit_live.py — probe the LIVE Supabase project as an anonymous visitor
=======================================================================

WHY THIS EXISTS
---------------
Every previous audit in this project was STATIC: pglast parsed the SQL,
lint_schema.py checked it for duplicates, jsdom loaded the pages. All of it
passed, repeatedly, while the deployed system behaved differently.

Static analysis cannot see a GRANT. It cannot tell you that

    revoke execute on function public.tc_exam_reg_stats() from anon;

does absolutely nothing, because PostgreSQL grants EXECUTE on every new
function to the PUBLIC pseudo-role by default, and `anon` inherits it from
there. Revoking from `anon` leaves the PUBLIC grant untouched. The only
revoke that works is:

    revoke execute on function public.tc_exam_reg_stats() from public;

This tool talks to the real project with the real public anon key — exactly
what a stranger with "view source" has — and reports what they can actually
reach. Read it as an attacker's-eye view of the studio.

USAGE
    python3 tools/audit_live.py                      # uses assets/js/config.js
    python3 tools/audit_live.py --url ... --key ...
    python3 tools/audit_live.py --json report.json
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Functions an anonymous visitor is SUPPOSED to be able to call, because a
# public page genuinely needs them. Everything else reaching anon is a leak.
PUBLIC_OK = {
    'tc_register_candidate',   # the public exam-registration form
    'tc_candidate_lookup',     # a candidate checking their own result
    'tc_cbt_get_exam',         # a learner opening a quiz by code
    'tc_keep_alive',           # the free-tier keep-alive ping
    'tc_license_writable',     # harmless boolean, needed before offering Save
    'lookup_login_email',      # sign-in helper
}

# Sensible probe arguments so a function is not reported missing merely
# because the probe passed no arguments.
ARGS = {
    'tc_register_candidate':  {'p': {'full_name': '__audit_probe__'}},
    'tc_candidate_lookup':    {'p_exam_no': '__none__', 'p_surname': '__none__'},
    'tc_cbt_get_exam':        {'p_code': '__none__'},
    'tc_sibling_discount_pct': {'p_children': 2},
    'tc_no_show_report':      {'p_days': 30},
    'tc_child_summary':       {'p_learner': '00000000-0000-0000-0000-000000000000'},
    'tc_family_statement':    {},
    'tc_exam_to_learner':     {'p_id': '00000000-0000-0000-0000-000000000000'},
    'tc_license_set':         {'p': {}},
    'tc_license_renew':       {'p_months': 0},
    'tc_poll_results':        {'p_poll': '00000000-0000-0000-0000-000000000000'},
    'tc_next_exam_no':        {'p_board': '__audit__', 'p_prefix': '__audit__'},
    'tc_prune_logs':          {'p_days': 999999},
    'tc_slim_cbt_results':    {'p_days': 999999},
}

# Functions that WRITE. The probe must not call these blind against a live
# studio; calling them is how an earlier manual probe inserted a junk
# candidate row into production. Report reachability without invoking.
DESTRUCTIVE = {
    'tc_register_candidate', 'tc_exam_to_learner', 'tc_license_set',
    'tc_license_renew', 'tc_prune_logs', 'tc_slim_cbt_results',
    'tc_push_cbt_to_scoresheet', 'tc_keep_alive', 'tc_next_exam_no',
    'tc_import_backup', 'cbt_import_backup',
}

TABLES = [
    'learners', 'parents', 'tutors', 'engagements', 'sessions',
    'session_attendance', 'session_notes', 'invoices', 'payments',
    'exam_registrations', 'cbt_results', 'cbt_exams', 'messages', 'inbox',
    'site_license', 'practice_settings', 'parent_learner', 'complaints',
    'exam_reg_links', 'application_links', 'inquiries', 'announcements',
]


def cfg_from_repo():
    p = os.path.join(HERE, 'assets', 'js', 'config.js')
    if not os.path.exists(p):
        return None, None
    s = open(p, encoding='utf-8').read()
    u = re.search(r'https://[a-z0-9]+\.supabase\.co', s)
    k = re.search(r'eyJ[A-Za-z0-9_.-]{60,}', s)
    return (u.group(0) if u else None), (k.group(0) if k else None)


def call(url, key, path, method='GET', body=None, timeout=25):
    req = urllib.request.Request(url.rstrip('/') + path, method=method)
    req.add_header('apikey', key)
    req.add_header('Authorization', 'Bearer ' + key)
    req.add_header('Content-Type', 'application/json')
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=timeout) as r:
            return r.status, r.read(4000).decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read(4000).decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)


def fns_in_schema():
    p = os.path.join(HERE, 'database', 'complete-schema.sql')
    s = open(p, encoding='utf-8').read()
    return sorted(set(re.findall(r'create or replace function public\.([a-z0-9_]+)\s*\(', s, re.I)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url')
    ap.add_argument('--key')
    ap.add_argument('--json')
    ap.add_argument('--invoke-writes', action='store_true',
                    help='Also INVOKE write functions. Off by default: it mutates live data.')
    a = ap.parse_args()

    url, key = a.url, a.key
    if not url or not key:
        u2, k2 = cfg_from_repo()
        url, key = url or u2, key or k2
    if not url or not key:
        print('No Supabase URL/key found.')
        return 2

    print('=' * 74)
    print('LIVE ANON AUDIT  ->  %s' % url)
    print('This is what a stranger with "view source" can reach.')
    print('=' * 74)

    report = {'url': url, 'tables': {}, 'functions': {}, 'findings': []}

    # ---- schema version -------------------------------------------------
    st, body = call(url, key, '/rest/v1/rpc/tc_schema_info', 'POST', {})
    ver = None
    if st == 200:
        try:
            j = json.loads(body)
            ver, exp = j.get('version'), j.get('expected')
            report['version'], report['expected'] = ver, exp
            print('\nSchema version installed : %s' % ver)
            print('Schema version expected  : %s' % exp)
            if ver != exp:
                report['findings'].append(
                    'tc_schema_info reports expected=%s but installed=%s — the '
                    'expected constant was never bumped, so schema-doctor '
                    'mis-reports the studio as out of step.' % (exp, ver))
                print('  ^^ MISMATCH — schema-doctor will mis-report this studio.')
        except Exception:
            pass

    # ---- table reads ----------------------------------------------------
    print('\n--- TABLE READS AS ANON (every one should be empty/blocked) ---')
    leaked_tables = []
    for t in TABLES:
        st, body = call(url, key, '/rest/v1/%s?select=*&limit=2' % t)
        try:
            j = json.loads(body)
        except Exception:
            j = None
        if isinstance(j, list) and len(j) > 0:
            state, n = 'LEAK', len(j)
            leaked_tables.append(t)
        elif isinstance(j, list):
            state, n = 'ok (0 rows)', 0
        elif isinstance(j, dict) and j.get('code') == 'PGRST205':
            state, n = 'absent', '-'
        else:
            state, n = 'blocked', '-'
        report['tables'][t] = {'status': st, 'state': state, 'rows': n}
        flag = '  <<< LEAK' if state == 'LEAK' else ''
        print('  %-22s %-3s %-12s%s' % (t, st, state, flag))

    # ---- function reachability -----------------------------------------
    print('\n--- FUNCTION REACHABILITY AS ANON ---')
    print('  (a function an anon can call that is not on the public allow-list')
    print('   is an information leak or an unauthorised action)')
    fns = fns_in_schema()
    leaks = []
    for f in fns:
        if f in DESTRUCTIVE and not a.invoke_writes:
            report['functions'][f] = {'state': 'not probed (writes data)'}
            print('  %-30s %s' % (f, 'skipped — would mutate live data'))
            continue
        st, body = call(url, key, '/rest/v1/rpc/%s' % f, 'POST', ARGS.get(f, {}))
        allowed = f in PUBLIC_OK
        if st == 200:
            state = 'reachable'
            if not allowed:
                leaks.append((f, body[:120]))
        elif st in (401, 403):
            state = 'denied (good)'
        elif st == 404:
            state = 'no such signature'
        else:
            state = 'http %s' % st
        report['functions'][f] = {'status': st, 'state': state,
                                  'public_ok': allowed, 'sample': body[:200]}
        flag = ''
        if st == 200 and not allowed:
            flag = '  <<< REACHABLE BY ANON'
        elif st == 200 and allowed:
            flag = '  (intentionally public)'
        print('  %-30s %-3s %-18s%s' % (f, st, state, flag))

    # ---- verdict --------------------------------------------------------
    print('\n' + '=' * 74)
    print('FINDINGS')
    print('=' * 74)
    if leaked_tables:
        report['findings'].append('Tables readable by anon: %s' % ', '.join(leaked_tables))
        print('\n[CRITICAL] %d table(s) return rows to an anonymous visitor:' % len(leaked_tables))
        for t in leaked_tables:
            print('   - %s' % t)
    else:
        print('\n[OK] No table returns rows to an anonymous visitor. RLS is holding.')

    if leaks:
        report['findings'].append('Functions callable by anon: %s' % ', '.join(f for f, _ in leaks))
        print('\n[CRITICAL] %d function(s) are callable by an anonymous visitor' % len(leaks))
        print('           and are NOT on the public allow-list:')
        for f, sample in leaks:
            print('   - %-28s returns: %s' % (f, sample.replace('\n', ' ')[:100]))
        print('\n   ROOT CAUSE: PostgreSQL grants EXECUTE on every new function to the')
        print('   PUBLIC pseudo-role automatically. "revoke execute ... from anon"')
        print('   does nothing, because the privilege is inherited from PUBLIC, not')
        print('   granted to anon directly. The fix is:')
        print('       revoke execute on function public.NAME(args) from public, anon;')
    else:
        print('\n[OK] No unexpected function is reachable by an anonymous visitor.')

    if a.json:
        json.dump(report, open(a.json, 'w'), indent=1)
        print('\nwrote %s' % a.json)

    return 1 if (leaks or leaked_tables) else 0


if __name__ == '__main__':
    sys.exit(main())
