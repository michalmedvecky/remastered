/* Dune II browser adapter, 2026-11-18. Distributed under GPL-2.0-only. */
/* Browser output boundary; the original MPU/XMI scheduler remains in C. */
#include <emscripten.h>
#include "types.h"
#include "audio/midi.h"

EM_JS(int, browser_midi_init, (), {
  return typeof Module['duneMidi'] === 'function' ? 1 : 0;
});
EM_JS(void, browser_midi_send, (unsigned int data), {
  if (Module['duneMidi']) Module['duneMidi'](data >>> 0);
});
EM_JS(void, browser_midi_sysex, (const unsigned char *data, unsigned int length), {
  if (Module['duneSysex']) Module['duneSysex'](HEAPU8.slice(data, data + length));
});
EM_JS(void, browser_midi_reset, (), {
  if (Module['duneMidiReset']) Module['duneMidiReset']();
});
bool midi_init(void) { return browser_midi_init() != 0; }
void midi_uninit(void) { browser_midi_reset(); }
void midi_send(uint32 data) { browser_midi_send(data); }
uint16 midi_send_string(const uint8 *data, uint16 len) { browser_midi_sysex(data, len); return len; }
void midi_reset(void) { browser_midi_reset(); }
