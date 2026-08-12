import { Projectile } from '../entities/Projectile.js';
import {
    resolveMeleeAttack,
    resolveContactDamage,
    resolveProjectileHits,
    resolveEnemyProjectileHits,
    findNearestEnemy,
    isWithinMeleeRange,
    RANGED_ATTACK_DAMAGE,
    RANGED_ATTACK_COOLDOWN_SECONDS,
} from './Combat.js';

// Combat feel: a brief total freeze the instant a hit lands. LevelSession.
// update() early-returns while isFrozen is true (render() keeps drawing the
// last frame).
const HIT_STOP_SECONDS = 0.06;

// Sequences the player's per-frame attack decision (melee vs the ranged
// thrown-sword) and both projectile pools (the player's own throw, and
// enemy-fired shots/beams) through Combat.js's pure resolve* functions,
// extracted out of LevelSession.js. Owns the hit-stop timer too -
// LevelSession only ever needs to ask isFrozen() and call tickFrozen(dt).
//
// Contact damage (Combat.js's resolveContactDamage) is bidirectional: the
// player's share is displayed directly, the enemy's share is folded into the
// shared per-frame hits array so it goes through the same sfx/hit-stop path
// as melee/projectile hits. A charging enemy's own side is 0 for that tick,
// filtered out so it doesn't display a stray "0".
//
// Attack resolution (03_mechanics.md 4.3): melee if the nearest enemy is in
// reach, a thrown-sword projectile otherwise. The ranged throw has its own cooldown.
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
     * @param {Player} player
     * @param {Enemy[]} enemies - Same array reference LevelSession itself iterates.
     * @param {Collision} collision - For resolving projectile flight against terrain.
     * @param {object} options
     * @param {DamageNumbers} options.damageNumbers
     * @param {HTMLImageElement} options.thrownSwordSprite
     * @param {HTMLImageElement} options.thrownSwordTrailSprite
     * @param {SoundManager} options.sound
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
     * @returns {boolean} Whether a hit-stop freeze is currently active.
     */
    get isFrozen() {
        return this._hitStopTimer > 0;
    }

    /**
     * Counts down the active freeze - only meaningful while isFrozen.
     * @param {number} dt
     */
    tickFrozen(dt) {
        this._hitStopTimer = Math.max(0, this._hitStopTimer - dt);
    }

    /**
     * @param {number} dt
     * @param {string} difficulty - Game.difficulty, for incoming-damage scaling (Combat.js).
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
     * Resolves contact damage between the player and enemies this frame, displaying the player's share and returning the enemy's share.
     * @param {number} dt
     * @param {string} difficulty
     * @returns {{enemy:Enemy,amount:number}[]} Enemy-side contact hits this frame.
     */
    _resolveContactDamage(dt, difficulty) {
        const contactHits = resolveContactDamage(dt, this.player, this.enemies, difficulty);
        this._displayContactHitsOnPlayer(contactHits);
        if (contactHits.length > 0) {
            this._hitStopTimer = HIT_STOP_SECONDS;
            this.sound.playSfx('hit-player');
        }
        return contactHits.filter((hit) => hit.enemyAmount > 0).map((hit) => ({ enemy: hit.enemy, amount: hit.enemyAmount }));
    }

    /**
     * Spawns damage numbers on the player for each contact hit received this frame.
     * @param {{enemy:Enemy,playerAmount:number,enemyAmount:number}[]} contactHits
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
     * @param {Enemy} target
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
     * @param {number} dt
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
     * @param {number} dt
     * @param {string} difficulty
     */
    _updateEnemyProjectiles(dt, difficulty) {
        for (const projectile of this.enemyProjectiles) projectile.update(dt, this.collision);
        const playerHits = resolveEnemyProjectileHits(this.enemyProjectiles, this.player, difficulty);
        for (const hit of playerHits) {
            this.damageNumbers.spawn(this.player.centerX, this.player.visualTopY, hit.amount);
        }
        if (playerHits.length > 0) {
            this._hitStopTimer = HIT_STOP_SECONDS;
            this.sound.playSfx('hit-player');
        }
        this.enemyProjectiles = this.enemyProjectiles.filter((projectile) => !projectile.dead);
    }

    /**
     * @param {{enemy:Enemy,amount:number}[]} hits - Melee/projectile/contact hits landed on enemies this frame.
     */
    _displayEnemyHits(hits) {
        for (const hit of hits) {
            this.damageNumbers.spawn(hit.enemy.centerX, hit.enemy.visualTopY, hit.amount);
        }
        if (hits.length > 0) {
            this._hitStopTimer = HIT_STOP_SECONDS;
            this.sound.playSfx('hit-enemy');
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        for (const projectile of this.projectiles) projectile.render(ctx);
        for (const projectile of this.enemyProjectiles) projectile.render(ctx);
    }
}
