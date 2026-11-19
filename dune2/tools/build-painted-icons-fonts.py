#!/usr/bin/env python3
"""Read-only inventory of native Westwood bitmap fonts and cinematic coverage."""
import base64,hashlib,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from preload_data import verify_preload,read_pak
out=ROOT/'art/hd-v3/icons';preload=verify_preload();members={}
for f in preload['files']:
 if f['name'].endswith('.PAK'):
  for n,r in read_pak(f['name']).items():members.setdefault(n,r)
pal=members['BENE.PAL'];(out/'source-palettes.json').write_text(json.dumps({'BENE.PAL':{'sha256':pal['sha256'],'palette':[(v*65)>>4 for v in pal['bytes']],'purpose':'GUI_Mentat_Display mercenary/Bene Gesserit palette; IBM colours are not correct for MENSHPM reference RGB'}},indent=2)+'\n')
fonts={}
for name,row in members.items():
 if not name.endswith('.FNT'):continue
 b=row['bytes'];u16=lambda p:struct.unpack_from('<H',b,p)[0]
 if b[2:4]!=b'\x00\x05':raise ValueError((name,'unsupported FNT signature'))
 start,data,widths,end,lines=(u16(p)for p in [4,6,8,10,12]);count=end-widths;chars={}
 for c in range(count):
  w,unused,used,offset=b[widths+c],b[lines+2*c],b[lines+2*c+1],u16(data+c*2);pixels=[]
  if offset:
   for y in range(used):
    for x in range(w):pixels.append((b[offset+y*((w+1)//2)+x//2]>>(4*(x%2)))&15)
  chars[c]=dict(width=w,advanceDefault=w-1,unusedLines=unused,usedLines=used,dataOffset=offset,nibblesBase64=base64.b64encode(bytes(pixels)).decode())
 fonts[name]=dict(sha256=row['sha256'],bytes=len(b),height=b[start+4],maxWidth=b[start+5],count=count,chars=chars)
result=dict(schema=1,sourcePreloadSha256=preload['packageSha256'],format='Westwood FNT little-endian offset tables; low nibble is left/even pixel, high nibble is right/odd pixel; row stride ceil(width/2)',defaultCharOffset=-1,nativeLoader='native/opendune/src/gui/font.c:Font_LoadFile',activelyLoaded=['INTRO.FNT','NEW6P.FNT','NEW8P.FNT'],notes=['Glyph advance is width + mutable g_fontCharOffset, initially -1. Preserve native layout and wrapping even when replacing glyph shape with scalable text.','unusedLines place the glyph vertically; only usedLines rows are stored. Pixel nibbles are palette/remap codes, not fixed RGB.','NEW10P.FNT and STD3P.FNT are supplied but not selected by Font_Init in this build.'],fonts=fonts)
(out/'fonts.json').write_text(json.dumps(result,indent=2)+'\n')
coverage=[]
for name,row in members.items():
 if name.endswith(('.WSA','.CPS')):coverage.append(dict(name=name,sha256=row['sha256'],bytes=len(row['bytes']),status='native-animation-not-painted'if name.endswith('.WSA')else'native-screen-inspect-interface-coverage'))
(out/'cinematic-inventory.json').write_text(json.dumps(dict(schema=1,sourcePreloadSha256=preload['packageSha256'],resources=coverage,notes=['Inventory only; no claim of painted HD cinematic animation or complete visual observation.','Advisor eye/mouth SHP patches need a coherent painted whole MENTAT background before replacement; independent patch generation over native pixels would leave seams.']),indent=2)+'\n')
print(json.dumps(dict(fonts={n:{k:v for k,v in f.items()if k!='chars'}for n,f in fonts.items()},cinematicResources=len(coverage))))
