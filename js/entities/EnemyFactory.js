import { Enemy } from './Enemy.js';
import { Charger } from './enemies/Charger.js';
import { Sentinel } from './enemies/Sentinel.js';
import { Shooter } from './enemies/Shooter.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

// Enemy sheets (assets/images/enemys/<type>/) are their own 64x64 convention,
// independent of the player's 96x96 one.
const ENEMY_FRAME_SIZE = 64;
// Maps an EnemySpawn object's Tiled Name field to its asset keys - add an
// entry here once a new enemy type actually exists in code. `charge` is
// Charger-only (its distinct rush sprite, see enemies/Charger.js); `shoot`/
// `projectile` are Shooter-only (its distinct firing sprite and the bolt it
// fires, see enemies/Shooter.js) - absent for types that don't use them.
const ENEMY_SPRITE_SETS = {
    patroller: { running: 'enemy-patroller-walking-idle', dead: 'enemy-patroller-dead' },
    charger: { running: 'enemy-charger-walking-idle', dead: 'enemy-charger-dead', charge: 'enemy-charger-charge' },
    sentinel: { running: 'enemy-sentinel-walking-idle', dead: 'enemy-sentinel-dead' },
    shooter: {
        running: 'enemy-shooter-walking-idle',
        dead: 'enemy-shooter-dead',
        shoot: 'enemy-shooter-shooting',
        projectile: 'enemy-shooter-projectile',
    },
};

// Own SpriteAnimation instance per enemy - sharing one across all of them
// would advance its frame timer once per enemy per game frame (animation
// playing N times too fast for N enemies). Returns null (filtered out by the
// caller) for a spawn name with no registered sprite.
export function createEnemy(assets, collision, player, spawn) {
    const spriteSet = ENEMY_SPRITE_SETS[spawn.name?.toLowerCase()];
    if (!spriteSet) {
        console.warn(`EnemyFactory: no enemy type registered for EnemySpawn name "${spawn.name}" at (${spawn.x}, ${spawn.y}) - skipped.`);
        return null;
    }

    const typeName = spawn.name.toLowerCase();
    const sprite = assets.getImage(spriteSet.running);
    const EnemyClass = typeName === 'charger' ? Charger
        : typeName === 'sentinel' ? Sentinel
        : typeName === 'shooter' ? Shooter
        : Enemy;
    const enemy = new EnemyClass(spawn.x, spawn.y, sprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE);

    const animations = {
        running: new SpriteAnimation(sprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 10),
        // Plays once on death instead of vanishing instantly - see
        // Enemy.js's deathAnimationFinished/_enterDeathAnimation().
        dead: new SpriteAnimation(assets.getImage(spriteSet.dead), ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 12, { loop: false }),
    };
    if (spriteSet.charge) {
        animations.charge = new SpriteAnimation(assets.getImage(spriteSet.charge), ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 14);
    }
    if (spriteSet.shoot) {
        // 6-frame shoot animation (shooter-shooting.png), plays once per shot
        // rather than looping - same reasoning as Player.js's attack animation.
        animations.shoot = new SpriteAnimation(assets.getImage(spriteSet.shoot), ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 6, 12, { loop: false });
    }
    enemy.setAnimations(animations);

    // Sentinel never patrols (05_enemies-bosses.md 6.1: "Static") - skips
    // enablePatrol entirely rather than gating movement some other way, so it
    // has no collision/gravity dependency at all, just sits where Tiled placed it.
    if (enemy instanceof Sentinel) {
        enemy.enableTrigger(player);
    } else {
        enemy.enablePatrol(collision);
        if (enemy instanceof Charger) enemy.enableCharge(player);
        if (enemy instanceof Shooter) enemy.enableShoot(player, assets.getImage(spriteSet.projectile));
    }
    return enemy;
}
