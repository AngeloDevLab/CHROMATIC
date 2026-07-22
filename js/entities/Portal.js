import { Entity } from './Entity.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

// portal-closed.png/portal-open.png/portal-opens.png are all 128x128 (opens
// is a 10-frame strip, 1280x128).
const SIZE = 128;
const OPENS_FRAME_COUNT = 10;
const OPENS_FPS = 12;

// Marks a level's end (01_core-gameplay-loop.md "Reach the exit portal/level
// end - back to the Worldmap"). Three real states: closed -> opening (plays
// portal-opens.png once) -> open, driven by GameState flipping `active` once
// every enemy is dead (_levelFullyRevealed) - never flips back off, so this
// never needs to reverse the transition. Interact range/[E] handling lives in
// GameState (see isOpen below), this class only tracks/renders the state.
export class Portal extends Entity {
    // greyFilterCSS: GameState's own ColorZone.greyFilterCSS, so the portal's
    // unrevealed look matches the terrain's grey treatment exactly rather
    // than a second, potentially-drifting copy of the same tint constants.
    // Unlike Player/Enemy (always full color, see ColorZone.js's own design
    // note on why a scrolling/moving thing can't participate in the terrain's
    // reveal), the portal sits at one fixed world position for the whole
    // level, so a simple one-way `revealed` flag (GameState.js flips it once
    // the player gets close, or immediately on the level's full-reveal) can
    // track it directly without needing a real per-pixel reveal mechanism.
    constructor(x, y, sprites, greyFilterCSS) {
        super(x, y, SIZE, SIZE);
        this.closedSprite = sprites.closed;
        this.openSprite = sprites.open;
        this.opensAnimation = new SpriteAnimation(sprites.opens, SIZE, SIZE, OPENS_FRAME_COUNT, OPENS_FPS, { loop: false });
        this.active = false;
        this.state = 'closed';
        this.greyFilterCSS = greyFilterCSS;
        this.revealed = false;
    }

    // Only true once the opening animation has fully played - GameState gates
    // the [E] interact prompt on this rather than on `active` directly, so
    // the player sees the full opening beat before it's actually usable.
    get isOpen() {
        return this.state === 'open';
    }

    update(dt) {
        if (this.active && this.state === 'closed') {
            this.state = 'opening';
            this.opensAnimation.reset();
        }

        if (this.state === 'opening') {
            this.opensAnimation.update(dt);
            if (this.opensAnimation.finished) this.state = 'open';
        }
    }

    render(ctx) {
        ctx.save();
        if (!this.revealed) ctx.filter = this.greyFilterCSS;

        if (this.state === 'opening') {
            this.opensAnimation.draw(ctx, this.x, this.y, this.width, this.height);
        } else {
            const sprite = this.state === 'open' ? this.openSprite : this.closedSprite;
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }

        ctx.restore();
    }
}
