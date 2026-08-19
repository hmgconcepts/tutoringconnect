#!/usr/bin/env bash
# =====================================================================
# sync_all.sh — the every-turn synchronisation procedure
# ---------------------------------------------------------------------
# 1. Mirror the generator (tutoringconnect) onto the generated client site
#    (adewaleclassroom), EXCLUDING the files that legitimately differ.
# 2. Strip generator-only files out of the client site.
# 3. Re-bake the GOSA / HMG house identity into every client page.
# 4. Rebuild the deliverable suite folder and re-zip it.
# Idempotent: safe to run as many times as you like.
# =====================================================================
set -euo pipefail

TC=/home/user/fixed/tutoringconnect
AC=/home/user/fixed/adewaleclassroom
SUITE="/home/user/tutoring connect suite"
ZIP=/home/user/deliverables/tutoring-connect-suite.zip

echo "== 1. mirror generator -> generated site =="
python3 "$TC/tools/mirror.py" "$TC" "$AC"

echo "== 2. strip generator-only files from the client site =="
rm -f "$AC/builder.html" "$AC/assets/js/generator.js" "$AC/assets/js/wizard.js"
mkdir -p "$AC/tools"
cp -f "$TC/tools/keepalive.gs" "$AC/tools/keepalive.gs" 2>/dev/null || true

echo "== 3. re-bake the HMG / GOSA house identity into every client page =="
python3 - <<'PY'
import os, re
AC = '/home/user/fixed/adewaleclassroom'
BRAND = ("<style id=\"tc-brand\">:root{--primary:#0506ae;--primary-dark:#0506ae;"
         "--primary-light:#964eec;--accent:#964eec;"
         "--gradient:linear-gradient(135deg,#0506ae,#964eec);"
         "--gradient-dark:linear-gradient(135deg,#0506ae,#964eec);"
         "--font:'Plus Jakarta Sans',system-ui,sans-serif;"
         "--sc-primary:#0506ae;--sc-accent:#964eec}</style>")
FONT = ('<link href="https://fonts.googleapis.com/css2?'
        'family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">')
n = 0
for f in sorted(os.listdir(AC)):
    if not f.endswith('.html'):
        continue
    p = os.path.join(AC, f)
    s = open(p, encoding='utf-8').read()
    o = s
    s = re.sub(r'<style id="tc-brand">.*?</style>', '', s, flags=re.S)
    s = re.sub(r'<meta name="theme-color" content="#[0-9a-fA-F]{3,6}">',
               '<meta name="theme-color" content="#0506ae">', s)
    if 'Plus+Jakarta+Sans' not in s and '</head>' in s:
        s = s.replace('</head>', FONT + '\n</head>', 1)
    if '</head>' in s:
        s = s.replace('</head>', BRAND + '\n</head>', 1)
    if s != o:
        open(p, 'w', encoding='utf-8').write(s)
        n += 1
print('   re-baked %d client pages' % n)
PY

echo "== 3b. regenerate per-site SEO (sitemap + robots + noindex) =="
# The client studio used to inherit the GENERATOR's sitemap.xml and
# robots.txt verbatim, so it advertised tutoringconnect.vercel.app and
# builder.html to search engines. Each site now derives its own from its
# own config.js.
python3 "$TC/tools/build_seo.py" "$TC"
python3 "$TC/tools/build_seo.py" "$AC"

echo "== 3c. verify BOTH repos before packaging =="
# Added V25. The suite used to be zipped without anything having been run
# against the CLIENT copy, so a mirror that dropped a file would have shipped.
for REPO in "$TC" "$AC"; do
  echo "   -- $(basename "$REPO")"
  node "$TC/tools/test_nav.js"        "$REPO" | tail -1
  node "$TC/tools/test_v25_render.js" "$REPO" | tail -1
done

echo "== 4. rebuild the deliverable suite =="
rm -rf "$SUITE/generator-tutoringconnect" "$SUITE/generated-site-adewaleclassroom" \
       "$SUITE/database" "$SUITE/docs"
mkdir -p "$SUITE"
python3 "$TC/tools/mirror.py" --plain "$TC" "$SUITE/generator-tutoringconnect"
python3 "$TC/tools/mirror.py" --plain "$AC" "$SUITE/generated-site-adewaleclassroom"
cp -r "$TC/database" "$SUITE/database"
cp -r "$TC/docs"     "$SUITE/docs"

echo "== 5. re-zip =="
mkdir -p "$(dirname "$ZIP")"
rm -f "$ZIP"
cd "$(dirname "$SUITE")"
zip -qr "$ZIP" "$(basename "$SUITE")" -x '*/node_modules/*' '*/.git/*'

echo
echo "generator pages : $(ls "$TC"/*.html | wc -l)"
echo "client pages    : $(ls "$AC"/*.html | wc -l)"
echo "zip entries     : $(unzip -l "$ZIP" | tail -1 | awk '{print $2}')"
echo "zip size        : $(du -h "$ZIP" | cut -f1)"
echo "SYNC COMPLETE"
