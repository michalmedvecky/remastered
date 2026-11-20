"""Deterministic corresponding-source volumes with strict, extraction-safe verification."""
from pathlib import Path,PurePosixPath
import gzip,hashlib,html,io,json,os,posixpath,stat,tarfile,tempfile,zipfile
MAX_PART_BYTES=48*1024*1024
FORBIDDEN={'.zip','.exe','.com','.pak'}
SHA=lambda b:hashlib.sha256(b).hexdigest()
def safe_name(name):
 if not isinstance(name,str)or not name or '\\'in name or any(ord(c)<32 for c in name):raise ValueError('Unsafe source path: '+repr(name))
 p=PurePosixPath(name)
 if p.is_absolute()or any(c in ('','..','.')for c in name.split('/'))or ':'in p.parts[0]:raise ValueError('Unsafe source path: '+name)
 return p

def regular_bytes(root,name):
 safe_name(name);root=Path(root).resolve();p=root/name
 if not p.resolve().is_relative_to(root)or p.is_symlink()or not p.is_file():raise ValueError('Source is not a contained regular file: '+name)
 return p.read_bytes()

def tar_bytes(rows):
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode='w',format=tarfile.PAX_FORMAT)as tar:
  for name,data,mode in rows:
   safe_name(name);info=tarfile.TarInfo(name);info.size=len(data);info.mode=mode;info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0;tar.addfile(info,io.BytesIO(data))
 return out.getvalue()

def write_volume(path,rows):
 raw=tar_bytes(rows);data=gzip.compress(raw,compresslevel=9,mtime=0)
 # gzip.compress may expose a platform OS byte on older Python; normalize it.
 data=data[:9]+b'\xff'+data[10:];path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_name(path.name+'.tmp');temp.write_bytes(data);temp.replace(path)
 return dict(sha256=SHA(data),bytes=len(data),uncompressedBytes=len(raw),unpackedBytes=sum(len(r[1])for r in rows),files=len(rows))

def repack_sdl_source(root):
 """Retain actual SDL source as tar.gz; no ZIP or symlink member in public source."""
 root=Path(root);source=root/'native/dependencies/SDL2-2.32.10-source.zip';target=root/'native/dependencies/SDL2-2.32.10-source.tar.gz'
 if not source.exists():
  if not target.is_file():raise ValueError('Missing retained SDL source archive')
  return None
 regular={};links=[]
 with zipfile.ZipFile(source)as z:
  for info in z.infolist():
   name=info.filename.rstrip('/');safe_name(name)
   if info.is_dir():continue
   if PurePosixPath(name).suffix.lower()in FORBIDDEN:raise ValueError('Forbidden nested SDL source member '+name)
   if (info.external_attr>>16)&0o170000==0o120000:links.append((name,z.read(info).decode('utf8')))
   else:regular[name]=(z.read(info),0o755 if(info.external_attr>>16)&0o111 else 0o644)
 for name,destination in links:
  target_name=posixpath.normpath(posixpath.join(posixpath.dirname(name),destination));safe_name(target_name)
  if target_name.split('/')[0]!=name.split('/')[0]:raise ValueError('SDL link escapes dependency root')
  matches=[(p,v)for p,v in regular.items()if p==target_name or p.startswith(target_name+'/')]
  if not matches:raise ValueError('Missing SDL link target '+name)
  for p,value in matches:regular[name+p[len(target_name):]]=value
 rows=[(name,data,mode)for name,(data,mode)in sorted(regular.items())];metadata=write_volume(target,rows)
 return dict(source='native/dependencies/SDL2-2.32.10-source.zip',sourceSha256=SHA(source.read_bytes()),retained='native/dependencies/SDL2-2.32.10-source.tar.gz',**metadata,materializedSafeLinks=len(links))

def collect_files(root):
 root=Path(root);files=set()
 for directory in ['native','tools','fidelity','tests','art/hd-v2','art/hd-v3','art/localization']:
  for p in(root/directory).rglob('*'):
   if not p.is_file():continue
   name=p.relative_to(root).as_posix()
   if name=='fidelity/source-package.json'or name.startswith('native/data/')or name.startswith('dist/native/'):continue
   if '__pycache__'in p.parts or '.DS_Store'in p.parts or p.suffix.lower()in FORBIDDEN|{'.pyc'}:continue
   if p.is_symlink():raise ValueError('Source symlink refused '+name)
   files.add(name)
 for name in ['README.md','FIDELITY.md','COMBAT-FIDELITY.md','RESEARCH.md','HD-GRAPHICS.md','package.json','dist/assets/README.md','dist/assets/content.json','dist/assets/planet.png','dist/native/SOURCE-README.md']:
  if(root/name).is_file():files.add(name)
 for p in(root/'dist').rglob('*'):
  if p.is_file()and p.suffix in['.mjs','.html','.css']:files.add(p.relative_to(root).as_posix())
 for p in(root/'dist/fonts').rglob('*'):
  if p.is_file()and p.suffix.lower()in['.woff','.json']:files.add(p.relative_to(root).as_posix())
 for p in(root/'dist/locales').rglob('*'):
  if p.is_file()and p.suffix.lower()in['.json','.eng','.fnt','.cps','.shp']:files.add(p.relative_to(root).as_posix())
 for p in(root/'dist/painted').rglob('*'):
  if p.is_file()and p.suffix in['.png','.json']:files.add(p.relative_to(root).as_posix())
 return sorted(files)

def material_file(name):
 return name.startswith('dist/painted/')and name.endswith('.png')or name.startswith('art/')and PurePosixPath(name).suffix.lower()not in{'.json','.md','.txt','.mjs','.js','.py','.svg','.csv'}

def make_packages(root,files,metadata,limit=MAX_PART_BYTES):
 """Build parts first, then main manifest. Library entry point also supports fixtures."""
 root=Path(root).resolve();public=root/'dist/native';public.mkdir(parents=True,exist_ok=True);contents={name:regular_bytes(root,name)for name in sorted(set(files))};modes={name:0o755 if(root/name).stat().st_mode&0o111 else 0o644 for name in contents}
 materials=[name for name in contents if material_file(name)];groups=[];current=[];cost=10240
 for name in materials:
  size=len(contents[name]);estimate=512+((size+511)//512)*512+(1024 if len(('dune2/'+name).encode())>100 else 0)
  if estimate+10240>limit:raise ValueError('Single art source exceeds volume limit: '+name)
  if current and cost+estimate>limit:groups.append(current);current=[];cost=10240
  current.append(name);cost+=estimate
 if current:groups.append(current)
 parts=[];file_archives={};archive_members={}
 for i,names in enumerate(groups,1):
  tmp=public/('source-art-%02d.tmp.tar.gz'%i);part=write_volume(tmp,[('dune2/'+name,contents[name],modes[name])for name in names])
  if part['uncompressedBytes']>limit:raise ValueError('Actual uncompressed art volume exceeds limit')
  filename='source-art-%02d-%s.tar.gz'%(i,part['sha256'][:16]);tmp.replace(public/filename);part.update(archive=filename,path='dist/native/'+filename,src='native/'+filename);parts.append(part);archive_members[filename]=names
  for name in names:file_archives[name]=filename
 # Source landing documents are generated before the main manifest so their own
 # exact bytes are included without a digest cycle with SOURCE-PACKAGE.json.
 links='\n'.join('- [%s](%s) — %s bytes, SHA256 `%s`'%(p['archive'],p['archive'],p['bytes'],p['sha256'])for p in parts)
 readme=('# Complete corresponding source\n\nDownload [source.tar.gz](source.tar.gz) and every art volume listed below into one directory. The original source.tar.gz URL remains the main code, licenses, prompts and manifests archive. The parts contain exact large artwork/reference inputs and matching painted runtime PNGs.\n\n'+links+'\n\nExtract source.tar.gz and each art volume into the same empty directory; all entries live below dune2/. Run `python3 dune2/tools/verify-source-package.py --archives-dir /path/to/downloads --root dune2` to verify the complete reconstructed source against SOURCE-MANIFEST.json. The verifier rejects unsafe paths, links, duplicate or unexpected members, missing parts and modified bytes. Source packages contain no original game ZIP, EXE, COM or PAK files. Native rebuilds still require your own game data.\n\nSOURCE-MANIFEST.json records every file, its volume, size, mode and hash. SOURCE-PACKAGE.json describes the published main archive and all content-addressed volumes. UI coverage statuses distinguish paintings, derivatives, original aliases, analytic shapes, text and empty native slots; WSA movie coverage is separately documented.\n')
 (public/'SOURCE-README.md').write_text(readme)
 items=''.join('<li><a download href="%s">%s</a> (%s bytes)<br><code>%s</code></li>'%(html.escape(p['archive']),html.escape(p['archive']),p['bytes'],p['sha256'])for p in parts)
 page='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Dune II complete corresponding source</title><style>body{font:17px/1.6 system-ui;max-width:60rem;margin:3rem auto;padding:0 1.2rem;background:#151719;color:#eee}a{color:#ecc66d}code{overflow-wrap:anywhere}li{margin:1rem 0}</style><h1>Complete corresponding source</h1><p>Download the main archive and every artwork volume. Extract all of them into the same empty directory. Each archive contains paths under <code>dune2/</code>.</p><p><a download href="source.tar.gz">Main source.tar.gz: code, licenses, prompts and manifests</a></p><ul>'+items+'</ul><p><a href="SOURCE-PACKAGE.json">Archive hashes and sizes</a> · <a href="SOURCE-README.md">Reconstruction and verification instructions</a> · <a href="../">Back to game</a></p><p>The source manifest lists exact file hashes and original indexed evidence. Original game ZIP/EXE/COM/PAK files are excluded; owners provide their own game data for a rebuild.</p></html>\n'
 (public/'source.html').write_text(page)
 for name in ['dist/native/SOURCE-README.md','dist/native/source.html']:
  contents[name]=(root/name).read_bytes();modes[name]=0o644
 main_names=[name for name in sorted(contents)if name not in file_archives]
 for name in main_names:file_archives[name]='source.tar.gz'
 archive_members['source.tar.gz']=sorted(main_names+['SOURCE-MANIFEST.json'])
 manifest=dict(metadata,schema=2,originalGameArchivesIncluded=False,decodedOriginalArtReferencesIncluded=True,generatedPaintedArtIncluded=True,rebuildDataArgument='--data-dir /path/to/owned/original/game',files={name:SHA(b)for name,b in sorted(contents.items())},fileSizes={name:len(b)for name,b in sorted(contents.items())},fileModes=dict(sorted(modes.items())),fileArchives=dict(sorted(file_archives.items())),archiveMembers=dict(sorted(archive_members.items())),artParts=parts,partUncompressedLimit=limit)
 data=(json.dumps(manifest,indent=2)+'\n').encode();main=write_volume(public/'source.tar.gz',[('dune2/'+name,contents[name],modes[name])for name in main_names]+[('dune2/SOURCE-MANIFEST.json',data,0o644)])
 if main['bytes']>=100_000_000:raise ValueError('Main source archive exceeds repository file limit; move additional large inputs into volumes')
 package=dict(schema=2,version=metadata.get('version'),path='dist/native/source.tar.gz',src='native/source.tar.gz',**main,coreOutputs=metadata.get('binaryOutputs',{}),musicWasmSha256=metadata.get('musicWasmSha256'),manifestSha256=SHA(data),artParts=parts,partUncompressedLimit=limit,sourceIndex='dist/native/source.html',sourceReadme='dist/native/SOURCE-README.md',allArchiveBytes=main['bytes']+sum(p['bytes']for p in parts))
 # main.files includes the manifest; retain legacy files meaning source-file count.
 package['files']=len(contents)
 (public/'SOURCE-PACKAGE.json').write_text(json.dumps(package,indent=2)+'\n')
 active={p['archive']for p in parts}
 for p in public.glob('source-art-*-*.tar.gz'):
  if p.name not in active:p.unlink()
 return package,manifest

def read_archive(path,max_uncompressed=512*1024*1024):
 """Read regular members only, without using tar extraction primitives."""
 members={}
 with gzip.open(path,'rb')as stream:raw=stream.read(max_uncompressed+1)
 if len(raw)>max_uncompressed:raise ValueError('Source archive exceeds uncompressed bound')
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:')as tar:
  for info in tar:
   safe_name(info.name)
   if not info.name.startswith('dune2/')or not info.isfile()or info.issym()or info.islnk()or info.mode not in(0o644,0o755):raise ValueError('Unexpected source archive member/type '+info.name)
   name=info.name[len('dune2/'):];safe_name(name)
   if name in members:raise ValueError('Duplicate source archive member '+name)
   if PurePosixPath(name).suffix.lower()in FORBIDDEN:raise ValueError('Forbidden source archive member '+name)
   members[name]=(tar.extractfile(info).read(),info.mode)
 return members

def verify_packages(root,archives_dir=None,extract_to=None,check_current=True):
 root=Path(root).resolve();public=Path(archives_dir).resolve()if archives_dir else root/'dist/native';package_path=public/'SOURCE-PACKAGE.json';package=json.loads(package_path.read_text())if package_path.exists()else None
 main=read_archive(public/'source.tar.gz')
 if 'SOURCE-MANIFEST.json'not in main:raise ValueError('Main source manifest missing')
 manifest_bytes=main['SOURCE-MANIFEST.json'][0];manifest=json.loads(manifest_bytes)
 if manifest.get('schema')!=2:raise ValueError('Expected split corresponding-source schema2')
 files=manifest['files'];archives=manifest['fileArchives'];sizes=manifest['fileSizes'];modes=manifest['fileModes'];expected_members=manifest['archiveMembers']
 if set(files)!=set(archives)or set(files)!=set(sizes)or set(files)!=set(modes):raise ValueError('Source manifest key coverage differs')
 if manifest.get('originalGameArchivesIncluded')is not False:raise ValueError('Original game archive claim is invalid')
 if not isinstance(manifest['partUncompressedLimit'],int)or not 0<manifest['partUncompressedLimit']<=MAX_PART_BYTES:raise ValueError('Invalid source volume bound')
 parts=manifest['artParts'];part_names={p['archive']for p in parts}
 if len(part_names)!=len(parts)or set(expected_members)!={'source.tar.gz',*part_names}:raise ValueError('Source volume coverage differs')
 if {p.name for p in public.glob('source-art-*.tar.gz')}!=part_names:raise ValueError('Unexpected or missing source volumes on disk')
 if package:
  if package.get('schema')!=2 or package.get('manifestSha256')!=SHA(manifest_bytes)or package.get('artParts')!=parts or package.get('partUncompressedLimit')!=manifest['partUncompressedLimit']:raise ValueError('Public source metadata differs')
  main_data=(public/'source.tar.gz').read_bytes()
  if SHA(main_data)!=package['sha256']or len(main_data)!=package['bytes']or package['files']!=len(files):raise ValueError('Main source archive digest/metrics differ')
 union={};part_map={p['archive']:p for p in parts}
 for archive in ['source.tar.gz']+sorted(part_names):
  safe_name(archive)
  if '/'in archive:raise ValueError('Source volume path must be a filename')
  path=public/archive;members=main if archive=='source.tar.gz'else read_archive(path,manifest['partUncompressedLimit'])
  if set(members)!=set(expected_members[archive])or len(expected_members[archive])!=len(set(expected_members[archive])):raise ValueError('Unexpected or missing source members in '+archive)
  if archive!='source.tar.gz':
   p=part_map[archive];b=path.read_bytes()
   if p['path']!='dist/native/'+archive or p['src']!='native/'+archive:raise ValueError('Unsafe source volume URL '+archive)
   if SHA(b)!=p['sha256']or len(b)!=p['bytes']or p['archive']!='source-art-'+p['archive'].split('-')[2]+'-'+p['sha256'][:16]+'.tar.gz':raise ValueError('Art volume content address differs '+archive)
   with gzip.open(path,'rb')as stream:uncompressed=len(stream.read(manifest['partUncompressedLimit']+1))
   if uncompressed!=p['uncompressedBytes']or uncompressed>manifest['partUncompressedLimit']:raise ValueError('Art volume uncompressed size differs/exceeds limit')
   if sum(len(v[0])for v in members.values())!=p['unpackedBytes']or len(members)!=p['files']:raise ValueError('Art volume member metrics differ')
  for name,(data,mode)in members.items():
   if name=='SOURCE-MANIFEST.json':continue
   if name in union:raise ValueError('Duplicate source file across volumes '+name)
   if archives.get(name)!=archive or sizes.get(name)!=len(data)or files.get(name)!=SHA(data)or modes.get(name)!=mode:raise ValueError('Source member bytes/assignment differ '+name)
   union[name]=data
 if set(union)!=set(files):raise ValueError('Corresponding-source union incomplete')
 if check_current:
  current=set(collect_files(root))
  if current!=set(files):raise ValueError('Current corresponding-source coverage differs: '+str(sorted(current^set(files))[:12]))
  for name,data in union.items():
   if regular_bytes(root,name)!=data:raise ValueError('Current source bytes differ '+name)
 # Reconstruct the complete source tree with validated names, then hash it again.
 temp=None
 if extract_to is None:temp=tempfile.TemporaryDirectory(prefix='dune2-corresponding-source-');destination=Path(temp.name)
 else:
  destination=Path(extract_to).resolve()
  if destination.exists()and any(destination.iterdir()):raise ValueError('Reconstruction destination must be empty')
  destination.mkdir(parents=True,exist_ok=True)
 for name,data in union.items():
  target=destination/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);os.chmod(target,modes[name])
 for name,digest in files.items():
  if SHA((destination/name).read_bytes())!=digest:raise ValueError('Reconstructed source digest differs '+name)
 (destination/'SOURCE-MANIFEST.json').write_bytes(manifest_bytes)
 result=dict(schema=2,files=len(files),parts=len(parts),reconstructedBytes=sum(sizes.values()),allCurrentBytesChecked=check_current,manifestSha256=SHA(manifest_bytes))
 if temp:temp.cleanup()
 return result
