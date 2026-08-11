# 4. Mechanics

## 4.1 Dynamic Color Mechanic

The central game mechanic. Color is not just visual but functional.

| State | Effect |
|---|---|
| Player moves through an area | The traversed area turns colorful and stays colorful permanently |
| Enemy crosses a colored area | The area turns back to dark |
| Boss defeated | The entire level turns colorful - color explosion |

Purely visual feature - no combat bonus for the player and no malus for enemies in colored zones. Color trail width around the player: fixed value, does not grow with progress.

**Exception - Templateboss/Chapterboss fights:** the color mechanic itself keeps working completely normally throughout the fight - the player still colors the ground by moving, same as anywhere else. The one difference: the instant the boss's own attack fires, the whole room snaps back to grey except a small safe pocket around the player, then normal coloring resumes until the next attack. See [05_enemies-bosses.md](05_enemies-bosses.md) 6.2.1 for the arena presentation this is part of, including a current-implementation note on how it plays out for the Prologue's Wraith fights specifically.

**Main Menu living background:** the demo scene behind the main menu (see [08_menu-flow.md](08_menu-flow.md)) uses the exact same permanent-reveal mode as real gameplay - the Guardian sprite walking across leaves a real, lasting color trail. It's a patrolling enemy crossing afterward that darkens it back, the same enemy-reverts-color rule as real gameplay - not a decorative fading effect. The whole thing just repeats in a loop for the menu.

## 4.2 Movement & Controls

| Ability | Availability | Controls |
|---|---|---|
| Run | Base | A/D (Desktop), Left/Right Button (Mobile) |
| Jump | Base | W / Spacebar (Desktop), Jump Button (Mobile) |
| Drop Through Platform | Base | S / Down Arrow (Desktop), Drop Button (Mobile) |
| Double Jump | Unlockable | Press Jump twice |
| Dash | Unlockable | Double-tap A or D |
| Wall Jump | Unlockable, only from Chap 2 | Jump off a wall |
| Slide + Attack | Unlockable | S + Attack |
| Air Attack | Unlockable | Attack while airborne |
| Swimming | Phase 2 / Optional | - |

Build status: only Double Jump and Dash exist in code so far (the guaranteed first two Merchant options, see 4.4). Wall Jump/Slide+Attack/Air Attack are designed but not yet implemented.

**AFK / idle-sleep animation:** if the Guardian stands still (grounded, not attacking) for 15 seconds with no input, it plays a one-shot enter-AFK animation followed by a looping sleep animation, reverting instantly to normal Idle the moment any input resumes - no separate wake-up animation (`entities/PlayerMovement.js`).

## 4.3 Combat System

The combat system is based on automatic distance calculation. On both Desktop and Mobile, an attack automatically targets the nearest enemy - Desktop's mouse click doesn't aim, it just triggers the attack the same way Mobile's Attack Button does. In both cases the game automatically decides the attack mode (melee vs. ranged) based on distance. Both modes are available from the start (already in the Prologue) - the dynamic melee/ranged decision is part of the Core Loop from minute one, see [01_core-gameplay-loop.md](01_core-gameplay-loop.md).

| Mode | Condition | Action |
|---|---|---|
| Melee | Enemy within threshold | Sword swing animation |
| Ranged | Enemy beyond threshold | Sword throw |

- Weapon: Energy Sword (Rainbow/Color) — not a carried item, but a manifestation of his energy, only appears during attack animations
- Desktop: mouse click (any direction - the game auto-targets the nearest enemy, same as Mobile)
- Mobile: Attack Button, automatic targeting of the nearest enemy
- Base power: 10 damage per melee hit; ranged throw deals half that (5) and is limited by a 2s cooldown instead of a resource cost
- Ranged throw is a single hit, not a boomerang - it doesn't return to the player
- Combos: Phase 2 / Optional

## 4.4 Ability System

Abilities are acquired exclusively through Tokens at the Merchant (see [02_game-structure.md](02_game-structure.md) 2.5). Tokens drop exclusively from Miniboss, Templateboss and Chapterboss - Secret Rooms do not contribute to this currency. An ability costs 2 Tokens.

Abilities are movement and combat upgrades - no elemental system. Double Jump and Dash are guaranteed first options at the Prologue Merchant, the remaining abilities are prioritized later.

## 4.5 Shield (Prisma)

In addition to health points (see [04_health-save-system.md](04_health-save-system.md), base value 100), the player has a second resource: the **Prisma** - a color barrier around the player, also with a base value of 100.

| State | Effect |
|---|---|
| Enemy touches the barrier | Enemy takes damage, Prisma weakens |
| Prisma fully depleted | Follow-up damage goes directly to health points |
| Health points at 0 | Death, restarts the level from the beginning (see [04_health-save-system.md](04_health-save-system.md) 5.1 - no mid-level checkpoint) |
| Over time | Prisma regenerates passively at 1 point/second (base value) - 50 points (1 Secret Room) take about 50 seconds from empty |
| Character buff (Secret Room) | One of three types per Secret Room found, cumulative: +20 Max Health, +20 Max Shield, or +0.5 Shield Regen/second |
| Opening a Secret Room | Costs 50 Prisma (no key item) - the player pays with their own color energy to bring more color back to the world. Fixed value for now, may later be balanced as a % of Max Prisma |

A Prisma-refill pickup (analogous to the planned Healthpacks, see [04_health-save-system.md](04_health-save-system.md) 5.1) is also wanted - not yet designed in detail (drop rates/values undecided) or implemented.
