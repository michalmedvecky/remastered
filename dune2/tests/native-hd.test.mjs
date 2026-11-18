import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('native HD observer preserves dirty commands, camera/painter order and bounded caches',()=>{
  const result=spawnSync('python3',['fidelity/hd/test-native-cache.py'],{
    cwd:new URL('..',import.meta.url),encoding:'utf8',
  });
  assert.equal(result.status,0,result.stdout+result.stderr);
});
