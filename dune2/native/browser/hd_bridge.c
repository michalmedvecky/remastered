/* Dune II HD presentation bridge, 2026-11-18. GPL-2.0-only.
 * Native draw-command observation; simulation and original raster stay intact.
 * Dirty rendering requires persistent per-owner caches, not per-frame lists.
 */
#include "hd_bridge.h"
#include <string.h>

#if defined(__EMSCRIPTEN__) || defined(DUNE_HD_BRIDGE_TEST)

enum { HD_UNITS = 102, HD_EFFECTS = 32, HD_OWNERS = 134,
       HD_OWNER_COMMANDS = 16, HD_COMMAND_WORDS = 16,
       HD_COMMAND_MAX = HD_OWNERS * HD_OWNER_COMMANDS };
enum { HD_ID, HD_X, HD_Y, HD_W, HD_H, HD_FLAGS,
       HD_CLIPX, HD_CLIPY, HD_CLIPW, HD_CLIPH,
       HD_REMAPCOUNT, HD_HASPAL, HD_HASREMAP, HD_HOUSE, HD_OWNER, HD_LAYER };
typedef struct HdCommand {
    int32_t v[HD_COMMAND_WORDS];
    uint8_t palette[16];
    uint8_t remap[256];
} HdCommand;
typedef char HdCommand_has_fixed_browser_ABI[(sizeof(HdCommand) == 336) ? 1 : -1];
typedef struct HdOwner {
    unsigned count;
    HdCommand commands[HD_OWNER_COMMANDS];
} HdOwner;
typedef struct HdUiCommand {
    HdCommand command;
    int32_t screen, window;
    uint32_t serial;
} HdUiCommand;
typedef char HdUiCommand_has_fixed_browser_ABI[(sizeof(HdUiCommand) == 348) ? 1 : -1];
static HdOwner s_owners[HD_OWNERS];
static HdCommand s_commands[HD_COMMAND_MAX];
static uint16_t s_tiles[15 * 10 * 4];
static HdUiCommand s_uiCommands[128];
static unsigned s_uiCount, s_uiSerial;
static int s_owner = -1, s_layer, s_house, s_scope;
static int s_cameraX, s_cameraY, s_viewportSeen, s_gameTimer;
static int s_cursorId, s_hotX, s_hotY;
static int s_spriteCount;
static unsigned s_overflow;

static void hd_reset(void)
{
    memset(s_owners, 0, sizeof(s_owners));
    s_owner = -1;
    s_scope = 0;
    s_viewportSeen = 0;
}

void DuneHD_SetOwner(int owner, int layer, int house)
{
    s_owner = owner >= 0 && owner < HD_OWNERS ? owner : -1;
    s_layer = layer;
    s_house = house;
    if (s_owner >= 0) s_owners[s_owner].count = 0;
}

/* Store top-left coordinates in world pixels. A stationary cached command
 * then follows a changed camera without inventing another native draw. */
static void hd_record(const HdCommand *command)
{
    HdOwner *owner;
    HdCommand *out;
    if (!s_scope || s_owner < 0) return;
    owner = &s_owners[s_owner];
    if (owner->count >= HD_OWNER_COMMANDS) { s_overflow++; return; }
    out = &owner->commands[owner->count++];
    *out = *command;
    out->v[HD_X] += s_cameraX * 16;
    out->v[HD_Y] += s_cameraY * 16 - 40;
    out->v[HD_HOUSE] = s_house;
    out->v[HD_OWNER] = s_owner;
    out->v[HD_LAYER] = s_layer;
}

static void hd_record_ui(const HdCommand *command, int screen, int window)
{
    unsigned i;
    HdUiCommand *out;
    for (i = 0; i < s_uiCount; i++) {
        HdUiCommand *entry = &s_uiCommands[i];
        if (entry->screen == screen && entry->window == window &&
            entry->command.v[HD_ID] == command->v[HD_ID] &&
            entry->command.v[HD_X] == command->v[HD_X] &&
            entry->command.v[HD_Y] == command->v[HD_Y]) break;
    }
    if (i == s_uiCount) {
        if (s_uiCount == 128) {
            memmove(s_uiCommands, s_uiCommands + 1, sizeof(s_uiCommands[0]) * 127);
            i = 127;
        } else s_uiCount++;
    }
    out = &s_uiCommands[i];
    out->command = *command;
    out->command.v[HD_OWNER] = -1;
    out->command.v[HD_LAYER] = 4;
    out->screen = screen;
    out->window = window;
    out->serial = ++s_uiSerial;
}

/* Read-only engine collection: prune presentation caches/reticles, preserve order
 * worm -> ground -> explosions -> air and actual Unit_Find allocation order. */
static unsigned hd_collect(const uint8_t alive[HD_OWNERS], int cameraX,
                           int cameraY, int selected,
                           const uint16_t order[HD_OWNERS])
{
    unsigned count = 0, owner, i, position;
    int layer;
    for (owner = 0; owner < HD_OWNERS; owner++) {
        if (!alive[owner]) s_owners[owner].count = 0;
    }
    for (layer = 0; layer < 4; layer++) {
        for (position = 0; position < HD_OWNERS; position++) {
            owner = order[position];
            if (owner >= HD_OWNERS) continue;
            if (!alive[owner]) continue;
            for (i = 0; i < s_owners[owner].count; i++) {
                HdCommand *src = &s_owners[owner].commands[i];
                HdCommand *dst;
                if (src->v[HD_LAYER] != layer) continue;
                if (src->v[HD_ID] == 6 && (int)owner != selected) continue;
                dst = &s_commands[count++];
                *dst = *src;
                dst->v[HD_X] -= cameraX * 16;
                dst->v[HD_Y] += 40 - cameraY * 16;
            }
        }
    }
    return count;
}

#ifndef DUNE_HD_BRIDGE_TEST
#include <emscripten.h>
#include "types.h"
#include "opendune.h"
#include "gfx.h"
#include "map.h"
#include "tile.h"
#include "sprites.h"
#include "unit.h"
#include "house.h"
#include "pool/unit.h"
#include "explosion.h"
#include "gui/gui.h"
#include "input/mouse.h"
#include "timer.h"

static int hd_sprite_id(const void *sprite)
{
    int i;
    if (g_sprites == NULL || sprite == NULL) return -1;
    /* Sprites_Init loads the fixed V1.07 table, IDs 0 through 524. */
    for (i = 0; i < s_spriteCount; i++) if (g_sprites[i] == sprite) return i;
    return -1;
}

void DuneHD_BeginViewport(void)
{
    s_cameraX = Tile_GetPackedX(g_viewportPosition);
    s_cameraY = Tile_GetPackedY(g_viewportPosition);
    s_owner = -1;
    s_scope = 1;
}

void DuneHD_EndViewport(void)
{
    s_scope = 0;
    s_owner = -1;
    s_viewportSeen = 1;
}

void DuneHD_Timer(int enabled) { s_gameTimer = enabled != 0; }

void DuneHD_SpritesReady(int count)
{
    s_spriteCount = count >= 0 && count <= 525 ? count : 0;
    if (s_spriteCount == 0) { s_uiCount = 0; hd_reset(); }
}

void DuneHD_Cursor(const void *sprite, int hotX, int hotY)
{
    s_cursorId = hd_sprite_id(sprite);
    s_hotX = hotX;
    s_hotY = hotY;
}

void DuneHD_CaptureSprite(const void *sprite, int screen, int window, int x, int y,
                         int width, int height, int flags,
                         const uint8_t *palette, const uint8_t *remap,
                         int remapCount, int clipX, int clipY,
                         int clipWidth, int clipHeight)
{
    HdCommand command;
    int id;
    if (width <= 0 || height <= 0) return;
    id = hd_sprite_id(sprite);
    if (id < 0) return;
    memset(&command, 0, sizeof(command));
    command.v[HD_ID] = id;
    command.v[HD_X] = x;
    command.v[HD_Y] = y;
    command.v[HD_W] = width;
    command.v[HD_H] = height;
    command.v[HD_FLAGS] = flags;
    command.v[HD_CLIPX] = clipX;
    command.v[HD_CLIPY] = clipY;
    command.v[HD_CLIPW] = clipWidth;
    command.v[HD_CLIPH] = clipHeight;
    command.v[HD_REMAPCOUNT] = remapCount;
    command.v[HD_HASPAL] = palette != NULL;
    command.v[HD_HASREMAP] = remap != NULL && remapCount != 0 && (flags & 0x100) != 0;
    if (palette != NULL) memcpy(command.palette, palette, 16);
    if (command.v[HD_HASREMAP]) memcpy(command.remap, remap, 256);
    if (screen == SCREEN_ACTIVE) {
        for (screen = SCREEN_0; screen <= SCREEN_3; screen++) {
            if (GFX_Screen_IsActive((Screen)screen)) break;
        }
    }
    if (s_scope && s_owner >= 0 && window == 2) hd_record(&command);
    else hd_record_ui(&command,screen,window);
}

EM_JS(void, hd_present_js,
      (const uint8_t *pixels, const uint8_t *palette, const uint16_t *tiles,
       const HdCommand *commands, int count, int visible, int viewport,
       int selected, int position, int width, int height, int state, int type,
       int tick, int house, int cursor, int mouseX, int mouseY, int hotX,
       int hotY, int mouseVisible, const char *message, int overflow,
       int screenOffset, int veiledTileId, const HdUiCommand *ui, int uiCount), {
    const callback = Module['duneHdPresent'];
    if (typeof callback !== 'function') return;
    const result = [];
    // The ABI is 16 int32 fields + 16 palette bytes + 256 remap bytes.
    const commandAt = p => {
        const v = HEAP32.subarray(p >> 2, (p >> 2) + 16);
        return {id:v[0],x:v[1],y:v[2],width:v[3],height:v[4],flags:v[5],
            clip:[v[6],v[7],v[8],v[9]],remapCount:v[10],
            palette:v[11] ? HEAPU8.slice(p+64,p+80) : null,
            remap:v[12] ? HEAPU8.slice(p+80,p+336) : null,
            house:v[13],owner:v[14],layer:v[15]};
    };
    for (let i = 0; i < count; i++) result.push(commandAt(commands + i * 336));
    const uiCommands = [];
    for (let i = 0; i < uiCount; i++) {
        const p = ui + i * 348;
        uiCommands.push(Object.assign(commandAt(p),{screen:HEAP32[(p+336)>>2],
            window:HEAP32[(p+340)>>2],serial:HEAPU32[(p+344)>>2]}));
    }
    uiCommands.sort((a,b)=>a.serial-b.serial);
    callback({version:1,pixels:HEAPU8.slice(pixels,pixels+64000),
        palette:HEAPU8.slice(palette,palette+768),
        tiles:HEAPU16.slice(tiles>>1,(tiles>>1)+600),commands:result,
        worldVisible:!!visible,viewport:viewport,selectedUnit:selected,
        selection:{position:position,width:width,height:height,state:state,type:type},
        gameTick:tick,playerHouse:house,
        cursor:{id:cursor,x:mouseX,y:mouseY,hotX:hotX,hotY:hotY,visible:!!mouseVisible},
        message:message ? UTF8ToString(message) : "",cacheOverflow:overflow,
        screenOffset:screenOffset,veiledTileId:veiledTileId,uiCommands:uiCommands});
});

EM_JS(int, hd_wants_frame, (), {
    return typeof Module['duneHdPresent'] === 'function' && Module['duneHdEnabled'] !== false;
});

void DuneHD_Present(int screenOffset)
{
    uint8_t alive[HD_OWNERS] = {0};
    uint8_t ordered[HD_UNITS] = {0};
    uint16_t order[HD_OWNERS];
    int x, y, i, visible, selected;
    unsigned count, orderCount = 0;
    if (g_gameMode != GM_NORMAL) hd_reset();
    if (!hd_wants_frame()) return;
    visible = g_gameMode == GM_NORMAL && s_viewportSeen && s_gameTimer && !s_scope &&
              g_selectionType >= SELECTIONTYPE_TARGET &&
              g_selectionType <= SELECTIONTYPE_STRUCTURE && screenOffset == 0;
    memset(s_tiles, 0, sizeof(s_tiles));
    selected = g_unitSelected != NULL ? g_unitSelected->o.index : -1;
    if (visible) {
        /* Unit_Find iterates insertion/recount order, not always unit index. */
        for (i = 0; i < g_unitFindCount; i++) {
            Unit *u = g_unitFindArray[i];
            if (u == NULL || u->o.index >= HD_UNITS || ordered[u->o.index]) continue;
            order[orderCount++] = u->o.index;
            ordered[u->o.index] = 1;
        }
        for (i = 0; i < HD_UNITS; i++) if (!ordered[i]) order[orderCount++] = i;
        for (i = 0; i < HD_EFFECTS; i++) order[orderCount++] = HD_UNITS + i;
        for (y = 0; y < 10; y++) for (x = 0; x < 15; x++) {
            unsigned packed = g_viewportPosition + (y << 6) + x;
            unsigned at = (y * 15 + x) * 4;
            if (packed >= 4096) continue;
            s_tiles[at] = g_map[packed].groundTileID;
            s_tiles[at+1] = g_map[packed].overlayTileID;
            s_tiles[at+2] = g_map[packed].houseID;
            s_tiles[at+3] = g_map[packed].isUnveiled || g_debugScenario;
        }
        for (i = 0; i < HD_UNITS; i++) {
            Unit *u = Unit_Get_ByIndex(i);
            unsigned packed = Tile_PackTile(u->o.position);
            if (!u->o.flags.s.used || u->o.flags.s.isNotOnMap || packed >= 4096) continue;
            if (!g_map[packed].isUnveiled && !g_debugScenario) continue;
            if (!Map_IsPositionInViewport(u->o.position,NULL,NULL) &&
                !(u->o.type == UNIT_SANDWORM &&
                  (Map_IsPositionInViewport(u->targetLast,NULL,NULL) ||
                   Map_IsPositionInViewport(u->targetPreLast,NULL,NULL)))) continue;
            alive[i] = 1;
        }
        for (i = 0; i < HD_EFFECTS; i++) {
            Explosion *e = Explosion_Get_ByIndex(i);
            unsigned packed = Tile_PackTile(e->position);
            if (e->commands == NULL || e->spriteID == 0 || packed >= 4096) continue;
            if (!g_map[packed].isUnveiled && !g_debugScenario) continue;
            if (!Map_IsPositionInViewport(e->position,NULL,NULL)) continue;
            alive[HD_UNITS+i] = 1;
        }
    }
    count = visible ? hd_collect(alive,Tile_GetPackedX(g_viewportPosition),
                                 Tile_GetPackedY(g_viewportPosition),selected,order) : 0;
    /* SDL's framebuffer reserves four extra scanlines for credits scrolling.
     * Valid original offsets stay within those allocated bytes. */
    hd_present_js((const uint8 *)GFX_Screen_Get_ByIndex(SCREEN_0) +
                  ((screenOffset >= 0 && screenOffset <= 320) ? screenOffset * 4 : 0),
                  g_paletteActive,s_tiles,
                  s_commands,count,visible,g_viewportPosition,selected,
                  g_selectionRectanglePosition,g_selectionWidth,g_selectionHeight,
                  g_selectionState,g_selectionType,g_timerGame,g_playerHouseID,
                  s_cursorId,g_mouseX,g_mouseY,s_hotX,s_hotY,
                  g_mouseHiddenDepth == 0 && g_mouseDisabled == 0,
                  (g_viewportMessageCounter & 1) ? g_viewportMessageText : NULL,
                  s_overflow,screenOffset,g_veiledTileID,s_uiCommands,s_uiCount);
}
#endif /* !DUNE_HD_BRIDGE_TEST */
#endif /* browser or cache regression */
