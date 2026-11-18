import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {createHash} from 'node:crypto';

const {values}=parseArgs({options:{'game-dir':{type:'string'},zip:{type:'string'}}});
if(!values['game-dir'])throw Error('Usage: npm run verify:originals -- --game-dir /path/to/game [--zip /path/to/archive.zip]');
const integrity=JSON.parse(fs.readFileSync(new URL('../fidelity/original-integrity.json',import.meta.url)));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const file of integrity.members)assert.equal(sha(path.join(values['game-dir'],file.name)),file.sha256,file.name);
if(values.zip)assert.equal(sha(values.zip),integrity.sourceZipSha256,'original ZIP');
console.log(`Verified ${integrity.members.length} original files${values.zip?' and ZIP':''}; read-only hash check, no DOS execution.`);
