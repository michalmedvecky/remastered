/* GPL-2.0-only. Real WSA continuation regression; comparison-only file/video API. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include "types.h"
#include "file.h"
#include "gfx.h"
#include "wsa.h"
#include "codec/format80.h"
#include "gui/widget.h"
static char root[2048];
static FILE *handles[8];
static unsigned char screens[4][64000];
static unsigned initialCalls;
WidgetProperties g_widgetProperties[22];
uint8 File_Open_Ex(enum SearchDirectory dir,const char *name,uint8 mode)
{
	char filename[4096]; (void)dir; (void)mode;
	snprintf(filename,sizeof(filename),"%s/%s",root,name);
	for (unsigned i=0;i<8;i++) if (!handles[i]) {
		handles[i]=fopen(filename,"rb");
		assert(handles[i]); return i;
	}
	abort();
}
void File_Close(uint8 i) { assert(i<8 && handles[i]); fclose(handles[i]); handles[i]=NULL; }
uint32 File_Read(uint8 i,void *buffer,uint32 length) { assert(i<8 && handles[i]); return fread(buffer,1,length,handles[i]); }
uint16 File_Read_LE16(uint8 i) { unsigned char b[2]; assert(File_Read(i,b,2)==2); return b[0]|(b[1]<<8); }
uint32 File_Read_LE32(uint8 i) { unsigned char b[4]; assert(File_Read(i,b,4)==4); return(uint32)b[0]|((uint32)b[1]<<8)|((uint32)b[2]<<16)|((uint32)b[3]<<24); }
uint32 File_Seek(uint8 i,uint32 offset,uint8 mode) { assert(i<8 && handles[i]); assert(fseek(handles[i],(int32)offset,mode==0?SEEK_SET:mode==1?SEEK_CUR:SEEK_END)==0); return ftell(handles[i]); }
void *GFX_Screen_Get_ByIndex(Screen screen) { return screens[screen==SCREEN_ACTIVE?0:screen]; }
void GFX_Screen_SetDirty(Screen screen,uint16 l,uint16 t,uint16 r,uint16 b) { (void)screen;(void)l;(void)t;(void)r;(void)b; }
uint16 QA_Format80_Decode(uint8 *dest,const uint8 *source,uint16 length)
{
	initialCalls++;
	return Format80_Decode(dest,source,length);
}
static void check(const char *name,int continuation)
{
	/* A reused screen buffer need not contain a valid compressed stream. */
	unsigned char *scratch=malloc(200000);
	memset(scratch,0x0f,200000);
	memset(screens,0x5a,sizeof(screens));
	initialCalls=0;
	void *wsa=WSA_LoadFile(name,scratch,200000,false);
	assert(wsa && WSA_GetFrameCount(wsa)>1);
	assert(initialCalls==(continuation?0:1));
	assert(WSA_DisplayFrame(wsa,0,8,24,SCREEN_0));
	if (continuation) {
		for (unsigned i=0;i<64000;i++) assert(screens[0][i]==0x5a);
	} else {
		unsigned changed=0;
		for (unsigned i=0;i<64000;i++) changed+=screens[0][i]!=0x5a;
		assert(changed>0);
	}
	initialCalls=0;
	assert(WSA_DisplayFrame(wsa,1,8,24,SCREEN_0));
	assert(initialCalls==1); /* Continuation deltas still decode normally. */
	free(scratch);
}
int main(int argc,char **argv)
{
	assert(argc==2); snprintf(root,sizeof(root),"%s",argv[1]);
	for (unsigned i=0;i<22;i++) { g_widgetProperties[i].width=40;g_widgetProperties[i].height=200; }
	check("INTRO7B.WSA",1);
	check("INTRO8B.WSA",1);
	check("INTRO8C.WSA",1);
	check("HFINALC.WSA",1);
	check("OFINALB.WSA",1);
	check("OFINALC.WSA",1);
	check("INTRO7A.WSA",0);
	return 0;
}
