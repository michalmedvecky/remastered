#!/usr/bin/env python3
"""Apply reviewed terrain compatibility changes to a private OpenDUNE checkout.

Usage: python3 fidelity/terrain/patch-native.py native/opendune
Idempotent and context checked. Original behavior is g_dune2_enhanced == false.
The out-of-map read is bounded with an explicit cleared-neighbor model: original
surrounding DOS memory has not been observed. See README.md for evidence limits.
"""
from pathlib import Path
import argparse, hashlib, json

PIN='ebea79aeba025be2fe9004570e9255044aacc0be'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_root',type=Path)
    root=parser.parse_args().source_root.resolve()
    pending={};changes=[]
    def replace(path,before,after):
        text=pending.get(path,(root/path).read_text())
        if after in text:
            changes.append({'file':path,'status':'already-applied'});return
        if text.count(before)!=1:raise SystemExit(f'Refusing {path}: expected one reviewed terrain source block')
        pending[path]=text.replace(before,after,1)
        changes.append({'file':path,'status':'applied'})
    replace('src/tile.c','#include "house.h"','#include "house.h"\n#include "opendune.h"')
    replace('src/tile.c',
        '\tx += ((_stepX[orientation] * distance) / 128) * 16;\n\ty -= ((_stepY[orientation] * distance) / 128) * 16;',
        '\t/* V1.07 0x1d6be/0x1d6d8: signed SAR, Y negated before the shift. */\n'
        '\tif (!g_dune2_enhanced) {\n'
        '\t\tx += ((_stepX[orientation] * distance) >> 7) * 16;\n'
        '\t\ty += ((-_stepY[orientation] * distance) >> 7) * 16;\n'
        '\t} else {\n'
        '\t\tx += ((_stepX[orientation] * distance) / 128) * 16;\n'
        '\t\ty -= ((_stepY[orientation] * distance) / 128) * 16;\n\t}')
    replace('src/tile.c',
        'uint16 Tile_GetDistancePacked(uint16 packed_from, uint16 packed_to)\n{',
        'uint16 Tile_GetDistancePacked(uint16 packed_from, uint16 packed_to)\n{\n'
        '\t/* V1.07 0x1d819: packed Y is shifted without a six-bit mask. */\n'
        '\tif (!g_dune2_enhanced) {\n'
        '\t\tuint16 dx = abs((int)(packed_from & 63) - (int)(packed_to & 63));\n'
        '\t\tuint16 dy = abs((int)(packed_from >> 6) - (int)(packed_to >> 6));\n'
        '\t\treturn max(dx, dy) + (min(dx, dy) >> 1);\n\t}')
    replace('src/map.c',
        '\tt = &g_map[packed];\n\n\tif (t->groundTileID == g_builtSlabTileID)',
        '\t/* Terrain boundary model: no observation of adjacent original DOS memory. */\n'
        '\tif (packed >= 4096) return LST_ENTIRELY_ROCK;\n'
        '\tt = &g_map[packed];\n\n\tif (t->groundTileID == g_builtSlabTileID)')
    replace('src/map.c',
        '\t\t\tif (Tile_IsOutOfMap(curPacked)) {\n\t\t\t\tif (type == LST_SPICE || type == LST_THICK_SPICE)',
        '\t\t\t/* V1.07 0x7a0e3/0x7a0ef checks masked X/Y > 64; unreachable. */\n'
        '\t\t\tif (g_dune2_enhanced && Tile_IsOutOfMap(curPacked)) {\n'
        '\t\t\t\tif (type == LST_SPICE || type == LST_THICK_SPICE)')
    for path,text in pending.items():(root/path).write_text(text)
    manifest={'upstream_commit':PIN,'original_mode':'g_dune2_enhanced == false',
        'changes':changes,'patched_sha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['src/tile.c','src/map.c']},
        'scope':'instruction-verified arithmetic and edge predicate; bounded cleared-neighbor memory model, no original runtime comparison',
        'evidence':'fidelity/terrain/source-verification.json'}
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':main()
