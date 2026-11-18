#!/usr/bin/env python3
"""ASan regression using the shipped continuation WSA resources and actual C loader."""
from pathlib import Path
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import sys

WEB=Path(__file__).resolve().parents[2]
SRC=WEB/"native/opendune/src"
sys.path.insert(0,str(WEB/"tools"))
from preload_data import read_pak
spec=importlib.util.spec_from_file_location("wsa_patch",WEB/"tools/patch-native-wsa.py")
patcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(patcher)
source=(SRC/"wsa.c").read_text()
assert patcher.patch(source)==source
assert patcher.patch(patcher.patch(source))==source
cc=os.environ.get("CC") or shutil.which("clang") or shutil.which("cc")
assert cc,"a C compiler is required for the native WSA ASan regression"
inventory=json.loads((WEB/"fidelity/wsa/resource-fixtures.json").read_text())["records"]
names={"INTRO7A.WSA","INTRO7B.WSA","INTRO8B.WSA","INTRO8C.WSA",
       "HFINALC.WSA","OFINALB.WSA","OFINALC.WSA"}
with tempfile.TemporaryDirectory(prefix="dune-wsa-regression-") as tmp:
    out=Path(tmp);found=set()
    for row in inventory:
        member=read_pak(row["archive"])[row["name"].upper()]
        assert member["offset"]==row["offset"] and member["size"]==row["size"]
        assert member["sha256"]==row["sha256"]
        (out/row["name"].upper()).write_bytes(member["bytes"]);found.add(row["name"].upper())
    assert found==names
    common=[cc,"-g","-O1","-fsanitize=address","-fno-omit-frame-pointer",
            "-I"+str(SRC.parent/"include"),"-iquote"+str(SRC)]
    subprocess.run(common+["-DFormat80_Decode=QA_Format80_Decode","-c",str(SRC/"wsa.c"),"-o",str(out/"wsa.o")],check=True)
    subprocess.run(common+[str(Path(__file__).with_name("regression.c")),str(out/"wsa.o"),
                          str(SRC/"codec/format80.c"),str(SRC/"codec/format40.c"),"-o",str(out/"test-wsa")],check=True)
    subprocess.run([str(out/"test-wsa"),str(out)],check=True,
                   env=dict(os.environ,ASAN_OPTIONS="detect_leaks=0"))
print("native WSA: all 6 shipped continuations + normal first frame/deltas passed ASan; patch is idempotent")
