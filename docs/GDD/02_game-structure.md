# 2. Game Structure

## 2.1 Worldmap

Between levels, the player is on a Worldmap. The Worldmap consists of nodes (level entry points) that are connected linearly - matching the fixed level order within a Template.

A permanent chapter bar sits at the top of the screen with up to 6 buttons: **Prologue, Chap 1, Chap 2, Chap 3, Chap 4, Epilogue**. At the start of the game only the Prologue button is active, the others are greyed out with a "Coming Soon" label and unlock once the previous chapter is completed. Details on the menu flow in [08_menu-flow.md](08_menu-flow.md).

The Worldmap plays into the color mechanic: defeated levels and their connecting paths turn colorful on the Worldmap - the Darkness is visibly pushed back.

**Leaving a level**: every level has an exit portal/level end (in boss levels, directly next to the Merchant). Interacting with it ("[E] / Tap") brings the player back to the Worldmap - only there does the respective node and the surrounding path turn colorful, separate from the in-level color explosion during boss fights.

## 2.2 Template System

The central structural unit is the **Template** - a self-contained block of levels with its own Miniboss and its own Templateboss.

| Element | Details |
|---|---|
| Scope | 6-7 levels per Template |
| Boss allocation | Exactly 1 Miniboss + 1 Templateboss per Template |
| Theme | The Miniboss introduces an ability/mechanic in simple form, the Templateboss expands or combines it - each Template gets its own throughline |

### 2.2.1 Boss Hierarchy

| Tier | When | Effort |
|---|---|---|
| Miniboss | Middle of every Template | Simple mechanic, no dedicated boss state |
| Templateboss | End of every Template | Own mechanic, expands on the Miniboss theme, no dramatic state change yet |
| Chapterboss | End of the **last** Template of a Chapter | Full state change, individual mechanic, dramatic entrance (see [05_enemies-bosses.md](05_enemies-bosses.md)) |

The Chapterboss is therefore not a fourth tier, but the special edition of the Templateboss at the end of a Chapter.

### 2.2.2 Number of Templates per Chapter

| Chapter | Number of Templates |
|---|---|
| Prologue | 1 |
| Chap 1 | 3 |
| Chap 2–4 | variable, 3-5+ (decided fresh per chapter) |
| Epilogue | 1 (final confrontation) |

## 2.3 Level Types

### 2.3.1 Flavor Types

Each individual level slot additionally gets a narrative/gameplay flavor. The types are mixed within a Template.

| Type | Description |
|---|---|
| Tutorial | Introduce a mechanic, low difficulty |
| Exploration | Large map, branches, focus on Secret Room |
| Combat | High enemy density, combat in the foreground |
| Platform | Skill-based navigation, few enemies |
| Gimmick | An unexpected rule that only applies in this level |
| Pre-Boss | Short, intense, narrative build-up |

### 2.3.2 Template Slots

Each Template must fulfill the following slot quotas (sum 6-7):

| Slot | Amount | Maps to Flavor Types |
|---|---|---|
| Combat-Lvl | 1-3 | Tutorial, Exploration, Combat, Platform, Pre-Boss |
| Secret-Lvl | 1-2 | Exploration focused on a Secret Room |
| Boss-Lvl | exactly 2 | Miniboss + Templateboss/Chapterboss |
| Special-Lvl | 1-2 | Gimmick |

## 2.4 Enemy Escalation

New enemy types only appear from certain zones onward - not everything from the start. English names see [05_enemies-bosses.md](05_enemies-bosses.md).

| Zone | New Enemies |
|---|---|
| Zone 1 | Patroller, basic Sentinel |
| Zone 2 | Charger |
| Zone 3 | Shooter, stronger variants of all types |

"Stronger variants" are the same sprites with a different color (re-tint) plus higher stats from [05_enemies-bosses.md](05_enemies-bosses.md) 6.5 - no new enemy assets, to save art budget.

**Prologue-only v1 note**: this pacing was designed to span Prologue + Chap 1. With v1 cut to Prologue only (see [11_scope-milestones.md](11_scope-milestones.md) 12.1), all 4 base types are introduced within the Prologue's own first 2 levels instead (see 2.6) - the Zone 2/3 pacing above and "stronger variants" remain Phase 2/Chap 1 territory. Balance impact of the earlier introduction not yet playtested (see `TODO.md`).

## 2.5 Secret Rooms & Token Economy

A Secret Room is only visible once the player has colored the surrounding area. Not every level has a Secret Room. Costs 50 Shield/Prisma to open (see [03_mechanics.md](03_mechanics.md) 4.5) - the player pays with their own color energy to bring more color back to the world. Fixed value for now, may later be balanced as a % of Max Prisma.

The Prisma paywall makes opening one a real trade-off (power now vs. power later), rewarding 1 permanent character buff per Secret Room found. (A free/low-cost lore-only variant was considered and cut for scope - see `_ideas-inbox.md`.)

| Source | Reward |
|---|---|
| Secret Room | 1 permanent character buff (e.g. +Max Health, +Shield Regen, +Shield Max) |
| Miniboss | 1 Token |
| Templateboss | 2 Tokens |
| Chapterboss | 2 Tokens (same as Templateboss, same tier slot) |

Tokens are the sole currency at the Merchant, who appears after every Templateboss/Chapterboss. Abilities cost 2 Tokens. Secret Rooms do **not** contribute to the Token economy - they're a completely separate reward track for permanent stat upgrades.

Tokens carry over across chapters and are never lost or reset - if more Tokens exist than there are currently purchasable abilities (e.g. because Wall Jump is only available from Chap 2 onward, see [03_mechanics.md](03_mechanics.md) 4.2), they're automatically carried into the next chapter.

**Example calculation:**
- Prologue (1 Template): 1 (Miniboss) + 2 (Templateboss) = 3 Tokens → 1 ability purchasable, 1 Token left over
- Chap 1 (3 Templates at 3 Tokens each): 9 Tokens + 3 from the Prologue = 12 Tokens total → roughly 6 abilities across Prologue + Chap 1

## 2.6 Prologue - "The Awakening"

Story: The Darkness devours the world. Just before it buries everything beneath it, a Guardian appears on a remote beach in an explosion of color and pushes it back — he knows only his duty, not his origin. He moves through the adjacent forest toward a distant city, its outline visible on the horizon.

1 Template, 6 levels:

| Lvl | Slot | Content |
|---|---|---|
| 1 | Combat (Tutorial) | Introduce running, jumping, dropping through platforms, melee combat; Patroller and Charger introduced |
| 2 | Combat (Tutorial) | Introduce ranged combat (sword throw); Shooter and Sentinel introduced |
| 3 | Boss (Miniboss) | First Miniboss, introduces first boss theme → 1 Token |
| 4 | Special | A trapdoor leads to a random underground level |
| 5 | Secret | Secret Room, easy to find → first character buff |
| 6 | Boss (Templateboss) | Boss at the city → 2 Tokens, Merchant appears, first ability purchasable |

After Lvl 6: a short cutscene with the first story fragment, then Chap 1 opens on the Worldmap.

## 2.7 Chapter 1 - "The Awoken"

Story: The Guardian reaches the outskirts of the city, fights his way inward and then through the surrounding land - until he stands at the edge of the forest and recognizes the scale of the Darkness across the entire kingdom. He still knows nothing about his own origin at this point — that only comes together over the following chapters and the Epilogue.

3 Templates, 20 levels total.

### Template 1 - "The Grey City"
Surface. Sprawling. Decayed streets, buildings, squares. Enemies: Patroller, Sentinel.

| Lvl | Slot | Content |
|---|---|---|
| 1 | Combat | First Patrollers, combat system in a new setting |
| 2 | Combat | More enemies, first Sentinels |
| 3 | Secret | Exploration, first Secret Room of the chapter |
| 4 | Boss (Miniboss) | **The Gatebreaker** → 1 Token |
| 5 | Special | Level almost completely dark - only the color radius lights it |
| 6 | Combat | Higher enemy density, build-up to the Templateboss |
| 7 | Boss (Templateboss) | **Ashlord of the City** → 2 Tokens, Merchant appears |

### Template 2 - "The Sewers"
Underground. Tight. Wet. More dangerous. Enemies: Patroller, Charger, Sentinel.

| Lvl | Slot | Content |
|---|---|---|
| 1 | Combat | New zone, Charger introduced |
| 2 | Secret | Secret Room, branching layout |
| 3 | Boss (Miniboss) | **The Sludge Colossus** → 1 Token |
| 4 | Special | Rising water forces the player to rush upward |
| 5 | Combat | Pre-Boss, short and intense |
| 6 | Boss (Templateboss) | **The Flood Lord** → 2 Tokens, Merchant appears |

### Template 3 - "The Black Forest"
Outside the city. Sprawling. Dark. Threatening. Enemies: all types, Shooter new.

| Lvl | Slot | Content |
|---|---|---|
| 1 | Combat | Forest's edge, Shooter introduced, sprawling |
| 2 | Combat | Dense forest, all enemy types at once |
| 3 | Secret | Deepest point of the forest, last Secret Room, story fragment |
| 4 | Boss (Miniboss) | **The Thorn Colossus** → 1 Token |
| 5 | Special | Thick fog - only the color radius shows safe paths |
| 6 | Combat | Clearing, short build-up, cutscene preparation |
| 7 | Boss (Chapterboss) | **Forest Spirit of Darkness** → 2 Tokens, Merchant appears |

Closing cutscene: the Guardian steps out of the forest - the entire kingdom lies in Darkness. End of Chap 1, cliffhanger.

## 2.8 Planned Chapters - World Geography

| Chapter | Theme | Zones |
|---|---|---|
| Prologue | Awakening | Beach → Forest |
| Chap 1 | Introduction | City → Sewers → Black Forest |
| Chap 2 | Escalation | Plains → Desert → next City |
| Chap 3 | Escalation (Peak) | Coast → Port City → Sea with Islands |
| Chap 4 | open | - |
| Epilogue | Final Confrontation & Conclusion | - |
