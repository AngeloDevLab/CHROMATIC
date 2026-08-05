# CHROMATIC

> A 2D action platformer about contrast: Darkness versus color. A drained, desaturated world is reclaimed step by step through the player's movement.

A browser-based game built in vanilla JavaScript (HTML5 Canvas, OOP / ES Modules). Created as a personal project during a vocational training program, with a learning focus on clean object-oriented architecture.

---

## The Idea

Aeons ago, an advanced civilization created the **Guardians**: humanoid energy beings with power over color, built to push back a world-devouring Darkness. Now that Darkness reaches the game's world. Moments before everything sinks into Darkness, the last Guardian materializes on a distant beach, bringing color back with every step.

A medieval-fantasy surface with a sci-fi underpinning: beneath the forests and castles lie the remnants of an ancient network, and answers to who the Guardian really is.

## Core Mechanic

Color isn't just visual, it's the central mechanic:

- The player leaves a permanent color trail while moving, pushing the Darkness back.
- Enemies drain traversed areas back to dark.
- Defeating a boss triggers a level-wide color explosion.
- The worldmap fills with color as the player progresses.

Implemented with two Canvas layers using `destination-out` compositing, no duplicate asset set needed for grey/color.

## Current Status

The Prologue - v1's full scope - is playable start to finish: all 6 levels, both bosses, the full combat/color/shield/ability/token systems, touch and keyboard controls, and a LocalStorage save. Currently in a polish phase - playtesting and balancing, a closing cutscene, and a final legal review still ahead before release.

## Scope

Deliberately kept disciplined: v1 is a complete **Prologue** - 1 template, 6 levels, combat system, color mechanic, shield system, boss hierarchy, and token economy. Chapter 1 and beyond (3 more templates, ~20 levels) is intentionally out of scope for this project rather than an unfinished stretch goal - the Prologue proves the reusable system end to end, everything beyond it would be content scaling, not new architectural risk.

Targeted for 3–5 weeks (3 weeks full-time baseline, realistically 4–5 due to a training program running in parallel).

## Tech Stack

- **Rendering:** HTML5 Canvas, internal resolution 640×360, fractional window-fill scaling everywhere (no exceptions, avoids state-switch jumps and large letterbox bars) + fullscreen toggle (`image-rendering: pixelated`)
- **Language:** vanilla JavaScript, ES Modules, OOP with classes and inheritance
- **Architecture:** state-driven (LoadingState, MenuState, WorldmapState, GameState, BossState, …)
- **Level design:** Tiled, exported as JSON
- **Save system:** LocalStorage
- **Audio:** Web Audio API (GainNode hierarchy: Master → Music / SFX / Ambience)
- **Platforms:** desktop (keyboard/mouse) and mobile (touch), landscape

## Getting Started

No build step, no dependencies - it's static files loaded directly by the browser. Since it loads modules via `<script type="module">` and levels via `fetch()`, it needs to be served over HTTP rather than opened as a `file://` URL:

```bash
git clone https://github.com/AngeloDevLab/CHROMATIC.git
cd CHROMATIC
npx serve .
# or: python -m http.server
```

Then open the served `index.html` in your browser. Using VS Code instead? The [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension works too - no Node/Python needed, just right-click `index.html` → "Open with Live Server".

## Controls

| | Desktop | Mobile |
|---|---|---|
| Move | A/D or Left/Right arrows | directional buttons |
| Jump | W / spacebar / Up arrow | jump button |
| Drop through platform | S / Down arrow | drop button |
| Dash (once unlocked) | double-tap A or D | double-tap left/right |
| Attack | click | attack button (auto-targeting) |
| Interact | E | contextual on-screen prompt |
| Pause | P | pause button |

The game decides between melee and ranged attacks automatically based on distance to the enemy.

## Documentation

The full Game Design Document lives in [`docs/GDD/`](./docs/GDD): story, mechanics, balancing, technical architecture, and milestones.

## Project Context

A personal project within a vocational training program. The primary learning goal is the clean implementation of OOP and JavaScript classes; the game itself is the use case that makes those concepts concrete.

## License

[MIT](./LICENSE)
