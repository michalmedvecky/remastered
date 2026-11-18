#!/usr/bin/env python3
"""Skip the absent initial compression stream in continuation WSA files."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

MARKER = "/* Continuations have no initial Format80 stream to decode. */"
OLD = "\t\tFormat80_Decode(buffer, b, header->bufferLength);"
NEW = "\t\t/* Continuations have no initial Format80 stream to decode. */\n\t\tif (lengthFirstFrame != 0) Format80_Decode(buffer, b, header->bufferLength);"


def patch(source):
    if MARKER in source:
        assert NEW in source, "marked WSA patch differs"
        return source
    assert source.count(OLD) == 1, "WSA first-frame decoder call changed"
    return source.replace(OLD, NEW, 1)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("root", type=Path)
    p.add_argument("--write", action="store_true")
    p.add_argument("--report", type=Path)
    args = p.parse_args()
    path = args.root / "src/wsa.c"
    before = path.read_text()
    after = patch(before)
    report = dict(path=str(path), mode="write" if args.write else "preview",
                  changed=before != after,
                  beforeSha256=hashlib.sha256(before.encode()).hexdigest(),
                  afterSha256=hashlib.sha256(after.encode()).hexdigest(),
                  reason="ASan observed stale-buffer Format80 decode for INTRO7b/OFINALB, which have zero initial-stream length")
    if args.write and before != after:
        path.write_text(after)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
