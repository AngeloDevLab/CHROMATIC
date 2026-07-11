# 12. Scope & Milestones

## 12.1 In Scope (v1 — Prologue + Chap 1)

- Prologue (1 Template, 6 levels) + Chap 1 (3 Templates, approx. 20 levels)
- 4 enemy types (Patroller, Charger, Shooter, Sentinel)
- Miniboss/Templateboss/Chapterboss hierarchy - 8 boss encounters total (Prologue: 2, Chap 1: 6)
- Full combat system (melee + ranged, both available from the start)
- Color mechanic (in-level + Worldmap)
- Shield/Prisma system
- Difficulty selection (Easy/Normal/Hard) at game start
- Secret Rooms with permanent character buff system
- Token economy + Merchant after every Templateboss/Chapterboss
- Worldmap with chapter bar (Prologue / Chap 1 / Chap 2 / Chap 3 / Chap 4 / Epilogue, the latter initially "Coming Soon")
- Touch + keyboard controls
- Landscape mode check
- LocalStorage save data
- Main menu (Start, Continue, Settings, Credits, Imprint, Privacy) + intro cutscene (Guardian materializes on the beach) + chapter-end cutscenes
- Story for Prologue + Chap 1 incl. cliffhanger
- Game output in English

## 12.2 Phase 2 / Optional

- Chap 2, 3, 4+
- A second pass through colored levels with NPC mechanics
- Swimming
- Combos
- Firebase cross-device save
- Full soundtrack
- Localization into further languages

## 12.3 Build Order & Timeline

The first build target is the **Prologue as a complete Template** - this proves out the reusable system (basic movement, color mechanic, Shield, combat system, boss hierarchy, Token economy) before scaling to the remaining Templates. Chap 1 is **only tackled if enough time remains after the Prologue** - after that, per the plan, it's "just" content generation (more levels in Tiled, more game art) and scaling up the already-proven system, no new architectural risk.

Timeline, flexible **3-5 weeks**: 3 weeks is the full-time baseline, realistically more like 4-5 weeks due to a parallel training course.

| Week | Goal |
|---|---|
| Week 1 | Base architecture, state machine, player movement incl. Shield, canvas rendering, basic Worldmap structure |
| Week 2 | Combat system (melee+ranged from the start), enemy AI, color mechanic, **Prologue complete** (1 Template, Miniboss+Templateboss, Merchant) |
| Week 3 | Scaling up to Chap 1, Template 1 "The Grey City" |
| Week 4 | Chap 1 Template 2 "The Sewers" + Template 3 "The Black Forest" incl. Chapterboss, cutscenes, story fragments |
| Week 5 | Mobile controls, UI polish, game feel (juice, screen shake, sound), bug fixing |
