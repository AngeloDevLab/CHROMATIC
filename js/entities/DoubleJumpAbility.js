// Composed onto Player as this.doubleJump (Player.js's _initAbilityState()) -
// purely queried/mutated from inside Player's existing jump code
// (_applyGravityAndJump()'s _tryDoubleJump(), _updateJumpTimers()'s reset()
// call), no per-frame update() of its own needed.
export class DoubleJumpAbility {
    /**
     * unlocked gates whether _tryDoubleJump() can fire at all (see
     * Player.unlockAbility()); used tracks the current grounded cycle's
     * extra jump, reset() by Player._updateJumpTimers().
     */
    constructor() {
        this.unlocked = false;
        this.used = false;
    }

    /** Re-arms the extra jump - called once by Player._updateJumpTimers() the frame it's grounded. */
    reset() {
        this.used = false;
    }
}
