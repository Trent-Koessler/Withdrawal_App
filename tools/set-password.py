#!/usr/bin/env python3
"""Set the shared access password in data/access-config.js.

The password itself is never stored in the repo — only a SHA-256 of its
normalised form. This script is the only place the plaintext is handled.

    python3 tools/set-password.py 'WNSWLHD'
    python3 tools/set-password.py 'WNSWLHD' --write

Without --write it prints what it would do and changes nothing.

Be clear-eyed about what the hash achieves. A shared word falls to a dictionary
attack immediately, and this one will be written on a ward whiteboard within a
week. Hashing keeps the password out of a bundle anyone can read and makes entry
a deliberate act; it is not protecting anything. Nothing in this app is patient
data. See IMPLEMENTATION_NOTES.md.
"""

import argparse
import hashlib
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "data" / "access-config.js"


def normalise(password):
    """Fold a typed password to its canonical form.

    Case, spaces and punctuation are all forgiven, so `wnsw lhd` and `WNSWLHD`
    are the same password. data/access-config.js applies exactly this rule
    before hashing what the clinician typed.
    """
    return re.sub(r"[^A-Z0-9]", "", password.upper())


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("password", help="the shared password to set")
    parser.add_argument("--write", action="store_true",
                        help="update data/access-config.js (otherwise dry run)")
    args = parser.parse_args()

    normalised = normalise(args.password)
    if len(normalised) < 4:
        sys.exit("Password must have at least 4 letters or digits once spaces "
                 "and punctuation are removed.")

    digest = hashlib.sha256(normalised.encode("utf-8")).hexdigest()

    source = CONFIG.read_text(encoding="utf-8")
    pattern = re.compile(r"(export const PASSWORD_HASH = ')[0-9a-f]{64}(';)")
    if not pattern.search(source):
        sys.exit(f"Could not find PASSWORD_HASH in {CONFIG.relative_to(REPO)}.")

    print(f"\n  Password:   {args.password}")
    print(f"  Normalised: {normalised}    (this is what clinicians effectively type)")
    print(f"  SHA-256:    {digest}\n")

    if args.write:
        CONFIG.write_text(pattern.sub(rf"\g<1>{digest}\g<2>", source), encoding="utf-8")
        print(f"  Wrote {CONFIG.relative_to(REPO)}.")
        print("  Commit that file. Everyone must be told the new password —")
        print("  devices already set up are not re-prompted until they clear site data.\n")
    else:
        print(f"  Dry run — {CONFIG.relative_to(REPO)} not written. Re-run with --write.\n")


if __name__ == "__main__":
    main()
