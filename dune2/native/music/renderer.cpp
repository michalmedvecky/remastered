/* Browser ADL playback: Westwood bytecode -> OPL registers -> Nuked PCM.
 * New adapter code: GPL-2.0-or-later. See PROVENANCE.md for vendor licenses.
 */
#include <stdint.h>
#include <stdlib.h>
#include <new>
#include "vendor/adplug/adl.h"
extern "C" {
#include "vendor/nuked-opl3/opl3.h"
}

class NukedOPL: public Copl {
public:
    opl3_chip chip;
    uint32_t sampleRate = 44100;
    uint32_t writes = 0;
    void init() override {
        OPL3_Reset(&chip, sampleRate);
        writes = 0;
    }
    void write(int reg, int value) override {
        OPL3_WriteRegBuffered(&chip, (uint16_t)reg, (uint8_t)value);
        writes++;
    }
};

static NukedOPL chip;
static CadlPlayer *player = nullptr;
static int16_t pcm[4096 * 2];
static int32_t untilTick = 0;
static uint32_t ticks = 0;
static uint32_t pendingTicks = 0;
static bool active = false;

extern "C" {
int adl_init(uint32_t sampleRate) {
    if (sampleRate < 8000 || sampleRate > 192000) return 0;
    chip.sampleRate = sampleRate;
    chip.init();
    return 1;
}

int adl_load(const uint8_t *data, uint32_t length, uint32_t track, uint32_t volume) {
    if (length < 1120 || length > 1000000 || track >= 120) return 0;
    active = false;
    delete player;
    player = new CadlPlayer(&chip);
    CFileProvider provider(data, length);
    if (!player->load("DUNE.ADL", provider)) { delete player; player = nullptr; return 0; }
    /* 0xff is an explicitly absent ADL entry, not malformed game content.
     * Some MIDI-only music table slots have no AdLib counterpart. */
    if (data[track] == 0xff) { player->stopPlayback(); return 2; }
    if (track >= player->getsubsongs()) return 0;
    player->startTrack((uint16_t)track, (uint8_t)volume);
    untilTick = 0;
    ticks = 0;
    pendingTicks = 3;
    active = true;
    return 1;
}

void adl_stop() {
    if (player) player->stopPlayback();
    active = false;
    pendingTicks = 0;
}

int adl_effect(uint32_t track, uint32_t volume) {
    if (!player || track >= player->getsubsongs()) return 0;
    player->playSoundEffect((uint16_t)track, (uint8_t)volume);
    pendingTicks = 3;
    active = true;
    return 1;
}

int adl_playing() { return active && player && (pendingTicks || player->isPlaying()); }
uintptr_t adl_output() { return (uintptr_t)pcm; }
uint32_t adl_ticks() { return ticks; }
uint32_t adl_writes() { return chip.writes; }
uint32_t adl_render(uint32_t frames) {
    if (frames > 4096) frames = 4096;
    for (uint32_t i = 0; i < frames; i++) {
        if (untilTick <= 0) {
            if (player && active) {
                player->update();
                if (pendingTicks) pendingTicks--;
                if (!pendingTicks && !player->isPlaying()) active = false;
            }
            untilTick += chip.sampleRate;
            ticks++;
        }
        OPL3_GenerateResampled(&chip.chip, &pcm[i * 2]);
        untilTick -= 72;
    }
    return frames;
}
}
