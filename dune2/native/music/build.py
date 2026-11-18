#!/usr/bin/env python3
"""Build the licensed native ADL interpreter and OPL emulator to WebAssembly."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import tempfile

HERE=Path(__file__).resolve().parent
WEB=HERE.parents[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--emcc",default="emcc")
    parser.add_argument("--emxx",default="em++")
    args=parser.parse_args()
    subprocess.run(["python3",str(WEB/"tools/stamp-native-changes.py"),"--write"],check=True)
    output=WEB/"dist/music/adl.wasm"
    output.parent.mkdir(parents=True,exist_ok=True)
    exports=["malloc","free","adl_init","adl_load","adl_stop","adl_effect","adl_playing","adl_output","adl_ticks","adl_writes","adl_render"]
    with tempfile.TemporaryDirectory(prefix="dune-adl-build-") as temporary:
        obj=Path(temporary)/"opl3.o"
        first=[args.emcc,"-O3","-c",str(HERE/"vendor/nuked-opl3/opl3.c"),"-o",str(obj)]
        second=[args.emxx,"-std=c++17","-O3",str(HERE/"renderer.cpp"),str(HERE/"vendor/adplug/adl.cpp"),str(obj),
            "--no-entry","-sSTANDALONE_WASM=1","-sFILESYSTEM=0","-sALLOW_MEMORY_GROWTH=1",
            "-sINITIAL_MEMORY=4194304","-sSTACK_SIZE=262144","-sASSERTIONS=0",
            "-sEXPORTED_FUNCTIONS="+json.dumps(["_"+symbol for symbol in exports]),"-o",str(output)]
        for command in [first,second]: subprocess.run(command,check=True)
    manifest={"scope":"Newly compiled licensed source only; no DOS/EXE interpreter",
        "adplug_commit":"3d9457ac91121302a752577b2bf063b4aea202b8",
        "compiler":subprocess.check_output([args.emcc,"--version"],text=True).splitlines()[0],
        "commands":[first,second],"exports":exports,"output_bytes":output.stat().st_size,
        "output_sha256":hashlib.sha256(output.read_bytes()).hexdigest(),
        "source_sha256":{str(path.relative_to(HERE)):hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(HERE.rglob("*")) if path.is_file() and path.suffix in (".c",".cpp",".h")}}
    (HERE/"build-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print(json.dumps({key:manifest[key] for key in ["compiler","output_bytes","output_sha256"]},indent=2))


if __name__=="__main__": main()
