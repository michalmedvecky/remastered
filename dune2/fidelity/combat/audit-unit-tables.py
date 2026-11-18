#!/usr/bin/env python3
"""Compare compiled upstream constant fields with original EXE table bytes."""
from pathlib import Path
import argparse
import json
import struct
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ANALYSIS = HERE.parents[2] / "analysis/dune-2"
# Original offset, native C field, storage width. This does not compare ABI layout.
FIELDS = [
    (0x00,"o.stringID_abbrev",2),(0x06,"o.stringID_full",2),(0x0e,"o.spawnChance",2),
    (0x10,"o.hitpoints",2),(0x12,"o.fogUncoverRadius",2),(0x14,"o.spriteID",2),
    (0x16,"o.buildCredits",2),(0x18,"o.buildTime",2),(0x1a,"o.availableCampaign",2),
    (0x1c,"o.structuresRequired",4),(0x20,"o.sortPriority",1),(0x21,"o.upgradeLevelRequired",1),
    (0x22,"o.actionsPlayer[0]",2),(0x24,"o.actionsPlayer[1]",2),
    (0x26,"o.actionsPlayer[2]",2),(0x28,"o.actionsPlayer[3]",2),
    (0x2a,"o.available",1),(0x2b,"o.hintStringID",2),(0x2d,"o.priorityBuild",2),
    (0x2f,"o.priorityTarget",2),(0x31,"o.availableHouse",1),
    (0x32,"indexStart",2),(0x34,"indexEnd",2),(0x38,"dimension",2),
    (0x3c,"movementType",2),(0x3e,"animationSpeed",2),(0x40,"movingSpeedFactor",2),
    (0x42,"turningSpeed",1),(0x44,"groundSpriteID",2),(0x46,"turretSpriteID",2),
    (0x48,"actionAI",2),(0x4a,"displayMode",2),(0x4c,"destroyedSpriteID",2),
    (0x4e,"fireDelay",2),(0x50,"fireDistance",2),(0x52,"damage",2),
    (0x54,"explosionType",2),(0x56,"bulletType",1),(0x58,"bulletSound",2),
]
FLAGS = ["isBullet","explodeOnDeath","sonicProtection","canWobble","isTracked", "isGroundUnit",
         "mustStayInMap","firesTwice","impactOnSand","isNotDeviatable", "hasAnimationSet","notAccurate","isNormalUnit"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root",type=Path)
    args=parser.parse_args()
    root=args.source_root.resolve()
    tables=json.loads((ANALYSIS/"evidence/decoded/embedded-tables.json").read_text())
    table=next(table for table in tables["object_tables"] if table["kind"]=="unit")
    binary=(ANALYSIS/"inputs/DUNE2.EXE").read_bytes()
    with tempfile.TemporaryDirectory(prefix="dune-table-audit-") as temporary:
        work=Path(temporary)
        c=work/"audit.c"
        c.write_text('#include <stdio.h>\n#include "types.h"\n#include "'+str(root/"src/unit.h")+'"\n'
            'int main(void){unsigned i; for(i=0;i<UNIT_MAX;i++){const UnitInfo *u=&g_table_unitInfo[i];\n'
            + ''.join('printf("%u ",(unsigned)u->'+field+');\n' for _,field,_ in FIELDS)
            + ''.join('printf("%u ",(unsigned)u->flags.'+flag+');\n' for flag in FLAGS)
            + 'printf("\\n");} return 0;}\n')
        exe=work/"audit"
        subprocess.run(["clang","-std=c99","-I",str(root/"include"),str(c),str(root/"src/table/unitinfo.c"),"-o",str(exe)],check=True,capture_output=True)
        compiled=[[int(value) for value in line.split()] for line in subprocess.check_output([str(exe)],text=True).splitlines()]
    mismatches=[]
    original_flags=[]
    source_flags=[]
    for index,row in enumerate(compiled):
        offset=table["file_offset"]+table["stride"]*index
        for (field_offset,field,width),source_value in zip(FIELDS,row):
            original=int.from_bytes(binary[offset+field_offset:offset+field_offset+width],"little")
            source_value &= (1<<(width*8))-1
            if source_value!=original:
                mismatches.append({"unit":index,"name":table["entries"][index]["name"],"field":field,"original":original,"source":source_value,"file_offset":hex(offset+field_offset)})
        original_flags.append(struct.unpack_from("<H",binary,offset+0x36)[0])
        source_flags.append(row[len(FIELDS):])
    flag_mapping={}
    for index,flag in enumerate(FLAGS):
        candidates=[]
        for bit in range(16):
            if all(bool(word&(1<<bit))==bool(values[index]) for word,values in zip(original_flags,source_flags)):
                candidates.append(hex(1<<bit))
        flag_mapping[flag]={"matching_original_masks":candidates,"status":"unambiguous pattern match" if len(candidates)==1 else "ambiguous; do not infer bit identity"}
    output={"compared_units":len(compiled),"compared_fields_per_unit":len(FIELDS),"compared_numeric_cells":len(compiled)*len(FIELDS),
        "original_table_file_offset":hex(table["file_offset"]),"original_record_stride":table["stride"],
        "mismatches":mismatches,"flags":flag_mapping,
        "method":"Compile and inspect upstream constant initializer, compare individual values with supplied EXE bytes. No original game execution.",
        "limits":"Pointer targets and names are already independently decoded; pointer ABI, padding and unnamed original flag bits are not compared. Values modified at runtime require separate analysis."}
    (HERE/"unit-table-comparison.json").write_text(json.dumps(output,indent=2)+"\n")
    print(json.dumps(output,indent=2))


if __name__=="__main__": main()
