#!/usr/bin/env python3
"""Reproduce callback pointer/source-contract coverage without executing DOS code."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import struct

HERE = Path(__file__).resolve().parent
WEB = HERE.parents[1]
WORKSPACE = WEB.parent
ANALYSIS = WORKSPACE / "analysis/dune-2"
PIN = "ebea79aeba025be2fe9004570e9255044aacc0be"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def c_mask(text):
    return re.sub(r'/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',
                  lambda match: re.sub(r"[^\n]", " ", match.group()), text, flags=re.S)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path)
    args = parser.parse_args()
    upstream = args.source_root.resolve()
    used = json.loads((ANALYSIS / "evidence/decoded/emc-native-slots.json").read_text())
    exe = (ANALYSIS / "inputs/DUNE2.EXE").read_bytes()
    assert sha(exe) == "85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f"
    reloc_count, header_paragraphs = struct.unpack_from("<HH", exe, 6)
    reloc_start = struct.unpack_from("<H", exe, 24)[0]
    reloc_file_offsets = set()
    for i in range(reloc_count):
        offset, segment = struct.unpack_from("<HH", exe, reloc_start + 4 * i)
        reloc_file_offsets.add(header_paragraphs * 16 + segment * 16 + offset)

    contracts = {}
    source_files = {}
    for name in ("general", "structure", "unit", "team"):
        path = upstream / f"src/script/{name}.c"
        text = path.read_text()
        source_files[str(path.relative_to(upstream))] = sha(path.read_bytes())
        masked = c_mask(text)
        for match in re.finditer(r"uint16\s+(Script_\w+)\(ScriptEngine \*script\)\s*\{", masked):
            level, end = 1, match.end()
            while level:
                if masked[end] == "{": level += 1
                if masked[end] == "}": level -= 1
                end += 1
            body = text[match.start():end]
            masked_body = masked[match.start():end]
            doc_start = text.rfind("/**", 0, match.start())
            doc_end = text.find("*/", doc_start) + 2
            doc = text[doc_start:doc_end] if doc_start >= 0 else ""
            doc_lines = [re.sub(r"^\s*\* ?", "", line).strip() for line in doc.splitlines()[1:-1]]
            contracts[match.group(1)] = {
                "symbol": match.group(1),
                "source_file": str(path.relative_to(upstream)),
                "source_start_line": text[:match.start()].count("\n") + 1,
                "source_end_line": text[:end].count("\n") + 1,
                "source_body_sha256": sha(body.encode()),
                "upstream_documentation": "\n".join(doc_lines).strip(),
                "stack_positions_read": sorted(set(map(int, re.findall(r"STACK_PEEK\((\d+)\)", masked_body)))),
                "script_variables_used": sorted(set(map(int, re.findall(r"script->variables\[(\d+)\]", masked_body)))),
                "direct_helper_calls": sorted(set(re.findall(r"\b([A-Z]\w+)\s*\(", masked_body)) - {match.group(1), "STACK_PEEK"}),
                "contract_basis": "pinned upstream source; not a binary-equivalence claim",
            }

    tables = (upstream / "src/script/script.c").read_text()
    source_files["src/script/script.c"] = sha(tables.encode())
    rows = []
    for script, category in (("BUILD.EMC", "Structure"), ("UNIT.EMC", "Unit"), ("TEAM.EMC", "Team")):
        bindings = {row["slot"]: row for row in used if row["script"] == script}
        base_offsets = {int(row["pointer_file_offset"], 16) - row["slot"] * 4 for row in bindings.values()}
        assert len(base_offsets) == 1
        table_offset = base_offsets.pop()
        table = re.search(r"g_scriptFunctions" + category + r"\[SCRIPT_FUNCTIONS_COUNT\] = \{(.*?)\};", tables, re.S).group(1)
        entries = re.findall(r"/\* ([0-9A-F]{2}) \*/ &(Script_\w+)", table)
        assert len(entries) == {"Structure": 25, "Unit": 64, "Team": 15}[category]
        for slot_hex, symbol in entries:
            slot = int(slot_hex, 16)
            ptr = table_offset + slot * 4
            off, seg = struct.unpack_from("<HH", exe, ptr)
            address = hex((seg + 0x1000) * 16 + off)
            original_far = f"{seg:04x}:{off:04x}"
            if slot in bindings:
                assert bindings[slot]["original_far"] == original_far
                assert bindings[slot]["analysis_linear"] == address
            assert ptr + 2 in reloc_file_offsets
            row = {
                "script": script,
                "slot": slot,
                "slot_hex": slot_hex,
                "source_symbol": symbol,
                "original_far": original_far,
                "analysis_linear": address,
                "pointer_file_offset": hex(ptr),
                "pointer_bytes": exe[ptr:ptr+4].hex(),
                "segment_word_is_mz_relocation": True,
                "supplied_script_uses_slot": slot in bindings,
                "instruction_occurrences": bindings.get(slot, {}).get("instruction_occurrences", 0),
                "bind_site": next(iter(bindings.values()))["bind_site"],
                "source_contract": symbol,
                "mapping_status": "original pointer bytes verified; source table-order correspondence",
                "equivalence_status": "not proven; source reuse plus selected assembly checks",
            }
            for kind, directory, extension in (("pseudocode", "pseudocode/raw", "c"), ("assembly", "assembly", "asm")):
                path = ANALYSIS / "game-final" / directory / f"{address}.{extension}"
                row[kind] = str(path.relative_to(WORKSPACE)) if path.exists() else None
                row[kind + "_sha256"] = sha(path.read_bytes()) if path.exists() else None
            suffix = re.search(r"Unknown([0-9A-Fa-f]{4})$", symbol)
            row["historic_offset_name_matches_original_far_offset"] = int(suffix.group(1), 16) == off if suffix else None
            rows.append(row)
    counts = {
        "table_slots": len(rows),
        "used_slots": sum(row["supplied_script_uses_slot"] for row in rows),
        "used_distinct_original_addresses": len({row["analysis_linear"] for row in rows if row["supplied_script_uses_slot"]}),
        "source_implementations": len({row["source_symbol"] for row in rows}),
        "missing_source_contracts": [row["source_symbol"] for row in rows if row["source_symbol"] not in contracts],
        "missing_used_pseudocode": [row["analysis_linear"] for row in rows if row["supplied_script_uses_slot"] and not row["pseudocode"]],
        "missing_used_assembly": [row["analysis_linear"] for row in rows if row["supplied_script_uses_slot"] and not row["assembly"]],
    }
    assert counts["used_slots"] == 79
    assert not counts["missing_source_contracts"]
    result = {
        "source_commit": PIN,
        "upstream": "https://github.com/OpenDUNE/OpenDUNE/tree/" + PIN,
        "license": "GPL-2.0-or-later; preserve upstream COPYING and all attribution",
        "original_sha256": sha(exe),
        "provider": "saved REA/Ghidra evidence; no live REA session or original execution in this audit",
        "source_files_sha256": source_files,
        "counts": counts,
        "limits": [
            "All 104 table entries have original pointer-byte and relocation verification; 79 are referenced by supplied EMC DATA instructions.",
            "Matching table order and original-offset names identify a strong reconstruction correspondence, not proof every OpenDUNE branch matches V1.07.",
            "Contract text, argument positions and helper calls are from pinned C source; original behavior is separately evidenced in compatibility-findings.json.",
            "Saved decompilation has segmented-call and switch limitations; assembly takes precedence for disputed arithmetic and branch conditions.",
            "No original DOS executable, emulator, or overlay code was executed.",
        ],
        "callbacks": rows,
        "source_contracts": {key: contracts[key] for key in sorted({row["source_symbol"] for row in rows})},
    }
    (HERE / "callback-ledger.json").write_text(json.dumps(result, indent=2) + "\n")
    with (HERE / "callback-ledger.tsv").open("w") as output:
        output.write("script\tslot\tused\toriginal_far\taddress\tsource_symbol\tsource_file\tline\tpseudocode\tassembly\n")
        for row in rows:
            contract = contracts[row["source_symbol"]]
            output.write("\t".join(map(str, [row["script"], row["slot"], row["supplied_script_uses_slot"], row["original_far"], row["analysis_linear"], row["source_symbol"], contract["source_file"], contract["source_start_line"], row["pseudocode"], row["assembly"]])) + "\n")
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
