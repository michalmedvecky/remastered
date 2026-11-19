# Dune II — painted HD browser reconstruction 0.8.0

Dune II uses the approved painted HD style for all world buildings, units and terrain. Complete new RGBA drawings retain native footprints, pivots, facings and animation decisions. The original engine still controls game rules, input, damage, fog and timing. The HUD, menus, advisors, object previews and campaign interface use matching new art and fitted vector text. A render-time camera interpolates committed tile steps with a current-snapshot terrain fringe, while native world picking compensates for the displayed offset. Graphics switches live between **HD · painted** and **Original · 1992**. [Artwork gallery](dist/artwork.html) and [graphics architecture/coverage](HD-GRAPHICS.md) distinguishes painted art, derived states and retained native effects.

Dune II runs at `/dune2/` in the Remastered collection. The complete recovered OpenDUNE C core runs as WebAssembly with V1.07 compatibility fixes. Original PAKs supply campaigns, graphics, UNIT/BUILD/TEAM scripts, voices and ADL music. Native callbacks, routing, combat, WSA cutscenes and IFF saves remain in the compiled engine. The browser does not execute or interpret the DOS EXE.

Release 0.8 adds Czech text for the interface, campaigns, Mentat help and scene captions, with an English/Czech choice before launch. The original-derived angular vector font and matching local webfont include Czech diacritics. Translation files are verified in-memory overlays; original PAKs and saves retain their formats. [Localization coverage and limits](fidelity/localization/README.md).

The presentation fixes keep whole advisor scenes coherent through speech, confirmation and mission results, fit all six rolling credit columns inside the painted frame, and render granular spice over continuous sand. The ordinary preview bank covers 46 resources and 268 native phases, including all four mission outcome pictures. [Presentation evidence and limits](fidelity/presentation-fixes/README.md) records complete UI checks separately from native gameplay tests.

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

The checked-in runtime is ready to serve. Native rebuilding uses Emscripten 7.0.0, the retained sources and original game files. The presentation is browser code with retained generated art, references and deterministic packers:

```sh
python3 tools/build-native.py --data-dir /path/to/original/game --emcc /path/to/emcc
python3 native/music/build.py --emcc /path/to/emcc --emxx /path/to/em++
npm run build:art
python3 tools/package-native-source.py
```

Run these commands from `dune2/`. `DUNE2_DATA_DIR` and `EMCC` can replace the core build arguments. The data directory must contain the original case-preserved names. Generated `native/data/` is ignored. `build:art` reads verified original PAK slices from the retained native preload and saved generated art; it makes no new model calls. No external analysis directory or Prehistorik checkout is required. The [complete source index](dist/native/source.html) links the main source.tar.gz and all content-addressed artwork volumes (each at most48MiB uncompressed). Download and extract every volume into the same directory. Together they include full matching native source, browser adapters, PNG codec, build material, generated art, original decoded visual references and provenance. SOURCE-MANIFEST.json lists exact hashes, sizes and archive assignments for every corresponding-source file. Original PAK/EXE archives are not included; owners still supply original data for a native rebuild. Retained SDL2 source and dependency licenses accompany the native engine.

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
