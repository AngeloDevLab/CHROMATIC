# 8. UI & HUD

| Element | Position | Details |
|---|---|---|
| Health Bar | Top left | Numeric health bar, see [04_health-save-system.md](04_health-save-system.md) 5.1. Bar is Canvas, the number is an HTML overlay element - see [10_technical-architecture.md](10_technical-architecture.md) 11.8.1 |
| Prisma Bar | Top left, directly below Health Bar | Shield display, see [03_mechanics.md](03_mechanics.md) 4.5. Same Canvas-bar + HTML-number split as the Health Bar |
| Token Counter | Top left, directly below Prisma Bar | Icon + running Token count, HTML overlay text |
| Chapter/Level | Top right | Designed, not yet implemented |
| Boss HP Bar | Top center | Large, dramatic - only during boss fights. Canvas bar, HTML number |
| Ability Popup | Center of screen | On unlock + short tutorial, HTML overlay. Designed, not yet implemented |
| Left/Right Button | Bottom left | Mobile only, HTML buttons (touch hit-testing/press states) |
| Jump/Attack/Drop Button | Bottom right, diagonal thumb-arc | Mobile only, HTML buttons - attack has auto-targeting of the nearest enemy |

No score. Progress is measured through colored areas, defeated bosses, and chapter status.

## 8.1 How to Play Page

A single static page, not a series of triggered in-level popups and not paginated cards - written sections, no preview animations or other art. Reachable two ways, both opening the same panel/content: an "Info" entry from the Main Menu, and an entry from the Pause menu. No separate live HUD button during a run - Pause is already one keypress away, so a second, always-visible entry point would be redundant.

Four sections, each a heading plus a couple of sentences:

| # | Section | Covers |
|---|---|---|
| 1 | The Color Trail | The core mechanic: moving permanently reclaims the ground you walk over |
| 2 | Movement | A/D or arrow keys to move, Space/W/up arrow to jump, S/down arrow to drop through a one-way platform while standing on it |
| 3 | Combat | Click to attack; melee up close, thrown automatically at range - the game switches based on distance, no separate button |
| 4 | Levels | Levels vary: Combat, Secret Rooms, Gimmicks, and Boss fights |

Explicitly out of scope: per-level trigger popups placed in Tiled levels, and preview animations/art of any kind (sprite loops, GIFs, recorded clips - all considered at various points). Dropped in favor of plain written sections - simpler to build and maintain, at the cost of not teaching anything contextually in the moment it's first needed.
