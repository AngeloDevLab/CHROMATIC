const MAX_HEALTH = 100;
const MAX_SHIELD = 100;
const SHIELD_REGEN_PER_SECOND = 1;

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

// takeDamage()/kill() report back whether the hit was fatal; entering the
// death animation stays Player.js's concern.
export class PlayerHealth {
    /**
     * Sets health/shield to their max and resets all timers/flags.
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
     * Applies a Secret Room buff's bonus to the matching stat.
     * @param {'maxHealth'|'shieldRegen'|'maxShield'} buffId - Buff to apply.
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
     * Shield absorbs hits first; only once depleted does the remainder carry over to Health.
     * @param {number} amount - Damage amount.
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
     * Spends Shield as a resource cost, not incoming damage - no overflow-to-health, invincibility, or hit-flash.
     * @param {number} amount - Shield amount to spend.
     * @returns {boolean} Whether there was enough to spend; doesn't partially consume on failure.
     */
    consumeShield(amount) {
        if (this.shield < amount) return false;
        this.shield -= amount;
        return true;
    }

    /**
     * Regenerates Shield over time, up to its max.
     * @param {number} dt - Elapsed time in seconds.
     */
    regen(dt) {
        this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenPerSecond * dt);
    }

    /** Counts down the hit-flash timer; still ticks while dead. @param {number} dt - Elapsed time in seconds. */
    tickHitFlash(dt) {
        if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    /** Counts down the invincibility timer. @param {number} dt - Elapsed time in seconds. */
    tickInvincibility(dt) {
        if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }

    /** White-tint amount for the current hit flash, 0-1. @returns {number} */
    get flashAmount() {
        return this.hitFlashTimer / HIT_FLASH_SECONDS;
    }
}
