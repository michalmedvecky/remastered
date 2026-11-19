import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileConfirmationRecognition,recognizeConfirmationHouse} from '../dist/painted-scenes.mjs';
const chrome=JSON.parse(readFileSync(new URL('../dist/painted/interface.json',import.meta.url)));
const cs=JSON.parse(readFileSync(new URL('../dist/locales/cs.json',import.meta.url)));
const rects=chrome.scenes['MISC.ENG'].sourceNameRects;
const bytes=base64=>Uint8Array.from(Buffer.from(base64,'base64'));
for(const[language,scene]of [['English',chrome.scenes['MISC.ENG']],['Czech',cs.scenes['MISC.ENG']]]){
  test(language+' confirmation distinguishes the actual selected house from common panel backgrounds',()=>{
    const source=bytes(scene.indicesBase64),compiled=compileConfirmationRecognition(source,rects);
    assert.ok(compiled.points.length>=24);
    for(const house of [0,1,2]){
      const pixels=new Uint8Array(64000),[sx,sy,w,h]=rects[house];
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)pixels[y*320+208+x]=source[(sy+y)*320+sx+x];
      assert.equal(recognizeConfirmationHouse({uiPixels:pixels},compiled),house);
      // One conflicting discriminant cannot be rounded into a guessed house.
      const p=compiled.points[0];pixels[p.y*320+208+p.x]=255;
      assert.equal(recognizeConfirmationHouse({uiPixels:pixels},compiled),null);
    }
    assert.equal(recognizeConfirmationHouse({pixels:new Uint8Array(64000)},compiled),null);
  });
}
