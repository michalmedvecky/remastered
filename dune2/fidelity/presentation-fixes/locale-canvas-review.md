# Czech typography and whole UI review

The parent agent's private browser review passed the complete production UI fixture. The fixture uses the shipped Czech overlay, its 254-entry native FNT descriptors, exact indexed sprite/scene evidence, and the production CP1250 decoder. It launches no original game, emulator or server.

Verified coverage:

- **18 Czech compositions:** 12 mission outcome scenes (WIN1, WIN2, LOSTBILD and LOSTVEHC across three advisors), three house confirmations, and three compact-font help screens.
- **Three English confirmations:** each must show exactly its selected house name, matching homeworld preview and Yes/No captions. The Czech confirmations likewise require Harkonnenů?, Atreidů? or Ordosů? as appropriate; shared background pixels cannot select a house.
- **Two complete house-choice screens, Czech and English:** all captions fit the actual gold nameplates. Each house caption uses a 71×13 native rectangle at y=132 with 3/2/3/2 insets. Comparison against the independently composed new base outside caption ink found **0 differing bytes, maximum channel difference 0** in both languages. Rendering over a deliberately poisoned, patterned whole-canvas underlay produced **0 differing bytes** in both languages. The new scene therefore retains no native caption ink through transparent gaps. This check uses production typography rather than duplicating its renderer.
- **Four cursor positions:** complete literal Czech runs retained identical layout, font sizes and spacing.
- **One native options window:** long Czech menu captions fit its original geometry; **0 fit violations**.
- **162 rolling-credit cases:** HUD and factory, fixed values, all 15 offsets for five carry transitions, background-only and partial final-column copies. All passed without escaping the independent safe field.

All Czech diacritics, semantic controls and full native runs were exercised. The parent also verified the live Atreides confirmation displays **Atreidů?** with the correct whole advisor body and period lettering.

`tests/painted-locale-presentation.test.mjs`: **6 passed, 0 failed**. These checks cover byte decoding, extended native/vector glyphs, merging all 25 partial localized sprite patches with original geometry, literal-run stability, fitted captions and exact English/Czech confirmation recognition.

Recreate the temporary review page with:

```sh
python3 fidelity/painted-polish/locale-canvas-review.py --output dist/locale-qa.html
```

Open the generated page through the existing restricted preview and inspect `body.dataset.pass` and `#result`. The page embeds source hashes. Remove the temporary HTML after review; the generator and tests are retained. This review does not claim complete campaign acceptance or original DOS execution.
