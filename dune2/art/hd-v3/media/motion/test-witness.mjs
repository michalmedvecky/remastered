import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {matchPortraitWitness} from './witness.mjs';
const root=new URL('./',import.meta.url),bank=JSON.parse(fs.readFileSync(new URL('frame-witnesses.json',root),'utf8'));
const inventory=JSON.parse(fs.readFileSync(new URL('inventory.json',root),'utf8'));
let checked=0;const distinct=new Set();
for(const row of inventory.resources)for(const f of row.frames){
 const bytes=fs.readFileSync(new URL(f.indexFile,root));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.pixelSha256);
 const pixels=new Uint8Array(64000);
 for(let y=0;y<112;y++)pixels.set(bytes.subarray(y*184,(y+1)*184),(48+y)*320+128);
 const result=matchPortraitWitness(pixels,bank);
 assert.equal(result.status,'matched');assert(result.frames.some(r=>r.resource===row.resource&&r.frame===f.frame));
 distinct.add(f.pixelSha256);checked++;
 const [x,y]=bank.coordinates[0];pixels[(48+y)*320+128+x]^=0xff;
 assert.equal(matchPortraitWitness(pixels,bank).status,'unknown');
 const occluded=new Uint8Array(64000);occluded[(48+y)*320+128+x]=1;
 const partial=matchPortraitWitness(pixels,bank,{occluded});
 assert(partial.status==='matched'||partial.status==='ambiguous');
 assert(partial.frames.some(r=>r.resource===row.resource&&r.frame===f.frame));
}
assert.equal(checked,161);assert.equal(inventory.resources.length,36);assert.equal(distinct.size,107);
assert.equal(matchPortraitWitness(new Uint8Array(64000),bank,{occluded:()=>true}).status,'unknown');
fs.writeFileSync(new URL('witness-test-results.json',root),JSON.stringify({passed:true,resources:36,frames:checked,distinctImages:distinct.size,coordinates:bank.coordinates.length,tests:['every native frame exact identification','immutable full index hashes','unknown on unmasked mismatch','occlusion never chooses nearest','all-occluded unknown'],executedOriginalDosBinary:false},null,2)+'\n');
console.log('36 WSA resources / 161 frames / 107 distinct images: exact native witnesses passed');
