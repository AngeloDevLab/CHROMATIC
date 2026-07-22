# TODO

Working list of what's next. Update together at the end of a session (see `CHANGELOG.md` for what's already shipped) - this file tracks intent, not history.

## Game feel

- **Fine-tuning: jumping directly over a Patroller still takes contact damage.** Noticed during playtesting, not urgent - likely the contact hitbox/timing grazes the jump arc. Revisit later.
- **Open bug: a dark edge/line is visible along an enemy's patrol path in Edge/Firefox** (reproduces even in the main menu's decorative Patroller pass, reliably after a single pass). Root-caused this session (not yet fixed in code - the attempted fix was reverted, see below): `ColorZone.darken()`'s soft-edged circle (radial gradient + `destination-in` + `arc()`) always antialiases its boundary, even at "full" strength. A patrolling enemy sweeps its circle along (near enough to) a straight line, so the top/bottom edge of that circle sits at the exact same y for the whole pass - every neighboring frame's circle only ever reaches those same pixels at its OWN edge too (never with a full-coverage interior draw, since for any horizontal offset `dx != 0`, `sqrt(dx^2 + radius^2) > radius`), so any 8-bit rounding error introduced there is permanent - nothing ever overwrites it cleanly. Confirmed via direct `overlayCtx` vs. `greyTemplateCanvas` pixel comparison at the same world coordinate: same alpha (255, fully opaque) but RGB off by a few units (e.g. `(7,7,10)` vs. the correct `(9,10,12)`) - small in absolute terms but visible because `greyBrightness` is tuned very low (0.15, see `GameState.js`), where a few units is a large relative change.
  - **Fix approach that worked** (reverted, not currently applied): replace the antialiased gradient/arc mask with a precomputed hard 0/255 circle applied via direct pixel manipulation (`getImageData`/`putImageData`) - no partial-coverage pixels left to round.
  - **Trade-off found**: the soft/organic edge on `main` today is a side effect of the exact same repeated-blending mechanism that causes the bug (`darken()` blends a soft gradient straight into the persisted overlay every frame, accumulating over overlapping passes into a naturally fading trail) - a hard mask fixes the bug but loses that look. Best mitigation found: keep the permanent commit hard-edged, and add a separate soft-edged "live" halo (~1.3x the radius, redrawn fresh every frame around the enemy, never persisted, so immune to the bug) to approximate the old look - close but not identical to `main`'s current visual.
  - Also worth knowing for whoever picks this back up: a naive throttle on how often `darken()` runs (to reduce call frequency) does NOT fix this - the bug isn't frequency-related, it reproduces on the very first pass regardless. And the live-halo approach needs its own render-order care (draw base overlay -> live halos -> player's own live reveal last) so the player's reveal always visually wins over an overlapping enemy darken circle.
  - Deprioritized for now (cosmetic, Firefox/Edge-only, not urgent) - revisit and reapply the hard-mask fix (with the live-halo trade-off, or a better idea) when there's appetite for another pass.
- Jump/movement/combat feel pass constants (coyote time, jump buffering, variable jump height, movement accel/decel, hit-stop, knockback) are still first-guess defaults, needs real playtesting to tune. Knockback speeds nudged down slightly this session, still not final.
- Charger's constants (charge range/height tolerance, charge speed, cooldown, HP) are also first-guess, needs real playtesting - see `entities/enemies/Charger.js`.

## Difficulty & Balancing

- Full enemy damage/HP table once Sentinel/Shooter actually exist in code - Patroller is at 10 dmg/50 HP, Charger at 10 dmg/25 HP (both Easy/Hard-scaled via the shared difficulty multiplier). Original balancing draft (`docs/GDD/05_enemies-bosses.md` 6.5) staged Charger/Shooter for "Zone 2+"/"Zone 3+" (later, stronger-tier introduction) - now that all 4 types are introduced together within the Prologue's Lvl 1-2 (see `docs/GDD/02_game-structure.md` 2.4/2.6), that pacing assumption needs revisiting once Shooter/Sentinel exist in code; the early introduction may need the numbers softened.
- In-level UI showing the active difficulty modifier (e.g. "+100% damage") while actually playing a level - concept only, placement/format not decided yet. (The difficulty *selection* panel in the main menu already states the -50%/+100% info; this is about surfacing it during gameplay too.)
- Ranged Sword Throw's Prisma cost (10/throw, see `mechanics/Combat.js`) is a first-guess, needs playtesting against the Shield regen rate (1/sec) to see if it feels right rather than either free-spam or too punishing.

## Enemies & Ranged Combat

- Remaining enemy types needed for the Prologue: Shooter, Sentinel (Patroller and Charger already implemented - see `entities/enemies/Charger.js` for the subclass pattern to follow). Both are needed within the Prologue itself now, Lvl 2 specifically (see `docs/GDD/02_game-structure.md` 2.6), not deferred to Chap 1 anymore.
- Shooter needs: a Projectile entity and a shoot animation (code-driven aim/rotation vs. baked per-direction sprite frames - still undecided) - can reuse the swept wall-collision pattern (`js/entities/Projectile.js`, built for the player's ranged attack) instead of a single point-check that risks tunneling through thin walls at high speed.
- Ranged attack (sword throw) is a deliberate v1 simplification: auto-targets the nearest enemy (no real click-direction aiming) and is a single-hit throw (no boomerang return-hit) - revisit both if playtesting says otherwise.

## Tooling

- Dev panel (Shift+key toggle): hitbox/zone debug overlay, live value editing in-game (e.g. an invincibility toggle for testing).

## Content/systems still needed for v1 (Prologue, per docs/GDD/11_scope-milestones.md)

- Remaining Prologue levels (3-6) + real per-level parallax backgrounds - Lv_1/Lv_2 exist and are wired up (`GameState.js`'s `LEVEL_JSON_KEYS`), both still reuse the main menu's parallax image as a placeholder (see the "Test:" comment in `GameState.js`). Lv_3/4/5 exist as `.tmx` only so far, not yet exported to JSON or registered. Tiled layer/rendering conventions (per `10_technical-architecture.md`) to align on together while building these.
  - A 4-layer depth-parallax attempt (sky/far-trees/mid-trees/ground) was tried and fully reverted this session - both the real independently-scrolling version (a scrolling/repeating layer has no fixed world position, so it can't participate in `ColorZone`'s permanent reveal-by-position mechanic without a per-layer `ColorZone` multiplying `darken()`'s already-known Firefox/Edge performance cost by 5x) and a simpler flattened-composite version of the same 4 images (visually redundant with `forest_bg.png`, which already depicts the same sky/far/mid/ground layering in one image). The 4 source images were pulled from the project rather than committed unused. Next real attempt should design the art to look distinct from `forest_bg.png` if it's meant to replace it, and have a concrete plan for the `ColorZone` conflict before building layers.
- Each level needs an `ExitPortal` object placed in Tiled (plain marker, no sprite attached - see `10_technical-architecture.md` 11.6.2) for the level-complete/portal flow to actually work; Lv_1/Lv_2 don't have one yet.
- Miniboss + Templateboss encounters (Prologue has 2 per 05_enemies-bosses.md 6.3).
- Token economy + Merchant.
- Secret Room + permanent character buff system (see `docs/GDD/02_game-structure.md` 2.5) - documented only, not built. A free/low-cost Lore-Secret variant was designed alongside this and cut for scope, see `docs/GDD/_ideas-inbox.md`.
- Touch controls (desktop/keyboard only right now).
- LocalStorage save system - `Game.completedLevels` (session-only right now, resets on reload) is the intended save/load target once this exists.
- Audio: Web Audio API GainNode hierarchy (Master -> Music/SFX/Ambience), tracks need downloading + wiring in - see the earlier music-architecture discussion (generic ambient playlist + dedicated boss track leaning).
- A lot of this is blocked on art/assets currently in progress (levels, parallax, enemy sprites) rather than on code.
