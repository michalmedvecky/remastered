#!/usr/bin/env python3
"""Extract the complete hash-verified English text corpus without game execution."""
import base64, collections, hashlib, json, re, struct, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from preload_data import verify_preload,read_pak

COUPLES=(b' etainosrlhcdupm'+b'tasio wb'+b' rnsdalm'+b'h ieoras'+b'nrtlc sy'+b'nstcloer'+b' dtgesio'+b'nr ufmsw'+b' tep.ica'+b'e oiadur'+b' laeiyod'+b'eia otru'+b'etoakhlr'+b' eiu,.oa'+b'nsrctlai'+b'leoiratp'+b'eaoip bm')
TABLES={'DUNE.ENG':(False,0,340),'MESSAGE.ENG':(False,340,28),'INTRO.ENG':(False,368,37),'TEXTH.ENG':(True,405,40),'TEXTA.ENG':(True,445,40),'TEXTO.ENG':(True,485,40),'PROTECT.ENG':(True,525,None)}
sha=lambda b:hashlib.sha256(b).hexdigest()
u16=lambda b,p=0:struct.unpack_from('<H',b,p)[0]
u32be=lambda b,p=0:struct.unpack_from('>I',b,p)[0]

def decompress(body):
 out=bytearray();p=0
 while p<len(body) and body[p]:
  c=body[p];p+=1
  if c&128:
   c&=127;out.append(COUPLES[c>>3]);c=COUPLES[c+16]
  elif c==27:
   if p>=len(body) or not body[p]:raise ValueError('Invalid escaped byte')
   c=(127+body[p])&255;p+=1
  out.append(c)
 return bytes(out)

def text(body):return body.decode('cp437')
def controls(value):return [{'offset':i,'byte':ord(c)}for i,c in enumerate(value)if ord(c)<32]
def runtime_binding(name,index):
 # String_Load skips empty inputs once its string buffer has data. This source
 # version also synthesizes runtime339 as an alias of92, then fills940 without
 # consuming another source entry. Source ordinals must not be mistaken for IDs.
 if name=='DUNE.ENG':return index if index<339 else None
 if name=='MESSAGE.ENG':return 339+index if 1<=index<=28 else None
 if name=='INTRO.ENG':return 367+index if 1<=index<=37 else None
 if name=='PROTECT.ENG':return 525+index if index<415 else None
 return TABLES[name][1]+index
def row_record(identifier,resource,kind,index,value,**metadata):
 return dict(id=identifier,resource=resource,kind=kind,index=index,text=value,controls=controls(value),printf=re.findall(r'%(?:[-+ #0]*\d*(?:\.\d+)?[hlL]?[diuoxXfFeEgGaAcsp%])',value),metadata=metadata)

def extract():
 preload=verify_preload();members=read_pak('ENGLISH.PAK');records=[];resources=[]
 symbols={}
 header=(ROOT/'native/opendune/src/table/strings.h').read_text()
 for symbol,number in re.findall(r'\b(STR_\w+)\s*=\s*(\d+)',header):symbols[int(number)]=symbol
 for name,(compressed,start,loaded)in TABLES.items():
  body=members[name]['bytes'];count=u16(body)//2;loaded=count if loaded is None else loaded;hist=collections.Counter()
  for i in range(count):
   offset=u16(body,i*2);end=body.find(b'\0',offset)
   if end<0:raise ValueError((name,i,'unterminated'))
   raw=body[offset:end];decoded=decompress(raw)if compressed else raw;hist.update(c for c in decoded if c>=128)
   binding=runtime_binding(name,i)
   item=row_record(f'{name}:{i:03}',name,'string-table',i,text(decoded),offset=offset,sourceLength=len(raw),decodedLength=len(decoded),compressed=compressed,runtimeLoaded=binding is not None)
   if binding is not None:item['nativeStringId']=binding;item['nativeSymbol']=symbols.get(binding)
   records.append(item)
  resources.append(dict(name=name,kind='string-table',count=count,runtimeLoaded=sum(runtime_binding(name,i)is not None for i in range(count)),runtimeSlots=loaded,compressed=compressed,bytes=len(body),sha256=sha(body),decodedHighBytes=dict(hist)))
 for name in ['MENTATA.ENG','MENTATH.ENG','MENTATO.ENG']:
  body=members[name]['bytes'];chunks={};p=12
  if body[:4]!=b'FORM'or body[8:12]!=b'MENT'or u32be(body,4)!=len(body)-8:raise ValueError(name)
  while p<len(body):
   tag=body[p:p+4].decode('ascii');length=u32be(body,p+4);chunks[tag]=dict(offset=p+8,length=length,body=body[p+8:p+8+length]);p+=8+length+(length&1)
  names=chunks['NAME']['body'];p=0;subjects=[]
  while p<len(names):
   length=names[p];raw=names[p:p+length]
   if length<9 or len(raw)!=length or raw[-2]!=0:raise ValueError((name,p,'invalid subject'))
   offset=u32be(raw,1);end=body.find(b'\0',offset);source=body[offset:end];decoded=decompress(source);i=len(subjects);no_desc=raw[5]==48
   title=text(raw[7:-2]);item=row_record(f'{name}:subject:{i:03}',name,'help-subject',i,title,sourceRecordOffset=chunks['NAME']['offset']+p,sourceRecordLength=length,bodyOffset=offset,flagsHex=raw[5:7].hex(),noDescription=no_desc,campaignGate=raw[-1])
   records.append(item)
   decoded_text=text(decoded);marker=next((j for j,c in enumerate(decoded_text)if c in '*?'),None)
   if marker is None:raise ValueError((name,i,'missing WSA control marker'))
   prefix=decoded_text[:marker+1];remainder=decoded_text[marker+1:]
   # No-description entries are native scenario-string selectors. Their bytes
   # are control data, not user-visible narrative, and must remain unchanged.
   kind='help-selector'if no_desc else'help-body'
   records.append(row_record(f'{name}:body:{i:03}',name,kind,i,remainder if not no_desc else decoded_text,bodyOffset=offset,sourceLength=len(source),decodedLength=len(decoded),prefix=prefix if not no_desc else'',loopAnimation=decoded_text[marker]=='*',translate=not no_desc))
   subjects.append(dict(index=i,title=title,offset=offset,noDescription=no_desc,campaignGate=raw[-1],flagsHex=raw[5:7].hex()));p+=length
  resources.append(dict(name=name,kind='mentat-form',count=len(subjects),bytes=len(body),sha256=sha(body),chunks={k:{a:b for a,b in v.items()if a!='body'}for k,v in chunks.items()},infoHex=chunks['INFO']['body'].hex(),subjects=subjects))
 body=members['CREDITS.ENG']['bytes'];lines=body.rstrip(b'\0').split(b'\r')
 for i,line in enumerate(lines):
  p=0
  while p<len(line)and line[p]in(1,2):p+=1
  records.append(row_record(f'CREDITS.ENG:line:{i:03}','CREDITS.ENG','credits-line',i,text(line[p:]),prefixHex=line[:p].hex()))
 resources.append(dict(name='CREDITS.ENG',kind='credits-control-stream',count=len(lines),bytes=len(body),sha256=sha(body),rawBase64=base64.b64encode(body).decode()))
 covered=set(TABLES)|{'MENTATA.ENG','MENTATH.ENG','MENTATO.ENG','CREDITS.ENG'}
 for name,r in members.items():
  if name.endswith('.ENG')and name not in covered:resources.append(dict(name=name,kind='localized-bitmap-resource',bytes=r['size'],sha256=r['sha256']))
 result=dict(schema=1,locale='en',source=dict(packageSHA256=preload['packageSha256'],pak='ENGLISH.PAK',pakSHA256=next(f['sha256']for f in preload['files']if f['name']=='ENGLISH.PAK'),encoding='CP437 after native digraph/ESC expansion; source ASCII is retained verbatim',originalDosExecuted=False),runtimeSlots=941,runtimeSourceRows=939,runtimeAliases=[dict(nativeStringId=339,aliasOfNativeStringId=92,symbol='STR_LOAD_GAME')],runtimeFillSlots=[dict(nativeStringId=940,status='Native trailing unused fill slot; no source string copied here')],resources=resources,records=records)
 out=ROOT/'art/localization';out.mkdir(parents=True,exist_ok=True);(out/'en.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 stats=[]
 for resource in resources:
  selected=[r for r in records if r['resource']==resource['name']];translated=[r for r in selected if r['kind']!='help-selector']
  stats.append(dict(name=resource['name'],kind=resource['kind'],records=len(selected),nonempty=sum(bool(r['text'].strip())for r in translated),words=sum(len(re.findall(r"[\w'-]+",r['text']))for r in translated),characters=sum(len(r['text'])for r in translated),**{k:resource[k]for k in ['sha256','bytes','count','runtimeLoaded','decodedHighBytes']if k in resource}))
 inventory=dict(schema=1,source=result['source'],records=len(records),resources=stats,uniqueTranslatableTexts=len(set(r['text']for r in records if r['kind']!='help-selector')),totalWords=sum(r['words']for r in stats),totalCharacters=sum(r['characters']for r in stats))
 (out/'inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n');print(json.dumps(inventory,ensure_ascii=False,indent=2))

if __name__=='__main__':extract()
