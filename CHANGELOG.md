# Changelog

All notable changes to CHROMATIC, loosely following [Keep a Changelog](https://keepachangelog.com/). Versions here are development milestones, not published releases (no npm/package.json) - `docs/GDD/11_scope-milestones.md` 12.1 defines **v1.0** as the complete Prologue (Chap 1 moved to Phase 2/Optional, see 0.4.4 below); everything below 1.0 tracks progress toward that. Track actual completion via `docs/GDD/11_scope-milestones.md` 12.4, not this version number - it counts shipped increments, not % of scope done.

Version numbers below were rescaled on 2026-07-22 (previously 0.1.0-0.8.3) to leave realistic room before 1.0 given the Prologue-only scope cut above. No functional/code change, renumbering only.

## [0.17.2] - 2026-08-11

### Added
- Page background behind the game canvas/letterboxing (`html`/`body` in `style.css`): a solid dark fill (`#111318`, matching the loading screen's own canvas clear color) plus a small repeating pixel-art "ground" wave strip along the bottom, drawn as an inline SVG data URI - no new asset file.

## [0.17.1] - 2026-08-11

### Added
- Loading screen progress percentage (`LoadingState.js`): `AssetLoader.loadManifest()`/`SoundManager.loadManifest()` now take an optional `onItemLoaded` callback, fired once per finished asset, driving a `Loading... X%` label instead of a static message. Counted by asset count, not bytes, so it can still appear to stall briefly near the end while the largest OST files finish.

### Changed
- Loading time (playtested at roughly 180s of blocking load under a Slow 4G throttle): OST tracks re-encoded at a lower bitrate (31MB -> ~20MB total across the 9 files, no code change) and the loading screen no longer blocks on all 9 upfront - only `ost-00` (the first menu track) and SFX load before the menu appears, `ost-01`..`ost-08` load in the background afterward (new `LoadingState._loadBackgroundMusic()`), since `MusicPlaylist.js`'s sequential rotation doesn't need them for minutes anyway and `SoundManager.playMusic()` already no-ops quietly on a not-yet-loaded track. Cuts the blocking payload from ~30MB to ~16MB. Images/tilesets/level JSON still load eagerly; the remaining per-level lazy-load split stays tracked in `TODO.md`.

## [0.17.0] - 2026-08-11

### Added
- AFK/idle-sleep animation (`docs/GDD/03_mechanics.md` 4.2): after 15 seconds standing still, grounded, and not attacking, the Guardian plays a one-shot enter-AFK animation (`entities/CharacterAnimations.js`'s `afkEnter`) followed by a looping sleep animation (`afk`), reverting instantly back to normal idle on the next input rather than playing a wake-up transition. New `InputHandler.consumeActivity()` (peek-and-clear flag set by any key/mouse/touch input) feeds `PlayerMovement.js`'s new `_updateAfkTimer()`/`_resolveIdleAnimation()`. `afkEnter`/`afk` are a smaller 64x64 sheet than the other Guardian poses (96x96); `PlayerRenderer.js` extended its existing attack-only "scale from the pose's own detected bounds" path to cover both, with `afk` sharing `afkEnter`'s bounds specifically (rather than its own) to avoid a size pop at the enter-to-loop handoff, plus a small vertical alignment nudge that eases in 1px per `afkEnter` frame instead of applying all at once. Closes the "AFK/idle animation" `TODO.md` item (a reference-project-template checklist item, previously left as an open design question).

## [0.16.7] - 2026-08-10

### Changed
- Accessibility pass: no UI text under 16px anywhere (`style.css`) - previously a range of smaller sizes (10-14px) were used for the in-level HUD numbers (HP/Shield/Token), Settings rows, Merchant shop cards, Worldmap info card, chapter/cutscene-skip buttons, damage numbers/status messages, and the Dev Panel. Font-size is now 16px (or `calc(16px * var(--hud-scale))` where the element already scaled with boss-fight buffer size) across the board; icon/layout sizes around the now-bigger HUD numbers left as-is pending a visual check.
- How to Play's Combat section expanded with the two mechanics it previously left out: the thrown attack deals half of melee's damage and has a cooldown before it can fire again, and touching an enemy directly damages both sides, not just the enemy (`HowToPlayPanel.js`, `docs/GDD/07_ui-hud.md` 8.1 updated to match).

## [0.16.6] - 2026-08-10

### Fixed
- Enemy projectile hitbox (`ShooterProjectile.js`) read as oversized in playtesting - it used the full 64x64 sprite frame as its collision box, but `shooter-projectile.png`'s actual spinning-dot art only fills a fraction of that frame, the rest is transparent spin clearance. Shrunk the hitbox to 28x28 (`HITBOX_SIZE`), decoupled from the still-64x64 render size, same width/height-vs-sprite split `Player.js`/`Enemy.js` already use.

## [0.16.5] - 2026-08-10

### Fixed
- Worldmap node selection: click-outside-to-deselect was effectively non-functional - the deselect listener was bound to the `<canvas>` element, but a full-viewport overlay div (`.worldmap-nodes`) sat on top of it and inadvertently intercepted every click first, due to a CSS specificity quirk (`#ui-overlay *`'s ID selector beating `.worldmap-nodes`'s class selector for `pointer-events`). Fixed by moving the listener to `document` instead (`WorldmapState.js`), relying on the node buttons'/info card's own `stopPropagation()` to distinguish "inside" clicks from real outside ones. Also added an explicit X close button on the node info card, so a selection can be cleared without hunting for empty map space to click on.
- Player spawning slightly above the visible terrain surface (a `PlayerStart` marker placed a pixel or two too high in Tiled) triggered the ground-contact landing VFX/SFX right at level start, since `PlayerMovement.js` reads that as "was airborne, just landed" on the very first physics tick. Went through every level's `PlayerStart` placement in Tiled and confirmed pixel-perfect ground alignment in-browser; no code change.
- Lvl 5: a missing tile in the `walls` collision layer let the player glitch sideways through the floor and fall to their death in the gap below. Fixed in Tiled; no code change.

## [0.16.4] - 2026-08-09

### Changed
- `LevelSession.js` (530 lines, over the ~400-line guideline) split into three: constructor setup (`_loadLevel`/`_setMusicZone`/`_buildLevelCanvas`/`_initColorZone`/`_spawnPlayer`/`_initInteractablesAndHud`/`_initCombat`) moved into a new composed `LevelSessionSetup.js`, and the render pipeline (`render`/`_renderWorld`/`_renderColorZone`/`_renderHitboxes`) moved into `LevelSessionRenderer.js`, mirroring `Player.js`'s `PlayerHealth.js`/`PlayerRenderer.js` composition pattern. `LevelSession.js` drops to 282 lines (update loop plus thin lifecycle methods), `LevelSessionSetup.js` is 196, `LevelSessionRenderer.js` is 110. External API (`destroy()`/`update()`/`render()`, plus the exported `LEVEL_JSON_KEYS`/`loadLevelPreview()`/`isBossLevel()`) unchanged. No behavior change, pure relocation.
- `Wraith.js` (467 lines, over the guideline) had its module-level constants moved to a new `WraithConstants.js` (65 lines) and its one-time ground/side-anchor computation (previously `_initAnchors()`/`_findGroundY()`) moved to a new `WraithAnchors.js` (44 lines, `computeWraithAnchors()`). Left the state-machine methods themselves in place rather than extracting those too, since `WraithTemplateboss.js` overrides several of them (`_onRiseComplete`/`_updateCustomState`/`_onArrived`) directly on the prototype chain - moving those into a composed, non-inherited object would have broken that override mechanism. `Wraith.js` drops to 377 lines. No behavior change.
- Root cause found for the open "dark edge along an enemy's patrol path" bug (`TODO.md`): it only reproduces with the browser's hardware acceleration disabled, not per-browser as first thought - software rasterization accumulates the antialiased blend's rounding error differently than the GPU compositing path does. Not an app-level logic bug, no code change; `TODO.md` updated with the finding and the scoped-out hard-mask fix dropped as unnecessary.

## [0.16.3] - 2026-08-08

### Changed
- `ColorZone.js` (460 lines, over the ~400-line guideline) split its triggered, one-time sweep animations (`triggerFullReveal`/`triggerFullDarken`/`triggerZoneWipe` and their `_update*`/elapsed-progress state) into a new `ColorZoneTransitions.js`, holding a reference back to the owning `ColorZone` to reuse its shared drawing primitives (`_punch()`/`darken()`/`revealZone()`/`overlayCtx`) rather than duplicating them. `ColorZone.js` keeps the continuous per-frame trail mechanism (`paintGreyFrom`/`update`/`darken`/`reveal`/`render`) plus thin delegating methods for the moved ones, dropping to 377 lines - external callers (`LevelSession.js`/`WorldmapState.js`/`EnemyRoster.js`) unchanged.
- Finished the comment/JSDoc convention pass (see CHANGELOG 0.15.5) on the three files that pass had deliberately skipped: `LevelSession.js`, the `Interactables.js` family, and `Player.js`/`PlayerMovement.js` (already clean after 0.16.1's split). Remaining top-of-file `//`-commented constants converted to JSDoc; inline "why" comments still scattered through method bodies consolidated into each file's existing top-of-file/class comment block instead.

## [0.16.2] - 2026-08-08

### Changed
- `Interactables.js` (598 lines, a "god object" doing five unrelated jobs - Portal/Merchant+Tokens/Trapdoor/SecretDoor/BuffTerminal) split into a new `js/mechanics/interactables/` folder: one small class per type (`PortalInteractable.js`/`MerchantInteractable.js`/`TrapdoorInteractable.js`/`SecretDoorInteractable.js`/`BuffTerminalInteractable.js`), each sharing a `spawn` (constructor)/`update`/`updatePrompt`/`render`/`destroy` shape, plus a small shared `InteractPrompt.js` for the `[E]`-prompt element/positioning four of the five types build identically. `Interactables.js` itself is now a 117-line thin orchestrator/facade - every external call site (`LevelSession.js`, `EnemyRoster.js`) is unchanged, same external API as before. The one real cross-type dependency (BuffTerminal only interactable once SecretDoor is open) is wired via a small `isDoorOpen: () => boolean` callback rather than a direct reference between the two classes. No behavior change, pure relocation - mirrors the `Player.js` -> `PlayerMovement.js` split from 0.16.1, fanned out into five classes since these types are genuinely independent of each other. A new interactable type (a Lore-Secret variant is already sketched in `docs/GDD/_ideas-inbox.md`) is now purely additive - one new file, one new line in the orchestrator's constructor - instead of another edit to an already-600-line class.

## [0.16.1] - 2026-08-08

### Changed
- `Player.js` (496 lines, over the ~400-line file-length guideline) split its real keyboard-driven movement logic (`_updateControlled()`/`_handleAttackInput()`/`_updateJumpTimers()`/`_updateHorizontalVelocity()`/`_applyGravityAndJump()`/`_tryGroundJump()`/`_tryDoubleJump()`/`_updateDropThrough()`/`_startAttack()`/`_updateAnimationState()`) into a new composed `js/entities/PlayerMovement.js`, mirroring `PlayerHealth.js`/`PlayerRenderer.js`'s existing composition pattern. Unlike `PlayerHealth.js`, the extracted class owns no state of its own (matches `PlayerRenderer.js`'s shape instead) - `grounded`/`attacking`/`coyoteTimer`/etc. stay plain fields on `Player` itself, since `PlayerFx.js`/`DashAbility.js` already read/write `player.grounded`/`player.attacking`/`player.pendingVfx` directly and would otherwise need their own changes too. `Player.js` drops to 293 lines, `PlayerMovement.js` is 235. No behavior change, pure relocation.

## [0.16.0] - 2026-08-08

### Added
- How to Play page (`js/ui/HowToPlayPanel.js`) - four written sections (Color Trail, Movement, Combat, Levels) covering the core color mechanic, all controls (including the previously-undocumented arrow-key alternates to A/D/Space/S), and how attack range auto-switches between melee and thrown. Reachable from the Main Menu's Info panel and a new Pause menu entry, both opening the same shared `Panel` instance (content swap via `onClose`) rather than stacking a second panel-backdrop, which would otherwise register a second competing Escape listener. No live in-run HUD button (considered, dropped - Pause is already one keypress away, a second always-visible entry point would be redundant) and no preview animations or other art (also considered and built, then dropped in favor of plain written text - simpler to build/maintain and nothing to keep in sync when movement/combat gets retuned). `docs/GDD/07_ui-hud.md` 8.1 documents the final content and what was cut along the way.

### Changed
- Menu's Info panel content (Credits/Legal/Privacy) extracted from `MenuState.js` into `js/ui/InfoPanelContent.js` (`buildInfoBody()`) - `MenuState.js` was already at the project's ~400-line file-length guideline, and adding the How to Play entry point would have pushed it over.

## [0.15.5] - 2026-08-08

### Changed
- Comment/JSDoc convention pass finished across the whole codebase (~50 files, tracked file-by-file in `TODO.md`) - the goal from `CLAUDE.md`'s comment convention (no inline why-prose in function bodies; JSDoc at its natural anchor, a class field or a method's own doc block, instead - or a shared top-of-file block only when genuinely file-wide) is now applied everywhere, not just the Group 1-7 files from 0.7.0/0.8.1. Mechanically: single-const `//` blocks converted to JSDoc anchored at their constant; a few malformed constructors found where field-rationale prose had been stuffed into a `@param` JSDoc block instead of documenting an actual parameter (`Boss.js`, `Shooter.js`) - fixed by converting those always-constant fields to real class fields with their own JSDoc, matching the pattern `MusicPlaylist.js`/`CombatCoordinator.js` already used.
- `Wraith.js` (the densest file found, 53% comment lines) got a dedicated trim pass: 259->239 comment lines, cut changelog-style "revised this session" tuning-history asides and a real duplication between two methods' JSDoc, fixed two stale references describing `WraithTemplateboss.js` as not existing yet (it shipped back in 0.10.0). `Panel.js` had a similar stale GameState/BuffState cross-reference fixed.
- Removed dead placeholder-sprite fallback code from `Trapdoor.js`/`SecretDoor.js`/`BuffTerminal.js` - all three could render a flat-color placeholder box when constructed without a sprite, a path that hasn't been reachable since their real art shipped (`Interactables.js` has always passed full sprite sets at every call site). `sprites`/`sprite` are now required constructor params on all three.
- A few small simplifications found along the way: `MenuState._handleMenuSelect()`'s if-chain became a dispatch map; `CombatCoordinator.update()` split its contact-damage handling into its own `_resolveContactDamage()` (matching the shape its sibling `_resolvePlayerAttack()`/`_updateProjectiles()` already had); `MerchantDialogue.open()`'s inline `onMount` callback became a named `_onMount()`.
- Documented (not yet implemented, see `TODO.md`) several architecture findings for a future dedicated pass: lazy/staged asset loading (`LoadingState.js` currently loads every level's assets up front, slow on bad connections); `Interactables.js` splitting into one small class per interactable type instead of one class doing five jobs; `ColorZone.js` splitting its continuous trail mechanism from its triggered one-time sweep animations; `Player.js` splitting its keyboard-movement logic into a `PlayerMovement.js` composed module. `LevelSession.js`/`Interactables.js`/`Player.js` remain the three files still flagged over the ~400-line guideline.

## [0.15.4] - 2026-08-05

### Fixed
- Contact-damage floating numbers showed the wrong value over the wrong combatant. `Combat.js`'s `resolveContactDamage()` returned one shared `amount` for a bidirectional hit - actually the player's own (difficulty-scaled) damage taken - which `CombatCoordinator.js` then displayed floating over the *enemy*, misread as the enemy's own HP loss (e.g. 10 contact damage on Easy's ×0.5 multiplier showed "5" over the enemy, which had actually lost the full unscaled 10 HP). The player also never got any damage number of their own for contact hits at all. A charging Charger made it worse still: it takes no self-damage mid-charge by design, but a number still floated over it as if it had. Fixed by returning `playerAmount`/`enemyAmount` separately and displaying each at the right position - the enemy's share now also skips the number entirely while charging, matching that it took none.

## [0.15.3] - 2026-08-05

### Fixed
- Boss Token and Secret Room buff rewards could be farmed without limit by replaying an already-completed level - neither reward had any persistent per-level "already claimed" record, only session-local instance state (`Interactables.js`'s `this.tokens`/`this.merchant`, `BuffTerminal.js`'s `used`) that reset every time a fresh `LevelSession` was built, whether from the Worldmap (which never blocked re-entering a completed level) or from leaving via Pause -> Main Menu without ever reaching the exit portal (the only path that sets `completedLevels`). Fixed with two new persisted `Game` fields, `claimedBossTokens`/`claimedSecretRoomBuffs` (both `Set<levelNumber>`, saved/loaded/reset alongside `completedLevels` etc.) - `Interactables.onBossDefeated()` and `BuffState._choose()` now check and claim against these directly, independent of level-completion state. Levels themselves stay freely replayable (a boss can still be re-fought, a Secret Room re-entered) - only the one-time reward no longer re-grants.

## [0.15.2] - 2026-08-05

### Changed
- Regular-enemy balancing pass (`docs/GDD/05_enemies-bosses.md` 6.5): Patroller HP 50->30, Sentinel HP 30->35 + contact damage 8->10 + aggro range 80px->90px, Shooter HP 15->20 + contact/projectile damage 8->10 + shot cooldown 1.8s->2s + projectile speed 190->180 (`entities/Enemy.js`/`enemies/Sentinel.js`/`enemies/Shooter.js`/`enemies/ShooterProjectile.js`). Every regular enemy type now deals a uniform 10 contact damage and takes 20 isolated hits to kill the player at Normal difficulty. Charger and all boss numbers deliberately untouched. Ranged sword-throw cooldown also cut 3s->2s (`RANGED_ATTACK_COOLDOWN_SECONDS`, `mechanics/Combat.js`) - 3s read as too sluggish for the supposedly faster/safer ranged option. First real playtest-ready pass, not yet confirmed by actual play.

## [0.15.1] - 2026-08-04

### Changed
- GDD-consistency pass across `docs/GDD/` (01/02/03/04/05/07/08/10/11, plus `_ideas-inbox.md`) - reconciled a large batch of text that had drifted from actual shipped behavior. Notable fixes: `10_technical-architecture.md`'s folder/assets tables and 11.7.3 rewritten to match the real `js/`/`assets/` layout (camera-zoom text was already stale, superseded by the arena-sized buffer approach); Merchant-appears wording (01/02/05) corrected from "Templateboss/Chapterboss only" to "every boss tier, gated by the player's Token balance, not the boss's own drop size" (a real code deviation from this design intent was found and logged in `TODO.md`, not fixed yet); boss-fight color-suspension text (03/05) corrected - the color mechanic runs normally throughout a fight, only the attack instant itself re-greys the room; Secret Room buff numbers (`03_mechanics.md`) corrected to the actual +20/+20/+0.5 values; Healthpacks (+ a wanted Prisma equivalent) marked designed-not-built; mid-level checkpoints removed from the design entirely and moved to `_ideas-inbox.md` (current levels are short enough that a full level restart on death is an accepted choice for now); save-system table (04) trimmed to the actually-persisted keys; `07_ui-hud.md`'s HUD table corrected (Token Counter added, Chapter/Level display and Ability Popup marked not-yet-built, touch button layout fixed); `08_menu-flow.md`'s state table/flow text corrected (BossState covers all boss tiers, BuffState is the Secret Room buff choice not Merchant purchases, Main Menu background uses a real permanent color trail not a fading bubble, Chap 1's Worldmap button stays disabled regardless of Prologue completion per the v1 scope cut, though the still-unbuilt closing cutscene should narratively tease Chap 1 anyway); `11_scope-milestones.md`'s 12.4 progress table updated to mark Worldmap color-reveal/Merchant shop UI/Touch controls/Landscape gate/LocalStorage save/Legal pages as actually done, matching CHANGELOG 0.11.0-0.14.0.

## [0.15.0] - 2026-08-02

### Changed
- Ranged Sword Throw no longer costs Prisma - instead a 3s cooldown (`RANGED_ATTACK_COOLDOWN_SECONDS`, `mechanics/Combat.js`/`CombatCoordinator.js`) and half melee's damage (`RANGED_ATTACK_DAMAGE`). Attempting a throw during the cooldown shows a status text ("Ranged Attack on Cooldown") instead of the old "No Prisma" one - no persistent HUD indicator (session decision, there's no dedicated ranged button to attach one to, attack mode is auto-picked by distance).
- `MusicPlaylist.js` reworked from a single global random rotation into named, sequential zones - `setZone(zone, trackKeys)` switches the active track list, no-op if that zone is already playing (so e.g. Lv1 -> Lv2, which share a zone, never interrupts whatever's currently chaining). Menu/Worldmap share one 9-track zone (all OST tracks, in file order, including `ost-08` "The Iron Sentinel" - no longer boss-exclusive); each level/level-group got its own shorter, hand-picked list instead (`LEVEL_MUSIC_ZONES`) - Lv1/Lv2 and Lv4/Lv5 share a zone each, Lv3/Lv6 (both boss levels) each include `ost-08` in their own rotation rather than needing a forced crossfade override the instant a boss fight starts. Playback is sequential everywhere now, not randomized (session decision). `setZone()` itself only actually plays once `start()` has run (a new `_started` gate) - it's called once at boot (`main.js`) before the "press any key/tap" gesture that unlocks the AudioContext, so it has to just record the pending zone rather than try to play immediately.

### Fixed
- The zone rework above initially caused music to cut in and out in a rapid, self-sustaining loop from the first zone switch onward (e.g. entering a level). `SoundManager.playMusic()`'s crossfade stops the outgoing track via `source.stop()`, which fires that track's `onended` the same as reaching the end naturally - a track cut short by a zone switch still fired its own `onEnded` a `fadeSeconds` later, and since `index`/`trackKeys` live on the single shared `MusicPlaylist` instance, that stale callback advanced/replayed whatever zone was current *by then*, not the one it was actually attached to. Fixed with a generation counter - `_playCurrentTrack()` bumps it, and a stale `onEnded` closure whose captured generation no longer matches is silently ignored instead of firing.

## [0.14.0] - 2026-08-02

### Added
- Legal pages (`MenuState.js`'s Info panel): real Credits/Legal Notice/Privacy Policy content, replacing the "coming soon" placeholders. Credits (AI-generation disclosure for art/music/code, tools, third-party asset licenses, every Freesound.org clip used) is built entirely from a new `assets/credits.json` - loaded via `AssetLoader` at boot the same way a level JSON is, so crediting a newly-added SFX file going forward is a one-line data entry, not a code change. Legal Notice/Privacy Policy follow current German law (`§ 5 DDG`, the Digital Services Act that replaced the TMG) and disclose the confirmed data footprint (localStorage-only save data, no accounts/tracking/cookies, GitHub Pages hosting noted for its own server logs). Still-unfilled placeholder fields (name/address/contact) render in a loud color (`.legal-placeholder`) so they can't accidentally ship blank.

## [0.13.0] - 2026-08-01

### Added
- Touch controls (`ui/TouchControls.js`, `ui/LandscapeGate.js`): a virtual D-Pad (Left/Right/Jump/Drop) + Attack button on any touch-capable device, laid out as a diagonal thumb-arc on the right (Jump/Attack/Drop) rather than a stacked D-Pad - read as awkward on a real device during testing. Both plate (`btn-default`/`btn-pressed.png`, faded so the game reads through it) and icon are separate layered children so the fade never touches the icon. Buttons feed the exact same `InputHandler` state a key press does (`pressAction()`/`releaseAction()`/`triggerPress()`, new public methods) - Player.js/CombatCoordinator.js etc. never know input came from touch. Interact is deliberately not a fixed button - Interactables.js's existing `[E]` prompt elements grow a tappable icon+label on a touch device instead, shown/hidden by the exact same proximity logic as the desktop text. Pause always builds regardless of touch capability (with mouse `:hover` feedback, scoped to `(hover: hover) and (pointer: fine)` so a touchscreen's post-tap stuck-hover can't fight it) - the only way to pause at all on a device with no physical key. `LandscapeGate` blocks the whole screen with an animated "rotate your device" prompt on a touch device held portrait, and actually drops `Game._loop()`'s accumulator (not just visually covers it) so nothing keeps simulating underneath.
- An "Alternative Controls" desktop toggle (mouse-driven touch buttons) was built, tested, and deliberately dropped again the same session - clicking small buttons one at a time doesn't compete with a keyboard's simultaneous-key holds.

### Fixed
- `Panel.js`'s `close()` fired whatever `onClose` the *currently displayed* content had registered, even when the whole owning state was tearing down - `PauseState.exit()` while its Settings sub-view happened to be open re-triggered Settings' "go back to Paused choices" callback mid-teardown, leaving a stray, still-interactive Paused panel on screen while gameplay had already resumed underneath. New `close({ silent: true })` skips that callback for a full teardown; `PauseState.exit()` uses it. `BuffState`/`GameOverState`/`MenuState` were checked and don't hit this (none of them swap Panel content mid-life the way Pause does).
- `LoadingState`'s "press any key/tap to continue" gate listened for `pointerdown` - Chrome's Web Audio autoplay unlock isn't reliably granted on a gesture's start, only once it completes, so `SoundManager.resume()` warned it wasn't allowed to start on some touch input. Switched to `pointerup`.
- An `.interact-prompt.tappable`'s own `display: flex` (an author rule) silently beat the browser's default `[hidden] { display: none; }` UA rule, so toggling the element's `hidden` property stopped actually hiding it - the Interact button/label stayed on screen after use instead of disappearing with its target out of range.

## [0.12.0] - 2026-08-01

### Added
- Worldmap color-reveal (`WorldmapState.js`, `ColorZone.js`): the Prologue map is split into one full-height vertical zone per level (boundary at the midpoint between neighboring node positions), matching `02_game-structure.md` 2.1's "Darkness is visibly pushed back". A zone reveals hard-edged the instant its level is completed, flush against any already-completed neighbor so a contiguous run reads as one seamless stretch; the just-finished level's own zone instead sweeps left-to-right (`ColorZone.triggerZoneWipe()`, ~1.5s) - Continue/New Game pop every already-completed zone in at once with no animation. Reuses the same runtime grey-template generation and `greyBrightness`/`greyTint` "Darkness" look as in-level/menu, no new art asset needed. New `ColorZone.revealZone()`/`triggerZoneWipe()` are deliberately hard-edged with pixel-rounded coordinates, not a soft gradient - a feathered edge left a visible seam at this canvas's small native resolution once scaled up to screen size.
- Next SFX batch (`assets/sounds/sfx/`): hit-player, hit-enemy, enemy-death (also covers the boss until a dedicated boss-death cue exists), player-death, token-pickup, portal, secret-door, power-up (shared by ability purchase and buff choice), and boss-beam (Wraith/Templateboss firing only, not Shooter's shots); landing/dash (wired last session but silent) now have real files too. `CombatCoordinator.js` takes a `sound` reference alongside `damageNumbers` to trigger hit-player/hit-enemy off its existing hit-resolution data.

### Changed
- `LevelSession.js` split into composed modules (861 -> 503 lines, comment density also trimmed ~41% -> ~33%) - same technique as `Player.js`'s earlier `PlayerHealth`/`PlayerRenderer` split, needed again since new features kept landing directly in the file instead of a composed module. Animation-building -> `entities/CharacterAnimations.js`; player VFX/SFX -> `mechanics/PlayerFx.js`; enemy roster spawn/lifecycle (including the boss) -> `mechanics/EnemyRoster.js`. `BossState.js` updated to read the boss through `EnemyRoster` instead of filtering the enemy list itself.

## [0.11.0] - 2026-07-30

### Added
- Merchant ability shop (`ui/MerchantDialogue.js`, `mechanics/Interactables.js`): a Templateboss+/Chapterboss-tier Merchant (`Boss.tokenReward >= 2`) now greets the player by the boss they just killed ("You defeated {bossName}. Let's see what I have for you.") and unhides an ability-purchase grid in the same panel the instant the typewriter finishes - no second `[E]` press needed. Double Jump/Dash, 2 Tokens each (`03_mechanics.md` 4.4); each option shows title/description/cost-with-token-icon/Unlock button (buyable/unaffordable/owned states), and a purchase calls `Player.unlockAbility()` and refreshes the grid in place. Miniboss-tier Merchants (1 Token, Lvl 3) keep the original flavor-only tease, no shop attached - a single Token can never afford anything.
- Multi-Token boss drops (`Boss.tokenReward`, `Interactables._buildTokenDrop()`): a Templateboss/Chapterboss (2 Tokens) now drops two separate Token entities spread apart instead of one bundled pickup, so the reward visibly reads as two pickups rather than a single point value.
- SaveSystem-backed progress (`Game.loadProgress()`/`saveProgress()`/`resetProgress()`): `completedLevels`/`buffs`/`tokens`/`abilities`/`difficulty` now persist across page reloads instead of resetting every time (previously only Settings preferences were backed by `SaveSystem`). Main Menu's Continue button is real now - enabled once a difficulty has ever been chosen, jumps straight to the Worldmap; New Game explicitly resets progress before setting a new difficulty, so it actually restarts instead of silently resuming the old save.
- First real SFX (`assets/sounds/sfx/`, `LevelSession.js`): jump/landing/dash reuse the existing player-VFX `pendingVfx` mailbox (each VFX key doubles as a same-named SFX key, `SoundManager.playSfx()` is already fail-soft for a key with no file loaded); a new attack-start edge-detect plays a sword swoosh once per swing, and a run timer plays a footstep sound periodically while grounded and moving. jump/footsteps/swoosh have real audio files; landing/dash are wired but silent until files exist.

## [0.10.0] - 2026-07-30

### Added
- Wraith of the Grey City (Lvl 6 Templateboss, `entities/bosses/WraithTemplateboss.js`, `assets/levels/Lv_6.json`): extends `Wraith.js` rather than duplicating it (`05_enemies-bosses.md` 6.3.1's "expands the shared moveset rather than replacing it"). Rolls a random beam axis each attack once it reaches the top of its rise - horizontal fires in place exactly like the Miniboss; vertical is a new `firingSweep` state that glides to the opposite fixed side while still up top, with a vertical beam live and tracking its column for the whole crossing (sweeping the floor beneath it), before the normal come-down/vulnerable/side-switch cycle resumes unchanged. Enrage (50% HP and below) forces axis alternation instead of a fresh coinflip. HP/damage (400/70) match `05_enemies-bosses.md` 6.5's revised table. `Wraith.js` itself only grew a few small overridable hooks for this (`_onRiseComplete()`, `_onArrived()`, `_updateCustomState()`) - the Miniboss's own behavior is unchanged.
- `WraithBeam.js` gained an `axis` param (`'horizontal'`/`'vertical'`) - vertical scans downward instead of sideways, using the exact same wall-only rule as horizontal (ignores the one-way `terrain` layer, only real `walls` block it) so cover behaves consistently between the two.
- Player action VFX (`entities/VfxEffect.js`): jump (ground takeoff only, not Double Jump), landing, and dash now spawn a one-shot smoke clip, triggered via a `pendingVfx` mailbox on `Player`/`DashAbility.js` and drained/rendered by `LevelSession.js`. Anchored to each clip's own auto-detected ground line (`SpriteAnimation.groundLineRatio`) instead of assuming the art is centered in its 64x64 frame - same trick `PlayerRenderer.js` already uses for the player's own feet.
- `P` is a dedicated Pause key (`InputHandler.js`), Settings' Controls list updated to match.

### Changed
- Boss asset folders reorganized into `assets/images/enemys/bosses/prologue/{Lv_3_Boss,lv_6_boss}/` - `LoadingState.js`'s manifest paths updated to match.
- `Wraith.js` tuning (shared by both bosses): `VULNERABLE_HOLD_SECONDS` 3->4 (2s enraged, via the existing enrage `timeScale` halving), `ENRAGE_WALK_SPEED_PX_PER_SEC` 150->130.
- `WraithBeam.js`'s wall-check now scans across its own `THICKNESS_PX` cross-section instead of just the centerline (both axes) - a wall only partially overlapping the beam's width/height now correctly registers as a block instead of lagging a few pixels behind the beam's actual rendered/hit rectangle.
- `.settings-row` (Settings panel's Audio/Display/Controls rows, `style.css`) now scales with `--hud-scale` like the rest of `.panel` - previously stayed a fixed small size while the panel itself grew during a boss fight, reading as cramped and hard to read.
- Pause is no longer bound to Escape - the Fullscreen API reserves Escape as an unblockable "exit fullscreen" key, so pausing via Escape while fullscreen also (confusingly, from the player's POV) dropped out of fullscreen. `P` is the only pause key now; `Panel.js`'s own separate Escape-to-dismiss handling for sub-panels (Settings, difficulty picker) is unaffected.

### Fixed
- Lvl 3 Miniboss sprite paths in `LoadingState.js` were left pointing at the old flat `assets/images/enemys/bosses/` location after the folder reorg above - the boss failed to load.
- Player's very first grounded frame at level spawn incorrectly played the landing VFX.
- Templateboss's vertical beam stayed active through its landing descent instead of stopping the instant the crossing itself finished.
- Dash/jump/landing VFX spawn position was off by a few pixels per clip - now anchored via each animation's own detected ground line instead of assuming the sprite content fills/centers its frame.

## [0.9.0] - 2026-07-28

### Added
- Post-boss Merchant flow (`entities/Token.js`, `entities/Merchant.js`, `mechanics/Interactables.js`): the Lvl 3 Miniboss (Wraith) now drops a Token at its death position on defeat - falls under gravity onto the floor below it (`Collision.resolve()`), then bobs in place until the player walks over it (plain proximity pickup, no `[E]` prompt). Collecting it increments `Game.tokens` (new HUD counter, in-level and Worldmap) and spawns the real Merchant (now a real 64x64 sprite, `assets/images/objects/merchant.png`, instead of the previous no-op teaser stub) at its Tiled-placed position - the Merchant no longer exists in the level at all until this fires.
- Merchant dialogue portrait (`ui/MerchantDialogue.js`): portrait (`merchant-dialog-portrait.png`) beside the name ("Unknown Merchant") and typewriter-revealed text, replacing Panel's generic title bar for this one dialogue. The dialogue box no longer grows line-by-line as the text types out - the full line is measured once (hidden) to lock a `min-height` before the reveal starts.
- Ability composition scaffold (`entities/DoubleJumpAbility.js`, `entities/DashAbility.js`): Double Jump (press Jump again mid-air) and Dash (double-tap A/D, self-contained edge-detection, no InputHandler changes) composed onto `Player` per CLAUDE.md's stated architecture - deliberately no shared `Ability` base class, the two have different per-frame contracts. `Player._applyGravityAndJump()` split into `_tryGroundJump()`/`_tryDoubleJump()` (behavior-preserving for the existing coyote-time/jump-buffer ground jump); Dash locks `vx`/facing for its burst the same way the existing knockback lockout already does. No real Merchant/Token spend UI yet (`docs/GDD/03_mechanics.md` 4.4: 2 Tokens per ability) - both are dev/test-only unlockable via new Dev Panel buttons (red/`.locked` until clicked, green/`.unlocked` and disabled after - one-way like a real purchase, no toggle-back) and persist across Retry/level-skip the same way Secret Room buffs do (`Game.abilities`, reapplied in `LevelSession._spawnPlayer()`).
- Dev Panel "Give Token" button, now live (increments `Game.tokens`, same counter the boss-drop pickup uses) - was a disabled stub.
- `Game.hudScale` + the `--hud-scale` CSS custom property (`Game.resizeBuffer()`): BossState's arena-sized buffer (e.g. Lv_3's 960x512) shrinks `_handleResize()`'s on-screen scale for the same physical window, so anything sized in fixed buffer-pixels used to render smaller during a boss fight than in a normal level - previously only patched around for the boss name/HP labels (hardcoded 16px). Now applied generally: `HUD.renderPlayerBars()`/`renderBossBar()`, the HP/Shield/Token HUD labels and their positions (`LevelSession.js`), the boss name/HP labels (`BossState.js`), interact prompts, and every Panel-based UI (`.panel`, `.difficulty-option` - covers Pause/Game Over/Merchant dialogue too) all scale together, so the whole in-level UI stays a constant on-screen size regardless of the current buffer.
- Worldmap "‹ Menu" button (top-left, `.chapter-button` styling) - previously no way back to the main menu from the Worldmap at all.
- Settings' Controls section (`ui/SettingsPanel.js`) now lists the actual key bindings (read-only, mirrors `InputHandler.js`'s `KEY_MAP`) instead of a "coming soon" placeholder - key rebinding itself is deferred to Phase 2.
- Settings is now reachable from the Pause menu (`PauseState.js`), reusing the exact same content/wiring as the Main Menu's - resolves the fullscreen-toggle-only-reachable-from-menu gap noted in 0.7.0. Dismissible back to the Paused choices via ×/backdrop, but not Escape (would otherwise race `PauseState`'s own Escape-driven unpause).

### Changed
- Token pickup art (`assets/images/objects/token.png`) is its own dedicated asset now, cropped to its actual content - the source it started as (the Worldmap's `wm_btn_completed.png` badge) had a lot of transparent padding around a small icon, nearly invisible at any reasonable in-world size until cropped.
- `HUD.renderEnemyBar()` now skips `Boss` instances - the floating per-enemy HP bar next to the new top-center boss bar (0.8.0) was redundant.
- `Game.resetBuffer()` no longer animates the viewport shrink back to the base 640x360 - only `resizeBuffer()`'s growth into a boss arena does now, since a shrink always happens mid state-change into an unrelated screen (Worldmap/Menu) rather than a continuous scene worth animating; previously produced a visible stray "snap back" right after leaving a boss level.

### Fixed
- Merchant dialogue freeze: dismissing it via backdrop-click/×/Escape (as opposed to advancing to the end and pressing `[E]` again) left `MerchantDialogue.isOpen` stuck `true` forever, since `Panel.close()`'s dismissal paths never told it the dialogue had closed - `LevelSession.update()` stayed in its dialogue-frozen branch permanently. Fixed via `Panel`'s own `onClose` callback (already built for exactly this, just unused here).

## [0.8.1] - 2026-07-27

### Changed
- Convention cleanup finished on `Player.js`/`ColorZone.js` (JSDoc, ~14-line functions, top-of-file-only comments) - the last two files left over from the Group 1-7 pass (CHANGELOG 0.7.0).
- New CLAUDE.md convention: file length ~400 lines, with a cohesive chunk pulled into its own composed sub-module instead of growing one file further. Applied immediately: `Player.js` (588 lines post-cleanup) split into `Player.js` (movement/physics/animation, 421 lines), `PlayerHealth.js` (Health/Shield/buff/damage bookkeeping, 127 lines), and `PlayerRenderer.js` (sprite-drawing pipeline, 132 lines) - `Player.js` keeps thin delegating methods/getters (`health`, `shield`, `takeDamage()`, `visualTopY`, `render()`, etc.) so no external caller (Combat.js, HUD.js, LevelSession.js, Interactables.js, CombatCoordinator.js, BuffState.js, the Enemy classes) needed to change.

## [0.8.0] - 2026-07-26

### Added
- `StateMachine.push()`/`pop()` (`js/core/StateMachine.js`): overlay states (Pause/GameOver/Buff) stack on top of whatever's currently running without exiting it - the state underneath keeps its entities/timers exactly as they were and keeps rendering its last frame behind the overlay. `change()` now unwinds the whole stack (not just `current`) before entering the target state.
- `PauseState`/`GameOverState`/`BuffState` (`js/states/`): extracted out of `GameState.js`'s ad-hoc `Panel` + boolean-flag handling - now real, reusable states pushed via the stack above, so any level-hosting state (including the new `BossState` below) gets them for free.
- `BossState` + `LevelSession` (`js/states/`): `GameState.js`'s ~900-line body split in two. `LevelSession` owns everything a running level needs (Level/Collision/Camera/ColorZone/Player/enemies/HUD/interactables/combat resolution) with no `enter()`/`exit()` contract of its own; `GameState` and the new `BossState` are thin wrappers (32-95 lines) that construct one and delegate `update()`/`render()` to it. Routed at level-load time via `isBossLevel()` (checks a level's `EnemySpawn` objects for a Miniboss/Boss), not a mid-session trigger.
- `Interactables` + `CombatCoordinator` (`js/mechanics/`): `LevelSession` itself further split. `Interactables` owns Portal/Merchant/Trapdoor/SecretDoor/BuffTerminal (spawn, prompts, render); `CombatCoordinator` owns the melee/ranged attack decision, both projectile pools, and the hit-stop timer they drive.
- `Game.resizeBuffer()`/`resetBuffer()`: `BossState` now renders into a dedicated buffer sized to exactly match its arena (Lv_3: 960x512) instead of the base 640x360, so there's no empty border around the fight. Resized before the first frame (no visible mid-scene cut); the physical on-screen box grows/shrinks via a brief CSS transition instead of snapping.
- Boss HP bar + name label, top-center (`HUD.renderBossBar()`, `BossState.js`) - shifts color once `Boss.enraged` (Phase 2) as a visible tell for the speed-up, previously only readable from the moveset ticking faster.

### Changed
- Boss balancing overhauled (`Wraith.js`, `docs/GDD/05_enemies-bosses.md` 6.5, all from this session's playtesting): Miniboss HP 150 -> 300 (150 read as weaker than the player's own ~200 Health+Shield pool). The GDD's whole boss-tier table revised 150/250/400 -> 300/400/500 to keep the Miniboss meaningfully below Templateboss/Chapterboss rather than landing on the old Templateboss number. Wraith's contact damage split from the beam's Signature Hit Damage (both were incorrectly the same 40 - contact is now a separate 10, matching every other enemy's `DEFAULT_CONTACT_DAMAGE`). Enrage time-scale 0.65 -> 0.5 (barely noticeable before) and now also speeds up the side-to-side walk, via its own dedicated value rather than `timeScale` inverted (a speed needs the opposite scaling direction from a duration).
- The zoomed-out boss camera (`BOSS_CAMERA_ZOOM`) removed in favor of the dedicated arena-sized buffer above - showing more world at normal tile scale read better in playtesting than shrinking sprites/tiles to fit more into the base buffer.
- `Enemy.takeDamage()`/`Boss.takeDamage()` now return the amount actually applied (doubled during `vulnerable`, 0 if already dead) - `Combat.js`'s damage-number popups use this instead of assuming the caller's pre-multiplier amount is what landed.
- Convention cleanup (JSDoc, ~14-line functions, top-of-file-only comments, see CLAUDE.md) applied to `LevelSession.js`, `Wraith.js`, and `WraithBeam.js` - three of the four big files still outstanding from the Group 1-7 pass (CHANGELOG 0.7.0). `Wraith.js`'s `update()` and constructor were both split into named helper methods (`_tickTimers`/`_trackActiveBeam`/`_updateFacing`/`_updateState`, `_initAnchors`/`_initStateMachine`/`_initBeamMailbox`); `_updateState`'s state-machine dispatch was also converted from an `if`/`else if` chain to a `switch` (one discriminant against several literal states is the textbook case for it, and it reads better without repeating `this.state ===` seven times). `Player.js`/`ColorZone.js` remain for a future pass.

### Fixed
- Wraith's `vulnerable` (double-damage) window stayed active through its entire `toIdle` pose morph and the walk to the arena's other side, only resetting once fully idle again - a hit landed anywhere in that multi-second stretch was doubled regardless of whether the wraith still visually looked exposed.
- `#ui-overlay` stayed sized to the base 640x360 in CSS regardless of `BossState`'s bigger buffer - Pause's panel (and anything else centered in the overlay) centered on that stale smaller sub-region instead of the actual arena canvas, reading as pinned toward the top-left.
- Damage numbers for a boosted (`vulnerable`) hit displayed the pre-multiplier base amount instead of what actually landed (see `Enemy.takeDamage()` change above).

## [0.7.0] - 2026-07-26

### Added
- `SaveSystem` (`js/core/SaveSystem.js`): generic JSON-over-localStorage wrapper for player preferences/progress. Currently only backs Settings preferences (fullscreen, volumes, mute) - `Game.completedLevels`/`Game.buffs` are still session-only, migrating those over is still open.
- `SoundManager` (`js/core/SoundManager.js`): Web Audio GainNode hierarchy (Master -> Music/SFX/Ambience), crossfade music playback, mute (zeroes Master without touching the individual bus volumes those sliders represent), and a perceptual (squared) volume curve instead of raw linear gain - a linear slider felt "loud" far too early in testing.
- `MusicPlaylist` (`js/core/MusicPlaylist.js`): shuffles through the OST's ambient tracks (`ost-00`..`ost-07`), crossfading track to track as each one ends. `ost-08` ("The Iron Sentinel") is reserved for boss encounters and deliberately excluded from the rotation - not yet wired into an actual boss trigger.
- Real Settings panel (`js/ui/SettingsPanel.js`): Master/Music/SFX volume sliders, Mute All, and a Fullscreen checkbox, replacing the "coming soon" placeholder. Controls/Language remain placeholders (no rebinding UI or i18n system exists yet).
- `LoadingState` now gates the menu transition behind a "press any key" prompt - satisfies both the Fullscreen API's and Web Audio's user-gesture requirement in one place, re-applies a saved fullscreen preference, and starts the OST rotation.
- 9 OST tracks added under `assets/sounds/ost/`.

### Changed
- Removed the persistent fullscreen corner button (previously always visible via `index.html`) now that Settings covers it - fullscreen is currently only reachable from the main menu, not mid-level, until a Pause state exists (deliberately deferred, see TODO.md).
- Applied CLAUDE.md's Code Style conventions (JSDoc per function, ~14-line function length, top-of-file-only comments) across nearly the entire codebase: `core/`, `utils/`, `world/`, all of `entities/` (including the full enemy/boss roster), `mechanics/`, `ui/`, and `states/` except `GameState.js`. No behavior changes - verified via syntax checks plus scripted scans for oversized functions, stray inline comments, and missing JSDoc blocks across every touched file. `GameState.js`, `Player.js`, `ColorZone.js`, and `Wraith.js`/`WraithBeam.js` are deliberately still untouched, reserved for a dedicated future session given their size and centrality (see TODO.md's Architecture section).

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
