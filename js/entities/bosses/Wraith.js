import { Boss } from '../Boss.js';
import { WraithBeam } from './WraithBeam.js';
import { computeWraithAnchors } from './WraithAnchors.js';
import {
    WRAITH_WIDTH,
    WRAITH_HEIGHT,
    WRAITH_HP,
    SIGNATURE_HIT_DAMAGE,
    WRAITH_CONTACT_DAMAGE,
    WRAITH_NAME,
    ATTACK_INTERVAL_SECONDS,
    FIRING_HOLD_SECONDS,
    VULNERABLE_HOLD_SECONDS,
    WALK_SPEED_PX_PER_SEC,
    ENRAGE_WALK_SPEED_PX_PER_SEC,
} from './WraithConstants.js';

// Wraith of the Shifting Sands (Lvl 3 Miniboss) - also the shared base
// moveset WraithTemplateboss.js (Lvl 6, Wraith of the Grey City) extends,
// per 05_enemies-bosses.md 6.3.1.
//
// State machine, one state per sprite clip (see LoadingState.js's
// 'boss-wraith-*' keys):
//   idle (loop, ground level) -> toFiring (rises to the top edge) ->
//   firing (static pose at the top, beam starts) -> toVulnerable (glides
//   back down while still firing) -> vulnerable (static pose at ground
//   level, double damage window) -> toIdle (pose morph, no movement) ->
//   walking (glide to the arena's other fixed side) -> idle (repeat).
//
// Phase 2 (Boss.js's `enraged`, HP <= 50%) shortens the three hold timers
// (via `timeScale`) and speeds up the walk (via its own dedicated value).
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
        this.signatureHitDamage = SIGNATURE_HIT_DAMAGE;
        this.name = WRAITH_NAME;
        this.collision = collision;
        this.player = player;

        Object.assign(this, computeWraithAnchors(collision, x, y));
        this._initStateMachine();
        this._initBeamMailbox();
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
     * Resets the beam/room-darken mailbox.
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
     * Keeps the active beam following the wraith's position, if it's still alive.
     */
    _trackActiveBeam() {
        if (this._activeBeam && !this._activeBeam.dead) {
            this._activeBeam.track(this.centerX, this.centerY);
        }
    }

    /**
     * Turns to face the player, except while committed to firing or traveling.
     */
    _updateFacing() {
        const committed = this.state === 'toFiring' || this.state === 'firing' || this.state === 'toVulnerable';
        const traveling = this.state === 'walking' || this.state === 'firingSweep';
        if (!committed && !traveling && this.player) {
            this.facing = this.player.centerX >= this.centerX ? 1 : -1;
        }
    }

    /**
     * State machine dispatch (see the class comment above for the full
     * sequence). `default` is reachable only via subclasses;
     * WraithTemplateboss.js's 'firingSweep' lands there.
     * @param {number} dt
     * @param {SpriteAnimation} [anim] - The currently playing clip, if animations are wired up.
     */
    _updateState(dt, anim) {
        switch (this.state) {
            case 'idle': this._updateIdleState(dt); break;
            case 'toFiring': this._updateToFiringState(dt, anim); break;
            case 'firing': this._updateFiringState(dt); break;
            case 'toVulnerable': this._updateToVulnerableState(dt, anim); break;
            case 'vulnerable': this._updateVulnerableState(dt); break;
            case 'toIdle': this._updateToIdleState(dt, anim); break;
            case 'walking': this._updateWalk(dt); break;
            default: this._updateCustomState(dt, anim); break;
        }
    }

    /**
     * @param {number} dt
     */
    _updateIdleState(dt) {
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) this._enterTransition('toFiring', this._groundY, this._topY);
    }

    /**
     * @param {number} dt
     * @param {SpriteAnimation} [anim]
     */
    _updateToFiringState(dt, anim) {
        this._updateTransitionMove(dt);
        if (anim?.finished) this._onRiseComplete();
    }

    /**
     * @param {number} dt
     */
    _updateFiringState(dt) {
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) this._enterTransition('toVulnerable', this._topY, this._groundY);
    }

    /**
     * @param {number} dt
     * @param {SpriteAnimation} [anim]
     */
    _updateToVulnerableState(dt, anim) {
        this._updateTransitionMove(dt);
        if (anim?.finished) this._enterVulnerable();
    }

    /**
     * @param {number} dt
     */
    _updateVulnerableState(dt) {
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) this._enterTransition('toIdle', this._groundY, this._groundY);
    }

    /**
     * @param {number} dt
     * @param {SpriteAnimation} [anim]
     */
    _updateToIdleState(dt, anim) {
        this._updateTransitionMove(dt);
        if (anim?.finished) this._enterWalking();
    }

    /**
     * @param {number} dt
     * @param {SpriteAnimation} [anim]
     */
    _updateCustomState(dt, anim) {}

    /**
     * Reached the top of toFiring's rise - fires horizontally.
     * WraithTemplateboss.js overrides this to roll an axis first.
     */
    _onRiseComplete() {
        this._enterFiring('horizontal');
    }

    /**
     * No-op - the wraith is never affected by knockback.
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
     * Shared entry for all three one-shot glides (toFiring/toVulnerable/toIdle).
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
     * Linear glide over the clip's own playback duration rather than a
     * fixed speed constant. A no-op when fromY === toY (toIdle), holding
     * position steady while the pose morphs.
     * @param {number} dt
     */
    _updateTransitionMove(dt) {
        this._transitionElapsed += dt;
        const t = this._transitionDuration > 0 ? Math.min(1, this._transitionElapsed / this._transitionDuration) : 1;
        this.y = this._transitionFromY + (this._transitionToY - this._transitionFromY) * t;
    }

    /**
     * Fires the beam and kicks off the room-darken.
     * @param {'horizontal'|'vertical'} [axis='horizontal'] - Only 'horizontal' is reachable from this base class; WraithTemplateboss.js's _onRiseComplete() is the only caller that ever passes 'vertical'.
     */
    _enterFiring(axis = 'horizontal') {
        this.telegraphing = false;
        this.y = this._topY;
        this.state = 'firing';
        this._stateTimer = FIRING_HOLD_SECONDS * this.timeScale;
        this._setAnimation('firing');

        const spawnCenterX = this.facing === 1 ? this.x + this.width : this.x;
        const beam = new WraithBeam(spawnCenterX, this.centerY, this.facing, this.collision, this.signatureHitDamage, axis);
        this.pendingProjectile = beam;
        this._activeBeam = beam;
        this.pendingRoomDarken = true;
    }

    /**
     * Ends the active beam and enters the vulnerable state. The only place
     * that sets `vulnerable = true` (Boss.takeDamage() reads it directly).
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
     * Heads for whichever of the two fixed anchors it isn't currently on,
     * facing the walk direction. Reuses the idle animation (no dedicated walk clip).
     */
    _enterWalking() {
        this.state = 'walking';
        this._walkTargetX = this._onSideA ? this._sideBX : this._sideAX;
        this.facing = this._walkTargetX >= this.x ? 1 : -1;
        this._setAnimation('idle');
    }

    /**
     * X-interpolation toward _walkTargetX, shared by 'walking' and (via
     * WraithTemplateboss.js) 'firingSweep' - only arrival behavior differs, see _onArrived().
     * @param {number} dt
     */
    _updateWalk(dt) {
        const dx = this._walkTargetX - this.x;
        const speed = this.enraged ? ENRAGE_WALK_SPEED_PX_PER_SEC : WALK_SPEED_PX_PER_SEC;
        const step = speed * dt;
        if (Math.abs(dx) <= step) {
            this.x = this._walkTargetX;
            this._onSideA = !this._onSideA;
            this._onArrived();
        } else {
            this.x += Math.sign(dx) * step;
        }
    }

    /**
     * Reached _walkTargetX - the Miniboss always resumes idle;
     * WraithTemplateboss.js overrides this to fire the vertical sweep's
     * beam-off/descend transition instead, when arriving from 'firingSweep'.
     */
    _onArrived() {
        this._enterIdle();
    }

    /**
     * Arrived at the target side - resumes the regular idle/attack cycle.
     */
    _enterIdle() {
        this.y = this._groundY;
        this.state = 'idle';
        this.vulnerable = false;
        this._stateTimer = ATTACK_INTERVAL_SECONDS * this.timeScale;
        this._setAnimation('idle');
    }
}
