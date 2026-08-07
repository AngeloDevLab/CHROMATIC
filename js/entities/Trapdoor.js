import { Entity } from './Entity.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

// Lvl 4's Gimmick (docs/GDD/02_game-structure.md 2.6: "a trapdoor leads to a
// random underground level" - session decision: purely narrative framing,
// one fixed Lv_4, no real level-switch). The fall itself needs no code at
// all - the Tiled object sits directly over a genuine gap in the `terrain`
// layer, so gravity does the work exactly like any other stacked-floor gap.
// This class is purely the visual "the ground gives way" cue layered on top.
// Only two real states (session decision, simpler than Portal.js's
// closed/opening/open): closed -> opening (one-shot breaking animation) ->
// gone. The turf just breaks away and stays broken - there's no separate
// "open" pose to hold afterward, so nothing renders once opening finishes.
export class Trapdoor extends Entity {
    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} width - Width from the Tiled object (sized to exactly cover the terrain gap, not a fixed sprite footprint like Portal.js's SIZE).
     * @param {number} height - Height from the Tiled object.
     * @param {{closed: HTMLImageElement, opens: HTMLImageElement, opensFrameCount: number, opensFps: number}} sprites
     * @param {string} greyFilterCSS - Same color-mechanic participation as Portal.js - stays grey until the player's reveal radius reaches it, so a still-grey trapdoor doesn't stick out against colored ground and give away its position.
     */
    constructor(x, y, width, height, sprites, greyFilterCSS) {
        super(x, y, width, height);
        this.sprites = sprites;
        this.opensAnimation = new SpriteAnimation(sprites.opens, width, height, sprites.opensFrameCount, sprites.opensFps, { loop: false });
        this.state = 'closed';
        this.greyFilterCSS = greyFilterCSS;
        this.revealed = false;
    }

    /**
     * Starts the closed -> opening transition; no-op if already triggered.
     */
    trigger() {
        if (this.state !== 'closed') return;
        this.state = 'opening';
        this.opensAnimation.reset();
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.state !== 'opening') return;

        this.opensAnimation.update(dt);
        if (this.opensAnimation.finished) this.state = 'gone';
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        if (this.state === 'gone') return;

        ctx.save();
        if (!this.revealed) ctx.filter = this.greyFilterCSS;

        if (this.state === 'opening') {
            this.opensAnimation.draw(ctx, this.x, this.y, this.width, this.height);
        } else {
            ctx.drawImage(this.sprites.closed, this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
