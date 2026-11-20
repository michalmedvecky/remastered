#!/usr/bin/env python3
"""Bounded native observer/LevelEnd regression; never executes the DOS game."""
from pathlib import Path
import hashlib,importlib.util,json,os,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
cc=os.environ.get('CC')or shutil.which('clang')or shutil.which('cc');assert cc
source=(ROOT/'native/opendune/src/opendune.c').read_text();start=source.index('static void GameLoop_LevelEnd(void)');end=source.index('static void GameLoop_DrawMenu(',start);level=source[start:end]
assert level.count('DuneHD_WorldModal(1)')==1 and level.count('DuneHD_WorldModal(0)')==2
assert level.index('DuneHD_WorldModal(1)')<level.index('GUI_ChangeSelectionType(SELECTIONTYPE_MENTAT)')
for outcome in ['Win','Lose']:
 marker=level.index('GUI_Mentat_Show'+outcome+'()');assert level.rfind('DuneHD_WorldModal(0)',0,marker)>level.rfind('GUI_DisplayModalMessage(',0,marker)
with tempfile.TemporaryDirectory(prefix='dune-world-modal-')as folder:
 generated=Path(folder)/'test.c';binary=Path(folder)/'test'
 fixture=(HERE/'world-modal-regression.c').read_text().replace('../../native/browser/hd_bridge.c',str(ROOT/'native/browser/hd_bridge.c')).replace('/* ACTUAL_NATIVE_LEVEL_END */',level)
 generated.write_text(fixture)
 subprocess.run([cc,'-std=gnu99','-O1','-g','-fsanitize=address','-fno-omit-frame-pointer',str(generated),'-o',str(binary)],check=True)
 subprocess.run([str(binary)],check=True,env={**os.environ,'ASAN_OPTIONS':'detect_leaks=0'})
spec=importlib.util.spec_from_file_location('world_modal_patch',ROOT/'tools/patch-native-hd.py');patch=importlib.util.module_from_spec(spec);spec.loader.exec_module(patch)
assert all(before==after for before,after in patch.changes(ROOT/'native/opendune').values())
subprocess.run([cc,'-fsyntax-only','-Wno-implicit-function-declaration','-I'+str(ROOT/'native/opendune/include'),'-iquote'+str(ROOT/'native/opendune/src'),str(ROOT/'native/opendune/src/opendune.c')],check=True)
report=dict(passed=True,executedOriginalDosBinary=False,actualLevelEndSha256=hashlib.sha256(level.encode()).hexdigest(),bridgeSha256=hashlib.sha256((ROOT/'native/browser/hd_bridge.c').read_bytes()).hexdigest(),patchIdempotent=True,cases=['actual victory branch and modal selection transition','actual defeat branch and modal selection transition','committed tiles/commands unchanged despite ahead-of-raster mutations','paused timer retains explicit modal world','actual Mentat and stats/map hide old world after scope exits','missing committed world fails closed','game mode/menu and credits offsets fail closed','explicit Mentat replacement beats modal scope','scene reset clears scope and extra leave does not underflow'])
(HERE/'world-modal-results.json').write_text(json.dumps(report,indent=2)+'\n')
