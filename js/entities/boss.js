import { Enemy, HIT_FLASH_SECONDS } from './enemy.js';

const vulnerable_damage_multiplier = 2;
const enrage_hp_fraction = 0.5;
const enrage_time_scale = 0.5;

/** Base class every boss tier shares: vulnerability-window damage, enrage timing, and non-square sprite rendering. */
export class Boss extends Enemy {
    /**
     * Landed/exposed window, flipped by subclasses during their own state machine.
     */
    vulnerable = false;

    /**
     * Windup telegraph, also used by _renderPlaceholder()'s tint.
     */
    telegraphing = false;

    /**
     * Display name for boss-state.js's top-center HP bar label. Set by subclasses after calling super().
     */
    name = null;

    /**
     * Tokens dropped on death (interactables.js's onBossDefeated()); Templateboss subclasses may override this.
     */
    tokenReward = 1;

    /**
     * Passes through to Enemy's base setup; halves contact self-damage so
     * standing near a boss doesn't chip it as fast as a regular enemy.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.contactSelfDamageMultiplier = 0.5;
    }

    /**
     * Applies incoming damage, doubled while vulnerable - except passive
     * contact self-damage (combat.js), which shouldn't reward just standing next to the boss.
     * @param {number} amount - Damage to apply.
     * @param {object} [options] - Optional settings.
     * @param {boolean} [options.scaleForVulnerable=true] - Whether this hit gets the vulnerable-window bonus.
     * @returns {number} The amount actually applied.
     */
    takeDamage(amount, { scaleForVulnerable = true } = {}) {
        const scaled = this.vulnerable && scaleForVulnerable ? amount * vulnerable_damage_multiplier : amount;
        return super.takeDamage(scaled);
    }

    /**
     * Whether HP has dropped to the enrage threshold or below.
     * @returns {boolean}
     */
    get enraged() {
        return this.hp <= this.maxHp * enrage_hp_fraction;
    }

    /**
     * Multiplier applied to attack-cycle durations (windup/vulnerable/interval).
     * @returns {number}
     */
    get timeScale() {
        return this.enraged ? enrage_time_scale : 1;
    }

    /**
     * Draws the current animation frame, or a placeholder if none is wired up.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.dead && this.deathAnimationFinished) return;

        if (!this.sprite || !this.animations) {
            this._renderPlaceholder(ctx);
            return;
        }

        const anim = this.animations[this.currentAnimation];
        if (!anim || !this.referenceAnim) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
            return;
        }

        this._renderBossFrame(ctx, anim);
    }

    /**
     * Scaled by height only; width follows the sheet's own aspect ratio.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {SpriteAnimation} anim - Currently playing animation.
     */
    _renderBossFrame(ctx, anim) {
        const { renderWidth, renderHeight, drawX, drawY, flashAmount } = this._computeBossFrameRect(anim);

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(drawX + renderWidth, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, renderWidth, renderHeight, flashAmount);
        } else {
            anim.draw(ctx, drawX, drawY, renderWidth, renderHeight, flashAmount);
        }
        ctx.restore();
    }

    /**
     * Computes the frame's render rect and hit-flash amount.
     * @param {SpriteAnimation} anim - Animation to draw the current frame of.
     * @returns {{renderWidth:number, renderHeight:number, drawX:number, drawY:number, flashAmount:number}}
     */
    _computeBossFrameRect(anim) {
        const renderHeight = this.renderSize;
        const renderWidth = renderHeight * (anim.frameWidth / anim.frameHeight);
        const drawY = this.y + this.height - this.referenceAnim.groundLineRatio * renderHeight;
        const drawX = this.x - (renderWidth - this.width) / 2;
        const flashAmount = this.hitFlashTimer / HIT_FLASH_SECONDS;
        return { renderWidth, renderHeight, drawX, drawY, flashAmount };
    }

    /**
     * Colored box placeholder for real art, tinted by state.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderPlaceholder(ctx) {
        ctx.save();
        ctx.globalAlpha = this.dead ? 0.35 : 1;
        ctx.fillStyle = this.vulnerable ? '#ffe75c' : this.telegraphing ? '#ff5c5c' : '#8a5cff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
