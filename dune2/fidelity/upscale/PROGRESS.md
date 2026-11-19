# Original artwork upscaling — 0.5

The user rejected the 0.4 material remaster and requested upscaling.

- [x] Replace active material/scene reconstruction with complete original-frame xBR filtering.
- [x] Remove generated textures and generated cover from public runtime and source download.
- [x] Retain exact native palette conversion, animation/compositing and input coordinates.
- [x] Keep live Original/Upscaled switch and indexed Scale2x fallback.
- [x] Pin MIT upstream shader, retain original/adapted sources and license, bind hashes.
- [x] Browser-check GPU compilation, colour/orientation, title/menu/native save load, selection/movement and mode switching.
- [x] Save original/upscaled screenshots and browser diagnostics; distinguish fallback observation and untested context loss.
- [x] Pass all779 repository tests, including53 Dune tests and5 dedicated upscaling tests.
- [x] Rehash original ZIP and all19 inputs unchanged; do not execute DOS files for this task.

The matching source archive/snapshots are finalized after this record. Release commit, clean-checkout verification and push are recorded outside the archive in `analysis/dune-2/upscale/release.json`, avoiding a self-referential source-package/commit hash. These graphics changes leave native sources, WASM, game rules, music and saved games unchanged. No hosted Site or k3s rollout is included.
