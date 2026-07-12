# Ideas Inbox

Unfiltered ideas/UI impressions/implementation ideas from the GDD review sessions. Not yet part of the binding GDD - only moved into the respective chapter after a decision is made.

Format: Idea - Context/Reasoning - Related GDD chapter - Status

---

## Cutscenes

- **Hybrid cutscene approach** - Mix two production methods instead of committing to just one, for maximum control per moment: (1) pre-rendered full-scene animation authored in Aseprite/PixelLab and exported as a frame sequence, played back like a flipbook in `CutsceneState` - for the few big dramatic beats (e.g. Guardian materializing on the beach, Epilogue reveal); (2) in-engine scripted cutscenes using the real game assets (Player sprite, tileset, Camera) driven by a small timeline/script format (`moveTo`, `playAnim`, `showDialogue`, `fadeIn/out`, `wait`) - for smaller inter-chapter/story-fragment beats. Reasoning: keeps asset budget in check (matches the existing re-tint/reuse philosophy) while still allowing full visual control where it matters most. -> Related: [08_menu-flow.md](08_menu-flow.md) (CutsceneState), [10_technical-architecture.md](10_technical-architecture.md) (folder structure - would need e.g. a `Cutscene.js`/script format). Status: leaning towards yes, not finally decided.
