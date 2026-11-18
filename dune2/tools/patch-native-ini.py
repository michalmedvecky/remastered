#!/usr/bin/env python3
"""Bound native INI key scans by their section before examining the suffix."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

MARKER = "/* Bound key probes before reading their suffix. */"
OLD = '''				/* Check to see if there is nothing behind the key ('a' should not match 'aa') */
				value = current + keyLength;
				while (isspace((uint8)*value)) value++;

				/* Now validate the size and if we match at all */
				if (*value != '=' || strncasecmp(current, key, keyLength) != 0) {'''
NEW = '''				/* Bound key probes before reading their suffix. */
				bool keyMatches = (size_t)(end - current) >= keyLength &&
					strncasecmp(current, key, keyLength) == 0;
				value = current;
				if (keyMatches) {
					value += keyLength;
					while (value < end && isspace((uint8)*value)) value++;
				}

				/* A short final line must leave missing-key defaults intact. */
				if (!keyMatches || value >= end || *value != '=') {'''


def patch(source):
    if MARKER in source:
        assert NEW in source, "marked INI patch differs"
        return source
    assert source.count(OLD) == 1, "INI key scan changed"
    return source.replace(OLD, NEW, 1)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("root", type=Path)
    p.add_argument("--write", action="store_true")
    p.add_argument("--report", type=Path)
    args = p.parse_args()
    path = args.root / "src/ini.c"
    before = path.read_text()
    after = patch(before)
    report = dict(path=str(path), mode="write" if args.write else "preview",
                  changed=before != after,
                  beforeSha256=hashlib.sha256(before.encode()).hexdigest(),
                  afterSha256=hashlib.sha256(after.encode()).hexdigest(),
                  reason="ASan observed out-of-bounds missing-key probe at short final INI line")
    if args.write and before != after:
        path.write_text(after)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
