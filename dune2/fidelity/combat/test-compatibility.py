#!/usr/bin/env python3
"""Test new C against literal instruction-semantics models; never run DOS code."""
from pathlib import Path
import argparse
import ctypes
import hashlib
import json
import random
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent


def word(value):
    return value & 65535


def signed(value):
    return (value & 32767) - (value & 32768)


def speed_register_model(normal, low, high, inverse, setting):
    # Literal register operations from 0x15d2f, with signed CMP and SAR.
    dx, cx, si = normal, low, high
    if setting == 2:
        return dx
    ax = word(dx << 1)
    if signed(ax) < signed(si):
        si = ax
    ax = word(signed(dx) >> 1)
    if signed(ax) > signed(cx):
        cx = ax
    di = word(signed(word(dx - cx)) >> 1)
    local = word(signed(word(si - dx)) >> 1)
    index = word(4 - setting) if inverse else setting
    if index == 0:
        dx = word(dx - di)
    if index in (0, 1):
        dx = word(dx - di)
    if index == 4:
        dx = word(dx + local)
    if index in (3, 4):
        dx = word(dx + local)
    ax = dx if signed(dx) < signed(si) else si
    dx = ax
    ax = dx if signed(dx) > signed(cx) else cx
    return ax


def ratio_register_model(numerator, denominator):
    # 0x786e5: construct DX:AX, ADD/ADC, SHR/RCR, word ADD/SHR, DIV.
    ax = word(numerator << 8)
    dx = numerator >> 8
    bx = denominator
    while dx != 0:
        total = ax + 1
        ax = word(total)
        dx = word(dx + (total >> 16))
        carry = dx & 1
        dx >>= 1
        ax = (ax >> 1) | (carry << 15)
        bx = word(bx + 1) >> 1
    return 65535 if bx == 0 else ax // bx


def scale_register_model(value, factor):
    # 0x786b9: MUL, ADD AX,128; ADC DX,0; assemble AH:DL; saturate DH.
    product = value * factor
    ax, dx = product & 65535, product >> 16
    total = ax + 128
    ax = word(total)
    dx = word(dx + (total >> 16))
    return 65535 if dx >> 8 else (ax >> 8) | ((dx & 255) << 8)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path)
    args = parser.parse_args()
    source = args.source_root.resolve()
    rng = random.Random(0xD207)
    checked = {"speed": 0, "ratio": 0, "scale": 0}
    with tempfile.TemporaryDirectory(prefix="dune107-test-") as temporary:
        work = Path(temporary)
        wrapper = work / "wrapper.c"
        wrapper.write_text('#include "dune107.h"\n'
            'uint16 speed(uint16 n,uint16 l,uint16 h,bool i,uint16 s){return Dune107_AdjustToGameSpeed(n,l,h,i,s);}\n'
            'uint16 ratio(uint16 n,uint16 d){return Dune107_Ratio(n,d);}\n'
            'uint16 scale(uint16 n,uint16 d){return Dune107_Scale(n,d);}\n')
        library = work / "arithmetic.dylib"
        subprocess.run(["clang", "-std=c99", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC",
            "-I", str(HERE), "-I", str(source / "include"), str(wrapper), "-o", str(library)], check=True)
        native = ctypes.CDLL(str(library))
        native.speed.argtypes = [ctypes.c_ushort] * 3 + [ctypes.c_ubyte, ctypes.c_ushort]
        native.ratio.argtypes = native.scale.argtypes = [ctypes.c_ushort, ctypes.c_ushort]
        native.speed.restype = native.ratio.restype = native.scale.restype = ctypes.c_ushort
        cases = [(30,15,60), (5,1,10), (4,2,8), (10800,5400,21600), (240,1,255), (1,1,255),
                 (32767,0,65535), (32768,65535,32768), (65535,0,65535)]
        cases += [(rng.randrange(65536), rng.randrange(65536), rng.randrange(65536)) for _ in range(20000)]
        for normal, low, high in cases:
            for inverse in (False, True):
                for setting in range(7):
                    expected = speed_register_model(normal, low, high, inverse, setting)
                    actual = native.speed(normal, low, high, inverse, setting)
                    assert actual == expected, ("speed", normal, low, high, inverse, setting, actual, expected)
                    checked["speed"] += 1
        pairs = [(n,d) for n in (0,1,127,128,225,255,256,257,449,450,65534,65535)
                 for d in (0,1,127,128,255,256,450,65534,65535)]
        pairs += [(rng.randrange(65536), rng.randrange(65536)) for _ in range(50000)]
        for a, b in pairs:
            assert native.ratio(a,b) == ratio_register_model(a,b), ("ratio", a, b)
            assert native.scale(a,b) == scale_register_model(a,b), ("scale", a, b)
            checked["ratio"] += 1
            checked["scale"] += 1
        assert native.speed(30,15,60,True,4) == 16
        assert native.scale(3,native.ratio(225,450)) == 2
        # Validate the actual source patch is idempotent and syntax-check the
        # patched translation units, independently of the browser build.
        patched = work / "opendune"
        shutil.copytree(source, patched, ignore=shutil.ignore_patterns(".git"))
        command = ["python3", str(HERE / "patch-native.py"), str(patched)]
        subprocess.run(command, check=True, capture_output=True)
        paths = [patched / name for name in ("src/dune107.h", "src/tools.c", "src/object.c", "src/tile.c", "src/unit.c", "src/script/structure.c", "src/script/unit.c", "src/script/general.c")]
        before = [digest(path) for path in paths]
        subprocess.run(command, check=True, capture_output=True)
        assert before == [digest(path) for path in paths]
        for path in paths[1:]:
            subprocess.run(["clang", "-std=c99", "-fsyntax-only", "-I", str(patched / "include"), str(path)], check=True, capture_output=True)
    result = {
        "status": "passed",
        "method": "This arithmetic check compiles reconstruction C and compares saved-assembly models; separate authorized DOSBox runtime evidence is in analysis/dune-2/dos-comparison/combat",
        "checked_vectors": checked,
        "patch_idempotent": True,
        "patched_translation_units_syntax_checked": 7,
        "limits": "The arithmetic models are transcriptions, not runtime observations of the original executable. Full gameplay equivalence is not established.",
    }
    (HERE / "test-results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
