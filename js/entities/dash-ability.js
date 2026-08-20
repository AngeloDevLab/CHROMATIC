// PlayerMovement freezes velocityX/facing for the dash's duration, the same way it does for knockback.

const dash_speed = 400;
const dash_duration_seconds = 0.18;
const dash_cooldown_seconds = 0.6;
const double_tap_window_seconds = 0.25;

/** Composed onto Player as this.dash: detects a double-tap and fires a brief velocity burst. */
export class DashAbility {
    /**
     * Sets up unlock/timer/tap-detection state.
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
     * Ticks dash timers and checks for a double-tap trigger.
     * @param {number} deltaTime - Elapsed time in seconds.
     * @param {Player} player - Player performing the dash.
     */
    update(deltaTime, player) {
        if (!this.unlocked) return;
        this._tickTimers(deltaTime);
        const left = player.input.isDown('left');
        const right = player.input.isDown('right');
        if (this.timer <= 0) this._detectDoubleTap(player, left, right);
        this._prevLeft = left;
        this._prevRight = right;
    }

    /**
     * Counts down the dash/cooldown timers and tap windows.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _tickTimers(deltaTime) {
        if (this.timer > 0) this.timer = Math.max(0, this.timer - deltaTime);
        else if (this.cooldownTimer > 0) this.cooldownTimer = Math.max(0, this.cooldownTimer - deltaTime);
        this._leftTapWindow = Math.max(0, this._leftTapWindow - deltaTime);
        this._rightTapWindow = Math.max(0, this._rightTapWindow - deltaTime);
    }

    /**
     * Checks left/right for a fresh keydown against the tap window.
     * @param {Player} player - Player performing the dash.
     * @param {boolean} left - Whether the left action is currently held.
     * @param {boolean} right - Whether the right action is currently held.
     */
    _detectDoubleTap(player, left, right) {
        if (left && !this._prevLeft) this._registerTap(player, -1, '_leftTapWindow');
        if (right && !this._prevRight) this._registerTap(player, 1, '_rightTapWindow');
    }

    /**
     * Starts the tap window, or triggers the dash if already primed.
     * @param {Player} player - Player performing the dash.
     * @param {number} direction - -1 (left) or 1 (right).
     * @param {'_leftTapWindow'|'_rightTapWindow'} windowField - Which tap-window field to check/reset.
     */
    _registerTap(player, direction, windowField) {
        if (this[windowField] > 0 && this.cooldownTimer <= 0 && !player.attacking) {
            this._trigger(player, direction);
        } else {
            this[windowField] = double_tap_window_seconds;
        }
    }

    /**
     * Fires the dash: sets velocity, facing, and cooldown.
     * @param {Player} player - Player performing the dash.
     * @param {number} direction - -1 (left) or 1 (right).
     */
    _trigger(player, direction) {
        this.timer = dash_duration_seconds;
        this.cooldownTimer = dash_cooldown_seconds;
        player.velocityX = direction * dash_speed;
        player.facing = direction;
        player.pendingVfx.push('dash');
    }
}
