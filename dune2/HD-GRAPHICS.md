# Dune II 4× HD graphics

The default HD mode renders a 1280×800 presentation over the native 320×200 input surface. Graphics → Original 1992 returns to the original framebuffer without restarting or changing the simulation. The native scene still chooses every animation frame, turret/facing, coordinate, palette remap, house, clip rectangle, fog state and draw order.

## Artwork and coverage

Generated sand, dune, basalt, spice, concrete and industrial material swatches supply fine relief inside the recovered original shapes. All 389 ICON tiles cover terrain transitions, buildings, walls, damage, rubble and fog overlays. All 244 unit/effect SHP frames and 281 remaining native UI shapes retain global IDs 0–524, original source indices, palette tables and alpha. Shape footprints and native collision/input coordinates stay unchanged. Two indexed Scale2x passes resolve display contours inside each original rectangle; this is not an enlargement of every original pixel into a flat 4× block.

The HD builder uses the original PAKs already embedded in the hashed preload. Original-mode ICON faction remapping includes indices 144–159; sprite house palettes come from the native call. Runtime color changes use shared luminance gain, preserving blue/green faction paint even where red source pixels had zero channels. The new launch illustration is separate from in-game geometry and cinematics.

Built-in imagegen produced the new material source and cover. Inputs, hashes, retained prompt descriptions, deterministic build audit and reproducibility record are in [art/hd-v1](art/hd-v1/README.md). `python3 tools/build-hd-assets.py` rebuilds lossless content-addressed PNG atlases and metadata using Python's standard library. The source download includes those generated source images and the complete patch/build material; original game assets remain external inputs.

HD rebuilding also reads the owned decoded reference bundle: `dist/assets/content.json`
provides atlas placement and the `graphics.images` table, and its 16 original screen
PNGs supply the static-screen inputs. The full repository/runtime already contains
this bundle. The source-only download excludes these original-asset derivatives,
so supply the same reference bundle as well as the original game files before
running the HD builder. Supplying only PAKs does not recreate that additional
bundle automatically. The generated source images are retained byte for byte;
the saved descriptions document the requested art, rather than claiming a verbatim
record of every imagegen tool input.

## Renderer architecture

[Native observer](fidelity/hd/NATIVE-BRIDGE.md) hooks existing draw decisions, preserving cached stationary units across dirty redraws and camera changes. It reads original pools and records no simulation commands or random draws. A bounded UI candidate cache records actual native draw calls; the browser only upgrades candidates that match the current original indexed pixels. Unsupported distortion stays on the native presentation path.

The browser reconstructs original indexed world pixels from terrain/sprite descriptors and compares them with the authoritative framebuffer. Differences are restored after HD drawing, preserving messages, placement/selection markers, the cursor and unpredicted effects. The native clip window prevents art from bleeding over the command panel. Dedicated HD cursor art uses the native position and hotspot. Native timers hide the world upgrade during modals, advisor scenes and incomplete fades.

Texture variants are bounded by both item count and 32 MiB RGBA storage. UI clips use exact native-overlap masks with a 16 MiB/64-entry bound. HD painting is capped near 30 Hz; original simulation/input/timers continue in the native engine. Switching to Original suppresses HD snapshot serialization, while retaining observer caches for a later switch. The original canvas remains the only input target.

## Validation and limits

Independent tests decode the original SHP/ICON banks and compare every source index/mask, every 4× resolved index/alpha pixel, atlas hashes, frame geometry and material-detail coverage. Pixel tests cover palette rounding, full tile faction range, flips, clips, source remaps versus destination shadows, optional zoom, fog, original draw order and immutable inputs. Native cache tests run under ASan and verify stationary persistence, pruning, camera translation, painter order, selection and bounded UI/owner caches.

The 16 static screen resources and native movie frames use bounded contour-aware scaling. The 1049 WSA frames are not expanded into a roughly 2.1 GiB eager HD movie bank, and no newly painted or generatively invented cutscenes are claimed. Worm blur and unusual unpredicted overdraw retain original pixels. Generated detail is an artistic remaster, not evidence that new artwork existed in the original executable. Existing source-derived gameplay fidelity findings and remaining campaign/hardware limits continue to apply.

The browser acceptance record is saved under `fidelity/hd/` after live mission, Original/HD switch, unit movement, scrolling, native menus and save/reload checks. Local tests and preview checks are distinct from the actual container/cluster acceptance performed by CI and the operator.
