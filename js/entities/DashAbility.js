const DASH_SPEED = 400;
const DASH_DURATION_SECONDS = 0.18;
const DASH_COOLDOWN_SECONDS = 0.6;
const DOUBLE_TAP_WINDOW_SECONDS = 0.25;

// Composed onto Player as this.dash (Player.js's _initAbilityState()).
// Detects its own "double-tap A or D" trigger by comparing input.isDown()
// frame-to-frame (see update()). PlayerMovement._updateHorizontalVelocity()
// freezes vx/facing for the burst's duration, same as it does for knockback.
export class DashAbility {
    /**
     * unlocked gates update() entirely (see Player.unlockAbility()); the
     * rest is timer/tap-detection state.
     */
    constructor() {
        this.unlocked = false;
        this.timer = 0;
        this.cooldownTimer = 0;
        this._leftTapWindow = 0;
        this._rightTapWindow = 0;
        this._prevLeft = false;
        this._prevRight = false;
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     * @param {Player} player
     */
    update(dt, player) {
        if (!this.unlocked) return;
        this._tickTimers(dt);
        const left = player.input.isDown('left');
        const right = player.input.isDown('right');
        if (this.timer <= 0) this._detectDoubleTap(player, left, right);
        this._prevLeft = left;
        this._prevRight = right;
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     */
    _tickTimers(dt) {
        if (this.timer > 0) this.timer = Math.max(0, this.timer - dt);
        else if (this.cooldownTimer > 0) this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
        this._leftTapWindow = Math.max(0, this._leftTapWindow - dt);
        this._rightTapWindow = Math.max(0, this._rightTapWindow - dt);
    }

    /**
     * @param {Player} player
     * @param {boolean} left
     * @param {boolean} right
     */
    _detectDoubleTap(player, left, right) {
        if (left && !this._prevLeft) this._registerTap(player, -1, '_leftTapWindow');
        if (right && !this._prevRight) this._registerTap(player, 1, '_rightTapWindow');
    }

    /**
     * @param {Player} player
     * @param {number} direction - -1 (left) or 1 (right).
     * @param {'_leftTapWindow'|'_rightTapWindow'} windowField
     */
    _registerTap(player, direction, windowField) {
        if (this[windowField] > 0 && this.cooldownTimer <= 0 && !player.attacking) {
            this._trigger(player, direction);
        } else {
            this[windowField] = DOUBLE_TAP_WINDOW_SECONDS;
        }
    }

    /**
     * @param {Player} player
     * @param {number} direction - -1 (left) or 1 (right).
     */
    _trigger(player, direction) {
        this.timer = DASH_DURATION_SECONDS;
        this.cooldownTimer = DASH_COOLDOWN_SECONDS;
        player.vx = direction * DASH_SPEED;
        player.facing = direction;
        player.pendingVfx.push('dash');
    }
}
