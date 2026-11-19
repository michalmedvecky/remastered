# Painted Arrakis opening

The browser opening uses a complete new illustration generated with the built-in ImageGen tool from the original planet reference. Both exact prompts, the unmodified first result and the targeted circular-limb correction remain in `raw/`. The first generation was rejected because it clipped the planet with a horizontal edge.

`node tools/build-painted-landing.mjs` copies the accepted opaque PNG without changing its artwork, binds its hash in `dist/painted/landing.json`, and updates the content-addressed CSS image. Original graphics mode continues to use the original scene. No source pixel colours or material noise are reapplied.
