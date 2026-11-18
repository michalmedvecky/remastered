# Dune II research and evidence boundaries

The original collection import was the tested V1.07 reconstruction0.3. Release 0.4 added a read-only presentation observer and generated material artwork. Release 0.5 removes the generated runtime art and upscales the original framebuffer, documented in [HD-GRAPHICS.md](HD-GRAPHICS.md). Its source and native binaries were unchanged by that initial collection migration. Tests, packaging, navigation and deployment paths were adapted for a clean checkout.

## Original identity

* ZIP SHA-256: `f7c9048f1bee49e2d9e3690adaef027e6a2e5bd22f8c18af16408e55a2a2d228`.
* DUNE2.EXE SHA-256: `85f22bb82ea6f755835d5a94d257a67e11a3b854ec934854a69c3eeff7d0180f`.
* The original and all19 extracted inputs were rehashed unchanged after the authorized DOS experiments. [Recorded integrity](fidelity/original-integrity.json) is the historical observation, not a fresh ZIP check on a clone.

REA/Ghidra verified a 16-bit real-mode DOS MZ image with Borland FBOV overlays before interpretation. The saved original image evidence is `ev_69580ae9ecd41e37719ac794780b72a790698fe0d8ecd41158485ef96fe33e71`. Overlay mapping, raw pseudocode and assembly, all discovered-function manifests and unresolved classifications remain in the preserved analysis. The inventory does not prove complete function discovery.

## Runtime comparisons

Experiments used copied files in DOSBox-X8.5.3, isolated memory filesystems, no writable host directory, disabled IPX/NE2000, fixed per-case cycle counts and hard bounds. Observation hooks retained existing emulator instructions and recorded PIC time, OPL port/value, indexed VGA/palette and original clocks. Scene selector changes were limited to copied files with patch ledgers. Original-instruction helper probes list their controlled external services separately from full-game runs.

| Area | Original observation | Retained repository evidence |
|---|---|---|
| Terrain | Seeds392,12,0xffffffff; nine valid full-game loads compare36,864 baseline IDs; two controlled Bloom/Field cases. All tested IDs/RNG agree. | [Original goldens](fidelity/terrain/dos-runtime-fixtures.json), [terrain report](fidelity/terrain/README.md) |
| Combat | Speed460, Fire111, directional movement4608, projectile66, deviation401 and damage208 fixtures: all5854 match after seven original-mode corrections. | [Fixture pack](fidelity/combat/original-runtime-fixtures.json), [current-source regression](fidelity/combat/test-original-runtime.py), [report](COMBAT-FIDELITY.md) |
| Scenes | Full intro and three endings with bounded credits;54 active rows in order. Intro327/336 full indexed identities. Six stable/continuation frames match all64000 pixels. | [Cutscene report](fidelity/CUTSCENES.md), [tables](fidelity/cutscenes/native-tables.json), [WSA regressions](fidelity/wsa/README.md) |
| Music | Logo700, first81s intro3237, finales2325/943/1380, fade60 per house and credits2219/6517/2252 register events agree in the declared ranges. | [Golden ranges](fidelity/music/golden.json), [current-source regression](fidelity/music/test-opl.py), [provenance](native/music/PROVENANCE.md) |
| Saves/browser | Port save loaded/re-saved in DOS; original and DOS re-save loaded by the complete rebuilt engine.47 unit/3 building common records matched. Browser completed intro and loaded DOS re-save into live mission. | [Summary](fidelity/dos-comparison-summary.json), [browser observations](fidelity/dos-browser-acceptance.json) |

Confirmed fixes cover unsigned facing, turning aircraft fire, original structure-range indexing within safe bounds, unsupported weapon return, signed movement rounding, Ordos deviation policy/retained targets, SFX attenuation, INI bounds and absent-first-stream continuation loading. These are tested source changes, not assertions of every battle or presentation path.

## Portable checks versus research reproduction

The checked-in preload contains the original runtime PAKs already needed to play. `tools/preload-data.mjs` and `tools/preload_data.py` read its metadata as data, verify compiled-package and original-file hashes, and parse PAK directories. They do not execute the native JS loader or DOS code. Campaign, EMC, VOC and WSA tests consume those exact bytes without duplicating PAKs in the source tree.

Cutscene table/patch checks use retained original-byte records. Fresh EXE derivation and original-input hash checks require an explicitly supplied original file and remain separate. Compact expected results are sufficient for current-source regressions; they cannot recreate an emulator observation from nothing.

The preserved development workspace contains `analysis/dune-2/` with full static analysis, raw Ghidra/REA evidence and `dos-comparison/` captures/manifests. Paths in historical JSON reports identify that archive and may be absolute or workspace-relative. Those reports are evidence records, not executable paths on a clone. The small `fidelity/browser/_save000.dat` is a generated QA interoperability fixture, not a user playthrough. Large raw captures, original DOS executables, the supplied ZIP, private user saves, credentials and Site configuration are not included in this repository. Re-analysis requires that retained archive and original files.

## Remaining questions

Controlled combat stubs do not establish full live scheduling, explosion damage distribution or every callback branch. Terrain allocator observations cover named seeds/states. Remaining frame samples include randomized reveal, mixed VRAM copies, subtitle/palette updates and finish/credits transitions; stable inspected frames match, while exact intermediate fade/narration wall-time equivalence remains partial. Later intro OPL interleavings, all campaign branches, complete credits cycles, physical AdLib/MT-32 output and all possible save states are unexhausted. OK.VOC is absent; three ADL mappings refer to absent entries. New runtime work must retain fresh copies, bounds and evidence rather than treating historical goldens as universal recovery.
