#!/usr/bin/env python3
"""Render translated indexed overlays statically, without an emulator/game."""
import importlib.util,json,struct,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
from preload_data import read_pak
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
graphics=module('locale_review_graphics',ROOT/'tools/build-hd-assets.py');locale=module('locale_review_codec',ROOT/'tools/build-localization.py')
out=ROOT/'fidelity/localization';palette=bytes((c*65)>>4 for c in read_pak('DUNE.PAK')['IBM.PAL']['bytes'])
items=[];x=y=8;width=640
for name in ['BTTN.ENG','CHOAM.ENG','MENTAT.ENG']:
 count,frames=graphics.shapes((ROOT/'dist/locales/cs'/name).read_bytes());x=8
 for i,frame in frames.items():
  if name=='CHOAM.ENG'and not 4<=i<=17:continue
  if name=='MENTAT.ENG'and i>=10:continue
  if x+frame['width']*2>=width:x=8;y+=52
  items.append((x,y,frame));x+=frame['width']*2+8
 y+=56
height=y;rgba=bytearray(bytes([10,12,16,255])*(width*height))
for left,top,frame in items:
 for yy in range(frame['height']):
  for xx in range(frame['width']):
   c=frame['indices'][yy*frame['width']+xx];c=frame['palette'][c]if frame['palette']else c
   for dy in range(2):
    for dx in range(2):
     p=((top+yy*2+dy)*width+left+xx*2+dx)*4;rgba[p:p+4]=palette[c*3:c*3+3]+b'\xff'
graphics.write_png(out/'native-czech-buttons.png',width,height,rgba)
for name in ['TITLE.ENG','AND.ENG','MISC.ENG','HERALD.ENG']:
 raw=(ROOT/'dist/locales/cs'/name).read_bytes();pal_size=struct.unpack_from('<H',raw,8)[0];pixels=raw[10+pal_size:];pal=bytes((c*65)>>4 for c in raw[10:10+pal_size])if pal_size else palette
 graphics.write_png(out/(name[:-4].lower()+'.png'),320,200,b''.join(pal[c*3:c*3+3]+b'\xff'for c in pixels))
width=960;height=240;rgba=bytearray(bytes([10,12,16,255])*(width*height));samples=['ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ  áčďéěíňóřšťúůýž','Žluťoučký kůň úpěl ďábelské ódy.'];top=6
for name in ['NEW6P.FNT','NEW8P.FNT','INTRO.FNT']:
 font=locale.read_font((ROOT/'dist/locales/cs'/name).read_bytes());indices=bytearray(480*font['height']*2)
 for i,sentence in enumerate(samples):locale.draw_text(indices,480,font['height']*2,sentence,font,(0,i*font['height'],480,font['height']),32,12)
 for y in range(font['height']*2):
  for x in range(480):
   c=indices[y*480+x]
   for dy in range(2):
    for dx in range(2):
     p=((top+y*2+dy)*width+x*2+dx)*4;rgba[p:p+4]=palette[c*3:c*3+3]+b'\xff'
 top+=font['height']*4+8
graphics.write_png(out/'native-czech-fonts.png',width,height,rgba)
print(json.dumps(dict(output=str(out.relative_to(ROOT)),gameExecuted=False)))
