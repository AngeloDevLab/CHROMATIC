# 5. Health & Save System

## 5.1 Health

| Element | Details |
|---|---|
| System | Numeric health bar, base value 100 |
| Player display | Health bar top left in the HUD |
| Enemy display | HP bar above the enemy's head |
| Healthpacks | Designed, not yet implemented. Random drop per enemy type - Small (+20 Health) common from normal enemies, Large (+50 Health) rarer, mostly from stronger enemies/minibosses. A similar pickup for Prisma is wanted too, not yet designed (see [03-mechanics.md](03-mechanics.md) 4.5) |
| Death | Restarts the level from the beginning - no mid-level checkpoint system. Considered and cut for now: current levels are short enough that a real checkpoint doesn't pay for itself yet (see `ideas-inbox.md`) |
| Color on death | Also resets - since the whole level restarts fresh, any color revealed during that attempt is lost along with position/health |

Numeric instead of hearts, so Health can use the same bar UI component and the same damage code path as the Prisma (see 5.2). A heart-row skin on top of the numeric value remains a purely visual option later.

## 5.2 Shield (Prisma)

Second resource next to Health, also numeric, base value 100. Details and mechanics in [03-mechanics.md](03-mechanics.md) 4.5. Short version: the color barrier absorbs hits and damages enemies that touch it, regenerates passively over time, and only once fully depleted does damage go to Health.

## 5.3 Difficulty

Chosen at game start (see [08-menu-flow.md](08-menu-flow.md) 9.3) and scales exclusively the **incoming damage** (from enemies and bosses alike) - enemy HP and the player's own damage stay the same across all three difficulties, so fights become more dangerous, not longer or shorter.

| Difficulty | Damage Multiplier | Feel |
|---|---|---|
| Easy | ×0.5 (-50% incoming damage) | Can afford mistakes, survives several hits |
| Normal | ×1 (base values from [05-enemies-bosses.md](05-enemies-bosses.md) 6.5) | Normal margin for error |
| Hard | ×2 (+100% incoming damage) | Needs near-perfect play - many hits can be a one-shot |

Deliberately round numbers (-50%/+100%) rather than an odd fraction - easy to state as a one-line "what changes" info wherever difficulty is shown (e.g. the selection panel), and easy to reason about while balancing.

Reference Chapterboss hit (base value 100, 50% of the 200 pool on Normal): Easy 50 (25% of pool), Hard 200 (= full pool, one-shot).

## 5.4 Save System

LocalStorage - no backend needed. Currently saved:

| Key | Content |
|---|---|
| completedLevels | Which levels are finished - drives Worldmap color-reveal and whether Continue is offered |
| tokens | Number of Tokens collected |
| abilities | Array of unlocked abilities |
| buffs | Permanent stat buffs unlocked from Secret Rooms |
| difficulty | Chosen difficulty (Easy/Normal/Hard) |

Not currently saved (reset every time a level is (re-)entered, since there's no mid-level checkpoint - see 5.1): player position, current health/shield, color revealed within a level. Also not saved yet since only the Prologue exists so far: which specific bosses were defeated (implied by `completedLevels` for now) and the current chapter (nothing to track beyond Prologue yet).

Firebase as an optional extension for cross-device saves in Phase 2. No Firebase needed for asset delivery (sprites, sounds) - static hosting is enough, see [10-technical-architecture.md](10-technical-architecture.md).
