#!/usr/bin/env bash
#
# Download the whole usage dataset as one CSV.
#
# The endpoint pages at 10,000 rows, so a bare curl of /export.csv silently
# gives you a truncated file that looks complete — the failure mode is a study
# that quietly under-reports. This follows the cursor to the end and stitches
# the pages into one file.
#
#   export SUDTOOLKIT_METRICS_URL='https://sudtoolkit-metrics.you.workers.dev'
#   export SUDTOOLKIT_EXPORT_TOKEN='the token you set with wrangler secret put'
#   ./tools/fetch-metrics.sh events.csv
#
# Both variables can also be passed as arguments 2 and 3 if you would rather not
# export them. Keep the token out of shell history either way — a leading space
# before the command stops most shells recording it.

set -euo pipefail

OUT="${1:-events.csv}"
BASE="${2:-${SUDTOOLKIT_METRICS_URL:-}}"
TOKEN="${3:-${SUDTOOLKIT_EXPORT_TOKEN:-}}"
# Only worth changing to test the paging loop against a small dataset; the
# endpoint caps a page at 50,000 regardless.
PAGE_SIZE="${SUDTOOLKIT_PAGE_SIZE:-10000}"

if [ -z "$BASE" ] || [ -z "$TOKEN" ]; then
    echo "Set SUDTOOLKIT_METRICS_URL and SUDTOOLKIT_EXPORT_TOKEN (see worker/README.md)." >&2
    exit 1
fi

BASE="${BASE%/}"           # tolerate a trailing slash
BASE="${BASE%/export.csv}" # and someone pasting the full export URL

headers=$(mktemp)
body=$(mktemp)
trap 'rm -f "$headers" "$body"' EXIT

after=0
page=0
: > "$OUT"

while :; do
    page=$((page + 1))

    status=$(curl -sS -o "$body" -D "$headers" -w '%{http_code}' \
        -H "Authorization: Bearer $TOKEN" \
        "$BASE/export.csv?after=$after&limit=$PAGE_SIZE")

    if [ "$status" != "200" ]; then
        echo "Export failed on page $page (HTTP $status)." >&2
        [ "$status" = "401" ] && echo "That token was not accepted." >&2
        [ "$status" = "503" ] && echo "EXPORT_TOKEN is not set on the worker." >&2
        exit 1
    fi

    # Header line only on the first page, so the pages concatenate into one
    # file that Excel, R and SPSS all open without a manual tidy-up.
    if [ "$page" = "1" ]; then
        cat "$body" >> "$OUT"
    else
        tail -n +2 "$body" >> "$OUT"
    fi

    read_header() { tr -d '\r' < "$headers" | grep -i "^$1:" | tail -1 | cut -d' ' -f2-; }
    more=$(read_header 'x-more')
    last=$(read_header 'x-last-id')
    count=$(read_header 'x-row-count')

    echo "  page $page: $count rows (through id $last)"

    [ "$more" = "true" ] || break

    # Guard against a cursor that stops advancing, which would otherwise spin
    # forever re-downloading the same page.
    if [ "$last" = "$after" ]; then
        echo "Cursor stopped advancing at id $last — stopping." >&2
        exit 1
    fi
    after="$last"
done

rows=$(($(wc -l < "$OUT") - 1))
echo "Wrote $OUT — $rows rows."
