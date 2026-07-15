import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

const CHARACTER_FRAME_SIZE = 96;
const FALLBACK_SPAWN = { x: 64, y: 0 };

// Real Prologue Level 1 (assets/levels/Lv_1.json), built in Tiled. Player/enemy
// spawn positions come from the Objects layer (PlayerStart/EnemySpawn) per
// 10_technical-architecture.md 11.6.2 - enemies are all "maggot" for now since
// no enemyType property is set on the spawns yet and there's no AI either
// (05_enemies-bosses.md Patroller/Charger/Shooter/Sentinel behavior comes later).
export class GameState extends State {
    enter({ chapterId, level } = {}) {
        this.chapterId = chapterId;
        this.levelNumber = level;

        this.level = Level.load(this.game.assets, 'lv1-level', 'lv1-tileset');
        // The Tiled layer is named "terrain", not the documented
        // "Terrain/Collision" - passed explicitly rather than renaming in Tiled.
        // One-way: the level is built from several stacked walkable floors, not
        // solid walls, so every terrain tile only blocks when landed on from
        // above (see utils/Collision.js).
        this.collision = new Collision(this.level, 'terrain', { oneWay: true });
        this.camera = new Camera(this.game.width, this.game.height);

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
            jump: new SpriteAnimation(this.game.assets.getImage('guardian-jump'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 12),
        };

        const playerStart = this.level.getObjectsByType('PlayerStart')[0] ?? FALLBACK_SPAWN;
        this.player = new Player(playerStart.x, playerStart.y, animations);
        this.player.enableControl(this.game.input, this.collision);

        const maggotSprite = this.game.assets.getImage('enemy-maggot');
        this.enemies = this.level.getObjectsByType('EnemySpawn').map(
            (spawn) => new Enemy(spawn.x, spawn.y, maggotSprite)
        );

        this.debugLabel = document.createElement('div');
        this.debugLabel.className = 'gamestate-debug-label';
        this.debugLabel.textContent = `Lvl 1 (${chapterId ?? '?'}) - Arrows/WASD to move, Space/W to jump, S to duck`;
        this.game.overlay.appendChild(this.debugLabel);
    }

    exit() {
        this.debugLabel?.remove();
    }

    update(dt) {
        this.player.update(dt);
        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
    }

    render(ctx) {
        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        this.level.drawAllLayers(ctx);
        for (const enemy of this.enemies) enemy.render(ctx);
        this.player.render(ctx);

        ctx.restore();
    }
}
