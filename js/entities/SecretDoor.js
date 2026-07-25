import { Entity } from './Entity.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

const PLACEHOLDER_OPENING_SECONDS = 0.3;

// docs/GDD/02_game-structure.md 2.5: "Costs 50 Shield/Prisma to open... the
// player pays with their own color energy". Read directly here rather than
// exported from Combat.js - this isn't a combat cost, just happens to share
// the same currency.
export const SECRET_DOOR_PRISMA_COST = 50;

// Secret Room entrance (Lvl 5) - same closed -> opening -> open lifecycle and
// color-mechanic participation (greyFilterCSS/revealed) as Portal.js, but
// gated on the player affording the Prisma cost above instead of "all
// enemies dead". GameState owns the actual Prisma-spend + interact-range
// logic (see _updateSecretDoor()), this class only tracks/renders state -
// same split of responsibility as Portal.js.
export class SecretDoor extends Entity {
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

    get isOpen() {
        return this.state === 'open';
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
            if (this.opensAnimation.finished) this.state = 'open';
        } else {
            this._placeholderTimer += dt;
            if (this._placeholderTimer >= PLACEHOLDER_OPENING_SECONDS) this.state = 'open';
        }
    }

    render(ctx) {
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
            const sprite = this.state === 'open' ? this.sprites.open : this.sprites.closed;
            ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
        }
    }

    _renderPlaceholder(ctx) {
        ctx.save();
        ctx.fillStyle = this.state === 'open' ? '#3fc6e0' : this.state === 'opening' ? '#7fd8ea' : '#1f4a56';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.restore();
    }
}
