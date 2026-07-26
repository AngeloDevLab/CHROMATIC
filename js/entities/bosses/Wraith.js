import { Boss } from '../Boss.js';
import { WraithBeam } from './WraithBeam.js';

// 128x96 hitbox - the tested footprint the arena/feel was tuned against,
// narrower than the padded 128x256 sheet on purpose (same reasoning as
// Player.js's HITBOX_WIDTH/HEIGHT). Session finding: bumping HEIGHT to match
// the sprite's full opaque height (~233px) does make Enemy.setAnimations()'s
// derived renderSize hit the sheet's native 256px res one-for-one, but it
// also blows the on-screen boss up past this tested size - the actual fix
// for the sprite looking soft under a zoomed-out camera (BossState.js)
// belongs on the art side (author frames closer to the real display size)
// or in the dedicated boss render buffer, not by growing the hitbox.
const WRAITH_WIDTH = 96;
const WRAITH_HEIGHT = 128;

// 05_enemies-bosses.md 6.5 (Miniboss row, revised this session from 150 to
// 300 - 150 read as weaker than the player's own ~200 Health+Shield pool,
// which shouldn't be true for a boss) - the Templateboss's 400 HP/70 dmg
// belongs to a future WraithTemplateboss subclass, not here. "Signature Hit
// Damage" in that table is what the beam (WraithBeam.js) deals to the
// player, not contact damage - the table's own "~30 player hits until boss
// dead" only checks out against 300 HP at PLAYER_ATTACK_DAMAGE (10/hit,
// Combat.js), confirming this. Bugfix (session finding): this was also
// being reused as `contactDamage` below, so touching the Wraith mirrored 40
// back at it via Combat.js's passive barrier exchange - 4-5x every other
// enemy's contact damage (8-10, see Enemy.js's DEFAULT_CONTACT_DAMAGE) and
// enough to burn through its HP far faster than intended.
// WRAITH_CONTACT_DAMAGE below is the fix, matching the normal convention
// instead.
const WRAITH_HP = 300;
const SIGNATURE_HIT_DAMAGE = 40;
const WRAITH_CONTACT_DAMAGE = 10;

// 05_enemies-bosses.md's Miniboss row - BossState.js's HP bar label.
const WRAITH_NAME = 'Wraith of the Shifting Sands';

// How close to the level's top edge the firing pose reaches - the bottom
// anchor (idle AND vulnerable both sit there) is derived from the actual
// arena's collision instead (see _initAnchors()), so the wraith travels the
// arena's real full height rather than a fixed offset that'd need
// re-tuning every time Lv_3's layout changes.
const TOP_MARGIN_PX = 32;

// Hold durations for the two static poses (firing.png/vulnerable.png are
// single-frame - their screen time isn't driven by an animation length like
// the transitions below, so these are explicit timers) and the idle
// cooldown between attacks - all first-guess, same reasoning as every other
// enemy's tuning constants in this codebase. Vulnerable is deliberately
// generous (session decision): the wraith lands at a fixed arena spot, the
// player has to actually run/platform over to it, so the window needs real
// slack instead of punishing them for travel time. These three (not the
// transition clips' own playback speed) scale with Boss.timeScale on enrage,
// so a faster cycle reads as "less waiting around", not a blurred animation
// - the walk speed below also speeds up on enrage, but via its own dedicated
// value rather than timeScale (see that constant's own comment).
const ATTACK_INTERVAL_SECONDS = 2.5;
const FIRING_HOLD_SECONDS = 0.2;
const VULNERABLE_HOLD_SECONDS = 3;

// Horizontal walk to the arena's other side (session decision, corrected
// from an earlier "facing-flip only" misunderstanding of "Seitenwechsel") -
// happens after vulnerable, before the next idle. First-guess, same
// reasoning as every other timing constant here. Session finding: this was
// the missing enrage factor - the three hold timers above sped up in Phase 2
// but the walk itself didn't, so the side-to-side leg of the cycle stayed at
// its normal pace regardless, diluting how "faster" the enrage actually read
// overall. Doesn't reuse ENRAGE_TIME_SCALE/timeScale for this, though -
// inverting that ratio (1/0.5 = 2x, 200px/s) read as too fast in playtesting;
// this is its own dedicated enraged-speed value instead, checked directly
// against Boss.js's `enraged` getter in _updateWalk() below.
const WALK_SPEED_PX_PER_SEC = 100;
const ENRAGE_WALK_SPEED_PX_PER_SEC = 150;

// Wraith of the Shifting Sands (Lvl 3 Miniboss) - also the shared base
// moveset the Lvl 6 Templateboss (Wraith of the Grey City) extends per
// 05_enemies-bosses.md 6.3.1, though that subclass doesn't exist yet.
//
// State machine, one state per sprite clip (see LoadingState.js's
// 'boss-wraith-*' keys) - each clip has its own drawn end pose rather than
// looping back to a neutral frame:
//   idle (loop, at ground level) -> toFiring (rises the arena's full height
//   to the top edge, one-shot) -> firing (static pose at the top, beam
//   starts here) -> toVulnerable (glides back down to ground level while
//   STILL firing - the beam tracks the wraith's position the whole way down,
//   see _activeBeam/WraithBeam.trackY(), only expiring once it lands) ->
//   vulnerable (static pose at ground level, double damage window) ->
//   toIdle (no vertical movement - same ground level as vulnerable, just a
//   pose morph, one-shot) -> walking (horizontal glide to the arena's other
//   fixed side, idle animation looping, facing = travel direction) -> idle
//   (arrived, faces the player, counts down to the next attack), repeat.
// Idle and vulnerable deliberately share the same height (session decision,
// corrected from an earlier "float mid-air" draft) - the wraith is
// grounded except for the trip up top to fire.
// Phase 2 (Boss.js's `enraged`, HP <= 50%) doesn't add a new state, just
// shortens the three hold timers (via `timeScale`) and speeds up the walk
// (via its own dedicated value) - matches the GDD's "same moveset repeats
// faster, no new attack type".
export class Wraith extends Boss {
    /**
     * @param {number} x - World X spawn position.
     * @param {number} y - World Y spawn position (Tiled's EnemySpawn row).
     * @param {Collision} collision - Level collision, for ground/wall scans.
     * @param {Player} player - Tracked to face/aim at.
     */
    constructor(x, y, collision, player) {
        super(x, y, null, WRAITH_WIDTH, WRAITH_HEIGHT);
        this.hp = WRAITH_HP;
        this.maxHp = WRAITH_HP;
        this.contactDamage = WRAITH_CONTACT_DAMAGE;
        this.name = WRAITH_NAME;
        this.collision = collision;
        this.player = player;

        this._initAnchors(collision, x, y);
        this._initStateMachine();
        this._initBeamMailbox();
    }

    /**
     * Ground/top anchors from the actual level, not a fixed offset - scans
     * the real `terrain`/`walls` collision (not Level.js's
     * findGroundSurfaceY, which walks every tile layer including
     * background/decoration art that may not be solid), starting from the
     * Tiled spawn row itself and scanning down from there - not from the
     * very top of the level, or a stacked-platform layout like Lv_3's would
     * find whatever platform happens to be topmost in that column instead
     * of the floor actually under the spawn point, collapsing the rise to a
     * few px instead of the arena's real height. Also sets the two fixed X
     * anchors ("Seitenwechsel") - the spawn position and its mirror across
     * the level's horizontal center, so this adapts to whatever width Lv_3
     * ends up being instead of a hardcoded offset.
     * @param {Collision} collision
     * @param {number} x
     * @param {number} y
     */
    _initAnchors(collision, x, y) {
        this._groundY = this._findGroundY(collision, this.centerX, y) - WRAITH_HEIGHT;
        this._topY = TOP_MARGIN_PX;
        this._sideAX = x;
        this._sideBX = collision.level.pixelWidth - x - WRAITH_WIDTH;
        this._onSideA = true;
    }

    /**
     * Starting pose/timer, plus transition-state-only bookkeeping
     * (toFiring/toVulnerable/toIdle - see _enterTransition()/
     * _updateTransitionMove()).
     */
    _initStateMachine() {
        this.state = 'idle';
        this.currentAnimation = 'idle';
        this._stateTimer = ATTACK_INTERVAL_SECONDS;
        this.y = this._groundY;

        this._transitionFromY = this._groundY;
        this._transitionToY = this._groundY;
        this._transitionElapsed = 0;
        this._transitionDuration = 0;
    }

    /**
     * LevelSession's mailbox for a newly-fired beam - same pattern as
     * Shooter.js's pendingProjectile, drained into its own enemyProjectiles
     * pool right after enemy.update() every frame. `_activeBeam` is a
     * separate, own reference to that same beam (LevelSession clears the
     * mailbox the instant it drains it) - needed so update() can keep
     * calling trackY() on it for as long as the wraith is still firing/
     * descending, cleared once it lands (_enterVulnerable()) or the instant
     * Combat.js kills it on a hit. `pendingRoomDarken` is LevelSession's
     * mailbox for "desaturate the whole boss room except around the
     * player" (session decision) - Wraith doesn't touch ColorZone.js
     * directly.
     */
    _initBeamMailbox() {
        this.pendingProjectile = null;
        this._activeBeam = null;
        this.pendingRoomDarken = false;
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        this._tickTimers(dt);
        if (this.dead) {
            this.animations?.dead?.update(dt);
            return;
        }

        const anim = this.animations?.[this.currentAnimation];
        anim?.update(dt);
        this._trackActiveBeam();
        this._updateFacing();
        this._updateState(dt, anim);
    }

    /**
     * @param {number} dt
     */
    _tickTimers(dt) {
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
        if (this.knockbackTimer > 0) this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    }

    /**
     * "Während er feuert geht er wieder runter" - the beam keeps following
     * the wraith's own position for as long as it's still alive, regardless
     * of which of firing/toVulnerable is currently active (harmless no-op
     * during firing itself, centerY isn't changing yet there).
     */
    _trackActiveBeam() {
        if (this._activeBeam && !this._activeBeam.dead) {
            this._activeBeam.trackY(this.centerY);
        }
    }

    /**
     * Faces the player ("dreht sich um Richtung Spieler") whenever it's not
     * actively committed to firing (toFiring/firing/toVulnerable - the beam
     * is live and tracking during all three, see _trackActiveBeam()) or
     * mid-walk (facing there is travel direction instead, set once in
     * _enterWalking() - a walking mob faces where it's going, not where the
     * player is). Bugfix history: this used to only run during 'idle'
     * itself, but the player naturally crosses to the wraith's other side
     * *during* vulnerable/toIdle (running over to melee it), so freezing
     * facing until idle proper started meant it almost never visibly
     * turned by the time the next attack began.
     */
    _updateFacing() {
        const committed = this.state === 'toFiring' || this.state === 'firing' || this.state === 'toVulnerable';
        if (!committed && this.state !== 'walking' && this.player) {
            this.facing = this.player.centerX >= this.centerX ? 1 : -1;
        }
    }

    /**
     * The state machine dispatch itself - kept as one table rather than
     * split per-state, since jumping between seven near-trivial methods
     * would read worse than the cycle laid out in one place (see the class
     * comment above for the full idle->...->idle sequence this drives).
     * @param {number} dt
     * @param {SpriteAnimation} [anim] - The currently playing clip, if animations are wired up.
     */
    _updateState(dt, anim) {
        switch (this.state) {
            case 'idle':
                this._stateTimer -= dt;
                if (this._stateTimer <= 0) this._enterTransition('toFiring', this._groundY, this._topY);
                break;
            case 'toFiring':
                this._updateTransitionMove(dt);
                if (anim?.finished) this._enterFiring();
                break;
            case 'firing':
                this._stateTimer -= dt;
                if (this._stateTimer <= 0) this._enterTransition('toVulnerable', this._topY, this._groundY);
                break;
            case 'toVulnerable':
                this._updateTransitionMove(dt);
                if (anim?.finished) this._enterVulnerable();
                break;
            case 'vulnerable':
                this._stateTimer -= dt;
                if (this._stateTimer <= 0) this._enterTransition('toIdle', this._groundY, this._groundY);
                break;
            case 'toIdle':
                this._updateTransitionMove(dt);
                if (anim?.finished) this._enterWalking();
                break;
            case 'walking':
                this._updateWalk(dt);
                break;
        }
    }

    /**
     * First solid `terrain`/`walls` row at pxX, scanning down from startY
     * (not from the level's very top) - the real floor a falling entity
     * starting at startY would actually land on, as opposed to Level.js's
     * findGroundSurfaceY() (built for cosmetic static scenes, walks every
     * tile layer regardless of whether it's solid, always from row 0).
     * @param {Collision} collision
     * @param {number} pxX
     * @param {number} startY
     * @returns {number}
     */
    _findGroundY(collision, pxX, startY) {
        const tileSize = collision.level.tileSize;
        for (let y = Math.floor(startY / tileSize) * tileSize; y < collision.level.pixelHeight; y += tileSize) {
            if (collision.isSolidAt(pxX, y)) return y;
        }
        return collision.level.pixelHeight;
    }

    /**
     * Grounded except for the trip up top to fire (session decision) -
     * never affected by contact/melee/ranged knockback, unlike the regular
     * roster. Functionally already inert (nothing in this class ever
     * applies `vx` to position), but overridden explicitly so that stays
     * true on purpose rather than by accident if Boss.js ever grows real
     * vx-based movement.
     */
    applyKnockback() {}

    /**
     * @param {string} key - Animation key to switch to and restart.
     */
    _setAnimation(key) {
        this.currentAnimation = key;
        this.animations?.[key]?.reset();
    }

    /**
     * Shared entry for all three one-shot glides - `telegraphing` (Boss.js's
     * placeholder tint, harmless once real art is wired) only lights up for
     * toFiring, the actual "no instant/unreactable hits" windup. Bugfix
     * (session finding): the vulnerable window was only ever turned off in
     * _enterIdle(), which doesn't run until the *whole* walk to the other
     * side finishes - so a hit landed anywhere across toIdle's pose morph
     * AND the entire walking leg (often several seconds) still doubled,
     * reading as "always double damage" regardless of whether the wraith
     * still looked exposed. The window should end the moment it starts
     * getting up, not once it's already back on patrol.
     * @param {'toFiring'|'toVulnerable'|'toIdle'} state
     * @param {number} fromY
     * @param {number} toY
     */
    _enterTransition(state, fromY, toY) {
        this.state = state;
        this.telegraphing = state === 'toFiring';
        if (state === 'toIdle') this.vulnerable = false;
        this._transitionFromY = fromY;
        this._transitionToY = toY;
        this._transitionElapsed = 0;
        const anim = this.animations?.[state];
        this._transitionDuration = anim ? anim.frameCount * anim.frameDuration : 0;
        this._setAnimation(state);
    }

    /**
     * Linear glide over the clip's own playback duration, not a separate
     * speed constant - so the position always finishes exactly as the
     * animation does, regardless of how the FPS constants get tuned. A
     * no-op when fromY === toY (toIdle - see the class comment above), the
     * interpolation just holds steady while the pose morphs.
     * @param {number} dt
     */
    _updateTransitionMove(dt) {
        this._transitionElapsed += dt;
        const t = this._transitionDuration > 0 ? Math.min(1, this._transitionElapsed / this._transitionDuration) : 1;
        this.y = this._transitionFromY + (this._transitionToY - this._transitionFromY) * t;
    }

    /**
     * Beam starts firing the instant the rise finishes and the firing pose
     * is reached, then keeps firing all the way through the toVulnerable
     * descent (update()'s _trackActiveBeam(), see the class comment above)
     * until it lands. Also kicks off the room-darken (see
     * _initBeamMailbox()'s pendingRoomDarken) at the same instant firing
     * starts.
     */
    _enterFiring() {
        this.telegraphing = false;
        this.y = this._topY;
        this.state = 'firing';
        this._stateTimer = FIRING_HOLD_SECONDS * this.timeScale;
        this._setAnimation('firing');

        const spawnCenterX = this.facing === 1 ? this.x + this.width : this.x;
        const beam = new WraithBeam(spawnCenterX, this.centerY, this.facing, this.collision, SIGNATURE_HIT_DAMAGE);
        this.pendingProjectile = beam;
        this._activeBeam = beam;
        this.pendingRoomDarken = true;
    }

    /**
     * "Unten angekommen sollte er dann angreifbar werden" - landing cuts
     * the beam off explicitly (it has no self-expiry of its own, see
     * WraithBeam.js) rather than leaving it to fizzle out on its own later.
     * Boss.takeDamage() reads `this.vulnerable` directly - this is the only
     * place that flips it on (see _enterIdle() below for off).
     */
    _enterVulnerable() {
        if (this._activeBeam) {
            this._activeBeam.dead = true;
            this._activeBeam = null;
        }
        this.y = this._groundY;
        this.state = 'vulnerable';
        this.vulnerable = true;
        this._stateTimer = VULNERABLE_HOLD_SECONDS * this.timeScale;
        this._setAnimation('vulnerable');
    }

    /**
     * "Seitenwechsel" - heads for whichever of the two fixed anchors it's
     * not currently on. Faces the walk direction (not the player - see
     * _updateFacing()'s `committed` check), same as a regular walking mob.
     * Reuses the idle animation on loop instead of a dedicated walk clip
     * (session decision - no such asset exists).
     */
    _enterWalking() {
        this.state = 'walking';
        this._walkTargetX = this._onSideA ? this._sideBX : this._sideAX;
        this.facing = this._walkTargetX >= this.x ? 1 : -1;
        this._setAnimation('idle');
    }

    /**
     * @param {number} dt
     */
    _updateWalk(dt) {
        const dx = this._walkTargetX - this.x;
        const speed = this.enraged ? ENRAGE_WALK_SPEED_PX_PER_SEC : WALK_SPEED_PX_PER_SEC;
        const step = speed * dt;
        if (Math.abs(dx) <= step) {
            this.x = this._walkTargetX;
            this._onSideA = !this._onSideA;
            this._enterIdle();
        } else {
            this.x += Math.sign(dx) * step;
        }
    }

    /**
     * Arrived at the target side - back to the regular idle/attack cycle,
     * vulnerability window fully closed (see _enterTransition()'s own note
     * on why it's actually cleared earlier, at toIdle).
     */
    _enterIdle() {
        this.y = this._groundY;
        this.state = 'idle';
        this.vulnerable = false;
        this._stateTimer = ATTACK_INTERVAL_SECONDS * this.timeScale;
        this._setAnimation('idle');
    }
}
