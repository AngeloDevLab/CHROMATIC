# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CHROMATIC is a 2D action platformer built in vanilla JavaScript (HTML5 Canvas, ES Modules, OOP with classes/inheritance). No frameworks, no bundler, no `package.json` — the entire game is static files loaded directly by the browser as ES modules.

Core mechanic: the player leaves a permanent color trail while moving, reclaiming a desaturated world. Implemented via two canvas layers composited with `destination-out` (see `js/mechanics/ColorZone.js`) rather than a duplicate grey/color asset set.

Full design context (story, mechanics, balancing, technical architecture, milestones) lives in `docs/GDD/`. `docs/GDD/10_technical-architecture.md` is the authoritative technical reference — read it before making architecture-level decisions (resolution/scaling rules, Tiled level conventions, HTML-vs-canvas UI boundary, collision one-way rules, etc.); the summary below only hits the parts needed to navigate the code.

## Running the game

There is no build step. Since the game loads modules via `<script type="module">` and levels via `fetch()`, it must be served over HTTP, not opened as a `file://` URL. Serve the repo root with any static server, e.g.:

```
npx serve .
# or
python -m http.server
```

Then open the served `index.html`. There is no test suite, linter, or build/watch command in this repo.

## Architecture

**Boot sequence** (`js/main.js`): creates a single `Game` instance, attaches `AssetLoader`/`InputHandler`, registers all `State` instances with the `StateMachine`, then switches to `'loading'` and starts the render loop.

**Core loop** (`js/core/Game.js` + `js/core/StateMachine.js`): `Game` owns the canvas/overlay/viewport DOM refs and runs a `requestAnimationFrame` loop that calls `stateMachine.update(dt)` then `stateMachine.render(ctx)`. `StateMachine` just holds a `Map` of named `State` instances and delegates to whichever is `current` — states are registered once at boot and switched via `change(name, ...args)`, not recreated.

**States** (`js/states/`, base class `State.js`): one class per screen — `LoadingState`, `MenuState`, `CutsceneState`, `WorldmapState`, `GameState` (more planned per the GDD: `PauseState`, `BossState`, `BuffState`, `GameOverState`). Each owns its own entities/level/camera and is fully torn down/rebuilt on `enter()`/`exit()` — no persistent world state outside a state.

**Entities** (`js/entities/`): `Entity` (base: position/size/velocity, `update`/`render`) → `Player`, and → `Enemy` → specific enemy types (`entities/enemies/`, e.g. Patroller/Charger/Shooter/Sentinel — not all implemented yet) → `Boss` → `Templateboss` (`entities/bosses/`). Player abilities (double jump, dash, wall jump) are composition, not inheritance — attached to `Player` as separate `Ability` instances, not subclasses.

**Collision** (`js/utils/Collision.js`): resolves entity movement against a named tile layer, axis-by-axis (X then Y) so diagonal movement into a corner isn't blocked by both axes at once. Supports an `oneWay` mode (platforms only block when landed on from above) used by default for the stacked-floor level layout — set `oneWay: false` per-level for real solid walls. The collision layer name is passed in explicitly per level rather than hardcoded, since it isn't consistently named across Tiled exports.

**Levels** (`js/world/Level.js`): loads Tiled JSON exports (via `AssetLoader`, not XML/TMX) and separates `tilelayer`s (rendered by name/order) from `objectgroup`s (flattened into `{ type, x, y, properties }` markers — `PlayerStart`, `EnemySpawn`, `Door`, etc. — that states use to spawn entities). `getTileTopPadding`/`findGroundSurfaceY` account for tile art that doesn't fill its full 32×32 cell, so entities ground on the visible surface rather than the raw grid line.

**Rendering/scaling**: internal canvas resolution is fixed at 640×360; display size scales fractionally to fill the window (`Game._handleResize`), the same formula in every state so the scale never jumps between states. `image-rendering: pixelated` keeps that scaling crisp. All interactive elements and all text (HUD numbers, menus, dialogue) render as HTML in `#ui-overlay`, scaled with the same transform as the canvas — the canvas itself is reserved for per-frame world/sprite rendering and non-text HUD bar fills. Don't add `fillText()` UI or canvas-drawn buttons; use the overlay.

**Assets** (`js/core/AssetLoader.js`): images and JSON are loaded independently by string key (`loadImage`/`loadJSON`/`loadManifest`) into two separate `Map`s, fetched via `getImage(key)`/`getJSON(key)` — no per-state manifest file convention has been established yet, states currently reference keys directly.
