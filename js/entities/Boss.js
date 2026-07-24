import { Enemy, HIT_FLASH_SECONDS } from './Enemy.js';

// 05_enemies-bosses.md 6.2.1: "hitting the weak spot during its window deals
// bonus damage" - applies to any Boss/Templateboss subclass that sets
// `vulnerable`, not just Wraith.js (the only one that exists yet).
const VULNERABLE_DAMAGE_MULTIPLIER = 2;

// 05_enemies-bosses.md 6.2.1: "same moveset repeats faster" once a boss drops
// to half HP or below - shared threshold/scale so a future Templateboss
// enrages the same way without re-deriving this.
const ENRAGE_HP_FRACTION = 0.5;
const ENRAGE_TIME_SCALE = 0.65;

// Entity -> Enemy -> Boss -> Templateboss (CLAUDE.md's stated hierarchy) -
// this layer holds what every boss tier shares regardless of its own specific
// moveset (Wraith.js today, a second boss family later): the vulnerability-
// window damage bonus, phase/enrage timing, and non-square rendering
// (Enemy.render() assumes a square renderSize, which doesn't fit a tall/wide
// boss sheet like the Wraith's 128x256).
export class Boss extends Enemy {
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        // Landed/exposed window (05_enemies-bosses.md 6.2.1) - subclasses flip
        // this during their own state machine (see Wraith.js), takeDamage()
        // below just reacts to it.
        this.vulnerable = false;
        // Windup telegraph (05_enemies-bosses.md 6.3.1's "short visible
        // windup") - separate from `vulnerable` since they're different beats
        // of the same attack; only used by _renderPlaceholder() below until
        // real animations exist.
        this.telegraphing = false;
    }

    // Doubles incoming damage instead of gating "can be hit at all" behind a
    // separate flag, so melee/ranged/Combat.js need zero boss-specific code -
    // same reasoning as Charger.js overriding applyAttackKnockback instead of
    // Combat.js branching on enemy type.
    takeDamage(amount) {
        super.takeDamage(this.vulnerable ? amount * VULNERABLE_DAMAGE_MULTIPLIER : amount);
    }

    get enraged() {
        return this.hp <= this.maxHp * ENRAGE_HP_FRACTION;
    }

    // Multiplies onto a duration (windup/vulnerable/attack-interval - see
    // Wraith.js) - below 1 so "faster" always means "shorter" at every call
    // site instead of a speed value that'd need inverting.
    get timeScale() {
        return this.enraged ? ENRAGE_TIME_SCALE : 1;
    }

    render(ctx) {
        if (this.dead && this.deathAnimationFinished) return;

        // No sprite/animations wired yet for any Boss subclass (session
        // decision: build the state machine now, swap in real art once the
        // PixelLab export lands) - simple colored box stands in, tinted by
        // state so the timing is still readable while testing.
        if (!this.sprite || !this.animations) {
            this._renderPlaceholder(ctx);
            return;
        }

        const anim = this.animations[this.currentAnimation];
        if (!anim || !this.referenceAnim) {
            ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
            return;
        }

        // Scaled by height only, width follows the sheet's own aspect ratio -
        // same technique as Player.js's attack pose, needed here because
        // every Wraith frame is 128x256 (tall), not the 64x64 square
        // Enemy.render() assumes.
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
