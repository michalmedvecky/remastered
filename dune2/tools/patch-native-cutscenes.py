#!/usr/bin/env python3
"""Apply binary-verified English V1.07 cutscene tables to an OpenDUNE checkout.

Use --write to modify only src/table/{houseanimation,sound}.c and
src/audio/sound.h. Existing engine voice IDs remain stable. No game is run.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

WEB=Path(__file__).resolve().parents[1]


def initializer(rows):
    if isinstance(rows,list):
        return "{"+", ".join(initializer(r) for r in rows)+"}"
    return json.dumps(rows) if isinstance(rows,str) else str(rows)


def replace_table(source,symbol,rows):
    match=re.search(r"\b"+re.escape(symbol)+r"\s*(?:\[[^\]]*\])*\s*=\s*",source)
    if not match: raise ValueError(f"missing table {symbol}")
    start=match.end()
    # Tokens consume braces inside C strings/comments without counting them.
    token=re.compile(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|[{}]',re.S)
    depth=0
    for m in token.finditer(source,start):
        if m.group()=="{": depth+=1
        elif m.group()=="}":
            depth-=1
            if depth==0:
                text="{\n"+"\n".join("\t"+initializer(r)+"," for r in rows)+"\n}"
                return source[:start]+text+source[m.end():]
    raise ValueError(f"unterminated table {symbol}")


def tables(data):
    assert len(data["sequences"])==10 and len(data["voices"])==132 and len(data["feedback"])==94
    animation=[]; subtitles=[]; sounds=[]
    for seq in data["sequences"]:
        animation.append([[r[k] for k in ("name","duration","frameCount","flags")] for r in seq["animations"][:-1]]+[["",0,0,0]])
        subtitles.append([[r[k] for k in ("stringId","colour","animationId","top","waitFadein","paletteFadein","waitFadeout","paletteFadeout")]for r in seq["subtitles"][:-1]]+[[65535,0,0,0,0,0,0,0]])
        sounds.append([[r[k]for k in ("animationId","logicalVoiceId","wait")]for r in seq["soundEffects"][:-1]]+[[255,255,255]])
    return dict(g_table_houseAnimation_animation=animation,g_table_houseAnimation_subtitle=subtitles,g_table_houseAnimation_soundEffect=sounds,
        g_table_voices=data["compatibility"]["compatibleVoices"],
        g_feedback=[[r["openDuneVoiceIds"],r["messageId"],r["soundId"]]for r in data["feedback"]],
        g_table_voiceMapping=data["logicalVoiceMapping"]["openDuneVoiceIds"])


def prepare(root,data):
    changes={}
    all_tables=tables(data)
    for rel,names in (("src/table/houseanimation.c",list(all_tables)[:3]),("src/table/sound.c",list(all_tables)[3:])):
        path=root/rel
        before=path.read_text()
        after=before
        for name in names: after=replace_table(after,name,all_tables[name])
        changes[rel]=(before,after)
    rel="src/audio/sound.h"
    before=(root/rel).read_text()
    after,n=re.subn(r"(#define NUM_VOICES\s+)\d+",r"\g<1>132",before)
    assert n==1
    changes[rel]=(before,after)
    return changes


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("root",type=Path)
    p.add_argument("--tables",type=Path,default=WEB/"fidelity/cutscenes/native-tables.json")
    p.add_argument("--write",action="store_true")
    p.add_argument("--report",type=Path)
    args=p.parse_args()
    data=json.loads(args.tables.read_text())
    assert data["source"]["sha256"]=="85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f"
    changes=prepare(args.root,data)
    report=dict(sourceExeSha256=data["source"]["sha256"],nativeTablesSha256=hashlib.sha256(args.tables.read_bytes()).hexdigest(),
        mode="write" if args.write else "preview",files=[])
    for rel,(before,after)in changes.items():
        report["files"].append(dict(path=rel,changed=before!=after,beforeSha256=hashlib.sha256(before.encode()).hexdigest(),afterSha256=hashlib.sha256(after.encode()).hexdigest()))
        if args.write and before!=after: (args.root/rel).write_text(after)
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))


if __name__=="__main__": main()
