# 5. Health & Save System

## 5.1 Health

| Element | Details |
|---|---|
| System | Numeric health bar, base value 100 |
| Player display | Health bar top left in the HUD |
| Enemy display | HP bar above the enemy's head |
| Healthpacks | Random drop per enemy type. Small (+20 Health) - common drop from normal enemies. Large (+50 Health) - rarer, mostly from stronger enemies/minibosses |
| Death | Back to the last checkpoint |
| Color on death | Stays in place - only position and health reset |

Numeric instead of hearts, so Health can use the same bar UI component and the same damage code path as the Prisma (see 5.2). A heart-row skin on top of the numeric value remains a purely visual option later.

## 5.2 Shield (Prisma)

Second resource next to Health, also numeric, base value 100. Details and mechanics in [03_mechanics.md](03_mechanics.md) 4.5. Short version: the color barrier absorbs hits and damages enemies that touch it, regenerates passively over time, and only once fully depleted does damage go to Health.

## 5.3 Difficulty

Chosen at game start (see [08_menu-flow.md](08_menu-flow.md) 9.3) and scales exclusively the **incoming damage** (from enemies and bosses alike) - enemy HP and the player's own damage stay the same across all three difficulties, so fights become more dangerous, not longer or shorter.

| Difficulty | Damage Multiplier | Feel |
|---|---|---|
| Easy | ×0.5 (-50% incoming damage) | Can afford mistakes, survives several hits |
| Normal | ×1 (base values from [05_enemies-bosses.md](05_enemies-bosses.md) 6.5) | Normal margin for error |
| Hard | ×2 (+100% incoming damage) | Needs near-perfect play - many hits can be a one-shot |

Deliberately round numbers (-50%/+100%) rather than an odd fraction - easy to state as a one-line "what changes" info wherever difficulty is shown (e.g. the selection panel), and easy to reason about while balancing.

Reference Chapterboss hit (base value 100, 50% of the 200 pool on Normal): Easy 50 (25% of pool), Hard 200 (= full pool, one-shot).

## 5.4 Save System

LocalStorage - no backend needed. Save object:

| Key | Content |
|---|---|
| playerPosition | x, y coordinates |
| unlockedAbilities | Array of unlocked abilities |
| coloredAreas | Array of colored area IDs |
| defeatedBosses | Array of defeated bosses (Miniboss/Templateboss/Chapterboss) |
| tokens | Number of Tokens collected |
| characterBuffs | Array/object of permanent stat buffs from Secret Rooms |
| health | Current health value |
| shield | Current Prisma value |
| difficulty | Chosen difficulty (Easy/Normal/Hard) |
| checkpointId | Last active checkpoint |
| currentChapter | Current chapter (Prologue, Chap 1, Chap 2, ...) |
| prologComplete | Boolean - unlocks Chap 1 on the Worldmap |

Firebase as an optional extension for cross-device saves in Phase 2. No Firebase needed for asset delivery (sprites, sounds) - static hosting is enough, see [10_technical-architecture.md](10_technical-architecture.md).
