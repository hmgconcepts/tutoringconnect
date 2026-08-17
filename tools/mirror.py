#!/usr/bin/env python3
"""mirror.py — rsync stand-in. The sandbox has no rsync, so the every-turn
sync procedure uses this instead. Copies src -> dst, deleting anything in dst
that is no longer in src, while honouring the generator/client exclusions."""
import os, shutil, sys

EXCLUDE_FILES = {'assets/js/config.js', 'assets/js/generator.js', 'assets/js/wizard.js',
                 'builder.html', 'index.html', 'manifest.json',
                 'package.json', 'package-lock.json'}
EXCLUDE_DIRS = {'tools', 'node_modules', 'modern', '.git'}
PLAIN_EXCLUDE_DIRS = {'node_modules', '.git'}

def walk(root, xdirs):
    out = set()
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d not in xdirs]
        for f in fn:
            out.add(os.path.relpath(os.path.join(dp, f), root))
    return out

def main():
    plain = '--plain' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src, dst = args[0], args[1]
    xdirs = PLAIN_EXCLUDE_DIRS if plain else EXCLUDE_DIRS
    xfiles = set() if plain else EXCLUDE_FILES
    want = {r for r in walk(src, xdirs) if r.replace(os.sep, '/') not in xfiles}
    copied = 0
    for rel in sorted(want):
        s, d = os.path.join(src, rel), os.path.join(dst, rel)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        if (not os.path.exists(d)) or os.path.getmtime(s) > os.path.getmtime(d) \
           or os.path.getsize(s) != os.path.getsize(d):
            shutil.copy2(s, d); copied += 1
    removed = 0
    if os.path.isdir(dst):
        for rel in walk(dst, xdirs):
            if rel not in want and rel.replace(os.sep, '/') not in xfiles:
                try: os.remove(os.path.join(dst, rel)); removed += 1
                except OSError: pass
    print('   mirror: %d copied, %d removed -> %s' % (copied, removed, dst))

if __name__ == '__main__':
    main()
