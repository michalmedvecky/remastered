# Native browser engine: build, source and licenses

This port compiles the reverse-engineered OpenDUNE C engine to WebAssembly.
The original DOS executable supplies static and authorized bounded DOSBox-X
runtime evidence. It is not executed or interpreted by the browser. Gameplay, EMC callbacks, WSA playback, original
fonts and save routines run in the compiled C engine. Browser adapters provide
cooperative scheduling, SDL2 output, persistent save storage and audio.

## Source inventory

| Component | Source and revision | License notices |
| --- | --- | --- |
| OpenDUNE | `opendune/`, commit `ebea79aeba025be2fe9004570e9255044aacc0be` | GPL version 2; `opendune/COPYING` |
| Browser core adapters | `browser/`, `../tools/build-native.py`, `../dist/native-host.mjs` | Distribute corresponding derivative core/glue source under GPLv2 terms, retaining existing notices |
| ADL playback | `music/vendor/adplug/`, AdPlug commit `3d9457ac91121302a752577b2bf063b4aea202b8` | LGPL-2.1-or-later headers; `adl.cpp` also retains the original ScummVM GPL-2.0-or-later notice; preserve both |
| ADL browser adapters | `music/renderer.cpp`, adapted `music/vendor/adplug/player.h` | GPL-2.0-or-later notices |
| Nuked OPL3 | `music/vendor/nuked-opl3/`, revision `765ec962e473aeb767e4cba74ffdc8f588ffbfe8` | LGPL-2.1-or-later; vendor `LICENSE` and source headers |
| Emscripten | recorded compiler `7.0.0`, revision `777e6e5db7b4990bcaeb1b9998ed642cc84e6629` | MIT / University of Illinois-NCSA notices; retain runtime notices |
| SDL2 Emscripten port | build cache selected SDL `2.32.10` | zlib license; preserve `LICENSE.txt` |

The ADL adapter and OPL emulator form the separate `dist/music/adl.wasm` module.
The main engine outputs are `dist/native/dune-native.mjs`, `.wasm` and `.data`.
`../fidelity/native-build.json` and `music/build-manifest.json` record actual
compiler commands, source hashes and output hashes. These manifests are more
specific than this prose if a later build updates the compiler or source.

Original Dune II assets, voice recordings, scores and game branding retain their
original rights. The engine licenses do not grant a license to redistribute
those assets. `data/`, the preloaded `.data` file and `dist/music/banks/*.ADL`
contain original game data; keep their provenance distinct from source code.

## Rebuild

Requirements are Python 3, Node.js for verification, a host C compiler for
oracle/decoder tests, and the recorded Emscripten SDK. The build commands accept
explicit compiler paths; they do not require the original temporary SDK path.
Use the complete retained source tree, including `opendune/include`,
`opendune/source.list`, browser adapters, fidelity patchers and music headers.

From `dune-ii-web/`, with an activated Emscripten SDK:

```sh
python3 tools/build-native.py --data-dir /path/to/original/game --emcc "$(command -v emcc)"
python3 native/music/build.py --emcc "$(command -v emcc)" --emxx "$(command -v em++)"
python3 -m http.server 8772 --bind 127.0.0.1 --directory dist
```

The core build reads original PAK/CFG files from the selected `--data-dir`
(or `DUNE2_DATA_DIR`; the default is generated `native/data/`), copies the needed files into `native/data/`, applies
the terrain, combat, cutscene, INI bounds and audio compatibility patches, then invokes
Emscripten with SDL2 and Asyncify. Original inputs stay unchanged. It creates
`opendune.ini` for the browser data and save paths. Saved missions use a separate
IDBFS mount at `/save`; exported native save files can be imported again.
After patching and before compiling, `tools/stamp-native-changes.py` compares
retained pristine upstream hashes and adds dated modification notices to
changed source files. Unchanged upstream files retain their exact original bytes.

The music renderer build compiles only the retained C/C++ source. ADL bank data
is separately extracted from the original SOUND.PAK according to
`music/banks.json` (archive offsets, lengths and SHA-256). Retain the complete
21-bank set and browser music player alongside `adl.wasm`. This document does
not claim that the music build script regenerates original bank data.

Serve `dist/` over HTTP. Opening `index.html` as a local `file:` URL does not
provide the required module, WASM and browser-storage behavior. Use the launch
button to activate browser audio. Background tabs pause the monotonic foreground clock and both audio paths;
the native frame and GUI timers use cooperative yields.

These commands recompile the two native modules. The asset-free source archive
does not contain the game's title image, decoded asset bundle, ADL banks or
original analysis inputs. Supply those data separately for a complete playable
site. `music/banks.json` gives the bank extraction ranges; `tools/import-assets.py`
documents the larger asset conversion but also requires the retained resource
audit from the development workspace.

The repository's `npm test` and `npm run build` are self-contained. Resource
checks parse the hash-verified original files already embedded in
`dist/native/dune-native.data`; original EXE re-extraction is an explicitly
separate research operation. `npm run verify:originals -- --game-dir /path/to/game
--zip /path/to/archive.zip` rehashes supplied originals without executing them.

The source-only download excludes proprietary runtime data and compiled output.
Supply those separately to run resource-dependent tests or play. With a host C
compiler, `npm run test:native` tests retained compatibility code independently
of the original-analysis paths. The packager uses the retained dependency
sources/licenses; `--emscripten /path/to/sdk` is only needed to refresh them.

## Deliver corresponding source with the binaries

Browser delivery downloads executable WASM. Keep the complete matching patched
source, headers, build/patch scripts, interface files, notices and revision
manifests available beside those binaries. A link to upstream alone omits this
port's changes. Preserve copyright and warranty notices and identify modified
files. GPLv2 section 3 permits equivalent source access from the same place as
the binary download. This delivery uses that source-accompaniment approach,
rather than relying on a future written offer. See the
[GPLv2 text](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html).

For LGPL components, retain their notices and license text and supply their
matching source plus the complete adapter/build material needed to modify the
library and rebuild/relink the WASM module. Full rebuildable source supports
the section 6(a) route; minified JavaScript and WASM alone do not. Preserve the
recipient's ability to debug such modifications. See the
[LGPL 2.1 text](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html).

The final release should provide `dist/native/source.tar.gz` through the
existing Engine source link and a visible credits/license page. Include the
patched OpenDUNE tree, browser/music code, all relevant build and fidelity
scripts/data, GPL/LGPL texts, vendor authors/notices, and the SDL2/runtime
license notices. Include the selected SDL2 port source or a matching source
archive with the build materials. Keep the source archive synchronized with
the final compiled hashes. Exclude caches, private paths and original game
assets from that code archive; document where owners supply their own data.

`tools/package-native-source.py` builds the matching source download and copies
license notices. `../fidelity/source-package.json` records its hash and the bound
binary hashes. The credits page is `dist/fidelity.html`.

## Fidelity and test boundaries

The binary-derived cutscene rows match the retained primary source; three
native narration queues and VOC silence behavior are corrected. See
`../fidelity/CUTSCENES.md`, `../fidelity/cutscenes/native-tables.json` and the
separate terrain/combat evidence. `opendune.ini` disables OpenDUNE's enhanced
gameplay mode. Compatibility patches are still a source reconstruction, not
proof of instruction-for-instruction equivalence with the DOS program.

Static evidence and compiled unit/oracle tests do not establish that every
campaign branch, cutscene, finale, credits cycle, save version or music cue has
been observed in a browser. Report browser smoke tests separately and state
which sequences were actually exercised. Authorized bounded DOSBox-X comparisons cover the named terrain, combat,
scene, music and save cases in `../FIDELITY.md`. Browser resampling, cooperative timing and OPL chip emulation
also differ from original sound-card hardware.
