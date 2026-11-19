// Diagnostic bank contact at exactly4x native canvas size, not runtime artwork.
import fs from 'node:fs/promises';
import {decodePNG,encodePNG} from './painted-png.mjs';
const root=new URL('../',import.meta.url),art=new URL('art/hd-v2/units/',root),manifest=JSON.parse(await fs.readFile(new URL('dist/painted/units.json',root)));
const cell=144,columns=12,rows=Math.ceil(244/columns),width=cell*columns,height=cell*rows,pixels=new Uint8Array(width*height*4);
for(let p=0;p<pixels.length;p+=4)pixels.set([38,42,47,255],p);
const digits=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
for(let id=111;id<=354;id++){
 if(!manifest.frames[id])continue;const slot=id-111,left=slot%columns*cell,top=Math.floor(slot/columns)*cell,im=decodePNG(await fs.readFile(new URL('packed/'+id+'.png',art))),dx=left+Math.floor((cell-im.width)/2),dy=top+25+Math.floor((cell-30-im.height)/2);
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const p=(y*im.width+x)*4,q=((dy+y)*width+dx+x)*4,a=im.pixels[p+3]/255;for(let c=0;c<3;c++)pixels[q+c]=Math.round(im.pixels[p+c]*a+pixels[q+c]*(1-a));}
 for(const [i,d]of [...String(id)].entries())for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(digits[Number(d)][y*3+x]==='1')for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++)pixels.set([172,181,194,255],((top+6+y*2+yy)*width+left+6+i*8+x*2+xx)*4);
}
await fs.writeFile(new URL('review-contact.png',art),encodePNG(width,height,pixels));
console.log(JSON.stringify({file:'art/hd-v2/units/review-contact.png',width,height,frames:Object.keys(manifest.frames).length,scale:4}));
