#!/usr/bin/env bash
# Regenerate the reviewer-facing Word document from the live site content.
#
# Everything in the document is read out of index.html and data/*.js at build
# time, so re-running this after a content change produces a document that
# matches the site rather than one that has quietly gone stale.
#
#   ./tools/review-doc/build.sh
#
# Produces two documents from the same extraction:
#   docs/website-text-for-clinical-review.docx  numbered statements, tick boxes
#   docs/website-text.docx                      the same text as continuous prose
#
# Requires: node, python3, and the `docx` npm package (npm install docx).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT_REVIEW="${1:-$ROOT/docs/website-text-for-clinical-review.docx}"
OUT_PLAIN="${2:-$ROOT/docs/website-text.docx}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export WORK_DIR="$WORK"

echo "→ extracting static page text from index.html"
python3 "$HERE/extract_html.py" "$ROOT/index.html" "$WORK/html.json"

echo "→ dumping clinical data modules"
(cd "$HERE" && node dump.mjs)     > "$WORK/data.json"
(cd "$HERE" && node severity.mjs) > "$WORK/severity.json"

echo "→ expanding generated content"
(cd "$HERE" && python3 flatten_data.py)

echo "→ recording provenance"
python3 - "$ROOT" "$WORK" <<'PY'
import json, subprocess, sys, datetime
root, work = sys.argv[1], sys.argv[2]
git = lambda *a: subprocess.run(['git','-C',root,*a], capture_output=True, text=True).stdout.strip()
json.dump({
    'version':   json.load(open(f'{root}/package.json'))['version'],
    'commit':    git('rev-parse','--short','HEAD') or 'unknown',
    'date':      git('log','-1','--format=%cd','--date=short') or 'unknown',
    'generated': datetime.date.today().isoformat(),
    'site':      open(f'{root}/CNAME').read().strip(),
}, open(f'{work}/info.json','w'))
PY

echo "→ building $OUT_REVIEW"
(cd "$HERE" && node build_docx.cjs "$OUT_REVIEW")

echo "→ building $OUT_PLAIN"
(cd "$HERE" && node build_plain.cjs "$OUT_PLAIN")
