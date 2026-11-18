The full C scene comparison exposed an out-of-bounds key probe in `Ini_GetString`.
The generated INI ends with `language=english`; probing the longer absent key
`debug_skip_dialogs` advanced past the allocation before checking the key.

`tools/patch-native-ini.py` bounds the key comparison and suffix scan by the
current section. Existing matches and missing-key defaults retain their values.
`python3 fidelity/ini/test-native-ini.py` compiles the actual parser under ASan
and exercises eight exact-sized heap inputs, including the observed last line,
an absent key at a section boundary, case/spacing, and prefix collisions. The
same fixture fails under ASan when the patch is removed. That negative run is
saved in `analysis/dune-2/dos-comparison/native-scenes/ini-regression`.
