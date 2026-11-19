#!/usr/bin/env python3
"""Add HD observation and display-offset picking to the retained native renderer.

Rendering hooks capture only draws already chosen by the native dirty renderer.
The optional signed display offset adapts viewport picking to the rendered camera;
zero preserves the original branch. No extra draws, RNG or timer ticks occur.
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
    # Upgrade retained sources as well as pristine upstream sources. Each exact
    # replacement is independently idempotent; partial patches still fail closed.
    text = text.replace('DuneHD_EndViewport());', 'DuneHD_EndViewport(!drawToMainScreen));')
    text = text.replace('    g_widgetProperties[windowID].xBase << 3, top, width, bottom - top));',
                        '    g_widgetProperties[windowID].xBase << 3, top, width, bottom - top, blurOffset, blurRandomValueIncr, blurRandomValue));')
    for edit in edits:
        old, new = edit[:2]
        expected = edit[2] if len(edit) > 2 else 1
        if new in text:
            continue
        assert text.count(old) == expected, (marker, old[:90], text.count(old))
        text = text.replace(old, new, expected)
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
         '\tWidget_SetCurrentWidget(oldWidgetID);\n\tDUNE_HD(DuneHD_EndViewport(!drawToMainScreen));\n}\n\n/**\n * Draw a single tile'),
        ('\t\t\t\tt = &g_map[curPos];\n\t\t\t\tleft = x << 4;',
         '\t\t\t\tt = &g_map[curPos];\n\t\t\t\tleft = x << 4;\n\t\t\t\tDUNE_HD(DuneHD_Tile(curPos));'),
        ('\tif (w->index == 43) {\n\t\tx =  x / 16 + Tile_GetPackedX(g_minimapPosition);\n\t\ty = (y - 40) / 16 + Tile_GetPackedY(g_minimapPosition);',
         '\tif (w->index == 43) {\n#ifdef __EMSCRIPTEN__\n\t\tuint16 hdPacked;\n\t\tif (DuneHD_ViewportPick(x, (int)y - 40, Tile_GetPackedX(g_minimapPosition), Tile_GetPackedY(g_minimapPosition), &hdPacked)) {\n\t\t\tif (hdPacked == 0xffff) return true;\n\t\t\tx = Tile_GetPackedX(hdPacked);\n\t\t\ty = Tile_GetPackedY(hdPacked);\n\t\t} else\n#endif\n\t\t{\n\t\t\tx =  x / 16 + Tile_GetPackedX(g_minimapPosition);\n\t\t\ty = (y - 40) / 16 + Tile_GetPackedY(g_minimapPosition);\n\t\t}'),
    ], 'DuneHD_BeginViewport')
    add('src/gui/gui.c', [
        ('#include "gui.h"', '#include "gui.h"\n' + PREFIX),
        ('void GUI_DrawSprite(Screen screenID, const uint8 *sprite, int16 posX, int16 posY, uint16 windowID, int flags, ...)\n{',
         'void GUI_DrawSprite(Screen screenID, const uint8 *sprite, int16 posX, int16 posY, uint16 windowID, int flags, ...)\n{\n#ifdef __EMSCRIPTEN__\n\tconst uint8 *hdOriginalSprite = sprite;\n#endif'),
        ('\tif ((spriteFlags & 0x2) == 0) {\n\t\tFormat80_Decode(spriteBuffer, sprite, spriteDecodedLength);',
         '\t/* Capture pre-clipping native geometry; the HD renderer applies the same widget clip. */\n\tDUNE_HD(DuneHD_CaptureSprite(hdOriginalSprite, screenID, windowID,\n\t    posX + (g_widgetProperties[windowID].xBase << 3), posY,\n\t    spriteWidthZoomed, spriteHeight, flags, palette, remap, remapCount,\n\t    g_widgetProperties[windowID].xBase << 3, top, width, bottom - top, blurOffset, blurRandomValueIncr, blurRandomValue));\n\n\tif ((spriteFlags & 0x2) == 0) {\n\t\tFormat80_Decode(spriteBuffer, sprite, spriteDecodedLength);'),
        ('\tGFX_Screen_SetDirty(SCREEN_ACTIVE, x, y, x + fc->width, y + g_fontCurrent->height);',
         '\tDUNE_HD(DuneHD_GlyphBegin());\n\tGFX_Screen_SetDirty(SCREEN_ACTIVE, x, y, x + fc->width, y + g_fontCurrent->height);\n\tDUNE_HD(DuneHD_GlyphEnd(c, x, y, g_colours));'),
        ('\tGFX_Screen_SetDirty(screenID,\n\t                    (g_widgetProperties[windowID].xBase << 3) + posX,',
         '\tDUNE_HD(DuneHD_SpriteBegin());\n\tGFX_Screen_SetDirty(screenID,\n\t                    (g_widgetProperties[windowID].xBase << 3) + posX,'),
        ('\t\t\t\t\t\t\tbuf += buf_incr;',
         '\t\t\t\t\t\t\tDUNE_HD(DuneHD_SpritePixel(buf));\n\t\t\t\t\t\t\tbuf += buf_incr;', 7),
        ('\t} while (--spriteHeight > 0);\n}\n\n/**\n * Updates the score.',
         '\t} while (--spriteHeight > 0);\n\tDUNE_HD(DuneHD_SpriteEnd());\n}\n\n/**\n * Updates the score.'),
        ('\t\tmemset(screen, colour, x2);',
         '\t\tDUNE_HD(DuneHD_Dirty(SCREEN_ACTIVE, x1, y1, x1 + x2, y1 + 1));\n\t\tmemset(screen, colour, x2);'),
        ('\t\t\t*screen = colour;',
         '\t\t\t*screen = colour;\n\t\t\tDUNE_HD(DuneHD_WritePixel(screen, SCREEN_ACTIVE));', 4),
        ('\t\t\t*screen++ = remap[pixel];',
         '\t\t\t*screen++ = remap[pixel];\n\t\t\tDUNE_HD(DuneHD_RemapPixel(screen - 1, screenID));'),
        ('\t\t\t*screen++ ^= colour;',
         '\t\t\t*screen++ ^= colour;\n\t\t\tDUNE_HD(DuneHD_WritePixel(screen - 1, SCREEN_ACTIVE));'),
        ('\tif (!fill) GFX_Screen_SetDirty(SCREEN_ACTIVE, left, top, left + width, top + height);',
         '\tDUNE_HD(DuneHD_NotifyOnly(1));\n\tif (!fill) GFX_Screen_SetDirty(SCREEN_ACTIVE, left, top, left + width, top + height);\n\tDUNE_HD(DuneHD_NotifyOnly(0));'),
        ('\tGFX_Screen_SetDirty(SCREEN_ACTIVE, left, top, right+1, bottom+1);',
         '\tDUNE_HD(DuneHD_NotifyOnly(1));\n\tGFX_Screen_SetDirty(SCREEN_ACTIVE, left, top, right+1, bottom+1);\n\tDUNE_HD(DuneHD_NotifyOnly(0));'),
        ('\tGFX_PutPixel(left + width, top, colourSchema[3] & 0xFF);',
         '\tGFX_PutPixel(left + width, top, colourSchema[3] & 0xFF);\n\tDUNE_HD(DuneHD_DirectBorder(left, top, width + 1, height + 1, colourSchemaIndex, fill));'),
        ('\tGUI_InitColors(colours, 0, 1);\n\n\ts = string;',
         '\tGUI_InitColors(colours, 0, 1);\n\tDUNE_HD(DuneHD_TextBegin(0));\n\n\ts = string;'),
        ('\t\tGUI_DrawChar(*s, x, y);',
         '\t\tDUNE_HD(DuneHD_TextGlyph((unsigned char)*s, x, y, g_colours));\n\t\tGUI_DrawChar(*s, x, y);'),
        ('\t\tx += width;\n\t\ts++;\n\t}\n}\n\n/**\n * Draw a string to the screen, and so some magic.',
         '\t\tx += width;\n\t\ts++;\n\t}\n\tDUNE_HD(DuneHD_TextEnd());\n}\n\n/**\n * Draw a string to the screen, and so some magic.'),
        ('\tchar s[2] = " ";\n\n\twhile (*string',
         '\tchar s[2] = " ";\n\tDUNE_HD(DuneHD_TextBegin(charWidth));\n\n\twhile (*string'),
        ('\t\tleft += charWidth;\n\t}\n}\n\nvoid GUI_FactoryWindow_B495_0F30',
         '\t\tleft += charWidth;\n\t}\n\tDUNE_HD(DuneHD_TextEnd());\n}\n\nvoid GUI_FactoryWindow_B495_0F30'),
    ], 'DuneHD_CaptureSprite')
    add('src/gui/widget_draw.c', [
        ('#include "gui.h"', '#include "gui.h"\n' + PREFIX),
        ('\tif (GFX_Screen_IsActive(SCREEN_0)) {\n\t\tGUI_Mouse_Show_InRegion();\n\t}\n}\n\n/**\n * Draw all widgets',
         '\tDUNE_HD(DuneHD_Border(widgetIndex, borderType, pressed, left, top, width, height));\n\tif (GFX_Screen_IsActive(SCREEN_0)) {\n\t\tGUI_Mouse_Show_InRegion();\n\t}\n}\n\n/**\n * Draw all widgets'),
        ('\tGUI_DrawBorder(left, top, width, height, colourSchemaIndex + 1, true);',
         '\tDUNE_HD(DuneHD_WidgetBorderBegin());\n\tGUI_DrawBorder(left, top, width, height, colourSchemaIndex + 1, true);'),
    ], 'DuneHD_Border')
    add('src/gfx.c', [
        ('#include "gfx.h"', '#include "gfx.h"\n' + PREFIX),
        ('\tif(screenID == SCREEN_ACTIVE) screenID = s_screenActiveID;\n\tif(screenID != SCREEN_0) return;\n\ts_screen0_is_dirty = true;',
         '\tif(screenID == SCREEN_ACTIVE) screenID = s_screenActiveID;\n\tDUNE_HD(DuneHD_Dirty(screenID, left, top, right, bottom));\n\tif(screenID != SCREEN_0) return;\n\ts_screen0_is_dirty = true;'),
        ('\tGFX_Screen_SetDirty(screenDst, xDst, yDst, xDst + width, yDst + height);\n\n\tsrc = GFX_Screen_Get_ByIndex(screenSrc);',
         '\tDUNE_HD(DuneHD_Copy(screenSrc, screenDst, xSrc, ySrc, xDst, yDst, width, height, skipNull));\n\tGFX_Screen_SetDirty(screenDst, xDst, yDst, xDst + width, yDst + height);\n\n\tsrc = GFX_Screen_Get_ByIndex(screenSrc);'),
        ('\tGFX_Screen_SetDirty(screenDst, xDst, yDst, xDst + width, yDst + height);\n\n\tif (width == SCREEN_WIDTH)',
         '\tDUNE_HD(DuneHD_Copy(screenSrc, screenDst, xSrc, ySrc, xDst, yDst, width, height, false));\n\tGFX_Screen_SetDirty(screenDst, xDst, yDst, xDst + width, yDst + height);\n\n\tif (width == SCREEN_WIDTH)'),
        ('\tGFX_Screen_SetDirty(SCREEN_0, left, top, left + width, top + height);\n\n\twhile (height-- != 0)',
         '\tDUNE_HD(DuneHD_BufferRestore(buffer, left, top, width, height));\n\tGFX_Screen_SetDirty(SCREEN_0, left, top, left + width, top + height);\n\n\twhile (height-- != 0)'),
        ('\tscreen += top * SCREEN_WIDTH + left;\n\n\twhile (height-- != 0)',
         '\tscreen += top * SCREEN_WIDTH + left;\n\tDUNE_HD(DuneHD_BufferSave(buffer, left, top, width, height));\n\n\twhile (height-- != 0)'),
        ('\t\t\t\tif (left != 0) *wptr = left;',
         '\t\t\t\tif (left != 0) { *wptr = left; DUNE_HD(DuneHD_WritePixel(wptr, SCREEN_ACTIVE)); }'),
        ('\t\t\t\tif (right != 0) *wptr = right;',
         '\t\t\t\tif (right != 0) { *wptr = right; DUNE_HD(DuneHD_WritePixel(wptr, SCREEN_ACTIVE)); }'),
        ('\t} else {\n\t\tfor (j = 0; j < s_tileHeight; j++) {',
         '\t} else {\n\t\tDUNE_HD(DuneHD_Dirty(SCREEN_ACTIVE, x, y, x + s_tileWidth * 2, y + s_tileHeight));\n\t\tfor (j = 0; j < s_tileHeight; j++) {'),
        ('\t*((uint8 *)GFX_Screen_GetActive() + y * SCREEN_WIDTH + x) = colour;',
         '\tDUNE_HD(DuneHD_Dirty(SCREEN_ACTIVE, x, y, x + 1, y + 1));\n\t*((uint8 *)GFX_Screen_GetActive() + y * SCREEN_WIDTH + x) = colour;'),
    ], 'DuneHD_Dirty')
    add('src/gui/mentat.c', [
        ('#include "mentat.h"', '#include "mentat.h"\n' + PREFIX),
        ('\tGUI_Mentat_Create_HelpScreen_Widgets();\n\n\tGUI_Mouse_Hide_Safe();\n\tGUI_Screen_Copy(0, 0, 0, 0, SCREEN_WIDTH / 8, SCREEN_HEIGHT, SCREEN_1, SCREEN_0);',
         '\tGUI_Mentat_Create_HelpScreen_Widgets();\n\n\tGUI_Mouse_Hide_Safe();\n\tDUNE_HD(DuneHD_MentatReplacement(1));\n\tGUI_Screen_Copy(0, 0, 0, 0, SCREEN_WIDTH / 8, SCREEN_HEIGHT, SCREEN_1, SCREEN_0);'),
        ('\tGUI_DrawInterfaceAndRadar(SCREEN_0);\n\n\tMusic_Play(Tools_RandomLCG_Range(0, 5) + 8);',
         '\tGUI_DrawInterfaceAndRadar(SCREEN_0);\n\tDUNE_HD(DuneHD_MentatReplacement(0));\n\n\tMusic_Play(Tools_RandomLCG_Range(0, 5) + 8);'),
    ], 'DuneHD_MentatReplacement')
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
        ('\tsize = File_Read_LE16(index);\n\n\tFile_Read(index, buffer, 8);',
         '\tDUNE_HD(DuneHD_Dirty(screenID, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT));\n\tsize = File_Read_LE16(index);\n\n\tFile_Read(index, buffer, 8);'),
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
    report = {'scope':'native renderer observation and presentation-only viewport picking; no simulation rule changes', 'files':[]}
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
