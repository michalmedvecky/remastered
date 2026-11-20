# Preserve the painted world during mission result dialogs

The live Czech first mission exposed the native sequence: the quota reaches1000,
then the success modal appears over the map. The native engine still uses
`GM_NORMAL`. `GameLoop_LevelEnd` changes the selection to
`SELECTIONTYPE_MENTAT` before showing either success or failure text; the actual
advisor screen appears only after the modal closes. The previous observer
rejected every Mentat selection and hid its valid committed world too early.

`DuneHD_WorldModal` now marks only that native LevelEnd sequence, beginning just
before the selection change and ending immediately after each modal, before
`GUI_Mentat_ShowWin` or `GUI_Mentat_ShowLose`. The observer may retain the existing
world during this scope. It still requires `GM_NORMAL`, a valid committed front
snapshot, a zero credits-scroll offset and no explicit Mentat replacement. It
does not capture a new world, read the live map, request a draw, advance a timer
or alter a game rule. Reset clears the scope. All calls are browser-only
observation hooks; the original statements and control flow are preserved.

`tools/patch-native-hd.py` applies the source hooks idempotently on retained or
clean native sources. The bridge/header and retained `src/opendune.c` are the
only implementation changes.

Run `node --test tests/native-world-modal.test.mjs tests/native-hd.test.mjs`.
The new ASan fixture extracts and runs the actual retained
`GameLoop_LevelEnd` control flow with bounded rendering stubs. Both outcomes
must preserve exactly the same committed tiles/commands while the timer is
paused, then hide that world before the advisor/stats/map. Missing snapshots,
menu/restart modes, credits offsets, explicit Mentat replacement and reset are
negative cases. `world-modal-results.json` records source hashes and the
bounded coverage. Existing observer and stable-text ASan regressions also pass.
No original DOS executable is run. Separate live browser comparison after the
native rebuild establishes the visible result.

For a bounded visible browser experiment, `modal-browser-harness.py` prepares
temporary copies `dist/modal-qa.html` and `dist/modal-qa-host.mjs`. They use the
same rebuilt WASM, painter and Czech resources. A visible QA banner discloses
the16× clock and a virtual-only first Atreides scenario override: WinFlags4,
LoseFlags4, Quota1. The verified scenario's other bytes remain identical. Its
hashes and exact changes are recorded in `modal-browser-harness.json`. Serve
this page on a separate loopback origin/save store, choose Atreides through
the normal UI and wait for the native result check. The modal should retain
the painted world; the next actual advisor should hide it. This experiment
tests presentation boundaries, not original timing or gameplay equivalence.
Remove both generated pages before release; retain the generator and report.
