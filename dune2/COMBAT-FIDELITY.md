# Native combat and EMC callback fidelity

The browser migration uses the complete C simulation and native EMC callbacks from [OpenDUNE commit ebea79a](https://github.com/OpenDUNE/OpenDUNE/tree/ebea79aeba025be2fe9004570e9255044aacc0be), with reviewed compatibility changes for the supplied Dune II V1.07 executable. OpenDUNE is GPL licensed; its source, COPYING and attribution must accompany the browser build. Reusing its code closes implementation coverage, but does not itself establish binary equivalence.

The previous JavaScript reconstruction used Euclidean ranges, simplified homing projectiles, direct attack policies and replacement object state machines. Adding a damage formula to that simulation would leave movement, projectile scheduling, target selection, scripts and retaliation inconsistent. The native integration replaces that connected behavior as a unit. This document describes static evidence, the compatibility layer and authorized bounded DOSBox comparisons; browser integration and media playback results are recorded separately.

## Callback inventory and contracts

[callback-ledger.json](fidelity/combat/callback-ledger.json) records all **104 initialized table slots**: 64 UNIT, 25 BUILD and 15 TEAM. All original far-pointer bytes and their MZ segment relocations were checked against the supplied EXE. **79 slots are used by the supplied EMC programs, mapping to 76 distinct original function addresses.** Every used slot has saved raw pseudocode and assembly. The tables map to 86 distinct C implementations, including shared general helpers and no-op entries. There are no missing C callback implementations within these initialized tables.

The ledger includes each slot's original address, file offset, raw pointer bytes, script occurrence count, decompilation and assembly hashes, source symbol, source line range and body hash. Each source contract preserves upstream documentation, stack argument positions, script variable accesses and direct helper calls. [callback-ledger.tsv](fidelity/combat/callback-ledger.tsv) provides a compact index. These contracts come from the pinned reconstructed source; table-order correspondence and original-offset function names identify the mapping, while selected assembly checks establish specific behavior.

Examples:

| EMC slot | Original address | Native C callback | Contract |
|---|---|---|---|
| BUILD 0 / UNIT 16 / TEAM 0 | `0x1cf30` | `Script_General_Delay` | Signed stack word divided by 5; stores script delay and returns it. |
| UNIT 8 | `0x26b37` | `Script_Unit_Fire` | Uses current target, orientation, range, cooldown, weapon and unit state; returns success. |
| UNIT 12 | See ledger | `Script_Unit_CalculateRoute` | Executes original route policy and route buffer behavior rather than JavaScript A*. |
| UNIT 42 | See ledger | `Script_Unit_Harvest` | Harvesting logic consumes landscape and updates cargo/state through original native contracts. |
| BUILD 11 | `0x189ce` | `Script_Structure_Fire` | Selects turret shell or missile and returns speed-adjusted delay. |
| BUILD 21 | `0x18b5f` | `Script_Structure_RefineSpice` | Cargo unloading, House credits, harvested statistics, transport flag and six-cycle delay. |

The VM must run these callbacks with the native current-object globals, native object pool and script state. An isolated JavaScript callback registry would not provide those contracts. OpenDUNE's `src/script/script.c` already provides the VM and all three native dispatch tables.

## Combat observations and reconstructed source behavior

The supplied [distance routine at 0x1d56d](../analysis/dune-2/game-final/assembly/0x1d56d.asm) computes `max(abs(dx),abs(dy)) + floor(min(abs(dx),abs(dy))/2)`. Positions use 256 subcoordinates per tile. Range and orientation calculations use integer operations and byte angles; replacing them with floating point Euclidean distance changes both firing and movement decisions.

The [Fire callback at 0x26b37](../analysis/dune-2/game-final/assembly/0x26b37.asm) checks target validity, same-tile targeting, rotation, cooldown, weapon range and facing before creating a projectile. Its facing threshold is less than 8 angle units. Winged units and targets have special facing handling. Double fire depends on the unit definition flag and current HP exceeding half nominal HP. Trooper weapons change to mini-rockets beyond distance 512. The source implementation also handles worm swallowing, deviation reduction and weapon sound through the complete native state.

Native projectiles are units in the object pool. `Unit_CreateBullet` (`0x2a85d`, source `src/unit.c`) captures a destination, selects orientation, handles inaccurate missile offsets and sets damage/lifetime. Shells and sonic waves start at an offset from the firing unit. `Unit_Move` advances collision and impact behavior alongside ordinary movement; sonic waves damage objects along their path and decay. The complete source contains Death Hand spread, wall impacts, projectile-specific explosions and other special behavior. These source paths are implemented by reuse. The bounded runtime matrix below independently compares projectile dispatch and selected sonic, deviation, Death Hand and damage branches; untested branches remain explicit.

The [explosion routine at 0x15008](../analysis/dune-2/game-final/assembly/0x15008.asm) and corresponding `Map_MakeExplosion` use integer distance shifted right by 4. Ordinary reaction radius is 16 in those units, Death Hand radius is 32, and unit damage falls off as `hitpoints >> (distance >> 2)`. Frigates are excluded; sandworms ignore the swallow explosion. Structures on the impact tile receive structure damage. Walls use a destruction test based on wall HP and an inclusive random comparison. The same routine includes AI retaliation, team and harvester reactions. Explosion graphics are then scheduled separately.

The [damage routine at 0x28ed0](../analysis/dune-2/game-final/assembly/0x28ed0.asm) corroborates unit eligibility checks, saturating HP reduction, death actions, harvester spill, group-to-individual infantry conversion below half HP, worm retreat/death behavior and damaged movement states. The complete C source also maintains score, pools, sound and scripts. Damage resistance comes from the observed unit/special-weapon rules and flags; this report does not posit an extra armor matrix absent from those paths.

## Constant-table comparison

[unit-table-comparison.json](fidelity/combat/unit-table-comparison.json) compares compiled upstream initializer values with the original EXE's 27 records at file offset `0x2fcb0`, stride 90. **1,044 of 1,053 numeric cells match exactly**, covering HP, costs, build times, range, damage, firing delay, movement, sprites, projectile types and other fields. The nine differences are invalid AI action sentinels: original `0xffff`, source `0xff`, for projectile/special unit types. Runtime `actionID` is a byte, so this is a representational difference on that assignment, not evidence of a different valid action.

All 13 named combat flags have unique matching original bit patterns across the 27 records, including `firesTwice=0x400`, `sonicProtection=0x8`, `notAccurate=0x4000` and `isNormalUnit=0x8000`. This checks values individually rather than assuming C struct ABI matches 16-bit DOS layout. It does not compare unused padding, unnamed flags or mutable runtime values.

## Verified V1.07 compatibility changes

[compatibility-findings.json](fidelity/combat/compatibility-findings.json) records observation, upstream difference, patch, evidence path and hash for every change. [patch-native.py](fidelity/combat/patch-native.py) applies reviewed contexts to a supplied source root, rejects unexpected contexts before writing and is idempotent. It preserves upstream enhanced behavior and enables these original behaviors when **`g_dune2_enhanced=false`**:

1. `0x15d2f` uses signed 16-bit arithmetic, rounded arithmetic-half steps and clamping. At extreme settings it applies the rounded step twice. For `(normal=30,min=15,max=60,inverse=true,speed=4)`, original returns 16; upstream returns 15.
2. Unit and turret Fire callers pass an upper delay bound of **255**, not upstream's 65535. Unit Fire's random jitter also wraps as a byte; 255 plus 1 becomes zero. OpenDUNE widened the runtime field, so an explicit original-mode byte cast is required.
3. Refinery unloading calls the normalized ratio helper `0x786e5` then the rounded multiply helper `0x786b9`. A refinery at 225/450 HP unloads two cargo units per cycle, whereas upstream's floor expression unloads one.
4. The original enemy-harvest statistic branch accidentally copies the clamped allied statistic into the enemy statistic. Original mode preserves this observed scoring bug; enhanced mode retains the fix.
5. Script Delay uses signed `IDIV` by five, preserving negative word operands as well as normal positive delays.
6. Fire facing compares unsigned byte angles, preserving original behavior at the 127/128 and 255/0 boundaries.
7. A winged unit without a turret may fire while turning, matching the original rotation guard.
8. Structure range uses the firing object type for footprint lookup, preserving an original indexing bug for supported unit types; unsupported IDs retain a safe bounded lookup.
9. Unsupported weapon dispatch returns failure before consuming cooldown.
10. Directional movement adds 64 and arithmetic-shifts signed products by seven, including negative X and negated Y. Native sign-dependent division differed by one subcoordinate at rounding boundaries.
11. Deviation acquisition normalizes controller/default-action policy to Ordos in original mode, consistent with original effective-house behavior.
12. Deviation acquisition and expiry preserve existing foreign attack/move targets. The original expiry calls zero-index setters which reject zero; enhanced mode retains explicit target clearing.

The arithmetic helpers in [dune107.h](fidelity/combat/dune107.h) avoid host-dependent signed shifts/conversions. [test-results.json](fidelity/combat/test-results.json) records 280,126 speed, 50,108 ratio and 50,108 rounded-scale comparisons against separate instruction-semantics transcriptions. The patch was applied twice with identical resulting hashes and all seven affected translation units passed Clang syntax checks. These arithmetic checks execute newly compiled reconstruction code; the separate observations below executed original DOS machine code.

## Authorized bounded DOSBox comparisons

The user subsequently authorized bounded emulator experiments. [The combat experiment report](../analysis/dune-2/dos-comparison/combat/REPORT.md) and [comparison-summary.json](../analysis/dune-2/dos-comparison/combat/comparison-summary.json) retain **5,854 original-machine-code fixtures with zero final differences** against actual patched native function bodies:

| Original behavior | Cases | Scope |
|---|---:|---|
| Speed helper `0x15d2f` | 460 | Five speeds, both inverse modes, odd delays and signed word edges |
| Fire callback `0x26b37` | 111 | Facing/turning, half-HP double fire, trooper 511/512/513, cooldown/RNG, structure range and projectile requests |
| Directional motion `0x1d747` | 4,608 | All 256 directions, eighteen distances including rounding boundaries and cap |
| Projectile movement `0x28364` | 66 | All seven projectile types, sonic decay/protection/wall RNG, Death Hand seventeen impacts, deviation radius and collision/arrival dispatch |
| Deviation `0x29bb8`, `0x29c9e`, `0x2b982` | 401 | House/player/controller policy, probabilities/seeds, expiry and retained target fields |
| Damage `0x28ed0` | 208 | All 27 unit types, saturation/death, group conversion/retreat RNG, smoking/timer, damage during deviation and requested spill/sound effects |

Before fixes, Fire had 21 mismatched fixtures, directional motion 203 and deviation 269. The retained before/after results identify seven additional differences, reflected in items 6–12 above. Damage needed no additional patch within the tested ordinary game-value range.

Each experiment ran in a fresh DOSBox-X/WASM memory filesystem with all nineteen original-member hashes checked, networking disabled, muted output and a 25-second watchdog. The original host files and ZIP remain unchanged. These probes call selected original functions in the verified fixed analysis image; they do not start the full game entry point or reproduce live allocator history. Original geometry, RNG and function bodies under comparison execute unchanged.

Each manifest declares peripheral replacements: controlled pool lookup/allocation; graphics/speech suppression; captured action/removal requests; and captured explosion/deviation/damage requests where appropriate. Projectile damage is a service boundary in its experiment; the separate damage experiment executes actual original `Unit_Damage` and deviation-expiry helpers. Area damage distribution through `Map_MakeExplosion`, complete projectile creation/inaccuracy, full object iteration, retaliation and live combat scheduling are not proven by these fixtures. Original `Map_DeviateArea` has no house argument; its shared effect/position/radius values are compared and the independent deviation fixtures establish Ordos controller policy.

[original-runtime-fixtures.json](fidelity/combat/original-runtime-fixtures.json) ships compact original inputs and observed outputs. [test-original-runtime.py](fidelity/combat/test-original-runtime.py) extracts the actual current patched C bodies and step tables, compiles them with declared controlled-service adapters, and checks every retained original result. [original-runtime-regression-results.json](fidelity/combat/original-runtime-regression-results.json) records the 5,854 passing regressions and current body hashes. Running this regression needs no emulator and executes no original machine code.

## Reproduction and remaining limits

From the web project directory, using the pinned source tree:

```sh
python3 fidelity/combat/audit-callbacks.py /path/to/opendune
python3 fidelity/combat/audit-unit-tables.py /path/to/opendune
python3 fidelity/combat/test-compatibility.py /path/to/opendune
python3 fidelity/combat/test-original-runtime.py /path/to/opendune
python3 fidelity/combat/patch-native.py native/opendune > native/compatibility-patch.json
```

The audit reads `../analysis/dune-2/inputs/DUNE2.EXE` and verifies its original SHA-256. Saved provider identity is REA/Ghidra 12.1.4, x86 16-bit real mode, load segment `0x1000`; the original load-image evidence is `ev_69580ae9ecd41e37719ac794780b72a790698fe0d8ecd41158485ef96fe33e71` in [dune2.rea.json](../analysis/dune-2/evidence/dune2.rea.json). Function-specific raw exports and hashes are retained in the ledger. No new shared REA session was opened by the source/table audits. Those initial audits did not run original code; the later authorized DOSBox comparisons above did.

The initialized dispatch tables do not prove discovery of every possible native function or overlay entry. Source coverage is complete for the 104 mapped table entries; binary equivalence remains partial. Undiscovered code, source changes outside these selected differences, original hardware timing and device behavior require further evidence. Native browser integration must additionally verify original-mode configuration, scheduling, sound hooks, input routing and game-state persistence. The authorized bounded experiments close the listed helper comparisons; further coverage must identify a specific uncertainty, preserve disposable-copy isolation and remain within the approved experiment scope.
