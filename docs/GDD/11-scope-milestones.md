# 12. Scope & Milestones

## 12.1 In Scope (v1 — Prologue)

Scope cut from the original Prologue + Chap 1 target - Chap 1's ~18 remaining levels didn't fit the timeline (see 12.3). Prologue was always the proven-first build target (see 12.3); it's now also the actual v1 release scope, not just a stepping stone.

- Prologue (1 Template, 6 levels, see 02-game-structure.md 2.6)
- All 4 enemy types (Patroller, Charger, Shooter, Sentinel) - all introduced within the Prologue itself now (Lvl 1: Patroller + Charger, Lvl 2: Shooter + Sentinel, see 02-game-structure.md 2.4/2.6), instead of Shooter/Sentinel waiting for Chap 1
- Miniboss + Templateboss (2 boss encounters - Wraith of the Shifting Sands, Wraith of the Grey City, see 05-enemies-bosses.md 6.3) - no Chapterboss, that tier only exists at the end of a chapter's last Template
- Full combat system (melee + ranged, both available from the start)
- Color mechanic (in-level + Worldmap)
- Shield/Prisma system
- Difficulty selection (Easy/Normal/Hard) at game start
- Secret Room with permanent character buff system (Prologue has exactly one, Lvl 5, see 02-game-structure.md 2.6)
- Token economy + Merchant (Prologue yields 3 Tokens - 1 Miniboss + 2 Templateboss - enough for 1 purchasable ability, see 02-game-structure.md 2.5's example calculation)
- Worldmap with chapter bar (Prologue active, Chap 1/Chap 2/Chap 3/Chap 4/Epilogue all "Coming Soon" for now - Chap 1 no longer unlocks after the Prologue, see the note below)
- Touch + keyboard controls
- Landscape mode check
- LocalStorage save data
- Main menu (Start, Continue, Settings, Credits, Imprint, Privacy) + intro cutscene (Guardian materializes on the beach) + the Prologue's own closing cutscene
- Story for the Prologue
- Game output in English

**Narrative note**: the Prologue's closing cutscene (02-game-structure.md 2.6) currently ends on "then Chap 1 opens on the Worldmap" - the Worldmap unlock part is stale (Chap 1's button stays disabled regardless, v1 is Prologue-only), but the cutscene should still narratively tease/introduce Chap 1 as a hook for what's coming, just without it actually being playable yet. Still to be written either way - not built at all right now.

## 12.2 Phase 2 / Optional

- Chap 1 (3 Templates, ~20 levels; 6 further boss encounters incl. the first Chapterboss; "stronger variants" of all 4 enemy types (see 02-game-structure.md 2.4); expanded Token economy - see 02-game-structure.md 2.7) - moved here from v1 scope per the cut in 12.1
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
| Prologue levels (6) | All 6 done, registered, and reachable (`level-session.js`'s `LEVEL_JSON_KEYS`, `loading-state.js`'s manifest) - Lv 6 (Templateboss) done this session (CHANGELOG 0.10.0). |
| Enemy types (Patroller, Charger, Shooter, Sentinel) | 4/4 implemented - balance values still first-guess, see `TODO.md` |
| Miniboss + Templateboss | Both done. Miniboss (Wraith of the Shifting Sands, Lvl 3) rebalanced (HP/contact-damage/enrage, CHANGELOG 0.8.0). Templateboss (Lvl 6, Wraith of the Grey City) built this session (CHANGELOG 0.10.0) - extends `wraith.js` per 05-enemies-bosses.md 6.3.1 rather than duplicating it, rolls horizontal/vertical beam axis each attack, enrage forces alternation. Remaining tuning constants (shared `wraith.js` timers/speeds plus Templateboss-specific ones) still first-guess, see `TODO.md`. |
| Combat system (melee + ranged) | Done, regular-enemy balance still first-guess (see `TODO.md`); boss-side damage-number/vulnerable-window bugs fixed this session (CHANGELOG 0.8.0) |
| Color mechanic (in-level) | Done |
| Color mechanic (Worldmap reveal) | Done (CHANGELOG 0.12.0) - the Prologue's Worldmap path is split into one zone per level, revealing hard-edged the instant that level is completed; the just-finished level's own zone instead sweeps left-to-right |
| Shield/Prisma system | Done |
| Difficulty selection | Done |
| Secret Room + buff system | Done (CHANGELOG 0.6.2) - buff magnitudes still first-guess, see `TODO.md` |
| Token economy + Merchant | Done (CHANGELOG 0.9.0/0.11.0) - both boss tiers drop real, collectible Tokens, and the real Merchant shop UI is live (talk to Merchant -> spend 2 Tokens -> ability unlocked), no longer Dev-Panel-only |
| Worldmap chapter bar | Done (all 6 chapters listed, only Prologue unlocked) |
| Touch controls | Done (CHANGELOG 0.13.0) - virtual D-Pad/Attack/Pause buttons plus a contextual Interact prompt, confirmed working on a real phone (not just DevTools touch emulation) |
| Landscape mode check | Done (CHANGELOG 0.13.0) - a portrait-orientation gate blocks play on a touch device until it's rotated to landscape |
| LocalStorage save | Done (CHANGELOG 0.11.0) - `completedLevels`/`buffs`/`tokens`/`abilities`/`difficulty` all persist across page reloads now, not just Settings preferences |
| Main menu core (Start/Continue/Settings/Info) | Done |
| Legal pages (Credits/Imprint/Privacy) | Done (CHANGELOG 0.14.0) - real Credits/Legal Notice/Privacy Policy content, including real contact details |
| Intro cutscene | Done |
| Prologue closing cutscene | Not built - Lvl 6 now exists (CHANGELOG 0.10.0) so no longer blocked on that, still needs the narrative rewrite noted in 12.1 (standalone v1 ending, not "Chap 1 opens next") |
| Prologue story | Partial (intro only so far) |
| English output | Done |
