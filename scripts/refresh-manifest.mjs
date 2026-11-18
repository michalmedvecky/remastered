import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { combinedManifest, project } from './manifest.mjs';

// Preserve each existing game's metadata bytes when its own runtime is unchanged.
async function writeIfDifferent(path, contents) {
  try { if (await readFile(path, 'utf8') === contents) return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path, contents);
}
const json = value => JSON.stringify(value, null, 2) + '\n';
const manifest = await combinedManifest();
for (const directory of ['provenance','pre2/provenance','dune2/provenance']) await mkdir(resolve(project,directory),{recursive:true});
await writeIfDifferent(resolve(project,'provenance/runtime-manifest.json'),json(manifest));
await writeIfDifferent(resolve(project,'pre2/provenance/runtime-manifest.json'),json(manifest.sites.pre2));
await writeIfDifferent(resolve(project,'dune2/provenance/runtime-manifest.json'),json(manifest.sites.dune2));
for (const [directory,snapshot] of Object.entries(manifest.sites).map(([site,value])=>[site,site==='portal'?manifest.snapshotSHA256:value.snapshotSHA256])) {
  const path = resolve(project,directory+'/dist/build.json');
  // A new collection member should not reformat/relabel an unchanged classic game.
  if (directory !== 'portal') {
    try { if (JSON.parse(await readFile(path,'utf8')).sourceSnapshot === snapshot) continue; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeIfDifferent(path,json({repository:'https://github.com/michalmedvecky/remastered',commit:null,buildSource:'dirty-snapshot',dirty:true,sourceSnapshot:snapshot}));
}
console.log(manifest.snapshotSHA256,Object.entries(manifest.sites).map(([key,value])=>key+':'+Object.keys(value.files).length).join(' '));
