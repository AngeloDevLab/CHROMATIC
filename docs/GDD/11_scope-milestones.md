# 12. Scope & Milestones

## 12.1 In Scope (v1 — Prologue)

Scope cut from the original Prologue + Chap 1 target - Chap 1's ~18 remaining levels didn't fit the timeline (see 12.3). Prologue was always the proven-first build target (see 12.3); it's now also the actual v1 release scope, not just a stepping stone.

- Prologue (1 Template, 6 levels, see 02_game-structure.md 2.6)
- All 4 enemy types (Patroller, Charger, Shooter, Sentinel) - all introduced within the Prologue itself now (Lvl 1: Patroller + Charger, Lvl 2: Shooter + Sentinel, see 02_game-structure.md 2.4/2.6), instead of Shooter/Sentinel waiting for Chap 1
- Miniboss + Templateboss (2 boss encounters - Wraith of the Shifting Sands, Wraith of the Grey City, see 05_enemies-bosses.md 6.3) - no Chapterboss, that tier only exists at the end of a chapter's last Template
- Full combat system (melee + ranged, both available from the start)
- Color mechanic (in-level + Worldmap)
- Shield/Prisma system
- Difficulty selection (Easy/Normal/Hard) at game start
- Secret Room with permanent character buff system (Prologue has exactly one, Lvl 5, see 02_game-structure.md 2.6)
- Token economy + Merchant (Prologue yields 3 Tokens - 1 Miniboss + 2 Templateboss - enough for 1 purchasable ability, see 02_game-structure.md 2.5's example calculation)
- Worldmap with chapter bar (Prologue active, Chap 1/Chap 2/Chap 3/Chap 4/Epilogue all "Coming Soon" for now - Chap 1 no longer unlocks after the Prologue, see the note below)
- Touch + keyboard controls
- Landscape mode check
- LocalStorage save data
- Main menu (Start, Continue, Settings, Credits, Imprint, Privacy) + intro cutscene (Guardian materializes on the beach) + the Prologue's own closing cutscene
- Story for the Prologue
- Game output in English

**Narrative note**: the Prologue's closing cutscene (02_game-structure.md 2.6) currently ends on "then Chap 1 opens on the Worldmap" - needs a rewrite for a standalone v1 ending now that Chap 1 doesn't open next, still to be written.

## 12.2 Phase 2 / Optional

- Chap 1 (3 Templates, ~20 levels; 6 further boss encounters incl. the first Chapterboss; "stronger variants" of all 4 enemy types (see 02_game-structure.md 2.4); expanded Token economy - see 02_game-structure.md 2.7) - moved here from v1 scope per the cut in 12.1
- Chap 2, 3, 4+
- A second pass through colored levels with NPC mechanics
- Swimming
- Combos
- Firebase cross-device save
- Full soundtrack
- Localization into further languages

## 12.3 Build Order & Timeline

The build target is the **Prologue as a complete Template** - per the scope cut in 12.1, this is now the actual v1 release, not just a stepping stone Chap 1 scales up from. Chap 1 remains possible later (12.2) once the Prologue's remaining systems (Secret Room/buffs, Token economy/Merchant, save data, touch controls, legal pages) are actually done, not assumed to fit alongside ~18 more levels.

Timeline, flexible **3-5 weeks**: 3 weeks is the full-time baseline, realistically more like 4-5 weeks due to a parallel training course.

| Week | Goal |
|---|---|
| Week 1 | Base architecture, state machine, player movement incl. Shield, canvas rendering, basic Worldmap structure |
| Week 2 | Combat system (melee+ranged from the start), enemy AI (all 4 types - Patroller, Charger, Shooter, Sentinel), color mechanic, Prologue levels 1-2 |
| Week 3 | Miniboss + Templateboss, Secret Room + buff system, Token economy + Merchant - **Prologue complete** |
| Week 4 | LocalStorage save, touch controls, landscape check, legal pages (Credits/Imprint/Privacy) |
| Week 5 | UI polish, game feel (juice, screen shake, sound), bug fixing |

## 12.4 Current v1 Progress

Tracks actual status against the 12.1 checklist - update this instead of trying to infer progress from `CHANGELOG.md`'s version number (see the versioning discussion this session: version numbers there track shipped increments, not % of scope done).

| Item | Status |
|---|---|
| Prologue levels (6) | Lv 1-5 done, registered, and reachable (`LevelSession.js`'s `LEVEL_JSON_KEYS`, `LoadingState.js`'s manifest). Lv 6 (Templateboss) not built. |
| Enemy types (Patroller, Charger, Shooter, Sentinel) | 4/4 implemented - balance values still first-guess, see `TODO.md` |
| Miniboss + Templateboss | Miniboss (Wraith of the Shifting Sands, Lvl 3) done and rebalanced (HP/contact-damage/enrage, CHANGELOG 0.8.0) - remaining tuning constants still first-guess, see `TODO.md`. Templateboss (Lvl 6, Wraith of the Grey City) not built - its HP/damage tier is already set in 05_enemies-bosses.md 6.5's revised table. |
| Combat system (melee + ranged) | Done, regular-enemy balance still first-guess (see `TODO.md`); boss-side damage-number/vulnerable-window bugs fixed this session (CHANGELOG 0.8.0) |
| Color mechanic (in-level) | Done |
| Color mechanic (Worldmap reveal) | Not built |
| Shield/Prisma system | Done |
| Difficulty selection | Done |
| Secret Room + buff system | Done (CHANGELOG 0.6.2) - buff magnitudes still first-guess, see `TODO.md` |
| Token economy + Merchant | Not built - Merchant teaser NPC exists (dialogue only, `entities/Merchant.js`), no real shop/Token spend yet |
| Worldmap chapter bar | Done (all 6 chapters listed, only Prologue unlocked) |
| Touch controls | Not built (keyboard/mouse only) |
| Landscape mode check | Not built |
| LocalStorage save | Partial - `SaveSystem.js` (CHANGELOG 0.7.0) exists and backs Settings preferences (fullscreen, volumes, mute); `Game.completedLevels`/`Game.buffs` are still session-only, not yet migrated |
| Main menu core (Start/Continue/Settings/Info) | Done |
| Legal pages (Credits/Imprint/Privacy) | Placeholder only ("coming soon" text, `MenuState.js`) |
| Intro cutscene | Done |
| Prologue closing cutscene | Not built (blocked on Lvl 6 existing; needs the narrative rewrite noted in 12.1) |
| Prologue story | Partial (intro only so far) |
| English output | Done |
