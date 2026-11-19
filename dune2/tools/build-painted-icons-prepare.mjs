// Read-only native UI inventory/reference export. GPL-2.0-only.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {encodePNG} from './painted-png.mjs';
const root=new URL('../',import.meta.url),art=new URL('art/hd-v3/icons/',root),sha=b=>createHash('sha256').update(b).digest('hex');
const native=JSON.parse(await fs.readFile(new URL('dist/painted/native.json',root))),frames={},paletteVariants=JSON.parse(await fs.readFile(new URL('source-palettes.json',art)));
const colourPalette=id=>Number(id)>=432&&Number(id)<=476?paletteVariants['BENE.PAL'].palette:native.palette;
for(const directory of ['native','references','raw','packed'])await fs.mkdir(new URL(directory+'/',art),{recursive:true});
for(const[id,f]of Object.entries(native.frames.ui)){
 const w=f.sourceW,h=f.sourceH,indices=Buffer.from(f.indicesBase64,'base64'),mask=Buffer.from(f.maskBase64,'base64'),pixels=new Uint8Array(w*h*4),xs=[],ys=[];
 for(let i=0;i<indices.length;i++){if(!mask[i])continue;let c=f.palette?f.palette[indices[i]]:indices[i];if(f.palette&&c>=144&&c<=152)c+=16;pixels.set([...colourPalette(id).slice(c*3,c*3+3),255],i*4);xs.push(i%w);ys.push(Math.floor(i/w));}
 const png=encodePNG(w,h,pixels);await fs.writeFile(new URL('native/'+id+'.png',art),png);
 frames[id]={id:Number(id),...f,sourceInk:xs.length?[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs)+1,Math.max(...ys)-Math.min(...ys)+1]:null,pivot:[Math.floor(w/2),Math.floor(h/2)],referencePalette:Number(id)>=432&&Number(id)<=476?'BENE.PAL':'IBM.PAL',nativePng:'native/'+id+'.png',nativePngSha256:sha(png)};
}
const bindings={};for(const name of ['structureinfo','unitinfo']){const c=await fs.readFile(new URL('native/opendune/src/table/'+name+'.c',root),'utf8');bindings[name]=[...c.matchAll(/\/\* name\s*\*\/\s*"([^"]+)"[\s\S]*?\/\* spriteID\s*\*\/\s*(\d+)/g)].map(m=>({name:m[1],spriteID:Number(m[2])}));}
await fs.writeFile(new URL('inventory.json',art),JSON.stringify({schema:1,scale:4,source:native.source,palette:native.palette,paletteVariants,frames,bindings,coverage:{expectedNativeSlots:281}},null,2)+'\n');
const all=Object.keys(frames).map(Number);const columns=10,cellW=176,cellH=144,rows=Math.ceil(all.length/columns),width=columns*cellW,height=rows*cellH,pixels=new Uint8Array(width*height*4),digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
for(let p=0;p<pixels.length;p+=4)pixels.set([30,34,39,255],p);
for(const[slot,id]of all.entries()){const f=frames[id],scale=Math.max(1,Math.min(4,150/f.sourceW,110/f.sourceH)),w=Math.floor(f.sourceW*scale),h=Math.floor(f.sourceH*scale),left=slot%columns*cellW+Math.floor((cellW-w)/2),top=Math.floor(slot/columns)*cellH+25,ind=Buffer.from(f.indicesBase64,'base64'),mask=Buffer.from(f.maskBase64,'base64');for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=Math.floor(y/scale)*f.sourceW+Math.floor(x/scale);if(!mask[i])continue;let c=f.palette?f.palette[ind[i]]:ind[i];if(f.palette&&c>=144&&c<=152)c+=16;pixels.set([...colourPalette(id).slice(c*3,c*3+3),255],((top+y)*width+left+x)*4);}for(const[i,d]of[...String(id)].entries())for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(digits[d][y*3+x]==='1')for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++)pixels.set([200,210,220,255],((Math.floor(slot/columns)*cellH+5+y*2+yy)*width+slot%columns*cellW+6+i*8+x*2+xx)*4);}
await fs.writeFile(new URL('native-contact.png',art),encodePNG(width,height,pixels));
console.log(JSON.stringify({frames:all.length,portraitIDs:all.filter(id=>frames[id].sourceW===32&&frames[id].sourceH===24),contact:'art/hd-v3/icons/native-contact.png'}));
