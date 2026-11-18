# Terrain fidelity evidence

The browser reconstruction now has a complete 64 × 64 landscape generator and scenario terrain loader in [`dist/terrain.mjs`](../../dist/terrain.mjs), plus the same compatibility corrections for the full C browser engine in [`patch-native.py`](patch-native.py). The implementation preserves RNG draw order, both smoothing passes, terrain thresholds, recursive spice growth, visual edge masks, Bloom/Field/Special ordering, and playable map bounds. It does not replace the map with a hand-drawn approximation.

**Evidence scope:** all 4,096 generated icon IDs and pre-icon terrain classes agree with an independently compiled C reference for all 48 unique supplied mission seeds and three extra edge seeds. Terrain-only MAP-section projections for all 66 supplied scenario files agree on icon IDs, baseline/change flags, and RNG bytes/draw counts. These projections intentionally exclude object creation and occupancy. The C reference is extracted from official OpenDUNE at commit `ebea79aeba025be2fe9004570e9255044aacc0be`, with differences checked against the supplied V1.07 executable. Those initial checks are static-source and cross-language checks. The subsequently authorized original-DOS comparisons below add runtime evidence for three named seeds; neither set is a complete Scenario_Load snapshot comparison.

## Original evidence

The input `DUNE2.EXE` remains SHA-256 `85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f`. [`source-verification.json`](source-verification.json) binds saved REA/Ghidra exports to the original file by reconstructing MZ relocations and FBOV overlay fixups, then comparing **3,241 instruction records in 16 functions**. It records the saved assembly and pseudocode hashes and their REA evidence paths. Source bytes, rather than potentially misleading segmented decompiler globals, are authoritative.

| Function address | Established role and saved pseudocode |
| --- | --- |
| `0x75f00` | [Landscape generator](../../../analysis/dune-2/game-final/pseudocode/raw/0x75f00.c), all stages and exact random-call order |
| `0x76799` | [Recursive spice insertion](../../../analysis/dune-2/game-final/pseudocode/raw/0x76799.c), ordinary/thick transitions and rock rejection |
| `0x768b6` | [Interpolation coordinate helper](../../../analysis/dune-2/game-final/pseudocode/raw/0x768b6.c), masking X only |
| `0x39b86` | [Byte PRNG](../../../analysis/dune-2/game-final/pseudocode/raw/0x39b86.c), carry-sensitive shifts and feedback |
| `0x1d65a` | [Random tile displacement](../../../analysis/dune-2/game-final/pseudocode/raw/0x1d65a.c), signed arithmetic shifts |
| `0x1d819` | [Packed tile distance](../../../analysis/dune-2/game-final/pseudocode/raw/0x1d819.c), `max(dx,dy) + floor(min(dx,dy)/2)` |
| `0x74e80` | [Scenario loading](../../../analysis/dune-2/game-final/pseudocode/raw/0x74e80.c), terrain overrides and load order |
| `0x7a99c` | [Scenario spice field](../../../analysis/dune-2/game-final/pseudocode/raw/0x7a99c.c), radius-five octagonal distance, randomized boundary |
| `0x79ba0` | [Landscape classification](../../../analysis/dune-2/game-final/pseudocode/raw/0x79ba0.c), icon-to-physics type mapping |
| `0x79f4a` | [Spice change](../../../analysis/dune-2/game-final/pseudocode/raw/0x79f4a.c), amount class transition and neighboring edge repair |
| `0x7a086` | [Spice edge repair](../../../analysis/dune-2/game-final/pseudocode/raw/0x7a086.c), native boundary-check peculiarity |

[`tables.json`](tables.json) contains original file offsets, hashes, values, and logical DS addresses for the 21-point perturbation stencil, two 21-record interpolation tables, signed X/Y displacement tables, 83-word landscape classifier, map bounds, and spice eligibility fields. [`terrain-tables.mjs`](../../dist/terrain-tables.mjs) contains the corresponding values used by JavaScript. Landscape icon group 9 in the supplied `ICON.MAP` starts at index 154 and maps its offsets to icon IDs 127–209.

## Algorithm and coordinates

1. Seed the byte PRNG directly from the scenario's 32-bit `Seed`. Its first three state bytes mutate; the fourth remains unchanged. Initialize 272 low-nibble samples, capped at ten. Apply `(random & 15) + 1` broad perturbations and `(random & 3) + 1` low-value perturbations over the 21-point stencil. Every perturbation consumes its own original random call.
2. Place the first 256 samples at four-tile intervals on the 64 × 64 grid. Interpolate the remaining samples using alternating tables selected by X parity, then average each tile with its eight neighbors using saved row snapshots. At outer edges the center value substitutes for missing smoothing neighbors.
3. Choose rock threshold `clamp(random & 15, 8, 12)`. Choose dune threshold as an unsigned word `(random & 3) - 1`, capped at rock threshold minus three. Classify values above rock+4 as mountain, values at least rock as rock, values at most dune as dunes, and the rest as sand.
4. Insert `random & 47` spice groups. Select Y then X until the material permits spice; each group performs `random & 31` displacement attempts. Its distance is `random & 63`, and a separate random magnitude is repeatedly halved until within that distance. A third draw selects the signed step-table direction. Adding spice to existing spice promotes it to thick spice and recursively expands compatible neighbors; incompatible neighboring terrain demotes thick spice to ordinary spice.
5. Map material types to visual icon offsets using neighbor bits N=1, E=2, S=4, W=8. Rock connects visually to mountains; ordinary spice connects to thick spice. Base offsets are sand=0, rock=1, dunes=17, mountain=33, spice=49, thick spice=65. Then map through the original icon group.
6. Apply explicit `C...` terrain records, Bloom, Field, then Special. `Field` uses `max(dx,dy)+floor(min(dx,dy)/2)` at radius five; boundary points consume a coin draw before terrain eligibility is checked. It changes discrete terrain classes, not a radial resource quantity. `Bloom` and `Special` select icons 208 and 209 and preserve baseline IDs while setting the change bit.

Tiles are stored on a 64 × 64 grid regardless of map scale. Packed coordinates use `x | (y << 6)`; the source does not independently clamp X before that OR. Positions use eight fractional bits per tile, centered at low byte 128. A tile is 16 display pixels, so one display pixel equals 16 position units. Playable bounds are `(1,1,62,62)`, `(16,16,32,32)`, or `(21,21,21,21)` for scales 0, 1, or 2; map scale changes bounds, not generation resolution.

The generator's `nativeTypes` records material classes before icon conversion. `landscapeTypes` records the icon-derived physics class afterward, including partial terrain types. Treating every partial terrain sprite as its underlying coarse class would erase native movement differences. `engineClasses` provides a coarse renderer adapter; the native C core uses the detailed original classifier and movement tables.

## V1.07 differences from the reference source

* **Signed rounding:** original `0x1d6be` and `0x1d6d8` contain `SAR AX,7`; Y is negated at `0x1d6d2` before multiplication. OpenDUNE uses C division by 128, which truncates negative values toward zero. The patch preserves the arithmetic shifts in original mode. Restoring upstream division changes generated tiles for 49 of the 51 fixture seeds, including most supplied missions.
* **Packed Y distance:** original `0x1d819` shifts Y without a six-bit mask. Upstream unpacks the tile first, masking Y; wrapped negative coordinates can therefore affect the opposite border. Original mode preserves the unmasked shift.
* **Spice border predicate:** `0x7a0c8`/`0x7a0d4` call the X/Y helpers that mask to 0–63; comparisons at `0x7a0e3`/`0x7a0ef` then test against 64. That branch cannot execute. Upstream uses `Tile_IsOutOfMap`, which takes a different branch at the top/bottom edges. Original mode keeps the unreachable predicate behavior.

The combined patch is idempotent, verifies exact source contexts before writing, and leaves upstream behavior selectable through `g_dune2_enhanced`. It operates on a private copied source tree. [`opendune-v107-sar.patch`](opendune-v107-sar.patch) is a smaller standalone displacement/distance diff for inspection; use `patch-native.py` for the complete browser build.

## Genuine remaining uncertainty

The original interpolation can read one row beyond map storage. Original spice edge repair can also read outside the map because its boundary branch is unreachable. The original implementation used an explicit cleared surrounding-memory model: missing interpolation samples are zero and an outside icon-zero neighbor classifies as rock. The authorized runtime experiments below narrow this uncertainty for named cases. They do not establish every original allocator history or every memory read time. The browser C patch remains bounded and avoids C undefined behavior.

All supplied scenarios have Seed/Field/Bloom map entries and no explicit `C...` terrain records or Special entries. Those two code paths are statically implemented, but the 66-file fixture claim covers only paths exercised by the supplied MAP data. The full loader creates units and structures before MAP overrides, and structures modify ground icons and landscape classification; this isolated oracle stubs structure lookup and does not reproduce those object mutations. The full native C browser core retains the complete load ordering. Runtime spice blooms, extraction/depletion and structure terrain updates also use that core. The standalone oracle verifies generator and terrain-only MAP stages, not complete scenario state or all dynamic world updates.

## Authorized bounded original-DOS comparison

After explicit user authorization, DOSBox-X/js-dos `8.5.3` (WASM SHA-256 `513db5dfd99b98c16435d5bd9396d2db72337044ee975038d948839f4d3301e0`) executed disposable in-memory copies with networking disabled. All original host files remained unchanged. [SUMMARY.json](../../../analysis/dune-2/dos-comparison/terrain/SUMMARY.json) retains the exact bounds and references; [dos-runtime-fixtures.json](dos-runtime-fixtures.json) freezes the observed arrays for a fifth regression test.

* **Unmodified whole executable:** seeds 392 (used by SCENA022), 12 (used by SCENO008), and `0xffffffff` were set by changing only four bytes of `INFO.mapSeed` in copies of a genuine original DOS save. Each fresh original startup loaded its primary seed, then another bounded control seed, then its primary seed again. All **nine loads / 36,864 baseline tile IDs** matched the compatible C generator, with zero differences. The alternate seed proves regeneration before the primary reload. These are genuine allocator/startup/INFO-load observations, not complete original SCENA022/SCENO008 object and Field-loading comparisons.
* **Authentic instruction probe:** the verified resident/FBOV x86 bytes were separately run in DOS with an explicit fixed allocation and cleared neighbors. All 4,096 IDs, baseline IDs, four RNG bytes and instrumented RNG call counts matched for all three seeds. Counts were 2,592, 1,254 and 636 respectively. This function probe isolates arithmetic/PRNG behavior; it does not establish original allocation state.
* **Original Field arithmetic:** a second instruction probe applies the exact original Bloom and Field lists from SCENA022 and SCENO008 after generation. Only `Map_Update` view/cache invalidation is stubbed with a far return; original classification, spice changes, edge repair and PRNG remain intact. Both 4,096-icon maps, baseline change flags and RNG states/counts match the terrain-only C/JS projection (2,727 total draws for seed 392; 1,350 for seed 12). This object-free controlled test does not claim whole Scenario_Load ordering equivalence.
* **Memory observations:** actual map pointer was `7932:0004`; 512 bytes immediately following the 16 KiB map were zero after each captured load. A north/wrap and south-neighbor sample of 128 slots classified as 91 rock, 31 wall and six partial rock. These nonzero bytes are **not literally cleared RAM**, but all were non-spice, which is equivalent for the original spice-edge connectivity checks. Scratch byte 272 was not reliably zero; generator output still matched. These captures occurred after load/UI processing and do not prove the memory contents at every generator read time.

No default C engine terrain change was indicated by these bounded tests. Runtime globals did expose a verification-helper mismatch: the built-slab ID is 126, while the standalone JavaScript icon classifier and portable-oracle prefix used 125. Those helpers now use 126, and the icon classifier includes the original wall range 34–107. The default C engine already derived these values correctly from ICON.MAP. Unobserved allocator histories, full Scenario_Load object interactions and all dynamic terrain updates remain distinct from the observations above. Failed exploratory runner attempts and the invalid initial same-seed-repeat attempt are retained in the analysis folder but excluded from the nine successful loads. Only directories ending `-final` and the successful controlled-function execution contribute to the summary.

## Reproduce and resume

```sh
python3 fidelity/terrain/verify-source.py
python3 fidelity/terrain/build-oracle.py
node --test tests/terrain.test.mjs
python3 fidelity/terrain/patch-native.py native/opendune
```

Run from `dune-ii-web`. The oracle builder requires `clang` and the pinned reference checkout at `/private/tmp/dune-fidelity-opendune`. It compiles only the extracted portable C algorithms. [`oracle.c`](oracle.c) remains saved so fixtures can be independently audited or built elsewhere without that temporary checkout. Each fixture hashes little-endian unsigned 16-bit arrays. The retained seed-353 binary contains tile IDs, material classes, baseline IDs, four RNG bytes, then a little-endian 32-bit RNG draw count.

The JavaScript implementation and extracted C reference derive from GPL-2.0 OpenDUNE; the complete license is retained as [`COPYING.OpenDUNE`](COPYING.OpenDUNE), and the checked-out full source is packaged with the browser implementation. The provided game asset files retain their original hashes.

- [x] Original EXE and relevant instruction bytes verified.
- [x] All source tables extracted with original file ranges and hashes.
- [x] Every generator stage and scenario terrain override implemented.
- [x] Cross-language fixtures for 48 mission seeds, three extra seeds, and terrain-only projections of all 66 MAP sections pass.
- [x] Native browser compatibility patch is idempotent and context checked.
- [x] Observe named original allocator/load cases and document actual boundary bytes with their limited scope.
- [x] Compare all 4,096 original baseline IDs for three primary seeds and nine valid loads; retain unobserved cases explicitly.
