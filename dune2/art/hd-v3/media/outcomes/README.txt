Ordinary mission outcome preview completion

Four previously omitted GUI_Mentat pictures are now complete new whole-scene paintings: WIN1.WSA, WIN2.WSA, LOSTBILD.WSA and LOSTVEHC.WSA. Each source resource is184x112 and contains exactly one display phase plus a duplicate loop record. These four records are held static; no animation is invented.

All66 original scenario BASIC sections were audited against native BriefPicture/WinPicture/LosePicture defaults. WIN1 is selected by27 wins, WIN2 by39 wins, LOSTBILD by36 losses, and LOSTVEHC by30 losses. The three MENTATx.ENG help files were checked through their NAME offsets and native digraph string decoding:40 distinct help previews are covered. Unit/structure portraits, homeworld pictures, and scenario outcomes form46 ordinary resources,268 actual native phase records,214 distinct indexed images. There are no missing ordinary picture references. Full-screen intro/finale cinematics and the64x64 STATIC noise resource retain separate ownership.

Source indices select exact resource/phase identity using33 immutable native witness coordinates; the previous42-resource bank's264 records and ten atlas files are unchanged. Displayed RGB is exclusively newly painted art. No original palette pixels are enlarged or reimposed in the new images. Native outcome composition, soldier armor colors, silhouettes, action and scene context guided the painting; fine illustrative details are interpreted rather than claimed to be literal recovered pixels.

Built-in image_gen.imagegen produced the four-scene2x2 raw,1608x978. The raw PNG is retained unchanged as outcomes.png with exact prompt, source/style reference hashes, and generation provenance beside it. The deterministic builder excludes the generated one-pixel dividers and packs four736x448 whole scenes into a1472x896 additive atlas. Repeated builds produce the same media manifest SHA256:52d4906c1b8d64d123e70d59eca98403235900502e62e1f05c725daaf5d1d634.

Rebuild source evidence:
  python3 tools/build-painted-outcome-media-motion.py
Rebuild production artwork:
  node tools/build-painted-media.mjs
Focused verification:
  node --test tests/painted-media.test.mjs tests/painted-extra-media.test.mjs tests/painted-media-assets.test.mjs tests/painted-outcome-media.test.mjs
  Result:17 pass,0 fail.

Browser review generators (inert temporary HTML; no server or original execution):
  python3 fidelity/painted-polish/media-canvas-review.py --output dist/media-outcomes-qa.html
  Covers268 phases,46 factory bases,107 independent baked forward comparisons and107 reverse comparisons; retains explicit original36/extra6/previous42 subsets.
  python3 fidelity/painted-polish/outcome-advisor-canvas-review.py --output dist/outcome-advisor-qa.html
  Covers4 outcomes x3 advisors, native actor and Proceed/Repeat source controls. Uses production createPaintedUI, checks whole painted hair/body/wall, exact matched outcome, bounded text, both buttons, and independently compares all unobstructed144x112 preview pixels to new art.

Parent private-browser review reported12/12 full UI cases passing and268 native phases passing with0 missing assets and0 errors. The representative WIN1 whole scene was reported coherent. The full UI fixture now includes a selector with Atreides WIN1 shown full-width by default while retaining all12 checks. Screenshot/browser result artifacts are owned by the parent review. Original DOS binaries were not executed. All reference decoding was bounded and hash-bound against retained original archive/preload records.
