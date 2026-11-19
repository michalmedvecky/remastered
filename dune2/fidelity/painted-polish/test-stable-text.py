#!/usr/bin/env python3
"""Compile actual observer helpers and execute actual EM_JS over C snapshots."""
from pathlib import Path
import os,shutil,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
cc=os.environ.get('CC')or shutil.which('clang')or shutil.which('cc')
with tempfile.TemporaryDirectory(prefix='dune-stable-text-')as folder:
 binary=Path(folder)/'runs';fixture=Path(folder)/'runs.bin'
 subprocess.run([cc,'-std=c99','-O1','-g','-fsanitize=address','-fno-omit-frame-pointer',str(HERE/'stable-text-regression.c'),'-o',str(binary)],check=True)
 subprocess.run([str(binary),str(fixture)],check=True,env={**os.environ,'ASAN_OPTIONS':'detect_leaks=0'})
 subprocess.run(['node',str(HERE/'test-stable-text-abi.mjs'),str(fixture)],check=True)
