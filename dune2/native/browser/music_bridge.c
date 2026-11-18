/* Dune II browser adapter, 2026-11-18. Distributed under GPL-2.0-only. */
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
EM_JS(void, browser_music_play, (const char *file, int index, int volume), {
  if (Module['duneMusicPlay']) Module['duneMusicPlay'](UTF8ToString(file), index, volume);
});
EM_JS(void, browser_music_stop, (), {if (Module['duneMusicStop']) Module['duneMusicStop']();});
EM_JS(void, browser_music_fade, (int duration), {if (Module['duneMusicFade']) Module['duneMusicFade'](duration);});
EM_JS(int, browser_music_playing, (), {return Module['duneMusicIsPlaying'] && Module['duneMusicIsPlaying']() ? 1 : 0;});
EM_JS(void, browser_adlib_effect, (const char *file, int index, int volume), {
  if (Module['duneAdlibEffect']) Module['duneAdlibEffect'](UTF8ToString(file), index, volume);
});
#endif
