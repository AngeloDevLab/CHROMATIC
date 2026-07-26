import { Enemy, HIT_FLASH_SECONDS } from './Enemy.js';

// 05_enemies-bosses.md 6.2.1: "hitting the weak spot during its window deals
// bonus damage" - applies to any Boss/Templateboss subclass that sets
// `vulnerable`, not just Wraith.js (the only one that exists yet).
const VULNERABLE_DAMAGE_MULTIPLIER = 2;

// 05_enemies-bosses.md 6.2.1: "same moveset repeats faster" once a boss drops
// to half HP or below - shared threshold/scale so a future Templateboss
// enrages the same way without re-deriving this. 0.65 (35% faster) read as
// barely noticeable in playtesting; 0.5 (twice the cycle speed) is the value
// that actually reads as a real phase change.
const ENRAGE_HP_FRACTION = 0.5;
const ENRAGE_TIME_SCALE = 0.5;

// Entity -> Enemy -> Boss -> Templateboss (CLAUDE.md's stated hierarchy) -
// this layer holds what every boss tier shares regardless of its own specific
// moveset (Wraith.js today, a second boss family later): the vulnerability-
// window damage bonus, phase/enrage timing, and non-square rendering
// (Enemy.render() assumes a square renderSize, which doesn't fit a tall/wide
// boss sheet like the Wraith's 128x256). No sprite/animations wired up for
// any Boss subclass yet (session decision: build the state machine now, swap
// in real art once the PixelLab export lands) - render() falls back to
// _renderPlaceholder()'s tinted box until then.
export class Boss extends Enemy {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     *
     * vulnerable: landed/exposed window (05_enemies-bosses.md 6.2.1) -
     * subclasses flip this during their own state machine (see Wraith.js),
     * takeDamage() just reacts to it. telegraphing: windup telegraph
     * (05_enemies-bosses.md 6.3.1's "short visible windup") - separate from
     * `vulnerable` since they're different beats of the same attack; only
     * used by _renderPlaceholder() until real animations exist.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.vulnerable = false;
        this.telegraphing = false;
        // Display name for BossState.js's top-center HP bar label (e.g.
        // 05_enemies-bosses.md's "Wraith of the Shifting Sands") - subclasses
        // set this themselves after calling super(), null here is only a
        // fallback for a Boss subclass that hasn't set one yet.
        this.name = null;
    }

    /**
     * Doubles incoming damage instead of gating "can be hit at all" behind a
     * separate flag, so melee/ranged/Combat.js need zero boss-specific code -
     * same reasoning as Charger.js overriding applyAttackKnockback instead
     * of Combat.js branching on enemy type. Returns Enemy.takeDamage()'s own
     * return value (the doubled amount, or 0 if already dead) so Combat.js's
     * damage-number popups show what actually landed, not the caller's
     * pre-multiplier amount.
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
     * Multiplies onto a duration (windup/vulnerable/attack-interval - see
     * Wraith.js) - below 1 so "faster" always means "shorter" at every call
     * site instead of a speed value that'd need inverting.
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
     * Scaled by height only, width follows the sheet's own aspect ratio -
     * same technique as Player.js's attack pose, needed here because every
     * Wraith frame is 128x256 (tall), not the 64x64 square Enemy.render() assumes.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {SpriteAnimation} anim - Currently playing animation.
     */
    _renderBossFrame(ctx, anim) {
        const renderHeight = this.renderSize;
        const renderWidth = renderHeight * (anim.frameWidth / anim.frameHeight);
        const drawY = this.y + this.height - this.referenceAnim.groundLineRatio * renderHeight;
        const drawX = this.x - (renderWidth - this.width) / 2;
        const flashAmount = this.hitFlashTimer / HIT_FLASH_SECONDS;

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
     * Simple colored box stands in for real art, tinted by state so the
     * timing is still readable while testing.
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
