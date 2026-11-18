#!/usr/bin/env python3
"""Compile the actual HD cache under ASan; verify patch idempotence and desktop syntax."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
compiler=os.environ.get('CC') or shutil.which('clang') or shutil.which('cc')
assert compiler,'C compiler required'
with tempfile.TemporaryDirectory(prefix='dune-hd-cache-') as tmp:
    target=Path(tmp)/'cache'
    subprocess.run([compiler,'-std=c99','-g','-O1','-fsanitize=address',
        '-fno-omit-frame-pointer',str(HERE/'cache-regression.c'),'-o',str(target)],check=True)
    subprocess.run([str(target)],check=True,env={**os.environ,'ASAN_OPTIONS':'detect_leaks=0'})
spec=importlib.util.spec_from_file_location('patch_hd',ROOT/'tools/patch-native-hd.py')
patch=importlib.util.module_from_spec(spec);spec.loader.exec_module(patch)
edits=patch.changes(ROOT/'native/opendune')
assert all(before==after for before,after in edits.values()),'HD patch not idempotent'
for rel in ['src/gui/viewport.c','src/gui/gui.c','src/sprites.c','src/timer.c']:
    subprocess.run([compiler,'-fsyntax-only','-Wno-implicit-function-declaration',
        '-I'+str(ROOT/'native/opendune/include'),'-iquote'+str(ROOT/'native/opendune/src'),
        str(ROOT/'native/opendune'/rel)],check=True)
report={'passed':True,'scope':'actual presentation cache under ASan; no DOS/game execution',
        'patchIdempotent':True,'desktopSyntaxFiles':4,
        'bridgeSha256':hashlib.sha256((ROOT/'native/browser/hd_bridge.c').read_bytes()).hexdigest(),
        'cases':['stationary persistence','camera translation','native insertion painter order',
                 'shadow/body ordering','reticle selection','owner replacement/pruning',
                 'palette/remap copies','bounded per-owner overflow','bounded UI command cache']}
(HERE/'native-cache-results.json').write_text(json.dumps(report,indent=2)+'\n')
print('HD native cache and desktop syntax passed; HD source patch is idempotent')
