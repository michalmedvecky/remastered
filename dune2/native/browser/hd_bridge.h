/* Dune II HD presentation bridge, 2026-11-18. GPL-2.0-only. */
#ifndef DUNE_BROWSER_HD_BRIDGE_H
#define DUNE_BROWSER_HD_BRIDGE_H

#include <stdint.h>

/* These hooks observe rendering only. They must never request extra native
 * draws, advance RNG/timers, or alter dirty flags or simulation objects. */
void DuneHD_BeginViewport(void);
void DuneHD_EndViewport(int copiedToFront);
void DuneHD_Tile(int packed);
void DuneHD_NotifyOnly(int enter);
void DuneHD_MentatReplacement(int enter);
void DuneHD_WritePixel(const void *pixel,int screen);
void DuneHD_RemapPixel(const void *pixel,int screen);
void DuneHD_Dirty(int screen, int left, int top, int right, int bottom);
void DuneHD_Copy(int src, int dst, int sx, int sy, int dx, int dy, int width, int height, int skipNull);
void DuneHD_SpriteBegin(void);
void DuneHD_SpritePixel(const void *pixel);
void DuneHD_SpriteEnd(void);
void DuneHD_BufferSave(const void *key,int x,int y,int width,int height);
void DuneHD_BufferRestore(const void *key,int x,int y,int width,int height);
void DuneHD_TextBegin(int advance);
void DuneHD_TextGlyph(int character,int x,int y,const uint8_t colours[16]);
void DuneHD_TextEnd(void);
void DuneHD_GlyphBegin(void);
void DuneHD_GlyphEnd(int character, int x, int y, const uint8_t colours[16]);
void DuneHD_WidgetBorderBegin(void);
void DuneHD_DirectBorder(int x,int y,int width,int height,int schema,int fill);
void DuneHD_Border(int widget, int type, int pressed, int x, int y, int width, int height);
void DuneHD_SetOwner(int owner, int layer, int house);
void DuneHD_Timer(int enabled);
void DuneHD_Cursor(const void *sprite, int hotX, int hotY);
void DuneHD_SpritesReady(int count);
void DuneHD_CaptureSprite(const void *sprite, int screen, int window, int x, int y,
                         int width, int height, int flags,
                         const uint8_t *palette, const uint8_t *remap,
                         int remapCount, int clipX, int clipY,
                         int clipWidth, int clipHeight, int blurOffset, int blurIncrement, int blurSeed);
void DuneHD_Present(int screenOffset);
void dune_hd_refresh(void);
/* Presentation-only screen-to-world adaptation; native dispatch stays physical. */
void dune_hd_set_view_offset(int32_t dxQ8,int32_t dyQ8,int32_t viewport);
int DuneHD_ViewportPick(int x,int y,int originX,int originY,uint16_t *packed);

#endif
