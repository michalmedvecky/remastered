"""Bundle matching corresponding sources and licenses; exclude original game assets."""
from pathlib import Path
import argparse,gzip,hashlib,io,json,shutil,tarfile
ROOT=Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--emscripten',type=Path,help='Optional SDK path to refresh retained dependency sources and notices');args=parser.parse_args();sdk=args.emscripten
 license_dir=ROOT/'native/licenses';license_dir.mkdir(exist_ok=True)
 for src,name in [(ROOT/'native/opendune/COPYING','GPL-2.0.txt'),(ROOT/'native/music/vendor/nuked-opl3/LICENSE','LGPL-2.1.txt')]:shutil.copyfile(src,license_dir/name)
 dependency=ROOT/'native/dependencies';dependency.mkdir(exist_ok=True)
 if sdk:
  for src,name in [(sdk/'cache/ports/sdl2/SDL-release-2.32.10/LICENSE.txt','SDL2.txt'),(sdk/'LICENSE','Emscripten.txt')]:shutil.copyfile(src,license_dir/name)
  shutil.copyfile(sdk/'cache/ports/sdl2.32.10.zip',dependency/'SDL2-2.32.10-source.zip')
  shutil.copyfile(sdk/'tools/ports/sdl2.py',dependency/'emscripten-sdl2-port.py')
 for p in [license_dir/'SDL2.txt',license_dir/'Emscripten.txt',dependency/'SDL2-2.32.10-source.zip',dependency/'emscripten-sdl2-port.py']:
  if not p.is_file():parser.error('Missing retained dependency '+str(p)+'; refresh with --emscripten /path/to/sdk')
 public=ROOT/'dist/native/licenses';shutil.copytree(license_dir,public,dirs_exist_ok=True)
 files=[]
 for directory in ['native','tools','fidelity','tests','art/hd-v1']:
  for p in (ROOT/directory).rglob('*'):
   if p==ROOT/'fidelity/source-package.json':continue
   if not p.is_file() or '__pycache__' in p.parts or p.suffix=='.pyc':continue
   if p.is_relative_to(ROOT/'native/data'):continue
   files.append(p)
 files += [ROOT/x for x in ['README.md','FIDELITY.md','COMBAT-FIDELITY.md','RESEARCH.md','HD-GRAPHICS.md','package.json']]
 files += sorted(p for p in (ROOT/'dist').rglob('*') if p.is_file() and p.suffix in ['.mjs','.html','.css'])
 files += [ROOT/'dist/assets/README.md']
 files=sorted(set(files))
 digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 manifest={'version':json.loads((ROOT/'package.json').read_text())['version'],'originalGameAssetsIncluded':False,'generatedHDArtIncluded':True,'rebuildDataArgument':'--data-dir /path/to/owned/original/game','files':{str(p.relative_to(ROOT)):digest(p) for p in files},'binaryOutputs':json.loads((ROOT/'fidelity/native-build.json').read_text())['outputs'],'musicWasmSha256':digest(ROOT/'dist/music/adl.wasm')}
 data=(json.dumps(manifest,indent=2)+'\n').encode()
 target=ROOT/'dist/native/source.tar.gz'
 with target.open('wb') as out,gzip.GzipFile(filename='',mode='wb',fileobj=out,mtime=0) as zipped,tarfile.open(fileobj=zipped,mode='w') as tar:
  for p in files:
   info=tar.gettarinfo(str(p),arcname='dune2/'+str(p.relative_to(ROOT)));info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
   with p.open('rb') as stream:tar.addfile(info,stream)
  info=tarfile.TarInfo('dune2/SOURCE-MANIFEST.json');info.size=len(data);info.mtime=0;tar.addfile(info,io.BytesIO(data))
 (ROOT/'fidelity/source-package.json').write_text(json.dumps({'path':'dist/native/source.tar.gz','files':len(files),'bytes':target.stat().st_size,'sha256':digest(target),'coreOutputs':manifest['binaryOutputs'],'musicWasmSha256':manifest['musicWasmSha256']},indent=2)+'\n')
 print(json.dumps({'files':len(files),'bytes':target.stat().st_size,'sha256':digest(target)}))
if __name__=='__main__':main()
