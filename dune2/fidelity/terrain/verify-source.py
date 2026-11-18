"""Bind reused Ghidra evidence to immutable EXE bytes without executing target code."""
from pathlib import Path
import csv, hashlib, json, struct

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
ANALYSIS=ROOT.parent/'analysis/dune-2'
ADDRESSES=['0x75f00','0x76799','0x768b6','0x39b86','0x1d65a','0x1d556','0x1d53f',
           '0x1d7db','0x1d7ee','0x1d805','0x1d819','0x74e80','0x7a99c','0x79ba0','0x79f4a','0x7a086']
sha=lambda b:hashlib.sha256(b).hexdigest()

def main():
    raw=(ANALYSIS/'inputs/DUNE2.EXE').read_bytes()
    assert sha(raw)=='85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f'
    header=next(h for h in json.loads((ANALYSIS/'evidence/mz.json').read_text()) if h['name']=='DUNE2.EXE')
    module=bytearray(raw[header['header_bytes']:header['load_end']])
    reloc_table=struct.unpack_from('<H',raw,0x18)[0]
    for n in range(header['relocation_count']):
        off,seg=struct.unpack_from('<HH',raw,reloc_table+4*n);at=seg*16+off
        word=struct.unpack_from('<H',module,at)[0]
        struct.pack_into('<H',module,at,(word+header['image_load_segment'])&65535)
    loaded=[(0x10000,module)]
    for ov in json.loads((ANALYSIS/'evidence/fbov.json').read_text())['overlays']:
        data=bytearray(raw[ov['source_file_offset']:ov['source_file_offset']+ov['code_bytes']])
        assert sha(data)==ov['raw_sha256']
        for fix in ov['fixups']:struct.pack_into('<H',data,fix['offset'],fix['analysis_segment'])
        assert sha(data)==ov['relocated_sha256']
        if data:loaded.append((ov['analysis_segment']*16,data))
        for entry in ov['entries']:
            at=entry['stub_linear']-0x10000;target=entry['target_linear']
            module[at:at+5]=bytes([0xea])+struct.pack('<HH',target-ov['analysis_segment']*16,ov['analysis_segment'])
    def memory(address,size):
        for base,data in loaded:
            if base<=address and address+size<=base+len(data):return bytes(data[address-base:address-base+size])
        raise AssertionError(hex(address))
    rows=list(csv.DictReader((ANALYSIS/'FUNCTIONS.tsv').open(),delimiter='\t'))
    results=[];instructions={}
    for address in ADDRESSES:
        row=next(r for r in rows if r['image']=='DUNE2.EXE' and r['address']==address)
        asm=ANALYSIS/row['assembly'];pseudo=ANALYSIS/row['pseudocode'];count=0;bytecount=0
        for line in asm.read_text().splitlines():
            at,seg,hexbytes,description=line.split('\t',3)
            expected=bytes.fromhex(hexbytes)
            assert memory(int(at,16),len(expected))==expected,(address,at)
            instructions[at]={'bytes':hexbytes,'disassembly':description};count+=1;bytecount+=len(expected)
        results.append({'address':address,'ranges':row['ranges'],'assembly':row['assembly'],
            'assemblySha256':sha(asm.read_bytes()),'pseudocode':row['pseudocode'],
            'pseudocodeSha256':sha(pseudo.read_bytes()),'instructionsVerified':count,'instructionBytesVerified':bytecount,
            'reaEvidence':row['evidence'],'allAssemblyBytesMatchRelocatedOriginal':True})
    keys={'0x1d6ba':'f7ee','0x1d6be':'d3f8','0x1d6d2':'f7d8','0x1d6d4':'f7ee','0x1d6d8':'d3f8',
          '0x7a0c8':'9a1b034c1d','0x7a0d4':'9a2e034c1d','0x7a0e3':'837ef640','0x7a0ef':'837ef440'}
    for at,expected in keys.items():assert instructions[at]['bytes']==expected
    output={'target':'inputs/DUNE2.EXE','targetSha256':sha(raw),'provider':'Ghidra saved exports via REA',
        'verification':'MZ relocations and FBOV fixups reconstructed; every instruction byte in listed functions compared',
        'functions':results,'keyInstructions':{at:instructions[at] for at in keys},
        'executedDosBinary':False,'nativeRuntimeComparison':False,
        'limitations':['Static byte verification does not validate every inferred algorithm semantic.',
            'Original DOS memory adjacent to the map was not observed; cleared-neighbor model remains explicit.',
            'Ghidra assembly text has segment-register operand display errors in some MOV instructions; instruction bytes are authoritative.']}
    (HERE/'source-verification.json').write_text(json.dumps(output,indent=2)+'\n')
    print(f'Verified {len(results)} functions, {sum(r["instructionsVerified"] for r in results)} instructions against original file bytes.')

if __name__=='__main__':main()
