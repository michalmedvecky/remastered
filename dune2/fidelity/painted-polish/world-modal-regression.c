/* Actual observer plus extracted LevelEnd control flow. No game/DOS binary. */
#define DUNE_HD_BRIDGE_TEST
#include "../../native/browser/hd_bridge.c"
#include <assert.h>
#include <stdbool.h>
#include <stdio.h>
typedef uint8_t uint8;
typedef uint16_t uint16;
typedef uint32_t uint32;
#define DUNE_HD(call) call
enum { SELECTIONTYPE_MENTAT=0,SCREEN_0=0,GM_NORMAL=0,GM_RESTART=3,
       STR_YOU_HAVE_SUCCESSFULLY_COMPLETED_YOUR_MISSION=1,STR_YOU_HAVE_FAILED_YOUR_MISSION=2 };
static uint32 g_timerGame=8000;
static uint16 g_campaignID,g_scenarioID,g_cursorSpriteID,g_playerHouseID,g_gameMode;
static bool s_debugForceWin=true,win=true;
static void *g_sprites[525];
static uint8 g_palette1[768],g_palette2[768];
static struct {struct{bool doneFullScaleAttack;}flags;} house;
static typeof(house) *g_playerHouse=&house;
static struct {int killedAllied,killedEnemy,destroyedAllied,destroyedEnemy,harvestedAllied,harvestedEnemy,score;}g_scenario;
static unsigned modalCalls,winCalls,loseCalls;
static bool selectionEligible=true;
static HdWorld committed;
static bool GameLoop_IsLevelFinished(void){return true;}
static bool GameLoop_IsLevelWon(void){return win;}
static void Music_Play(int n){(void)n;}
static void Sound_Output_Feedback(int n){(void)n;}
static void Sprites_SetMouseSprite(int x,int y,void *sprite){(void)x;(void)y;(void)sprite;}
static void GUI_ChangeSelectionType(int type){assert(type==SELECTIONTYPE_MENTAT);selectionEligible=false;assert(hd_world_visible(1,selectionEligible,0));}
static const char *String_Get_ByIndex(int id){return id==1?"victory":"defeat";}
static void GUI_DisplayModalMessage(const char *text,int duration){
 (void)text;(void)duration;modalCalls++;
 assert(!selectionEligible&&s_worldModal==1);
 s_gameTimer=0; /* Native selection change pauses simulation before the modal. */
 s_worldBack.tiles[0]=19;s_worldBack.commands[0].v[HD_ID]=111;
 assert(hd_world_visible(1,selectionEligible,0));
 assert(!memcmp(&s_worldFront,&committed,sizeof(committed)));
 assert(!hd_world_visible(0,selectionEligible,0)); /* Menu/restart may not retain. */
 assert(!hd_world_visible(1,selectionEligible,1)); /* Scrolling credits may not retain. */
 DuneHD_MentatReplacement(1);assert(!hd_world_visible(1,selectionEligible,0));
 DuneHD_MentatReplacement(0);assert(hd_world_visible(1,selectionEligible,0));
}
static void GUI_Mentat_ShowWin(void){winCalls++;assert(!s_worldModal&&!hd_world_visible(1,selectionEligible,0));}
static void GUI_Mentat_ShowLose(void){loseCalls++;assert(!s_worldModal&&!hd_world_visible(1,selectionEligible,0));}
static void Sprites_UnloadTiles(void){}
static void Sprites_LoadTiles(void){}
static void GUI_EndStats_Show(int a,int b,int c,int d,int e,int f,int g,int h){(void)a;(void)b;(void)c;(void)d;(void)e;(void)f;(void)g;(void)h;assert(!s_worldModal&&!hd_world_visible(1,selectionEligible,0));}
static void GUI_Mouse_Hide_Safe(void){}
static void GUI_Mouse_Show_Safe(void){}
static void GUI_SetPaletteAnimated(void *p,int ticks){(void)p;(void)ticks;}
static void GUI_ClearScreen(int screen){(void)screen;}
static void GameLoop_GameEndAnimation(void){}
static void GameLoop_LevelEndAnimation(void){assert(!s_worldModal);}
static void PrepareEnd(void){}
static void File_ReadBlockFile(const char *name,void *p,int size){(void)name;(void)p;(void)size;}
static int GUI_StrategicMap_Show(int campaign,bool won){(void)campaign;(void)won;assert(!s_worldModal&&!hd_world_visible(1,selectionEligible,0));return 1;}
static bool GUI_Security_Show(void){return true;}

/* ACTUAL_NATIVE_LEVEL_END */

int main(void){
 unsigned phase;
 for(phase=0;phase<2;phase++){
  hd_reset();s_worldFront.valid=1;s_worldFront.count=1;s_worldFront.tiles[0]=127;
  s_worldFront.commands[0].v[HD_ID]=243;s_worldFront.viewport=100;s_worldFront.tick=70;
  committed=s_worldFront;g_gameMode=GM_NORMAL;g_campaignID=2;selectionEligible=true;win=phase==0;s_debugForceWin=true;
  assert(hd_world_visible(1,1,0));GameLoop_LevelEnd();assert(g_gameMode==GM_RESTART);
  assert(!s_worldModal&&!hd_world_visible(1,0,0));
  assert(!memcmp(&s_worldFront,&committed,sizeof(committed)));
 }
 assert(modalCalls==2&&winCalls==1&&loseCalls==1);
 hd_reset();DuneHD_WorldModal(1);assert(!hd_world_visible(1,0,0)); /* No committed scene. */
 s_worldFront.valid=1;assert(hd_world_visible(1,0,0));
 hd_reset();assert(!s_worldModal);s_worldFront.valid=1;
 assert(!hd_world_visible(1,0,0)&&hd_world_visible(1,1,0));
 DuneHD_WorldModal(0);assert(!s_worldModal); /* Extra leave cannot underflow. */
 puts("Victory/defeat modal retains the committed world only until the actual Mentat; reset, no-world, menu and credits guards passed");return 0;
}
