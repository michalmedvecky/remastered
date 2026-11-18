import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyPreload} from './preload-data.mjs';
import {verifyUpscalePackage} from './verify-hd.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;
const upscale=verifyUpscalePackage(root);
const data=JSON.parse(fs.readFileSync(path.join(dist,'assets/content.json')));
const urls=new Set();
function visit(value){if(typeof value==='string'&&value.startsWith('assets/')&&/\.(png|wav|json)$/.test(value))urls.add(value);else if(value&&typeof value==='object')Object.values(value).forEach(visit);}
visit(data);assert.equal(data.scenarios.length,66);assert.equal(data.units.length,27);assert.equal(data.structures.length,19);
for(const url of urls){const target=path.resolve(dist,url);assert.ok(target.startsWith(dist+path.sep));assert.ok(fs.statSync(target).size>0,url);}
let modules=0;
for(const file of fs.readdirSync(dist).filter(n=>n.endsWith('.mjs'))){const source=fs.readFileSync(path.join(dist,file),'utf8');for(const [,url]of source.matchAll(/(?:from|import)\s*['"](\.\/?[^'"]+)['"]/g))assert.ok(fs.existsSync(path.resolve(dist,url)),`${file}: ${url}`);modules++;}
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(url.startsWith('data:')||url.includes('://'))continue;assert.ok(fs.existsSync(path.join(dist,url)),url);}
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const build=JSON.parse(fs.readFileSync(path.join(root,'fidelity/native-build.json')));for(const [name,digest]of Object.entries(build.outputs))assert.equal(sha(path.join(dist,'native',name)),digest,name);
for(const [name,digest]of Object.entries(build.sources))assert.equal(sha(path.join(root,name)),digest,name);
const music=JSON.parse(fs.readFileSync(path.join(root,'native/music/build-manifest.json')));for(const [name,digest]of Object.entries(music.source_sha256))assert.equal(sha(path.join(root,'native/music',name)),digest,name);
assert.equal(sha(path.join(dist,'music/adl.wasm')),music.output_sha256);
for(const bank of JSON.parse(fs.readFileSync(path.join(root,'native/music/banks.json'))))assert.equal(sha(path.join(dist,'music/banks',bank.name)),bank.sha256,bank.name);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'fidelity/source-package.json')));assert.equal(sha(path.join(dist,'native/source.tar.gz')),pkg.sha256);
assert.equal(sha(path.join(dist,'music/adl.wasm')),pkg.musicWasmSha256);
for(const [name,digest]of Object.entries(pkg.coreOutputs))assert.equal(sha(path.join(dist,'native',name)),digest,name);
const preload=verifyPreload();
execFileSync('python3',['-c',String.raw`
import hashlib,json,sys,tarfile
from pathlib import Path
root=Path(sys.argv[1])
with tarfile.open(root/'dist/native/source.tar.gz') as tar:
    manifest=json.load(tar.extractfile('dune2/SOURCE-MANIFEST.json'))
    assert manifest['generatedHDArtIncluded'] is False
    assert manifest['originalFramebufferUpscalerIncluded'] is True
    assert not any(name.startswith('art/hd-v1/') for name in manifest['files'])
    for name in ['upscale-core.mjs','upscale-renderer.mjs','upscale/xbr-lv2.upstream.glsl','upscale/xbr-lv2.fragment.glsl','upscale/xbr.vertex.glsl','upscale/LICENSE.txt','upscale/provenance.json']:
        assert 'dist/'+name in manifest['files'],name
    for name,digest in manifest['files'].items():
        current=(root/name).resolve()
        assert current.is_relative_to(root.resolve()),name
        assert hashlib.sha256(current.read_bytes()).hexdigest()==digest,name
        member=tar.extractfile('dune2/'+name)
        assert hashlib.sha256(member.read()).hexdigest()==digest,name
`,root],{stdio:'inherit'});
const hashes={};for(const file of fs.readdirSync(dist).filter(n=>/\.(mjs|css|html)$/.test(n)))hashes[file]=sha(path.join(dist,file));
fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results/build.json'),JSON.stringify({version,upscale,modules,assetReferences:urls.size,scenarios:66,units:27,structures:19,preloadedOriginalsVerified:preload.files.filter(f=>f.originalHashVerified).length,nativeSources:Object.keys(build.sources).length,nativeOutputs:build.outputs,sourcePackage:pkg.sha256,hashes},null,2));
console.log(`Verified ${modules} modules, ${urls.size} asset references, 66 scenarios, original-framebuffer upscaler, embedded original data and matching corresponding source. Original ZIP/EXE verification is a separate explicit check.`);
