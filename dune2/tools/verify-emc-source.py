"""Verify focused EMC instruction bytes against the original relocated MZ image."""
import hashlib
import json
import struct
from pathlib import Path

root=Path(__file__).resolve().parents[1]
source=root.parent/'analysis/dune-2/inputs/DUNE2.EXE'
raw=source.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f'
header=struct.unpack_from('<H',raw,8)[0]*16
pages=struct.unpack_from('<H',raw,4)[0]
tail=struct.unpack_from('<H',raw,2)[0]
end=(pages-1)*512+(tail or 512)
loaded=bytearray(raw[header:end])
count=struct.unpack_from('<H',raw,6)[0]
table=struct.unpack_from('<H',raw,0x18)[0]
for index in range(count):
    offset,segment=struct.unpack_from('<HH',raw,table+index*4)
    at=segment*16+offset
    struct.pack_into('<H',loaded,at,(struct.unpack_from('<H',loaded,at)[0]+0x1000)&0xffff)
assembly=root/'docs/emc-evidence/interpreter.asm'
records=[]
for line in assembly.read_text().splitlines():
    if not line.startswith('0x'):
        continue
    address,segmented,encoded,instruction=line.split('\t',3)
    address=int(address,16)
    expected=bytes.fromhex(encoded)
    assert loaded[address-0x10000:address-0x10000+len(expected)]==expected,(address,encoded)
    records.append({'address':hex(address),'source_offset':hex(address-0x10000+header),'bytes':encoded})
result={'source_sha256':hashlib.sha256(raw).hexdigest(),'assembly_sha256':hashlib.sha256(assembly.read_bytes()).hexdigest(),'verified_instructions':len(records),'mismatches':0,'source_range_end_exclusive':['0x18d98','0x193ba'],'provider':'Ghidra12.1.4, read-only saved project with validated CS switch destinations','records':records}
(root/'docs/emc-evidence/source-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'Verified {len(records)} EMC interpreter instruction byte records; no target execution.')
