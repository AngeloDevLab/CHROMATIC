import { Projectile } from '../entities/projectile.js';
import {
    resolveMeleeAttack,
    resolveContactDamage,
    resolveProjectileHits,
    resolveEnemyProjectileHits,
    findNearestEnemy,
    isWithinMeleeRange,
    RANGED_ATTACK_DAMAGE,
    RANGED_ATTACK_COOLDOWN_SECONDS,
} from './combat.js';

const hit_stop_seconds = 0.06;

/** Sequences the player's per-frame attack (melee vs ranged) and both projectile pools through combat.js's resolve functions. */
export class CombatCoordinator {
    projectiles = [];

    /**
     * Separate from the player's own projectiles above rather than one
     * shared list with a "whose is this" flag.
     */
    enemyProjectiles = [];

    _hitStopTimer = 0;
    _rangedCooldownTimer = 0;

    /**
     * Wires up the player/enemies/collision this coordinator resolves attacks against.
     * @param {Player} player - Player whose attacks this coordinates.
     * @param {Enemy[]} enemies - Same array reference LevelSession itself iterates.
     * @param {Collision} collision - For resolving projectile flight against terrain.
     * @param {object} options - Construction settings.
     * @param {DamageNumbers} options.damageNumbers - For spawning floating hit numbers.
     * @param {HTMLImageElement} options.thrownSwordSprite - Sprite for the ranged thrown-sword projectile.
     * @param {HTMLImageElement} options.thrownSwordTrailSprite - Trail sprite for the thrown sword.
     * @param {SoundManager} options.sound - For hit/attack sound effects.
     */
    constructor(player, enemies, collision, { damageNumbers, thrownSwordSprite, thrownSwordTrailSprite, sound }) {
        this.player = player;
        this.enemies = enemies;
        this.collision = collision;
        this.damageNumbers = damageNumbers;
        this.thrownSwordSprite = thrownSwordSprite;
        this.thrownSwordTrailSprite = thrownSwordTrailSprite;
        this.sound = sound;
    }

    /**
     * Whether a hit-stop freeze is currently active.
     * @returns {boolean}
     */
    get isFrozen() {
        return this._hitStopTimer > 0;
    }

    /**
     * Counts down the active freeze - only meaningful while isFrozen.
     * @param {number} dt - Elapsed time in seconds.
     */
    tickFrozen(dt) {
        this._hitStopTimer = Math.max(0, this._hitStopTimer - dt);
    }

    /**
     * Runs one frame of attack/projectile/contact-damage resolution.
     * @param {number} dt - Elapsed time in seconds.
     * @param {string} difficulty - Game.difficulty, for incoming-damage scaling (combat.js).
     */
    update(dt, difficulty) {
        this._rangedCooldownTimer = Math.max(0, this._rangedCooldownTimer - dt);
        const hits = this._resolvePlayerAttack();
        hits.push(...this._updateProjectiles(dt));
        this._updateEnemyProjectiles(dt, difficulty);
        hits.push(...this._resolveContactDamage(dt, difficulty));
        this._displayEnemyHits(hits);
    }

    /**
     * Resolves contact damage between the player and enemies this frame, displaying the player's share and returning the enemy's share. A charging enemy's own side is filtered out at 0.
     * @param {number} dt - Elapsed time in seconds.
     * @param {string} difficulty - Game.difficulty, for incoming-damage scaling (combat.js).
     * @returns {{enemy:Enemy,amount:number}[]} Enemy-side contact hits this frame.
     */
    _resolveContactDamage(dt, difficulty) {
        const contactHits = resolveContactDamage(dt, this.player, this.enemies, difficulty);
        this._displayContactHitsOnPlayer(contactHits);
        if (contactHits.length > 0) {
            this._hitStopTimer = hit_stop_seconds;
            this.sound.playSfx('hit-player');
        }
        return contactHits.filter((hit) => hit.enemyAmount > 0).map((hit) => ({ enemy: hit.enemy, amount: hit.enemyAmount }));
    }

    /**
     * Spawns damage numbers on the player for each contact hit received this frame.
     * @param {{enemy:Enemy,playerAmount:number,enemyAmount:number}[]} contactHits - Contact hits landed on the player this frame.
     */
    _displayContactHitsOnPlayer(contactHits) {
        for (const hit of contactHits) {
            this.damageNumbers.spawn(this.player.centerX, this.player.visualTopY, hit.playerAmount);
        }
    }

    /**
     * Resolves the player's attack this frame as melee or a ranged throw, depending on range to the nearest enemy.
     * @returns {{enemy:Enemy,amount:number}[]} Melee hits, if any landed this frame.
     */
    _resolvePlayerAttack() {
        if (!this.player.consumeAttackImpact()) return [];

        const nearest = findNearestEnemy(this.player, this.enemies);
        if (!nearest || isWithinMeleeRange(this.player, nearest)) {
            return resolveMeleeAttack(this.player, this.enemies, this.enemyProjectiles);
        }

        this._throwSwordAt(nearest);
        return [];
    }

    /**
     * Spawns a thrown-sword projectile toward the target, if off cooldown.
     * @param {Enemy} target - Enemy the thrown sword is aimed at.
     */
    _throwSwordAt(target) {
        if (this._rangedCooldownTimer > 0) {
            this.damageNumbers.spawnStatus(this.player.centerX, this.player.visualTopY, 'Ranged Attack on Cooldown');
            return;
        }
        this._rangedCooldownTimer = RANGED_ATTACK_COOLDOWN_SECONDS;

        this.player.facing = target.centerX >= this.player.centerX ? 1 : -1;
        const direction = this.player.facing;
        const spawnCenterX = direction === 1 ? this.player.x + this.player.width : this.player.x;
        this.projectiles.push(new Projectile(spawnCenterX, this.player.centerY, direction, this.thrownSwordSprite, RANGED_ATTACK_DAMAGE, this.thrownSwordTrailSprite));
    }

    /**
     * Advances the player's thrown-sword projectiles and resolves their hits.
     * @param {number} dt - Elapsed time in seconds.
     * @returns {{enemy:Enemy,amount:number}[]} Thrown-sword hits against enemies this frame.
     */
    _updateProjectiles(dt) {
        for (const projectile of this.projectiles) projectile.update(dt, this.collision);
        const hits = resolveProjectileHits(this.projectiles, this.enemies, this.enemyProjectiles);
        this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
        return hits;
    }

    /**
     * Updates enemy-fired projectiles and resolves their hits against the player.
     * @param {number} dt - Elapsed time in seconds.
     * @param {string} difficulty - Game.difficulty, for incoming-damage scaling (combat.js).
     */
    _updateEnemyProjectiles(dt, difficulty) {
        for (const projectile of this.enemyProjectiles) projectile.update(dt, this.collision);
        const playerHits = resolveEnemyProjectileHits(this.enemyProjectiles, this.player, difficulty);
        for (const hit of playerHits) {
            this.damageNumbers.spawn(this.player.centerX, this.player.visualTopY, hit.amount);
        }
        if (playerHits.length > 0) {
            this._hitStopTimer = hit_stop_seconds;
            this.sound.playSfx('hit-player');
        }
        this.enemyProjectiles = this.enemyProjectiles.filter((projectile) => !projectile.dead);
    }

    /**
     * Spawns damage numbers and hit feedback for enemy hits landed this frame.
     * @param {{enemy:Enemy,amount:number}[]} hits - Melee/projectile/contact hits landed on enemies this frame.
     */
    _displayEnemyHits(hits) {
        for (const hit of hits) {
            this.damageNumbers.spawn(hit.enemy.centerX, hit.enemy.visualTopY, hit.amount);
        }
        if (hits.length > 0) {
            this._hitStopTimer = hit_stop_seconds;
            this.sound.playSfx('hit-enemy');
        }
    }

    /**
     * Draws both projectile pools.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        for (const projectile of this.projectiles) projectile.render(ctx);
        for (const projectile of this.enemyProjectiles) projectile.render(ctx);
    }
}
