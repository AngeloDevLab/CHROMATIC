import { createEnemy } from '../entities/enemy-factory.js';
import { Wraith } from '../entities/bosses/wraith.js';
import { WraithTemplateboss } from '../entities/bosses/wraith-templateboss.js';
import { buildWraithAnimations, buildTemplatebossAnimations, buildVfxAnimation } from '../entities/character-animations.js';
import { VfxEffect } from '../entities/vfx-effect.js';

/**
 * Every living enemy continuously erases color around itself while
 * patrolling, independent of the player's own reveal.
 */
const enemy_darken_radius = 65;

/**
 * A bit bigger than the darken radius above - dying reveals back what the
 * enemy had darkened while patrolling, plus a bit more as a small death beat.
 */
const enemy_death_reveal_radius = 90;

/**
 * Checks whether an EnemySpawn name refers to a boss.
 * @param {string} [name] - EnemySpawn's Tiled Name field.
 * @returns {boolean}
 */
export function isBossSpawnName(name) {
    const lower = name?.toLowerCase();
    return lower === 'miniboss' || lower === 'templateboss';
}

/** Spawns and per-frame bookkeeping for a level's enemy roster, including its optional Miniboss/Templateboss. */
export class EnemyRoster {
    /**
     * Spawns every enemy from the level's EnemySpawn markers.
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
        this.vfx = [];
        this.enemies = level.getObjectsByType('EnemySpawn').map((spawn) => this._spawnFromMarker(spawn)).filter(Boolean);
        this._levelFullyRevealed = false;
        this._bossDefeated = false;
    }

    /**
     * True once every enemy is dead, the level's color-explosion trigger.
     * @returns {boolean}
     */
    get levelFullyRevealed() {
        return this._levelFullyRevealed;
    }

    /**
     * "miniboss"/"templateboss" bypass the regular EnemyFactory - wraith.js/
     * wraith-templateboss.js don't fit its generic sprite-sheet wiring.
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
     * wraith.sprite is set explicitly, since Enemy.render()'s fallback path
     * draws this.sprite directly when animations are missing.
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {Wraith}
     */
    _spawnWraith(spawn) {
        const wraith = new Wraith(spawn.x, spawn.y, this.collision, this.player);
        wraith.setAnimations(buildWraithAnimations(this.game.assets), 'idle');
        wraith.sprite = wraith.animations.idle.image;
        this.boss = wraith;
        return wraith;
    }

    /**
     * Same as _spawnWraith(), for the Templateboss tier.
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
     * beam) into combat's pool, and pendingRoomDarken (wraith.js's beam-fire room-darken beat).
     * @param {number} deltaTime - Elapsed time in seconds.
     * @param {CombatCoordinator} combat - Combat pool to drain enemy projectiles into.
     * @param {ColorZone} colorZone - Color mechanic, for beam-fire room-darken beats.
     * @param {number} safeRevealRadius - Matches the player's own everyday reveal radius.
     */
    updateEnemies(deltaTime, combat, colorZone, safeRevealRadius) {
        for (const enemy of this.enemies) {
            enemy.update(deltaTime);
            this._drainPendingVfx(enemy);
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
        this._updateVfx(deltaTime);
    }

    /**
     * Each pendingVfx key doubles as an SFX key of the same name
     * (SoundManager.playSfx() is fail-soft) - same convention as player-fx.js.
     * @param {Enemy} enemy - Enemy whose pendingVfx mailbox to drain.
     */
    _drainPendingVfx(enemy) {
        const feetY = enemy.y + enemy.height;
        for (const key of enemy.pendingVfx) {
            this.vfx.push(new VfxEffect(enemy.centerX, feetY, buildVfxAnimation(this.game.assets, key)));
            this.game.sound.playSfx(key);
        }
        enemy.pendingVfx.length = 0;
    }

    /**
     * Advances the enemy VFX pool and prunes finished clips.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    _updateVfx(deltaTime) {
        for (const fx of this.vfx) fx.update(deltaTime);
        this.vfx = this.vfx.filter((fx) => !fx.dead);
    }

    /**
     * Draws every active enemy VFX (e.g. Charger's charge-start dash smoke).
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        for (const fx of this.vfx) fx.render(ctx);
    }

    /**
     * Dying reverses the enemy's own darkening once, revealing back what it had darkened plus a bit more instead of leaving a dark patch behind. The 'enemy-death' sfx is reused for the boss too until a dedicated boss-death cue exists.
     * @param {ColorZone} colorZone - Color mechanic to darken/reveal against.
     */
    updateColorReveal(colorZone) {
        for (const enemy of this.enemies) {
            if (!enemy.dead) {
                colorZone.darken(enemy.centerX, enemy.centerY, enemy_darken_radius);
            } else if (!enemy.colorRevealed) {
                enemy.colorRevealed = true;
                colorZone.reveal(enemy.centerX, enemy.centerY, enemy_death_reveal_radius);
                this.game.sound.playSfx('enemy-death');
            }
        }
    }

    /**
     * Standing in for a "boss defeated" trigger since Lv_1 has no boss yet: clearing every enemy triggers the same color-explosion reveal, once. Also marks the portal revealed.
     * @param {ColorZone} colorZone - Color mechanic to trigger the full reveal on.
     * @param {Interactables} interactables - Interactables set, to mark the portal revealed.
     */
    checkLevelFullyRevealed(colorZone, interactables) {
        if (this._levelFullyRevealed || this.enemies.length === 0 || !this.enemies.every((enemy) => enemy.dead)) return;

        this._levelFullyRevealed = true;
        colorZone.triggerFullReveal(this.player.centerX, this.player.visualCenterY);
        interactables.markPortalRevealed();
    }

    /**
     * Drops the boss's Token the frame its death animation finishes -
     * separate from checkLevelFullyRevealed() above, which fires on every enemy dead (including non-boss levels).
     * @param {Interactables} interactables - Interactables set, to notify MerchantInteractable of the drop.
     */
    checkBossDefeated(interactables) {
        if (this._bossDefeated || !this.boss || !this.boss.dead || !this.boss.deathAnimationFinished) return;

        this._bossDefeated = true;
        interactables.onBossDefeated(this.boss.centerX, this.boss.centerY, this.boss.name, this.boss.tokenReward);
    }
}
