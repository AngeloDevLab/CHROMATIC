/**
 * 04_health-save-system.md 5.1/5.2: both base value 100.
 */
const MAX_HEALTH = 100;
const MAX_SHIELD = 100;

/**
 * 03_mechanics.md 4.5: "50 points (1 Secret Room) take about 50 seconds from empty".
 */
const SHIELD_REGEN_PER_SECOND = 1;

/**
 * Secret Room buff amounts (02_game-structure.md 2.5).
 */
const BUFF_MAX_HEALTH_BONUS = 20;
const BUFF_SHIELD_REGEN_BONUS = 0.5;
const BUFF_MAX_SHIELD_BONUS = 20;

/**
 * Brief invincibility after any hit, independent of an enemy's own contactCooldown.
 */
const INVINCIBILITY_SECONDS = 0.5;

/**
 * Brief white tint on taking damage, deliberately shorter than
 * INVINCIBILITY_SECONDS - a quick hit reaction, not a "still invincible" indicator.
 */
const HIT_FLASH_SECONDS = 0.15;

// Player's Health/Shield/buff bookkeeping (03_mechanics.md 4.5,
// 02_game-structure.md 2.5), composed onto Player rather than mixed into its
// movement/animation state. takeDamage()/kill() report back whether the hit
// was fatal instead of entering the death animation themselves - that stays
// an animation concern Player.js owns (see its _enterDeathAnimation()).
export class PlayerHealth {
    /**
     * shieldRegenPerSecond is an instance field, not the module constant directly.
     */
    constructor() {
        this.maxHealth = MAX_HEALTH;
        this.health = MAX_HEALTH;
        this.maxShield = MAX_SHIELD;
        this.shield = MAX_SHIELD;
        this.shieldRegenPerSecond = SHIELD_REGEN_PER_SECOND;
        this.invincibleTimer = 0;
        this.hitFlashTimer = 0;
        this.dead = false;
        this.godmode = false;
    }

    /**
     * @param {'maxHealth'|'shieldRegen'|'maxShield'} buffId
     */
    applyBuff(buffId) {
        if (buffId === 'maxHealth') {
            this.maxHealth += BUFF_MAX_HEALTH_BONUS;
            this.health = this.maxHealth;
        } else if (buffId === 'shieldRegen') {
            this.shieldRegenPerSecond += BUFF_SHIELD_REGEN_BONUS;
        } else if (buffId === 'maxShield') {
            this.maxShield += BUFF_MAX_SHIELD_BONUS;
            this.shield = this.maxShield;
        }
    }

    /**
     * 03_mechanics.md 4.5: Shield absorbs hits first, only once fully
     * depleted does the remainder carry over to Health.
     * @param {number} amount
     * @returns {boolean} Whether this hit brought health to 0.
     */
    takeDamage(amount) {
        if (this.dead || this.invincibleTimer > 0 || this.godmode) return false;

        if (this.shield > 0) {
            const overflow = amount - this.shield;
            this.shield = Math.max(0, this.shield - amount);
            if (overflow > 0) this.health = Math.max(0, this.health - overflow);
        } else {
            this.health = Math.max(0, this.health - amount);
        }

        this.invincibleTimer = INVINCIBILITY_SECONDS;
        this.hitFlashTimer = HIT_FLASH_SECONDS;
        if (this.health === 0) this.dead = true;
        return this.health === 0;
    }

    /**
     * Instant kill bypassing Shield/invincibility entirely.
     * @returns {boolean} Whether this actually killed (false if already dead/godmode).
     */
    kill() {
        if (this.dead || this.godmode) return false;
        this.shield = 0;
        this.health = 0;
        this.dead = true;
        return true;
    }

    /**
     * Spends Prisma as a resource cost (the ranged Sword Throw), not as
     * incoming damage - no overflow-to-health carry, invincibility window, or hit-flash.
     * @param {number} amount
     * @returns {boolean} Whether there was enough to spend; doesn't partially consume on failure.
     */
    consumeShield(amount) {
        if (this.shield < amount) return false;
        this.shield -= amount;
        return true;
    }

    /**
     * @param {number} dt
     */
    regen(dt) {
        this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenPerSecond * dt);
    }

    /** Still ticks while dead, so the killing blow's white flash still fades. @param {number} dt */
    tickHitFlash(dt) {
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    /** @param {number} dt */
    tickInvincibility(dt) {
        if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }

    /** @returns {number} 0-1 white-tint amount for the current hit flash. */
    get flashAmount() {
        return this.hitFlashTimer / HIT_FLASH_SECONDS;
    }
}
