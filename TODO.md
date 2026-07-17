# TODO

Working list of what's next. Update together at the end of a session (see `CHANGELOG.md` for what's already shipped) - this file tracks intent, not history.

## Bugs (found via friend playtest)

- **Jump apex ~5px short on another machine/browser.** Not the naive "gravity added as a fixed per-frame value" bug - `Player.js`'s `vy += gravity * dt` and `Game.js`'s loop already use real elapsed time, not a fixed step. Two real suspects instead:
  - No `dt` clamping in `Game.js`'s loop - a stutter, GC pause, or tab-switch could produce one huge `dt` spike, causing a single oversized position jump that could over/undershoot the intended arc or tunnel past a platform edge. Cheap defensive fix: clamp `dt` to a sane max (e.g. 50ms) before using it.
  - Semi-implicit Euler is still step-size sensitive even with `dt` scaling - velocity updates before position each step (`Player.js`/`Collision.resolve()`), so the discrete jump arc's exact apex height shifts slightly with frame rate/refresh rate, converging toward the "true" continuous arc as `dt` shrinks. A fixed timestep (accumulator pattern: step physics in fixed-size chunks regardless of render frame rate) would make the arc identical on every machine - not an architecture rewrite, just how the physics update is paced.
  - Needs reproducing first (ask what refresh rate/browser the friend was on) before picking a fix.

- **Cutscene text outline missing on some browsers.** Confirmed cause: `.cutscene-text` in `style.css` relies solely on `-webkit-text-stroke` (vendor-prefixed, inconsistent support/rendering outside Chromium). Fix: switch to a 4-or-8-direction `text-shadow` stack (standard, no prefix needed) instead of/alongside the stroke.

## Game feel

- Player invincibility frames after taking damage - currently only the enemy side has a contact cooldown; multiple enemies (or one lingering enemy) can stack damage onto the player every frame with nothing on the player's side to prevent it.
- Hit-flash (white tint) on enemy/player damage - agreed this should be code-driven (canvas compositing), not baked into sprite frames, since a hit can land during any frame of any animation.
- Enemy death has no animation/juice yet - it just vanishes once HP hits 0.
- Player death (0 HP) does nothing yet - no checkpoint/GameOverState exists.

## Content/systems still needed for v1 (Prologue, per docs/GDD/11_scope-milestones.md)

- Remaining Prologue levels (2-6) - only Lv_1 exists so far.
- Ranged attack (sword throw/boomerang) - melee-only right now; `thrown_sword.png` is already in the project but unused.
- Remaining enemy types: Charger, Shooter, Sentinel (only the Patroller-style maggot exists).
- Miniboss + Templateboss encounters (Prologue has 2 per 05_enemies-bosses.md 6.3).
- Token economy + Merchant.
- Secret Rooms + permanent character buffs.
- Touch controls (desktop/keyboard only right now).
- LocalStorage save system.
- Audio: Web Audio API GainNode hierarchy (Master -> Music/SFX/Ambience), tracks need downloading + wiring in - see the earlier music-architecture discussion (generic ambient playlist + dedicated boss track leaning).
