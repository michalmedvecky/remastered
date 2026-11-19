"""Prepare a bounded native pose reference sheet for newly painted motion parts."""
from pathlib import Path
import importlib.util
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('parts_png',ROOT/'tools/build-hd-assets.py')
codec=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec)
items=[('headqrts',0,(149,46,24,17)),('headqrts',4,(149,46,24,17)),('headqrts',5,(149,46,24,17)),('carryall',0,(151,84,17,28)),('carryall',1,(151,84,17,28)),('palace',0,(160,90,10,18)),('palace',1,(160,90,10,18)),('palace',10,(160,90,10,18)),('starport',16,(93,68,38,10))]
out=bytearray([20,25,34,255])*(552*336)
for i,(name,frame,(x,y,w,h))in enumerate(items):
 sw,sh,pixels=codec.read_png(ROOT/'art/hd-v3/media/motion/native'/name/f'frame-{frame:03}.png')
 scale=min(160//w,96//h);dw,dh=w*scale,h*scale;dx=i%3*184+(184-dw)//2;dy=i//3*112+(112-dh)//2
 for yy in range(dh):
  for xx in range(dw):
   a=((y+yy//scale)*sw+x+xx//scale)*4;b=((dy+yy)*552+dx+xx)*4;out[b:b+4]=pixels[a:a+4]
codec.write_png(ROOT/'art/hd-v3/media/references/motion-parts-native.png',552,336,out)
