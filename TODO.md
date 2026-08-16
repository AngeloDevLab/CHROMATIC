# TODO

Working list of what's next. Update together at the end of a session (see `CHANGELOG.md` for what's already shipped) - this file tracks intent, not history.

## Architecture

- **Loading feels slow on bad/mobile connections** - partially addressed (see CHANGELOG 0.17.1): OST tracks re-encoded at a lower bitrate, and the loading screen now only blocks on `ost-00` + SFX, with `ost-01`-`ost-08` loading in the background instead of all 9 upfront; a live percentage replaced the static "Loading..." label. Still loads eagerly up front though: every enemy/boss sprite set, all 3 tilesets, all 6 level JSONs. Remaining idea: lazy-load everything level-specific (tilesets, enemy/boss sprites, per-level JSON) on entering that level instead of at boot. Touches `AssetLoader.js`/`LevelSession.js`, not just `LoadingState.js` - bigger cut than what's done so far, deliberately deferred to its own session.
- **When to keep splitting a big file vs. stop**: two different reasons a file grows big need different answers. A "god object" (one class doing several independent jobs) can genuinely keep being split, since the pieces don't need each other - see `js/mechanics/interactables/` for the pattern (`Interactables.js` itself is now a thin orchestrator delegating to five small classes, one per type, each sharing a `spawn`/`update`/`render`/`destroy` shape). An "orchestrator" (a class with no logic of its own, just sequencing already-extracted subsystems, e.g. `LevelSession.js` at 519 lines - `_updateWorld()` is essentially a call list: `player.update()`, `enemyRoster.updateEnemies()`, `interactables.updateEntities()`, `combat.update()`, ...) is close to done as-is - further splitting just relocates the sequencing, it doesn't reduce it. Rule of thumb: stop when a file is mostly small, well-named, well-documented methods and its length comes from wiring order, not from owning distinct logic.

## Code Style / Open Questions

- Open question, not decided yet: should every method only called from within its own class get a `_` prefix (currently inconsistent across the codebase, ~54 files affected) - parked pending outside clarification (Loom).
- Open question, not decided yet: script file naming (`PascalCase` for classes, e.g. `Main.js`/`Level.js`, vs. a stated convention that scripts are always `camelCase`) - parked pending outside clarification.
- Feedback claimed no boss enemy exists - both do (Lvl 3 Miniboss, Lvl 6 Templateboss), reachable via DevPanel (Backquote key), already noted in the submission but apparently missed.

## Game feel

- Jump/movement/combat feel pass constants (coyote time, jump buffering, variable jump height, movement accel/decel, hit-stop, knockback) are still first-guess defaults, needs real playtesting to tune.
- Charger's constants (speed 115, detection range 190, fixed `chargeDistance` 210 so a rush travels a set distance and stops instead of homing indefinitely, facing locked at the start of a charge so a dodge actually works) are still first-guess, needs real playtesting - see `entities/enemies/Charger.js`.
- Sentinel's aggro range (90px) and rise duration (0.6s), Shooter's detection range (260px), shot cooldown (2s), and projectile speed (180, paired with the cooldown so shots read as individually dodgeable) - see `entities/enemies/Sentinel.js`/`Shooter.js` - all still need real playtesting to confirm.
- Drop-Through-Platform (replaces Duck, see `docs/GDD/03_mechanics.md` 4.2) - `DROP_NUDGE_PX` (`Player.js`) and the whole feel of it need real playtesting.

## Difficulty & Balancing

- All 4 enemy types are implemented (Patroller/Charger/Sentinel/Shooter) with contact/projectile damage unified to 10 across every type, landing each at the same "20 hits to kill the player, isolated" baseline (`docs/GDD/05_enemies-bosses.md` 6.5). Charger's mid-charge contact still doubles to 20 via `CHARGE_CONTACT_DAMAGE_MULTIPLIER`. Ready for the first real playtest, but still not actually played yet - the original draft staged Charger/Shooter for a later "Zone 2+"/"Zone 3+" introduction, but all 4 now appear together within the Prologue's Lvl 1-2, so playtesting needs to confirm the early introduction holds up, not just the numbers in isolation.
- In-level UI showing the active difficulty modifier (e.g. "+100% damage") while actually playing a level - concept only, placement/format not decided yet. (The difficulty *selection* panel in the main menu already states the -50%/+100% info; this is about surfacing it during gameplay too.)
- Ranged Sword Throw's cooldown (`RANGED_ATTACK_COOLDOWN_SECONDS`, `mechanics/Combat.js`, 2s) and half-melee damage still need real playtesting to confirm - cooldown feedback is a reactive status text on a rejected throw ("Ranged Attack on Cooldown"), no persistent HUD indicator (session decision, there's no dedicated ranged button to attach one to).

## Enemies & Ranged Combat

- Shooter's "keeps distance" (05_enemies-bosses.md 6.1) currently only means it doesn't chase to attack - it holds position and fires once in range, but doesn't back away if the player closes in (falls back to normal contact damage instead). Real kiting/retreat behavior would be a follow-up if playtesting says standing still reads wrong.
- Melee swings and the player's own thrown sword destroy an incoming Shooter bolt on contact (`mechanics/Combat.js`) - no reaction/VFX on the bolt itself yet beyond just disappearing, could use a small poof/spark later.
- Ranged attack (sword throw) is a deliberate v1 simplification: auto-targets the nearest enemy (no real click-direction aiming) and is a single-hit throw (no boomerang return-hit) - revisit both if playtesting says otherwise.

## Bosses (Wraith of the Shifting Sands / Wraith of the Grey City, Lvl 3/6)

- Attack interval (2.5s), firing hold (0.2s), base walk speed (100px/s), vulnerable hold (4s, 2s enraged), enrage walk speed (130px/s), and top margin (32px) in `entities/bosses/Wraith.js` are all still first-guess, shared by both bosses - needs real playtesting once both arenas are actually finished, not just resized.
- Deliberate design decision (not a bug): the Templateboss's vertical beam is dodged purely by movement timing (staying clear of its current column as it sweeps), not by ducking under cover - `Lv_6.json`'s `walls` layer only has vertical pillar segments (Miniboss-style horizontal-beam cover), no horizontal "roof" tile anywhere, so there's currently no spatial shelter against the vertical beam at all. Kept this way on purpose so the Templateboss's two beam types read as genuinely different skills rather than both being solved by "stand behind the same kind of wall." Revisit only if playtesting says the timing window is unfairly tight, not by reflexively adding roofed cover.

## Abilities (Double Jump, Dash)

- Composition scaffold (`entities/DoubleJumpAbility.js`/`DashAbility.js`, composed onto `Player`) and the real Merchant shop UI (Double Jump/Dash, 2 Tokens each, `Player.unlockAbility()`) are both done - Miniboss-tier Merchants (1 Token) still can't afford anything, so they keep the flavor-only tease with no shop.
- **Known deviation, deferred until it actually matters (Chap 1+ work, not urgent for the Prologue-only v1)**: `Interactables._openMerchantDialogue()` gates the shop on the just-defeated boss's own `tokenReward` (`this._tokenReward < SHOP_MIN_TOKEN_REWARD`), not on the player's actual running `Game.tokens` balance. Intended behavior (per `02_game-structure.md` 2.5, Tokens carry over and accumulate across bosses/chapters): the Prologue's own Miniboss (Lvl 3) stays the flavor-only tease either way, on purpose - it's always the player's first boss ever, 0 Tokens banked beforehand. But a player who buys nothing at the Prologue's Templateboss (Lvl 6) carries 3 Tokens (1+2) into Chap 1 - at *that* chapter's own Miniboss, the shop should already unlock (3 banked + 1 new drop = 4, well past `ABILITY_TOKEN_COST` 2), not repeat the flavor-only tease the way every Miniboss currently does regardless of balance. Fix: check `Game.tokens >= ABILITY_TOKEN_COST` after the drop instead of the boss's own `tokenReward`.
- Dash/jump/landing smoke VFX (`entities/VfxEffect.js`) playback fps (jump 24, landing 20, dash 28, `LevelSession.js`'s `VFX_CLIPS`) is first-guess - needs a look once played at real speed. Double Jump deliberately has no VFX (no ground contact to kick dust from).
- Dash's constants (`DASH_SPEED` 400, `DASH_DURATION_SECONDS` 0.18, `DASH_COOLDOWN_SECONDS` 0.6, `DOUBLE_TAP_WINDOW_SECONDS` 0.25 in `entities/DashAbility.js`) are first-guess - needs real playtesting once it's unlockable for real.
- No i-frames paired with the Dash (deliberately deferred, common pairing in the genre but out of scope for now - revisit if playtesting wants it).
- Wall Jump (unlockable, only from Chap 2 per `03_mechanics.md` 4.2), Slide+Attack, and Air Attack are still not built at all - deliberately deferred, Double Jump/Dash are the GDD's "guaranteed first options" (4.4).

## Gimmick (Lvl 4 Trapdoor)

- Lvl 4 (wall + trapdoor funnel, `entities/Trapdoor.js`) is done and reachable.
- `opensFrameCount`/`opensFps` (10 frames/12fps, set where `Interactables.js` constructs the Trapdoor) are a first-guess, needs a look once you've actually seen the break animation play at speed.

## Secret Room (Lvl 5)

- Lvl 5 (`SecretDoor`, 50 Prisma, physically blocks the path while closed -> `BuffTerminal`'s 3-way buff-choice panel) is done and reachable. Chosen buffs persist across level reloads via `Game.buffs`.
- Buff magnitudes (+20 Max Health / +0.5 Shield Regen per sec / +20 Max Shield) are first-guess - needs real playtesting, especially relative to enemy damage values.
- Only one buff can ever be picked in the whole Prologue (one Secret Room) - the three-way choice panel is built generically enough to reuse once Chap 1 adds more Secret Rooms, but that's untested since it can't happen yet.
- Multi-tileset levels (`world/TilesetRegistry.js`) need a manual registry entry (image key + column count) per new Tiled tileset added to the project - not automatic, easy to forget when adding tileset art.

## Content/systems still needed for v1 (Prologue, per docs/GDD/11_scope-milestones.md)

- Lv_6 (Templateboss) currently only uses `tileset_grass` (no dedicated city tileset yet) - art follow-up, not code.
- Worth a pass over each level's `walls`/`noDrop` collision layers to check for spots where the one-way terrain's lack of horizontal blocking lets the player clip through what should be a solid ledge/wall.
- Touch controls: Dash (double-tap Left/Right) should work through the touch buttons via the shared `InputHandler` state with no dedicated wiring, but wasn't specifically called out as tested on a real device. Button positions/opacity are still first-guess - revisit if more real-device playtesting says otherwise.
- Key rebinding UI - Settings' Controls section shows the actual key bindings (read-only), but rebinding itself is Phase 2/Optional, not built.
- Audio: SFX pass still incomplete - missing UI click sounds (menu/panel buttons), dedicated boss-hit/boss-enrage/boss-death cues (the boss currently just reuses the regular-enemy `hit-enemy`/`enemy-death` cues), and a few existing SFX files are too quiet and need re-normalizing (doing this in Audacity, no code change needed). Sourcing, crediting, wiring in, and testing estimated at 1-2 days. Still no VFX for the boss fight specifically either.
- Legal pages (Credits/Legal Notice/Privacy Policy) have real content, but are still worth a real legal check (Impressumspflicht scope, correct MStV/DDG wording) before publishing, not just the AI-assisted draft.
- A lot of what's left is blocked on art/assets currently in progress (levels, enemy sprites) rather than on code.
