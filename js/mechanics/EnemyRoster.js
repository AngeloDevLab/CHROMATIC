import { createEnemy } from '../entities/EnemyFactory.js';
import { Wraith } from '../entities/bosses/Wraith.js';
import { WraithTemplateboss } from '../entities/bosses/WraithTemplateboss.js';
import { buildWraithAnimations, buildTemplatebossAnimations } from '../entities/CharacterAnimations.js';

// Every living enemy continuously erases color around itself while
// patrolling, independent of the player's own reveal.
const ENEMY_DARKEN_RADIUS = 65;
// A bit bigger than the darken radius above - dying reveals back what the
// enemy had darkened while patrolling, plus a bit more as a small death beat.
const ENEMY_DEATH_REVEAL_RADIUS = 90;

/**
 * @param {string} [name] - EnemySpawn's Tiled Name field.
 * @returns {boolean}
 */
export function isBossSpawnName(name) {
    const lower = name?.toLowerCase();
    return lower === 'miniboss' || lower === 'templateboss';
}

// Spawns and per-frame bookkeeping for a level's enemy roster (regular
// enemies + the one optional Miniboss/Templateboss) - extracted out of
// LevelSession.js since it's a cohesive concern with its own lifecycle,
// same motivation as Interactables.js/CombatCoordinator.js.
export class EnemyRoster {
    /**
     * @param {Game} game - For assets/sound.
     * @param {Level} level - For its EnemySpawn markers.
     * @param {Player} player - Handed to each spawned enemy for aim/tracking.
     * @param {Collision} collision - Handed to each spawned enemy for ground/wall scans.
     */
    constructor(game, level, player, collision) {
        this.game = game;
        this.player = player;
        this.collision = collision;
        this.boss = null;
        this.enemies = level.getObjectsByType('EnemySpawn').map((spawn) => this._spawnFromMarker(spawn)).filter(Boolean);
        this._levelFullyRevealed = false;
        this._bossDefeated = false;
    }

    /**
     * @returns {boolean} Whether every enemy is dead (the level's color-explosion trigger).
     */
    get levelFullyRevealed() {
        return this._levelFullyRevealed;
    }

    /**
     * "miniboss"/"templateboss" bypass the regular EnemyFactory - Wraith.js/
     * WraithTemplateboss.js don't fit its generic sprite-sheet wiring.
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {Enemy|Wraith|WraithTemplateboss}
     */
    _spawnFromMarker(spawn) {
        const name = spawn.name?.toLowerCase();
        if (name === 'miniboss') return this._spawnWraith(spawn);
        if (name === 'templateboss') return this._spawnWraithTemplateboss(spawn);
        return createEnemy(this.game.assets, this.collision, this.player, spawn);
    }

    /**
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {Wraith}
     */
    _spawnWraith(spawn) {
        const wraith = new Wraith(spawn.x, spawn.y, this.collision, this.player);
        wraith.setAnimations(buildWraithAnimations(this.game.assets), 'idle');
        // Enemy.render()'s deep fallback (anim/referenceAnim missing) draws
        // this.sprite directly - keep it a real image rather than the null
        // Wraith's constructor passes to super().
        wraith.sprite = wraith.animations.idle.image;
        this.boss = wraith;
        return wraith;
    }

    /**
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {WraithTemplateboss}
     */
    _spawnWraithTemplateboss(spawn) {
        const boss = new WraithTemplateboss(spawn.x, spawn.y, this.collision, this.player);
        boss.setAnimations(buildTemplatebossAnimations(this.game.assets), 'idle');
        boss.sprite = boss.animations.idle.image;
        this.boss = boss;
        return boss;
    }

    /**
     * Drains each enemy's pendingProjectile (Shooter's shots, the boss's
     * beam) into combat's pool, and pendingRoomDarken (Wraith.js's beam-fire
     * room-darken beat - it has no access to ColorZone itself).
     * @param {number} dt
     * @param {CombatCoordinator} combat
     * @param {ColorZone} colorZone
     * @param {number} safeRevealRadius - Matches the player's own everyday reveal radius.
     */
    updateEnemies(dt, combat, colorZone, safeRevealRadius) {
        for (const enemy of this.enemies) {
            enemy.update(dt);
            if (enemy.pendingProjectile) {
                combat.enemyProjectiles.push(enemy.pendingProjectile);
                if (enemy === this.boss) this.game.sound.playSfx('boss-beam');
                enemy.pendingProjectile = null;
            }
            if (enemy.pendingRoomDarken) {
                colorZone.darkenAllExcept(this.player.centerX, this.player.visualCenterY, safeRevealRadius);
                enemy.pendingRoomDarken = false;
            }
        }
    }

    /**
     * 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns
     * back to dark" - dying reverses that once, revealing back what it had
     * darkened (plus a bit more) instead of leaving a dark patch behind.
     * @param {ColorZone} colorZone
     */
    updateColorReveal(colorZone) {
        for (const enemy of this.enemies) {
            if (!enemy.dead) {
                colorZone.darken(enemy.centerX, enemy.centerY, ENEMY_DARKEN_RADIUS);
            } else if (!enemy.colorRevealed) {
                enemy.colorRevealed = true;
                colorZone.reveal(enemy.centerX, enemy.centerY, ENEMY_DEATH_REVEAL_RADIUS);
                // Reused for the boss too until a dedicated boss-death cue exists.
                this.game.sound.playSfx('enemy-death');
            }
        }
    }

    /**
     * Standing in for "Boss defeated" (03_mechanics.md 4.1) since Lv_1 has
     * no boss yet: clearing every enemy triggers the same color-explosion
     * reveal, once.
     * @param {ColorZone} colorZone
     * @param {Interactables} interactables
     */
    checkLevelFullyRevealed(colorZone, interactables) {
        if (this._levelFullyRevealed || this.enemies.length === 0 || !this.enemies.every((enemy) => enemy.dead)) return;

        this._levelFullyRevealed = true;
        colorZone.triggerFullReveal(this.player.centerX, this.player.visualCenterY);
        // The portal's own reveal isn't position-keyed - but a full-level
        // reveal means everything around it is revealed too by the time
        // it's even usable, so it should be.
        interactables.markPortalRevealed();
    }

    /**
     * Drops the boss's Token the frame its death animation finishes -
     * separate from checkLevelFullyRevealed() above since that fires on
     * every enemy dead (including non-boss levels), this only ever cares
     * about the one boss entity.
     * @param {Interactables} interactables
     */
    checkBossDefeated(interactables) {
        if (this._bossDefeated || !this.boss || !this.boss.dead || !this.boss.deathAnimationFinished) return;

        this._bossDefeated = true;
        interactables.onBossDefeated(this.boss.centerX, this.boss.centerY, this.boss.name, this.boss.tokenReward);
    }
}
