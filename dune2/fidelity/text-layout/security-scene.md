# Security input panel is mutable advisor content

The live Czech security observation identified Ordos only352/368 times, despite
the correct complete native advisor being present. The16 mismatching compiled
anchors lie exactly inside the security input inset `[14,174,292,15]`.
Another16 anchors on the outer panel's bottom rim are correctly masked by
observed border ink. `GUI_Security_Show` fills the outer panel
`[10,170,300,23]`, then draws the unfilled inner border. The observer deliberately
records only border rims; its ink cannot describe the real interior clear.

Scene compilation now excludes that exact source-defined security window,
alongside native speech, media, actor and bottom-control regions. It selects384
independent remaining static points for all four advisors. Recognition still
requires a unique exact match; there is no lowered similarity threshold and no
generic trust in filled-border bounding boxes. Unobserved corruption elsewhere
continues to reject the scene. This presentation-only fix changes no native
code, data or gameplay.

`tests/painted-scenes.test.mjs` covers the four advisor sources with real native
actor sprites, the input panel and rim-only observer evidence, three typing/blink
phases, native restore and outside-corruption negatives. All5 scene tests pass.
The complete source text and live diagnostic are retained as
`native/opendune/src/gui/security.c` and `security-observation.json`; the latter
records the initial failure, not the corrected result. A separate inert Canvas
fixture checks the full production rendering composition.

The final24-case production Canvas run passed in `security-results.json`, with zero question/input underlay differences, exact whole-advisor regions and a visible difference between both native blink phases. Initially the new whole base hid the old raw cursor: `observedSecurityEditBox` now requires both exact schema rectangles and detects the existing native FG15 block from cursor-free pixels. It paints only that observed block, with no new clock or guessed position. UI-core cursor tests also cover incomplete blocks, missing schemas and cursor-free precedence.
