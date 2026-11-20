#!/usr/bin/env python3
"""Prepare temporary visible mission-modal QA using copies of production hosts.

Uses the same rebuilt WASM, renderer and Czech resources. The only scenario
changes are documented virtual-FS keys; the original PAK and production hosts
are never written. This prepares a bounded presentation experiment, not a
claim of original gameplay/timing equivalence. It does not launch a browser,
server, emulator, game or original DOS executable.
"""
import base64,hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
from preload_data import verify_preload,read_pak
sha=lambda b:hashlib.sha256(b).hexdigest()
preload=verify_preload();source=read_pak('SCENARIO.PAK')['SCENA001.INI'];original=source['bytes'];lines=original.splitlines(keepends=True);section=None;changes=[];found=set();wanted={('BASIC','WinFlags'):('6','4'),('BASIC','LoseFlags'):('4','4'),('Atreides','Quota'):('1000','1')}
for i,line in enumerate(lines):
 stripped=line.strip();match=re.fullmatch(rb'\[([^\]]+)\]',stripped)
 if match:section=match[1].decode('ascii');continue
 for (target,key),(expected,value)in wanted.items():
  if section!=target:continue
  match=re.fullmatch(rb'(\s*'+key.encode()+rb'\s*=\s*)(-?\d+)([^\r\n]*)(\r?\n)?',line)
  if not match:continue
  assert (target,key)not in found;found.add((target,key));before=match[2].decode('ascii');assert before==expected,(target,key,before,expected)
  after=match[1]+value.encode()+match[3]+(match[4]or b'');lines[i]=after
  changes.append(dict(section=target,key=key,original=before,qa=value,changed=before!=value))
assert found==set(wanted)
scenario=b''.join(lines);assert scenario!=original
index=(ROOT/'dist/index.html').read_bytes();host=(ROOT/'dist/native-host.mjs').read_bytes();html=index.decode();script=host.decode()
def replace_once(text,old,new):
 assert text.count(old)==1,(old,text.count(old));return text.replace(old,new,1)
html=replace_once(html,'src="native-host.mjs"','src="modal-qa-host.mjs"')
html=replace_once(html,'id="play-intro" checked','id="play-intro"')
warning='<aside id="qa-warning" style="padding:10px 16px;background:#673609;color:#fff0c7;font:700 14px/1.4 sans-serif;border-bottom:2px solid #d9aa4b">QA ONLY · Mission-modal presentation test · 16× native clock · Atreides mission1 quota1 · Original PAK unchanged · Separate browser origin/save storage required</aside>'
diagnostics='<details style="padding:6px 16px;background:#171b20;color:#d4d8de"><summary>QA observer diagnostics</summary><pre id="qa-result" style="white-space:pre-wrap;font:12px monospace">Waiting for the native renderer.</pre></details>'
html=replace_once(html,'<body>','<body>'+warning+diagnostics)
script=replace_once(script,'duneClock:gameClock.now','duneClock:()=>gameClock.now()*16')
script=replace_once(script,'    applyNativeLocale(core,localeData);','    applyNativeLocale(core,localeData);\n    // QA ONLY: virtual loose file before native File_Init; original PAK unchanged.\n    core.FS.writeFile(\'/data/SCENA001.INI\',Uint8Array.from(atob(\''+base64.b64encode(scenario).decode()+'\'),c=>c.charCodeAt(0)));')
script=replace_once(script,'duneHdPresent:frame=>painter?.present(frame)',"duneHdPresent:frame=>{painter?.present(frame);const q=document.getElementById('qa-result');if(q)q.textContent=JSON.stringify({qaOnly:true,clockMultiplier:16,scenario:'SCENA001.INI quota1/WinFlags4/LoseFlags4',locale:localeData.locale,gameTick:frame.gameTick,worldVisible:frame.worldVisible,worldAvailable:frame.worldAvailable,worldRevision:frame.worldRevision,gameplayActive:frame.gameplayActive,viewport:frame.viewport,selection:frame.selection,committedCommands:frame.commands.length,painted:painter?.diagnostics?.()},null,2);}")
for name,body in [('modal-qa.html',html),('modal-qa-host.mjs',script)]: (ROOT/'dist'/name).write_text(body)
build=json.loads((ROOT/'fidelity/native-build.json').read_text())
report=dict(schema=1,purpose='Bounded live browser mission-modal presentation experiment; no claim of original timing/rule equivalence',preparedOnly=True,executedOriginalDosBinary=False,startsServer=False,launchesBrowser=False,productionFilesModified=False,clockMultiplier=16,skipIntroDefault=True,source=dict(preloadSHA256=preload['packageSha256'],scenarioArchive='SCENARIO.PAK',scenarioArchiveSHA256=next(f['sha256']for f in preload['files']if f['name']=='SCENARIO.PAK'),scenarioMember='SCENA001.INI',scenarioMemberSHA256=source['sha256'],indexSHA256=sha(index),hostSHA256=sha(host),nativeBuildOutputs=build['outputs']),virtualScenario=dict(originalBytes=len(original),qaBytes=len(scenario),qaSHA256=sha(scenario),controlledKeys=changes,allOtherBytesPreserved=True),temporaryFiles=[dict(path='dist/'+name,sha256=sha((ROOT/'dist'/name).read_bytes()))for name in ['modal-qa.html','modal-qa-host.mjs']],instructions=['Serve the current dist directory on an isolated loopback origin such as port6003; do not reuse production origin/save storage.','Open modal-qa.html visibly. Keep Čeština and HD, skip intro, launch normally, select Atreides and advance Cyril through the visible buttons.','Wait approximately8 seconds of visible native gameplay for its minimum7200 game ticks at the QA-only16x clock. Do not call hidden game functions.','Capture success modal with worldVisible:true and a painted map/HUD; advance via the visible native modal input and verify actual WIN1 advisor has worldVisible:false.','Remove dist/modal-qa.html and dist/modal-qa-host.mjs before release packaging. Retain this generator and evidence report.'])
(ROOT/'fidelity/painted-polish/modal-browser-harness.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(prepared=True,temporaryFiles=[r['path']for r in report['temporaryFiles']],scenarioOriginalSHA256=source['sha256'],scenarioQaSHA256=sha(scenario),controlledKeys=changes,clockMultiplier=16,executesOriginalDos=False),indent=2))
