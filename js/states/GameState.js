import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { ColorZone } from '../mechanics/ColorZone.js';

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

        this.levelCanvas = document.createElement('canvas');
        this.levelCanvas.width = this.level.pixelWidth;
        this.levelCanvas.height = this.level.pixelHeight;
        const levelCtx = this.levelCanvas.getContext('2d');

        // Test: reuse the main menu's parallax image as a level backdrop, tiled
        // across the full level width and cover-fit to its height - real
        // per-level background art (10_technical-architecture.md 11.6.1) replaces
        // this once ready.
        const parallax = this.game.assets.getImage('menu-parallax-bg');
        const parallaxScale = this.level.pixelHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        for (let x = 0; x < this.level.pixelWidth; x += parallaxWidth) {
            levelCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, x, 0, parallaxWidth, this.level.pixelHeight);
        }

        this.level.drawAllLayers(levelCtx);

        // Color mechanic (03_mechanics.md 4.1): the player leaves a permanent
        // color trail while moving (fadeDurationSeconds stays Infinity, the
        // ColorZone default) - unlike MenuState's decorative fading-bubble variant
        // of the same technique, real gameplay never reverts on its own. Grey
        // treatment matches the menu's tuned "Darkness" look for visual
        // consistency between the two scenes.
        this.colorZone = new ColorZone(this.level.pixelWidth, this.level.pixelHeight, 55, {
            greyBrightness: 0.15,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.levelCanvas);

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
            jump: new SpriteAnimation(this.game.assets.getImage('guardian-jump'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 12),
            // Plays once per swing rather than looping (SpriteAnimation's loop:
            // false) - Player watches its `finished` flag to know when to hand
            // control back to normal locomotion.
            attack: new SpriteAnimation(this.game.assets.getImage('guardian-attack'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 8, 16, { loop: false }),
        };

        const playerStart = this.level.getObjectsByType('PlayerStart')[0] ?? FALLBACK_SPAWN;
        this.player = new Player(playerStart.x, playerStart.y, animations);
        this.player.enableControl(this.game.input, this.collision);

        const maggotSprite = this.game.assets.getImage('enemy-maggot');
        const maggotRunningImage = this.game.assets.getImage('enemy-maggot-running');
        this.enemies = this.level.getObjectsByType('EnemySpawn').map((spawn) => {
            const enemy = new Enemy(spawn.x, spawn.y, maggotSprite);
            // Own SpriteAnimation instance per enemy - sharing one across all of
            // them would advance its frame timer once per enemy per game frame
            // (animation playing N times too fast for N enemies).
            enemy.setAnimations({
                running: new SpriteAnimation(maggotRunningImage, CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 10),
            });
            enemy.enablePatrol(this.collision);
            return enemy;
        });

        this.debugLabel = document.createElement('div');
        this.debugLabel.className = 'gamestate-debug-label';
        this.debugLabel.textContent = `Lvl 1 (${chapterId ?? '?'}) - Arrows/WASD to move, Space/W to jump, S to duck, Click to attack`;
        this.game.overlay.appendChild(this.debugLabel);
    }

    exit() {
        this.debugLabel?.remove();
    }

    update(dt) {
        this.player.update(dt);
        for (const enemy of this.enemies) enemy.update(dt);
        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
    }

    render(ctx) {
        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        ctx.drawImage(this.levelCanvas, 0, 0);
        this.colorZone.render(ctx);
        for (const enemy of this.enemies) enemy.render(ctx);
        this.player.render(ctx);

        ctx.restore();
    }
}
