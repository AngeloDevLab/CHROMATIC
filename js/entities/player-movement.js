// _tryGroundJump() runs before _tryDoubleJump() each frame, so the two never both fire the same
// frame.

const coyote_time_seconds = 0.1;
const jump_buffer_seconds = 0.12;
const short_hop_vy_fraction = 0.45;
const acceleration = 1800;
const deceleration = 2600;
const afk_trigger_seconds = 15;

/**
 * Just enough to push past the one-way collision's landed-this-frame check; gravity finishes the fall.
 */
const drop_nudge_px = 4;

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

/** Player's keyboard-driven movement, composed onto Player as this.movement: acceleration, jump/double-jump, dash, and Drop-Through-Platform. */
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
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    update(deltaTime) {
        const player = this.player;
        player.healthState.regen(deltaTime);
        this._handleAttackInput();

        const groundedAttack = player.attacking && player.grounded;
        this._updatePhysics(deltaTime, groundedAttack);
        this._resolveCollision(deltaTime);
        this._updateAfkTimer(deltaTime);
        this._updateAnimationState();
    }

    /**
     * Advances physics for one frame.
     * @param {number} deltaTime - Elapsed time in seconds.
     * @param {boolean} groundedAttack - Whether the player is mid-swing while grounded.
     */
    _updatePhysics(deltaTime, groundedAttack) {
        this._updateJumpTimers(deltaTime);
        this.player.dash.update(deltaTime, this.player);
        this._updateHorizontalVelocity(deltaTime, groundedAttack);
        this._applyGravityAndJump(deltaTime);
        this._updateDropThrough();
    }

    /**
     * Resolves collision, flags landing VFX on the grounded edge, and clears
     * the attack lock once its animation finishes.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _resolveCollision(deltaTime) {
        const player = this.player;
        player.grounded = player.collision.resolve(player, deltaTime);
        if (player._wasGrounded === false && player.grounded) player.pendingVfx.push('landing');
        player._wasGrounded = player.grounded;
        if (player.attacking && player.animations.attack.finished) player.attacking = false;
    }

    /**
     * Accrues while idle; resets on any input, held or one-shot.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _updateAfkTimer(deltaTime) {
        const player = this.player;
        const standingStill = player.grounded && !player.attacking && player.velocityX === 0;
        const inputActive = player.input.isDown('left') || player.input.isDown('right')
            || player.input.isDown('jump') || player.input.isDown('drop')
            || player.input.consumeActivity();

        if (!standingStill || inputActive) player.afkTimer = 0;
        else player.afkTimer += deltaTime;
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
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _updateJumpTimers(deltaTime) {
        const player = this.player;
        player.coyoteTimer = player.grounded ? coyote_time_seconds : Math.max(0, player.coyoteTimer - deltaTime);
        if (player.grounded) player.doubleJump.reset();

        if (player.input.consumeJumpPress()) player.jumpBufferTimer = jump_buffer_seconds;
        else player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - deltaTime);
    }

    /**
     * Computes horizontal velocity; attack roots the player only while
     * grounded, and knockback/Dash override it entirely until they expire.
     * @param {number} deltaTime - Elapsed time in seconds.
     * @param {boolean} groundedAttack - Whether the player is mid-swing while grounded.
     */
    _updateHorizontalVelocity(deltaTime, groundedAttack) {
        const player = this.player;
        if (player.knockbackTimer > 0) player.knockbackTimer = Math.max(0, player.knockbackTimer - deltaTime);
        const inKnockback = player.knockbackTimer > 0;
        const inDash = player.dash.timer > 0;

        const targetVx = (!inKnockback && !inDash && !groundedAttack) ? this._resolveTargetVx() : 0;
        const accelRate = targetVx === 0 ? deceleration : acceleration;
        player.velocityX = (inKnockback || inDash) ? player.velocityX : (groundedAttack ? 0 : moveToward(player.velocityX, targetVx, accelRate * deltaTime));
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
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _applyGravityAndJump(deltaTime) {
        const player = this.player;
        player.velocityY += player.gravity * deltaTime;

        if (!this._tryGroundJump() && !this._tryDoubleJump()
            && player.velocityY < 0 && !player.input.isDown('jump')) {
            player.velocityY = Math.max(player.velocityY, -player.jumpSpeed * short_hop_vy_fraction);
        }
    }

    /**
     * Attempts a normal ground jump.
     * @returns {boolean} Whether it fired.
     */
    _tryGroundJump() {
        const player = this.player;
        if (player.attacking || player.jumpBufferTimer <= 0 || player.coyoteTimer <= 0) return false;
        player.velocityY = -player.jumpSpeed;
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
        player.velocityY = -player.jumpSpeed;
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
            player.y += drop_nudge_px;
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
        if (player.velocityX === 0) return this._resolveIdleAnimation();
        return 'running';
    }

    /**
     * Picks idle, afkEnter, or afk based on the afk timer; collapses back to
     * idle instantly once input resumes, with no separate wake-up animation.
     * @returns {'idle'|'afkEnter'|'afk'}
     */
    _resolveIdleAnimation() {
        const player = this.player;
        if (player.afkTimer < afk_trigger_seconds) return 'idle';
        if (player.currentAnimation === 'afkEnter') {
            return player.animations.afkEnter.finished ? 'afk' : 'afkEnter';
        }
        return player.currentAnimation === 'afk' ? 'afk' : 'afkEnter';
    }
}
