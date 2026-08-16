#!/usr/bin/env python3
"""Report every outstanding TODO(clinical) / TODO(review) marker.

The revision spec forbids inventing clinical content. Where a number, a
threshold or a choice of protocol is genuinely the clinical owner's to make,
the source carries a marker instead of a guess:

    TODO(clinical): <question>   -- needs Dr Koessler's clinical decision
    TODO(review):   <item>       -- needs external clinical review sign-off

Markers are authored as HTML/JS comments so they never render to a clinician,
which is exactly why they need a tool to surface them: an invisible marker that
nobody lists is the same as no marker at all.

Usage:
    python3 tools/check-todos.py            # list markers, always exit 0
    python3 tools/check-todos.py --strict   # exit 1 if any TODO(clinical) exists
    python3 tools/check-todos.py --json     # machine-readable

--strict is what a production build should run: TODO(clinical) means a
clinician has not yet signed off on that content, so it must not ship silently.
TODO(review) never fails the build on its own — external review is expected to
lag authorship — but it is always reported.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Searched in full; anything else is either generated, binary, or not shipped.
SCANNED_SUFFIXES = {".html", ".js", ".css", ".md", ".json"}
SKIPPED_DIRS = {".git", "node_modules", "icons", ".vscode"}
# This file defines the markers; IMPLEMENTATION_NOTES.md documents the
# convention in prose. Neither is an outstanding decision.
SKIPPED_FILES = {"tools/check-todos.py", "IMPLEMENTATION_NOTES.md"}

MARKER = re.compile(r"TODO\((clinical|review)\):\s*(.*?)\s*(?:-->|\*/)?\s*$")


def iter_files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SCANNED_SUFFIXES:
            continue
        rel = path.relative_to(ROOT)
        if set(rel.parts) & SKIPPED_DIRS or str(rel) in SKIPPED_FILES:
            continue
        yield rel, path


def collect():
    found = []
    for rel, path in iter_files():
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for number, line in enumerate(lines, start=1):
            match = MARKER.search(line)
            if match:
                found.append({
                    "file": str(rel),
                    "line": number,
                    "kind": match.group(1),
                    "text": match.group(2),
                })
    return found


def main() -> int:
    strict = "--strict" in sys.argv
    found = collect()

    if "--json" in sys.argv:
        print(json.dumps(found, indent=2))
    else:
        clinical = [f for f in found if f["kind"] == "clinical"]
        review = [f for f in found if f["kind"] == "review"]
        for label, group in (("clinical decisions", clinical), ("external review", review)):
            if not group:
                continue
            print(f"\n{len(group)} outstanding {label}:")
            for item in group:
                print(f"  {item['file']}:{item['line']}  {item['text']}")
        if not found:
            print("no outstanding TODO(clinical) or TODO(review) markers")

    blocking = [f for f in found if f["kind"] == "clinical"]
    if strict and blocking:
        print(
            f"\nerror: {len(blocking)} TODO(clinical) marker(s) outstanding — "
            "a production build must not ship unresolved clinical decisions",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
