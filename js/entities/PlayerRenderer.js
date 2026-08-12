const TARGET_VISIBLE_HEIGHT = 64;

/**
 * Poses whose sheet doesn't share idle's padding-to-character ratio, mapped
 * to the animation whose bounds should drive their render scale (see
 * _renderDimensions()). afk shares afkEnter's bounds to avoid a size pop
 * when the loop takes over.
 */
const OWN_BOUNDS_SOURCE = { attack: 'attack', afkEnter: 'afkEnter', afk: 'afkEnter' };

/**
 * Max AFK art-alignment nudge, in pixels - ramped up 1px per afkEnter frame (see _afkYOffset()).
 */
const AFK_Y_OFFSET = 5;

// Player's sprite-drawing pipeline, composed onto Player rather than mixed
// into its movement/health state - reads position/size/facing/animation off
// the player reference passed in and owns nothing else.
export class PlayerRenderer {
    /**
     * @param {Player} player
     */
    constructor(player) {
        this.player = player;
        this.renderSize = this._computeRenderSize(player.animations);
    }

    /**
     * Scales the render size so the *visible* character (excluding the
     * sprite's own padding) measures TARGET_VISIBLE_HEIGHT, instead of the whole padded frame.
     * @param {object} animations
     * @returns {number}
     */
    _computeRenderSize(animations) {
        const idle = animations.idle;
        const visibleFraction = idle ? idle.groundLineRatio - idle.topRatio : 1;
        return TARGET_VISIBLE_HEIGHT / visibleFraction;
    }

    /**
     * Anchored to idle's feet position, not the current animation's own -
     * e.g. jump's tucked-legs pose has a much higher lowest-opaque-pixel than idle.
     * @param {SpriteAnimation} [referenceAnim]
     * @param {number} [renderSize]
     * @returns {number}
     */
    _drawY(referenceAnim = this.player.animations.idle, renderSize = this.renderSize) {
        const groundSurfaceY = this.player.y + this.player.height;
        return groundSurfaceY - referenceAnim.groundLineRatio * renderSize;
    }

    /**
     * Centers the wider sprite over the narrower hitbox, instead of aligning left edges.
     * @param {number} [renderWidth]
     * @returns {number}
     */
    _drawX(renderWidth = this.renderSize) {
        return this.player.x - (renderWidth - this.player.width) / 2;
    }

    /**
     * Topmost visible pixel row (accounting for sprite padding), mirrors
     * Enemy.js's visualTopY - used to sit UI just above the player's head instead of the raw hitbox.
     * @returns {number}
     */
    get visualTopY() {
        const referenceAnim = this.player.animations.idle;
        if (!referenceAnim) return this.player.y;
        return this._drawY() + referenceAnim.topRatio * this.renderSize;
    }

    /**
     * True visual middle of the character (accounting for sprite padding), as
     * opposed to Entity's generic centerY (just the hitbox midpoint).
     * @returns {number}
     */
    get visualCenterY() {
        const referenceAnim = this.player.animations.idle;
        if (!referenceAnim) return this.player.centerY;

        const drawY = this._drawY();
        const topY = drawY + referenceAnim.topRatio * this.renderSize;
        const bottomY = drawY + referenceAnim.groundLineRatio * this.renderSize;
        return (topY + bottomY) / 2;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        const anim = this.player.animations[this.player.currentAnimation];
        if (!anim) return;

        const boundsKey = OWN_BOUNDS_SOURCE[this.player.currentAnimation];
        const boundsAnim = boundsKey ? this.player.animations[boundsKey] : null;
        const { width: renderWidth, height: renderHeight } = this._renderDimensions(anim, boundsAnim);
        const drawX = this._drawX(renderWidth);
        const drawY = (boundsAnim ? this._drawY(boundsAnim, renderHeight) : this._drawY()) + this._afkYOffset();

        this._drawSprite(ctx, anim, drawX, drawY, renderWidth, renderHeight, this.player.healthState.flashAmount);
    }

    /**
     * Ramps from 0 to AFK_Y_OFFSET 1px per afkEnter frame as it plays, then
     * holds at the max once afkEnter finishes and afk's loop takes over.
     * @returns {number}
     */
    _afkYOffset() {
        const name = this.player.currentAnimation;
        if (name !== 'afkEnter' && name !== 'afk') return 0;
        return Math.min(this.player.animations.afkEnter.currentFrame, AFK_Y_OFFSET);
    }

    /**
     * Computes the render width/height for the current animation, scaled from boundsAnim's bounds when the pose uses a differently-padded sheet.
     * @param {SpriteAnimation} anim
     * @param {?SpriteAnimation} boundsAnim
     * @returns {{width:number, height:number}}
     */
    _renderDimensions(anim, boundsAnim) {
        if (!boundsAnim) return { width: this.renderSize, height: this.renderSize };

        const height = TARGET_VISIBLE_HEIGHT / (boundsAnim.groundLineRatio - boundsAnim.topRatio);
        const width = height * (anim.frameWidth / anim.frameHeight);
        return { width, height };
    }

    /**
     * Facing -1 mirrors the sprite horizontally via a canvas transform
     * instead of a separate flipped asset.
     * @param {CanvasRenderingContext2D} ctx
     * @param {SpriteAnimation} anim
     * @param {number} drawX
     * @param {number} drawY
     * @param {number} renderWidth
     * @param {number} renderHeight
     * @param {number} flashAmount
     */
    _drawSprite(ctx, anim, drawX, drawY, renderWidth, renderHeight, flashAmount) {
        ctx.save();
        if (this.player.facing === -1) {
            ctx.translate(drawX + renderWidth, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, renderWidth, renderHeight, flashAmount);
        } else {
            anim.draw(ctx, drawX, drawY, renderWidth, renderHeight, flashAmount);
        }
        ctx.restore();
    }
}
