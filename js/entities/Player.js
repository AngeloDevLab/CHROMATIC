import { Entity } from './Entity.js';

// Sprite frames carry transparent padding around the character (room for
// animation), so the collision hitbox is intentionally narrower than the full
// render size - matches the previous 32x64 footprint per
// 10_technical-architecture.md 11.7.2, independent of how big the sprite
// canvas itself is.
const HITBOX_WIDTH = 32;
const HITBOX_HEIGHT = 64;
const TARGET_VISIBLE_HEIGHT = 64;

export class Player extends Entity {
    constructor(x, y, animations) {
        super(x, y, HITBOX_WIDTH, HITBOX_HEIGHT);
        this.animations = animations;
        this.currentAnimation = 'idle';
        this.facing = 1;

        // Scale the render size up so the *visible* character (excluding the
        // sprite's own padding) measures roughly TARGET_VISIBLE_HEIGHT, instead
        // of naively drawing the whole padded frame at that size - which would
        // make the actual character look noticeably smaller than intended.
        const idle = animations.idle;
        const visibleFraction = idle ? idle.groundLineRatio - idle.topRatio : 1;
        this.renderSize = TARGET_VISIBLE_HEIGHT / visibleFraction;

        this.autopilot = false;
        this._autopilotSpeed = 0;
        this._autopilotBounds = null;

        this.controlled = false;
        this.grounded = false;

        this.attacking = false;
    }

    enableAutopilot(speed, bounds) {
        this.autopilot = true;
        this._autopilotSpeed = speed;
        this._autopilotBounds = bounds;
        this.vx = speed;
        this.currentAnimation = 'running';
    }

    // Real keyboard-driven movement (04_health-save-system.md base abilities:
    // Run, Jump, Duck) - used by GameState, as opposed to the menu's autopilot.
    enableControl(input, collision, { moveSpeed = 150, jumpSpeed = 360, gravity = 700 } = {}) {
        this.controlled = true;
        this.input = input;
        this.collision = collision;
        this.moveSpeed = moveSpeed;
        this.jumpSpeed = jumpSpeed;
        this.gravity = gravity;
    }

    update(dt) {
        if (this.autopilot) {
            this._updateAutopilot();
            super.update(dt);
        } else if (this.controlled) {
            this._updateControlled(dt);
        }

        this.animations[this.currentAnimation]?.update(dt);
    }

    _updateAutopilot() {
        const { minX, maxX } = this._autopilotBounds;
        if (this.x <= minX && this.vx < 0) {
            this.x = minX;
            this.vx = this._autopilotSpeed;
            this.facing = 1;
        } else if (this.x >= maxX && this.vx > 0) {
            this.x = maxX;
            this.vx = -this._autopilotSpeed;
            this.facing = -1;
        }
    }

    _updateControlled(dt) {
        // Always drain the click flag, even mid-swing or mid-air - otherwise a
        // click that arrives while unable to act right now would queue up and
        // fire late once the state allows it, instead of being simply missed.
        const attackPressed = this.input.consumeAttackPress();
        if (attackPressed && !this.attacking && this.animations.attack) {
            this._startAttack();
        }

        const left = !this.attacking && this.input.isDown('left');
        const right = !this.attacking && this.input.isDown('right');
        // Ducking has no crouch sprite/hitbox yet - placeholder just locks
        // movement, reusing the idle animation, until real duck art exists.
        const ducking = !this.attacking && this.input.isDown('duck') && this.grounded;

        if (this.attacking || ducking) {
            this.vx = 0;
        } else if (left && !right) {
            this.vx = -this.moveSpeed;
            this.facing = -1;
        } else if (right && !left) {
            this.vx = this.moveSpeed;
            this.facing = 1;
        } else {
            this.vx = 0;
        }

        this.vy += this.gravity * dt;

        if (!this.attacking && this.input.isDown('jump') && this.grounded && !ducking) {
            this.vy = -this.jumpSpeed;
        }

        this.grounded = this.collision.resolve(this, dt);

        if (this.attacking && this.animations.attack.finished) {
            this.attacking = false;
        }

        this._updateAnimationState(ducking);
    }

    // Locks movement for the swing's duration (base Attack, as opposed to the
    // later Air Attack/Slide+Attack unlockables - 03_mechanics.md 4.2) - gravity
    // and collision keep resolving as normal, only horizontal input is ignored.
    _startAttack() {
        this.attacking = true;
        this.currentAnimation = 'attack';
        this.animations.attack.reset();
    }

    // Airborne takes priority over running/idle regardless of horizontal
    // input, so jumping while moving still shows the jump pose. Switching
    // animations resets it, so a jump never starts mid-way through whatever
    // frame idle/running happened to be on last.
    _updateAnimationState(ducking) {
        let nextAnimation;
        if (this.attacking) {
            nextAnimation = 'attack';
        } else if (!this.grounded) {
            nextAnimation = 'jump';
        } else if (ducking || this.vx === 0) {
            nextAnimation = 'idle';
        } else {
            nextAnimation = 'running';
        }

        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.animations[this.currentAnimation]?.reset();
        }
    }

    // Always anchored to idle's feet position, not the current animation's own
    // - jump's tucked-legs pose has a much higher "lowest opaque pixel" than
    // standing idle, so anchoring per-animation would shift the character up
    // and down on screen every time it switches animation (looking like it
    // floats above the ground, or sinks through a ceiling it's not actually
    // touching, relative to the real hitbox). One fixed reference keeps the
    // visible sprite stable regardless of pose.
    _drawY() {
        const referenceAnim = this.animations.idle;
        const groundSurfaceY = this.y + this.height;
        return groundSurfaceY - referenceAnim.groundLineRatio * this.renderSize;
    }

    // The sprite is drawn wider/taller than the hitbox (renderSize vs
    // width/height) - center it horizontally over the narrower hitbox instead
    // of aligning their left edges, or the character would visibly lean to one
    // side of its own collision box.
    _drawX() {
        return this.x - (this.renderSize - this.width) / 2;
    }

    // The true visual middle of the character (accounting for sprite padding),
    // as opposed to Entity's generic centerY which is just the hitbox midpoint.
    get visualCenterY() {
        const referenceAnim = this.animations.idle;
        if (!referenceAnim) return this.centerY;

        const drawY = this._drawY();
        const topY = drawY + referenceAnim.topRatio * this.renderSize;
        const bottomY = drawY + referenceAnim.groundLineRatio * this.renderSize;
        return (topY + bottomY) / 2;
    }

    render(ctx) {
        const anim = this.animations[this.currentAnimation];
        if (!anim) return;

        const drawX = this._drawX();
        const drawY = this._drawY();

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(drawX + this.renderSize, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, this.renderSize, this.renderSize);
        } else {
            anim.draw(ctx, drawX, drawY, this.renderSize, this.renderSize);
        }
        ctx.restore();
    }
}
