/* Dune II browser adapter, 2026-11-18. Distributed under GPL-2.0-only. */
/* Read-only browser diagnostics for integration tests of the compiled port. */
#include <emscripten.h>
#include "types.h"
#include "opendune.h"
#include "timer.h"
#include "config.h"
#include "house.h"
EMSCRIPTEN_KEEPALIVE int dune_status(int field) {
  switch (field) {
  case 0: return g_timerGUI;
  case 1: return g_timerGame;
  case 2: return g_gameMode;
  case 3: return g_playerHouseID;
  case 4: return g_scenarioID;
  case 5: return g_campaignID;
  case 6: return g_running;
  case 7: return g_gameConfig.gameSpeed;
  default: return -1;
  }
}

EM_JS(void, browser_audio_visibility, (int hidden), {
  if (typeof SDL2 !== 'undefined' && SDL2.audioContext) {
    const action = hidden ? 'suspend' : 'resume';
    SDL2.audioContext[action]().catch(()=>{});
  }
});
EMSCRIPTEN_KEEPALIVE void dune_audio_visibility(int hidden) { browser_audio_visibility(hidden); }
EM_JS(int, browser_skip_intro, (), {
  const skip = !!Module['duneSkipIntro'];
  Module['duneSkipIntro'] = false;
  return skip ? 1 : 0;
});
