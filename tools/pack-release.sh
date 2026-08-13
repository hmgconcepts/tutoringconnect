#!/bin/bash
# Build two independent zips and wrap them in tutoring-connect.zip
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="/tmp/tc-release-$$"
GEN="$STAGE/tutoring-connect-generator"
ADC="$STAGE/adewale-classroom"
rm -rf "$STAGE"
mkdir -p "$GEN" "$ADC"

copy_tree() {
  local src="$1" dest="$2"
  ( cd "$src" && tar --exclude='.git' --exclude='tools/__pycache__' --exclude='*.zip' -cf - . ) | ( cd "$dest" && tar -xf - )
}

copy_tree "$ROOT" "$GEN"
printf '%s\n' \
  "# Tutoring Connect Generator" \
  "" \
  "This package is the GENERATOR (HMG Technologies / HMG Concepts)." \
  "Open index.html then builder.html to stamp a client studio ZIP." \
  "Do not deploy this folder as a parent-facing portal." \
  > "$GEN/PACKAGE.txt"

copy_tree "$ROOT" "$ADC"
cp "$ROOT/site-index.html" "$ADC/index.html"
rm -f "$ADC/builder.html" "$ADC/assets/js/generator.js" "$ADC/site-index.html"
rm -rf "$ADC/tools"
printf '%s\n' \
  "# ADEWALE CLASSROOM" \
  "" \
  "This package is the GENERATED Tutoring Connect studio." \
  "A product of HMG Technologies, a subsidiary of HMG Concepts." \
  "Deploy: run database/complete-schema.sql, paste keys into assets/js/config.js, host statically." \
  "There is no builder in this zip." \
  > "$ADC/PACKAGE.txt"

( cd "$STAGE" && zip -r -q tutoring-connect-generator.zip tutoring-connect-generator )
( cd "$STAGE" && zip -r -q adewale-classroom.zip adewale-classroom )

cat > "$STAGE/README-RELEASE.txt" <<'EOF'
TUTORING CONNECT — RELEASE LAYOUT
=================================
This archive contains TWO independent zip files. They are not mixed.

1. tutoring-connect-generator.zip
   The generator (builder). HMG staff open index.html → builder.html
   and download a branded client ZIP. Includes all templates and SQL.

2. adewale-classroom.zip
   The generated client studio named ADEWALE CLASSROOM.
   Parents and learners use this site. No builder. Deploy as a static
   PWA + one Supabase project.

Product of HMG Technologies, a subsidiary of HMG Concepts
(His Marvellous Grace). Founder: Adewale Samson Adeagbo.
EOF

rm -f /home/user/tutoring-connect.zip
( cd "$STAGE" && zip -r -q /home/user/tutoring-connect.zip \
  tutoring-connect-generator.zip adewale-classroom.zip README-RELEASE.txt )

cp "$STAGE/tutoring-connect-generator.zip" /home/user/tutoring-connect-generator.zip
cp "$STAGE/adewale-classroom.zip" /home/user/adewale-classroom.zip

echo "PARENT $(ls -lh /home/user/tutoring-connect.zip | awk '{print $5}')"
echo "GEN    $(ls -lh /home/user/tutoring-connect-generator.zip | awk '{print $5}')"
echo "ADC    $(ls -lh /home/user/adewale-classroom.zip | awk '{print $5}')"
echo "--- parent listing ---"
unzip -l /home/user/tutoring-connect.zip
echo "--- generator has builder? ---"
unzip -l /home/user/tutoring-connect-generator.zip | grep -E 'builder.html|index.html' | head
echo "--- classroom has builder? (should be empty) ---"
unzip -l /home/user/adewale-classroom.zip | grep -E 'builder.html|generator.js' || echo "(none — correct)"
echo "--- classroom index is client ---"
unzip -p /home/user/adewale-classroom.zip adewale-classroom/index.html | grep -m1 '<title>'
rm -rf "$STAGE"
