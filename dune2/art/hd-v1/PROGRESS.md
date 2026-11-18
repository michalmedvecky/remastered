# Native HD remaster progress

User request: remaster Dune II graphics to HD. Work takes place in the existing `michalmedvecky/remastered` checkout; original DOS files remain unchanged and are not executed for this work.

- [x] Audit native world rendering, indexed assets, palette/alpha rules and dirty redraws.
- [x] Generate new material atlas and launch illustration with built-in imagegen; preserve source files/prompts in this directory.
- [x] Build all 389 ICONs, 244 unit/effect SHPs and 281 remaining UI SHPs at 4×, preserving source IDs, footprints, masks and faction index planes.
- [x] Add bounded 16 static HQ screen resources; avoid preloading full WSA sheets.
- [x] Verify deterministic asset rebuild and independent original resource/index/alpha correspondence.
- [x] Add read-only native sprite/terrain/framebuffer observer and persistent dirty-command caches.
- [x] Build 95-source native WASM with observer; run ASan cache and original compatibility regressions.
- [x] Add 1280×800 HD compositor, native-pixel mismatch repair, active palette/faction handling, Original/HD switch and new launch art.
- [x] Pass 51 Dune tests including 12 new HD asset/pixel/cache checks.
- [x] Finish performance/cursor fixes and first-mission/toggle/input/fog/modal/save-reload browser QA; retain browser-acceptance.json and screenshots.
- [ ] Finalize matching source/art package, collection snapshot and clean-checkout verification.
- [ ] Commit and push the HD update to the existing remastered repository; no cluster rollout.

The native framebuffer remains authoritative for unsupported distortion and UI overlays. Cinematics retain original animation art with bounded contour-aware 4× presentation, not newly invented movie frames. The new textures are applied inside the recovered original geometry. Raw original-EXE re-analysis and DOS execution are outside this graphics task.

Release validation: all 777 repository tests passed. The final browser sample reported zero HD errors, 1280×800 output and roughly 11 ms/frame on this Mac; this is a first-mission sample, not a universal performance guarantee. The original 19 files and ZIP passed the read-only integrity verifier.
