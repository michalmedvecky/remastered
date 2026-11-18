import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextSaveName,validateNativeSave} from '../dist/native-saves.mjs';
test('native imports use contiguous browser filenames without overwriting saves',()=>{assert.equal(nextSaveName([]),'_SAVE000.DAT');assert.equal(nextSaveName(['_SAVE000.DAT','_save002.dat']),'_SAVE001.DAT');assert.equal(nextSaveName(['SAVE000.DAT']),'_SAVE000.DAT');assert.throws(()=>nextSaveName(Array.from({length:1000},(_,i)=>`_save${String(i).padStart(3,'0')}.dat`)));});
test('imports accept DOS and browser filenames and validate IFF save envelope',()=>{const bytes=new Uint8Array([70,79,82,77,0,0,0,4,83,67,69,78]);for(const name of ['SAVE000.DAT','_save045.dat'])assert.ok(validateNativeSave(name,bytes));assert.throws(()=>validateNativeSave('DUNE2.EXE',bytes));assert.throws(()=>validateNativeSave('SAVE000.DAT',bytes.subarray(0,11)));const corrupt=bytes.slice();corrupt[7]=50;assert.throws(()=>validateNativeSave('SAVE000.DAT',corrupt));});
