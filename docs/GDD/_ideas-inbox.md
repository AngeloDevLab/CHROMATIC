# Ideas Inbox

Unfiltered ideas/UI impressions/implementation ideas from the GDD review sessions. Not yet part of the binding GDD - only moved into the respective chapter after a decision is made.

Format: Idea - Context/Reasoning - Related GDD chapter - Status

---

## Cutscenes

- **Hybrid cutscene approach** - Mix two production methods instead of committing to just one, for maximum control per moment: (1) pre-rendered full-scene animation authored in Aseprite/PixelLab and exported as a frame sequence, played back like a flipbook in `CutsceneState` - for the few big dramatic beats (e.g. Guardian materializing on the beach, Epilogue reveal); (2) in-engine scripted cutscenes using the real game assets (Player sprite, tileset, Camera) driven by a small timeline/script format (`moveTo`, `playAnim`, `showDialogue`, `fadeIn/out`, `wait`) - for smaller inter-chapter/story-fragment beats. Reasoning: keeps asset budget in check (matches the existing re-tint/reuse philosophy) while still allowing full visual control where it matters most. -> Related: [08_menu-flow.md](08_menu-flow.md) (CutsceneState), [10_technical-architecture.md](10_technical-architecture.md) (folder structure - would need e.g. a `Cutscene.js`/script format). Status: leaning towards yes, not finally decided.

## Secret Room Content

- **Custom enemies exclusive to Secret Rooms** - Unique enemy sprites/types that only ever appear inside Secret Rooms. Reasoning against: directly contradicts the project's own art-budget rule of re-tinting existing enemy sprites for "stronger variants" instead of commissioning new ones (see [02_game-structure.md](02_game-structure.md) 2.4) - a one-off enemy exclusive to an optional room isn't worth breaking that rule for. -> Related: [02_game-structure.md](02_game-structure.md) 2.5 (Secret Rooms), 2.4 (re-tint philosophy). Status: rejected for v1.
- **Minigames/Terminal puzzles** inside Secret Rooms or at Terminals - Reasoning against: every minigame is its own mechanic, meaning its own code and its own assets. For a capstone whose baseline goal is "prove out the Prologue first" (see [11_scope-milestones.md](11_scope-milestones.md) 12.3), this is exactly the kind of feature that eats the timeline without being load-bearing for the core loop. Appealing, but not now. -> Related: [11_scope-milestones.md](11_scope-milestones.md) 12.3 (Build Order & Timeline). Status: rejected for v1, revisit only if Phase 2 happens.
