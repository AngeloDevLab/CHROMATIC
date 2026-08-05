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

Unlike the Miniboss, Templateboss and Chapterboss fights get a dedicated arena presentation - though for the Prologue's Wraiths specifically, both tiers currently share the same fight structure, so both get it, not just the Templateboss:

- The arena is enlarged to its own dedicated size rather than the camera merely zooming out on the normal-sized level (see 11.7.3 in [10_technical-architecture.md](10_technical-architecture.md)). The boss manifesting as a dark, corrupted cloud-mass that visually bounds the arena on three sides is still a planned visual - currently the boss just spawns and renders like a regular enemy with its own sprite.
- The world's color mechanic keeps working completely normally throughout the fight (see [03_mechanics.md](03_mechanics.md) 4.1) - the player still colors the ground by moving, same as anywhere else. The one exception: the instant the boss's own attack fires, the whole room snaps back to grey except a small safe pocket around the player, then normal coloring resumes until the next attack.
- Combat uses the same base toolkit as regular enemies: melee (run up and swing) or ranged (sword throw) depending on distance, see [03_mechanics.md](03_mechanics.md) 4.3. Additionally, the boss exposes weak spot(s) via its own telegraphed abilities/attacks - hitting the weak spot during its window deals bonus damage.
- The Chapterboss keeps this same arena presentation as its baseline, then adds the further black/white maximum-contrast escalation on top (see table above).

## 6.3 Bosses - Prologue

| Lvl | Tier | Name | Tokens |
|---|---|---|---|
| 3 | Miniboss | Wraith of the Shifting Sands | 1 |
| 6 | Templateboss | Wraith of the Grey City | 2 |

### 6.3.1 Wraith Boss Mechanics

Both Prologue bosses are floating wraiths sharing one base moveset - the Templateboss expands it rather than replacing it, following the Miniboss->Templateboss throughline in 6.2.

**Shared base (Miniboss & Templateboss):**

- Floats along a vertical patrol path within the arena (top to bottom, back and forth).
- Fires a horizontal beam while moving, after a short visible windup - no instant/unreactable hits.
- After firing, the wraith lands and pauses briefly: a vulnerability window where it takes double damage from melee/ranged hits, before resuming its patrol.
- Arena layout combines horizontal platforms (stacked floors, same one-way layout as regular levels) with vertical wall segments (the `walls` collision layer, see [10_technical-architecture.md](10_technical-architecture.md)) that block the beam - giving the player a real safe spot to duck into rather than a pure reaction-time check.
- Phase 1 (above 50% HP): base speed and attack cadence. Phase 2 (50% HP and below): enrage - the same moveset repeats faster (shorter windup/cooldown), no new attack type added, keeping the fight within the Miniboss's "1-2 phases, simple mechanic" scope (6.2).

**Templateboss-only additions (Wraith of the Grey City):**

- Adds a vertical beam as an alternative to the horizontal one - either/or per attack, never both at once, so the read stays "which beam is coming" instead of a compounded pattern.
- During its landed vulnerability window, the wraith can also switch which side of itself is exposed (telegraphed the same way as the beam), forcing the player to reposition instead of punishing from a fixed spot.
- Enrage phase (50% HP and below) additionally increases how often it alternates between the horizontal and vertical beam, making the pattern harder to predict rather than just faster.

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
| Patroller | 30 | 10 | 3 | 20 |
| Sentinel | 35 | 10 | 4 | 20 |
| Charger (Zone 2+) | 25 | 10 (20 while mid-charge) | 3 | 20 (10 if repeatedly caught mid-charge) |
| Shooter (Zone 3+) | 20 | 10 | 2 | 20 |

Revised this session: contact/projectile damage unified to 10 across every type (previously 8-10) - Sentinel and Shooter both compensate for the higher damage with more HP (Sentinel's own HP also reflects it being stationary and never chased down), landing every type at the same 20-hit baseline for how long a player can tank isolated hits.

Zone 3 "stronger variants" (see [02_game-structure.md](02_game-structure.md) 2.4): +50% to HP and damage.

### Bosses

| Tier | HP | Signature Hit Damage | Player hits until boss dead (approx.) |
|---|---|---|---|
| Miniboss | 300 | 40 | ~30 |
| Templateboss | 400 | 70 | ~40 |
| Chapterboss | 500 | 100 (= Normal Boss-Hit from 5.3) | ~50 |

Revised from an earlier 150/250/400 draft (session playtesting: 150 read as
weaker than the player's own ~200 Health+Shield pool, which shouldn't be true
for a boss) - a clean round 300/400/500 progression instead, keeping the
Miniboss meaningfully below the later tiers now that the gap is 100 HP per
tier rather than 100/150.
