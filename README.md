# CHROMATIC

> A 2D action platformer about contrast: grey versus color. A drained, desaturated world is reclaimed step by step through the player's movement.

A browser-based game built in vanilla JavaScript (HTML5 Canvas, OOP / ES Modules). Created as a personal project during a vocational training program — learning focus: clean object-oriented architecture.

---

## The Idea

Aeons ago, an advanced civilization created the **Guardians** — humanoid energy beings with power over color, built to push back a world-devouring Darkness. Now that Darkness reaches the game's world. Moments before everything sinks into grey, the last Guardian materializes on a distant beach — and brings color back with every step.

A medieval-fantasy surface with a sci-fi underpinning: beneath the forests and castles lie the remnants of an ancient network — and answers to who the Guardian really is.

## Core Mechanic

Color isn't just visual, it's the central mechanic:

- The player leaves a permanent color trail while moving — the grey world is pushed back.
- Enemies drain traversed areas back to grey.
- Defeating a boss triggers a level-wide color explosion.
- The worldmap fills with color as the player progresses.

Implemented with two Canvas layers using `destination-out` compositing — no duplicate asset set for grey/color.

## Current Status

Concept phase complete, implementation underway.

- [x] Game Design Document (complete, maintained iteratively)
- [x] Scope defined and bounded
- [x] Technical architecture planned (state machine, inheritance hierarchy, asset/level pipeline)
- [x] Foundation: game loop, state machine, canvas rendering, fullscreen window-fill scaling
- [x] Color-mechanic prototype (validated via the main menu's living background demo scene)
- [ ] Real player movement & input handling (desktop first)
- [ ] Prologue (6 levels)

## Scope

Deliberately kept disciplined:

- **Goal (v1):** a complete **Prologue** — 1 template, 6 levels, including combat system, color mechanic, shield system, boss hierarchy, and token economy.
- **Stretch goal:** Chapter 1 (3 templates, ~20 levels) — only if time remains after the Prologue.
- **Timeframe:** 3–5 weeks (3 weeks full-time baseline, realistically 4–5 due to the training running in parallel).

The Prologue proves the reusable system; everything beyond it is content scaling, not new architectural risk.

## Tech Stack

- **Rendering:** HTML5 Canvas, internal resolution 640×360, fractional window-fill scaling + fullscreen toggle (`image-rendering: pixelated`)
- **Language:** vanilla JavaScript, ES Modules, OOP with classes and inheritance
- **Architecture:** state-driven (LoadingState, MenuState, WorldmapState, GameState, BossState, …)
- **Level design:** Tiled, exported as JSON
- **Save system:** LocalStorage
- **Audio:** Web Audio API (GainNode hierarchy: Master → Music / SFX / Ambience)
- **Platforms:** desktop (keyboard/mouse) and mobile (touch), landscape

## Controls

| | Desktop | Mobile |
|---|---|---|
| Move | WASD / arrow keys | directional buttons |
| Jump | W / spacebar | jump button |
| Crouch | S / shift | crouch button |
| Attack | click toward enemy | attack button (auto-targeting) |
| Pause | ESC | pause button |

The game decides between melee and ranged attacks automatically based on distance to the enemy.

## Documentation

The full Game Design Document lives in [`docs/`](./docs) — story, mechanics, balancing, technical architecture, asset list, and milestones.

## Project Context

A personal project within a vocational training program. The primary learning goal is the clean implementation of OOP and JavaScript classes; the game itself is the use case that makes those concepts concrete.

## License

[MIT](./LICENSE)
