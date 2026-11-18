#!/usr/bin/env python3
"""Apply reviewed V1.07 compatibility changes to a pinned OpenDUNE tree.

Usage: python3 fidelity/combat/patch-native.py native/opendune
Idempotent; rejects unexpected upstream source rather than applying fuzzy edits.
The enhanced mode retains upstream behavior. Original mode is dune2_enhanced=0.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil

HERE = Path(__file__).resolve().parent
PIN = "ebea79aeba025be2fe9004570e9255044aacc0be"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path)
    args = parser.parse_args()
    root = args.source_root.resolve()
    changes = []
    pending = {}

    def replace(path, before, after):
        target = root / path
        text = pending.get(path, target.read_text())
        if after in text:
            changes.append({"file": path, "status": "already-applied"})
            return
        if text.count(before) != 1:
            raise SystemExit(f"Refusing {path}: expected exactly one reviewed source block")
        pending[path] = text.replace(before, after, 1)
        changes.append({"file": path, "status": "applied"})

    replace("src/tools.c", '#include "tools.h"',
            '#include "tools.h"\n#include "opendune.h"\n#include "dune107.h"')
    replace("src/tools.c", "\tuint16 gameSpeed = g_gameConfig.gameSpeed;\n",
            "\tuint16 gameSpeed = g_gameConfig.gameSpeed;\n\n"
            "\t/* Supplied V1.07 0x15d2f: signed word arithmetic and rounded half-steps. */\n"
            "\tif (!g_dune2_enhanced) return Dune107_AdjustToGameSpeed(normal, minimum, maximum, inverseSpeed, gameSpeed);\n")
    replace("src/script/structure.c", '#include "../opendune.h"',
            '#include "../opendune.h"\n#include "../dune107.h"')
    replace("src/script/structure.c",
            "\tharvesterStep = (s->o.hitpoints * 256 / si->o.hitpoints) * 3 / 256;",
            "\t/* V1.07 0x18b9a/0x18bab calls normalized ratio then rounded scale. */\n"
            "\tharvesterStep = g_dune2_enhanced\n"
            "\t\t? (s->o.hitpoints * 256 / si->o.hitpoints) * 3 / 256\n"
            "\t\t: Dune107_Scale(3, Dune107_Ratio(s->o.hitpoints, si->o.hitpoints));")
    replace("src/script/structure.c",
            "\t\tg_scenario.harvestedEnemy += creditsStep;\n"
            "\t\tif (g_scenario.harvestedEnemy > 65000) g_scenario.harvestedEnemy = 65000;",
            "\t\tg_scenario.harvestedEnemy += creditsStep;\n"
            "\t\t/* V1.07 0x18c56 reads allied, then writes enemy (original scoring bug). */\n"
            "\t\tif (!g_dune2_enhanced) {\n"
            "\t\t\tg_scenario.harvestedEnemy = g_scenario.harvestedAllied < 65000 ? g_scenario.harvestedAllied : 65000;\n"
            "\t\t} else if (g_scenario.harvestedEnemy > 65000) g_scenario.harvestedEnemy = 65000;")
    for unit in ("UNIT_LAUNCHER", "UNIT_TANK"):
        before = f"Tools_AdjustToGameSpeed(g_table_unitInfo[{unit}].fireDelay, 1, 0xFFFF, true)"
        after = f"Tools_AdjustToGameSpeed(g_table_unitInfo[{unit}].fireDelay, 1, g_dune2_enhanced ? 0xFFFF : 255, true)"
        replace("src/script/structure.c", before, after)
    replace("src/script/unit.c",
            "Tools_AdjustToGameSpeed(ui->fireDelay * 2, 1, 0xFFFF, true)",
            "Tools_AdjustToGameSpeed(ui->fireDelay * 2, 1, g_dune2_enhanced ? 0xFFFF : 255, true)")
    replace("src/script/unit.c", "\tu->fireDelay += Tools_Random_256() & 1;",
            "\tu->fireDelay += Tools_Random_256() & 1;\n"
            "\t/* V1.07 0x26fd6 adds in DL and stores a byte; 255 + 1 wraps. */\n"
            "\tif (!g_dune2_enhanced) u->fireDelay = (uint8)u->fireDelay;")
    # Bounded DOSBox comparisons, 2026-11-18: original Fire and geometry.
    replace("src/script/unit.c",
            "\tif (u->o.type != UNIT_SANDWORM && u->orientation[ui->o.flags.hasTurret ? 1 : 0].speed != 0) return 0;",
            "\t/* V1.07 0x26c0c: a winger without a turret can fire while turning. */\n"
            "\tif (u->o.type != UNIT_SANDWORM &&\n"
            "\t\t(g_dune2_enhanced || ui->o.flags.hasTurret || ui->movementType != MOVEMENT_WINGER) &&\n"
            "\t\tu->orientation[ui->o.flags.hasTurret ? 1 : 0].speed != 0) return 0;")
    replace("src/script/unit.c",
            "\t\tdiff = abs(u->orientation[ui->o.flags.hasTurret ? 1 : 0].current - orientation);",
            "\t\t/* V1.07 zero-extends current and returns direction in AX & 255. */\n"
            "\t\tdiff = g_dune2_enhanced\n"
            "\t\t\t? abs(u->orientation[ui->o.flags.hasTurret ? 1 : 0].current - orientation)\n"
            "\t\t\t: abs((uint8)u->orientation[ui->o.flags.hasTurret ? 1 : 0].current - (uint8)orientation);")
    replace("src/script/unit.c",
            "\t\tdefault: break;\n\t}\n\n\tu->fireDelay = Tools_AdjustToGameSpeed",
            "\t\tdefault:\n"
            "\t\t\t/* V1.07 0x26f49 requires a created projectile before succeeding. */\n"
            "\t\t\tif (!g_dune2_enhanced) return 0;\n"
            "\t\t\tbreak;\n\t}\n\n\tu->fireDelay = Tools_AdjustToGameSpeed")
    replace("src/object.c", '#include "unit.h"', '#include "unit.h"\n#include "opendune.h"')
    replace("src/object.c",
            "\t\t/* ENHANCEMENT -- Originally this was o->type, where 'o' refers to a unit. */\n"
            "\t\tpacked += g_table_structure_layoutEdgeTiles[g_table_structureInfo[s->o.type].layout][(Orientation_Orientation256ToOrientation8(Tile_GetDirection(o->position, position)) + 4) & 7];",
            "\t\t/* V1.07 0x24b57 indexes the structure layout with the firing object's type.\n"
            "\t\t * Normal armed units fit this table; preserve safe lookup for unsupported IDs. */\n"
            "\t\tuint8 layoutType = (!g_dune2_enhanced && o->type < STRUCTURE_MAX) ? o->type : s->o.type;\n"
            "\t\tpacked += g_table_structure_layoutEdgeTiles[g_table_structureInfo[layoutType].layout][(Orientation_Orientation256ToOrientation8(Tile_GetDirection(o->position, position)) + 4) & 7];")
    replace("src/tile.c",
            "\t/* Always round away from zero */\n",
            "\t/* V1.07 0x1d79b/0x1d7b5: add 64 then signed SAR, also for negatives. */\n"
            "\tif (!g_dune2_enhanced) {\n"
            "\t\ttile.x += (diffX * distance + 64) >> 7;\n"
            "\t\ttile.y += (-diffY * distance + 64) >> 7;\n"
            "\t\treturn tile;\n"
            "\t}\n\n"
            "\t/* Always round away from zero */\n")
    replace("src/unit.c",
            "\tunit->deviated = 120;\n\tunit->deviatedHouse = houseID;",
            "\t/* V1.07 0x29c5e: control and default action always belong to Ordos. */\n"
            "\tif (!g_dune2_enhanced) houseID = HOUSE_ORDOS;\n"
            "\tunit->deviated = 120;\n\tunit->deviatedHouse = houseID;")
    for following in ("Remove fog arount the given unit.", "Moves the given unit."):
        suffix = "\n\treturn true;\n}\n\n/**\n * " + following
        replace("src/unit.c",
                "\tUnit_UntargetMe(unit);\n\tunit->targetAttack = 0;\n\tunit->targetMove = 0;\n" + suffix,
                "\tUnit_UntargetMe(unit);\n"
                "\t/* V1.07 retains foreign targets; zero-target setters reject index zero. */\n"
                "\tif (g_dune2_enhanced) {\n"
                "\t\tunit->targetAttack = 0;\n\t\tunit->targetMove = 0;\n\t}\n" + suffix)
    # Original Script_General_Delay uses CWD/IDIV: its word operand is signed.
    replace("src/script/general.c", '#include "../tools.h"',
            '#include "../tools.h"\n#include "../opendune.h"\n#include "../dune107.h"')
    replace("src/script/general.c", "\tdelay = STACK_PEEK(1) / 5;",
            "\t/* V1.07 0x1cf49: signed IDIV, including negative script operands. */\n"
            "\tdelay = g_dune2_enhanced ? STACK_PEEK(1) / 5 : (uint16)(Dune107_SignedWord(STACK_PEEK(1)) / 5);")
    # Validate every context before mutating any source file.
    for path, text in pending.items():
        (root / path).write_text(text)
    shutil.copyfile(HERE / "dune107.h", root / "src/dune107.h")
    manifest = {
        "upstream_commit": PIN,
        "mode": "original behavior when g_dune2_enhanced == false",
        "changes": changes,
        "patched_sha256": {
            str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in [root / "src/dune107.h"] + [root / f"src/{p}" for p in
                ["tools.c", "object.c", "tile.c", "unit.c", "script/unit.c", "script/structure.c", "script/general.c"]]
        },
        "evidence": "fidelity/combat/compatibility-findings.json",
    }
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
