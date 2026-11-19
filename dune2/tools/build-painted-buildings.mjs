// Rebuild the saved whole-object artwork without a model call or game execution.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
execFileSync('python3',[fileURLToPath(new URL('./build-painted-buildings.py',import.meta.url)),...process.argv.slice(2)],{stdio:'inherit'});
