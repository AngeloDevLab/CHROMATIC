import { Entity } from './Entity.js';

const RENDER_SIZE = 64;

export class Player extends Entity {
    constructor(x, y, animations) {
        super(x, y, RENDER_SIZE, RENDER_SIZE);
        this.animations = animations;
        this.currentAnimation = 'idle';
        this.facing = 1;

        this.autopilot = false;
        this._autopilotSpeed = 0;
        this._autopilotBounds = null;

        this.controlled = false;
        this.grounded = false;
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
    enableControl(input, collision, { moveSpeed = 120, jumpSpeed = 260, gravity = 700 } = {}) {
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
        const left = this.input.isDown('left');
        const right = this.input.isDown('right');
        // Ducking has no crouch sprite/hitbox yet - placeholder just locks
        // movement, reusing the idle animation, until real duck art exists.
        const ducking = this.input.isDown('duck') && this.grounded;

        if (ducking) {
            this.vx = 0;
            this.currentAnimation = 'idle';
        } else if (left && !right) {
            this.vx = -this.moveSpeed;
            this.facing = -1;
            this.currentAnimation = 'running';
        } else if (right && !left) {
            this.vx = this.moveSpeed;
            this.facing = 1;
            this.currentAnimation = 'running';
        } else {
            this.vx = 0;
            this.currentAnimation = 'idle';
        }

        this.vy += this.gravity * dt;

        if (this.input.isDown('jump') && this.grounded && !ducking) {
            this.vy = -this.jumpSpeed;
        }

        this.grounded = this.collision.resolve(this, dt);
    }

    _drawY(anim) {
        const groundSurfaceY = this.y + this.height;
        return groundSurfaceY - anim.groundLineRatio * this.height;
    }

    // The true visual middle of the character (accounting for sprite padding),
    // as opposed to Entity's generic centerY which is just the hitbox midpoint.
    get visualCenterY() {
        const anim = this.animations[this.currentAnimation];
        if (!anim) return this.centerY;

        const drawY = this._drawY(anim);
        const topY = drawY + anim.topRatio * this.height;
        const bottomY = drawY + anim.groundLineRatio * this.height;
        return (topY + bottomY) / 2;
    }

    render(ctx) {
        const anim = this.animations[this.currentAnimation];
        if (!anim) return;

        const drawY = this._drawY(anim);

        ctx.save();
        if (this.facing === -1) {
            ctx.translate(this.x + this.width, drawY);
            ctx.scale(-1, 1);
            anim.draw(ctx, 0, 0, this.width, this.height);
        } else {
            anim.draw(ctx, this.x, drawY, this.width, this.height);
        }
        ctx.restore();
    }
}
