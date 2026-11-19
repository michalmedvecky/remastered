# Object portrait motion evidence

All36 portrait WSA resources were statically decoded and reviewed:161 displayed records,107 distinct indexed pictures,14 animated resources and22 one-frame pictures. Each WSA also stores a loop delta; these36 loop records return to frame0 and are tracked separately rather than counted as extra display phases.

Factory/CHOAM previews use only frame0, immediately unloading the WSA after displaying it (GUI_FactoryWindow_Init and GUI_FactoryWindow_DrawDetails). Mentat information uses the same native preview rectangle `(128,48,184,112)` from widget8 and advances frames every7 native60Hz ticks (~116.7ms), including authored duplicate-frame holds. HD playback should identify the native displayed image instead of advancing its own independent clock.

Thirty exact local palette-index witnesses distinguish all107 distinct images. `frame-witnesses.json` contains every original frame SHA256, signature and equivalent-frame aliases. `witness.mjs` requires exact unoccluded values; mismatches return unknown and multiple distinct matching pictures return ambiguous. The construction-yard checkbox and Mentat labels/shoulder/cursor can cover samples; only actual observed UI ink should exclude those samples. Full-frame index hashes remain available for confirmation when the crop is unoccluded.

| Resource | Frames / distinct | Changed union | Observed motion |
|---|---:|---:|---|
| BARRAC.WSA | 3 / 3 | 44/20608 | Only the small foreground rooftop HVAC fan changes. The large troop formation and architecture are static. |
| CARRYALL.WSA | 2 / 2 | 10/20608 | The red ground marshal at lower right changes arm pose. The aircraft and gantries remain static. |
| GOLD-BB.WSA | 16 / 6 | 78/20608 | A white vent/steam plume projects from the lower-right side of the missile, grows and disperses. The missile and dish are static. |
| HARVEST.WSA | 13 / 7 | 261/20608 | Small dust/spice puffs appear at the two lower tread-contact areas. The main vehicle silhouette stays fixed. |
| HEADQRTS.WSA | 10 / 3 | 325/20608 | The single white dish on the far-right roof rotates between oblique and face-on poses. The left roof array stays fixed. |
| HITCFTRY.WSA | 2 / 2 | 2/20608 | Only two pixels in the small central status indicator change. No factory/aircraft motion is present. |
| HVYFTRY.WSA | 7 / 4 | 170/20608 | Two orange/yellow factory-bay glow/flame regions flicker; the large tank bodies and factory structure are fixed. |
| LITEFTRY.WSA | 14 / 9 | 126/20608 | Small left/right workshop welding or exhaust flashes change, plus a tiny suspended-crane/pulley detail. Vehicle and building silhouettes stay fixed. |
| PALACE.WSA | 17 / 11 | 75/20608 | Tiny guards/people change pose at the entrance/right foreground; a small lower-left status panel also changes. The palace, door and dome remain fixed. |
| REFINERY.WSA | 6 / 4 | 28/20608 | Two ground-level horizontal yellow/gray marker or status strips pulse. The tanks, pipes and machinery remain fixed. |
| STARPORT.WSA | 25 / 16 | 740/20608 | After ten unchanged frames, a low transport with red roof lights enters from the right and travels left through a five-pixel-high strip. All tall towers/antennas are static. |
| STORAGE.WSA | 4 / 4 | 27/20608 | A small top beacon changes, while tiny highlights advance along the diagonal lower loading/ramp strip. The tanks and main loading platform are static. |
| WINDTRAP.WSA | 12 / 6 | 2149/20608 | The two large intake faces cycle through dark/blue flow bands; small fan details also change. Architecture and dunes remain fixed. |
| WOR.WSA | 8 / 8 | 82/20608 | A thin row of small light figures along the front base of the wall changes position/pose; the fortress itself stays fixed. |

The recommended animation uses each newly painted whole base as a static clean plate, plus newly painted semantic parts or poses. `inventory.json.semanticParts` records native change bounds, per-part phase sequences, observed distinct pose counts and proposed art. A transport can use one new complete RGBA vehicle translated to the native positions; small guards need complete coherent poses and clean background beneath them. Rotors/dishes need discrete new pose art. Lamps, intake flow bands and welding/plume light need new smooth masks and authored phase envelopes. No recommendation copies old RGB, applies native pixel texture to a new painting, or upscales an old whole scene.

Static scene area is large: even the windtrap leaves89.6% of pixels unchanged, while most other animated previews change far less. Do not animate whole vehicles/buildings or add camera movement merely because a WSA has multiple frames. BARRAC changes only its HVAC fan, not the troop formation; STARPORT changes its tiny ground transport, not the towers.

Unresolved semantic details are explicit: the tiny LITEFTRY pulley/tool accent, exact fiction of REFINERY marker strips, and STORAGE diagonal highlights. Their precise indexed phases and bounds are established even when the tiny depicted mechanism cannot be named confidently. Windtrap small fan details should be checked against new art before claiming mechanically exact rotor motion.

Files: `inventory.json`, `semantics.json`, `frame-witnesses.json`, `native/<stem>/frame-NNN.idx/png`, native contact sheets in `review/`, reproducible `build-motion.py`, exact matcher `witness.mjs`, and `test-witness.mjs`. The test verifies all36/161 frame hashes and matches, corruption rejection and explicit occlusion ambiguity. No original DOS executable was run and no new art was generated by this analysis.
