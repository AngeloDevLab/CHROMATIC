import { Enemy } from './enemy.js';
import { Charger } from './enemies/charger.js';
import { Sentinel } from './enemies/sentinel.js';
import { Shooter } from './enemies/shooter.js';
import { SpriteAnimation } from '../utils/sprite-animation.js';

/**
 * Enemy sprite sheets use their own 64x64 convention, independent of the player's 96x96 one.
 */
const enemy_frame_size = 64;

/**
 * Maps an EnemySpawn's Tiled Name field to its asset keys and per-type
 * animation overrides (`runningFrames`, `deadFrames`, `chargeFps`,
 * `shootFrames`, `projectile`) - absent for types that don't use them.
 */
const enemy_sprite_sets = {
    patroller: { running: 'enemy-patroller-walking-idle', dead: 'enemy-patroller-dead' },
    charger: { running: 'enemy-charger-walking-idle', dead: 'enemy-charger-dead', runningFrames: 10, chargeFps: 14 },
    sentinel: { running: 'enemy-sentinel-walking-idle', dead: 'enemy-sentinel-dead', runningFrames: 9, deadFrames: 9 },
    shooter: {
        running: 'enemy-shooter-walking-idle',
        dead: 'enemy-shooter-dead',
        deadFrames: 8,
        shoot: 'enemy-shooter-shooting',
        shootFrames: 10,
        projectile: 'enemy-shooter-projectile',
    },
};

/**
 * Builds and wires up an enemy from a Tiled EnemySpawn object. Each enemy
 * gets its own SpriteAnimation instance, not a shared one.
 * @param {AssetLoader} assets - Loader holding enemy sprites.
 * @param {Collision} collision - Level collision for patrol/charge movement.
 * @param {Player} player - Player instance enemies aggro/react to.
 * @param {object} spawn - Flattened Tiled EnemySpawn object ({ name, x, y }).
 * @returns {Enemy|null} The constructed enemy, or null for an unregistered spawn name.
 */
export function createEnemy(assets, collision, player, spawn) {
    const spriteSet = enemy_sprite_sets[spawn.name?.toLowerCase()];
    if (!spriteSet) {
        console.warn(`EnemyFactory: no enemy type registered for EnemySpawn name "${spawn.name}" at (${spawn.x}, ${spawn.y}) - skipped.`);
        return null;
    }

    const typeName = spawn.name.toLowerCase();
    const sprite = assets.getImage(spriteSet.running);
    const EnemyClass = _resolveEnemyClass(typeName);
    const enemy = new EnemyClass(spawn.x, spawn.y, sprite, enemy_frame_size, enemy_frame_size);

    enemy.setAnimations(_buildAnimations(assets, sprite, spriteSet));
    _enableBehavior(enemy, collision, player, assets, spriteSet);
    return enemy;
}

/**
 * Maps a lowercased type name to its Enemy subclass.
 * @param {string} typeName - Lowercased EnemySpawn name.
 * @returns {typeof Enemy} The enemy subclass to instantiate.
 */
function _resolveEnemyClass(typeName) {
    if (typeName === 'charger') return Charger;
    if (typeName === 'sentinel') return Sentinel;
    if (typeName === 'shooter') return Shooter;
    return Enemy;
}

/**
 * Builds the running/dead animation set, plus charge/shoot clips when the
 * sprite set provides them. `dead` and `shoot` both play once rather than looping.
 * @param {AssetLoader} assets - Loader holding enemy sprites.
 * @param {HTMLImageElement} sprite - Running/idle sprite, also used for the 'running' animation.
 * @param {object} spriteSet - This type's entry from enemy_sprite_sets.
 * @returns {Object<string, SpriteAnimation>}
 */
function _buildAnimations(assets, sprite, spriteSet) {
    const runningFrames = spriteSet.runningFrames ?? 12;
    const deadFrames = spriteSet.deadFrames ?? 12;
    const animations = {
        running: new SpriteAnimation(sprite, enemy_frame_size, enemy_frame_size, runningFrames, 10),
        dead: new SpriteAnimation(assets.getImage(spriteSet.dead), enemy_frame_size, enemy_frame_size, deadFrames, 12, { loop: false }),
    };
    if (spriteSet.chargeFps) {
        animations.charge = new SpriteAnimation(sprite, enemy_frame_size, enemy_frame_size, runningFrames, spriteSet.chargeFps);
    }
    if (spriteSet.shoot) {
        const shootFrames = spriteSet.shootFrames ?? 6;
        animations.shoot = new SpriteAnimation(assets.getImage(spriteSet.shoot), enemy_frame_size, enemy_frame_size, shootFrames, 12, { loop: false });
    }
    return animations;
}

/**
 * Wires each enemy's movement/aggro behavior; Sentinel never patrols.
 * @param {Enemy} enemy - Freshly constructed enemy to wire up.
 * @param {Collision} collision - Level collision for patrol/charge movement.
 * @param {Player} player - Player instance enemies aggro/react to.
 * @param {AssetLoader} assets - Loader holding enemy sprites.
 * @param {object} spriteSet - This type's entry from enemy_sprite_sets.
 */
function _enableBehavior(enemy, collision, player, assets, spriteSet) {
    if (enemy instanceof Sentinel) {
        enemy.enableTrigger(player);
        return;
    }
    enemy.enablePatrol(collision);
    if (enemy instanceof Charger) enemy.enableCharge(player);
    if (enemy instanceof Shooter) enemy.enableShoot(player, assets.getImage(spriteSet.projectile));
}
