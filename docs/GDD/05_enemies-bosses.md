# 6. Enemies & Bosses

## 6.1 Enemy Types

| Type | Behavior |
|---|---|
| Patroller | Walks a route back and forth |
| Charger | Spots the player, rushes in |
| Shooter | Keeps distance, fires projectiles |
| Sentinel | Static, aggros when approached |

The Sentinel is deliberately kept separate from the protagonist's title "Guardian", to avoid term collisions between hero and enemy type.

## 6.2 Boss Hierarchy

Details on the structure in [02_game-structure.md](02_game-structure.md) 2.2. Each Template has exactly one Miniboss and one Templateboss; the Templateboss of a chapter's last Template becomes the Chapterboss.

| Tier | Entrance | Fight | Drop |
|---|---|---|---|
| Miniboss | Directly from the level, no state change | Simple mechanic, 1-2 phases | 1 Token |
| Templateboss | Arena presentation (see 6.2.1), no full state change | Own mechanic, expands on the Miniboss theme | 2 Tokens |
| Chapterboss | Arena presentation (see 6.2.1), plus everything turns black/white, boss huge, player tiny - maximum contrast | Individual, own boss state, phase system | 2 Tokens |

After a Templateboss/Chapterboss, the Merchant appears in the same room. For Templateboss/Chapterboss additionally: on-screen color explosion, the entire level turns colorful, the Worldmap node turns colorful, the next chapter opens.

### Thematic Connection

A Miniboss and its Templateboss/Chapterboss within a Template are not a random pairing: the Miniboss introduces an ability or mechanic in simple form, the Templateboss/Chapterboss expands on exactly that or combines it with a second one. Each Template gets its own throughline instead of arbitrary individual encounters.

### 6.2.1 Arena Presentation & Combat (Templateboss/Chapterboss only)

Unlike the Miniboss, Templateboss and Chapterboss fights get a dedicated arena presentation:

- The boss manifests as a dark, corrupted cloud-mass entering from the left, right, and top screen edges. The camera zooms out (see 11.7.3 in [10_technical-architecture.md](10_technical-architecture.md)), and the boss's own cloud-mass visually bounds the enlarged arena on those three sides - the boss itself is the wall of the arena, not just a sprite inside it.
- The world's color mechanic is fully suspended for the duration of the fight (see [03_mechanics.md](03_mechanics.md) 4.1): no new ground colors from movement, no reverting of existing colored ground either. The player's Prisma/Shield bar remains the only active color-coded UI element - visually, the player is the sole point of color left on screen, everything else corrupted grey/dark by the boss.
- Combat uses the same base toolkit as regular enemies: melee (run up and swing) or ranged (sword throw) depending on distance, see [03_mechanics.md](03_mechanics.md) 4.3. Additionally, the boss exposes weak spot(s) via its own telegraphed abilities/attacks - hitting the weak spot during its window deals bonus damage.
- The Chapterboss keeps this same arena presentation as its baseline, then adds the further black/white maximum-contrast escalation on top (see table above).

## 6.3 Bosses - Prologue

| Lvl | Tier | Name | Tokens |
|---|---|---|---|
| 3 | Miniboss | The Sand Colossus | 1 |
| 6 | Templateboss | Tide Lord | 2 |

## 6.4 Bosses - Chap 1

| Template | Lvl | Tier | Name | Tokens |
|---|---|---|---|---|
| The Grey City | 4 | Miniboss | The Gatebreaker | 1 |
| The Grey City | 7 | Templateboss | Ashlord of the City | 2 |
| The Sewers | 3 | Miniboss | The Sludge Colossus | 1 |
| The Sewers | 6 | Templateboss | The Flood Lord | 2 |
| The Black Forest | 4 | Miniboss | The Thorn Colossus | 1 |
| The Black Forest | 7 | Chapterboss | Forest Spirit of Darkness | 2 |

## 6.5 Balancing (First Draft)

Rough values for calibration, to be adjusted after playtesting. Base: player damage 10/hit (see [03_mechanics.md](03_mechanics.md) 4.3), player pool 200 (Health+Shield, see [04_health-save-system.md](04_health-save-system.md) 5.3), values for Normal difficulty.

### Enemies (Zone 1)

| Type | HP | Damage/Hit | Player hits until enemy dead | Enemy hits until player dead (1v1, isolated) |
|---|---|---|---|---|
| Patroller | 20 | 10 | 2 | 20 |
| Sentinel | 30 | 8 | 3 | 25 |
| Charger (Zone 2+) | 25 | 10 | 3 | 20 |
| Shooter (Zone 3+) | 15 | 8 | 2 | 25 |

Zone 3 "stronger variants" (see [02_game-structure.md](02_game-structure.md) 2.4): +50% to HP and damage.

### Bosses

| Tier | HP | Signature Hit Damage | Player hits until boss dead (approx.) |
|---|---|---|---|
| Miniboss | 150 | 40 | ~15 |
| Templateboss | 250 | 70 | ~25 |
| Chapterboss | 400 | 100 (= Normal Boss-Hit from 5.3) | ~40 |
