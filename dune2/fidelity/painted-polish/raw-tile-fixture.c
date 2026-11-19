/* Surrounds the verbatim retained GFX_DrawTile with bounded test buffers. */
typedef uint8_t uint8;
typedef uint16_t uint16;
enum {SCREEN_ACTIVE=-1,HOUSE_MAX=6,SCREEN_WIDTH=320};
static uint8_t rawScreen[2][64000],rawPalette[16],rawPixels[128*389];
static uint8_t *g_iconRPAL=rawPalette,*g_tilesPixels=rawPixels;
static uint8_t g_iconRTBL[389];
static int s_tileMode=0,s_tileByteSize=128,s_tileHeight=16,s_tileWidth=8,s_tileSpacing=304;
static int rawActive=1,g_dune2_enhanced;
static void *GFX_Screen_GetActive(void){return rawScreen[rawActive];}
void DuneHD_Dirty(int screen,int x,int y,int r,int b){hd_ui_dirty(screen<0?rawActive:screen,x,y,r-x,b-y);}
void DuneHD_WritePixel(const void *pixel,int screen){int at=(int)((const uint8_t *)pixel-rawScreen[rawActive]);hd_ui_set_owner(screen<0?rawActive:screen,at,0);}
#define DUNE_HD(call) call
/* ACTUAL_NATIVE_TILE_FUNCTION */
static void test_raw_tile_overwrite(void)
{
    unsigned id;
    memset(rawPalette,15,sizeof(rawPalette));memset(rawPixels,0,sizeof(rawPixels));
    rawActive=1;id=glyph(1,16,40,'S',15);
    rawScreen[1][40*320+16]=15;rawScreen[1][41*320+18]=15;
    assert(s_uiOwner[1][40*320+16]==s_uiRecords[id].token);
    /* Same palette index is a genuine overwrite: no ink witness can detect
     * this by RGB/index comparison alone. The actual tile raster must clear it. */
    GFX_DrawTile(127,16,40,0);
    assert(rawScreen[1][40*320+16]==15&&!s_uiOwner[1][40*320+16]);
    assert(!s_uiOwner[1][41*320+18]);
    hd_ui_copy(1,0,16,40,16,40,16,16,0,rawScreen[1]);
    hd_ui_dirty(0,16,40,16,16);
    assert(!s_uiOwner[0][40*320+16]);
    /* Transparent overlay writes clear exactly nonzero source pixels, keeping
     * provenance underneath transparent holes until actually overwritten. */
    id=glyph(1,16,40,'T',15);rawPalette[0]=0;rawPixels[128]=0x10;
    GFX_DrawTile(1,16,40,0);
    assert(!s_uiOwner[1][40*320+16]);
    assert(s_uiOwner[1][41*320+18]==s_uiRecords[id].token);
    /* Loading a new CPS/interface invalidates all old menu metadata before
     * later SCREEN1→SCREEN0 copies, even when white pixels happen to coincide. */
    DuneHD_Dirty(1,0,0,320,200);
    hd_ui_copy(1,0,0,0,0,0,320,200,0,rawScreen[1]);
    hd_ui_dirty(0,0,0,320,200);
    assert(!s_uiOwner[0][41*320+18]);
}

#include <stdbool.h>
static uint16 s_colourBorderSchema[4][4]={{1,2,3,4},{1,2,3,4},{1,2,3,4},{1,2,3,4}};
static void GFX_Screen_SetDirty(int screen,int x,int y,int r,int b){DuneHD_Dirty(screen,x,y,r,b);}
static void GUI_DrawLine(int x1,int y1,int x2,int y2,int colour)
{
    (void)colour;
    assert(x1==x2||y1==y2);
    DuneHD_Dirty(SCREEN_ACTIVE,x1,y1,x2+1,y2+1);
}
static void GFX_PutPixel(int x,int y,int colour){(void)colour;DuneHD_Dirty(SCREEN_ACTIVE,x,y,x+1,y+1);}
static void GUI_DrawFilledRectangle(int x,int y,int r,int b,int colour){(void)colour;DuneHD_Dirty(SCREEN_ACTIVE,x,y,r+1,b+1);}
void DuneHD_DirectBorder(int x,int y,int width,int height,int schema,int fill)
{
    if(s_widgetBorderDepth)return;
    hd_border_record(-1,-1,schema==0,fill,schema,rawActive,x,y,width,height,rawScreen[rawActive]);
}
/* ACTUAL_NATIVE_BORDER_FUNCTION */
static void test_unfilled_border_preserves_portrait(void)
{
    unsigned portrait;
    rawActive=1;portrait=glyph(1,257,89,'P',15);
    GUI_DrawBorder(256,88,32,24,1,false);
    {
        unsigned border=(s_uiOwner[1][88*320+256]-1)%HD_UI_RECORDS;
        assert(s_uiRecords[border].kind==2&&s_uiRecords[border].widget==-1);
        assert(!s_uiRecords[border].character&&s_uiRecords[border].font==1);
    }
    assert(s_uiOwner[1][89*320+257]==s_uiRecords[portrait].token);
    assert(s_uiOwner[1][90*320+259]==s_uiRecords[portrait].token);
    hd_ui_copy(1,0,256,88,256,88,32,24,0,rawScreen[1]);
    hd_ui_dirty(0,256,88,32,24);
    assert(s_uiOwner[0][89*320+257]==s_uiRecords[portrait].token);
    assert(s_uiOwner[0][90*320+259]==s_uiRecords[portrait].token);
}
