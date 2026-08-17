#!/usr/bin/env python3
"""
audit_integrity.py — does every page talk to something that exists?
===================================================================
Catches "disconnection": a page calling .from('some_table') or
.rpc('some_function') that the schema never defines. That failure mode is
invisible to jsdom (the call is never made) and invisible to pglast (the
SQL is fine); it only shows up as an empty screen for the user.

Exit code 1 if anything is missing, so CI can gate on it.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    sql = open(os.path.join(ROOT, 'database', 'complete-schema.sql'),
               encoding='utf-8', errors='ignore').read()
    tables = set(re.findall(r'create table (?:if not exists )?public\.([a-z0-9_]+)', sql, re.I))
    views  = set(re.findall(r'create (?:or replace )?view public\.([a-z0-9_]+)', sql, re.I))
    fns    = set(re.findall(r'create or replace function public\.([a-z0-9_]+)', sql, re.I))
    known  = tables | views

    srcs = [f for f in sorted(os.listdir(ROOT)) if f.endswith('.html')]
    jsd  = os.path.join(ROOT, 'assets', 'js')
    if os.path.isdir(jsd):
        srcs += [os.path.join('assets/js', f) for f in sorted(os.listdir(jsd)) if f.endswith('.js')]

    bad_t, bad_f = {}, {}
    for rel in srcs:
        s = open(os.path.join(ROOT, rel), encoding='utf-8', errors='ignore').read()
        for t in set(re.findall(r"\.from\('([a-z0-9_]+)'", s)):
            if t not in known:
                bad_t.setdefault(t, []).append(rel)
        for r in set(re.findall(r"\.rpc\('([a-z0-9_]+)'", s)):
            if r not in fns:
                bad_f.setdefault(r, []).append(rel)

    print('=== INTEGRITY AUDIT ===')
    print('schema: %d tables, %d views, %d functions' % (len(tables), len(views), len(fns)))
    print('scanned: %d source files' % len(srcs))
    print('\nmissing tables referenced by code   : %d' % len(bad_t))
    for t, fs in sorted(bad_t.items()):
        print('  %-30s <- %s' % (t, ', '.join(fs[:5])))
    print('missing functions referenced by code: %d' % len(bad_f))
    for t, fs in sorted(bad_f.items()):
        print('  %-30s <- %s' % (t, ', '.join(fs[:5])))
    bad = len(bad_t) + len(bad_f)
    print('\nRESULT: %s' % ('OK — nothing disconnected' if not bad else '%d BROKEN REFERENCE(S)' % bad))
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
