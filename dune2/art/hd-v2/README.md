# Approved painted world artwork

This is the production art used by Dune II release 0.6. All known world resources have explicit bindings: 244 sprite/effect slots, 254 building-owned ICONs and 135 terrain-owned ICONs. The gameplay engine chooses positions, facings, states, draw order and animation timing.

- [Buildings](buildings/README.md): whole structures, state variants and wall connections.
- [Units](units/README.md): independently articulated hulls/turrets, people, aircraft, wrecks and effects.
- [Terrain](terrain/README.md): ten world-coordinate surfaces, native transitions, fog and derived overlays.
- [Gallery](review/GALLERY.md): inspect all production bindings at `/dune2/artwork.html`.
- [Progress](PROGRESS.md) and [integration report](../../HD-GRAPHICS.md).

Artwork was generated and edited with the built-in ImageGen tool. Each bank retains its exact prompt set, original references, unmodified raw generations, selected corrections, packing records and hashes. All consumed images live in this repository. `npm run build:art` deterministically rebuilds the runtime banks without another model call. The corresponding-source archive includes this entire directory and its decoded original reference images; original game archives are excluded.
