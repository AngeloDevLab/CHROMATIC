# Ideas Inbox

Unfiltered ideas/UI impressions/implementation ideas from the GDD review sessions. Not yet part of the binding GDD - only moved into the respective chapter after a decision is made.

Format: Idea - Context/Reasoning - Related GDD chapter - Status

---

## Main Menu / Presentation

- **Always fullscreen landscape** - Canvas should generally be rendered in fullscreen landscape, not just as a mobile-only requirement. -> Related: [10_technical-architecture.md](10_technical-architecture.md) (viewport/rendering), [08_menu-flow.md](08_menu-flow.md) (LandscapeCheck state). Status: open.
- **Living background in the main menu** - Instead of a static menu background, load a small demo scene: a simple tileset, the same color-trail logic as in the real game, a character running automatically (autopilot) from left to right. Shows the core mechanic (bringing back color through movement) before the game even starts. -> Related: [08_menu-flow.md](08_menu-flow.md) (MenuState), [09_audio-visual.md](09_audio-visual.md). Status: open.

## Cutscenes

- **Hybrid cutscene approach** - Mix two production methods instead of committing to just one, for maximum control per moment: (1) pre-rendered full-scene animation authored in Aseprite/PixelLab and exported as a frame sequence, played back like a flipbook in `CutsceneState` - for the few big dramatic beats (e.g. Guardian materializing on the beach, Epilogue reveal); (2) in-engine scripted cutscenes using the real game assets (Player sprite, tileset, Camera) driven by a small timeline/script format (`moveTo`, `playAnim`, `showDialogue`, `fadeIn/out`, `wait`) - for smaller inter-chapter/story-fragment beats. Reasoning: keeps asset budget in check (matches the existing re-tint/reuse philosophy) while still allowing full visual control where it matters most. -> Related: [08_menu-flow.md](08_menu-flow.md) (CutsceneState), [10_technical-architecture.md](10_technical-architecture.md) (folder structure - would need e.g. a `Cutscene.js`/script format). Status: leaning towards yes, not finally decided.

## Typography & UI Rendering

- **Two-font pairing: Jacquard + Jersey** - Jacquard (12/24) fits the Medieval Fantasy tone but at 640x360 internal resolution small sizes (~16px) become hard to read, and drawing text directly via `fillText()` into the pixelated-scaled canvas buffer makes glyph edges scale up blocky instead of staying crisp. Resolved by splitting duties across two fonts: **Jacquard** for game title, chapter titles, cutscene/dialogue text, story fragments (thematic immersion, read slower/less often); **Jersey** (clean pixel font) for HUD numbers (Health, Prisma/Shield, Tokens), menu buttons, settings labels (checked constantly, needs instant legibility). -> Related: [09_audio-visual.md](09_audio-visual.md), [07_ui-hud.md](07_ui-hud.md). Status: decided.
- **HTML/CSS overlay for UI text instead of canvas-drawn text** - Add a `#ui-overlay` div, absolutely positioned over the canvas within a `position: relative` container. Give the overlay the same 640x360 internal coordinate system as the game (via `transform: scale(scaleFactor); transform-origin: top left;`, matching the canvas's own scale factor from [10_technical-architecture.md](10_technical-architecture.md) 11.7.1), so HUD elements can be positioned in game-space coordinates without per-resolution recalculation. Text (HUD, menus, dialogue) is then real DOM/CSS text rendered by the browser's font engine - sharp at any scale, sidesteps the pixelated-scaling blockiness entirely, and lets `@font-face` (Jacquard) be used directly. Overlay needs `pointer-events: none` by default, with `pointer-events: auto` on individual interactive elements (buttons, mobile controls) so clicks/touches still pass through to the canvas elsewhere. -> Related: [10_technical-architecture.md](10_technical-architecture.md) (folder structure - would need a UI overlay layer alongside `ui/`), [07_ui-hud.md](07_ui-hud.md). Status: leaning towards yes, not finally decided.
