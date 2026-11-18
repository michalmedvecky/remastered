#!/usr/bin/env python3
"""Audit every original VOC block without running the game."""
from pathlib import Path
import collections
import hashlib
import json
import struct
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from preload_data import read_pak

WEB=Path(__file__).resolve().parents[1]
AUDIT=WEB/"fidelity/cutscenes/voc-audit.json"


def records():
    # The retained inventory chooses the same 223 unique resources as the
    # original audit. Bodies come from the actual hash-bound browser preload.
    seen=set()
    for row in json.loads(AUDIT.read_text())["files"]:
        assert row["name"] not in seen
        seen.add(row["name"])
        member=read_pak(row["archive"])[row["name"].upper()]
        assert member["sha256"]==row["sourceSha256"]
        yield row["archive"],member,member["bytes"]


def decode(raw):
    assert raw.startswith(b"Creative Voice File\x1a")
    pos=struct.unpack_from("<H",raw,20)[0]
    out=bytearray();rate=0;blocks=[]
    while pos<len(raw):
        offset=pos;kind=raw[pos];pos+=1
        if kind==0:break
        size=int.from_bytes(raw[pos:pos+3],"little");pos+=3
        body=raw[pos:pos+size];pos+=size
        assert len(body)==size
        if kind==1:
            assert size>=2 and body[1]==0
            newrate=1000000//(256-body[0])
            rate=rate or newrate
            assert rate==newrate
            count=size-2
            out.extend(body[2:])
            duration=count*(256-body[0])/1000000
        elif kind==3:
            assert size==3
            count=struct.unpack_from("<H",body)[0]+1
            duration=count*(256-body[2])/1000000
            rate=rate or 1000000//(256-body[2])
            converted=(count*(256-body[2])*rate+500000)//1000000
            out.extend(b"\x80"*converted)
        else:raise ValueError(f"unsupported VOC block {kind}")
        blocks.append(dict(type=kind,fileOffset=offset,size=size,nativeSamples=count,timeConstant=body[0]if kind==1 else body[2],durationSeconds=duration))
    return rate,bytes(out),blocks


def main():
    result=dict(sourceExecution="none; static reads",files=[],blockCounts=collections.Counter(),schemes=collections.Counter())
    for pak,member,raw in records():
        rate,pcm,blocks=decode(raw)
        scheme=",".join(str(b["type"])for b in blocks)
        result["schemes"][scheme]+=1
        result["blockCounts"].update(b["type"]for b in blocks)
        result["files"].append(dict(name=member["name"],archive=pak,sourceSha256=member["sha256"],blocks=blocks,
            decodedRate=rate,decodedSamples=len(pcm),decodedSha256=hashlib.sha256(pcm).hexdigest(),
            hardwareDurationSeconds=sum(b["durationSeconds"]for b in blocks),
            ignoredByStockSDLDSPSeconds=sum(b["durationSeconds"]for b in blocks if b["type"]==3)))
    path=WEB/"fidelity/cutscenes/voc-audit.json"
    path.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(dict(output=str(path),files=len(result["files"]),blockCounts=result["blockCounts"],schemes=result["schemes"],
        affected=[dict(name=r["name"],silence=r["ignoredByStockSDLDSPSeconds"])for r in result["files"]if r["ignoredByStockSDLDSPSeconds"]]),indent=2))


if __name__=="__main__":main()
