import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('native WSA skips absent continuation stream and preserves real frames under ASan',()=>{
 const result=spawnSync('python3',['fidelity/wsa/test-native-wsa.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
