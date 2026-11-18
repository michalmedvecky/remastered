# Cutscene fidelity: evidence and limits

The browser port uses the native OpenDUNE cutscene, WSA, font and credits code
with recovered V1.07 tables and speech corrections. The previous flattened PNG
animation sheets are not used as a substitute for native continuation playback.
The complete extraction and format description is in
[cutscenes/README.md](cutscenes/README.md).

## What was verified

The original EXE SHA-256 is
`85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f`.
The extraction checks that hash before and after reading. Addresses use the
independently verified Ghidra MZ load image (REA evidence
`ev_69580ae9ecd41e37719ac794780b72a790698fe0d8ecd41158485ef96fe33e71`).
Saved caller evidence is under
`../../analysis/dune-2/game-final/{assembly,pseudocode/raw}/`:
`0x781d0` selects intro; `0x74860`/`0x74950` select stage-4/stage-8 house
interludes; `0x747a0` selects the house finale; `0x42a00` prepares playback;
`0x7e680` is the main recovered playback body. Ghidra merged some switch bodies;
the saved C alone is not treated as complete type or boundary evidence.

All ten selected sequences were recovered directly from original bytes:
75 animation rows, 72 subtitles and 92 sound events, excluding terminators.
Every active row matches pinned primary OpenDUNE source after relocating native
INTRO string IDs into its merged global string table. The full comparison,
per-record raw bytes, file offsets and Ghidra addresses are saved in
[native-tables.json](cutscenes/native-tables.json).

| Sequence | Animation rows | Subtitle rows | Sound events |
| --- | ---: | ---: | ---: |
| Intro | 22 | 20 | 83 |
| Level 4 Harkonnen / Atreides / Ordos | 4 / 4 / 4 | 6 / 6 / 6 | 0 / 0 / 0 |
| Level 8 Harkonnen / Atreides / Ordos | 3 / 3 / 3 | 6 / 5 / 5 | 0 / 0 / 0 |
| Finale Harkonnen / Atreides / Ordos | 11 / 8 / 13 | 7 / 5 / 6 | 7 / 0 / 2 |

The complete native `cutscene.c` in the browser source tree is byte-identical
to OpenDUNE commit `ebea79aeba025be2fe9004570e9255044aacc0be`, SHA-256
`d7c5405d8f6a25ce459b651f2e3d0658b34f6ece4b7d45bd471c9ebedc4a1ac8`.
[source-integrity.json](cutscenes/source-integrity.json) records the check.
This establishes unchanged primary-source behavior, while the binary row
comparison establishes the game's scene schedules. It does not prove every
instruction in that C implementation matches the original binary.

## Material corrections

The original has 132 raw voice entries, 94 feedback queues and 120 logical
sound mappings. An extra native `+OK.VOC` at ID 23 shifts later raw voice IDs by
one relative to modern source. The patch maps by filename, preserves source
IDs referenced by the engine and appends the extra entry. Logical cutscene
sound IDs remain unchanged; they are not raw voice-file indices.

Native feedback 75 restores DUNE; feedback 76 restores BLDING, DYNASTY;
feedback 84 restores the full ENOSET, ETERRIT, EANDNO, ERULES phrase. The other
91 queues agree with the primary source after ID mapping. Original English
acknowledgement filenames and priorities are retained.

The supplied 223 VOC files consist of PCM and silence blocks. The stock SDL
DSP discards trailing silence and the silence-only FILLER.VOC. The patch
preserves all ten silence blocks, including FILLER's 0.999125 seconds, using
each block's own time constant. See [voc-audit.json](cutscenes/voc-audit.json).
The actual patched C decoder was compiled and compared against an independent
Python decoder for every byte, rate and length of all 223 resources.

Native WSA playback preserves indexed XOR state, including six continuation
files: HFINALC, OFINALB, OFINALC, INTRO7B, INTRO8B and INTRO8C. It retains the
original timing tables, placement flags, fades, six subtitle palette colors,
INTRO.FNT text, narration queues, house selection and credits control stream.
Credits use original CREDITS.ENG, CREDIT1–11.SHP, MAPPLAN.CPS and music ID 33.

The approved full-engine comparison exposed an additional continuation-loader
defect: a WSA without a stored first frame attempted to Format80-decode stale
compressed data. The loader now skips that decode and preserves the inherited
image. All six continuation boundaries were exercised; the complete native
intro and three finale/credits cases run with AddressSanitizer without errors.

## Approved DOS observations

The later user-approved DOSBox-X experiments used fresh disposable copies and
checked all 19 original hashes before boot and after each case. They recorded
the complete intro, all three house finales and bounded credits samples,
including physical indexed VGA frames, six-bit palettes, GUI/PIC clocks and
event-based original OPL writes. The configuration copies explicitly select
AdLib music/effects and Sound Blaster speech. The original intro executable is
unchanged; finale entry selectors are changed only in copied executables and
documented in patch ledgers.

The complete method, retained paths and limitations are in
[media-save/REPORT.md](../../analysis/dune-2/dos-comparison/media-save/REPORT.md).
All 54 active animation records occur in the recovered order. The production
WSA decoder has exact movie-region matches in every named record, including
INTRO7B/8B/8C, HFINALC and OFINALB/C. Exact full-frame identities exist in the
native timelines for **327/336 intro samples** (all 32 logo images included),
**120/129 Harkonnen**, **185/197 Atreides** and **115/122 Ordos** finale/credits
samples. Exact frame-and-palette pairs number 298,112,169 and107 respectively.
These are identity comparisons within each scene timeline, not timestamp
synchronization.

An initial headless scene entry omitted the frontend's existing mouse-hide
call. Its apparent intro mismatch was exactly 70 cursor pixels at
x160–168,y100–113. After correcting that harness state, six representative
previously mismatching movie/continuation frames match every one of the 64000
original pixels. Production caller behavior already hid the mouse.

Original AdLib score/SFX captures also found and corrected version-3 SFX
attenuation. Current production source matches original golden ranges for
the complete logo score, the first 81 seconds of intro music with an observed
effect, all three finale scores/effects, the first 60 fade writes per house
and the captured credits prefixes. See [music/PROVENANCE.md](../native/music/PROVENANCE.md)
and [music/golden.json](music/golden.json).

## Reproduction and integration

`tools/derive-cutscenes.py` creates the extraction and comparison;
`tools/audit-native-voc.py` audits original voice resources.
`tools/patch-native-cutscenes.py` and `tools/patch-native-dsp.py` are idempotent
source patchers invoked by the native build. Applied source hashes are in
[applied-patch.json](cutscenes/applied-patch.json) and
[applied-dsp-patch.json](cutscenes/applied-dsp-patch.json).
`tests/cutscenes.test.mjs` checks row coverage, voice identity, source-bound
extraction, patch idempotence and independently decoded PCM. Four tests pass.

## Explicit limits

The original static pass did not execute DOS code; the later observations
above were explicitly approved. Runtime coverage is the intro and three
finales with credits samples. The six stage-4/stage-8 interludes retain static
table/asset coverage; a complete credits cycle was not observed.

The unmatched intro samples comprise four randomized-reveal images, three
in-progress WSA updates, one unsampled initial frame/palette update and one main-menu
image after direct scene return. Unmatched finale samples are one selected
frame boundary and finish/credits transitions or scroll updates. Those
samples remain retained and are not claimed equivalent. Stable graphical
samples inspected byte by byte have no remaining difference.
For each of the three mixed WSA images, every captured movie pixel belongs
to one of two adjacent decoded native frames; no pixel falls outside that
pair. This identifies an in-progress VRAM copy rather than a decoder error.
The INTRO4 initial image also matches every decoded pixel; native WSA
frames0 and1 are requested at the same logical tick before its next video
sample. The Harkonnen selected-frame boundary contains the previous decoded
frame0 plus its preceding subtitle while frame1 is being selected.

Native `+OK.VOC` is absent from the supplied resources. The verified scene and
feedback tables do not reference the appended modern entry. Other language
sets remain unvalidated. The meaning of an additional pointer passed to the
native prepare routine is unresolved; its bytes are preserved. The legacy DSP
API has no input-allocation length, so its retained interface relies on the
hash-verified game resource set in addition to parser bounds.

Original animation pointers advance before a 30-GUI-tick tail wait; native
entry logs are emitted after that wait. DOS samples are roughly 30 ticks
apart. The headless C model advances time at cooperative idle and models VOC
duration without hardware/device callback latency, so exact fade curves and
narration latency are not established by matching timeline identities.
Browser resampling, background suspension and OPL synthesis remain separate
limits. Full later-intro OPL interleavings, PCM waveform identity, complete
credits timing and permitted skip/return paths are not claimed fully audited.
