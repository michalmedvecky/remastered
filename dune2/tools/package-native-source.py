"""Bundle matching corresponding source in deterministic, download-sized volumes."""
from pathlib import Path
import argparse,hashlib,json,shutil
from source_package import collect_files,make_packages,repack_sdl_source,MAX_PART_BYTES
ROOT=Path(__file__).resolve().parents[1]
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--emscripten',type=Path,help='Optional SDK path to refresh retained dependency source/notices');parser.add_argument('--plan',action='store_true',help='Read-only source size inventory, without creating archives');args=parser.parse_args()
 if args.plan:
  files=collect_files(ROOT);print(json.dumps(dict(files=len(files),sourceBytes=sum((ROOT/p).stat().st_size for p in files),partUncompressedLimit=MAX_PART_BYTES,artV3Included=any(p.startswith('art/hd-v3/')for p in files))));return
 license_dir=ROOT/'native/licenses';license_dir.mkdir(exist_ok=True)
 for src,name in[(ROOT/'native/opendune/COPYING','GPL-2.0.txt'),(ROOT/'native/music/vendor/nuked-opl3/LICENSE','LGPL-2.1.txt')]:shutil.copyfile(src,license_dir/name)
 dependency=ROOT/'native/dependencies';dependency.mkdir(exist_ok=True)
 if args.emscripten:
  sdk=args.emscripten
  for src,name in[(sdk/'cache/ports/sdl2/SDL-release-2.32.10/LICENSE.txt','SDL2.txt'),(sdk/'LICENSE','Emscripten.txt')]:shutil.copyfile(src,license_dir/name)
  shutil.copyfile(sdk/'cache/ports/sdl2.32.10.zip',dependency/'SDL2-2.32.10-source.zip');shutil.copyfile(sdk/'tools/ports/sdl2.py',dependency/'emscripten-sdl2-port.py')
 for p in[license_dir/'SDL2.txt',license_dir/'Emscripten.txt',dependency/'emscripten-sdl2-port.py']:
  if not p.is_file():parser.error('Missing retained dependency '+str(p)+'; refresh with --emscripten /path/to/sdk')
 repack=repack_sdl_source(ROOT);shutil.copytree(license_dir,ROOT/'dist/native/licenses',dirs_exist_ok=True)
 digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();metadata=dict(version=json.loads((ROOT/'package.json').read_text())['version'],binaryOutputs=json.loads((ROOT/'fidelity/native-build.json').read_text())['outputs'],musicWasmSha256=digest(ROOT/'dist/music/adl.wasm'))
 if repack:metadata['dependencySourceRepack']=repack
 package,manifest=make_packages(ROOT,collect_files(ROOT),metadata)
 (ROOT/'fidelity/source-package.json').write_text(json.dumps(package,indent=2)+'\n')
 print(json.dumps(dict(files=len(manifest['files']),mainBytes=package['bytes'],mainSha256=package['sha256'],parts=len(package['artParts']),allArchiveBytes=package['allArchiveBytes'],artParts=package['artParts'])))
if __name__=='__main__':main()
