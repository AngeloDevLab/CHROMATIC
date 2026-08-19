import { Boss } from '../boss.js';
import { WraithBeam } from './wraith-beam.js';
import { computeWraithAnchors } from './wraith-anchors.js';
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
} from './wraith-constants.js';

// Wraith of the Shifting Sands (Lvl 3 Miniboss); also the shared base moveset
// wraith-templateboss.js (Lvl 6) extends.
//
// State machine, one state per sprite clip: idle -> toFiring -> firing ->
// toVulnerable -> vulnerable -> toIdle -> walking -> idle.
//
// Phase 2 (enraged, HP <= 50%) shortens the hold timers and speeds up the walk.
export class Wraith extends Boss {
    /**
     * Sets up Wraith's stats, arena anchors, and state machine.
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
     * Sets initial pose/timer and transition-glide bookkeeping.
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
     * Runs one Wraith frame.
     * @param {number} dt - Elapsed time in seconds.
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
     * Counts down hit-flash and knockback timers.
     * @param {number} dt - Elapsed time in seconds.
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
     * State machine dispatch. `default` is reachable only via subclasses
     * (wraith-templateboss.js's 'firingSweep').
     * @param {number} dt - Elapsed time in seconds.
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
     * Counts down the idle hold, then starts rising to firing.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateIdleState(dt) {
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) this._enterTransition('toFiring', this._groundY, this._topY);
    }

    /**
     * Advances the rise glide, firing once it completes.
     * @param {number} dt - Elapsed time in seconds.
     * @param {SpriteAnimation} [anim] - The currently playing clip.
     */
    _updateToFiringState(dt, anim) {
        this._updateTransitionMove(dt);
        if (anim?.finished) this._onRiseComplete();
    }

    /**
     * Counts down the firing hold, then starts descending to vulnerable.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateFiringState(dt) {
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) this._enterTransition('toVulnerable', this._topY, this._groundY);
    }

    /**
     * Advances the descent glide, exposing the weak spot once it completes.
     * @param {number} dt - Elapsed time in seconds.
     * @param {SpriteAnimation} [anim] - The currently playing clip.
     */
    _updateToVulnerableState(dt, anim) {
        this._updateTransitionMove(dt);
        if (anim?.finished) this._enterVulnerable();
    }

    /**
     * Counts down the vulnerable window, then starts returning to idle.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateVulnerableState(dt) {
        this._stateTimer -= dt;
        if (this._stateTimer <= 0) this._enterTransition('toIdle', this._groundY, this._groundY);
    }

    /**
     * Advances the idle-return glide, then starts walking once it completes.
     * @param {number} dt - Elapsed time in seconds.
     * @param {SpriteAnimation} [anim] - The currently playing clip.
     */
    _updateToIdleState(dt, anim) {
        this._updateTransitionMove(dt);
        if (anim?.finished) this._enterWalking();
    }

    /**
     * No-op; overridden by subclasses for extra states.
     * @param {number} dt - Elapsed time in seconds.
     * @param {SpriteAnimation} [anim] - The currently playing clip.
     */
    _updateCustomState(dt, anim) {}

    /**
     * Reached the top of toFiring's rise - fires horizontally.
     * wraith-templateboss.js overrides this to roll an axis first.
     */
    _onRiseComplete() {
        this._enterFiring('horizontal');
    }

    /**
     * No-op - the wraith is never affected by knockback.
     */
    applyKnockback() {}

    /**
     * Switches to an animation and restarts it.
     * @param {string} key - Animation key to switch to and restart.
     */
    _setAnimation(key) {
        this.currentAnimation = key;
        this.animations?.[key]?.reset();
    }

    /**
     * Shared entry for all three one-shot glides (toFiring/toVulnerable/toIdle).
     * @param {'toFiring'|'toVulnerable'|'toIdle'} state - Transition state to enter.
     * @param {number} fromY - Y position to glide from.
     * @param {number} toY - Y position to glide to.
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
     * Linear glide over the clip's playback duration, not a fixed speed.
     * No-ops when fromY === toY (toIdle), holding position while the pose morphs.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateTransitionMove(dt) {
        this._transitionElapsed += dt;
        const t = this._transitionDuration > 0 ? Math.min(1, this._transitionElapsed / this._transitionDuration) : 1;
        this.y = this._transitionFromY + (this._transitionToY - this._transitionFromY) * t;
    }

    /**
     * Fires the beam and kicks off the room-darken.
     * @param {'horizontal'|'vertical'} [axis='horizontal'] - 'vertical' is only used by wraith-templateboss.js.
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
     * Ends the active beam and enters vulnerable state; the only place `vulnerable` is set to true.
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
     * Heads for the fixed anchor it isn't currently on, facing that direction.
     * Reuses the idle animation (no dedicated walk clip).
     */
    _enterWalking() {
        this.state = 'walking';
        this._walkTargetX = this._onSideA ? this._sideBX : this._sideAX;
        this.facing = this._walkTargetX >= this.x ? 1 : -1;
        this._setAnimation('idle');
    }

    /**
     * Moves toward `_walkTargetX`, shared by 'walking' and (via subclass) 'firingSweep'.
     * @param {number} dt - Elapsed time in seconds.
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
     * Reached `_walkTargetX`; resumes idle. Overridden by wraith-templateboss.js
     * for the firingSweep arrival.
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
