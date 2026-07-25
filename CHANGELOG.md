# Changelog

All notable changes to CHROMATIC, loosely following [Keep a Changelog](https://keepachangelog.com/). Versions here are development milestones, not published releases (no npm/package.json) - `docs/GDD/11_scope-milestones.md` 12.1 defines **v1.0** as the complete Prologue (Chap 1 moved to Phase 2/Optional, see 0.4.4 below); everything below 1.0 tracks progress toward that. Track actual completion via `docs/GDD/11_scope-milestones.md` 12.4, not this version number - it counts shipped increments, not % of scope done.

Version numbers below were rescaled on 2026-07-22 (previously 0.1.0-0.8.3) to leave realistic room before 1.0 given the Prologue-only scope cut above. No functional/code change, renumbering only.

## [Unreleased]

## [0.6.2] - 2026-07-25

### Added
- Secret Room (Lvl 5 Gimmick, `docs/GDD/02_game-structure.md` 2.5): `SecretDoor` (closed/opening/open, costs 50 Prisma to open, physically blocks the path while closed) leads to `BuffTerminal`, which opens a dismissible 3-way buff-choice panel (+20 Max Health / +0.5 Shield Regen per sec / +20 Max Shield). Chosen buffs persist across level reloads/retries via `Game.buffs`, reapplied to every fresh `Player` instance through `Player.applyBuff()`.
- Multi-tileset level support: `Level.js` now resolves each tile's gid against whichever of a level's tilesets it actually belongs to, via a small shared registry (`world/TilesetRegistry.js`) mapping each Tiled tileset's basename to its image + column count. Lvl 5 mixes three tilesets (grass/gravel/scifilab) with different column counts, which the previous approach (stitching same-width images into one, added for Lvl 4) couldn't have handled correctly.
- `Panel.js`: `onClose` callback (fires however a panel closes - an explicit choice or a dismissal) and `closeOnEscape` (independent of `dismissible`) - needed so the buff-choice panel can be dismissible by backdrop/× without competing with `GameState`'s own Escape/Pause handling reacting to the same keypress.
- Lvl 5 registered and reachable.

### Fixed
- Escape while the Merchant dialogue or buff-choice panel was open used to open Pause on top of/instead of it, leaving that modal's own "is open" flag stuck true forever once Resume closed the Pause panel over it - permanently freezing gameplay. Escape is now routed correctly depending on what's currently open.
- A closed `SecretDoor` didn't block movement (unlike a real gate) - the player could just walk straight into the Secret Room without ever paying the Prisma cost.

## [0.6.1] - 2026-07-25

### Added
- Lvl 4 (Prologue Gimmick, docs/GDD/02_game-structure.md 2.6): a wall funnels the player into a trapdoor (`entities/Trapdoor.js`) that breaks away underfoot and drops them into the level's own cave-interior section - purely narrative "random underground level" framing, one fixed level, no real level-switch. The fall itself is just a real gap in the `terrain` layer; the trapdoor is a closed -> opening -> gone visual cue on top, participating in the color mechanic (grey until revealed) the same way `Portal.js` does.
- `AssetLoader.composeTileset()`: stitches multiple Tiled tileset images into one combined image matching Tiled's own global gid numbering, so a level can paint with more than one tileset (Lv_4 mixes the shared grass tileset with a new gravel one) without `Level.js` needing to know about multiple images or gid ranges at all.
- Lvl 4 registered and reachable (`GameState.js`'s `LEVEL_JSON_KEYS`/`LEVEL_TILESET_KEYS`, `LoadingState.js`'s manifest).

## [0.6.0] - 2026-07-25

### Added
- Dev Panel (`js/ui/DevPanel.js`, toggled with the Backquote key): level skip (1-6, automatically greys out levels not registered yet), hitbox overlay, godmode, and placeholder "Give Token"/"Give Ability" stubs for once the Token economy exists.
- Boss framework: `js/entities/Boss.js` (Entity -> Enemy -> Boss -> Templateboss hierarchy, see CLAUDE.md) adds the vulnerability-window double-damage multiplier, enrage/phase timing, and the non-square rendering a tall boss sheet needs (`Enemy.render()` assumes a square frame).
- Wraith of the Shifting Sands (Lvl 3 Miniboss, `js/entities/bosses/Wraith.js`): full state machine driven by its own 7 sprite clips (idle/toFiring/firing/toVulnerable/vulnerable/toIdle/dead) - rises to the arena's top edge, fires a horizontal beam that keeps tracking its position and re-checking `walls` collision the whole way back down (`js/entities/bosses/WraithBeam.js`), lands vulnerable to double damage, then walks to the arena's other fixed side before resuming the cycle. Firing also desaturates the whole boss room except a safe pocket around the player (`ColorZone.darkenAllExcept()`).
- Boss camera zoom-out (`Camera.js`'s new `zoom` parameter, `GameState.js`'s `BOSS_CAMERA_ZOOM`) - a deliberate deviation from the GDD's Templateboss-only arena presentation (05_enemies-bosses.md 6.2), applied to the Miniboss too this session.
- `Collision.isWallAt()`: walls-layer-only solidity check (excludes the one-way terrain layer), used by the Wraith's beam so it's only blocked by real cover, not platforms it happens to be flying past.
- Pre-Lvl-6 Merchant teaser (`js/entities/Merchant.js`, `js/ui/MerchantDialogue.js`): a `[E]`-interact NPC with a typewriter-revealed dialogue line teasing the Lvl 6 boss by name. No shop/Token interaction yet (that's Templateboss-only per the GDD) and no art yet, logic/trigger only.
- Lvl 3 registered and reachable (`GameState.js`'s `LEVEL_JSON_KEYS`, `LoadingState.js`'s manifest).

### Changed
- `HUD.renderEnemyBar()` no longer requires `referenceAnim` to show an HP bar - needed so a Boss subclass still on placeholder rendering (no animations wired in yet) still gives damage feedback while testing.
- `DamageNumbers.js` and the portal/Merchant interact prompts now account for `camera.zoom` when positioning their HTML overlay elements - previously computed as if zoom were always 1, so they'd have visibly drifted away from the entities they're anchored to during a boss fight.

### Fixed
- Dev Panel level-skip buttons kept DOM focus after being clicked - since Space is both the jump key and the browser's native "activate the focused button" key on keyup, releasing jump during gameplay kept re-firing the click and resetting the level back to spawn. Buttons now blur themselves right after use.

## [0.5.0] - 2026-07-22

### Added
- Sentinel enemy type: buried and harmless until the player enters its aggro range, then rises (visible in front of the terrain during the rise itself, unlike while still dormant/buried behind it - a telegraphed pop-up, not an instant invisible-to-dangerous cut) before settling into a stationary contact-damage threat. Never moves, no chase/reset logic.
- Shooter enemy type: holds position once it spots the player and fires projectiles from range instead of closing in. Its bolts can be destroyed by the player's melee swing or thrown sword before they land.
- Drop-Through-Platform (`Player.js`/`Collision.js`) replaces the placeholder Duck ability (no crouch art/movement-while-crouched was ever built for it, and wasn't worth building for this level layout) - S/Down now drops the player through the one-way platform they're standing on, but only if there's an actual floor to land on below. Not a naive check - correctly skips past the current platform's own multi-tile-thick mass first before looking for a genuine next floor, so it won't drop the player into a pit from the last platform above one.
- `walls` Tiled tile layer support (`Collision.js`): an optional second layer that's always fully solid in every direction, regardless of the primary terrain layer's one-way mode - lets specific ledge/corner tiles block sideways movement (fixing a corner-clip death reported during playtesting) without losing one-way behavior everywhere else. Lv_1/Lv_2 now have a few tiles painted into this layer.
- The level-end portal now participates in the color mechanic - greyed out like the rest of the world until the player gets close enough or the level's full-reveal fires, instead of always rendering in full color regardless of what's been revealed around it.
- Lv_3 exported, plus a new gravel tileset.

### Changed
- Charger's charge is no longer a homing chase - facing locks in at the start of a rush and it travels a fixed distance before stopping, so a dodge (sidestep, jump over) actually works instead of the charger endlessly re-tracking. Speed and detection range also retuned across a couple of passes this session.
- Enemies now render in front of the level-end portal (previously behind it).
- Each Prologue level now paints its own `background` Tiled tile layer on top of the shared forest backdrop every level bakes in (`GameState.js`) - e.g. the planned cave-interior Gimmick level can cover that shared backdrop entirely with its own art instead of it showing through. The earlier depth-parallax attempts (see 0.4.4) are fully superseded by authoring per-level overrides directly in Tiled instead.
- `docs/GDD/03_mechanics.md`/`07_ui-hud.md`/`10_technical-architecture.md`/`02_game-structure.md` updated throughout for Duck -> Drop Through Platform.

## [0.4.4] - 2026-07-22

### Changed
- v1 scope cut to Prologue-only (was Prologue + Chap 1) - Chap 1's ~18 remaining levels didn't fit the timeline. Chap 1 moves to Phase 2/Optional. See `docs/GDD/11_scope-milestones.md` 12.1-12.3.
- All 4 enemy types (Patroller, Charger, Shooter, Sentinel) now introduced within the Prologue itself (Lvl 1: Patroller + Charger, Lvl 2: Shooter + Sentinel), instead of Shooter/Sentinel waiting for Chap 1 - see `docs/GDD/02_game-structure.md` 2.4/2.6.
- Secret Rooms simplified back to a single type (permanent character buff only) - the Lore-Secret variant and its delivery devices (Terminal, Letters/Fragments, Environmental storytelling) were cut for scope, moved to `docs/GDD/_ideas-inbox.md`.
- Special Attack redesign concept (Ground/Air special via one contextual button) cut for scope, moved to `docs/GDD/_ideas-inbox.md`.
- Added a living v1 progress checklist (`docs/GDD/11_scope-milestones.md` 12.4) tracking actual completion against the scope list.

## [0.4.3] - 2026-07-22

### Added
- Ranged Sword Throw now costs 10 Prisma per throw - previously free, so it could be spammed indefinitely against an enemy sitting just out of melee range. A "No Prisma for Ranged Attack" popup appears over the player instead of throwing when there isn't enough.
- Asset-load failures during boot now show a visible red error message instead of hanging on "Loading..." forever with only a console error.

### Changed
- Charger's charge no longer breaks off from taking a sword/thrown-sword hit, or from the player jumping outside its line-of-sight height tolerance mid-rush - only running into a wall or actually connecting with the player's body still ends one early. Makes the low-HP Charger's rush read as a real commitment/punish instead of something a single graze or hop cancels.
- `GameState.js` split up for maintainability: enemy creation moved to `entities/EnemyFactory.js`, the death ghost-rise/fade sequence moved to `mechanics/DeathSequence.js`, and the Pause/Game Over panels now share one helper instead of near-duplicate markup.

### Fixed
- Melee-vs-ranged attack mode decision compared center-to-center distance instead of the actual gap between hitboxes - since enemies (64px) and the player (32px) aren't the same width, standing right next to an enemy could still register as "out of melee range" and fire a (now Prisma-costing) ranged throw instead of a free melee swing.

## [0.4.2] - 2026-07-20

### Changed
- ColorZone's enemy-darken and player-live-glow rendering now operate on small local patches instead of full canvas-sized buffers - `overlayCanvas`/`greyTemplateCanvas` are sized to the whole level, not the viewport, so darken() (running once per living enemy per frame) and the live-glow were doing roughly 10 full-level-sized clear+copy operations every frame regardless of camera position. A significant performance fix, reported as considerably better in Firefox/Edge, browsers that handle repeated full-surface canvas compositing noticeably worse than Chrome.
- Canvas display scaling now snaps to the nearest whole-number factor instead of an exact fractional fit, trading occasional letterboxing for cheaper/crisper nearest-neighbor upscaling - another lever for the same Firefox/Edge performance work above.

### Fixed
- A visible box/seam briefly appeared around the player's live-glow reveal circle after the patch-based rendering change above - the base overlay draw was covering the same area a moment before the "hole" was punched into it, a no-op composite that left the hole invisible; fixed by excluding that region from the base draw instead of double-compositing it.

## [0.4.1] - 2026-07-19

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

## [0.4.0] - 2026-07-19

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

## [0.3.1] - 2026-07-18

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

## [0.3.0] - 2026-07-16

### Added
- Main menu reworked into a living reveal/darken choreography: the player runs in from a random side leaving a permanent color trail, then a maggot follows and erases it, then it repeats.
- Player's color bubble is now immune to erosion from nearby enemy darkening (a live glow recomputed fresh every frame instead of accumulated onto the persistent overlay).
- Attack sheet frame size is now independent per animation (no longer forced square), resized to 150x96 for more swing room.

### Fixed
- Asset paths broken by tileset/level file renames (`tileset-grass` → `tileset_grass`, `main-menu.json` → `mainMenu.json`) that left the game stuck on the loading screen.

## [0.2.2] - 2026-07-15

### Fixed
- Attack firing immediately on entering GameState from a leftover UI click (mousedown is now scoped to the canvas instead of the whole window).
- Dead manifest entries still pointing at the removed physics-test placeholder assets.

## [0.2.1] - 2026-07-15

### Added
- Color mechanic wired into the real Prologue Level 1: permanent reveal trail, player clamped to the level's horizontal bounds.
- Maggot enemy: patrol AI (gravity + ledge/wall detection read directly from tile data, no per-level markers needed) and running animation.
- Melee attack: click-triggered swing animation state that locks movement for the swing's duration.
- Full combat system: enemy HP, player Health + Prisma/Shield (Shield absorbs damage first), melee hit detection with its own reach independent of the sword sprite, passive Prisma contact damage against enemies.
- HUD: Health/Shield bars, per-enemy HP bars, floating damage numbers.
- Enemies darken colored ground as they cross it; the whole level reveals in color once every enemy is defeated.
- `CLAUDE.md` project documentation for future dev sessions.

## [0.2.0] - 2026-07-14

### Added
- Full New Game flow: `CutsceneState` (intro), `WorldmapState` with level-select nodes, `GameState` with real player movement/collision.

## [0.1.1] - 2026-07-13

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
