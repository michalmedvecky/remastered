#!/usr/bin/env python3
"""Build reversible Czech FS overlays from hash-verified native resources."""
import argparse,base64,collections,hashlib,importlib.util,json,struct,sys,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from preload_data import read_pak,verify_preload
_extract_spec=importlib.util.spec_from_file_location('extract_localization',ROOT/'tools/extract-localization.py')
_extract=importlib.util.module_from_spec(_extract_spec);_extract_spec.loader.exec_module(_extract)
COUPLES,TABLES,decompress=_extract.COUPLES,_extract.TABLES,_extract.decompress

sha=lambda b:hashlib.sha256(b).hexdigest()
b64=lambda b:base64.b64encode(b).decode('ascii')
u16=lambda b,p=0:struct.unpack_from('<H',b,p)[0]
u32be=lambda b,p=0:struct.unpack_from('>I',b,p)[0]
PAIRS={bytes([COUPLES[i>>3],COUPLES[i+16]]):128+i for i in range(128)}
CZECH='ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž'

def compress(body):
 out=bytearray();p=0
 while p<len(body):
  c=body[p]
  if not c:raise ValueError('NUL inside translated string')
  if c>=128:out.extend((27,c-127));p+=1
  elif c==27:raise ValueError('Literal ESC is reserved by native codec')
  elif body[p:p+2]in PAIRS:out.append(PAIRS[body[p:p+2]]);p+=2
  else:out.append(c);p+=1
 if decompress(out)!=body:raise ValueError('Native digraph round-trip failed')
 return bytes(out)

def table(rows,compressed):
 pieces=[compress(r)if compressed else r for r in rows];p=len(rows)*2;offsets=[]
 for body in pieces:offsets.append(p);p+=len(body)+1
 if p>=65536:raise ValueError('Native16-bit string-table offsets overflow')
 return struct.pack('<'+'H'*len(rows),*offsets)+b''.join(p+b'\0'for p in pieces)

def read_font(body):
 start,data,widths,end,lines=(u16(body,p)for p in(4,6,8,10,12));count=end-widths;chars={}
 if body[2:4]!=b'\0\5'or not 0<count<256:raise ValueError('Invalid native FNT')
 for c in range(count):
  w,unused,used,offset=body[widths+c],body[lines+c*2],body[lines+c*2+1],u16(body,data+c*2)
  pixels=bytes((body[offset+y*((w+1)//2)+x//2]>>(4*(x&1)))&15 for y in range(used)for x in range(w))if offset else bytes(w*used)
  chars[c]=dict(width=w,unusedLines=unused,usedLines=used,pixels=pixels)
 return dict(height=body[start+4],maxWidth=body[start+5],count=count,chars=chars)

def compose_glyph(font,letter):
 base,mark=unicodedata.normalize('NFD',letter);g=font['chars'][ord(base)];w=g['width'];h=font['height'];old_top=g['unusedLines'];bottom=min(h,old_top+g['usedLines']);top=max(2,old_top);pixels=bytearray(w*h)
 # Keep the original baseline/advance. Uppercase fonts without spare headroom
 # receive a compact native bitmap stem, leaving two rows for the accent.
 target=max(1,bottom-top)
 for y in range(target):
  sy=min(g['usedLines']-1,int(y*g['usedLines']/target))
  pixels[(top+y)*w:(top+y+1)*w]=g['pixels'][sy*w:(sy+1)*w]
 if base in'iI':
  # The acute/caron replaces an existing i dot instead of doubling it.
  for y in range(min(top+2,h)):
   for x in range(w):pixels[y*w+x]=0
 cx=max(1,min(w-3,(w-1)//2));accent_y=max(0,top-2)
 if mark=='\u0301':points=[(cx+1,0),(cx,1)]
 elif mark=='\u030c':points=[(cx-1,0),(cx+1,0),(cx,1)]
 elif mark=='\u030a':points=[(cx,0),(cx-1,1),(cx+1,1),(cx,2)];accent_y=max(0,top-3)
 else:raise ValueError(('Unknown Czech accent',letter))
 for x,y in points:
  if 0<=x<w and 0<=accent_y+y<h:pixels[(accent_y+y)*w+x]=1
 # Compact d/t carons sit above the stem at this very small native resolution.
 ink=[y for y in range(h)if any(pixels[y*w:(y+1)*w])];first=min(ink);last=max(ink)+1
 return dict(width=w,unusedLines=first,usedLines=last-first,pixels=bytes(pixels[first*w:last*w]))

def patch_font(body):
 original=read_font(body);f={**original,'count':254,'chars':dict(original['chars'])}
 empty=dict(width=original['chars'][32]['width'],unusedLines=0,usedLines=0,pixels=b'')
 for c in range(254):f['chars'].setdefault(c,empty)
 # CP1250 Czech slots are explicit. Reusing a CP437 slot by byte number would
 # silently display box drawing or a different accent in the Czech locale.
 for letter in CZECH:f['chars'][letter.encode('cp1250')[0]]=compose_glyph(original,letter)
 for letter,base in {'–':'-','—':'-','„':'"','“':'"','”':'"','‚':"'",'‘':"'",'’':"'",'…':'.','\u00a0':' '}.items():
  c=letter.encode('cp1250')[0]
  if c<254:f['chars'][c]=dict(original['chars'][ord(base)])
 count=f['count'];start=14;data=start+6;widths=data+count*2;end=widths+count;lines=end;bitmap=lines+count*2
 header=bytearray(bitmap);struct.pack_into('<7H',header,0,0,0x500,start,data,widths,end,lines);header[start+4]=f['height'];header[start+5]=f['maxWidth'];payload=bytearray()
 for c in range(count):
  g=f['chars'][c];w=g['width'];header[widths+c]=w;header[lines+c*2:lines+c*2+2]=bytes((g['unusedLines'],g['usedLines']))
  if not g['usedLines']or not any(g['pixels']):continue
  struct.pack_into('<H',header,data+c*2,bitmap+len(payload))
  for y in range(g['usedLines']):
   for x in range(0,w,2):payload.append(g['pixels'][y*w+x]|((g['pixels'][y*w+x+1]if x+1<w else 0)<<4))
 result=header+payload;struct.pack_into('<H',result,0,len(result));decoded=read_font(result)
 for c in range(128):
  if decoded['chars'][c]!=original['chars'][c]:raise ValueError(('ASCII font changed',c))
 return bytes(result),decoded

def font_json(font):return{**{k:v for k,v in font.items()if k!='chars'},'chars':{str(c):{**{k:v for k,v in g.items()if k!='pixels'},'nibblesBase64':b64(g['pixels']),'advanceDefault':g['width']-1}for c,g in font['chars'].items()}}

def mentat(resource,records,translations):
 subjects=sorted((r for r in records if r['resource']==resource and r['kind']=='help-subject'),key=lambda r:r['index']);bodies={r['index']:r for r in records if r['resource']==resource and r['kind']in('help-body','help-selector')}
 names=[];texts=[];max_decoded=0
 for r in subjects:
  title=translations[r['id']].encode('cp1250');m=r['metadata'];length=9+len(title)
  if length>=256:raise ValueError(('Help subject length-byte overflow',r['id']))
  names.append(bytearray([length])+bytes(4)+bytes.fromhex(m['flagsHex'])+title+b'\0'+bytes([m['campaignGate']]))
  source=bodies[r['index']];value=source['text']if source['kind']=='help-selector'else source['metadata']['prefix']+translations[source['id']]
  decoded=value.encode('cp1250');max_decoded=max(max_decoded,len(decoded)+1);texts.append(compress(decoded)+b'\0')
 name_bytes=b''.join(names);desc_start=12+8+len(name_bytes)+(len(name_bytes)&1)+8;p=desc_start
 for name,body in zip(names,texts):struct.pack_into('>I',name,1,p);p+=len(body)
 chunks=[]
 for tag,body in [(b'NAME',b''.join(names)),(b'DESC',b''.join(texts)),(b'INFO',struct.pack('>III',len(names),max_decoded,max(map(len,texts))))]:chunks.append(tag+struct.pack('>I',len(body))+body+(b'\0'if len(body)&1 else b''))
 result=b'MENT'+b''.join(chunks);return b'FORM'+struct.pack('>I',len(result))+result

def native_shape(frame,original_h=None):
 w,h=frame['width'],frame['height'];indices=frame['indices'];rle=bytearray()
 for y in range(h):
  x=0
  while x<w:
   c=indices[y*w+x]
   if c:rle.append(c);x+=1
   else:
    run=1
    while x+run<w and not indices[y*w+x+run]and run<255:run+=1
    rle.extend((0,run));x+=run
 palette=bytes(frame['palette'])if frame.get('palette')is not None else b'';flags=2|(1 if palette else 0);size=10+len(palette)+len(rle)
 return struct.pack('<HBHBHH',flags,h,w,original_h or h,size,len(rle))+palette+rle

def shape_bank(frames,count):
 bodies=[native_shape(frames[i])for i in range(count)];p=2+4*(count+1);offsets=[]
 for body in bodies:offsets.append(p-2);p+=len(body)
 offsets.append(p-2);return struct.pack('<H',count)+struct.pack('<'+'I'*(count+1),*offsets)+b''.join(bodies)

def draw_text(indices,w,h,value,font,rect,fg,bg=None):
 x,y,rw,rh=rect
 if bg is not None:
  for yy in range(y,y+rh):indices[yy*w+x:yy*w+x+rw]=bytes([bg])*rw
 rows=[];advance=sum(font['chars'][c]['width']-1 for c in value.encode('cp1250'));scale=min(1,(rw-2)/max(1,advance));tw=max(1,round(advance*scale));left=x+(rw-tw)//2;top=y+(rh-font['height'])//2
 pen=0
 for c in value.encode('cp1250'):
  g=font['chars'][c];gw=g['width']
  for gy in range(g['usedLines']):
   for gx in range(gw):
    v=g['pixels'][gy*gw+gx]
    # Native nibble1 is the foreground stem. Nibbles2/3 are background and
    # shadow in GUI_DrawText_Wrapper, not extra foreground coverage.
    if v!=1:continue
    xx=left+int((pen+gx)*scale);yy=top+g['unusedLines']+gy
    if x<=xx<x+rw and y<=yy<y+rh and 0<=xx<w and 0<=yy<h:indices[yy*w+xx]=fg
  pen+=gw-1
 return dict(text=value,rect=list(rect),fontHeight=font['height'],nativeAdvance=advance,horizontalScale=scale)

def build(allow_incomplete=False):
 preload=verify_preload();english=read_pak('ENGLISH.PAK');all_members={}
 for item in preload['files']:
  if item['name'].endswith('.PAK'):
   for name,row in read_pak(item['name']).items():all_members.setdefault(name,row)
 corpus=json.loads((ROOT/'art/localization/en.json').read_text());records=corpus['records'];translations={};translation_sources={};presentation_labels={};shell={}
 for source in sorted((ROOT/'art/localization').glob('cs-*.json')):
  value=json.loads(source.read_text());translation_sources[source.name]=sha(source.read_bytes());presentation_labels.update(value.get('presentationLabels',{}));shell.update(value.get('shell',{}))
  for key,text in value.get('translations',{}).items():
   if key in translations and translations[key]!=text:raise ValueError(('Conflicting Czech translation',key))
   translations[key]=text
 missing=[];record_ids={r['id']for r in records}
 for r in records:
  if r['kind']=='help-selector':continue
  if r['id']not in translations:
   if not r['text'].strip():translations[r['id']]=r['text']
   else:missing.append(r['id']);translations[r['id']]=r['text']
  value=translations[r['id']];value.encode('cp1250')
  if r['printf']!=__import__('re').findall(r'%(?:[-+ #0]*\d*(?:\.\d+)?[hlL]?[diuoxXfFeEgGaAcsp%])',value):raise ValueError(('Printf signature changed',r['id']))
  if [ord(c)for c in value if ord(c)<32]!=[c['byte']for c in r['controls']]:raise ValueError(('Native text controls changed',r['id']))
 if missing and not allow_incomplete:raise ValueError(f'{len(missing)} missing Czech translations; first: {missing[:8]}')
 out=ROOT/'dist/locales/cs';out.mkdir(parents=True,exist_ok=True);files=[];source_hashes={}
 def emit(name,body):
  path=out/name;path.write_bytes(body);files.append(dict(name=name,src='locales/cs/'+name,sha256=sha(body),bytes=len(body)));source_hashes[name]=all_members[name]['sha256']
 runtime_bytes=0;longest=0;byte_bounds={}
 for name,(compressed,start,loaded)in TABLES.items():
  selected=sorted((r for r in records if r['resource']==name),key=lambda r:r['index']);decoded=[translations[r['id']].encode('cp1250')for r in selected];longest=max(longest,max(map(len,decoded)))
  if max(map(len,decoded))>=1024:raise ValueError('Native per-string1024-byte temporary exceeded')
  runtime_bytes+=sum(len(value.rstrip())+1 for source,value in zip(selected,decoded)if source['metadata']['runtimeLoaded']);raw=table(decoded,compressed);emit(name,raw)
  byte_bounds[name]=dict(records=len(decoded),runtimeSourceRows=sum(r['metadata']['runtimeLoaded']for r in selected),fileBytes=len(raw),tableOffsetBytes=len(decoded)*2,maxDecodedBytes=max(map(len,decoded)),maxStoredBytes=max(len(compress(r)if compressed else r)for r in decoded),lastStringOffset=u16(raw,(len(decoded)-1)*2),format='LE16 offsets followed by NUL strings',compressed=compressed)
 if runtime_bytes>=48*1024:raise ValueError(f'Native48KiB string buffer exceeded: {runtime_bytes}')
 for name in ['MENTATA.ENG','MENTATH.ENG','MENTATO.ENG']:
  raw=mentat(name,records,translations);emit(name,raw);p=12;bounds={}
  while p<len(raw):
   tag=raw[p:p+4].decode('ascii');length=u32be(raw,p+4);bounds[tag]=dict(offset=p+8,length=length)
   if tag=='INFO':bounds['limits']=dict(subjectCount=u32be(raw,p+8),maxDecodedBytes=u32be(raw,p+12),maxStoredBytes=u32be(raw,p+16))
   p+=8+length+(length&1)
  byte_bounds[name]=dict(fileBytes=len(raw),format='FORM/MENT with BE32 chunk lengths and absolute body offsets',chunks=bounds)
 credit_rows=sorted((r for r in records if r['resource']=='CREDITS.ENG'),key=lambda r:r['index']);credits=b'\r'.join(bytes.fromhex(r['metadata']['prefixHex'])+translations[r['id']].encode('cp1250')for r in credit_rows)
 emit('CREDITS.ENG',credits+b'\0')
 fonts={}
 for name in ['NEW6P.FNT','NEW8P.FNT','INTRO.FNT']:
  raw,font=patch_font(all_members[name]['bytes']);emit(name,raw);fonts[name]=font
 # Native indexed bitmap labels and scene witness overrides are emitted below.
 spec=importlib.util.spec_from_file_location('locale_graphics',ROOT/'tools/build-hd-assets.py');codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
 ui_frames={};bitmap_labels={7:'MENTAT',8:'MENTAT',9:'VOLBY',10:'VOLBY',11:'Kredity',359:'VYLEPŠIT',360:'VYLEPŠIT',361:'OBJEDNAT',362:'OBJEDNAT',363:'POSTAVIT',364:'POSTAVIT',365:'POKRAČOVAT',366:'POKRAČOVAT',371:'FAKTURA',372:'FAKTURA',373:'Ano',374:'Ano',375:'Ne',376:'Ne',377:'Zpět',378:'Zpět',379:'Pokračovat',380:'Pokračovat',381:'Znovu',382:'Znovu'};label_metrics={}
 native_palette=bytes((c*65)>>4 for c in all_members['IBM.PAL']['bytes'])
 for name,first in [('BTTN.ENG',7),('CHOAM.ENG',355),('MENTAT.ENG',373)]:
  count,frames=codec.shapes(english[name]['bytes'])
  for i,frame in frames.items():
   identifier=first+i
   if identifier not in bitmap_labels:continue
   original_indices=frame['indices'];indices=bytearray(original_indices);palette=frame['palette'];global_indices=[palette[c]if palette else c for c in original_indices];counts=collections.Counter(global_indices);bg_global=counts.most_common(1)[0][0]
   # Keep the original outer one-pixel frame and transparent footprint, then
   # redraw the small interior panel in the same indexed palette.
   fg_global=max((c for c in counts if c),key=lambda c:sum(native_palette[c*3:c*3+3]))
   if palette:
    bg=palette.index(bg_global);fg=palette.index(fg_global)if fg_global in palette else max(range(1,len(palette)),key=lambda k:palette[k])
   else:bg=bg_global;fg=fg_global
   rect=(2,1,frame['width']-4,frame['height']-2);metrics=draw_text(indices,frame['width'],frame['height'],bitmap_labels[identifier],fonts['NEW6P.FNT'],rect,fg,bg)
   # Source transparency remains a strict native drawing footprint.
   for p,m in enumerate(frame['mask']):
    if not m:indices[p]=0
   frame['indices']=bytes(indices);frame['mask']=bytes(bool(c)for c in indices);label_metrics[identifier]=metrics
   ui_frames[str(identifier)]=dict(sourceW=frame['width'],sourceH=frame['height'],resource=name,resourceFrame=i,paletteMode='local16'if palette else'global256',**({'palette':palette}if palette else{}),indicesBase64=b64(frame['indices']),maskBase64=b64(frame['mask']),sourceSHA256=sha(native_shape(frame)),originalSourceSHA256=frame['sourceSHA256'])
  raw=shape_bank(frames,count);decoded_count,decoded=codec.shapes(raw)
  if decoded_count!=count or any(decoded[i]['indices']!=frames[i]['indices']for i in frames):raise ValueError(('Localized SHP round-trip failed',name))
  emit(name,raw)
 scenes={};scene_labels={}
 for name in ['MISC.ENG','HERALD.ENG','TITLE.ENG','AND.ENG']:
  raw=english[name]['bytes'];compression,expanded,pal_size=struct.unpack_from('<HIH',raw,2);source=codec.format80(raw[10+pal_size:],expanded)if compression==4 else raw[10+pal_size:10+pal_size+expanded];indices=bytearray(source);labels=[]
  if name=='MISC.ENG':
   for value,rect in [('Chcete se přidat k rodu',(0,0,208,24)),('Harkonnenů?',(0,24,104,24)),('Atreidů?',(0,48,104,24)),('Ordosů?',(0,72,104,24))]:labels.append(draw_text(indices,320,200,value,fonts['NEW8P.FNT'],rect,32,12))
  elif name=='HERALD.ENG':
   labels.append(draw_text(indices,320,200,'Vyberte si rod',fonts['INTRO.FNT'],(0,0,320,42),32,0))
   for value,rect in [('Atreidové',(26,132,71,13)),('Ordosové',(123,132,71,13)),('Harkonnenové',(220,132,71,13))]:labels.append(draw_text(indices,320,200,value,fonts['NEW8P.FNT'],rect,229,115))
  elif name=='TITLE.ENG':
   # TITLE.ENG contains the DUNE II logo and subtitle. Only the subtitle below
   # the horizontal rule is localized; the proper-name logo is byte-identical.
   rect=(0,104,320,24);foreground=collections.Counter(c for p,c in enumerate(indices)if p//320>=104 and c).most_common(1)[0][0]
   labels.append(draw_text(indices,320,200,'Budování dynastie',fonts['INTRO.FNT'],rect,foreground,0))
  else:
   ink=[p for p,c in enumerate(indices)if c];xs=[p%320 for p in ink];ys=[p//320 for p in ink];rect=(min(xs),min(ys)-3,max(xs)-min(xs)+1,max(ys)-min(ys)+7);foreground=collections.Counter(indices[p]for p in ink).most_common(1)[0][0];labels.append(draw_text(indices,320,200,'a',fonts['INTRO.FNT'],rect,foreground,0))
  body=bytes(indices);palette=raw[10:10+pal_size];result=struct.pack('<HHIH',8+pal_size+len(body),0,len(body),pal_size)+palette+body;emit(name,result)
  witnesses=[]
  for y in range(0,200,4):
   for x in range(0,320,4):
    value=indices[y*320+x]
    if value:witnesses.append([x,y,value])
  scenes[name]=dict(indicesBase64=b64(indices),witnesses=witnesses,originalSourceSHA256=sha(raw),sourceSHA256=sha(result));scene_labels[name]=labels
 manifest=dict(schema=1,locale='cs',language='Čeština',encoding='windows-1250',fontCount=254,complete=not missing,files=files,fonts={n:font_json(f)for n,f in fonts.items()},uiFrames=ui_frames,scenes=scenes,bitmapLabels={str(k):v for k,v in bitmap_labels.items()},presentationLabels=presentation_labels,shell=shell,labelMetrics=label_metrics,sceneLabels=scene_labels,byteBounds=byte_bounds,coverage=dict(corpusRecords=len(records),translations=len([r for r in records if r['kind']!='help-selector']),missing=missing,runtimeStringSlots=corpus['runtimeSlots'],runtimeSourceRows=corpus['runtimeSourceRows'],runtimeAliases=corpus['runtimeAliases'],runtimeFillSlots=corpus['runtimeFillSlots'],runtimeStringBytes=runtime_bytes,nativeStringLimitBytes=48*1024,longestNativeString=longest),source=dict(packageSHA256=preload['packageSha256'],resources=source_hashes,translationSources=translation_sources,originalsModified=False,originalDosExecuted=False),limits=['Czech security answers use unaccented ASCII to preserve native input and normalization.','Native glyphs preserve ASCII metrics; Czech accents are composed from native bitmap stems in additional CP1250 slots.','Czech bitmap button lettering may condense horizontally to preserve exact native click bounds.'])
 (ROOT/'dist/locales/cs.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps(dict(output='dist/locales/cs.json',files=len(files),coverage=manifest['coverage'],fontCounts={n:f['count']for n,f in fonts.items()}),ensure_ascii=False,indent=2))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--allow-incomplete',action='store_true');build(parser.parse_args().allow_incomplete)
