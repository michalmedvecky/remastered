#!/usr/bin/env python3
"""Extract only the 21 known ADL banks from an owner's SOUND.PAK, without execution."""
from pathlib import Path
import argparse,hashlib,json,struct
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser(description=__doc__);p.add_argument('sound_pak',type=Path);a=p.parse_args()
data=a.sound_pak.read_bytes();entries=[];cursor=0
while True:
 if cursor+4>len(data):raise ValueError('Truncated PAK directory')
 offset=struct.unpack_from('<I',data,cursor)[0];cursor+=4
 if offset==0:break
 end=data.find(b'\0',cursor)
 if end<0 or end-cursor>255:raise ValueError('Invalid PAK name')
 name=data[cursor:end].decode('ascii');cursor=end+1
 entries.append((name,offset))
records=json.loads((HERE/'banks.json').read_text());found={}
for i,(name,offset) in enumerate(entries):
 end=entries[i+1][1] if i+1<len(entries) else len(data)
 if offset<cursor or end<offset or end>len(data):raise ValueError('Invalid PAK extent')
 found[name.upper()]=data[offset:end]
verified=[]
for record in records:
 name=record['name']
 if name not in {f'DUNE{i}.ADL' for i in range(21)}:raise ValueError('Invalid expected bank name')
 payload=found.get(name)
 if payload is None or hashlib.sha256(payload).hexdigest()!=record['sha256']:raise ValueError('Bank hash mismatch: '+name)
 verified.append((name,payload))
out=HERE.parents[1]/'dist/music/banks';out.mkdir(parents=True,exist_ok=True)
for name,payload in verified:(out/name).write_bytes(payload)
print(json.dumps({'verifiedBanks':len(verified),'originalChanged':False}))
