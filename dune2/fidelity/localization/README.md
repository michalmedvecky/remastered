# Czech text and native resource overlays

The source corpus is `art/localization/en.json`, extracted by
`tools/extract-localization.py` from the hash-verified browser preload's
`ENGLISH.PAK`. The extractor only reads resource slices. It does not execute the
DOS game. `inventory.json` records each resource's hash, sizes, text counts and
word counts:1,347 records,834 distinct translatable texts,10,751 source words.

The Czech sources cover1,338 records. The remaining9 records are immutable
native Mentat scenario selectors. The covered records include resource names,
numbers, personal names and credits which intentionally retain their original
spelling where appropriate; coverage does not mean those identifiers were
renamed. Each house's help and mission text retains its own viewpoint.

| Resource | Format and coverage |
| --- | --- |
| DUNE.ENG |340 little-endian16-bit offsets to uncompressed NUL strings;339 source strings copied, plus native slot339 aliases slot92. UI, unit/building/action names, menus and messages. |
| MESSAGE.ENG |30 uncompressed entries; native loader copies source1–28, skipping empty source0/29. Tutorial/advice messages. |
| INTRO.ENG |39 uncompressed entries; native loader copies source1–37, skipping empty source0/38. Intro/finale subtitles. |
| TEXTH/TEXTA/TEXTO.ENG |40 compressed entries each; house introductions and all campaign briefings, victories, losses and advice. |
| PROTECT.ENG |416 compressed entries;415 copied strings plus preserved native terminal fill slot940. Security introduction/feedback, questions, unchanged WSA names and answer tokens. |
| MENTATH/MENTATA/MENTATO.ENG |FORM/MENT: NAME length-byte records with absolute BE32 body offsets, compressed DESC bodies, INFO bounds.47 subjects per house, including campaign gates and scenario selectors. |
| CREDITS.ENG |120 CR-separated lines with native font/alignment control prefixes. Roles/subtitle localized; authors, company names and copyright retained. |
| BTTN/CHOAM/MENTAT.ENG |Native SHP banks. All text-bearing button frames rebuilt as Czech indexed images; geometry/click areas and transparency remain native. |
| MISC/HERALD/TITLE/AND.ENG |Native CPS images. House question/choice labels, title subtitle and linking word localized. DUNE II logo remains identical. |
| NEW6P/NEW8P/INTRO.FNT |Native Westwood offset/width/row tables and nibble bitmaps extended to254 CP1250 slots. ASCII shapes, advances and font heights remain identical. |

The compressed string codec is the native English128-entry digraph table;
`ESC,byte−127` represents extended bytes. Czech source JSON is Unicode; the
emitted overlays use Windows1250. Plain high bytes must not be inserted into
compressed strings because the engine would interpret them as digraphs.

The FNT loader stores its glyph count and loop counter as uint8. A count of256
would be invalid.254 slots cover the highest required Czech byte253 (`ý`).
Czech accents are composed above native bitmap stems while retaining each base
letter's advance and baseline. The same emitted glyph metadata supplies HD
native-ink evidence; the scalable HD period font has separate Czech contours.

`tools/build-localization.py` emits21 new files under `dist/locales/cs/` and the
manifest `dist/locales/cs.json`, including hashes, decoded font tables, indexed
SHP/CPS evidence, presentation labels, shell translations and byte bounds.
The native file index searches loose root files before PAK members
(`native/opendune/src/file.c:229–249`). Install overlays before `callMain`, so
`File_Init` indexes them. Keep native language index0/ENG; Czech replaces only
the virtual loose-file view. A fresh English boot uses the original files.

The native941-slot string inventory comprises939 source strings, one alias and
one trailing unused fill slot. The copied strings use 35,423 bytes, below the 49,152-byte
allocation. The longest Czech string uses 407 bytes, below the 1024-byte loading
temporary. The builder fails on missing translations, conflicting keys,
unsupported byte encoding, changed printf/control signatures, overflowing
offsets or exhausted native buffers. It rebuilds help INFO maximum stored and
decoded lengths. Nine help selectors, WSA prefixes/names and campaign gates
remain unchanged. Security answer tokens omit diacritics because native ASCII
keyboard input and `GUI_Security_NormaliseText` would otherwise discard accented
bytes; the translated prompts explain this.

The final narrow HUD captions use 37 fewer runtime bytes than the earlier
35,460-byte build. Only abbreviation/action IDs were shortened: `ŠKD`,
`Těž. pěchota`, `Obléh. tank`, `Son. tank`, `Přep. třík.`, `Hlídka`, `Těžit`
and `Lovit`. Full names, descriptions, campaign text and help remain unchanged.
The source damage label uses NEW6P at (296,65), flags 0x11 and character offset−2:
`ŠKD` advances 15 pixels versus the original `DMG` 16; the former five-letter
translation wrapped its final Y onto the next row. Unit/structure headings use
offset−2, while the four 60-pixel action buttons use flags 0x121 and offset−1.
`tools/audit-localization-hud.py` parses the original native string enums,
27 unit rows, 19 structure rows and 14 action rows, then measures the actual
emitted FNT width tables. All 38 displayed headings and 14 action labels fit;
the remaining eight object rows have no displayed abbreviation. The audit is
retained in `fidelity/presentation-fixes/czech-hud-footprint-audit.json`.

Rebuild and verify:

```sh
python3 tools/extract-localization.py
python3 tools/translate-localization-help.py
python3 tools/build-localization.py
python3 tools/audit-localization-hud.py
node --test tests/localization-assets.test.mjs tests/native-locale.test.mjs tests/painted-locale-presentation.test.mjs tests/localization-hud-footprint.test.mjs
python3 fidelity/localization/render-native-czech.py
```

The focused 17 tests independently decode all 945 table entries, all 141 help
records and extended FNT/SHP/CPS files; verify941 stable native IDs, hashes,
controls, printf signatures and bounds; check actual Czech glyph ink and HD
font contours; and preserve the original DUNE II logo. The static review PNGs
show native Czech buttons, all accented glyphs and localized CPS screens.
These checks do not substitute for the separate live browser review.

Original resources, PAKs and the supplied ZIP are never overwritten. The
localization changes text and text-bearing indexed overlays; existing English
voice audio and proper-name graphics remain as supplied. Native Czech bitmap
letters may condense slightly to stay inside the original button bounds; the
HD renderer uses its scalable Czech typography within those same bounds.
