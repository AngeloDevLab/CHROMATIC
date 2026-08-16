// Composed onto Player as this.doubleJump. Purely queried/mutated from
// PlayerMovement.js's jump code - no per-frame update() of its own.
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
