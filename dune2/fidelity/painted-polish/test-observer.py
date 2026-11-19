#!/usr/bin/env python3
"""ASan regression for the shipped observer; no original DOS execution."""
from pathlib import Path
import hashlib, importlib.util, json, os, shutil, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
cc=os.environ.get('CC') or shutil.which('clang') or shutil.which('cc')
assert cc
with tempfile.TemporaryDirectory(prefix='dune-observer-v2-') as tmp:
    binary=Path(tmp)/'observer'
    raster=(ROOT/'native/opendune/src/gfx.c').read_text()
    tile=raster[raster.index('void GFX_DrawTile('):raster.index('/**\n * Initialize sprite information.')]
    gui=(ROOT/'native/opendune/src/gui/gui.c').read_text()
    start=gui.index('void GUI_DrawBorder(');end=gui.index('\n}\n',start)+3
    border=gui[start:end]
    fixture=(HERE/'raw-tile-fixture.c').read_text().replace('/* ACTUAL_NATIVE_TILE_FUNCTION */',tile).replace('/* ACTUAL_NATIVE_BORDER_FUNCTION */',border)
    test=(HERE/'observer-regression.c').read_text()
    insert=test.index('int main(void)')
    test=test[:insert]+fixture+'\n'+test[insert:]
    test=test.replace('    puts("Observer v2:', '    test_raw_tile_overwrite();\n    test_unfilled_border_preserves_portrait();\n    puts("Observer v2:')
    generated=Path(tmp)/'observer-complete.c'
    # The original test includes the actual bridge by a source-relative path.
    test=test.replace('../../native/browser/hd_bridge.c',str(ROOT/'native/browser/hd_bridge.c'))
    generated.write_text(test)
    subprocess.run([cc,'-std=c99','-O1','-g','-fsanitize=address','-fno-omit-frame-pointer',str(generated),'-o',str(binary)],check=True)
    subprocess.run([str(binary)],check=True,env={**os.environ,'ASAN_OPTIONS':'detect_leaks=0'})
spec=importlib.util.spec_from_file_location('patch_hd',ROOT/'tools/patch-native-hd.py')
patch=importlib.util.module_from_spec(spec);spec.loader.exec_module(patch)
assert all(a==b for a,b in patch.changes(ROOT/'native/opendune').values())
files=['src/gui/viewport.c','src/gui/gui.c','src/gui/widget_draw.c','src/gui/mentat.c','src/gfx.c','src/sprites.c','src/timer.c']
for rel in files:
    subprocess.run([cc,'-fsyntax-only','-Wno-implicit-function-declaration','-I'+str(ROOT/'native/opendune/include'),'-iquote'+str(ROOT/'native/opendune/src'),str(ROOT/'native/opendune'/rel)],check=True)
bridge=(ROOT/'native/browser/hd_bridge.c').read_text()
present=bridge.split('void DuneHD_Present(int screenOffset)',1)[1]
assert 'g_map[' not in present and 'hd_collect(' not in present
assert 's_gameTimer &&' not in present and '&& !s_scope' not in present
refresh=bridge.split('EMSCRIPTEN_KEEPALIVE void dune_hd_refresh(void)',1)[1].split('}',1)[0]
assert refresh.strip()=='{\n    DuneHD_Present(s_lastScreenOffset);'
assert present.index('s_lastScreenOffset=screenOffset')<present.index('hd_wants_frame()')
report={'passed':True,'executedOriginalDosBinary':False,'patchIdempotent':True,'desktopSyntaxFiles':len(files),'bridgeSha256':hashlib.sha256(bridge.encode()).hexdigest(),'actualTileRasterSha256':hashlib.sha256(tile.encode()).hexdigest(),'cases':['scene not published before copy','live map and command isolation','timer pause retains committed world','monotonic revision','copied HUD glyph relocation','same-screen overlap','partial overwrite pixel provenance','transparent copy','transparent font dirty scope','unreferenced-slot recycling preserves long-lived visible labels','mouse and modal buffer backup/restore with reference retention','Present does not read live map or collect live owners','UI sprite exact native writes share copy-aware provenance','verbatim native opaque tile invalidates coincident-index old glyph','transparent native tile preserves unwritten holes','CPS/menu to world metadata transition','verbatim unfilled native border preserves portrait interior through screen copy','pure explicit observer refresh retains last native offset before callback gate']}
(HERE/'observer-results.json').write_text(json.dumps(report,indent=2)+'\n')
print('Observer v2 transaction/provenance/patch/syntax checks passed')
