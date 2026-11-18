> Historical first-release JavaScript prototype documentation. The default 0.2 game uses the native C/WASM engine; see [FIDELITY.md](FIDELITY.md).

# Original scripts, campaign routing and browser saves

The game ships FORM/EMC2 programs for units, structures and teams. The browser build includes their original decoded big-endian DATA words and ORDR entry tables under `content.scripts.UNIT`, `BUILD` and `TEAM`. No DOS executable, native sound driver or emulator was run to create these modules.

## Interpreter recovery and interface

`dist/emc.mjs` is a bounded interpreter reconstructed from the original native routine at `23c4:0558`, linear `0x24198`. The previous Ghidra export had followed its CS-local switch into unrelated memory. A new read-only Ghidra pass decoded all 19 main cases and all 18 binary-operation cases at their original CS offsets. The focused assembly and source verification are in `docs/emc-evidence`; all **577 exported instruction records** match the original relocated MZ bytes. `tools/ExportEmc.java` and `tools/verify-emc-source.py` reproduce the evidence. Saved original projects and inputs were not modified.

Core APIs:

```js
const program = content.scripts.UNIT; // { words: uint16[], orders: uint16[] }
const vm = createScript(program, unit.type); // entry is an ORDR index
const result = runScript(vm, program, nativeCallbacks, context, 64);
// result: { executed, halted, yielded, reason }
```

`stepScript` executes one instruction. `decodeProgram` accepts the word object, big-endian DATA bytes, or a FORM/EMC2 file and returns decoded instruction boundaries, native IDs and validation errors. The three supplied EMC files store the whole file extent in their FORM length field; the parser admits that observed Westwood layout as well as the conventional IFF length-minus-eight layout. It rejects out-of-bounds chunks and odd word lengths.

The serialized VM has five signed-word variables, a 15-word descending stack, stack pointer 15 and base pointer 17 at initial entry. Return values and arithmetic truncate to signed 16-bit words. `startScript` resets an existing object's action frame while preserving its variables and stack contents. `interruptScript` saves the current DATA-word IP and return value before entering another ORDR entry; opcode 18 restores both. `validateScript` checks basic snapshot invariants.

| Opcode | Recovered operation |
|---:|---|
| 0 | Absolute DATA-word jump |
| 1 | Set return register to operand |
| 2 | Operand 0 pushes return value; 1 pushes return IP/current BP and establishes a call frame |
| 3, 4 | Push immediate operand; both native cases share the same implementation |
| 5 | Push one of five variables |
| 6 | Push stack slot BP−operand−2 |
| 7 | Push stack slot BP+operand−1 |
| 8 | Operand 0 pops return value; 1 restores call frame/IP, or ends when SP=15 |
| 9 | Pop variable |
| 10 | Pop into stack slot BP−operand−2 |
| 11 | Pop into stack slot BP+operand−1 |
| 12, 13 | Add/subtract low operand byte from SP, with byte wrapping |
| 14 | Call native slot operand&255 and store its return value |
| 15 | Pop condition and jump to operand&0x7fff when zero |
| 16 | Unary logical-not, negation or bitwise-not |
| 17 | Binary operation: logical, comparison, arithmetic, shifts and bitwise |
| 18 | Interrupt return, or end when SP=15 |

Operand decoding prioritizes bit 15 as the compact jump encoding, then bit 14 as a signed inline byte, then bit 13 as a following signed big-endian word; otherwise the operand is zero. Binary operators use the second pop as the left operand. Signed division truncates toward zero; zero divisors and signed overflow stop with an explicit diagnostic. Shift behavior follows the masked 16-bit x86 convention; supplied practical shift counts are the intended compatibility domain, and undocumented old-CPU behavior for oversized counts is not claimed.

Frame-relative script argument 1 is the first argument after a call frame. Native callbacks read their top-of-stack argument with `readArgument(vm, 0)`. A callback receives `(vm, context)` and returns an integer or `{value, delay, halt}`. The delay field is a browser scheduler adapter, not a claim that the native script struct contains that field. The caller owns the countdown.

Missing native callbacks stop with `reason: "unbound-native"` and the slot/PC. There is no implicit fake zero/success. Instruction budgets yield rather than hang. Malformed stack accesses and invalid variables are diagnosed before any host access. The interpreter never uses dynamic evaluation or invokes original native machine code.

### Current gameplay integration boundary

The playable simulation uses explicitly reconstructed object behavior and preserves original script program/entry metadata. It does **not** claim to execute all original native callback contracts. The interpreter and original programs are available and tested, but complete native callbacks remain a fidelity milestone. Routing, combat, terrain and production substitutes are documented separately by the simulation module. This distinction prevents a working script decoder from being mistaken for full original-game behavioral equivalence.

## Campaign progression recovered from code

The browser campaign module uses original REGIONA/H/O.INI groups and their REG entries. Initial campaign stage 0 runs scenario 001. After victory, the original outcome service increments the stage and calls the region selector. At `0x813c0`, the selector returns:

`scenario = (stage−1)×3 + zeroBasedREGIndex + 2`

For stage >7 it uses +1 instead of +2; for stage >8 it subtracts one more. Original stage 9 is intercepted by the finale. REG entries encode region ID, arrow shape and screen X/Y. The native selection finds the **first matching region ID**, so duplicate REG entries only provide multiple arrows for one region. Every GROUP8 repeats the same region; deduplicating by first occurrence selects final scenario 022. All three houses therefore have nine operations along any campaign path: scenario 001, six branching groups of three scenarios, group 7's two scenarios (020/021), then 022. This mapping is recovered from code, not inferred from the arrow value.

`createCampaign`, `nextMissionOptions`, `availableMissions` and immutable `completeMission` expose this flow. Returned choices retain the original region ID, arrow, X/Y and source REG key. Mission completion accepts only a currently offered scenario from the same house; stage 9 marks the campaign finished. The campaign records chosen regions, completed mission IDs, checkpoints and cumulative browser score. Browser checkpoints are additional presentation/persistence behavior, not original DOS save compatibility.

## Browser save envelope

`createSave(world, campaign, ui, description)` captures a browser-native versioned snapshot. `encodeSave` adds a deterministic corruption checksum; `decodeSave` validates the envelope, current content/campaign and caller-supplied world validator before returning it. Unknown versions, mismatched house/tick, malformed data and modified checksums are rejected. Validation does not mutate the active mission. The checksum detects corruption; it is not an authentication mechanism.

This format is deliberately identified as `dune-ii-browser`, version 1. It is not a FORM/SCEN file and does not promise original-save import/export. All deterministic state must remain in the engine's world, including RNG streams, deadlines, fractional movement and script state. UI selection/camera are carried separately. Browser storage or file download can contain the same envelope.

`dist/persistence.mjs` connects these envelopes to five browser-local slots. The app calls `configurePersistence(content, Engine.validateSave)` after importing content, so writes and reads use the same real catalog/world validation as explicit loads. Slot UI requires unique existing object IDs, integer camera coordinates within the 15×10-tile viewport bounds (X 0–49, Y 0–54), and a boolean standalone flag. Standalone missions may be saved independently of the current campaign stage. Active campaign saves must match a currently offered mission.

Slot and campaign envelopes require their version and corruption checksum. Unchecked early preview records are rejected. Saves are copied and checked before storage changes, and rejected loads do not modify the active world. Browser storage failures produce recoverable feedback. Preferences accept only typed booleans, volume 0–1 and integer speed 0–4; malformed values fall back to defaults.

## Verification

```sh
node --test tests/emc.test.mjs tests/campaign.test.mjs tests/persistence.test.mjs
python3 tools/verify-emc-source.py
```

The tests exercise every main opcode, binary/unary operators, call/local/argument frames, signed wrapping, native delay/return, explicit missing callbacks, interrupt return, instruction budgets, malformed stacks, and decode every supplied instruction/entry/branch. Campaign tests walk all three house campaigns through their nine operations, check original region coordinates and choices, reject invalid advancement and verify save/checkpoint round trips. These are reconstruction tests; they are not original-game execution traces.

Persistence tests use the real engine and imported content to verify the next 600 ticks after a mid-movement save/reload. They also test slot limits, checksum/schema/world/campaign/UI corruption, caller-copy isolation, standalone saves, preference bounds, and unavailable/full storage.
