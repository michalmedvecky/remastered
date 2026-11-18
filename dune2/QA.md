# Release verification — 2026-11-18

## Automated checks

`node --test tests/*.test.mjs`: **21 tests passed**, no failures. Coverage includes all three original campaign paths, 66 scenario/content parity, 19-opcode EMC semantics and source-word decoding, all 4,096 coordinates, recovered speed/RNG fixtures, placement/economy, independent factory queues, attack visibility, combat/objective boundaries, browser save corruption handling and exact 600-tick replay after restore.

`node tools/verify-build.mjs`: all seven modules/imports, 328 referenced assets and static hosting manifest passed. The supplied archive and DUNE2.EXE hashes remain unchanged. Asset import independently verifies all 19 originals and 558 PAK members; 105 PNGs and 223 VOC conversions passed their declared validation.

The normal-input headless trace in `tests/scenario-observations.json` builds a windtrap and refinery, delivers 700 credits and reaches victory at tick 7225. No world-state shortcuts were used. This is execution of the reconstruction, not native DOS evidence.

## Browser playtest

Tested the actual local release UI in the in-app browser:

- Title → Atreides selection → original campaign map → original Cyril briefing → SCENA001.
- Built Windtrap for 300 credits, placed it at (28,25), and observed the 100-power grid.
- Built Refinery for 400 credits and placed it at (29,27). Observed automatic harvester arrival, exploration, return and spice delivery, and treasury restoration to 1,000 credits.
- Saved the live mission into slot 1 at 01:54, reloaded the page, loaded the slot and observed the same structures, harvester, camera/selection and treasury. Invalid-save behavior is covered by automated tests.
- Observed victory at 02:00 with original result text and score 67; Next operation offered original regions 8/15/23 mapped to SCENA002/003/004. Captured the completed battlefield in the ignored local artifact `test-results/browser-game.jpg`.
- Browser console had no errors or warnings during the checked playtest.
- Independently launched a mission through Mission selection, cycled to a Soldier with Tab, issued a targeted Move order on the canvas, observed its acknowledgement, and paused through Space with the on-screen pause state.

The current desktop viewport was inspected. Responsive styles and coordinate conversion are implemented; a separate mobile-device playtest has not been claimed.

## Limits

Tests validate the documented reconstruction contracts. They do not establish complete native-game equivalence. Original native EMC callbacks do not yet drive gameplay; terrain/routing/combat/production policies contain explicit substitutes. Full original cutscenes, sequenced music, special services and DOS save compatibility remain open. No supplied DOS executable, setup program, driver or emulator was run.
