#!/usr/bin/env python3
"""
tools/lint_schema_order.py
================================================================================
Finds statements in database/complete-schema.sql that reference an object
BEFORE it is created.

WHY THIS MATTERS (report items 6 and 11)

The Supabase SQL editor runs the whole file as one script. If any statement
raises, everything after it is abandoned. The user then re-runs the file, hits
the SAME failing statement, and the tail of the file is never installed. That
is precisely the shape of the reported bug:

    "When I click the share icon beside any CBT exam I get 'A table is
     missing'. I re-ran complete-schema.sql and the error is not fixed."

tc_cbt_set_state() lives near the END of the file. If anything earlier aborts,
it is never created, and re-running cannot help because the abort is
deterministic.

Line numbers are reported against the ORIGINAL file. Function bodies are
excluded: a reference inside a dollar-quoted body resolves at CALL time, not
at CREATE time, so a forward reference there is legal and normal.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL = os.path.join(ROOT, 'database', 'complete-schema.sql')
src = open(SQL, encoding='utf-8').read()

# Blank out dollar-quoted bodies but keep their length, so every character
# offset — and therefore every line number — stays true to the original file.
def blank_bodies(text):
    out = list(text)
    for m in re.finditer(r'\$([a-z_]*)\$.*?\$\1\$', text, re.S | re.I):
        for i in range(m.start(), m.end()):
            if out[i] != '\n':
                out[i] = ' '
    return ''.join(out)

flat = blank_bodies(src)

def line_of(offset):
    return src.count('\n', 0, offset) + 1

created_tbl, created_seq = set(), set()
problems = []

# Walk statements in file order, tracking the offset of each.
offset = 0
for stmt in re.split(r'(?<=;)', flat):
    start = offset
    offset += len(stmt)
    s = stmt.strip()
    if not s:
        continue
    low = s.lower()

    # ---- record what this statement creates ----
    for m in re.finditer(r'create table\s+(?:if not exists\s+)?public\.([a-z0-9_]+)', low):
        created_tbl.add(m.group(1))
    for m in re.finditer(r'create sequence\s+(?:if not exists\s+)?public\.([a-z0-9_]+)', low):
        created_seq.add(m.group(1))

    # A DO block is guarded in this codebase (to_regclass / information_schema
    # checks), so its contents are not a hard dependency.
    if low.lstrip().startswith('do '):
        continue

    ln = line_of(start)

    # ---- foreign keys must point at a table that already exists ----
    for m in re.finditer(r'references\s+public\.([a-z0-9_]+)', low):
        if m.group(1) not in created_tbl:
            problems.append((ln, 'FOREIGN KEY -> public.%s not created yet' % m.group(1),
                             s.replace('\n', ' ')[:96]))

    # ---- ALTER / INDEX / POLICY / TRIGGER must target an existing table ----
    if re.match(r'(alter table|create (unique )?index|create policy|create trigger)', low):
        if ' if exists ' in low[:60]:
            pass  # guarded: alter table if exists ... is a no-op on a missing table
        else:
            m = (re.search(r'\bon\s+public\.([a-z0-9_]+)', low) or
                 re.search(r'alter table\s+(?:only\s+)?public\.([a-z0-9_]+)', low))
            if m and m.group(1) not in created_tbl:
                problems.append((ln, '%s targets public.%s before it exists'
                                 % (low.split()[0].upper(), m.group(1)),
                                 s.replace('\n', ' ')[:96]))

    for m in re.finditer(r"nextval\('public\.([a-z0-9_]+)'", low):
        if m.group(1) not in created_seq:
            problems.append((ln, 'nextval on public.%s before it exists' % m.group(1),
                             s.replace('\n', ' ')[:96]))

print('=== SCHEMA ORDER LINT ===')
print('file      : %s' % SQL)
print('tables    : %d' % len(created_tbl))
print('sequences : %d' % len(created_seq))
print()
if problems:
    print('STATEMENTS THAT WOULD ABORT THE SCRIPT: %d' % len(problems))
    print('(everything after the FIRST one never installs)')
    print()
    for ln, why, snip in problems:
        print('  line %-6d %s' % (ln, why))
        print('             %s' % snip)
else:
    print('OK — no forward references. The file runs top to bottom.')
sys.exit(1 if problems else 0)
