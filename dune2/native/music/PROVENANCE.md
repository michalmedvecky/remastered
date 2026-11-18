# Dune II AdLib music reconstruction

This module plays the supplied Dune II score banks through the Westwood ADL interpreter and an emulated OPL chip. It contains no DOS or original executable interpreter. Original `.ADL` resources are score/instrument bytecode; the interpreter and renderer are newly compiled C/C++ source.

## Source and licenses

* **Westwood ADL interpreter:** [AdPlug commit 3d9457ac91121302a752577b2bf063b4aea202b8](https://github.com/adplug/adplug/tree/3d9457ac91121302a752577b2bf063b4aea202b8), `src/adl.cpp`, `adl.h`, `opl.h` and `debug.h`. The ADL driver is derived from ScummVM's Westwood interpreter by Torbjorn Andersson and Johannes Schickel, adapted to AdPlug by Simon Peter. The source retains its full GPL-2-or-later / LGPL-2.1-or-later notices and attribution. Full texts are retained in `vendor/COPYING.GPL-2` and `vendor/adplug/COPYING.LGPL-2.1`; upstream authors are in `vendor/adplug/AUTHORS`.
* **OPL chip:** [Nuked-OPL3 revision 765ec962e473aeb767e4cba74ffdc8f588ffbfe8](https://github.com/nukeykt/Nuked-OPL3/tree/765ec962e473aeb767e4cba74ffdc8f588ffbfe8), copyright 2013–2020 Nuke.YKT, LGPL-2.1-or-later. Unmodified `opl3.c` and `opl3.h`, full license and notice are retained in `vendor/nuked-opl3`. These exact sources were already available in the shared workspace; their hashes are recorded in `build-manifest.json`.
* **Browser adapters:** `renderer.cpp`, the replacement memory-provider `vendor/adplug/player.h`, additions to `CadlPlayer`, `build.py` and `dist/music/{player,worklet}.mjs` were written for this reconstruction on 2026-11-18, GPL-2.0-or-later. The added `startTrack`, `stopPlayback` and `isPlaying` methods expose existing driver operations. A DOS comparison also corrects version-3 SFX volume scaling: ALFX applies `63 - (((63 - velocity) * volume) >> 8)` even at volume255. The vendor parser, score opcodes, instruments and timer remain unchanged. `adplug-browser.patch` records the changes to the upstream `.cpp` and `.h`.

The complete native renderer source and build recipe are included so the WASM can be rebuilt or relinked. The game score data remains original game content supplied by the user; these open-source licenses do not relicense the game assets.

## Original data and table evidence

`banks.json` records the **21 original DUNE0–DUNE20.ADL banks**, their source SOUND.PAK offsets, sizes and SHA-256 values. The files in `dist/music/banks` were extracted by those recorded byte ranges and every extracted hash was checked against the retained resource inventory at `analysis/dune-2/evidence/resources.json`. Original archive and EXE files were left unchanged.

`tracks.json` records the **38 original music table entries**. Each original 6-byte record at EXE file offset `0x385e0` was checked: far bank-string pointer followed by a 16-bit track index. The original bank strings and indices match OpenDUNE's pinned `g_table_musics` initializer exactly. Native game calls therefore retain their original music ID, bank and track mapping.

Three nonzero table entries have no AdLib score in the supplied data: music ID **23 → DUNE1/8**, **35 → DUNE0/3**, **37 → DUNE0/5**. Their ADL entry byte is explicitly `0xff`. The renderer treats these as silence, matching absence of an AdLib program; it does not invent a replacement. The supplied MIDI banks may cover those entries, but MT-32/General MIDI emulation is outside this AdLib renderer. All other 34 nonzero mappings are present and produce audio.

The ADL format starts with 120 one-byte track-to-program entries, then 250 little-endian program offsets and 250 instrument offsets. Driver offsets are relative to the data after the 120-byte track table. Dune II uses the version-3 Westwood variant. Program commands implement notes, instruments, durations, loops, calls, tempo, pitch bends, effects, rhythm and sound priorities. Music and sound effects share the original channel scheduler and chip. There is no transcription into a new score or browser oscillator approximation.

## Browser behavior

`createMusic()` loads the small standalone WASM module, an AudioWorklet and all 21 score banks before returning. Bank switches then post synchronously, preserving same-stack native music/effect/fade ordering. A NULL/empty bank is the original music-ID-zero stop request. Generation checks reject stale status and expired fade callbacks after a new song starts. The worklet runs the original driver callbacks at **72 Hz**, using an integer rational sample clock so 44.1/48 kHz audio and arbitrary callback block sizes preserve event scheduling. Nuked-OPL3 synthesizes the register writes with buffered chip writes and resampling. Stereo output carries the OPL2-mode signal.

The native browser core supplies `duneMusicPlay(bank,index,volume)`, stop, fade and status hooks. `player.mjs` exposes `play`, `stop`, `fade`, `isPlaying`, `setVolume`, `resume`, `effect` and read-only `diagnostics`. `.ADL`, `.C55` and `.XMI` filenames normalize to the same original AdLib bank for effects. Effects in the current bank go through the same driver rather than a second synthesizer.

Fade requests execute **bank entry 1**, Westwood's original version-3 fade program. A four-second minimum recovery timeout stops a malformed/stalled fade; the original program ordinarily completes first. The master output volume is a separate browser gain control. AudioContext suspension and the host's foreground clock policy are managed by the main browser integration.

## Build and verification

```sh
python3 native/music/build.py --emcc /path/to/emcc --emxx /path/to/em++
node native/music/test-render.mjs
```

`build-manifest.json` records compiler identity, exact build command, source hashes and WASM output hash. The build uses Emscripten 7.0.0 and produces a standalone module without a filesystem or external audio library. Its sole host import is the memory-growth notification.

`test-results.json` records resource hash verification and an eight-second render of **all 37 nonzero music table mappings**. All 34 present tracks generate nonzero PCM; the three absent entries remain silent. Tests check exact 72 Hz tick counts, identical PCM under fixed and irregular audio blocks at 48 kHz, shared-driver sound effects, stop status and the original fade program. Hashes and signal statistics are saved per track. Browser QA additionally observed a running 48 kHz AudioContext, loaded original DUNE0 intro tracks, increasing callback/register counters and no audio processor errors.

The earlier render checks established deterministic reconstructed-driver behavior without executing original machine code. The later, explicitly authorized DOSBox comparisons executed disposable copies and captured the original ALFX driver's OPL register writes. [`fidelity/music/golden.json`](../../fidelity/music/golden.json) records the retained golden ranges and capture hashes. The production interpreter matches **700 logo, 3237 intro score/SFX, 2325 Harkonnen, 943 Atreides and 1380 Ordos score/SFX writes exactly**, after excluding separately documented initialization and ending bank switches. The intro golden covers its first 81 seconds of music and the observed effect109. The regression command is `python3 fidelity/music/test-opl.py`; it uses a local C++17 compiler to compile current interpreter source and compare every register/value pair with the original capture. This caught and fixed the one-step SFX attenuation difference.

All three captured credits music prefixes also match register/value pairs. A fade-program comparison matches its first 60 carrier writes before the original changes banks; the complete fade tail is not claimed equivalent. Captured write timing agrees with the 72Hz reconstructed clock within the roughly 6ms register burst duration. See [`media-save/REPORT.md`](../../../analysis/dune-2/dos-comparison/media-save/REPORT.md) for capture details and scope. These results do **not** establish PCM waveform identity with an AdLib board or DOSBox's synthesizer, host output gain, exact SB mixing, callback latency, or MT-32 timbre.
