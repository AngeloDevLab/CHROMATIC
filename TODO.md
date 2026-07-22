# TODO

Working list of what's next. Update together at the end of a session (see `CHANGELOG.md` for what's already shipped) - this file tracks intent, not history.

## Game feel

- **Fine-tuning: jumping directly over a Patroller still takes contact damage.** Noticed during playtesting, not urgent - likely the contact hitbox/timing grazes the jump arc. Revisit later.
- **Open bug: a dark edge/line is visible along an enemy's patrol path in Edge/Firefox** (reproduces even in the main menu's decorative Patroller pass, reliably after a single pass). Root-caused this session (not yet fixed in code - the attempted fix was reverted, see below): `ColorZone.darken()`'s soft-edged circle (radial gradient + `destination-in` + `arc()`) always antialiases its boundary, even at "full" strength. A patrolling enemy sweeps its circle along (near enough to) a straight line, so the top/bottom edge of that circle sits at the exact same y for the whole pass - every neighboring frame's circle only ever reaches those same pixels at its OWN edge too (never with a full-coverage interior draw, since for any horizontal offset `dx != 0`, `sqrt(dx^2 + radius^2) > radius`), so any 8-bit rounding error introduced there is permanent - nothing ever overwrites it cleanly. Confirmed via direct `overlayCtx` vs. `greyTemplateCanvas` pixel comparison at the same world coordinate: same alpha (255, fully opaque) but RGB off by a few units (e.g. `(7,7,10)` vs. the correct `(9,10,12)`) - small in absolute terms but visible because `greyBrightness` is tuned very low (0.15, see `GameState.js`), where a few units is a large relative change.
  - **Fix approach that worked** (reverted, not currently applied): replace the antialiased gradient/arc mask with a precomputed hard 0/255 circle applied via direct pixel manipulation (`getImageData`/`putImageData`) - no partial-coverage pixels left to round.
  - **Trade-off found**: the soft/organic edge on `main` today is a side effect of the exact same repeated-blending mechanism that causes the bug (`darken()` blends a soft gradient straight into the persisted overlay every frame, accumulating over overlapping passes into a naturally fading trail) - a hard mask fixes the bug but loses that look. Best mitigation found: keep the permanent commit hard-edged, and add a separate soft-edged "live" halo (~1.3x the radius, redrawn fresh every frame around the enemy, never persisted, so immune to the bug) to approximate the old look - close but not identical to `main`'s current visual.
  - Also worth knowing for whoever picks this back up: a naive throttle on how often `darken()` runs (to reduce call frequency) does NOT fix this - the bug isn't frequency-related, it reproduces on the very first pass regardless. And the live-halo approach needs its own render-order care (draw base overlay -> live halos -> player's own live reveal last) so the player's reveal always visually wins over an overlapping enemy darken circle.
  - Deprioritized for now (cosmetic, Firefox/Edge-only, not urgent) - revisit and reapply the hard-mask fix (with the live-halo trade-off, or a better idea) when there's appetite for another pass.
- Jump/movement/combat feel pass constants (coyote time, jump buffering, variable jump height, movement accel/decel, hit-stop, knockback) are still first-guess defaults, needs real playtesting to tune.
- Charger's constants are still first-guess, needs real playtesting - see `entities/enemies/Charger.js`. Went through several tuning passes this session (speed 170→140→115, detection range 150→190, and a new fixed `chargeDistance` of 210 so a rush travels a set distance and stops instead of homing in on the player indefinitely - facing is now locked at the start of a charge instead of re-aimed every frame, so a dodge actually works).
- Sentinel's constants (aggro range 80px, rise duration 0.6s once triggered) and Shooter's (detection range 260px, shot cooldown 1.8s, projectile speed 190) are first-guess too, same GDD-draft-value reasoning as Charger - see `entities/enemies/Sentinel.js`/`Shooter.js`.
- Drop-Through-Platform (replaces Duck, see `docs/GDD/03_mechanics.md` 4.2) is brand new this session - `DROP_NUDGE_PX` (`Player.js`) and the whole feel of it need real playtesting.

## Difficulty & Balancing

- All 4 enemy types are now implemented (Patroller/Charger/Sentinel/Shooter), balance values still first-guess GDD-draft (`docs/GDD/05_enemies-bosses.md` 6.5): Patroller 10 dmg/50 HP (tuned from playtesting), Charger 10 dmg/25 HP, Sentinel 8 dmg/30 HP, Shooter 8 dmg (contact + projectile)/15 HP - all Easy/Hard-scaled via the shared difficulty multiplier. The original draft staged Charger/Shooter for "Zone 2+"/"Zone 3+" (later, stronger-tier introduction), but all 4 now appear together within the Prologue's Lvl 1-2 (`docs/GDD/02_game-structure.md` 2.4/2.6) - real playtesting needed to see if Sentinel/Shooter's numbers hold up that early, may need softening.
- In-level UI showing the active difficulty modifier (e.g. "+100% damage") while actually playing a level - concept only, placement/format not decided yet. (The difficulty *selection* panel in the main menu already states the -50%/+100% info; this is about surfacing it during gameplay too.)
- Ranged Sword Throw's Prisma cost (10/throw, see `mechanics/Combat.js`) is a first-guess, needs playtesting against the Shield regen rate (1/sec) to see if it feels right rather than either free-spam or too punishing.

## Enemies & Ranged Combat

- Shooter's "keeps distance" (05_enemies-bosses.md 6.1) currently only means it doesn't chase to attack - it holds position and fires once in range, but doesn't back away if the player closes in (falls back to normal contact damage instead). Real kiting/retreat behavior would be a follow-up if playtesting says standing still reads wrong.
- Melee swings and the player's own thrown sword now destroy an incoming Shooter bolt on contact (`mechanics/Combat.js`) - no reaction/VFX on the bolt itself yet beyond just disappearing, could use a small poof/spark later.
- Ranged attack (sword throw) is a deliberate v1 simplification: auto-targets the nearest enemy (no real click-direction aiming) and is a single-hit throw (no boomerang return-hit) - revisit both if playtesting says otherwise.

## Tooling

- Dev panel (Shift+key toggle): hitbox/zone debug overlay, live value editing in-game (e.g. an invincibility toggle for testing).

## Content/systems still needed for v1 (Prologue, per docs/GDD/11_scope-milestones.md)

- Per-level background layering: every Prologue level bakes in the same shared forest backdrop (`GameState.js`, reusing the main menu's background image) as its base, and each level additionally paints its own `background` Tiled tile layer on top (Lv_1/Lv_2/Lv_3 all have one now) - lets a level (e.g. the planned cave-interior Gimmick level) cover the shared forest backdrop entirely with its own art where needed, instead of it showing through. The whole earlier depth-parallax detour (JS-composited layers, independently-scrolling attempt, `assets/images/backgrounds/parallax/`) is moot now - simpler to just paint overrides in Tiled directly.
- Lv_3 is now exported (`.tmx` + `.json`) but not yet registered in `GameState.js`'s `LEVEL_JSON_KEYS` or `LoadingState.js`'s manifest, so it's not reachable in-game yet. Lv_4/5/6 still only exist as `.tmx` (Prologue needs 6 total).
- `walls` collision layer (`Collision.js`, always fully solid regardless of the one-way terrain layer) exists in code now - Lv_1/Lv_2 already have a `walls` tile layer with a few tiles painted in (fixing the corner-clip bug from playtesting), Lv_3 doesn't have one yet. Worth a pass over each level to check for other spots where the one-way terrain's lack of horizontal blocking lets the player clip through what should be a solid ledge/wall.
- Each level needs an `ExitPortal` object placed in Tiled for the level-complete/portal flow to work - Lv_1/Lv_2/Lv_3 all have one now.
- Miniboss + Templateboss encounters (Prologue has 2 per 05_enemies-bosses.md 6.3).
- Token economy + Merchant.
- Secret Room + permanent character buff system (see `docs/GDD/02_game-structure.md` 2.5) - documented only, not built. A free/low-cost Lore-Secret variant was designed alongside this and cut for scope, see `docs/GDD/_ideas-inbox.md`.
- Touch controls (desktop/keyboard only right now).
- LocalStorage save system - `Game.completedLevels` (session-only right now, resets on reload) is the intended save/load target once this exists.
- Audio: Web Audio API GainNode hierarchy (Master -> Music/SFX/Ambience), tracks need downloading + wiring in - see the earlier music-architecture discussion (generic ambient playlist + dedicated boss track leaning).
- A lot of this is blocked on art/assets currently in progress (levels, enemy sprites) rather than on code.
