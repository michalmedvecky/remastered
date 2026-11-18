The full C intro and Ordos finale comparisons exposed an invalid initial decode
in `WSA_LoadFile`. A continuation WSA has a zero first-frame offset and no initial
Format80 stream. The loader nevertheless decoded the previous screen's scratch
bytes, causing ASan heap underreads when loading `INTRO7B` and `OFINALB`.

`tools/patch-native-wsa.py` calls that initial decoder only for a nonzero stream
length. Normal initial frames and every subsequent delta use the existing
decoders. `WSA_DisplayFrame` already preserves the preceding image when the
header has `hasNoFirstFrame` set.

`python3 fidelity/wsa/test-native-wsa.py` compiles the actual C loader and codecs
under ASan. It extracts hash-verified original resource bytes into a temporary
directory, poisons the reused caller buffer, and checks all six continuation
files plus a normal `INTRO7A` initial frame. It verifies that continuation frame
zero preserves the screen and frame one still decodes a delta. Resource hashes
and header offsets are recorded in `resource-fixtures.json`.

The original crash logs, full reconstructed-C scene timelines, source hashes,
compiler flags, and bounded-run summaries are saved under
`analysis/dune-2/dos-comparison/native-scenes`. These C harness runs do not
execute the supplied DOS executable. DOS movie-pixel comparisons are recorded
separately under `analysis/dune-2/dos-comparison/media-save`.
