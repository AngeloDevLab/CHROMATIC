import { Entity } from './Entity.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

// First-guess, retunes easily - how long the placeholder "opening" flash
// holds before the trapdoor is considered gone, when there's no real
// opens.png strip to drive that timing off of yet (see the constructor's
// sprites-less branch).
const PLACEHOLDER_OPENING_SECONDS = 0.3;

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
    // width/height come from the Tiled object itself (not a fixed constant
    // like Portal.js's SIZE) - session decision: size it to exactly cover
    // the terrain gap it's dressing, rather than a fixed sprite footprint.
    // sprites: optional (undefined until real art exists) - falls back to a
    // flat-color placeholder per state instead of Portal.js's real
    // SpriteAnimation strip.
    // greyFilterCSS: same color-mechanic participation as Portal.js - stays
    // grey (matching the terrain's own unrevealed look) until the player's
    // reveal radius reaches it, otherwise a still-grey trapdoor would stick
    // out against colored ground and give away exactly where it is.
    constructor(x, y, width, height, sprites = null, greyFilterCSS = null) {
        super(x, y, width, height);
        this.sprites = sprites;
        this.opensAnimation = sprites
            ? new SpriteAnimation(sprites.opens, width, height, sprites.opensFrameCount, sprites.opensFps, { loop: false })
            : null;
        this.state = 'closed';
        this._placeholderTimer = 0;
        this.greyFilterCSS = greyFilterCSS;
        this.revealed = false;
    }

    trigger() {
        if (this.state !== 'closed') return;
        this.state = 'opening';
        this._placeholderTimer = 0;
        this.opensAnimation?.reset();
    }

    update(dt) {
        if (this.state !== 'opening') return;

        if (this.opensAnimation) {
            this.opensAnimation.update(dt);
            if (this.opensAnimation.finished) this.state = 'gone';
        } else {
            this._placeholderTimer += dt;
            if (this._placeholderTimer >= PLACEHOLDER_OPENING_SECONDS) this.state = 'gone';
        }
    }

    render(ctx) {
        if (this.state === 'gone') return;

        ctx.save();
        if (!this.revealed) ctx.filter = this.greyFilterCSS;

        if (this.sprites) this._renderSprite(ctx);
        else this._renderPlaceholder(ctx);

        ctx.restore();
    }

    _renderSprite(ctx) {
        if (this.state === 'opening') {
            this.opensAnimation.draw(ctx, this.x, this.y, this.width, this.height);
        } else {
            ctx.drawImage(this.sprites.closed, this.x, this.y, this.width, this.height);
        }
    }

    _renderPlaceholder(ctx) {
        ctx.save();
        ctx.fillStyle = this.state === 'opening' ? '#b06a3a' : '#6b4a2f';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
