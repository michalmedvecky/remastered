#!/usr/bin/env python3
"""Mark changed upstream source files with the browser port's modification date.

The retained pristine hash baseline makes this independent of an external git
checkout. Unchanged upstream files remain byte-identical. Newly written files
keep their own notices. Run after compatibility patchers and before compiling.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATE="2026-11-18"
NOTICE=re.compile(rb"\A/\* Dune II browser port modifications: \d{4}-\d{2}-\d{2}\.\n \* Changed for browser integration and/or V1\.07 compatibility;\n \* original copyright and license notices are retained below\.\n \*/\n")


def stamp(source,pristine_hash,date=DATE):
    bare=NOTICE.sub(b"",source,count=1)
    modified=hashlib.sha256(bare).hexdigest()!=pristine_hash
    if not modified:return bare,False
    notice=(f"/* Dune II browser port modifications: {date}.\n"
            " * Changed for browser integration and/or V1.07 compatibility;\n"
            " * original copyright and license notices are retained below.\n"
            " */\n").encode("ascii")
    return notice+bare,True


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root",type=Path,default=ROOT)
    p.add_argument("--baseline",type=Path,default=ROOT/"native/upstream-source-hashes.json")
    p.add_argument("--date",default=DATE)
    p.add_argument("--write",action="store_true")
    p.add_argument("--report",type=Path)
    args=p.parse_args()
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}",args.date)
    baseline=json.loads(args.baseline.read_text())
    report=dict(schema=1,date=args.date,checked=0,modifiedUpstream=[],noticesChanged=[],missing=[])
    for group in baseline["groups"]:
        for rel,digest in group["files"].items():
            path=args.root/group["root"]/rel
            display=str(path.relative_to(args.root))
            if not path.is_file():
                report["missing"].append(display)
                continue
            before=path.read_bytes();after,changed=stamp(before,digest,args.date)
            report["checked"]+=1
            if changed:report["modifiedUpstream"].append(display)
            if before!=after:
                report["noticesChanged"].append(display)
                if args.write:path.write_bytes(after)
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))


if __name__=="__main__":main()
