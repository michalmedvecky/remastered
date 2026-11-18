#!/usr/bin/env python3
"""Recover V1.07 cutscene/speech tables from the preserved EXE, without execution.

Addresses were recovered from the saved Ghidra assembly of 781d0, 747a0,
74860 and 74950. Never infer executable code from these data records.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
WORK = WEB.parent
EXPECTED_SHA = "85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f"
HEADER = 0x4C00
DS_FILE = 0x37B00
# ID, name, native animation/subtitle/sound/unused-argument file positions.
LAYOUT = [
    (0, "intro", 0x2F050, 0x2F110, 0x2F1F0, 0x2F2F0),
    (1, "level4-harkonnen", *[DS_FILE+x for x in (0x1832,0x185A,0x18A0,0x18A3)]),
    (2, "level4-atreides", *[DS_FILE+x for x in (0x168A,0x16B2,0x16F8,0x16FB)]),
    (3, "level4-ordos", *[DS_FILE+x for x in (0x175E,0x1786,0x17CC,0x17CF)]),
    (4, "level8-harkonnen", *[DS_FILE+x for x in (0x18A5,0x18C5,0x190B,0x190E)]),
    (5, "level8-atreides", *[DS_FILE+x for x in (0x16FD,0x171D,0x1759,0x175C)]),
    (6, "level8-ordos", *[DS_FILE+x for x in (0x17D1,0x17F1,0x182D,0x1830)]),
    (7, "finale-harkonnen", *[DS_FILE+x for x in (0x14A1,0x1501,0x1551,0x1569)]),
    (8, "finale-atreides", *[DS_FILE+x for x in (0x1418,0x1460,0x149C,0x149F)]),
    (9, "finale-ordos", *[DS_FILE+x for x in (0x156B,0x15DB,0x1621,0x162A)]),
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def cstring(data, offset):
    assert 0 <= offset < len(data), f"bad string address {offset:x}"
    end = data.index(0, offset, offset+64)
    return data[offset:end].decode("ascii")


def evidence(data, offset, size):
    return dict(fileOffset=f"0x{offset:x}", analysisLinear=f"0x{offset-HEADER+0x10000:x}",
                size=size, rawHex=data[offset:offset+size].hex())


def parse_initializer(source, symbol, enums=None):
    """Small parser for constant table data, deliberately not a C interpreter."""
    clean = re.sub(r"/\*.*?\*/|//[^\n]*", "", source, flags=re.S)
    start = re.search(r"\b"+re.escape(symbol)+r"\s*(?:\[[^\]]*\])*\s*=\s*", clean)
    if not start:
        raise ValueError(f"missing table {symbol}")
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|0x[0-9A-Fa-f]+|\d+|[A-Za-z_]\w*|[{},]', clean[start.end():])
    i = 0

    def value():
        nonlocal i
        t = tokens[i]
        i += 1
        if t == "{":
            out = []
            while tokens[i] != "}":
                if tokens[i] == ",":
                    i += 1
                else:
                    out.append(value())
            i += 1
            return out
        if t.startswith('"'):
            return json.loads(t)
        if re.fullmatch(r"0x[\da-fA-F]+|\d+", t):
            return int(t, 0)
        if enums and t in enums:
            return enums[t]
        raise ValueError(f"unsupported initializer token {t}")
    return value()


def extract(exe, content=None):
    data = exe.read_bytes()
    assert sha(data) == EXPECTED_SHA, "EXE identity does not match analyzed V1.07"
    assert data[:2] == b"MZ" and struct.unpack_from("<H",data,8)[0]*16 == HEADER
    result = dict(schema=1, source=dict(path=str(exe.resolve()), sha256=sha(data),
        execution="none; static file reads only", headerBytes=HEADER, analysisLoadSegment=0x1000,
        addressRule="file = rawFarSegment*16 + rawFarOffset + 0x4c00"), sequences=[], voices=[], feedback=[])
    for seqid, name, ani, sub, sound, unused in LAYOUT:
        seq = dict(id=seqid, name=name, musicId=27 if seqid==0 else (30+seqid-7 if seqid>=7 else 34),
                   feedbackBase=74 if seqid==0 else 65535,
                   evidenceFunctions=["0x781d0"] if seqid==0 else (["0x747a0"] if seqid>=7 else ["0x74860","0x74950"]),
                   animations=[], subtitles=[], soundEffects=[])
        for i in range(32):
            off=ani+i*8
            ptr, seg, duration, frames, flags = struct.unpack_from("<HHBBH",data,off)
            s = cstring(data, seg*16+ptr+HEADER) if seg or ptr else ""
            row=dict(name=s, duration=duration, frameCount=frames, flags=flags, evidence=evidence(data,off,8))
            seq["animations"].append(row)
            if duration == 0: break
        else: raise ValueError(f"unterminated animations {name}")
        for i in range(32):
            off=sub+i*10
            values = struct.unpack_from("<HH6B",data,off)
            row=dict(zip(["nativeStringId","colour","animationId","top","waitFadein","paletteFadein","waitFadeout","paletteFadeout"],values))
            # INTRO is a separately indexed string file in the DOS executable.
            # Modern OpenDUNE merges it into global indices 368..404.
            row["stringId"]=values[0]+367 if 0<values[0]<=37 else values[0]
            row["evidence"]=evidence(data,off,10)
            seq["subtitles"].append(row)
            if values[0] == 65535: break
        else: raise ValueError(f"unterminated subtitles {name}")
        for i in range(90):
            off=sound+i*3
            a,v,w=struct.unpack_from("<3B",data,off)
            seq["soundEffects"].append(dict(animationId=a, logicalVoiceId=v, wait=w, evidence=evidence(data,off,3)))
            if v==255: break
        else: raise ValueError(f"unterminated sound effects {name}")
        seq["unusedPrepareArgument"]=dict(**evidence(data,unused,16 if seqid==0 else 2),
            status="Caller passes this pointer; recovered prepare body does not consume it. Meaning unresolved.")
        result["sequences"].append(seq)
    audio = content.get("audio",{}) if content else {}
    for i in range(132):
        off=0x382C8+i*6
        ptr,seg,priority=struct.unpack_from("<3H",data,off)
        name=cstring(data,seg*16+ptr+HEADER)
        assert name.endswith(".VOC") and 0<priority<=20
        filename=name.lstrip("+?/-")
        resolved={}
        if "%c" in filename:
            for house,prefix in (("harkonnen","H"),("atreides","A"),("ordos","O")):
                fn=filename.replace("%c",prefix)
                if fn in audio: resolved[house]=dict(name=fn, **audio[fn])
        elif filename in audio:
            resolved["all"]=dict(name=filename,**audio[filename])
        result["voices"].append(dict(nativeId=i,name=name,priority=priority,assets=resolved,evidence=evidence(data,off,6)))
    for i in range(94):
        off=0x37DA4+i*14
        v=struct.unpack_from("<7H",data,off)
        assert all(x==65535 or x<132 for x in v[:5])
        result["feedback"].append(dict(id=i, voiceIds=list(v[:5]),messageId=v[5],soundId=v[6],evidence=evidence(data,off,14)))
    assert sha(exe.read_bytes()) == EXPECTED_SHA
    return result


def canonical(name):
    # Keep load-set prefixes: FILLER and ?FILLER are distinct table entries.
    return name.replace("%c","").upper()


def compare_source(result, root):
    sound=(root/"src/table/sound.c").read_text()
    source_voices=parse_initializer(sound,"g_table_voices")
    byname={canonical(row[0]):i for i,row in enumerate(source_voices)}
    # Keep existing IDs used by the C engine. Add the original extra OK speech.
    compatible=[None]*len(source_voices)
    for native in result["voices"]:
        key=canonical(native["name"])
        if key not in byname:
            byname[key]=len(compatible)
            compatible.append(None)
        target=byname[key]
        native["openDuneId"]=target
        compatible[target]=[native["name"],native["priority"]]
    assert all(x is not None for x in compatible)
    result["compatibility"] = dict(referenceCommit="ebea79aeba025be2fe9004570e9255044aacc0be",
        referenceUrl="https://github.com/OpenDUNE/OpenDUNE", voiceIdPolicy="Preserve source IDs; match canonical filenames; append missing OK.",
        sourceVoices=len(source_voices),compatibleVoices=compatible)
    enums={k:int(v) for k,v in re.findall(r"\b(STR_\w+)\s*=\s*(\d+)",(root/"src/table/strings.h").read_text())}
    house=(root/"src/table/houseanimation.c").read_text()
    arrays={k:parse_initializer(house,k,enums) for k in ("g_table_houseAnimation_animation","g_table_houseAnimation_subtitle","g_table_houseAnimation_soundEffect")}
    comparison=[]
    for seq in result["sequences"]:
        forms={"g_table_houseAnimation_animation":[[r["name"],r["duration"],r["frameCount"],r["flags"]] for r in seq["animations"]],
               "g_table_houseAnimation_subtitle":[[r[k] for k in ("stringId","colour","animationId","top","waitFadein","paletteFadein","waitFadeout","paletteFadeout")] for r in seq["subtitles"]],
               "g_table_houseAnimation_soundEffect":[[r[k] for k in ("animationId","logicalVoiceId","wait")] for r in seq["soundEffects"]]}
        for key,rows in forms.items():
            source_rows=arrays[key][seq["id"]]
            # Sentinel payloads after the terminating field are never consumed.
            body=rows[:-1]
            diffs=[dict(index=i,native=r,reference=source_rows[i] if i<len(source_rows) else None) for i,r in enumerate(body) if i>=len(source_rows) or r!=source_rows[i]]
            comparison.append(dict(sequence=seq["name"],table=key,rows=len(body),differences=diffs))
    result["compatibility"]["comparison"]=comparison
    feedback=parse_initializer(sound,"g_feedback")
    vmap={r["nativeId"]:r["openDuneId"] for r in result["voices"]}
    diffs=[]
    for r in result["feedback"]:
        row=[[vmap.get(v,v) for v in r["voiceIds"]],r["messageId"],r["soundId"]]
        r["openDuneVoiceIds"]=row[0]
        if row!=feedback[r["id"]]: diffs.append(dict(id=r["id"],nativeAdapted=row,reference=feedback[r["id"]]))
    result["compatibility"]["feedbackDifferences"]=diffs
    # Find the complete native logical sound-to-voice mapping by its distinctive
    # source sequence, with indices shifted past the native extra OK row.
    source_mapping=parse_initializer(sound,"g_table_voiceMapping")
    native_byname={canonical(r["name"]):r["nativeId"] for r in result["voices"]}
    mapping=[65535 if x==65535 else native_byname[canonical(source_voices[x][0])] for x in source_mapping]
    packed=struct.pack("<"+"H"*len(mapping),*mapping)
    data=Path(result["source"]["path"]).read_bytes()
    where=data.find(packed)
    assert where>=0 and data.find(packed,where+1)<0, "native logical voice mapping mismatch"
    result["logicalVoiceMapping"]=dict(voiceIds=mapping,openDuneVoiceIds=source_mapping,evidence=evidence(data,where,len(packed)))


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--exe",type=Path,default=WORK/"analysis/dune-2/inputs/DUNE2.EXE")
    p.add_argument("--output",type=Path,default=WEB/"fidelity/cutscenes/native-tables.json")
    p.add_argument("--opendune-root",type=Path)
    args=p.parse_args()
    content=json.loads((WEB/"dist/assets/content.json").read_text())
    result=extract(args.exe,content)
    if args.opendune_root: compare_source(result,args.opendune_root)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(dict(output=str(args.output),sequences=len(result["sequences"]),voices=len(result["voices"]),feedback=len(result["feedback"]),
        tableDifferences=sum(len(x["differences"]) for x in result.get("compatibility",{}).get("comparison",[])),
        feedbackDifferences=len(result.get("compatibility",{}).get("feedbackDifferences",[])))))


if __name__=="__main__": main()
