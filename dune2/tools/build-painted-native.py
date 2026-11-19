"""Export original indexed presentation evidence, separately from painted RGBA art.

Reads only verified PAK slices in the retained browser preload. No DOS execution,
no art generation, no change to original resources or simulation state.
"""
from pathlib import Path
import base64
import hashlib
import importlib.util
import json

from preload_data import read_pak, verify_preload


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("dune_original_graphics", ROOT / "tools/build-hd-assets.py")
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
icon_frames, shapes = original.icon_frames, original.shapes
SHA = lambda body: hashlib.sha256(body).hexdigest()
B64 = lambda body: base64.b64encode(body).decode("ascii")


def main():
    inventory = verify_preload()
    members = {}
    for file in inventory["files"]:
        if file["name"].endswith(".PAK"):
            for name, member in read_pak(file["name"]).items():
                members.setdefault(name, member)
    palette = bytes((value * 65) >> 4 for value in members["IBM.PAL"]["bytes"])
    specifications = [
        ("MOUSE.SHP", 0, 7), ("BTTN.ENG", 7, 5), ("SHAPES.SHP", 12, 99),
        ("UNITS2.SHP", 111, 40), ("UNITS1.SHP", 151, 87), ("UNITS.SHP", 238, 117),
        ("CHOAM.ENG", 355, 18), ("MENTAT.ENG", 373, 14),
        ("MENSHPH.SHP", 387, 15), ("MENSHPA.SHP", 402, 15),
        ("MENSHPO.SHP", 417, 15), ("MENSHPM.SHP", 432, 15),
        ("MENSHPM.SHP", 447, 15), ("MENSHPM.SHP", 462, 15),
        ("PIECES.SHP", 477, 28), ("ARROWS.SHP", 505, 9),
    ] + [(f"CREDIT{i}.SHP", 513 + i, 1) for i in range(1, 12)]
    frames = {"tiles": {}, "units": {}, "ui": {}}
    sources = {name: members[name]["sha256"] for name in ["ICON.ICN", "ICON.MAP", "IBM.PAL"]}

    def descriptor(frame, resource, index):
        width, height = frame["width"], frame["height"]
        return dict(sourceW=width, sourceH=height, w=width * 4, h=height * 4,
                    paletteMode="local16" if frame["palette"] else "global256",
                    **({"palette": frame["palette"]} if frame["palette"] else {}),
                    indicesBase64=B64(frame["indices"]), maskBase64=B64(frame["mask"]),
                    sourceSHA256=frame["sourceSHA256"], resource=resource, resourceFrame=index)

    for index, frame in icon_frames(members["ICON.ICN"]["bytes"]).items():
        frames["tiles"][index] = descriptor(frame, "ICON.ICN", index)
    for resource, first, expected in specifications:
        raw = members[resource]["bytes"]
        count, bank = shapes(raw)
        assert count == expected, (resource, count, expected)
        sources[resource] = SHA(raw)
        for index, frame in bank.items():
            target = "units" if 111 <= first + index <= 354 else "ui"
            frames[target][first + index] = descriptor(frame, resource, index)
    assert len(frames["tiles"]) == 389
    assert len(frames["units"]) == 244 and len(frames["ui"]) == 281
    assert set(frames["units"]) | set(frames["ui"]) == set(range(525))
    output = ROOT / "dist/painted/native.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    result = dict(schema=1, purpose="Original indexed prediction/overlay evidence; never painted RGB input",
                  scale=4, palette=list(palette), frames=frames,
                  source=dict(preloadSha256=inventory["packageSha256"], resources=sources),
                  coverage=dict(tiles=389, worldShapes=244, uiShapes=281, allShapes=525))
    output.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    print(json.dumps(dict(path=str(output.relative_to(ROOT)), bytes=output.stat().st_size,
                          sha256=SHA(output.read_bytes()), **result["coverage"])))


if __name__ == "__main__":
    main()
