// Coyote time: how long after walking off a ledge a jump still counts as
// grounded. Jump buffering: how long an early jump press still fires once
// grounded. Both mask the single-frame window a rigid grounded-check would
// otherwise need, which reads as unresponsive on a keyboard.
const COYOTE_TIME_SECONDS = 0.1;
const JUMP_BUFFER_SECONDS = 0.12;
// Variable jump height: releasing jump early while still rising clamps vy to
// this fraction of full takeoff speed, for a short hop instead of always
// launching to full height regardless of tap vs. hold.
const SHORT_HOP_VY_FRACTION = 0.45;

// Movement feel: ramps vx toward the target speed instead of snapping
// instantly. Deceleration is faster than acceleration so stopping still reads as responsive.
const ACCELERATION = 1800;
const DECELERATION = 2600;

// Drop-Through-Platform (03_mechanics.md 4.2, replaces the originally-planned
// Duck): just enough to push the player past the one-way collision's
// "already below this surface" threshold before Collision.resolve() runs
// this same frame - gravity does the rest, no multi-frame "falling through" state needed.
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
// Attack-locks-movement), composed onto Player as this.movement rather than
// mixed into its mode-dispatch/health/render state - same shape as
// PlayerRenderer.js: holds a `player` reference and reads/writes that
// instance's own fields directly (grounded/attacking/coyoteTimer/etc. stay
// on Player itself, e.g. PlayerFx.js/DashAbility.js already read/write
// player.grounded/player.attacking directly) rather than owning a second,
// parallel copy of that state.
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
        this._updateJumpTimers(dt);
        player.dash.update(dt, player);
        this._updateHorizontalVelocity(dt, groundedAttack);
        this._applyGravityAndJump(dt);
        this._updateDropThrough();

        player.grounded = player.collision.resolve(player, dt);
        if (player._wasGrounded === false && player.grounded) player.pendingVfx.push('landing');
        player._wasGrounded = player.grounded;
        if (player.attacking && player.animations.attack.finished) player.attacking = false;
        this._updateAnimationState();
    }

    /**
     * Always drains the click flag, even mid-swing or mid-air - otherwise a
     * click arriving while unable to act would queue up and fire late once
     * allowed, instead of simply being missed.
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
     * result here (this frame's own resolve() happens later), so walking off
     * a ledge doesn't instantly close the jump window. Jump buffering: a
     * press is queued for JUMP_BUFFER_SECONDS so a tap slightly before
     * landing still fires once grounded.
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
     * Attack only roots the player while grounded - airborne, physics keep
     * running normally instead of freezing horizontal movement mid-air. A
     * knockback push, or an active Dash burst (DashAbility.js's _trigger()
     * sets vx/facing once, this just holds them for its duration), overrides
     * this entirely until it expires.
     * @param {number} dt
     * @param {boolean} groundedAttack
     */
    _updateHorizontalVelocity(dt, groundedAttack) {
        const player = this.player;
        if (player.knockbackTimer > 0) player.knockbackTimer = Math.max(0, player.knockbackTimer - dt);
        const inKnockback = player.knockbackTimer > 0;
        const inDash = player.dash.timer > 0;

        const left = !groundedAttack && player.input.isDown('left');
        const right = !groundedAttack && player.input.isDown('right');
        let targetVx = 0;
        if (!inKnockback && !inDash && !groundedAttack) {
            if (left && !right) {
                targetVx = -player.moveSpeed;
                player.facing = -1;
            } else if (right && !left) {
                targetVx = player.moveSpeed;
                player.facing = 1;
            }
        }
        const accelRate = targetVx === 0 ? DECELERATION : ACCELERATION;
        player.vx = (inKnockback || inDash) ? player.vx : (groundedAttack ? 0 : moveToward(player.vx, targetVx, accelRate * dt));
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
     * Only reached once _tryGroundJump() has already failed this frame, so
     * this never fires within the same frame as a normal/coyote-time jump.
     * Reuses jumpBufferTimer as the "a jump press is pending" signal
     * (already fed by consumeJumpPress() in _updateJumpTimers()) rather than
     * a separate raw press check - consuming it here also stops the same
     * buffered press from replaying as a bogus extra jump the instant the
     * player lands. Note: walking off a ledge without jumping (coyote
     * expires with doubleJump.used still false) means the next mid-air jump
     * press fires as the "double" jump even without a first one - intentional,
     * the usual "one bonus airborne jump per grounded cycle" genre convention.
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
     * not a pit) and the current platform isn't tagged no-drop
     * (Collision.isNoDropBelow - an intended solid path). The resolve() call
     * right after immediately overwrites `grounded` with this frame's real
     * result, so the nudge is the only thing that actually matters here.
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
     * input. Switching animations resets it, so a jump never starts mid-way
     * through whatever frame idle/running happened to be on.
     */
    _updateAnimationState() {
        const player = this.player;
        let nextAnimation;
        if (player.attacking) {
            nextAnimation = 'attack';
        } else if (!player.grounded) {
            nextAnimation = 'jump';
        } else if (player.vx === 0) {
            nextAnimation = 'idle';
        } else {
            nextAnimation = 'running';
        }

        if (nextAnimation !== player.currentAnimation) {
            player.currentAnimation = nextAnimation;
            player.animations[player.currentAnimation]?.reset();
        }
    }
}
