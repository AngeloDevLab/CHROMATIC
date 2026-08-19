// Once a shot starts, facing locks and it always plays out - a hit mid-windup can shove it around
// but won't cancel it.

import { Enemy } from '../enemy.js';
import { ShooterProjectile } from './shooter-projectile.js';

/**
 * Contact and projectile damage both match every other enemy type's contact hit.
 */
const shooter_hp = 20;
const shooter_contact_damage = 20;
const shooter_projectile_damage = 20;

/**
 * Engages from farther out than Charger's own 190px charge range.
 */
const shooter_range_px = 260;
const shooter_height_tolerance_px = 24;

/**
 * Paired with the projectile speed (shooter-projectile.js).
 */
const default_shot_cooldown_seconds = 2;

/**
 * 10-frame shoot animation; mirrors player.js's ATTACK_IMPACT_FRAME.
 */
const shot_impact_frame = 5;

/** Enemy that patrols until the player is in range, then holds position and fires a projectile. */
export class Shooter extends Enemy {
    /**
     * GameState's mailbox for a newly-spawned shot - read and cleared there right after enemy.update().
     */
    pendingProjectile = null;

    /**
     * Sets Shooter's HP/contact-damage and default shooting state.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.hp = shooter_hp;
        this.maxHp = shooter_hp;
        this.contactDamage = shooter_contact_damage;

        this.player = null;
        this.projectileSprite = null;
        this.shotCooldownSeconds = default_shot_cooldown_seconds;
        this.shootCooldownTimer = 0;
        this.shooting = false;
        this._shotFired = false;
    }

    /**
     * Arms this Shooter to track a player and fire projectiles.
     * @param {Player} player - Player instance to watch for range/line of sight.
     * @param {HTMLImageElement} projectileSprite - Sprite for spawned shots.
     * @param {object} [options] - Optional settings.
     * @param {number} [options.cooldownSeconds=default_shot_cooldown_seconds] - Seconds between shots.
     */
    enableShoot(player, projectileSprite, { cooldownSeconds = default_shot_cooldown_seconds } = {}) {
        this.player = player;
        this.projectileSprite = projectileSprite;
        this.shotCooldownSeconds = cooldownSeconds;
    }

    /**
     * Applies gravity, ticks the shot, moves, and resolves collision for one frame.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updatePatrol(dt) {
        this.vy += this.gravity * dt;

        if (this.shootCooldownTimer > 0) this.shootCooldownTimer = Math.max(0, this.shootCooldownTimer - dt);
        if (this.shooting) this._updateShooting();

        this._updateMovement(dt);

        this._updateAnimationState();
        this.grounded = this.collision.resolve(this, dt);
    }

    /**
     * Priority: knockback, then an active shot, then starting one, then patrol fallback.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateMovement(dt) {
        if (this.knockbackTimer > 0) {
            this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
        } else if (this.shooting) {
            this.vx = 0;
        } else if (this.grounded && this._canSeePlayer() && this.shootCooldownTimer <= 0) {
            this._startShooting();
        } else {
            if (this.grounded && this._blockedAhead()) this.facing *= -1;
            this.vx = this.patrolSpeed * this.facing;
        }
    }

    /**
     * Locks facing toward the player and begins the shot windup.
     */
    _startShooting() {
        this.facing = this.player.centerX >= this.centerX ? 1 : -1;
        this.shooting = true;
        this._shotFired = false;
        this.vx = 0;
    }

    /**
     * Drives the shot through its spawn and end checks.
     */
    _updateShooting() {
        const shootAnim = this.animations.shoot;
        if (!shootAnim) {
            this.shooting = false;
            return;
        }

        this._trySpawnProjectile(shootAnim);
        this._tryEndShot(shootAnim);
    }

    /**
     * Fires the pending projectile once, at the animation's impact frame.
     * @param {SpriteAnimation} shootAnim - Active shoot animation to read the impact frame from.
     */
    _trySpawnProjectile(shootAnim) {
        if (this._shotFired || shootAnim.currentFrame < shot_impact_frame) return;
        this._shotFired = true;
        const spawnCenterX = this.facing === 1 ? this.x + this.width : this.x;
        this.pendingProjectile = new ShooterProjectile(spawnCenterX, this.centerY, this.facing, this.projectileSprite, shooter_projectile_damage);
    }

    /**
     * Ends the shot and starts the cooldown once the animation finishes.
     * @param {SpriteAnimation} shootAnim - Active shoot animation to check for completion.
     */
    _tryEndShot(shootAnim) {
        if (!shootAnim.finished) return;
        this.shooting = false;
        this.shootCooldownTimer = this.shotCooldownSeconds;
    }

    /**
     * Swaps to the shooting sprite while shooting, resetting on switch.
     */
    _updateAnimationState() {
        if (!this.animations?.shoot) return;

        const nextAnimation = this.shooting ? 'shoot' : 'running';
        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.animations[nextAnimation].reset();
        }
    }

    /**
     * Checks whether the player is within shooting range and height.
     * @returns {boolean}
     */
    _canSeePlayer() {
        if (!this.player || this.player.dead) return false;
        const withinHeight = Math.abs(this.player.centerY - this.centerY) <= shooter_height_tolerance_px;
        const withinRange = Math.abs(this.player.centerX - this.centerX) <= shooter_range_px;
        return withinHeight && withinRange;
    }
}
