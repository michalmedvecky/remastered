// Assemble native whole-preview semantic references; no source execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import{fileURLToPath}from'node:url';
import{decodePNG,encodePNG}from'./painted-png.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ART=path.join(ROOT,'art/hd-v3/media');
execFileSync('python3',[path.join(ROOT,'tools/prepare-painted-media.py')],{cwd:ROOT,stdio:'inherit'});
const groups={
 'ground':['SLAB','4SLAB','WALL','WINDTRAP'],
 'headquarters':['CONSTRUC','PALACE','BARRAC','WOR'],
 'factories':['LITEFTRY','HVYFTRY','HITCFTRY','IX'],
 'industry':['REFINERY','REPAIR','HEADQRTS','STORAGE'],
 'weapons':['STARPORT','TURRET','RTURRET','GOLD-BB'],
 'logistics':['CARRYALL','ORNI','MCV','HARVEST'],
 'heavy-vehicles':['LTANK','HTANK','HARKTANK','STANK'],
 'light-vehicles':['RTANK','ORDRTANK','TRIKE','OTRIKE'],
 'people':['INFANTRY','HYINFY','SABOTURE','QUAD']
};
fs.mkdirSync(path.join(ART,'references'),{recursive:true});fs.mkdirSync(path.join(ART,'raw'),{recursive:true});fs.mkdirSync(path.join(ART,'review'),{recursive:true});
const references={};
for(const[group,names]of Object.entries(groups)){
 const width=752,height=464,pixels=new Uint8Array(width*height*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=24;pixels[i+1]=29;pixels[i+2]=38;pixels[i+3]=255;}
 names.forEach((name,i)=>{const file='art/hd-v3/media/motion/native/'+name.toLowerCase()+'/frame-000.png',raw=fs.readFileSync(path.join(ROOT,file)),normalized='art/hd-v3/media/references/native/'+name.toLowerCase()+'.png',im=decodePNG(fs.readFileSync(path.join(ROOT,normalized)));if(im.width!==184||im.height!==112)throw Error('Unexpected native preview '+name);references[name+'.WSA']={file,normalized,sha256:crypto.createHash('sha256').update(raw).digest('hex'),group,cell:i,nativeW:184,nativeH:112};const dx=i%2*376+4,dy=Math.floor(i/2)*232+4;for(let y=0;y<224;y++)for(let x=0;x<368;x++){const p=(Math.floor(y/2)*184+Math.floor(x/2))*4;pixels.set(im.pixels.subarray(p,p+4),((dy+y)*width+dx+x)*4);}});
 fs.writeFileSync(path.join(ART,'references',group+'.png'),encodePNG(width,height,pixels));
}
fs.writeFileSync(path.join(ART,'references.json'),JSON.stringify({schema:1,groups,references,purpose:'Native first-frame whole-scene references, nearest2x only for inspection; original sources unchanged'},null,2)+'\n');console.log(JSON.stringify({groups:Object.keys(groups).length,resources:Object.keys(references).length}));
