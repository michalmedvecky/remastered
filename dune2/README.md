# Dune II — HD browser reconstruction 0.4

Dune II now has a 4× HD presentation at 1280×800, with new material detail on the original terrain, buildings and unit frames. The Graphics selector switches to the original 1992 output at any time. The native 320×200 canvas retains input and game rules; a separate pointer-transparent canvas draws the new artwork. [HD graphics](HD-GRAPHICS.md) records coverage, tests and limits.

Dune II runs at `/dune2/` in the Remastered collection. The complete recovered OpenDUNE C core runs as WebAssembly with V1.07 compatibility fixes. Original PAKs supply campaigns, graphics, UNIT/BUILD/TEAM scripts, voices and ADL music. Native callbacks, routing, combat, WSA cutscenes and IFF saves remain in the compiled engine. The browser does not execute or interpret the DOS EXE.

From the collection root:

```sh
npm start
# http://127.0.0.1:6002/dune2/
npm --prefix dune2 test
npm --prefix dune2 run build
```

Node 24+, Python3 and a host C/C++ compiler with AddressSanitizer support are required for the complete tests. No npm dependency installation, emulator, original ZIP or external analysis directory is needed. The tests use original PAK slices already present in the compiled preload, verify their original hashes, and parse their resource directories independently. The portable table/patch tests are explicitly distinct from original-EXE re-extraction.

Use left click to select/command, right click to cancel, F2 for Options and F1 for the Mentat. Save in the native Options menu. Browser storage persists native saves; Saved missions exports backups and imports original `SAVE000.DAT` files into free slots. Background tabs and browser dialogs pause the game clock and audio. Saves belong to the current browser origin; export from another deployment before moving to this host.

## Rebuilding

The checked-in runtime is ready to serve. Native rebuilding uses Emscripten 7.0.0, the retained sources and original game files. The HD build additionally uses the owned decoded reference asset bundle already present in this full repository:

```sh
python3 tools/build-native.py --data-dir /path/to/original/game --emcc /path/to/emcc
python3 native/music/build.py --emcc /path/to/emcc --emxx /path/to/em++
python3 tools/build-hd-assets.py
python3 tools/package-native-source.py
```

The HD builder requires `dist/assets/content.json` and the 16 original screen PNGs
referenced by its `graphics.images` table. These decoded original-asset derivatives
are included in the full repository/runtime, but excluded from the source-only
download. To rebuild HD assets from that download, supply the same owned decoded
reference bundle alongside the original game files; the original PAKs alone are
not all of this builder’s inputs. Retained generated material/cover sources are
included in the source download.

Run these commands from `dune2/`. `DUNE2_DATA_DIR` and `EMCC` can replace the core build arguments. The data directory must contain the original case-preserved file names. Generated `native/data/` is ignored. The source packager uses the retained licenses, SDL2 source archive and port recipe; optional `--emscripten /path/to/sdk` refreshes those dependencies. The downloadable `dist/native/source.tar.gz` includes full matching patched source and build materials, excluding proprietary original assets and including the generated HD material/cover sources and their provenance.

`npm run build` verifies the package, compiled source bindings, ADL banks, preloaded original resource hashes and every corresponding-source archive entry. An optional read-only original-input check is separate:

```sh
npm run verify:originals -- --game-dir /path/to/game --zip /path/to/dune-2_1992.zip
python3 tools/check-original-cutscenes.py /path/to/game/DUNE2.EXE
```

After a reviewed runtime or source-package change, refresh the collection snapshot with `npm run snapshot` from the repository root. The shared Dockerfile, image publisher and [k3s manifests](../deploy/k3s/README.md) include this game. A separate Dune workload or ingress rewrite is unnecessary.

## Fidelity and evidence

[FIDELITY.md](FIDELITY.md), [COMBAT-FIDELITY.md](COMBAT-FIDELITY.md), [terrain](fidelity/terrain/README.md), [cutscenes](fidelity/CUTSCENES.md), [music](native/music/PROVENANCE.md) and [RESEARCH.md](RESEARCH.md) distinguish original observations, reconstructed source and unresolved coverage. Authorized bounded DOSBox-X experiments on copies verified three terrain seeds, 5,854 controlled combat fixtures, the full introduction, three endings, selected music register streams and save cross-loading. The original ZIP and all 19 inputs remained unchanged.

The compact golden outputs and current-source regressions are included. Full raw Ghidra projects, DOS recordings, input tapes and exploratory failures remain in the preserved research workspace; they are not required to play or run CI. No exhaustive campaign, physical sound-card or universal timing/save equivalence is claimed. The supplied archive lacks OK.VOC; three music mappings point to absent ADL entries.

The historical JavaScript prototype remains at `dist/prototype.html`. Its JSON saves and engine documentation describe that earlier implementation, separate from the default native engine and native saves.

OpenDUNE is GPLv2. ADL sources retain ScummVM GPLv2-or-later and AdPlug LGPLv2.1-or-later notices; Nuked OPL is LGPLv2.1-or-later; SDL2 is zlib licensed. Full source, notices and component licenses accompany the browser binaries. Original assets, recordings, scores and branding retain their original rights.
