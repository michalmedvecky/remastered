#!/usr/bin/env python3
"""Add read-only HD presentation hooks to the retained native renderer.

No simulation routine is changed. The hooks capture only draws already chosen
by the native dirty renderer; no extra draws, RNG or timer ticks are requested.
"""
from pathlib import Path
import argparse
import hashlib
import json

PREFIX = '''#ifdef __EMSCRIPTEN__
#include "hd_bridge.h"
#define DUNE_HD(call) call
#else
#define DUNE_HD(call) ((void)0)
#endif
'''


def patch_file(text, edits, marker):
    if marker in text:
        for _, new in edits:
            assert new in text, 'Partially applied HD bridge patch: ' + marker
        return text
    for old, new in edits:
        assert text.count(old) == 1, (marker, old[:90], text.count(old))
        text = text.replace(old, new, 1)
    return text


def changes(root):
    result = {}
    def add(rel, edits, marker):
        path = root / rel
        before = path.read_text()
        after = patch_file(before, edits, marker)
        result[rel] = (before, after)

    add('src/gui/viewport.c', [
        ('#include "gui.h"', '#include "gui.h"\n' + PREFIX),
        ('\tupdateDisplay = forceRedraw;', '\tDUNE_HD(DuneHD_BeginViewport());\n\tupdateDisplay = forceRedraw;'),
        ('\t\tsprite = g_sprites[g_table_unitInfo[u->o.type].groundSpriteID];',
         '\t\tDUNE_HD(DuneHD_SetOwner(u->o.index, 0, Unit_GetHouseID(u)));\n\t\tsprite = g_sprites[g_table_unitInfo[u->o.type].groundSpriteID];'),
        ('\t\t\tx += g_table_tilediff[0][u->wobbleIndex].x;',
         '\t\t\tDUNE_HD(DuneHD_SetOwner(u->o.index, 1, Unit_GetHouseID(u)));\n\t\t\tx += g_table_tilediff[0][u->wobbleIndex].x;'),
        ('\t\t/*GUI_Widget_Viewport_GetSprite_HousePalette(g_sprites[e->spriteID], e->houseID, paletteHouse);*/',
         '\t\tDUNE_HD(DuneHD_SetOwner(102 + i, 2, e->houseID));\n\t\t/*GUI_Widget_Viewport_GetSprite_HousePalette(g_sprites[e->spriteID], e->houseID, paletteHouse);*/'),
        ('\t\t\tindex = ui->groundSpriteID;\n\t\t\torientation = u->orientation[0].current;',
         '\t\t\tDUNE_HD(DuneHD_SetOwner(u->o.index, 3, Unit_GetHouseID(u)));\n\t\t\tindex = ui->groundSpriteID;\n\t\t\torientation = u->orientation[0].current;'),
        ('\tWidget_SetCurrentWidget(oldWidgetID);\n}\n\n/**\n * Draw a single tile',
         '\tWidget_SetCurrentWidget(oldWidgetID);\n\tDUNE_HD(DuneHD_EndViewport());\n}\n\n/**\n * Draw a single tile'),
    ], 'DuneHD_BeginViewport')
    add('src/gui/gui.c', [
        ('#include "gui.h"', '#include "gui.h"\n' + PREFIX),
        ('void GUI_DrawSprite(Screen screenID, const uint8 *sprite, int16 posX, int16 posY, uint16 windowID, int flags, ...)\n{',
         'void GUI_DrawSprite(Screen screenID, const uint8 *sprite, int16 posX, int16 posY, uint16 windowID, int flags, ...)\n{\n#ifdef __EMSCRIPTEN__\n\tconst uint8 *hdOriginalSprite = sprite;\n#endif'),
        ('\tif ((spriteFlags & 0x2) == 0) {\n\t\tFormat80_Decode(spriteBuffer, sprite, spriteDecodedLength);',
         '\t/* Capture pre-clipping native geometry; the HD renderer applies the same widget clip. */\n\tDUNE_HD(DuneHD_CaptureSprite(hdOriginalSprite, screenID, windowID,\n\t    posX + (g_widgetProperties[windowID].xBase << 3), posY,\n\t    spriteWidthZoomed, spriteHeight, flags, palette, remap, remapCount,\n\t    g_widgetProperties[windowID].xBase << 3, top, width, bottom - top));\n\n\tif ((spriteFlags & 0x2) == 0) {\n\t\tFormat80_Decode(spriteBuffer, sprite, spriteDecodedLength);'),
    ], 'DuneHD_CaptureSprite')
    add('src/timer.c', [
        ('#include "timer.h"', '#include "timer.h"\n' + PREFIX),
        ('\treturn ret;\n}\n\n/**\n * Sleep', '\tif (timer == TIMER_GAME) DUNE_HD(DuneHD_Timer(set));\n\treturn ret;\n}\n\n/**\n * Sleep'),
    ], 'DuneHD_Timer')
    add('src/sprites.c', [
        ('#include "sprites.h"', '#include "sprites.h"\n' + PREFIX),
        ('\tif (sprite == NULL || g_mouseDisabled != 0) return;',
         '\tif (sprite == NULL || g_mouseDisabled != 0) return;\n\tDUNE_HD(DuneHD_Cursor(sprite, hotSpotX, hotSpotY));'),
        ('\tSprites_Load("CREDIT11.SHP", NULL, 1);                    /* 524 */',
         '\tSprites_Load("CREDIT11.SHP", NULL, 1);                    /* 524 */\n\tDUNE_HD(DuneHD_SpritesReady(s_spritesCount));'),
        ('void Sprites_Uninit(void)\n{\n\tuint16 i;',
         'void Sprites_Uninit(void)\n{\n\tuint16 i;\n\tDUNE_HD(DuneHD_SpritesReady(0));'),
    ], 'DuneHD_Cursor')
    add('src/video/video_sdl2.c', [
        ('#include "video.h"', '#include "video.h"\n' + PREFIX),
        ('\tif (draw) {\n\t\tVideo_DrawScreen();\n\t}\n\n\ts_video_lock = false;',
         '\tif (draw) {\n\t\tVideo_DrawScreen();\n\t}\n\tDUNE_HD(DuneHD_Present(s_screenOffset));\n\n\ts_video_lock = false;'),
    ], 'DuneHD_Present')
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('root', type=Path)
    p.add_argument('--write', action='store_true')
    p.add_argument('--report', type=Path)
    args = p.parse_args()
    edits = changes(args.root)
    report = {'scope':'native renderer observation only; no simulation changes', 'files':[]}
    for rel, (before, after) in edits.items():
        report['files'].append({'path':rel,'changed':before != after,
            'beforeSha256':hashlib.sha256(before.encode()).hexdigest(),
            'afterSha256':hashlib.sha256(after.encode()).hexdigest()})
    if args.write:
        for rel, (before, after) in edits.items():
            if before != after:(args.root / rel).write_text(after)
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':main()
