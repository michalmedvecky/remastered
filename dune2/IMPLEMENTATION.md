# Implementation progress

## Delivered modules

- `tools/import-assets.py`: verifies originals and converts source assets/content, including SHP coverage masks, faction colors, WSA frames, indexed text and VOC PCM.
- `dist/engine.mjs`: deterministic serializable simulation and command API; source-backed helpers plus explicit reconstructed mechanics.
- `dist/emc.mjs`: original bounded bytecode VM and native callback interface. Unbound native IDs halt explicitly. Gameplay uses reconstructed native state machines while callback recovery is incomplete.
- `dist/campaign.mjs`: original region/scenario formula, campaign transitions, checkpoints and save envelope helpers.
- `dist/renderer.mjs`: 320×200 tactical view, original sprites/tiles/portraits/UI, original neighbor-mask terrain connections, minimap/fog/selection and placement feedback.
- `dist/main.mjs`: title, House/campaign/mission selection, briefing, player commands, options, saves, Mentat and results.
- `dist/audio.mjs`: original PCM sample playback after user gesture, volume and effect fallbacks. Sequenced music remains open.
- `dist/persistence.mjs`: five local slots and campaign/preferences; validated state before replacement.

## Validation

Node tests cover original content parity, campaign progression through finale state for all three Houses, original EMC instruction decoding and VM semantics, world validation, construction/economy/combat outcomes, fixed-input replay, pause, speed/RNG formulas and exact 600-tick save replay. Build verification checks imports, all referenced assets, hosting manifest and unchanged original archive/executable hashes. Browser QA covers the actual player-facing controls and visual layout; results are recorded separately once complete.

## Remaining fidelity work

1. Port the native terrain generator and compare complete map hashes; remove generated playability patches only when the source-exact map is available.
2. Complete native EMC callback contracts and replace behavior state machines in verified increments.
3. Match routing ties, occupancy, weapons/projectiles/splash, construction billing/duration, original stage unlocks and all special services.
4. Recover every pause/timeout gate, original save field, sprite/animation stage and sound-event priority.
5. Complete original intro, faction finales, credits, animation continuation composition and sequenced music playback.

Keep each implementation substitute documented. A playable campaign, passing reconstruction tests and successful deployment do not by themselves prove native-game fidelity.
