import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('victory/defeat native modals keep the committed HD world only before the actual advisor replacement',()=>{
 const result=spawnSync('python3',['fidelity/painted-polish/test-world-modal.py'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
