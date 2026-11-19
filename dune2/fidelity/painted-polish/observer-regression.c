/* GPL-2.0-only. Actual observer helpers; no game/DOS binary execution. */
#define DUNE_HD_BRIDGE_TEST
#include "../../native/browser/hd_bridge.c"
#include <assert.h>
#include <stdio.h>

static unsigned glyph(int screen,int x,int y,int character,int colour)
{
    unsigned id=hd_ui_record();
    s_uiRecords[id].kind=1;s_uiRecords[id].character=character;
    s_uiRecords[id].width=3;s_uiRecords[id].height=2;
    hd_ui_ink(id,screen,x,y,0,0,colour);
    hd_ui_ink(id,screen,x+2,y+1,2,1,colour);
    return id;
}

int main(void)
{
    uint8_t source[HD_SCREEN_PIXELS]={0};
    unsigned id,id2,i;
    /* A staged SCREEN1 scene cannot publish ahead of its screen copy. */
    hd_reset();
    s_worldBack.valid=1;s_worldBack.tiles[0]=127;s_worldBack.count=1;
    s_worldBack.commands[0].v[HD_ID]=243;s_worldBack.viewport=100;s_worldBack.tick=70;
    s_worldPending=1;
    assert(!s_worldFront.valid);
    hd_promote_world();
    assert(s_worldFront.valid&&s_worldFront.tiles[0]==127);
    assert(s_worldFront.revision==1&&s_worldFront.tick==70&&!s_worldPending);
    /* Live map/dirty-owner mutations do not alter the committed presentation. */
    s_worldBack.tiles[0]=126;s_worldBack.commands[0].v[HD_ID]=111;
    s_worldBack.viewport=101;s_worldBack.tick=71;s_worldPending=1;s_gameTimer=0;s_scope=1;
    assert(s_worldFront.tiles[0]==127&&s_worldFront.commands[0].v[HD_ID]==243);
    assert(s_worldFront.viewport==100&&s_worldFront.valid);
    hd_promote_world();
    assert(s_worldFront.tiles[0]==126&&s_worldFront.revision==2);
    assert(s_worldFront.commands[0].v[HD_ID]==111&&s_worldFront.viewport==101);
    hd_reset();assert(!s_worldFront.valid&&!s_worldBack.valid);

    id=glyph(1,20,30,'A',15);
    assert(s_uiRecords[id].totalInk==2);
    /* Screen1 HUD copied at a different destination retains exact local ink. */
    hd_ui_copy(1,0,16,28,80,10,16,8,0,source);
    hd_ui_dirty(0,80,10,16,8); /* native SetDirty following Copy must not erase it */
    assert(s_uiOwner[0][12*320+84]==id+1);
    assert(s_uiLocal[0][13*320+86]==322);
    assert(s_uiValue[0][13*320+86]==15);
    assert(s_uiPaint[0][13*320+86]>s_uiRecords[id].serial);
    /* Partial overwrite removes precisely its pixels; unrelated glyph ink stays. */
    hd_ui_dirty(0,84,12,1,1);
    assert(!s_uiOwner[0][12*320+84]);
    assert(s_uiOwner[0][13*320+86]==id+1);
    /* Same-screen overlap uses a complete metadata snapshot, like memmove. */
    id2=glyph(0,5,5,'B',232);
    hd_ui_copy(0,0,5,5,6,5,3,2,0,source);
    hd_ui_dirty(0,6,5,3,2);
    assert(s_uiOwner[0][5*320+6]==id2+1);
    assert(s_uiOwner[0][6*320+8]==id2+1);
    assert(s_uiLocal[0][6*320+8]==322);
    /* Transparent copies preserve destination where native source is zero. */
    source[5*320+5]=0;source[6*320+7]=1;
    hd_ui_copy(0,2,5,5,40,50,3,2,1,source);
    hd_ui_dirty(2,40,50,3,2);
    assert(!s_uiOwner[2][50*320+40]);
    /* Dirty calls made by a transparent character do not clear previous text;
     * its exact actually-written mask is registered separately by GlyphEnd. */
    s_glyphWrite=1;hd_ui_dirty(1,20,30,3,2);s_glyphWrite=0;
    assert(s_uiOwner[1][30*320+20]==id+1);
    /* Thousands of transient draws do not evict untouched visible UI. Slots
     * with no surviving provenance are recycled before live screen records. */
    for(i=0;i<HD_UI_RECORDS*2;i++){
        unsigned temporary=hd_ui_record();
        s_uiRecords[temporary].kind=1;
    }
    assert(s_uiRecords[id].token == s_uiOwner[1][30*320+20]);
    assert(s_uiReferences[id]>=2 && s_uiLedgerOverflow==0);
    /* Reference counts follow actual copies and exact partial overwrites. */
    hd_ui_dirty(1,20,30,3,2);assert(s_uiReferences[id]>=1);
    hd_ui_dirty(0,86,13,1,1);assert(s_uiReferences[id]==0);
    for(i=0;i<HD_UI_RECORDS;i++)hd_ui_record();
    assert(s_uiRecords[id].token != id+1);
    /* Mouse/modal raw-buffer backup restores provenance, not just palette
     * bytes. Restoring at another location preserves local glyph geometry. */
    {
        uint8_t backup[12]={0};
        unsigned saved=glyph(0,100,80,'C',29);
        backup[0]=backup[6]=29;
        hd_ui_buffer_save(backup,100,80,4,3);
        assert(s_uiReferences[saved]==4);
        hd_ui_dirty(0,100,80,4,3);assert(s_uiReferences[saved]==2);
        hd_ui_buffer_restore(backup,40,50,4,3,backup);
        hd_ui_dirty(0,40,50,4,3);
        assert(s_uiOwner[0][50*320+40]==s_uiRecords[saved].token);
        assert(s_uiOwner[0][51*320+42]==s_uiRecords[saved].token);
        assert(s_uiLocal[0][51*320+42]==322);
        assert(s_uiReferences[saved]==2);
        for(i=0;i<8;i++)assert(!s_uiBuffers[i].key);
    }
    puts("Observer v2: committed scene transactions, paused world retention, UI copies/overlap/overwrites/transparency and slot recycling passed");
    return 0;
}
