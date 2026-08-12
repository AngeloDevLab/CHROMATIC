import { Enemy, HIT_FLASH_SECONDS } from './Enemy.js';

/**
 * 05_enemies-bosses.md 6.2.1: hitting the weak spot during its vulnerable window deals bonus damage.
 */
const VULNERABLE_DAMAGE_MULTIPLIER = 2;

/**
 * 05_enemies-bosses.md 6.2.1: boss attack cycle speeds up once HP drops to half or below.
 */
const ENRAGE_HP_FRACTION = 0.5;
const ENRAGE_TIME_SCALE = 0.5;

// Entity -> Enemy -> Boss -> Templateboss. This layer holds what every boss
// tier shares: the vulnerability-window damage bonus, phase/enrage timing,
// and non-square rendering for tall/wide boss sheets. No sprite/animations
// are wired up for any Boss subclass yet - render() falls back to
// _renderPlaceholder()'s tinted box until then.
export class Boss extends Enemy {
    /**
     * Landed/exposed window (05_enemies-bosses.md 6.2.1), flipped by subclasses during their own state machine.
     */
    vulnerable = false;

    /**
     * Windup telegraph (05_enemies-bosses.md 6.3.1). Only used by _renderPlaceholder() until real animations exist.
     */
    telegraphing = false;

    /**
     * Display name for BossState.js's top-center HP bar label. Set by subclasses after calling super().
     */
    name = null;

    /**
     * Tokens dropped on death (Interactables.js's onBossDefeated()); Templateboss subclasses may override this.
     */
    tokenReward = 1;

    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
    }

    /**
     * Applies incoming damage, doubled while vulnerable.
     * @param {number} amount - Damage to apply.
     * @returns {number} The amount actually applied.
     */
    takeDamage(amount) {
        return super.takeDamage(this.vulnerable ? amount * VULNERABLE_DAMAGE_MULTIPLIER : amount);
    }

    /**
     * @returns {boolean}
     */
    get enraged() {
        return this.hp <= this.maxHp * ENRAGE_HP_FRACTION;
    }

    /**
     * Multiplier applied to attack-cycle durations (windup/vulnerable/interval).
     * @returns {number}
     */
    get timeScale() {
        return this.enraged ? ENRAGE_TIME_SCALE : 1;
    }

    /**
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
     * @param {SpriteAnimation} anim
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
