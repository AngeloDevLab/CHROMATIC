# Changelog

All notable changes to CHROMATIC, loosely following [Keep a Changelog](https://keepachangelog.com/). Versions here are development milestones, not published releases (no npm/package.json) - `docs/GDD/11_scope-milestones.md` 12.1 defines **v1.0** as the complete Prologue + Chap 1; everything below 1.0 tracks progress toward that.

## [Unreleased]

## [0.5.0] - 2026-07-16

### Added
- Main menu reworked into a living reveal/darken choreography: the player runs in from a random side leaving a permanent color trail, then a maggot follows and erases it, then it repeats.
- Player's color bubble is now immune to erosion from nearby enemy darkening (a live glow recomputed fresh every frame instead of accumulated onto the persistent overlay).
- Attack sheet frame size is now independent per animation (no longer forced square), resized to 150x96 for more swing room.

### Fixed
- Asset paths broken by tileset/level file renames (`tileset-grass` → `tileset_grass`, `main-menu.json` → `mainMenu.json`) that left the game stuck on the loading screen.

## [0.4.1] - 2026-07-15

### Fixed
- Attack firing immediately on entering GameState from a leftover UI click (mousedown is now scoped to the canvas instead of the whole window).
- Dead manifest entries still pointing at the removed physics-test placeholder assets.

## [0.4.0] - 2026-07-15

### Added
- Color mechanic wired into the real Prologue Level 1: permanent reveal trail, player clamped to the level's horizontal bounds.
- Maggot enemy: patrol AI (gravity + ledge/wall detection read directly from tile data, no per-level markers needed) and running animation.
- Melee attack: click-triggered swing animation state that locks movement for the swing's duration.
- Full combat system: enemy HP, player Health + Prisma/Shield (Shield absorbs damage first), melee hit detection with its own reach independent of the sword sprite, passive Prisma contact damage against enemies.
- HUD: Health/Shield bars, per-enemy HP bars, floating damage numbers.
- Enemies darken colored ground as they cross it; the whole level reveals in color once every enemy is defeated.
- `CLAUDE.md` project documentation for future dev sessions.

## [0.3.0] - 2026-07-14

### Added
- Full New Game flow: `CutsceneState` (intro), `WorldmapState` with level-select nodes, `GameState` with real player movement/collision.

## [0.2.0] - 2026-07-13

### Added
- Main menu buttons, panels (Settings/Info/Difficulty), favicon.
- Main menu visual polish: button layout, order, mood.

### Changed
- Narrative wording shifted from "grey" to "dark/Darkness" throughout the GDD.

## [0.1.0] - 2026-07-12

### Added
- Project skeleton: GDD, README, license.
- Engine foundation: game loop, `StateMachine`, `AssetLoader`, `InputHandler`, `LoadingState`.
- Main menu living-background prototype (color-reveal demo scene).
