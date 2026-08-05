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

// Combat feel: a brief total freeze the instant a hit lands (melee or
// contact), before anything reacts to it - LevelSession.update() early-
// returns while isFrozen is true (render() keeps drawing the last frame),
// same mechanism as its Merchant-dialogue freeze.
const HIT_STOP_SECONDS = 0.06;

// Sequences the player's per-frame attack decision (melee vs the ranged
// thrown-sword) and both projectile pools (the player's own throw, and
// enemy-fired shots/beams) through Combat.js's pure resolve* functions,
// extracted out of LevelSession.js so that file isn't also the sole owner
// of combat resolution on top of everything else it does (same motivation
// as Interactables.js). Owns the hit-stop timer too, since it's purely a
// reaction to the hits this class resolves - LevelSession only ever needs
// to ask isFrozen() and call tickFrozen(dt).
export class CombatCoordinator {
    /**
     * @param {Player} player
     * @param {Enemy[]} enemies - Same array reference LevelSession itself iterates, so this always sees current state.
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

        this.projectiles = [];
        // Separate from the enemies' own projectiles below rather than one
        // shared list with a "whose is this" flag - resolveProjectileHits
        // only ever checks player-thrown ones against enemies, and
        // resolveEnemyProjectileHits (Shooter.js's shots) only ever checks
        // these against the player, so there's no ambiguity to sort out.
        this.enemyProjectiles = [];
        this._hitStopTimer = 0;
        this._rangedCooldownTimer = 0;
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

        const contactHits = resolveContactDamage(dt, this.player, this.enemies, difficulty);
        this._displayContactHitsOnPlayer(contactHits);
        // Only forward the enemy's own (unscaled) share into the shared
        // enemy-hit display below - contactHits carries playerAmount/
        // enemyAmount separately (Combat.js), not one shared `amount` like
        // melee/projectile hits, and a charging enemy's enemyAmount is 0
        // (no self-damage that tick, see Combat.js's _resolveEnemyContact())
        // so it's filtered out here rather than showing a stray "0".
        hits.push(...contactHits.filter((hit) => hit.enemyAmount > 0).map((hit) => ({ enemy: hit.enemy, amount: hit.enemyAmount })));
        this._displayEnemyHits(hits);
        // Contact damage always hits the player (the barrier exchange), even
        // when charging skips the enemy's own side of it - see Combat.js's
        // _resolveEnemyContact().
        if (contactHits.length > 0) {
            this._hitStopTimer = HIT_STOP_SECONDS;
            this.sound.playSfx('hit-player');
        }
    }

    /**
     * Contact damage is bidirectional (Combat.js's resolveContactDamage) -
     * the enemy's own share is folded into the shared hits array in update()
     * above (so it goes through the same _displayEnemyHits() sfx/hit-stop
     * path as melee/projectile hits), but the player's share needs its own
     * display here, anchored at the player rather than the enemy - same
     * reasoning as _updateEnemyProjectiles()'s playerHits loop.
     * @param {{enemy:Enemy,playerAmount:number,enemyAmount:number}[]} contactHits
     */
    _displayContactHitsOnPlayer(contactHits) {
        for (const hit of contactHits) {
            this.damageNumbers.spawn(this.player.centerX, this.player.visualTopY, hit.playerAmount);
        }
    }

    /**
     * 03_mechanics.md 4.3: melee if the nearest enemy is in reach, a
     * thrown-sword projectile otherwise - both share the same swing
     * animation/timing (Player.js is untouched), only what happens at the
     * swing's impact frame differs. The ranged throw is on its own cooldown
     * (RANGED_ATTACK_COOLDOWN_SECONDS) so it can't be spammed indefinitely
     * while an enemy sits just out of melee range - melee itself stays free.
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
     * Enemy-fired shots/beams against the player - own damage-number loop
     * and hit-stop trigger, separate from the enemy-hit display below since
     * these land on the player, not an enemy.
     * @param {number} dt
     * @param {string} difficulty
     */
    _updateEnemyProjectiles(dt, difficulty) {
        for (const projectile of this.enemyProjectiles) projectile.update(dt, this.collision);
        const playerHits = resolveEnemyProjectileHits(this.enemyProjectiles, this.player, difficulty);
        for (const hit of playerHits) {
            // Anchored at the player, not "the enemy" - the Shooter that
            // fired this may be far away (or dead) by the time its shot
            // actually lands, so showing the number at the impact point
            // (the player) is the only position that still makes sense.
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
