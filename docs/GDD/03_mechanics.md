# 4. Mechanics

## 4.1 Dynamic Color Mechanic

The central game mechanic. Color is not just visual but functional.

| State | Effect |
|---|---|
| Player moves through an area | The traversed area turns colorful and stays colorful permanently |
| Enemy crosses a colored area | The area turns back to grey |
| Boss defeated | The entire level turns colorful - color explosion |

Purely visual feature - no combat bonus for the player and no malus for enemies in colored zones. Color trail width around the player: fixed value, does not grow with progress.

**Exception - Templateboss/Chapterboss fights:** the color mechanic is fully suspended for the duration of the fight (no new colored ground, no reverting either) - see [05_enemies-bosses.md](05_enemies-bosses.md) 6.2.1 for the arena presentation this enables.

**Exception - Main Menu living background:** the demo scene behind the main menu (see [08_menu-flow.md](08_menu-flow.md)) reuses the same color-reveal technique in a decorative, non-permanent mode - the reveal follows the character as a fading bubble that dissolves back to grey after a few seconds, instead of staying colorful forever. Presentation choice for the menu only, not representative of real gameplay behavior.

## 4.2 Movement & Controls

| Ability | Availability | Controls |
|---|---|---|
| Run | Base | A/D (Desktop), Left/Right Button (Mobile) |
| Jump | Base | W / Spacebar (Desktop), Jump Button (Mobile) |
| Duck | Base | S (Desktop), Duck Button (Mobile) |
| Double Jump | Unlockable | Press Jump twice |
| Dash | Unlockable | Double-tap A or D |
| Wall Jump | Unlockable, only from Chap 2 | Jump off a wall |
| Slide + Attack | Unlockable | S + Attack |
| Air Attack | Unlockable | Attack while airborne |
| Swimming | Phase 2 / Optional | - |

## 4.3 Combat System

The combat system is based on automatic distance calculation. On Desktop the player clicks in the direction of the enemy, on Mobile they press the Attack Button (automatic targeting of the nearest enemy, no manual aiming) - in both cases the game automatically decides the attack mode. Both modes are available from the start (already in the Prologue) - the dynamic melee/ranged decision is part of the Core Loop from minute one, see [01_core-gameplay-loop.md](01_core-gameplay-loop.md).

| Mode | Condition | Action |
|---|---|---|
| Melee | Enemy within threshold | Sword swing animation |
| Ranged | Enemy beyond threshold | Sword throw (boomerang) |

- Weapon: Energy Sword (Rainbow/Color) — not a carried item, but a manifestation of his energy, only appears during attack animations
- Desktop: mouse click in the direction of the enemy
- Mobile: Attack Button, automatic targeting of the nearest enemy
- Base power: 10 damage per hit, uniform for melee and ranged (no separate balancing variable)
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
| Health points at 0 | Death, back to the last checkpoint |
| Over time | Prisma regenerates passively at 1 point/second (base value) - 50 points (1 Secret Room) take about 50 seconds from empty |
| Character buff (Secret Room) | One of three types per Secret Room found, cumulative: +10 Max Health, +10 Max Shield, or +1 Shield Regen/second |
| Opening a Secret Room | Costs 50 Prisma (no key item) - the player pays with their own color energy to bring more color back to the world. Fixed value for now, may later be balanced as a % of Max Prisma |
