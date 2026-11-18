#!/usr/bin/env python3
"""Optional fresh EXE verification; portable tests use retained byte excerpts.

Usage: python3 tools/check-original-cutscenes.py /path/to/original/DUNE2.EXE
Reads the original statically, verifies its full hash and re-extracts the tables.
"""
from pathlib import Path
import argparse
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exe", type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("derive_cutscenes", ROOT / "tools/derive-cutscenes.py")
    derive = importlib.util.module_from_spec(spec); spec.loader.exec_module(derive)
    retained = json.loads((ROOT / "fidelity/cutscenes/native-tables.json").read_text())
    native = derive.extract(args.exe)
    assert native["source"]["sha256"] == retained["source"]["sha256"]
    for key in ["sequences", "feedback"]:
        expected = [{k: v for k, v in row.items() if k != "openDuneVoiceIds"} for row in retained[key]]
        assert native[key] == expected, key
    for actual, expected in zip(native["voices"], retained["voices"]):
        for key in ["nativeId", "name", "priority", "evidence"]:
            assert actual[key] == expected[key], ("voices", actual["nativeId"], key)
    print("Original EXE hash and fresh cutscene/speech/feedback extraction agree; no original code executed.")


if __name__ == "__main__":
    main()
