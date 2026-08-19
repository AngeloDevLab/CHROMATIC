// takeDamage()/kill() only report back whether the hit was fatal - entering the death animation
// stays player.js's concern.

const max_health = 100;
const max_shield = 100;
const shield_regen_per_second = 1;

const buff_max_health_bonus = 20;
const buff_shield_regen_bonus = 0.5;
const buff_max_shield_bonus = 20;

/**
 * Brief invincibility after any hit, independent of an enemy's own contactCooldown.
 */
const invincibility_seconds = 0.5;

/**
 * Brief white tint on taking damage, deliberately shorter than
 * invincibility_seconds - a quick hit reaction, not a "still invincible" indicator.
 */
const hit_flash_seconds = 0.15;

/** Player's Health/Shield/invincibility/hit-flash bookkeeping, composed onto Player as this.healthState. */
export class PlayerHealth {
    /**
     * Sets health/shield to their max and resets all timers/flags.
     */
    constructor() {
        this.maxHealth = max_health;
        this.health = max_health;
        this.maxShield = max_shield;
        this.shield = max_shield;
        this.shieldRegenPerSecond = shield_regen_per_second;
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
            this.maxHealth += buff_max_health_bonus;
            this.health = this.maxHealth;
        } else if (buffId === 'shieldRegen') {
            this.shieldRegenPerSecond += buff_shield_regen_bonus;
        } else if (buffId === 'maxShield') {
            this.maxShield += buff_max_shield_bonus;
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

        this.invincibleTimer = invincibility_seconds;
        this.hitFlashTimer = hit_flash_seconds;
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
        return this.hitFlashTimer / hit_flash_seconds;
    }
}
