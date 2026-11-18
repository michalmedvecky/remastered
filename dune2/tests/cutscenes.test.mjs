import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const data=JSON.parse(readFileSync(new URL('../fidelity/cutscenes/native-tables.json',import.meta.url)));
const extract=new URL('../tools/derive-cutscenes.py',import.meta.url).pathname;
const patch=new URL('../tools/patch-native-cutscenes.py',import.meta.url).pathname;

test('native cutscene coverage includes every intro, interlude and finale row',()=>{
  assert.equal(data.sequences.length,10);
  assert.deepEqual(data.sequences.map(s=>s.animations.length-1),[22,4,4,4,3,3,3,11,8,13]);
  assert.equal(data.sequences.reduce((n,s)=>n+s.subtitles.length-1,0),72);
  assert.equal(data.sequences.reduce((n,s)=>n+s.soundEffects.length-1,0),92);
  for(const s of data.sequences){
    assert.equal(s.animations.at(-1).duration,0);
    assert.equal(s.subtitles.at(-1).nativeStringId,65535);
    assert.equal(s.soundEffects.at(-1).logicalVoiceId,255);
    for(const row of [...s.animations,...s.subtitles,...s.soundEffects]){
      assert.equal(row.evidence.rawHex.length,row.evidence.size*2);
    }
  }
  assert.ok(data.compatibility.comparison.every(t=>t.differences.length===0));
});

test('native speech IDs retain filename identity across the inserted OK row',()=>{
  assert.equal(data.voices.length,132);
  assert.equal(data.voices[23].name,'+OK.VOC');
  assert.equal(data.voices[23].openDuneId,131);
  assert.equal(data.voices[24].name,'?POPPA.VOC');
  assert.equal(data.voices[24].openDuneId,23);
  assert.equal(data.voices[88].name,'-DUNE.VOC');
  assert.equal(data.voices[88].openDuneId,87);
  assert.deepEqual(data.compatibility.feedbackDifferences.map(r=>r.id),[75,76,84]);
  assert.deepEqual(data.feedback[84].voiceIds,[99,97,91,96,65535]);
  assert.deepEqual(data.feedback[84].openDuneVoiceIds,[98,96,90,95,65535]);
  assert.equal(data.logicalVoiceMapping.voiceIds.length,120);
  // Logical sound 108 is not raw voice 108; it resolves to native WIND2BP.
  assert.equal(data.voices[data.logicalVoiceMapping.voiceIds[108]].name,'-WIND2BP.VOC');
  for(const row of data.voices.filter(v=>v.nativeId!==23)){
    assert.ok(Object.keys(row.assets).length>0,row.name);
  }
});

test('retained original cutscene bytes and C patching agree and remain idempotent',()=>{
  const script=String.raw`
import importlib.util,json,tempfile,pathlib,struct,hashlib
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
derive=module('derive',${JSON.stringify(extract)})
patch=module('patch',${JSON.stringify(patch)})
data=json.loads(pathlib.Path(${JSON.stringify(new URL('../fidelity/cutscenes/native-tables.json',import.meta.url).pathname)}).read_text())
strings=json.loads(pathlib.Path(${JSON.stringify(new URL('../fidelity/cutscenes/string-fixtures.json',import.meta.url).pathname)}).read_text())
assert strings['sourceOriginalSha256']==data['source']['sha256']
by_offset={int(r['fileOffset'],16):r for r in strings['records']}
for row in strings['records']:
 raw=bytes.fromhex(row['rawHex'])
 assert hashlib.sha256(raw).hexdigest()==row['sha256']
 assert raw.endswith(b'\0') and raw[:-1].decode('ascii')==row['text']
def original_name(row):
 ptr,seg=struct.unpack_from('<HH',bytes.fromhex(row['evidence']['rawHex']))
 return by_offset[seg*16+ptr+data['source']['headerBytes']]['text'] if ptr or seg else ''
for seq in data['sequences']:
 for row in seq['animations']:
  ptr,seg,duration,frames,flags=struct.unpack('<HHBBH',bytes.fromhex(row['evidence']['rawHex']))
  assert [duration,frames,flags]==[row[k] for k in ['duration','frameCount','flags']]
  assert original_name(row)==row['name']
 for row in seq['subtitles']:
  values=struct.unpack('<HH6B',bytes.fromhex(row['evidence']['rawHex']))
  assert list(values)==[row[k] for k in ['nativeStringId','colour','animationId','top','waitFadein','paletteFadein','waitFadeout','paletteFadeout']]
  assert row['stringId']==(row['nativeStringId']+367 if 0<row['nativeStringId']<=37 else row['nativeStringId'])
 for row in seq['soundEffects']:
  assert list(bytes.fromhex(row['evidence']['rawHex']))==[row[k]for k in ['animationId','logicalVoiceId','wait']]
for row in data['voices']:
 assert struct.unpack('<3H',bytes.fromhex(row['evidence']['rawHex']))[2]==row['priority']
 assert original_name(row)==row['name']
for row in data['feedback']:
 assert list(struct.unpack('<7H',bytes.fromhex(row['evidence']['rawHex'])))==row['voiceIds']+[row['messageId'],row['soundId']]
tables=patch.tables(data)
with tempfile.TemporaryDirectory()as folder:
 root=pathlib.Path(folder)
 for rel,names in [('src/table/houseanimation.c',list(tables)[:3]),('src/table/sound.c',list(tables)[3:])]:
  p=root/rel;p.parent.mkdir(parents=True,exist_ok=True)
  p.write_text('\n'.join('const X '+name+'[] = {};\n'for name in names))
 p=root/'src/audio/sound.h';p.parent.mkdir(parents=True);p.write_text('#define NUM_VOICES 131\n')
 changes=patch.prepare(root,data)
 for rel,(_,after)in changes.items():(root/rel).write_text(after)
 for rel,(before,after)in patch.prepare(root,data).items():assert before==after,rel
 for name,expected in tables.items():
  rel='src/table/houseanimation.c'if name.startswith('g_table_houseAnimation')else'src/table/sound.c'
  assert derive.parse_initializer((root/rel).read_text(),name)==expected,name
`;
  const run=spawnSync('python3',['-c',script],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});

test('native C VOC decoder reproduces all 223 independently decoded PCM/silence streams',()=>{
  const dsp=new URL('../tools/patch-native-dsp.py',import.meta.url).pathname;
  const audit=new URL('../tools/audit-native-voc.py',import.meta.url).pathname;
  const script=String.raw`
import importlib.util,tempfile,pathlib,subprocess,ctypes,sys
def module(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
patch=module('patch',${JSON.stringify(dsp)})
audit=module('audit',${JSON.stringify(audit)})
before='void DSP_Play(const uint8 *data) { old_call(); }\nuint8 DSP_GetStatus(void){return 0;}'
after=patch.patch(before)
assert patch.patch(after)==after
source='''#include <stdint.h>
#include <stdbool.h>
#include <string.h>
typedef uint8_t uint8; typedef uint16_t uint16; typedef uint32_t uint32;
#define READ_LE_UINT16(p) ((uint16)((p)[0] | ((uint16)(p)[1] << 8)))
'''+patch.DECODER+'''
int decode(const uint8 *p,uint8 *out,uint32 *rate,uint32 *length){return DSP_DecodeVOC(p,out,rate,length);}
'''
with tempfile.TemporaryDirectory()as folder:
 root=pathlib.Path(folder);(root/'decode.c').write_text(source)
 library=root/('decode.dylib'if sys.platform=='darwin'else'decode.so')
 subprocess.run(['cc','-std=c99','-Wall','-Wextra','-Werror','-dynamiclib'if sys.platform=='darwin'else'-shared','-fPIC',str(root/'decode.c'),'-o',str(library)],check=True)
 lib=ctypes.CDLL(str(library))
 lib.decode.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.POINTER(ctypes.c_uint32),ctypes.POINTER(ctypes.c_uint32)]
 count=0
 for pak,member,raw in audit.records():
  rate,pcm,blocks=audit.decode(raw)
  offset=int.from_bytes(raw[20:22],'little');encoded=ctypes.create_string_buffer(raw[offset:]);r=ctypes.c_uint32();n=ctypes.c_uint32()
  assert lib.decode(encoded,None,ctypes.byref(r),ctypes.byref(n))==1,member['name']
  assert r.value==rate and n.value==len(pcm),member['name']
  out=ctypes.create_string_buffer(n.value)
  assert lib.decode(encoded,out,ctypes.byref(r),ctypes.byref(n))==1
  assert out.raw==pcm,member['name']
  count+=1
 assert count==223
 # Reject compressed PCM and unsupported control blocks explicitly.
 for raw in [bytes([1,2,0,0,171,1,0]),bytes([9,1,0,0,0,0])]:
  b=ctypes.create_string_buffer(raw)
  assert lib.decode(b,None,ctypes.byref(r),ctypes.byref(n))==0
`;
  const run=spawnSync('python3',['-c',script],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});
