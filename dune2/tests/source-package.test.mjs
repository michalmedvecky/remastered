import test from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';
const cwd=new URL('../',import.meta.url);
test('split corresponding source is deterministic, reconstructs all bytes and rejects changed/missing coverage',()=>{const result=execFileSync('python3',['-c',String.raw`
import sys,tempfile,json
from pathlib import Path
sys.path.insert(0,'tools')
from source_package import make_packages,collect_files,verify_packages
with tempfile.TemporaryDirectory()as tmp:
 root=Path(tmp);(root/'tools').mkdir();(root/'art/hd-v3/icons/raw').mkdir(parents=True)
 (root/'README.md').write_text('fixture source\n');(root/'tools/helper.py').write_text('print("source only")\n')
 for i in range(3):(root/f'art/hd-v3/icons/raw/{i}.png').write_bytes(bytes([i])*12000)
 meta={'version':'fixture','binaryOutputs':{},'musicWasmSha256':None}
 a,m=make_packages(root,collect_files(root),meta,32768);b,n=make_packages(root,collect_files(root),meta,32768)
 assert a==b and m==n
 assert len(a['artParts'])==3 and all(p['uncompressedBytes']<=32768 for p in a['artParts'])
 verified=verify_packages(root);assert verified['parts']==3 and verified['allCurrentBytesChecked']
 (root/'tools/helper.py').write_text('changed')
 try:verify_packages(root);raise AssertionError('modified source accepted')
 except ValueError as e:assert 'Current source bytes differ'in str(e)
 (root/'tools/helper.py').write_text('print("source only")\n')
 (root/'tools/new.py').write_text('new coverage')
 try:verify_packages(root);raise AssertionError('missing source coverage accepted')
 except ValueError as e:assert 'coverage differs'in str(e)
 (root/'tools/new.py').unlink();(root/'dist/native'/a['artParts'][0]['archive']).unlink()
 try:verify_packages(root);raise AssertionError('missing volume accepted')
 except (FileNotFoundError,ValueError):pass
 print(json.dumps(verified))
`],{cwd,encoding:'utf8'});assert.equal(JSON.parse(result).parts,3);});
test('source archive reader rejects traversal, links, forbidden payloads, duplicate members and unexpected roots',()=>{execFileSync('python3',['-c',String.raw`
import sys,tempfile,tarfile,gzip,io
from pathlib import Path
sys.path.insert(0,'tools')
from source_package import read_archive
with tempfile.TemporaryDirectory()as tmp:
 p=Path(tmp)/'bad.tar.gz'
 for names,kind in [(['../escape'],'file'),(['dune2/../escape'],'file'),(['dune2/back\\slash'],'file'),(['/dune2/absolute'],'file'),(['other/file'],'file'),(['dune2/game.PAK'],'file'),(['dune2/archive.zip'],'file'),(['dune2/link'],'symlink'),(['dune2/link'],'hardlink'),(['dune2/folder'],'directory'),(['dune2/dup','dune2/dup'],'file')]:
  with tarfile.open(p,'w:gz')as tar:
   for name in names:
    info=tarfile.TarInfo(name);info.size=1
    if kind=='symlink':info.type=tarfile.SYMTYPE;info.linkname='../../escape';info.size=0
    if kind=='hardlink':info.type=tarfile.LNKTYPE;info.linkname='dune2/file';info.size=0
    if kind=='directory':info.type=tarfile.DIRTYPE;info.size=0
    tar.addfile(info,io.BytesIO(b'x')if info.size else None)
  try:read_archive(p);raise AssertionError('unsafe archive accepted '+str(names)+' '+kind)
  except ValueError:pass
`],{cwd,stdio:'pipe'});});

test('SDL source ZIP is converted deterministically to regular TAR members with safe links materialized',()=>{execFileSync('python3',['-c',String.raw`
import sys,tempfile,zipfile,tarfile,stat
from pathlib import Path
sys.path.insert(0,'tools')
from source_package import repack_sdl_source
with tempfile.TemporaryDirectory()as tmp:
 root=Path(tmp);d=root/'native/dependencies';d.mkdir(parents=True);zpath=d/'SDL2-2.32.10-source.zip'
 with zipfile.ZipFile(zpath,'w')as z:
  z.writestr('SDL-src/include/header.h',b'source header')
  z.writestr('SDL-src/code/unit.c',b'source body')
  link=zipfile.ZipInfo('SDL-src/alias.h');link.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(link,b'include/header.h')
  link=zipfile.ZipInfo('SDL-src/code-alias');link.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(link,b'code')
 first=repack_sdl_source(root);second=repack_sdl_source(root);assert first==second and first['materializedSafeLinks']==2
 with tarfile.open(d/'SDL2-2.32.10-source.tar.gz')as t:
  assert all(m.isfile()for m in t.getmembers())
  assert t.extractfile('SDL-src/alias.h').read()==b'source header'
  assert t.extractfile('SDL-src/code-alias/unit.c').read()==b'source body'
 assert zpath.exists()
`],{cwd,stdio:'pipe'});});
