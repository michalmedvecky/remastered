/* GPL-2.0-only. Actual observer run/copy/witness helpers; no DOS execution. */
#define DUNE_HD_BRIDGE_TEST
#include "../../native/browser/hd_bridge.c"
#include <assert.h>
#include <stdio.h>

static uint8_t pixels[4][64000];
static FILE *fixture;
static void block(const void *body,uint32_t size){fwrite(&size,4,1,fixture);fwrite(body,1,size,fixture);}
static void snapshot(const char *name,int cursor)
{
    uint32_t n=(uint32_t)strlen(name);block(name,n);block(&cursor,sizeof(cursor));
    block(pixels[0],sizeof(pixels[0]));block(s_uiPixels,sizeof(s_uiPixels));
    block(s_uiRecords,sizeof(s_uiRecords));block(s_uiOwner[0],sizeof(s_uiOwner[0]));
    block(s_uiLocal[0],sizeof(s_uiLocal[0]));block(s_uiValue[0],sizeof(s_uiValue[0]));block(s_uiPaint[0],sizeof(s_uiPaint[0]));
    block(s_textRuns,sizeof(s_textRuns));block(s_textOwner[0],sizeof(s_textOwner[0]));block(s_textLocal[0],sizeof(s_textLocal[0]));block(s_textPaint[0],sizeof(s_textPaint[0]));
}
static uint32_t draw_line(int screen,const char *text,int x,int y,int mono)
{
    uint8_t colours[16]={0};uint32_t token;const unsigned char *c=(const unsigned char *)text;
    colours[1]=15;s_textScreen=screen;DuneHD_TextBegin(mono);
    while(*c){
        unsigned id;int width=*c==' '?4:6,advance=mono?mono:width;
        hd_text_glyph(*c,x,y,width,8,width,2,colours);
        id=hd_ui_record();s_uiRecords[id].kind=1;s_uiRecords[id].character=*c;
        s_uiRecords[id].width=width;s_uiRecords[id].height=8;s_uiRecords[id].advance=width;s_uiRecords[id].font=2;
        s_uiRecords[id].runToken=s_textRuns[s_textCurrent].token;s_uiRecords[id].runIndex=s_textIndex;
        memcpy(s_uiRecords[id].colours,colours,16);
        if(*c!=' '){hd_ui_ink(id,screen,x+1,y+2,1,2,15);pixels[screen][(y+2)*320+x+1]=15;hd_ui_ink(id,screen,x+3,y+5,3,5,15);pixels[screen][(y+5)*320+x+3]=15;}
        x+=advance;c++;
    }
    token=s_textRuns[s_textCurrent].token;hd_text_end(screen);return token;
}
static void blit(int src,int dst,int sx,int sy,int dx,int dy,int w,int h)
{
    int y;hd_ui_copy(src,dst,sx,sy,dx,dy,w,h,0,pixels[src]);
    for(y=0;y<h;y++)memmove(&pixels[dst][(dy+y)*320+dx],&pixels[src][(sy+y)*320+sx],w);
    hd_ui_dirty(dst,dx,dy,w,h);
}
static unsigned tileReads;
static void read_tile(unsigned packed,uint16_t out[4],void *context)
{
    (void)context;tileReads++;out[0]=(uint16_t)(200+packed%30);out[1]=0;out[2]=2;out[3]=(packed&1)!=0;
}
int main(int argc,char **argv)
{
    uint32_t token;HdTextRun immutable;unsigned i;int x,y;uint8_t backup[48*8];uint16_t packed;
    assert(argc==2);fixture=fopen(argv[1],"wb");assert(fixture);
    token=draw_line(1,"Build it",10,80,0);immutable=s_textRuns[(token-1)%HD_TEXT_RUNS];
    assert(immutable.count==8&&immutable.glyphs[5].character==' '&&immutable.glyphs[6].x==44);
    blit(1,0,0,0,0,0,320,200);hd_ui_witness(pixels[0],0,0,NULL);snapshot("full",0);
    /* Cursor crosses the middle and then hides the entire label. Native pixel
     * bytes differ, but actual saved mouse underlay validates a complete run. */
    for(x=10;x<=34;x+=6){
        for(y=0;y<8;y++)memcpy(backup+y*24,pixels[0]+(80+y)*320+x,24);
        hd_ui_buffer_save(backup,x,80,24,8);hd_ui_buffer_mouse(backup);
        for(y=0;y<8;y++)memset(pixels[0]+(80+y)*320+x,77,24);
        hd_ui_witness(pixels[0],0,1,backup);
        assert(s_uiCursorRestored&&s_uiPixels[82*320+11]==15);
        assert(!memcmp(&immutable,&s_textRuns[(token-1)%HD_TEXT_RUNS],sizeof(immutable)));
        if(x==22)snapshot("cursor-middle",1);
        hd_ui_buffer_restore(backup,x,80,24,8,backup);hd_ui_dirty(0,x,80,24,8);
        for(y=0;y<8;y++)memcpy(pixels[0]+(80+y)*320+x,backup+y*24,24);
    }
    hd_ui_witness(pixels[0],0,0,NULL);snapshot("cursor-restored",0);
    hd_ui_buffer_save(backup,10,80,48,8);hd_ui_buffer_mouse(backup);
    for(y=0;y<8;y++)memcpy(backup+y*48,pixels[0]+(80+y)*320+10,48);
    for(y=0;y<8;y++)memset(pixels[0]+(80+y)*320+10,77,48);
    hd_ui_witness(pixels[0],0,1,backup);snapshot("cursor-full",1);
    hd_ui_buffer_restore(backup,10,80,48,8,backup);hd_ui_dirty(0,10,80,48,8);
    for(y=0;y<8;y++)memcpy(pixels[0]+(80+y)*320+10,backup+y*48,48);
    /* Genuine native erase uses the same white index as the source glyph:
     * provenance/coverage, not palette coincidence, must remove that section. */
    hd_ui_dirty(0,22,80,6,8);for(y=0;y<8;y++)memset(pixels[0]+(80+y)*320+22,15,6);
    assert(!s_textOwner[0][82*320+23]&&!s_uiOwner[0][82*320+23]);
    hd_ui_witness(pixels[0],0,0,NULL);snapshot("middle-erased",0);
    hd_ui_dirty(0,10,80,48,8);hd_ui_witness(pixels[0],0,0,NULL);snapshot("all-erased",0);
    /* Copy only the middle part through two screens. Complete source layout
     * stays at its translated origin, while coverage never expands. */
    blit(1,2,22,80,22,80,12,8);blit(2,0,0,0,65,0,100,120);
    hd_ui_witness(pixels[0],0,0,NULL);snapshot("partial-copy",0);
    assert(s_textOwner[0][82*320+88]==token&&s_textLocal[0][82*320+88]==82*320+23);
    assert(!s_textOwner[0][82*320+80]);
    token=draw_line(1,"111",100,120,10);assert(s_textRuns[(token-1)%HD_TEXT_RUNS].glyphs[1].advance==10);
    assert(s_textRuns[(token-1)%HD_TEXT_RUNS].glyphs[1].x==110);
    /* Fixed-Q8 projection has an exact legacy-zero branch and floor semantics
     * for negative local coordinates. No widget or SDL coordinate is changed. */
    s_viewOffsetXQ8=s_viewOffsetYQ8=0;packed=123;assert(!DuneHD_ViewportPick(17,19,10,20,&packed)&&packed==123);
    s_viewOffsetXQ8=-1;s_viewOffsetYQ8=-1;assert(DuneHD_ViewportPick(0,0,10,20,&packed)&&packed==19*64+9);
    s_viewOffsetXQ8=256;s_viewOffsetYQ8=0;assert(DuneHD_ViewportPick(239,10,10,20,&packed)&&packed==20*64+25);
    s_viewOffsetXQ8=-1;assert(DuneHD_ViewportPick(0,0,0,20,&packed)&&packed==0xffff);
    for(i=0;i<14;i++){
        int offset=(int)i-7,worldX=10+(int)i;s_viewOffsetXQ8=offset*256;s_viewOffsetYQ8=-offset*256;
        x=(worldX-10)*16+8-offset;y=8+offset;
        if(DuneHD_ViewportPick(x,y,10,20,&packed))assert(packed==20*64+worldX);
        else assert(offset==0&&(20+y/16)*64+10+x/16==20*64+worldX);
    }
    /* Live native scroll origins may lead the displayed commit. The setter
     * pins the same N used by RAF, even if another native commit follows. */
    s_worldFront.valid=1;s_worldFront.viewport=20*64+10;hd_set_view_offset(-256,0,20*64+10);
    assert(DuneHD_ViewportPick(8,8,11,21,&packed)&&packed==20*64+10);
    s_worldFront.viewport=21*64+11;
    assert(DuneHD_ViewportPick(8,8,11,21,&packed)&&packed==20*64+10);
    /* Even the next setter may intentionally use an older rendered snapshot. */
    hd_set_view_offset(-256,0,20*64+10);
    assert(DuneHD_ViewportPick(8,8,12,22,&packed)&&packed==20*64+10);
    hd_set_view_offset(-256,0,21*64+11);
    assert(DuneHD_ViewportPick(8,8,12,22,&packed)&&packed==21*64+11);
    hd_set_view_offset(0,0,0);packed=123;
    assert(!DuneHD_ViewportPick(8,8,12,22,&packed)&&packed==123);
    s_worldFront.valid=0;s_viewOffsetViewport=-1;
    /* The observed core cannot be replaced by the ahead-of-raster map. Only
     * the54 margin cells are read at the same scene commit; unknown flags stay0. */
    for(i=0;i<150;i++){s_worldBack.tiles[i*4]=127;s_worldBack.tiles[i*4+1]=123;s_worldBack.tiles[i*4+2]=1;s_worldBack.tiles[i*4+3]=i&1;}
    tileReads=0;hd_capture_overscan(&s_worldBack,10,20,read_tile,NULL);assert(tileReads==54);
    assert(s_worldBack.overscanX==9&&s_worldBack.overscanY==19);
    for(y=0;y<10;y++)for(x=0;x<15;x++)assert(!memcmp(&s_worldBack.tiles[(y*15+x)*4],&s_worldBack.overscan[((y+1)*17+x+1)*4],8));
    assert(s_worldBack.overscan[0]==200+(19*64+9)%30);
    hd_capture_overscan(&s_worldBack,0,0,read_tile,NULL);assert(s_worldBack.overscanX==-1&&s_worldBack.overscanY==-1);
    for(x=0;x<17;x++)assert(s_worldBack.overscan[x*4+3]==0);
    for(y=0;y<12;y++)assert(s_worldBack.overscan[y*17*4+3]==0);
    /* F1 Help replaces the front screen while selection stays STRUCTURE;
     * F2 Options merely pauses the timer over an available world. */
    s_worldFront.valid=1;s_gameTimer=0;
    assert(hd_world_visible(1,1,0));
    DuneHD_MentatReplacement(1);
    assert(s_worldFront.valid&&!hd_world_visible(1,1,0));
    /* Timer restarts before the HUD restore, so it cannot be the scene gate. */
    s_gameTimer=1;assert(!hd_world_visible(1,1,0));
    DuneHD_MentatReplacement(0);assert(hd_world_visible(1,1,0));
    assert(!hd_world_visible(1,0,0)&&!hd_world_visible(1,1,1));
    fclose(fixture);puts("Stable native text, cursor underlay, exact partial copies/erases and signed-Q8 picker passed");return 0;
}
