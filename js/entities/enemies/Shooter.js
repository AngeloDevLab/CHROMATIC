import { Enemy } from '../Enemy.js';
import { ShooterProjectile } from './ShooterProjectile.js';

/**
 * 05_enemies-bosses.md 6.5. 20 HP (2 melee hits) so it doesn't melt
 * instantly if a player does close the distance. Contact/projectile
 * damage both unified to 10 (matches every other enemy type's contact
 * hit) - the table gives one "Damage/Hit" value for the type, reused for both.
 */
const SHOOTER_HP = 20;
const SHOOTER_CONTACT_DAMAGE = 10;
const SHOOTER_PROJECTILE_DAMAGE = 10;

/**
 * "Keeps distance" (05_enemies-bosses.md 6.1) - engages from farther out
 * than Charger's own 190px charge range, since threatening from range
 * rather than needing to close in is this type's whole identity.
 */
const SHOOTER_RANGE_PX = 260;
const SHOOTER_HEIGHT_TOLERANCE_PX = 24;

/**
 * After a shot (windup + recovery), how long before the next - without
 * this it'd fire as fast as the animation allows, reading as a hose
 * rather than individual shots. Paired with the projectile speed
 * (ShooterProjectile.js) so shots read as dodgeable individually rather
 * than a fast, dense stream.
 */
const DEFAULT_SHOT_COOLDOWN_SECONDS = 2;

/**
 * Frame within the 6-frame shoot animation the projectile actually spawns
 * at - mirrors Player.js's ATTACK_IMPACT_FRAME (animation and the actual
 * game-logic spawn are two different things kept in sync by frame index).
 */
const SHOT_IMPACT_FRAME = 3;

// Shooter behavior (05_enemies-bosses.md 6.1: "Keeps distance, fires
// projectiles"). Patrols exactly like the base Enemy/Patroller until the
// player comes within range on roughly the same floor, then holds position
// and fires - overrides _updatePatrol() rather than duplicating it, same
// pattern as Charger.js. Once a shot starts it always plays out and fires
// (facing locked at the moment it started, same commitment reasoning as
// Charger's charge) - a hit landing mid-windup can still shove it around,
// but doesn't cancel the shot itself.
export class Shooter extends Enemy {
    /**
     * GameState's mailbox for a newly-spawned shot - read and cleared
     * there right after enemy.update(), since Shooter itself has no
     * access to the shared enemyProjectiles array.
     */
    pendingProjectile = null;

    /**
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {HTMLImageElement} sprite - Fallback static sprite.
     * @param {number} width - Hitbox width.
     * @param {number} height - Hitbox height.
     */
    constructor(x, y, sprite, width, height) {
        super(x, y, sprite, width, height);
        this.hp = SHOOTER_HP;
        this.maxHp = SHOOTER_HP;
        this.contactDamage = SHOOTER_CONTACT_DAMAGE;

        this.player = null;
        this.projectileSprite = null;
        this.shotCooldownSeconds = DEFAULT_SHOT_COOLDOWN_SECONDS;
        this.shootCooldownTimer = 0;
        this.shooting = false;
        this._shotFired = false;
    }

    /**
     * @param {Player} player - Player instance to watch for range/line of sight.
     * @param {HTMLImageElement} projectileSprite - Sprite for spawned shots.
     * @param {object} [options]
     * @param {number} [options.cooldownSeconds=DEFAULT_SHOT_COOLDOWN_SECONDS]
     */
    enableShoot(player, projectileSprite, { cooldownSeconds = DEFAULT_SHOT_COOLDOWN_SECONDS } = {}) {
        this.player = player;
        this.projectileSprite = projectileSprite;
        this.shotCooldownSeconds = cooldownSeconds;
    }

    /**
     * _updateShooting() is checked unconditionally, independent of
     * knockback/movement below - the shot is purely animation-frame driven,
     * so a hit landing mid-windup shouldn't also desync when it actually fires/ends.
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
     * Decides this frame's velocity: knockback overrides everything else,
     * holding still while mid-shot, starting a new shot the instant the
     * player comes into view off cooldown, otherwise falls back to normal patrol.
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
     * Spawns the actual projectile at SHOT_IMPACT_FRAME, and ends the shot
     * (starting the cooldown) once the animation finishes.
     */
    _updateShooting() {
        const shootAnim = this.animations.shoot;
        if (!shootAnim) {
            this.shooting = false;
            return;
        }

        if (!this._shotFired && shootAnim.currentFrame >= SHOT_IMPACT_FRAME) {
            this._shotFired = true;
            const spawnCenterX = this.facing === 1 ? this.x + this.width : this.x;
            this.pendingProjectile = new ShooterProjectile(spawnCenterX, this.centerY, this.facing, this.projectileSprite, SHOOTER_PROJECTILE_DAMAGE);
        }

        if (shootAnim.finished) {
            this.shooting = false;
            this.shootCooldownTimer = this.shotCooldownSeconds;
        }
    }

    /**
     * shooter-shooting.png is a distinct sprite from the walking/idle one -
     * same reset-on-switch reasoning as Charger.js's _updateChargeAnimation
     * so it never starts mid-frame.
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
     * @returns {boolean}
     */
    _canSeePlayer() {
        if (!this.player || this.player.dead) return false;
        const withinHeight = Math.abs(this.player.centerY - this.centerY) <= SHOOTER_HEIGHT_TOLERANCE_PX;
        const withinRange = Math.abs(this.player.centerX - this.centerX) <= SHOOTER_RANGE_PX;
        return withinHeight && withinRange;
    }
}
