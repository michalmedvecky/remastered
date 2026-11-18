/* Dune II browser adapter, 2026-11-18. Distributed under GPL-2.0-only. */
#ifndef DUNE_BROWSER_MUSIC_H
#define DUNE_BROWSER_MUSIC_H
void browser_music_play(const char *file, int index, int volume);
void browser_music_stop(void);
void browser_music_fade(int duration);
int browser_music_playing(void);
void browser_adlib_effect(const char *file, int index, int volume);
#endif
