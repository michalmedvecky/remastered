/* Dune II HD presentation bridge, 2026-11-18. GPL-2.0-only.
 * Native draw-command observation; simulation and original raster stay intact.
 * Dirty rendering requires persistent per-owner caches, not per-frame lists.
 */
#include "hd_bridge.h"
#include <string.h>
#include <stddef.h>
#include <stdlib.h>

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
static unsigned s_uiSerial;

/* A scene describes pixels already drawn, never the ahead-of-raster live map. */
typedef struct HdWorld {
    uint16_t tiles[15 * 10 * 4];
    uint16_t overscan[17 * 12 * 4];
    int overscanX,overscanY;
    HdCommand commands[HD_COMMAND_MAX];
    unsigned count, revision;
    int valid, viewport, tick, selected, position, width, height, state, type, debug, epoch;
} HdWorld;
static HdWorld s_worldFront, s_worldBack;
static uint16_t s_rasterTiles[4096 * 4];
static unsigned s_worldRevision,s_worldEpoch;
static int s_worldPending;

/* Per-pixel UI provenance follows real screen copies. Dirty writes invalidate
 * provenance; glyph writes register only pixels the native font actually wrote.
 * The present-time index witness also rejects uninstrumented/raw raster writes. */
enum { HD_UI_RECORDS = 4096, HD_SCREEN_PIXELS = 64000 };
typedef struct HdUiRecord {
    int32_t kind, character, font, width, height, advance, widget, type, pressed;
    uint32_t serial, totalInk;
    uint8_t colours[16];
    uint32_t token,runToken,runIndex;
} HdUiRecord;
typedef char HdUiRecord_ABI[(sizeof(HdUiRecord) == 72) ? 1 : -1];
enum { HD_TEXT_RUNS=512, HD_TEXT_GLYPHS=128 };
typedef struct HdTextGlyph { int16_t character,x,y,width,height,advance; } HdTextGlyph;
typedef struct HdTextRun {
    uint32_t token,serial,count,font,fontHeight,totalInk;
    uint8_t colours[16];
    HdTextGlyph glyphs[HD_TEXT_GLYPHS];
} HdTextRun;
typedef char HdTextRun_ABI[(sizeof(HdTextRun)==1576)?1:-1];
static HdTextRun s_textRuns[HD_TEXT_RUNS];
static unsigned s_textReferences[HD_TEXT_RUNS],s_textNext;
static uint32_t s_textOwner[4][HD_SCREEN_PIXELS],s_textPaint[4][HD_SCREEN_PIXELS];
static uint16_t s_textLocal[4][HD_SCREEN_PIXELS];
static int s_textDepth,s_textCurrent=-1,s_textIndex=-1,s_textAdvance,s_textScreen;
static void hd_text_cover_current(int screen);
static uint8_t s_uiPixels[HD_SCREEN_PIXELS];
static int s_uiCursorRestored;

static void hd_text_reference(uint32_t token,int delta)
{
    unsigned id;
    if(!token)return;
    id=(token-1)%HD_TEXT_RUNS;
    if(s_textRuns[id].token!=token)return;
    if(delta>0)s_textReferences[id]++;
    else if(s_textReferences[id])s_textReferences[id]--;
}
static void hd_text_set_owner(int screen,int at,uint32_t token)
{
    hd_text_reference(s_textOwner[screen][at],-1);
    s_textOwner[screen][at]=token;
    hd_text_reference(token,1);
}
static int hd_text_run(void)
{
    unsigned id=0,tries,token;
    for(tries=0;tries<HD_TEXT_RUNS;tries++){
        id=s_textNext++%HD_TEXT_RUNS;
        if(!s_textReferences[id])break;
    }
    if(tries==HD_TEXT_RUNS)return -1;
    token=s_textRuns[id].token;
    token=token?token+HD_TEXT_RUNS:id+1;
    if(!token)return -1;
    memset(&s_textRuns[id],0,sizeof(s_textRuns[id]));
    s_textRuns[id].token=token;s_textRuns[id].serial=++s_uiSerial;
    return (int)id;
}
void DuneHD_TextBegin(int advance)
{
    if(s_textDepth++==0){s_textCurrent=-1;s_textIndex=-1;s_textAdvance=advance;}
}
static void hd_text_glyph(int character,int x,int y,int width,int height,int advance,int font,const uint8_t colours[16])
{
    HdTextRun *run;
    HdTextGlyph *glyph;
    int newLine=s_textCurrent<0;
    if(!s_textDepth||character==0)return;
    if(!newLine){
        run=&s_textRuns[s_textCurrent];
        newLine=run->count>=HD_TEXT_GLYPHS||run->font!=(unsigned)font||run->fontHeight!=(unsigned)height||
                memcmp(run->colours,colours,16)||
                (run->count&&(run->glyphs[run->count-1].y!=y||run->glyphs[run->count-1].x>x));
    }
    if(newLine){
        if(s_textCurrent>=0)hd_text_cover_current(s_textScreen);
        s_textCurrent=hd_text_run();s_textIndex=-1;
        if(s_textCurrent<0)return;
        run=&s_textRuns[s_textCurrent];run->font=font;run->fontHeight=height;memcpy(run->colours,colours,16);
    }
    run=&s_textRuns[s_textCurrent];s_textIndex=(int)run->count++;
    glyph=&run->glyphs[s_textIndex];glyph->character=character;glyph->x=x;glyph->y=y;
    glyph->width=width;glyph->height=height;glyph->advance=s_textAdvance>0?s_textAdvance:advance;
}
/* Coverage describes the complete native text layout rectangle, not the old
 * glyph bitmap. Actual overwrites/copies clip this plane without reflowing text. */
static void hd_text_cover_current(int screen)
{
    HdTextRun *run;
    int i,x,y,left=320,top=200,right=0,bottom=0;
    if(s_textCurrent<0||screen<0||screen>3)return;
    run=&s_textRuns[s_textCurrent];
    if(!run->totalInk)return;
    for(i=0;i<(int)run->count;i++){
        HdTextGlyph *g=&run->glyphs[i];
        if(g->x<left)left=g->x;if(g->y<top)top=g->y;
        if(g->x+g->width>right)right=g->x+g->width;
        if(g->y+g->height>bottom)bottom=g->y+g->height;
    }
    for(y=top<0?0:top;y<bottom&&y<200;y++)for(x=left<0?0:left;x<right&&x<320;x++){
        int at=y*320+x;hd_text_set_owner(screen,at,run->token);
        s_textLocal[screen][at]=(uint16_t)at;s_textPaint[screen][at]=run->serial;
    }
}

static void hd_text_end(int screen)
{
    if(!s_textDepth)return;
    if(--s_textDepth==0){hd_text_cover_current(screen);s_textCurrent=-1;s_textIndex=-1;s_textAdvance=0;}
}

static HdUiRecord s_uiRecords[HD_UI_RECORDS];
static uint32_t s_uiOwner[4][HD_SCREEN_PIXELS];
static uint16_t s_uiLocal[4][HD_SCREEN_PIXELS];
static uint8_t s_uiValue[4][HD_SCREEN_PIXELS];
static uint32_t s_uiPaint[4][HD_SCREEN_PIXELS];
static unsigned s_uiRecordNext, s_uiLedgerOverflow;
static unsigned s_uiReferences[HD_UI_RECORDS];
static HdCommand s_uiSpriteCommands[HD_UI_RECORDS], s_uiSpritePending;
static int s_uiSpritePendingValid, s_uiSpriteScreen, s_uiSpriteRecord=-1, s_uiSpritePrecise,s_uiSpriteCursor;
static int s_glyphWrite, s_copyDirty, s_notifyOnly, s_widgetBorderDepth;
static int s_copyScreen, s_copyX, s_copyY, s_copyW, s_copyH;
static unsigned s_mentatReplacement;

static int32_t s_viewOffsetXQ8,s_viewOffsetYQ8;
static int s_viewOffsetViewport=-1;
static void hd_set_view_offset(int32_t x,int32_t y,int viewport)
{
    s_viewOffsetXQ8=x;s_viewOffsetYQ8=y;
    /* N is explicitly supplied from the rendered frame. It may be older than
     * the current C commit, and must remain pinned until the next presentation. */
    s_viewOffsetViewport=viewport>=0&&viewport<4096?viewport:-1;
    if(s_viewOffsetViewport<0)s_viewOffsetXQ8=s_viewOffsetYQ8=0;
}
static int hd_floor_tile_q8(int pixel,int32_t offset)
{
    int64_t value=(int64_t)pixel*256+offset;
    return value>=0?(int)(value/4096):-(int)((-value+4095)/4096);
}
/* Return0 for the exact original picker branch;1 for adapted/invalid input.
 * Physical mouse coordinates and widget dispatch never pass through this. */
int DuneHD_ViewportPick(int x,int y,int originX,int originY,uint16_t *packed)
{
    int wx,wy;
    if(!s_viewOffsetXQ8&&!s_viewOffsetYQ8)return 0;
    if(s_viewOffsetViewport>=0){originX=s_viewOffsetViewport&63;originY=(s_viewOffsetViewport>>6)&63;}
    wx=originX+hd_floor_tile_q8(x,s_viewOffsetXQ8);
    wy=originY+hd_floor_tile_q8(y,s_viewOffsetYQ8);
    *packed=(wx<0||wx>=64||wy<0||wy>=64)?0xffff:(uint16_t)(wy*64+wx);
    return 1;
}

typedef void (*HdTileReader)(unsigned packed,uint16_t out[4],void *context);
static void hd_capture_overscan(HdWorld *world,int cameraX,int cameraY,HdTileReader readTile,void *context)
{
    int x,y;
    world->overscanX=cameraX-1;world->overscanY=cameraY-1;
    memset(world->overscan,0,sizeof(world->overscan));
    for(y=0;y<12;y++)for(x=0;x<17;x++){
        int wx=world->overscanX+x,wy=world->overscanY+y;
        unsigned at=(y*17+x)*4;
        if(wx<0||wx>=64||wy<0||wy>=64)continue;
        if(x>=1&&x<=15&&y>=1&&y<=10){memcpy(&world->overscan[at],&world->tiles[((y-1)*15+x-1)*4],8);continue;}
        readTile((unsigned)(wy*64+wx),&world->overscan[at],context);
    }
}

void DuneHD_MentatReplacement(int enter)
{
    if(enter)s_mentatReplacement++;
    else if(s_mentatReplacement)s_mentatReplacement--;
}
static int hd_world_visible(int normal,int selectionEligible,int offset)
{
    return normal&&s_worldFront.valid&&selectionEligible&&offset==0&&!s_mentatReplacement;
}

static void hd_promote_world(void)
{
    if (!s_worldBack.valid) return;
    s_worldBack.revision = ++s_worldRevision;
    s_worldFront = s_worldBack;
    s_worldPending = 0;
}

static unsigned hd_ui_record(void)
{
    unsigned id=0, attempt, token;
    /* Keep untouched visible labels/portraits indefinitely. Only records whose
     * ownership disappeared from every screen are normally recycled. */
    for(attempt=0;attempt<HD_UI_RECORDS;attempt++){
        id=s_uiRecordNext++ % HD_UI_RECORDS;
        if(!s_uiReferences[id])break;
    }
    if(attempt==HD_UI_RECORDS){
        unsigned i;
        for(i=1;i<HD_UI_RECORDS;i++)
            if(s_uiRecords[i].serial<s_uiRecords[id].serial)id=i;
        s_uiLedgerOverflow++;
    }
    token=s_uiRecords[id].token;
    token=token ? token+HD_UI_RECORDS : id+1;
    if(!token){memset(s_uiOwner,0,sizeof(s_uiOwner));memset(s_uiReferences,0,sizeof(s_uiReferences));token=id+1;}
    memset(&s_uiRecords[id],0,sizeof(s_uiRecords[id]));
    s_uiRecords[id].serial=++s_uiSerial;s_uiRecords[id].token=token;
    s_uiReferences[id]=0;
    return id;
}

static void hd_ui_reference(uint32_t token, int delta)
{
    unsigned id;
    if(!token)return;
    id=(token-1)%HD_UI_RECORDS;
    if(s_uiRecords[id].token!=token)return;
    if(delta>0)s_uiReferences[id]++;
    else if(s_uiReferences[id])s_uiReferences[id]--;
    hd_text_reference(s_uiRecords[id].runToken,delta);
}

static void hd_ui_set_owner(int screen, int at, uint32_t token)
{
    hd_text_set_owner(screen,at,0);
    hd_ui_reference(s_uiOwner[screen][at],-1);
    s_uiOwner[screen][at]=token;
    hd_ui_reference(token,1);
}

void DuneHD_NotifyOnly(int enter)
{
    if(enter)s_notifyOnly++;
    else if(s_notifyOnly)s_notifyOnly--;
}

static void hd_ui_dirty(int screen, int x, int y, int w, int h)
{
    int xx, yy;
    if (s_copyDirty && screen == s_copyScreen && x == s_copyX && y == s_copyY &&
        w == s_copyW && h == s_copyH) { s_copyDirty = 0; return; }
    s_copyDirty = 0;
    if (s_glyphWrite || s_notifyOnly || screen < 0 || screen > 3) return;
    for (yy = y < 0 ? 0 : y; yy < y+h && yy < 200; yy++)
        for (xx = x < 0 ? 0 : x; xx < x+w && xx < 320; xx++)
            hd_ui_set_owner(screen,yy*320+xx,0);
}

static void hd_ui_copy(int src, int dst, int sx, int sy, int dx, int dy,
                       int w, int h, int skipNull, const uint8_t *source)
{
    static uint32_t owner[HD_SCREEN_PIXELS],textOwner[HD_SCREEN_PIXELS];
    static uint16_t local[HD_SCREEN_PIXELS],textLocal[HD_SCREEN_PIXELS];
    static uint8_t value[HD_SCREEN_PIXELS];
    int x, y, at;
    unsigned serial = ++s_uiSerial;
    if (src < 0 || src > 3 || dst < 0 || dst > 3 || w <= 0 || h <= 0 || w > 320 || h > 200) return;
    /* Snapshot first: the engine uses memmove, including same-screen overlap. */
    for (y=0; y<h; y++) for (x=0; x<w; x++) {
        int from=(sy+y)*320+sx+x, to=y*w+x;
        if (sx+x<0 || sx+x>=320 || sy+y<0 || sy+y>=200) { owner[to]=0;local[to]=0;value[to]=0;textOwner[to]=0;textLocal[to]=0;continue; }
        owner[to]=s_uiOwner[src][from]; local[to]=s_uiLocal[src][from];
        value[to]=s_uiValue[src][from];textOwner[to]=s_textOwner[src][from];textLocal[to]=s_textLocal[src][from];
    }
    for (y=0; y<h; y++) for (x=0; x<w; x++) {
        int from=(sy+y)*320+sx+x, to=(dy+y)*320+dx+x;
        if (dx+x<0 || dx+x>=320 || dy+y<0 || dy+y>=200) continue;
        if (skipNull && source && from>=0 && from<HD_SCREEN_PIXELS && source[from]==0) continue;
        at=y*w+x;
        hd_ui_set_owner(dst,to,owner[at]);s_uiLocal[dst][to]=local[at];
        s_uiValue[dst][to]=value[at];s_uiPaint[dst][to]=serial;
        hd_text_set_owner(dst,to,textOwner[at]);s_textLocal[dst][to]=textLocal[at];s_textPaint[dst][to]=serial;
    }
    s_copyDirty=1;s_copyScreen=dst;s_copyX=dx;s_copyY=dy;s_copyW=w;s_copyH=h;
}

typedef struct HdUiBuffer {
    const void *key;
    unsigned width,height;
    int x,y,mouse;
    uint32_t *owner,*paint,*textOwner,*textPaint;
    uint16_t *local,*textLocal;
    uint8_t *value;
} HdUiBuffer;
static HdUiBuffer s_uiBuffers[8];

static void hd_ui_buffer_release(HdUiBuffer *buffer)
{
    unsigned i;
    if(buffer->owner)for(i=0;i<buffer->width*buffer->height;i++)hd_ui_reference(buffer->owner[i],-1);
    if(buffer->textOwner)for(i=0;i<buffer->width*buffer->height;i++)hd_text_reference(buffer->textOwner[i],-1);
    free(buffer->owner);free(buffer->paint);free(buffer->local);free(buffer->value);free(buffer->textOwner);free(buffer->textLocal);free(buffer->textPaint);
    memset(buffer,0,sizeof(*buffer));
}

static void hd_ui_buffer_save(const void *key,int x,int y,int width,int height)
{
    HdUiBuffer *buffer=NULL;
    int i,xx,yy,at;
    unsigned n;
    if(!key||width<=0||height<=0||width>320||height>200)return;
    for(i=0;i<8;i++)if(s_uiBuffers[i].key==key){buffer=&s_uiBuffers[i];break;}
    if(!buffer)for(i=0;i<8;i++)if(!s_uiBuffers[i].key){buffer=&s_uiBuffers[i];break;}
    if(!buffer){buffer=&s_uiBuffers[0];s_uiLedgerOverflow++;}
    hd_ui_buffer_release(buffer);
    n=(unsigned)(width*height);
    buffer->owner=(uint32_t *)calloc(n,sizeof(uint32_t));
    buffer->paint=(uint32_t *)malloc(n*sizeof(uint32_t));
    buffer->local=(uint16_t *)malloc(n*sizeof(uint16_t));
    buffer->value=(uint8_t *)malloc(n);
    buffer->textOwner=(uint32_t *)calloc(n,sizeof(uint32_t));buffer->textLocal=(uint16_t *)malloc(n*sizeof(uint16_t));buffer->textPaint=(uint32_t *)malloc(n*sizeof(uint32_t));
    if(!buffer->owner||!buffer->paint||!buffer->local||!buffer->value||!buffer->textOwner||!buffer->textLocal||!buffer->textPaint){
        hd_ui_buffer_release(buffer);s_uiLedgerOverflow++;return;
    }
    buffer->key=key;buffer->width=width;buffer->height=height;buffer->x=x;buffer->y=y;
    for(yy=0;yy<height;yy++)for(xx=0;xx<width;xx++){
        int from=(y+yy)*320+x+xx;
        at=yy*width+xx;
        if(x+xx<0||x+xx>=320||y+yy<0||y+yy>=200){buffer->local[at]=0;buffer->value[at]=0;buffer->paint[at]=0;buffer->textLocal[at]=0;buffer->textPaint[at]=0;continue;}
        buffer->owner[at]=s_uiOwner[0][from];buffer->local[at]=s_uiLocal[0][from];
        buffer->value[at]=s_uiValue[0][from];buffer->paint[at]=s_uiPaint[0][from];
        hd_ui_reference(buffer->owner[at],1);
        buffer->textOwner[at]=s_textOwner[0][from];buffer->textLocal[at]=s_textLocal[0][from];buffer->textPaint[at]=s_textPaint[0][from];hd_text_reference(buffer->textOwner[at],1);
    }
}

static void hd_ui_buffer_mouse(const void *key)
{
    unsigned i;for(i=0;i<8;i++)if(s_uiBuffers[i].key==key){s_uiBuffers[i].mouse=1;break;}
}

static void hd_ui_buffer_restore(const void *key,int x,int y,int width,int height,const uint8_t *pixels)
{
    HdUiBuffer *buffer=NULL;
    int i,xx,yy;
    unsigned serial;
    for(i=0;i<8;i++)if(s_uiBuffers[i].key==key){buffer=&s_uiBuffers[i];break;}
    if(!buffer||buffer->width!=(unsigned)width||buffer->height!=(unsigned)height)return;
    serial=buffer->mouse?s_uiSerial:++s_uiSerial;
    for(yy=0;yy<height;yy++)for(xx=0;xx<width;xx++){
        int at=yy*width+xx,to=(y+yy)*320+x+xx;
        uint32_t token=buffer->owner[at];
        if(x+xx<0||x+xx>=320||y+yy<0||y+yy>=200)continue;
        if(pixels&&pixels[at]!=buffer->value[at])token=0;
        hd_ui_set_owner(0,to,token);
        s_uiLocal[0][to]=buffer->local[at];s_uiValue[0][to]=buffer->value[at];
        s_uiPaint[0][to]=buffer->mouse?buffer->paint[at]:serial;
        hd_text_set_owner(0,to,buffer->textOwner[at]);s_textLocal[0][to]=buffer->textLocal[at];s_textPaint[0][to]=buffer->mouse?buffer->textPaint[at]:serial;
    }
    s_copyDirty=1;s_copyScreen=0;s_copyX=x;s_copyY=y;s_copyW=width;s_copyH=height;
    hd_ui_buffer_release(buffer); /* Native callers consume these backups once. */
}

static void hd_ui_witness(const uint8_t *pixels,int offset,int mouseVisible,const void *mouseBuffer)
{
    int i,x,y;
    memcpy(s_uiPixels,pixels,HD_SCREEN_PIXELS);s_uiCursorRestored=0;
    if(offset||!mouseVisible||!mouseBuffer)return;
    for(i=0;i<8;i++)if(s_uiBuffers[i].key==mouseBuffer){
        HdUiBuffer *b=&s_uiBuffers[i];const uint8_t *under=(const uint8_t *)mouseBuffer;
        for(y=0;y<(int)b->height;y++)for(x=0;x<(int)b->width;x++)
            if(b->x+x>=0&&b->x+x<320&&b->y+y>=0&&b->y+y<200)
                s_uiPixels[(b->y+y)*320+b->x+x]=under[y*b->width+x];
        s_uiCursorRestored=1;break;
    }
}

static void hd_ui_ink(unsigned id, int screen, int x, int y, int lx, int ly, int value)
{
    int at;
    if (screen<0 || screen>3 || x<0 || x>=320 || y<0 || y>=200) return;
    at=y*320+x;
    hd_ui_set_owner(screen,at,s_uiRecords[id].token);
    s_uiLocal[screen][at]=(uint16_t)(ly*320+lx);
    s_uiValue[screen][at]=(uint8_t)value;
    s_uiPaint[screen][at]=s_uiRecords[id].serial;
    s_uiRecords[id].totalInk++;
    if(s_uiRecords[id].runToken){unsigned run=(s_uiRecords[id].runToken-1)%HD_TEXT_RUNS;if(s_textRuns[run].token==s_uiRecords[id].runToken)s_textRuns[run].totalInk++;}
}
static HdUiCommand s_uiCommands[128];
static unsigned s_uiCount;
static int s_owner = -1, s_layer, s_house, s_scope;
static int s_cameraX, s_cameraY, s_viewportSeen, s_gameTimer;
static int s_cursorId, s_hotX, s_hotY;
static int s_spriteCount;
static int s_lastScreenOffset;
static unsigned s_overflow;

static void hd_reset(void)
{
    if(s_worldFront.valid||s_worldBack.valid||s_viewportSeen)s_worldEpoch++;
    memset(s_owners, 0, sizeof(s_owners));
    s_owner = -1;
    s_scope = 0;
    s_viewportSeen = 0;
    s_worldFront.valid = s_worldBack.valid = s_worldPending = 0;
    memset(s_rasterTiles, 0, sizeof(s_rasterTiles));
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

static void hd_border_record(int widget,int type,int pressed,int fill,int schema,
                             int screen,int x,int y,int width,int height,const uint8_t *pixels)
{
    unsigned id;
    int xx,yy;
    if(screen<0||screen>3||width<=0||height<=0||!pixels)return;
    id=hd_ui_record();
    s_uiRecords[id].kind=2;s_uiRecords[id].widget=widget;
    s_uiRecords[id].type=type;s_uiRecords[id].pressed=pressed;
    s_uiRecords[id].character=fill;s_uiRecords[id].font=schema;
    s_uiRecords[id].width=width;s_uiRecords[id].height=height;
    for(yy=0;yy<height;yy++)for(xx=0;xx<width;xx++){
        if(xx>=1&&xx<width-1&&yy>=1&&yy<height-1)continue;
        if(x+xx<0||x+xx>=320||y+yy<0||y+yy>=200)continue;
        hd_ui_ink(id,screen,x+xx,y+yy,xx,yy,pixels[(y+yy)*320+x+xx]);
    }
}

void DuneHD_WidgetBorderBegin(void){s_widgetBorderDepth++;}

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
#include "gui/font.h"
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

static void hd_capture_world(int copiedToFront);
void DuneHD_EndViewport(int copiedToFront)
{
    s_scope = 0;
    s_owner = -1;
    s_viewportSeen = 1;
    hd_capture_world(copiedToFront);
}

void DuneHD_Tile(int packed)
{
    unsigned at;
    if (!s_scope || packed < 0 || packed >= 4096) return;
    at = (unsigned)packed * 4;
    s_rasterTiles[at] = g_map[packed].groundTileID;
    s_rasterTiles[at+1] = g_map[packed].overlayTileID;
    s_rasterTiles[at+2] = g_map[packed].houseID;
    s_rasterTiles[at+3] = g_map[packed].isUnveiled || g_debugScenario;
}

static int hd_screen(int screen)
{
    int i;
    if (screen != SCREEN_ACTIVE) return screen;
    for (i=0;i<4;i++) if (GFX_Screen_IsActive((Screen)i)) return i;
    return -1;
}

void DuneHD_Dirty(int screen, int left, int top, int right, int bottom)
{
    hd_ui_dirty(hd_screen(screen),left,top,right-left,bottom-top);
}

void DuneHD_WritePixel(const void *pixel,int screen)
{
    const uint8_t *base;
    ptrdiff_t at;
    screen=hd_screen(screen);
    if(screen<0||screen>3)return;
    base=GFX_Screen_Get_ByIndex((Screen)screen);
    at=(const uint8_t *)pixel-base;
    if(at>=0&&at<HD_SCREEN_PIXELS)hd_ui_set_owner(screen,(int)at,0);
}

void DuneHD_RemapPixel(const void *pixel,int screen)
{
    const uint8_t *base;
    ptrdiff_t at;
    screen=hd_screen(screen);
    if(screen<0||screen>3)return;
    base=GFX_Screen_Get_ByIndex((Screen)screen);
    at=(const uint8_t *)pixel-base;
    if(at>=0&&at<HD_SCREEN_PIXELS && s_uiOwner[screen][at])
        s_uiValue[screen][at]=*(const uint8_t *)pixel;
}

void DuneHD_Copy(int src, int dst, int sx, int sy, int dx, int dy,
                 int width, int height, int skipNull)
{
    src=hd_screen(src);dst=hd_screen(dst);
    hd_ui_copy(src,dst,sx,sy,dx,dy,width,height,skipNull,
        src>=0&&src<4 ? GFX_Screen_Get_ByIndex((Screen)src) : NULL);
    /* SCREEN1 scene builds (initial interface, modal restore) become available
     * exactly when the complete native viewport reaches the front buffer. */
    if (s_worldPending && src==1 && dst==0 && sx==dx && sy==dy &&
        dx<=0 && dy<=40 && dx+width>=240 && dy+height>=200) hd_promote_world();
}

void DuneHD_BufferSave(const void *key,int x,int y,int width,int height)
{ hd_ui_buffer_save(key,x,y,width,height);if(key==g_mouseSpriteBuffer)hd_ui_buffer_mouse(key); }
void DuneHD_BufferRestore(const void *key,int x,int y,int width,int height)
{ hd_ui_buffer_restore(key,x,y,width,height,(const uint8_t *)key); }

void DuneHD_TextGlyph(int character,int x,int y,const uint8_t colours[16])
{
    FontChar *fc;
    int font,screen=hd_screen(SCREEN_ACTIVE);
    if(!g_fontCurrent||!s_textDepth||character==0)return;
    fc=&g_fontCurrent->chars[(uint8_t)character];
    font=g_fontCurrent==g_fontNew6p?1:g_fontCurrent==g_fontNew8p?2:g_fontCurrent==g_fontIntro?0:3;
    s_textScreen=screen;
    hd_text_glyph(character,x,y,fc->width,g_fontCurrent->height,Font_GetCharWidth((unsigned char)character),font,colours);
}
void DuneHD_TextEnd(void)
{ hd_text_end(hd_screen(SCREEN_ACTIVE)); }

void DuneHD_GlyphBegin(void) { s_glyphWrite++; }
void DuneHD_GlyphEnd(int character, int x, int y, const uint8_t colours[16])
{
    FontChar *fc;
    unsigned id;
    int screen=hd_screen(SCREEN_ACTIVE), xx, yy;
    if (s_glyphWrite) s_glyphWrite--;
    if (!g_fontCurrent || screen<0 || screen>3) return;
    fc=&g_fontCurrent->chars[(uint8_t)character];
    if (!fc->data || x<0 || y<0 || x+fc->width>320 || y+g_fontCurrent->height>200) return;
    id=hd_ui_record();
    s_uiRecords[id].kind=1;s_uiRecords[id].character=character;
    s_uiRecords[id].font=g_fontCurrent==g_fontNew6p?1:g_fontCurrent==g_fontNew8p?2:g_fontCurrent==g_fontIntro?0:3;
    s_uiRecords[id].width=fc->width;s_uiRecords[id].height=g_fontCurrent->height;
    s_uiRecords[id].advance=Font_GetCharWidth((unsigned char)character);
    if(s_textDepth&&s_textCurrent>=0&&s_textIndex>=0){
        HdTextRun *run=&s_textRuns[s_textCurrent];HdTextGlyph *g=&run->glyphs[s_textIndex];
        if(g->character==character&&g->x==x&&g->y==y){s_uiRecords[id].runToken=run->token;s_uiRecords[id].runIndex=s_textIndex;}
    }
    memcpy(s_uiRecords[id].colours,colours,16);
    for(yy=0;yy<g_fontCurrent->height;yy++) for(xx=0;xx<fc->width;xx++) {
        int nibble=0, value, at=(y+yy)*320+x+xx;
        if(fc->usedLines==0 && yy>=fc->unusedLines)continue;
        if(yy>=fc->unusedLines && yy<fc->unusedLines+fc->usedLines)
            nibble=fc->data[(yy-fc->unusedLines)*fc->width+xx]&15;
        value=colours[nibble];
        if(!value)continue; /* Native transparent font pixels preserve provenance. */
        hd_ui_set_owner(screen,at,0);
        if(nibble)hd_ui_ink(id,screen,x+xx,y+yy,xx,yy,value);
    }
}

void DuneHD_SpriteBegin(void)
{
    s_uiSpriteRecord=-1;s_uiSpritePrecise=1;s_uiSpriteCursor=s_uiSpritePendingValid==2;s_glyphWrite++;
    if(!s_uiSpritePendingValid || s_uiSpritePendingValid==2)return; /* Native cursor has its own HD layer. */
    s_uiSpriteRecord=(int)hd_ui_record();
    s_uiSpriteCommands[s_uiSpriteRecord]=s_uiSpritePending;
    s_uiRecords[s_uiSpriteRecord].kind=3;
    s_uiRecords[s_uiSpriteRecord].width=s_uiSpritePending.v[HD_W];
    s_uiRecords[s_uiSpriteRecord].height=s_uiSpritePending.v[HD_H];

}

void DuneHD_SpritePixel(const void *pixel)
{
    const uint8_t *base;
    ptrdiff_t at;
    int x,y,lx,ly;
    if(!s_uiSpritePrecise || s_uiSpriteCursor || s_uiSpriteScreen<0 || s_uiSpriteScreen>3)return;
    base=GFX_Screen_Get_ByIndex((Screen)s_uiSpriteScreen);
    at=(const uint8_t *)pixel-base;
    if(at<0 || at>=HD_SCREEN_PIXELS)return;
    x=at%320;y=at/320;
    if(s_uiSpriteRecord<0){hd_ui_set_owner(s_uiSpriteScreen,(int)at,0);return;}
    lx=x-s_uiSpritePending.v[HD_X];ly=y-s_uiSpritePending.v[HD_Y];
    if(lx<0 || lx>=320 || ly<0 || ly>=200)return;
    hd_ui_ink((unsigned)s_uiSpriteRecord,s_uiSpriteScreen,x,y,lx,ly,*(const uint8_t *)pixel);
}

void DuneHD_SpriteEnd(void)
{
    if(s_uiSpritePrecise && s_glyphWrite)s_glyphWrite--;
    s_uiSpriteRecord=-1;s_uiSpritePendingValid=0;s_uiSpritePrecise=0;s_uiSpriteCursor=0;
}

void DuneHD_Border(int widget,int type,int pressed,int x,int y,int width,int height)
{
    int screen=hd_screen(SCREEN_ACTIVE);
    if(s_widgetBorderDepth)s_widgetBorderDepth--;
    hd_border_record(widget,type,pressed,1,pressed?3:1,screen,x,y,width,height,
                     screen>=0&&screen<4?GFX_Screen_Get_ByIndex((Screen)screen):NULL);
}

void DuneHD_DirectBorder(int x,int y,int width,int height,int schema,int fill)
{
    int screen=hd_screen(SCREEN_ACTIVE);
    if(s_widgetBorderDepth)return;
    hd_border_record(-1,-1,schema==0,fill,schema,screen,x,y,width,height,
                     screen>=0&&screen<4?GFX_Screen_Get_ByIndex((Screen)screen):NULL);
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
                         int clipWidth, int clipHeight, int blurOffset, int blurIncrement, int blurSeed)
{
    HdCommand command;
    int id;
    s_uiSpritePendingValid=0;s_uiSpriteScreen=hd_screen(screen);
    if (width <= 0 || height <= 0) return;
    /* The cursor may be a copied sprite buffer, outside g_sprites[] identity. */
    if(sprite==g_mouseSprite && hd_screen(screen)==0){
        s_uiSpritePendingValid=2;s_uiSpriteScreen=0;
        return;
    }
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
    /* Private ABI extension: a pure blur never reads a remap table. Preserve
     * exact native raster parameters in its otherwise unused bytes, guarded
     * by BL, while leaving HASREMAP=false and the 336-byte ABI unchanged. */
    if ((flags & 0x200) && !(flags & 0x100) && !command.v[HD_HASREMAP]) {
        command.remap[0]=(uint8_t)blurOffset;command.remap[1]=(uint8_t)(blurOffset>>8);
        command.remap[2]=(uint8_t)blurIncrement;command.remap[3]=(uint8_t)(blurIncrement>>8);
        command.remap[4]=(uint8_t)blurSeed;command.remap[5]=(uint8_t)(blurSeed>>8);
        command.remap[6]='B';command.remap[7]='L';
    }
    if (screen == SCREEN_ACTIVE) {
        for (screen = SCREEN_0; screen <= SCREEN_3; screen++) {
            if (GFX_Screen_IsActive((Screen)screen)) break;
        }
    }
    if (s_scope && s_owner >= 0 && window == 2) hd_record(&command);
    else {
        hd_record_ui(&command,screen,window);
        if(screen>=0 && screen<4){
            s_uiSpritePending=command;s_uiSpritePending.v[HD_OWNER]=-1;s_uiSpritePending.v[HD_LAYER]=4;
            s_uiSpritePendingValid=1;s_uiSpriteScreen=screen;
        }
    }
}


EM_JS(void, hd_present_js,
      (const uint8_t *pixels, const uint8_t *palette, const uint16_t *tiles,
       const HdCommand *commands, int count, int visible, int viewport,
       int selected, int position, int width, int height, int state, int type,
       int tick, int house, int cursor, int mouseX, int mouseY, int hotX,
       int hotY, int mouseVisible, const char *message, int overflow,
       int screenOffset, int veiledTileId, const HdUiCommand *ui, int uiCount,
       int revision, int commitTick, int gameActive, int viewportRendering, int available, int debug, int uiOverflow,
       const HdUiRecord *records, const uint32_t *inkOwner, const uint16_t *inkLocal,
       const uint8_t *inkValue, const uint32_t *inkPaint, const HdCommand *uiSprites,
       const uint8_t *uiPixels,int cursorRestored,const HdTextRun *runs,
       const uint32_t *textOwner,const uint16_t *textLocal,const uint32_t *textPaint,
       const uint16_t *overscan,int overscanX,int overscanY,int epoch), {
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
            house:v[13],owner:v[14],layer:v[15],
            ...(!v[12] && (v[5]&0x200) && !(v[5]&0x100) && HEAPU8[p+86]===66 && HEAPU8[p+87]===76 ?
                {blurOffset:HEAPU16[(p+80)>>1],blurIncrement:HEAPU16[(p+82)>>1],blurSeed:HEAPU16[(p+84)>>1]} : {})};
    };
    for (let i = 0; i < count; i++) result.push(commandAt(commands + i * 336));
    const uiCandidates = [];
    for (let i = 0; i < uiCount; i++) {
        const p = ui + i * 348;
        uiCandidates.push(Object.assign(commandAt(p),{screen:HEAP32[(p+336)>>2],
            window:HEAP32[(p+340)>>2],serial:HEAPU32[(p+344)>>2]}));
    }
    uiCandidates.sort((a,b)=>a.serial-b.serial);
    const placements=new Map();
    for(let at=0;at<64000;at++){
        const token=HEAPU32[(inkOwner>>2)+at];
        if(!token || HEAPU8[uiPixels+at]!==HEAPU8[inkValue+at])continue;
        const slot=(token-1)%4096;
        if(HEAPU32[(records+slot*72+60)>>2]!==token)continue;
        const local=HEAPU16[(inkLocal>>1)+at], lx=local%320, ly=Math.floor(local/320);
        const x=at%320-lx, y=Math.floor(at/320)-ly;
        const key=slot+":"+x+":"+y;
        let item=placements.get(key);
        if(!item){
            const p=records+slot*72,v=HEAP32.subarray(p>>2,(p>>2)+11);
            item={kind:v[0],char:v[1],font:v[2],x,y,width:v[3],height:v[4],advance:v[5],
                widgetIndex:v[6],type:v[7],pressed:!!v[8],sourceSerial:v[9],totalInk:v[10],
                ...(v[0]===2?{fill:!!v[1],schemaIndex:v[2]}:{}),
                colours:Array.from(HEAPU8.subarray(p+44,p+60)),screen:0,
                serial:HEAPU32[(inkPaint>>2)+at],slot,runId:HEAPU32[(p+64)>>2],runIndex:HEAPU32[(p+68)>>2],ink:[]};
            placements.set(key,item);
        }
        item.ink.push([lx,ly,HEAPU8[inkValue+at]]);
    }
    const textGlyphs=[],borders=[],uiCommands=[];
    for(const item of placements.values()){
        let x0=320,y0=200,x1=0,y1=0;
        for(const p of item.ink){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]+1);y1=Math.max(y1,p[1]+1);}
        item.clip=[item.x+x0,item.y+y0,x1-x0,y1-y0];
        item.visibleInk=item.ink.length;
        // Numeric serial retains the copy epoch and source painter order.
        item.serial=item.serial+item.sourceSerial/4294967296;
        if(item.kind===3){
            const cmd=commandAt(uiSprites+item.slot*336),dx=item.x-cmd.x,dy=item.y-cmd.y;
            const nativeClip=[cmd.clip[0]+dx,cmd.clip[1]+dy,cmd.clip[2],cmd.clip[3]];
            uiCommands.push(Object.assign(cmd,item,{nativeClip}));
        } else (item.kind===1?textGlyphs:borders).push(item);
    }
    textGlyphs.sort((a,b)=>a.serial-b.serial);borders.sort((a,b)=>a.serial-b.serial);uiCommands.sort((a,b)=>a.serial-b.serial);
    const runPlacements=new Map(),cp437='ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
    for(let at=0;at<64000;at++){
        const token=HEAPU32[(textOwner>>2)+at];if(!token)continue;
        const slot=(token-1)%512,rp=runs+slot*1576;
        if(HEAPU32[rp>>2]!==token)continue;
        const local=HEAPU16[(textLocal>>1)+at],sx=local%320,sy=Math.floor(local/320);
        const x=at%320,y=Math.floor(at/320),dx=x-sx,dy=y-sy,epoch=HEAPU32[(textPaint>>2)+at];
        const key=token+':'+dx+':'+dy+':'+epoch;
        let item=runPlacements.get(key);
        if(!item){
            const count=Math.min(128,HEAPU32[(rp+8)>>2]),glyphs=[];
            let left=320,top=200,right=0,bottom=0;
            for(let i=0;i<count;i++){
                const p=rp+40+i*12,v=HEAP16.subarray(p>>1,(p>>1)+6);
                const g={char:v[0],x:v[1]+dx,y:v[2]+dy,width:v[3],height:v[4],advance:v[5],index:i,visibleInk:0,ink:[]};
                glyphs.push(g);left=Math.min(left,g.x);top=Math.min(top,g.y);right=Math.max(right,g.x+g.width);bottom=Math.max(bottom,g.y+g.height);
            }
            const bytes=glyphs.map(g=>g.char),sourceSerial=HEAPU32[(rp+4)>>2];
            item={runId:token,placementId:key,sourceSerial,serial:epoch+sourceSerial/4294967296,
                x:left,y:top,width:right-left,height:bottom-top,font:HEAPU32[(rp+12)>>2],fontHeight:HEAPU32[(rp+16)>>2],
                colours:Array.from(HEAPU8.subarray(rp+24,rp+40)),textBytes:bytes,
                text:bytes.map(c=>c<128?String.fromCharCode(c):(cp437[c-128]||" ")).join(""),
                glyphs,screen:0,visibleInk:0,totalInk:HEAPU32[(rp+20)>>2],ink:[],rows:[]};
            runPlacements.set(key,item);
        }
        const last=item.rows[item.rows.length-1];
        if(last&&last[1]===y&&last[0]+last[2]===x)last[2]++;else item.rows.push([x,y,1,1]);
        const inkToken=HEAPU32[(inkOwner>>2)+at];if(!inkToken)continue;
        const ip=records+((inkToken-1)%4096)*72;
        if(HEAPU32[(ip+60)>>2]!==inkToken||HEAPU32[(ip+64)>>2]!==token||HEAPU8[uiPixels+at]!==HEAPU8[inkValue+at])continue;
        const index=HEAPU32[(ip+68)>>2],glyph=item.glyphs[index];if(!glyph)continue;
        const value=HEAPU8[inkValue+at];glyph.visibleInk++;glyph.ink.push([x-glyph.x,y-glyph.y,value]);
        item.visibleInk++;item.ink.push([x-item.x,y-item.y,value]);
    }
    const textRuns=[];
    for(const item of runPlacements.values()){
        if(!item.visibleInk)continue; // Background remnants cannot resurrect a cleared label.
        const rectangles=[],ends=new Map();
        for(const row of item.rows){const key=row[0]+':'+row[2],prior=ends.get(key);if(prior&&prior[1]+prior[3]===row[1])prior[3]++;else{rectangles.push(row);ends.set(key,row);}}
        item.clips=rectangles;delete item.rows;
        item.clip=[Math.min(...rectangles.map(r=>r[0])),Math.min(...rectangles.map(r=>r[1])),0,0];
        item.clip[2]=Math.max(...rectangles.map(r=>r[0]+r[2]))-item.clip[0];item.clip[3]=Math.max(...rectangles.map(r=>r[1]+r[3]))-item.clip[1];
        textRuns.push(item);
    }
    textRuns.sort((a,b)=>a.serial-b.serial||a.sourceSerial-b.sourceSerial);
    callback({version:2,pixels:HEAPU8.slice(pixels,pixels+64000),
        palette:HEAPU8.slice(palette,palette+768),
        tiles:HEAPU16.slice(tiles>>1,(tiles>>1)+600),commands:result,
        worldVisible:!!visible,viewport:viewport,selectedUnit:selected,
        selection:{position:position,width:width,height:height,state:state,type:type},
        gameTick:tick,playerHouse:house,
        cursor:{id:cursor,x:mouseX,y:mouseY,hotX:hotX,hotY:hotY,visible:!!mouseVisible},
        message:message ? UTF8ToString(message) : "",cacheOverflow:overflow,
        screenOffset:screenOffset,veiledTileId:veiledTileId,uiCommands:uiCommands,
        worldAvailable:!!available,worldRevision:revision,worldCommitTick:commitTick,worldEpoch:epoch,
        gameplayActive:!!gameActive,viewportRendering:!!viewportRendering,debugScenario:!!debug,
        textGlyphs,borders,uiCandidates,uiLedgerOverflow:uiOverflow,textRuns,
        uiPixels:HEAPU8.slice(uiPixels,uiPixels+64000),uiCursorRestored:!!cursorRestored,
        overscan:{x:overscanX,y:overscanY,width:17,height:12,tiles:HEAPU16.slice(overscan>>1,(overscan>>1)+816)}});
});

EM_JS(int, hd_wants_frame, (), {
    return typeof Module['duneHdPresent'] === 'function' && Module['duneHdEnabled'] !== false;
});

static void hd_read_map_tile(unsigned packed,uint16_t out[4],void *context)
{
    (void)context;
    out[0]=g_map[packed].groundTileID;out[1]=g_map[packed].overlayTileID;
    out[2]=g_map[packed].houseID;out[3]=g_map[packed].isUnveiled||g_debugScenario;
}

static void hd_capture_world(int copiedToFront)
{
    uint8_t alive[HD_OWNERS] = {0};
    uint8_t ordered[HD_UNITS] = {0};
    uint16_t order[HD_OWNERS];
    int x, y, i, selected;
    unsigned count, orderCount = 0;
    if (g_gameMode != GM_NORMAL) return;
    selected = g_unitSelected != NULL ? g_unitSelected->o.index : -1;
    {
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
            memcpy(&s_worldBack.tiles[at],&s_rasterTiles[packed*4],8);
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
    hd_capture_overscan(&s_worldBack,Tile_GetPackedX(g_viewportPosition),Tile_GetPackedY(g_viewportPosition),hd_read_map_tile,NULL);
    count = hd_collect(alive,Tile_GetPackedX(g_viewportPosition),
                       Tile_GetPackedY(g_viewportPosition),selected,order);
    memcpy(s_worldBack.commands,s_commands,count*sizeof(HdCommand));
    s_worldBack.count=count;s_worldBack.valid=1;s_worldBack.viewport=g_viewportPosition;
    s_worldBack.tick=g_timerGame;s_worldBack.selected=selected;
    s_worldBack.position=g_selectionRectanglePosition;s_worldBack.width=g_selectionWidth;
    s_worldBack.height=g_selectionHeight;s_worldBack.state=g_selectionState;
    s_worldBack.type=g_selectionType;s_worldBack.debug=g_debugScenario;s_worldBack.epoch=s_worldEpoch;
    s_worldPending=1;
    if(copiedToFront)hd_promote_world();
}

void DuneHD_Present(int screenOffset)
{
    int visible;
    HdWorld *world=&s_worldFront;
    s_lastScreenOffset=screenOffset;
    if (g_gameMode != GM_NORMAL) hd_reset();
    if (!hd_wants_frame()) return;
    /* Modal pause does not remove the world already present behind the dialog.
     * Mentat/cutscene selection types replace the viewport rather than overlay it. */
    visible=hd_world_visible(g_gameMode==GM_NORMAL,
            g_selectionType>=SELECTIONTYPE_TARGET&&g_selectionType<=SELECTIONTYPE_STRUCTURE,screenOffset);
    /* SDL's framebuffer reserves four extra scanlines for credits scrolling.
     * Valid original offsets stay within those allocated bytes. */
    hd_ui_witness((const uint8_t *)GFX_Screen_Get_ByIndex(SCREEN_0)+
                  ((screenOffset>=0&&screenOffset<=320)?screenOffset*4:0),screenOffset,
                  g_mouseHiddenDepth==0&&g_mouseDisabled==0,g_mouseSpriteBuffer);
    hd_present_js((const uint8 *)GFX_Screen_Get_ByIndex(SCREEN_0) +
                  ((screenOffset >= 0 && screenOffset <= 320) ? screenOffset * 4 : 0),
                  g_paletteActive,world->tiles,
                  world->commands,visible?world->count:0,visible,world->viewport,world->selected,
                  world->position,world->width,world->height,
                  world->state,world->type,g_timerGame,g_playerHouseID,
                  s_cursorId,g_mouseX,g_mouseY,s_hotX,s_hotY,
                  g_mouseHiddenDepth == 0 && g_mouseDisabled == 0,
                  (g_viewportMessageCounter & 1) ? g_viewportMessageText : NULL,
                  s_overflow,screenOffset,g_veiledTileID,s_uiCommands,s_uiCount,
                  world->revision,world->tick,s_gameTimer,s_scope,world->valid,world->debug,s_uiLedgerOverflow,
                  s_uiRecords,s_uiOwner[0],s_uiLocal[0],s_uiValue[0],s_uiPaint[0],s_uiSpriteCommands,s_uiPixels,s_uiCursorRestored,s_textRuns,
                  s_textOwner[0],s_textLocal[0],s_textPaint[0],world->overscan,world->overscanX,world->overscanY,world->epoch);
}
/* Publish current observer state on a graphics-mode/asset-ready request.
 * Never draw, mark dirty, advance a clock, or mutate gameplay to obtain it. */
EMSCRIPTEN_KEEPALIVE void dune_hd_set_view_offset(int32_t dxQ8,int32_t dyQ8,int32_t viewport)
{
    hd_set_view_offset(dxQ8,dyQ8,viewport);
}
EMSCRIPTEN_KEEPALIVE void dune_hd_refresh(void)
{
    DuneHD_Present(s_lastScreenOffset);
}
#endif /* !DUNE_HD_BRIDGE_TEST */
#endif /* browser or cache regression */
