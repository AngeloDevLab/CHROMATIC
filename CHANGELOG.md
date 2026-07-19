# Changelog

All notable changes to CHROMATIC, loosely following [Keep a Changelog](https://keepachangelog.com/). Versions here are development milestones, not published releases (no npm/package.json) - `docs/GDD/11_scope-milestones.md` 12.1 defines **v1.0** as the complete Prologue + Chap 1; everything below 1.0 tracks progress toward that.

## [Unreleased]

## [0.8.0] - 2026-07-19

### Added
- Real player death animation (`dead.png`) plays out before the ghost-rise sequence starts, instead of cutting straight to the ghost.
- Patroller now has real sprite art (walking/idle plus its own death animation) instead of the placeholder Maggot, which is fully removed from the project (assets, code, manifest entries).
- Charger enemy: patrols like a Patroller until the player is spotted nearby on roughly the same floor, then rushes at higher speed with its own charge sprite; has a cooldown between rushes and deals double contact damage to the player without hurting itself while charging.
- Ghost-trail effect behind the thrown sword as it flies (`thrown_sword_trail.png`), spaced and rotated to stay in sync with the blade's own spin.
- Level-end portal: a Tiled `ExitPortal` object that starts locked, plays an opening animation once every enemy in the level is dead, and can be used via `[E]` in range to return to the Worldmap with that level marked completed.
- Worldmap nodes show a "completed" overlay badge now, same treatment as the existing "locked" padlock, instead of swapping the whole button image.
- Lv_2 exported and wired up; level loading is generic by level number now instead of hardcoded to Lv_1.

### Changed
- Thrown sword render/hitbox size now matches its actual sprite resolution (32x64) instead of a smaller placeholder size.
- Enemy/player knockback speed reduced slightly.
- Right-click over the canvas no longer opens the browser's context menu (reserved for a planned gameplay use).

### Fixed
- A held movement key left the player walking on its own indefinitely if the window/tab lost focus before the key was released (the browser never sends that `keyup`) - held keys now reset on blur/tab-hide.
- Player and enemy death animations rendered permanently white-tinted from the killing blow's hit-flash, since the flash timer stopped ticking down once dead.
- Charger's charge cooldown could be silently bypassed - a hit's knockback stun left it still "charging" underneath, so it resumed rushing the instant the stun ended instead of waiting out the cooldown.
- Charger's passive Prisma contact damage was killing it off its own charges (25 HP / 10 contact damage = dead in 3 touches) - it no longer takes that self-damage while charging.
- Worldmap level-lock/completion checks compared against the wrong index (array position vs. the actual level number) - would have kept every level beyond the first permanently locked once completions started being tracked.

## [0.7.0] - 2026-07-19

### Added
- Fall-into-pit death: crossing a kill plane below the level's bottom edge now kills the player instead of letting them fall forever while still controlling mid-air.
- Jump feel pass: coyote time (jump still available briefly after walking off a ledge), jump buffering (a press slightly before landing still fires once grounded), and variable jump height (releasing the key early cuts the ascent short instead of always reaching full height).
- Movement feel pass: horizontal velocity now ramps toward its target instead of snapping instantly, for a touch of weight on starting/stopping.
- Combat feel pass: a brief hit-stop freezes gameplay for a beat on any landed hit (melee or contact), and both hit types now knock player and enemy apart briefly instead of damage being purely a number.
- Ranged attack (sword throw): attacking an enemy beyond melee reach now throws a projectile instead of whiffing - auto-targets the nearest enemy, same swing animation/timing as melee, swept wall-collision so it can't tunnel through thin walls at high speed. `thrown_sword.png` was already in the project but unused until now.

### Changed
- Jump now requires a fresh key press instead of re-triggering every frame the jump key is held while grounded - removes an unintended auto-bunny-hop.
- `jumpSpeed` raised from 360 to 379 (~10px more apex height) as safety margin on top of the fixed-timestep fix below.
- Gameplay updates now run on a fixed 1/60s timestep via an accumulator in the main loop, instead of directly on the actual per-frame `dt` - decouples every velocity-based motion (jump arcs, movement, gravity) from the display's refresh rate/frame timing.

### Fixed
- Jump apex differing between machines/browsers - root-caused to the previous variable-timestep integration being step-size sensitive (see the fixed-timestep change above); the earlier `dt` clamp had only been a partial/preventive fix.
- Player death sequence: the ghost's rise-and-fade now stays pinned to the visible bottom edge of the screen when the actual death position is off-screen (e.g. after falling into a pit), instead of playing invisibly below the camera's own clamp.

## [0.6.0] - 2026-07-18

### Added
- Player invincibility frames after taking damage, independent of any single enemy's own contact cooldown - stops multiple overlapping enemies (or one lingering enemy) from stacking damage every frame.
- Hit-flash (white tint) on enemy/player damage, done via canvas compositing on a scratch canvas rather than baked into sprite frames.
- Difficulty now actually affects incoming damage (Easy -50%, Hard +100%) - previously selected but never read anywhere. Stated directly in the difficulty selection panel's descriptions.
- Player death sequence: the screen fully darkens (inverse of the victory color-explosion) while a ghost sprite rises from the death spot and fades out, then a Game Over panel offers Retry/Main Menu.
- Enemy death now reveals color back at the spot it had been darkening while patrolling (plus a bit more), instead of just leaving a dark patch behind.
- Pause menu (Escape) and the Game Over panel share the same overlay `Panel` component and option-list styling - no separate PauseState/GameOverState, just a paused flag and a panel on top of the frozen game screen.

### Changed
- Attack no longer roots the player in place while airborne - it only locks horizontal movement while grounded, so momentum and direction changes keep working normally mid-air during a swing.
- Maggot (Patroller) contact damage raised from 5 to 10, so the difficulty multiplier's effect is actually noticeable during a hit.
- Easy difficulty multiplier changed from ×0.66 to ×0.5 for cleaner, easier-to-state round numbers (-50%/+100%).
- GDD: Secret Rooms split into Buff-Secret (Prisma cost, rare, permanent stat buff) and Lore-Secret (free/cheap, more frequent, story only); documented Terminal/Letters/Environmental as the three lore-delivery devices; parked "custom Secret Room enemies" and "minigame/terminal puzzles" as rejected-for-v1 ideas in `_ideas-inbox.md`.

### Fixed
- `dt` clamped to a 50ms max in the render loop, guarding against a stutter/GC pause/tab-switch producing one huge oversized physics step.
- Cutscene text outline now uses a `text-shadow` stack instead of relying solely on `-webkit-text-stroke`, fixing missing outlines outside Chromium.
- Attack animation firing immediately on entering/retrying a level, from a stale click queued up while navigating the Worldmap background (the canvas-scoped mousedown listener still catches background clicks there).
- A dead player ("ghost") no longer keeps dealing contact damage to enemies it happens to be overlapping at its frozen death position.
- A colored hole no longer punches through at the death spot right after the death sequence's full-darken effect finishes.

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
