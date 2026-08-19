
/** Composed onto Player as this.doubleJump: tracks whether the extra jump is unlocked/used. */
export class DoubleJumpAbility {
    /**
     * Sets up the unlock flag and used-this-cycle flag.
     */
    constructor() {
        this.unlocked = false;
        this.used = false;
    }

    /** Re-arms the extra jump. */
    reset() {
        this.used = false;
    }
}
