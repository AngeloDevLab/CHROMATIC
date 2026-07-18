# TODO

Working list of what's next. Update together at the end of a session (see `CHANGELOG.md` for what's already shipped) - this file tracks intent, not history.

## Bugs

- **Jump apex ~5px short on another machine/browser.** `dt` clamping (50ms cap) is in as a preventive fix, but the original report is still unconfirmed - needs checking back with the friend whether that alone resolved it. If not: semi-implicit Euler is still step-size sensitive even with clamped `dt` (velocity updates before position each step), a fixed-timestep accumulator would make the arc identical on every machine as a fallback fix.

## Game feel

- Enemy death has a color-reveal beat now, but still no real animation/sprite - it just vanishes (color reveal aside) once HP hits 0.
- **Fine-tuning: jumping directly over a Maggot still takes contact damage.** Noticed during playtesting, not urgent - likely the contact hitbox/timing grazes the jump arc. Revisit later.
- Special Attack concept (replaces the planned Slide+Attack/Air Attack unlocks from `03_mechanics.md` 4.2 with one contextual button): Ground Special = short forward slide, hit + knockback; Air Special = freeze time, aim an arrow toward the mouse, left-click confirms a dash-attack in that direction, then normal gravity resumes. Both would apply a generic stagger status on hit (later extendable to per-enemy reactions, e.g. Patroller freezes, Shooter stops firing - blocked on those enemy types existing at all). Needs dedicated sprite sheets eventually (attack.png as placeholder in the meantime), no sound yet, no unlock-gating since there's no ability-unlock system in code at all yet. Parked for now - current normal Attack already works mid-air (locks vx, gravity/vy keep resolving) which covers the immediate need.

## Difficulty & Balancing

- Full enemy damage/HP table once Sentinel/Charger/Shooter actually exist in code - Patroller is now at 10 dmg/50 HP (Easy 5, Hard 20), higher numbers reserved for later/stronger enemy types instead.
- In-level UI showing the active difficulty modifier (e.g. "+100% damage") while actually playing a level - concept only, placement/format not decided yet. (The difficulty *selection* panel in the main menu already states the -50%/+100% info; this is about surfacing it during gameplay too.)

## Enemies & Ranged Combat

- Remaining enemy types: Charger, Shooter, Sentinel (only the Patroller-style maggot exists).
- Shooter needs: a Projectile entity, a swept wall-collision check (a single point-check on the new position risks tunneling through thin walls at high speed - `Collision.isSolidAt()` is reusable but needs sampling between old/new position, not just the endpoint), and a shoot animation (code-driven aim/rotation vs. baked per-direction sprite frames - still undecided).
- Ranged attack (sword throw/boomerang) - melee-only right now; `thrown_sword.png` is already in the project but unused.
- Per-enemy special reactions (Patroller freezes, Shooter stops firing, etc.) - ties into the Special Attack concept above, blocked on those enemy types existing.

## Tooling

- Dev panel (Shift+key toggle): hitbox/zone debug overlay, live value editing in-game (e.g. an invincibility toggle for testing).

## Content/systems still needed for v1 (Prologue, per docs/GDD/11_scope-milestones.md)

- Remaining Prologue levels (2-6) + real per-level parallax backgrounds - only Lv_1 exists, and even that currently reuses the main menu's parallax image as a placeholder (see the "Test:" comment in `GameState.js`). Tiled layer/rendering conventions (per `10_technical-architecture.md`) to align on together while building these.
- Miniboss + Templateboss encounters (Prologue has 2 per 05_enemies-bosses.md 6.3).
- Token economy + Merchant.
- Secret Rooms + permanent character buffs (now split into Buff-Secret/Lore-Secret, see `docs/GDD/02_game-structure.md` 2.5) - Lore-Secret delivery mechanisms (Terminal/Letters/Environmental, see `docs/GDD/06_story-narrative.md` 7.5) are documented only, not built.
- Touch controls (desktop/keyboard only right now).
- LocalStorage save system.
- Audio: Web Audio API GainNode hierarchy (Master -> Music/SFX/Ambience), tracks need downloading + wiring in - see the earlier music-architecture discussion (generic ambient playlist + dedicated boss track leaning).
- A lot of this is blocked on art/assets currently in progress (levels, parallax, enemy sprites) rather than on code.
