# Native cutscene and speech fidelity

The native-engine browser route uses OpenDUNE's WSA decoder, palette animation,
original font rasterizer, subtitle scheduler, house-specific scene selection,
credits and input handling. The old PNG animation sheets are unsuitable as a
replacement: six WSA files contain continuation deltas whose pixels must be
XORed into the preceding indexed image. Native playback consumes original WSA
bytes and maintains that image state.

This directory contains independently recovered V1.07 data. No DOS game or
emulator was executed to obtain it.

## Reproduce

From the workspace root:

```sh
python3 dune-ii-web/tools/derive-cutscenes.py --opendune-root /path/to/OpenDUNE
python3 dune-ii-web/tools/audit-native-voc.py
python3 dune-ii-web/tools/patch-native-cutscenes.py /path/to/OpenDUNE --write --report dune-ii-web/fidelity/cutscenes/applied-patch.json
python3 dune-ii-web/tools/patch-native-dsp.py /path/to/OpenDUNE --write --report dune-ii-web/fidelity/cutscenes/applied-dsp-patch.json
node --test dune-ii-web/tests/cutscenes.test.mjs
```

The extraction checks the original EXE SHA-256 before and after reading it.
Every PAK and every VOC member read by the audio audit is checked against the
previous resource audit. Both patchers are idempotent. They change only
`src/table/houseanimation.c`, `src/table/sound.c`, `src/audio/sound.h` and
`src/audio/dsp_sdl.c` in the chosen source checkout.

`native-tables.json` includes all records, original byte spans, file offsets,
Ghidra linear addresses, original string names, modern engine voice IDs and
converted WAV asset mappings. `voc-audit.json` records every original VOC block,
duration, decoded sample count and PCM hash.

## Binary observations

The preserved source is `analysis/dune-2/inputs/DUNE2.EXE`, SHA-256
`85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f`.
The MZ header is 0x4c00 bytes. The independently verified Ghidra load image uses
segment 0x1000. Original far data pointers map to file offsets as
`segment*16 + offset + 0x4c00`; the native data segment begins at file 0x37b00.

The REA load-image evidence is
`ev_69580ae9ecd41e37719ac794780b72a790698fe0d8ecd41158485ef96fe33e71`,
retained in `analysis/dune-2/evidence/dune2.rea.json`. It establishes the MZ
mapping, architecture and relocation interpretation; it does not by itself
establish recovery of every cutscene routine. The call sites below are saved
Ghidra assembly/pseudocode exports from `analysis/dune-2/game-final`.

| Sequence | ID | Animation/subtitle/sound rows | Music ID | Caller |
| --- | ---: | ---: | ---: | --- |
| Intro | 0 | 22 / 20 / 83 | 27 | 0x781d0 |
| Level 4 Harkonnen | 1 | 4 / 6 / 0 | 34 | 0x74860, 0x74950 |
| Level 4 Atreides | 2 | 4 / 6 / 0 | 34 | 0x74860, 0x74950 |
| Level 4 Ordos | 3 | 4 / 6 / 0 | 34 | 0x74860, 0x74950 |
| Level 8 Harkonnen | 4 | 3 / 6 / 0 | 34 | 0x74860, 0x74950 |
| Level 8 Atreides | 5 | 3 / 5 / 0 | 34 | 0x74860, 0x74950 |
| Level 8 Ordos | 6 | 3 / 5 / 0 | 34 | 0x74860, 0x74950 |
| Harkonnen finale | 7 | 11 / 7 / 7 | 30 | 0x747a0 |
| Atreides finale | 8 | 8 / 5 / 0 | 31 | 0x747a0 |
| Ordos finale | 9 | 13 / 6 / 2 | 32 | 0x747a0 |

Counts exclude terminators. All 75 animation rows, 72 subtitle rows and 92 sound
events match the primary [OpenDUNE table source](https://github.com/OpenDUNE/OpenDUNE/blob/ebea79aeba025be2fe9004570e9255044aacc0be/src/table/houseanimation.c),
after the string relocation described below. The comparison is stored record
by record in `native-tables.json`, rather than inferred from similar filenames.

Native records are little endian:

* Animation: 8 bytes, `far name pointer (offset,segment), duration:u8,
  frameCount:u8, flags:u16`. A zero duration terminates the list.
* Subtitle: 10 bytes, `stringId:u16, colour:u16, animationId:u8, top:u8,
  waitFadein:u8, paletteFadein:u8, waitFadeout:u8, paletteFadeout:u8`.
  String 0xffff terminates the list. Native INTRO IDs 1–37 map to modern global
  string IDs 368–404; 0 remains null. Interlude strings 287–320 already use
  global IDs.
* Sound event: 3 bytes, `animationId, logicalVoiceId, wait`. Voice 0xff
  terminates the list. These are logical `Voice_Play` IDs, not voice-file IDs.
* Voice: 6 bytes at file 0x382c8, `far filename pointer, priority:u16`.
* Feedback: 14 bytes at file 0x37da4, `voiceId:u16[5], messageId:u16,
  soundId:u16`. There are 94 records. In intro feedback, `messageId` is a flag
  forcing the corresponding subtitle to be shown during speech.
* Logical voice map: 120 u16 records at file 0x37cb4. The entire map matches
  the source table after canonical filename mapping.

The native executable has **132** voice records. Native ID 23 is `+OK.VOC`,
which is absent from the supplied PAKs; later voice IDs are one greater than
the reference source IDs. The patch preserves source IDs used by C callers,
matches filenames, and appends this extra entry as modern ID 131. It also uses
the native English acknowledgement filenames (`+AFFIRM.VOC`, `+REPORT1.VOC`,
etc.) rather than the reference `%c` variants.

Three speech queues differ from current reference source:

| Feedback | Restored native speech |
| ---: | --- |
| 75 | DUNE |
| 76 | BLDING, DYNASTY |
| 84 | ENOSET, ETERRIT, EANDNO, ERULES |

All other 91 feedback records match after voice ID adaptation. Source IDs must
remain stable: copying raw native voice IDs into the modern C engine would
silently select the wrong samples.

## Playback contracts

The following behavior is supported by the saved native playback body
`pseudocode/raw/0x7e680.c`, its assembly, the prepare thunk
`pseudocode/raw/0x42a00.c`, and the corresponding
[OpenDUNE cutscene implementation](https://github.com/OpenDUNE/OpenDUNE/blob/ebea79aeba025be2fe9004570e9255044aacc0be/src/cutscene.c).
The recovered Ghidra function boundaries merge some switch bodies into other
routines, so the native C export alone is not treated as authoritative typing.

Animation durations use six GUI ticks per duration unit. Row scheduling adds a
30-tick boundary wait. Flags encode fixed-frame, looping, sequential and
text-only presentation; placement defaults to (8,24) and flag 0x20 selects
(0,0). Native WSA state handles forward/reverse XOR deltas and wrap frames.
Flags 0x80 and 0x400 use the existing screen contents during transitions,
which matters for continuation WSA files. The intro uses INTRO.PAL and
INTRO.FNT, with six animated subtitle colors at palette entries 215–220.

Subtitle wait counters and sound-event `wait` values advance on calls to the
subtitle routine, usually once per animation frame. They are not independent
wall-clock delays. Text is centered at x=160; a carriage-return line advances
18 pixels. Palette fading separately advances at approximately seven GUI
ticks per update. Intro speech is selected using feedback base 74 plus the
subtitle index. This coupling requires the native scheduler and queue order.

Campaign interludes select the player's house at stages 4 and 8. Winning the
last stage selects the appropriate house finale, fades music and then runs
credits. Credits use CREDITS.ENG's control bytes for font and alignment,
CREDIT1–11.SHP, MAPPLAN.CPS, faction palette remapping, and music ID 33.
The source credits routine scrolls one pixel per six GUI ticks and retains
its native picture/fade cycle. Credits and the initial logo sequence are
code-driven, rather than additional rows in the ten scene tables.

Skip behavior remains gated by `g_canSkipIntro` and the native input history.
The browser port must preserve this policy rather than skipping every scene
unconditionally. Native completion restores palette/screen/input state and
returns to the appropriate menu or campaign flow.

## VOC correction and checks

The 223 supplied VOC files contain 222 uncompressed PCM blocks and ten silence
blocks: 213 files contain one PCM block; nine contain PCM followed by silence;
FILLER.VOC contains only silence. The stock SDL DSP plays only an initial PCM
block and drops the others. In particular, that discards FILLER's **0.999125
seconds** and shortens nine other spoken phrases by 10.125–46.032 ms.

The DSP patch reads all supplied block types and converts each silence using
its own time constant. A silence duration is
`(LE16(count)+1)*(256-timeConstant)/1000000` seconds; its PCM representation is
rounded to the nearest active-rate sample. The existing SDL converter then
resamples the complete waveform. PCM rates retain the source DSP's integer
`1000000/(256-timeConstant)` convention; sample-clock hardware and browser
resampling are not claimed cycle-identical.

The tests compile the actual patched C decoder and compare every byte, rate
and length for all 223 supplied resources against an independent Python
decoder. They also check exact table coverage, voice ID adaptation, extraction
reproducibility and patch idempotence. No DOS code is executed by these tests.

## Remaining limits and fidelity tests

Observed data coverage is complete for the ten selected sequences and the
supplied voice files. It is not a claim of complete function discovery or
observed DOS playback. Native table callers pass an additional pointer which
the recovered prepare body does not consume; its meaning remains unresolved.
The pointer bytes are retained in the manifest.

`+OK.VOC` cannot be recovered from the supplied resources. The modern engine
does not reference the appended entry in the verified scene/feedback tables.
Other language voice sets were not supplied or validated. The historical DSP
interface supplies no source allocation length; the patched decoder bounds
records and aggregate size, while its input files remain hash-verified.

Browser acceptance should verify: the complete intro reaches the menu;
INTRO7b, INTRO8b/c and corresponding finale continuation frames retain prior
pixels; narration restores DUNE/BLDING/DYNASTY and the full rule sentence;
all three stage-4/stage-8 interludes select their correct house; each finale
enters credits; palette fades and text lines use original indices and fonts;
skip exits cleanly when permitted; FILLER preserves its approximately
one-second queue gap. Runtime comparison with DOS remains unperformed and
would require a separately approved bounded emulator experiment.
