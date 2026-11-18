> Historical first-release JavaScript prototype documentation. The default 0.2 game uses the native C/WASM engine; see [FIDELITY.md](FIDELITY.md).

# Deterministic simulation core

`dist/engine.mjs` is a browser-independent simulation. It imports no packages, uses no wall clock and writes no external state. `createGame(content,{house,scenarioId,speed})` reads the imported original INI sections and catalog. `tickGame(state,content,count)` advances nominal 60 Hz logical ticks. The resulting world is plain JSON. `commandGame` is the only player order/production API; it reports `{ok,message}`.

The supplied 66 original scenarios load their house balances, quotas, unit/structure placements, HP scales, headings, initial order modes, teams and reinforcements. Concrete GEN placements become map-layer concrete, while walls and buildings remain entities. Original IDs, HP, cost, type dimensions, house masks, raw build values and available catalog fields come from `assets/content.json`.

## Verified contracts used directly

- Tile ID `x | y<<6`, 64×64 cells, positions in 256 subunits/tile, tile centers at 128.
- Original five-setting integer speed helper, including arithmetic shifts, normal-setting clamp bypass, odd rounding and inverse mode. Unit service base four ticks and structure service base 30 ticks use that helper independently.
- Original CRT LCG multiplier/addend/high-15-bit return, and the separate rotate-through-carry byte PRNG translated from instruction bytes at 0x39b86. Saved RNG streams are independent of host time.
- Movement-rate decomposition and fractional carry gate from 0x2a3ab/0x2a493. Every unit stores `moveRemainder`, `moveFraction` and `moveInteger`; rate initialization applies the type speed, a requested 255/256 factor and cargo adjustment. The original terrain/requested-rate caller contracts are not fully recovered.
- Harvest cap 100, two independent byte draws (gain `&1`, depletion `&31`), refinery HP ratio/rounded scale-three transfer, nonzero minimum one, player seven-credit yield and other-owner six-to-nine. Native callback invocation cadence is approximated by six-tick deadlines.
- Rounded HP initialization and below-half Infantry→Soldier/Troopers→Trooper replacement.
- End-trigger versus winning-side masks, different wall/turret exclusions, 7,200-tick grace, strict poll deadline and 300-tick polling. Quota reads animated displayed credits, including the 0xffff sentinel. Timeout retains the observed before-deadline predicate but uses a provisional scenario-minute deadline because its original writer remains unresolved.

## Explicit reconstructions and limits

This is a playable reconstruction, not a bit-exact port. The state declares `fidelity` with reconstructed terrain, deterministic A* routing, reconstructed combat and native behavior state machines.

Terrain uses seeded coarse noise and spice patches, not the complete native generator. Original scenario fields/placements are applied; building footprints and adjacent yard rock are cleared to keep all scenarios buildable. A nearby spice deposit is supplied only if the provisional generator leaves a base without one. It must be replaced with source-exact generation before map hashes/original sparse saves can be claimed compatible.

Navigation is stable A* with N/E/S/W before diagonals, octile costs, no corner cutting, impassable structures, foot access to mountain terrain, and a maximum 14-step retained route. It recomputes when a route is exhausted or blocked. Unit occupancy is permissive during movement to avoid unmodeled original avoidance deadlocks; structures require units to leave the placement footprint. All routing tie-breaks and terrain costs are implementation choices.

Combat uses imported damage/range candidates with bounded long-range interpretation and reconstructed targeting, cooldowns and homing projectiles. Enemy Guard/Ambush/Hunt modes, periodic production, turret firing and reinforcement arrival create playable opposition. Full armor, splash, special weapons, alliances, fog occlusion and target priority are not reproduced. Fremen/Atreides alliance and neutral sandworm hostility are represented; objective structure counting deliberately follows exact house equality rather than alliance.

Production duration currently converts raw build time to `raw*8` ticks, charged up front, then progresses on the recovered structure speed interval. Low power halves progress. These duration, billing, prerequisite/stage and refund policies are provisional. Original house masks, footprints, power and storage data are retained. Refinery placement delivers a harvester. Advanced catalog items and all scenario loading are supported, but original unlock/prerequisite logic and special production services are incomplete.

The original EMC bytecode is retained by the asset importer. Entity/team records contain script metadata with `mode:'native-reconstruction'`; this engine does not silently invoke unimplemented native callbacks or claim complete EMC behavior. The separate `emc.mjs` VM is independently testable and halts on unbound native calls. Replace reconstructed native behavior only as each callback contract is recovered and tested.

## State and UI API

- `map`: ordinary arrays `terrain`, `spice`, `seen`, `visible`, `concrete`, `blooms`, each 4,096 cells. Terrain classes in this reconstruction: 0 sand, 1 dune, 2 rock, 3 mountain, 8 spice, 9 thick spice, 10 concrete.
- `entities`: stable `id`, `kind`, original numeric `type`, `house`, fixed-point `x,y`, anchor footprint `w,h`, `hp,maxHp`, `cargo`, heading byte, route, order, action/fire deadlines and script metadata. Dead records remain with HP zero so references can be handled deterministically.
- `production`: `{id,house,kind,type,producer,total,remaining,ready,cost}`. A completed structure waits for a `place` command; completed units arrive at their producer.
- `houses`: original balances/quotas/unit limits, animated credits and recalculated power/storage. `events` is an 80-item typed queue; empty-message fire events are intended for audio/effects rather than text announcements.
- `outcome` is null, `victory` or `defeat`; `result` records score, ticks, credits, delivered resources, kills and losses. `cameraStart` is a tile-coordinate object.
- `getBuildOptions(state,content,kind)` returns `{kind,type,name,cost,hp,enabled,reason,producer,total}`. `producer` selects a currently free compatible factory, using original imported producer lists where present. Multiple factories may produce independently. `canBuild` and `canPlace` return `{ok,message}` without mutating. `entityAt`, `entityTile`, `getDefinition` and `snapshotGame` support presentation/persistence. Explicit attack targets must be currently visible.

Commands: unit `move`, `attack`, `harvest`, `return`, `stop`, `guard`, `deploy`; production `build`, `place`, `cancelBuild`; structure `repair`, `sell`; `setSpeed` and `pause`. IDs are validated against live player units. Invalid targets, unavailable technology, missing prerequisites, insufficient credits and invalid placements return a useful reason without charging or altering the order.

`validateSave` accepts the world itself or `{state:world}`. It checks the scenario, enum/numeric domains, array budgets, map widths, catalog references, IDs, cargo, pool ranges, production references and RNG state before a UI restores the world. Browser-native snapshots are not original FORM/SCEN files.

## Validation

Run `node tests/engine.test.mjs` from this directory after importing assets. Tests cover all 66 scenario initial/advanced states; all 4,096 tile round trips; speed fixtures and clamp bypass; an independent BigInt LCG oracle; placement prerequisites and economy; actual automatic harvest/return/unload; exact 600-tick JSON save replay; pause clocks; quota animation/grace/sentinel; victory/defeat; wall/turret end conditions; infantry transformation; fixed-input replay under different host chunk sizes; and malformed saves.

These tests establish the declared reconstruction contracts and determinism. They do not establish equivalence to native DOS execution. No supplied DOS executable or emulator was run to implement or test this module.

`node tests/integration.test.mjs` additionally verifies renderer crop/coordinate contracts, current-fog pointer hit testing, actual persistence-adapter replay with a nonzero movement accumulator, campaign advancement and a normal-input first-mission resource cycle. It writes `tests/scenario-observations.json` with the exact build/place tape and state summaries. In this reconstruction at normal speed, SCENA001 builds a windtrap at tick 390 and refinery at tick 1050, receives its first resource delivery at tick 3512, and satisfies the 1,000-credit quota at assessment tick 7225 after delivering 700 credits. The idle scenario also wins because its original starting credit balance already equals the quota; the delayed predicate tests the balance, not cumulative resource revenue. These are observations of this browser reconstruction, not native-game measurements.
