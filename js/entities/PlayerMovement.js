const COYOTE_TIME_SECONDS = 0.1;
const JUMP_BUFFER_SECONDS = 0.12;
const SHORT_HOP_VY_FRACTION = 0.45;
const ACCELERATION = 1800;
const DECELERATION = 2600;
const AFK_TRIGGER_SECONDS = 15;

/**
 * Just enough to push past the one-way collision's landed-this-frame check; gravity finishes the fall.
 */
const DROP_NUDGE_PX = 4;

/**
 * Steps a value toward a target by at most maxDelta.
 * @param {number} current - Starting value.
 * @param {number} target - Value to step toward.
 * @param {number} maxDelta - Maximum change allowed this step.
 * @returns {number}
 */
function moveToward(current, target, maxDelta) {
    if (current < target) return Math.min(current + maxDelta, target);
    if (current > target) return Math.max(current - maxDelta, target);
    return current;
}

// _tryGroundJump() runs before _tryDoubleJump() each frame, so the two never
// both fire the same frame. Walking off a ledge without jumping still lets
// the next mid-air press fire as the double jump - the usual one-bonus-airborne-jump convention.
export class PlayerMovement {
    /**
     * Binds this movement module to the Player it controls.
     * @param {Player} player - Owning Player instance to control.
     */
    constructor(player) {
        this.player = player;
    }

    /**
     * Runs one movement frame.
     * @param {number} dt - Elapsed time in seconds.
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
     * Advances physics for one frame.
     * @param {number} dt - Elapsed time in seconds.
     * @param {boolean} groundedAttack - Whether the player is mid-swing while grounded.
     */
    _updatePhysics(dt, groundedAttack) {
        this._updateJumpTimers(dt);
        this.player.dash.update(dt, this.player);
        this._updateHorizontalVelocity(dt, groundedAttack);
        this._applyGravityAndJump(dt);
        this._updateDropThrough();
    }

    /**
     * Resolves collision, flags landing VFX on the grounded edge, and clears
     * the attack lock once its animation finishes.
     * @param {number} dt - Elapsed time in seconds.
     */
    _resolveCollision(dt) {
        const player = this.player;
        player.grounded = player.collision.resolve(player, dt);
        if (player._wasGrounded === false && player.grounded) player.pendingVfx.push('landing');
        player._wasGrounded = player.grounded;
        if (player.attacking && player.animations.attack.finished) player.attacking = false;
    }

    /**
     * Accrues while idle; resets on any input, held or one-shot.
     * @param {number} dt - Elapsed time in seconds.
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
     * Ticks the coyote and jump-buffer timers; `player.grounded` here still
     * reflects last frame's result.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateJumpTimers(dt) {
        const player = this.player;
        player.coyoteTimer = player.grounded ? COYOTE_TIME_SECONDS : Math.max(0, player.coyoteTimer - dt);
        if (player.grounded) player.doubleJump.reset();

        if (player.input.consumeJumpPress()) player.jumpBufferTimer = JUMP_BUFFER_SECONDS;
        else player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
    }

    /**
     * Computes horizontal velocity; attack roots the player only while
     * grounded, and knockback/Dash override it entirely until they expire.
     * @param {number} dt - Elapsed time in seconds.
     * @param {boolean} groundedAttack - Whether the player is mid-swing while grounded.
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
     * Computes target horizontal speed from input and updates facing.
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
     * Applies gravity, then jump/double-jump/short-hop resolution.
     * @param {number} dt - Elapsed time in seconds.
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
     * Attempts a normal ground jump.
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
     * Attempts a double jump.
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
     * Nudges the player through a droppable one-way platform.
     */
    _updateDropThrough() {
        const player = this.player;
        if (player.input.consumeDropPress() && !player.attacking && player.grounded
            && player.collision.hasFloorBelow(player) && !player.collision.isNoDropBelow(player)) {
            player.y += DROP_NUDGE_PX;
        }
    }

    /**
     * Starts the attack; gravity and collision keep resolving normally,
     * only horizontal input is locked for the swing's duration.
     */
    _startAttack() {
        const player = this.player;
        player.attacking = true;
        player._attackImpactResolved = false;
        player.currentAnimation = 'attack';
        player.animations.attack.reset();
    }

    /**
     * Switches to the next animation, if it changed.
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
     * Picks the animation for this frame.
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
     * Picks idle, afkEnter, or afk based on the afk timer; collapses back to
     * idle instantly once input resumes, with no separate wake-up animation.
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
