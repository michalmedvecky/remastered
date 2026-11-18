#!/usr/bin/env python3
"""Run the real native INI parser against exact-sized heap input under ASan."""
from pathlib import Path
import importlib.util
import os
import shutil
import subprocess
import tempfile

WEB = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("ini_patch", WEB / "tools/patch-native-ini.py")
patcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patcher)
source = WEB / "native/opendune/src/ini.c"
text = source.read_text()
assert patcher.patch(text) == text, "native INI patch was not applied"
assert patcher.patch(patcher.patch(text)) == text, "INI patch is not idempotent"
cc = os.environ.get("CC") or shutil.which("clang") or shutil.which("cc")
assert cc, "a C compiler is required for the native INI ASan regression"
with tempfile.TemporaryDirectory(prefix="dune-ini-regression-") as tmp:
    exe = Path(tmp) / "test-ini"
    subprocess.run([cc, "-g", "-O1", "-fsanitize=address", "-fno-omit-frame-pointer", "-Wno-deprecated-declarations",
                    "-I" + str(WEB / "native/opendune/include"),
                    "-iquote" + str(WEB / "native/opendune/src"),
                    str(source), str(Path(__file__).with_name("regression.c")),
                    "-o", str(exe)], check=True)
    subprocess.run([str(exe)], check=True,
                   env=dict(os.environ, ASAN_OPTIONS="detect_leaks=0"))
print("native INI: 8 exact-allocation ASan cases passed; patch is idempotent")
