/**
 * Coyote time: how long after walking off a ledge a jump still counts as
 * grounded. Jump buffering: how long an early jump press still fires once grounded.
 */
const COYOTE_TIME_SECONDS = 0.1;
const JUMP_BUFFER_SECONDS = 0.12;

/**
 * Variable jump height: releasing jump early while still rising clamps vy
 * to this fraction of full takeoff speed, for a short hop instead of
 * always launching to full height regardless of tap vs. hold.
 */
const SHORT_HOP_VY_FRACTION = 0.45;

/**
 * Movement feel: ramps vx toward the target speed instead of snapping
 * instantly. Deceleration is faster than acceleration.
 */
const ACCELERATION = 1800;
const DECELERATION = 2600;

/**
 * How long the player can stand idle (grounded, not attacking, no
 * horizontal velocity) before the AFK enter/loop animation takes over -
 * reset by any input, see _updateAfkTimer().
 */
const AFK_TRIGGER_SECONDS = 15;

/**
 * Drop-Through-Platform (03_mechanics.md 4.2, replaces the
 * originally-planned Duck): just enough to push the player past the
 * one-way collision's "already below this surface" threshold before
 * Collision.resolve() runs this same frame - gravity does the rest, no
 * multi-frame "falling through" state needed.
 */
const DROP_NUDGE_PX = 4;

/**
 * @param {number} current
 * @param {number} target
 * @param {number} maxDelta
 * @returns {number}
 */
function moveToward(current, target, maxDelta) {
    if (current < target) return Math.min(current + maxDelta, target);
    if (current > target) return Math.max(current - maxDelta, target);
    return current;
}

// Player's real keyboard-driven movement (Run/Jump/Drop Through Platform/
// Attack-locks-movement), composed onto Player as this.movement - holds a
// `player` reference and reads/writes that instance's own fields directly.
//
// Jump sequencing: _tryGroundJump() runs before _tryDoubleJump() each frame,
// so the two never both fire on the same frame. Walking off a ledge without
// jumping lets the next mid-air press fire as the "double" jump even
// without a first one - intentional, the usual one-bonus-airborne-jump convention.
export class PlayerMovement {
    /**
     * @param {Player} player
     */
    constructor(player) {
        this.player = player;
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        const player = this.player;
        player.healthState.regen(dt);
        this._handleAttackInput();

        const groundedAttack = player.attacking && player.grounded;
        this._updatePhysics(dt, groundedAttack);
        this._resolveCollision(dt);
        this._updateAfkTimer(dt);
        this._updateAnimationState();
    }

    /**
     * @param {number} dt
     * @param {boolean} groundedAttack
     */
    _updatePhysics(dt, groundedAttack) {
        this._updateJumpTimers(dt);
        this.player.dash.update(dt, this.player);
        this._updateHorizontalVelocity(dt, groundedAttack);
        this._applyGravityAndJump(dt);
        this._updateDropThrough();
    }

    /**
     * @param {number} dt
     */
    _resolveCollision(dt) {
        const player = this.player;
        player.grounded = player.collision.resolve(player, dt);
        if (player._wasGrounded === false && player.grounded) player.pendingVfx.push('landing');
        player._wasGrounded = player.grounded;
        if (player.attacking && player.animations.attack.finished) player.attacking = false;
    }

    /**
     * Only accrues while otherwise idle (grounded, not attacking, standing
     * still); any held movement key or one-shot press (attack/pause/interact/touch) resets it.
     * @param {number} dt
     */
    _updateAfkTimer(dt) {
        const player = this.player;
        const standingStill = player.grounded && !player.attacking && player.vx === 0;
        const inputActive = player.input.isDown('left') || player.input.isDown('right')
            || player.input.isDown('jump') || player.input.isDown('drop')
            || player.input.consumeActivity();

        if (!standingStill || inputActive) player.afkTimer = 0;
        else player.afkTimer += dt;
    }

    /**
     * Always drains the click flag, even mid-swing or mid-air.
     */
    _handleAttackInput() {
        const player = this.player;
        const attackPressed = player.input.consumeAttackPress();
        if (attackPressed && !player.attacking && player.animations.attack) {
            this._startAttack();
        }
    }

    /**
     * Coyote time: player.grounded still reflects last frame's collision
     * result here (this frame's own resolve() happens later). Jump
     * buffering: a press is queued for JUMP_BUFFER_SECONDS.
     * @param {number} dt
     */
    _updateJumpTimers(dt) {
        const player = this.player;
        player.coyoteTimer = player.grounded ? COYOTE_TIME_SECONDS : Math.max(0, player.coyoteTimer - dt);
        if (player.grounded) player.doubleJump.reset();

        if (player.input.consumeJumpPress()) player.jumpBufferTimer = JUMP_BUFFER_SECONDS;
        else player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
    }

    /**
     * Attack only roots the player while grounded; airborne, physics keep
     * running normally. A knockback push or an active Dash burst overrides
     * this entirely until it expires.
     * @param {number} dt
     * @param {boolean} groundedAttack
     */
    _updateHorizontalVelocity(dt, groundedAttack) {
        const player = this.player;
        if (player.knockbackTimer > 0) player.knockbackTimer = Math.max(0, player.knockbackTimer - dt);
        const inKnockback = player.knockbackTimer > 0;
        const inDash = player.dash.timer > 0;

        const targetVx = (!inKnockback && !inDash && !groundedAttack) ? this._resolveTargetVx() : 0;
        const accelRate = targetVx === 0 ? DECELERATION : ACCELERATION;
        player.vx = (inKnockback || inDash) ? player.vx : (groundedAttack ? 0 : moveToward(player.vx, targetVx, accelRate * dt));
    }

    /**
     * @returns {number} Target horizontal speed from held movement keys.
     */
    _resolveTargetVx() {
        const player = this.player;
        const left = player.input.isDown('left');
        const right = player.input.isDown('right');
        if (left && !right) {
            player.facing = -1;
            return -player.moveSpeed;
        }
        if (right && !left) {
            player.facing = 1;
            return player.moveSpeed;
        }
        return 0;
    }

    /**
     * @param {number} dt
     */
    _applyGravityAndJump(dt) {
        const player = this.player;
        player.vy += player.gravity * dt;

        if (!this._tryGroundJump() && !this._tryDoubleJump()
            && player.vy < 0 && !player.input.isDown('jump')) {
            player.vy = Math.max(player.vy, -player.jumpSpeed * SHORT_HOP_VY_FRACTION);
        }
    }

    /**
     * Coyote-time/jump-buffer-gated normal jump.
     * @returns {boolean} Whether it fired.
     */
    _tryGroundJump() {
        const player = this.player;
        if (player.attacking || player.jumpBufferTimer <= 0 || player.coyoteTimer <= 0) return false;
        player.vy = -player.jumpSpeed;
        player.jumpBufferTimer = 0;
        player.coyoteTimer = 0;
        player.pendingVfx.push('jump');
        return true;
    }

    /**
     * Fires the double jump if unlocked, unused, and a jump press is buffered.
     * @returns {boolean} Whether it fired.
     */
    _tryDoubleJump() {
        const player = this.player;
        if (player.attacking || !player.doubleJump.unlocked || player.doubleJump.used) return false;
        if (player.jumpBufferTimer <= 0) return false;
        player.vy = -player.jumpSpeed;
        player.jumpBufferTimer = 0;
        player.doubleJump.used = true;
        return true;
    }

    /**
     * Only if there's a real floor below to land on (Collision.hasFloorBelow,
     * not a pit) and the current platform isn't tagged no-drop (Collision.isNoDropBelow).
     */
    _updateDropThrough() {
        const player = this.player;
        if (player.input.consumeDropPress() && !player.attacking && player.grounded
            && player.collision.hasFloorBelow(player) && !player.collision.isNoDropBelow(player)) {
            player.y += DROP_NUDGE_PX;
        }
    }

    /**
     * Locks movement for the swing's duration (base Attack, as opposed to the
     * later Air Attack/Slide+Attack unlockables) - gravity and collision keep
     * resolving normally, only horizontal input is ignored.
     */
    _startAttack() {
        const player = this.player;
        player.attacking = true;
        player._attackImpactResolved = false;
        player.currentAnimation = 'attack';
        player.animations.attack.reset();
    }

    /**
     * Airborne takes priority over running/idle regardless of horizontal
     * input. Switching animations resets it.
     */
    _updateAnimationState() {
        const player = this.player;
        const nextAnimation = this._resolveNextAnimation();
        if (nextAnimation !== player.currentAnimation) {
            player.currentAnimation = nextAnimation;
            player.animations[player.currentAnimation]?.reset();
        }
    }

    /**
     * @returns {string}
     */
    _resolveNextAnimation() {
        const player = this.player;
        if (player.attacking) return 'attack';
        if (!player.grounded) return 'jump';
        if (player.vx === 0) return this._resolveIdleAnimation();
        return 'running';
    }

    /**
     * Idle sub-state machine: idle -> afkEnter (one-shot) -> afk (loops)
     * once afkTimer crosses the threshold, collapsing straight back to idle
     * the instant input resumes (afkTimer resets to 0 the same frame in
     * _updateAfkTimer(), no separate wake-up animation).
     * @returns {'idle'|'afkEnter'|'afk'}
     */
    _resolveIdleAnimation() {
        const player = this.player;
        if (player.afkTimer < AFK_TRIGGER_SECONDS) return 'idle';
        if (player.currentAnimation === 'afkEnter') {
            return player.animations.afkEnter.finished ? 'afk' : 'afkEnter';
        }
        return player.currentAnimation === 'afk' ? 'afk' : 'afkEnter';
    }
}
