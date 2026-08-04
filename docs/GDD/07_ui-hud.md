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
