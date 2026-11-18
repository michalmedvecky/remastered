/* GPL-2.0-only. Native presentation-cache regression; no game code execution. */
#define DUNE_HD_BRIDGE_TEST
#include "../../native/browser/hd_bridge.c"
#include <assert.h>
#include <stdio.h>

static HdCommand command(int id, int x, int y)
{
    HdCommand c;
    unsigned i;
    memset(&c,0,sizeof(c));
    c.v[HD_ID]=id;c.v[HD_X]=x;c.v[HD_Y]=y;c.v[HD_W]=16;c.v[HD_H]=16;
    c.v[HD_CLIPX]=0;c.v[HD_CLIPY]=40;c.v[HD_CLIPW]=240;c.v[HD_CLIPH]=160;
    c.v[HD_HASPAL]=1;c.v[HD_HASREMAP]=1;c.v[HD_REMAPCOUNT]=1;
    for(i=0;i<16;i++)c.palette[i]=(uint8_t)(i+144);
    for(i=0;i<256;i++)c.remap[i]=(uint8_t)(i^0x55);
    return c;
}

int main(void)
{
    uint8_t alive[HD_OWNERS]={0};
    uint16_t order[HD_OWNERS];
    HdCommand c=command(111,24,56);
    unsigned i,n;
    for(i=0;i<HD_OWNERS;i++)order[i]=(uint16_t)i;
    /* Native insertion order can differ from pool index order. */
    order[20]=21;order[21]=20;
    hd_reset();
    DuneHD_SetOwner(20,1,1);hd_record(&c);
    assert(s_owners[20].count==0); /* outside viewport scope */
    s_scope=1;s_cameraX=10;s_cameraY=20;
    hd_record(&c);
    c=command(112,26,54);hd_record(&c);
    c=command(6,24,56);hd_record(&c);
    c.palette[0]=0;c.remap[0]=0; /* cached palettes/remaps own their bytes */
    assert(s_owners[20].commands[0].palette[0]==144);
    assert(s_owners[20].commands[0].remap[0]==0x55);
    DuneHD_SetOwner(21,1,2);c=command(115,40,64);hd_record(&c);
    DuneHD_SetOwner(5,3,2);c=command(238,100,100);c.v[HD_FLAGS]=0x301;hd_record(&c);
    c.v[HD_FLAGS]=1;hd_record(&c); /* native shadow precedes aircraft body */
    DuneHD_SetOwner(102,2,0);c=command(180,60,70);hd_record(&c);
    DuneHD_SetOwner(16,0,0);c=command(200,10,50);hd_record(&c);
    alive[5]=alive[16]=alive[20]=alive[21]=alive[102]=1;
    n=hd_collect(alive,10,20,20,order);
    assert(n==8);
    assert(s_commands[0].v[HD_LAYER]==0);
    assert(s_commands[1].v[HD_OWNER]==21 && s_commands[2].v[HD_OWNER]==20);
    assert(s_commands[5].v[HD_LAYER]==2);
    assert(s_commands[6].v[HD_FLAGS]==0x301 && s_commands[7].v[HD_FLAGS]==1);
    assert(s_commands[2].v[HD_X]==24 && s_commands[2].v[HD_Y]==56);
    assert(s_commands[2].v[HD_CLIPY]==40 && s_commands[2].v[HD_CLIPW]==240);
    /* No new native draw is required to keep a stationary unit visible. */
    assert(hd_collect(alive,10,20,20,order)==8);
    assert(hd_collect(alive,11,19,20,order)==8);
    assert(s_commands[2].v[HD_X]==8 && s_commands[2].v[HD_Y]==72);
    assert(s_owners[20].commands[0].v[HD_X]==184); /* cache not retranslated */
    assert(hd_collect(alive,10,20,21,order)==7); /* stale selection reticle removed */
    DuneHD_SetOwner(20,1,1);c=command(113,28,60);hd_record(&c);
    assert(s_owners[20].count==1); /* owner redraw replaces body/turret set */
    alive[20]=0;hd_collect(alive,10,20,21,order);assert(s_owners[20].count==0);
    alive[20]=1;assert(hd_collect(alive,10,20,21,order)==5); /* cannot resurrect stale owner */
    DuneHD_SetOwner(2000,1,0);hd_record(&c);assert(s_owner==-1);
    DuneHD_SetOwner(20,1,0);s_overflow=0;
    for(i=0;i<80;i++)hd_record(&c);
    assert(s_owners[20].count==16 && s_overflow==64);
    s_uiCount=s_uiSerial=0;
    for(i=0;i<129;i++){c=command(12,(int)i,8);hd_record_ui(&c,1,0);}
    assert(s_uiCount==128 && s_uiCommands[0].command.v[HD_X]==1);
    c=command(12,128,8);c.v[HD_FLAGS]=0x2000;hd_record_ui(&c,1,0);
    assert(s_uiCount==128 && s_uiCommands[127].command.v[HD_FLAGS]==0x2000);
    assert(s_uiCommands[127].serial==130);
    hd_record_ui(&c,0,0);assert(s_uiCommands[127].screen==0);
    hd_record_ui(&c,0,4);assert(s_uiCommands[127].window==4);
    hd_reset();assert(s_owners[20].count==0 && s_uiCount==128);
    puts("HD cache: stationary persistence, scrolling, native painter order, reticles, removal, copied maps and bounded UI passed");
    return 0;
}
