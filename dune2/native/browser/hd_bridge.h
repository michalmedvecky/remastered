/* Dune II HD presentation bridge, 2026-11-18. GPL-2.0-only. */
#ifndef DUNE_BROWSER_HD_BRIDGE_H
#define DUNE_BROWSER_HD_BRIDGE_H

#include <stdint.h>

/* These hooks observe rendering only. They must never request extra native
 * draws, advance RNG/timers, or alter dirty flags or simulation objects. */
void DuneHD_BeginViewport(void);
void DuneHD_EndViewport(void);
void DuneHD_SetOwner(int owner, int layer, int house);
void DuneHD_Timer(int enabled);
void DuneHD_Cursor(const void *sprite, int hotX, int hotY);
void DuneHD_SpritesReady(int count);
void DuneHD_CaptureSprite(const void *sprite, int screen, int window, int x, int y,
                         int width, int height, int flags,
                         const uint8_t *palette, const uint8_t *remap,
                         int remapCount, int clipX, int clipY,
                         int clipWidth, int clipHeight);
void DuneHD_Present(int screenOffset);

#endif
