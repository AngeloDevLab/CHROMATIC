import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';

const CHARACTER_FRAME_SIZE = 96;
const SPAWN_X = 64;

// Placeholder level/tileset (assets/levels/gamestate-test.json) - proves out
// real input-driven movement, gravity, and collision before real Prologue
// Level 1 content exists. Reuses the same Guardian idle/running sprite sheets
// as the menu's living background (same character, no new art needed yet).
export class GameState extends State {
    enter(chapterId) {
        this.chapterId = chapterId;

        this.level = Level.load(this.game.assets, 'gamestate-test-level', 'gamestate-tileset');
        this.collision = new Collision(this.level);
        this.camera = new Camera(this.game.width, this.game.height);

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
        };

        this.player = new Player(SPAWN_X, 0, animations);
        this.player.enableControl(this.game.input, this.collision);

        this.debugLabel = document.createElement('div');
        this.debugLabel.className = 'gamestate-debug-label';
        this.debugLabel.textContent = 'Placeholder level - Arrows/WASD to move, Space/W to jump, S to duck';
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
        this.player.render(ctx);

        ctx.restore();
    }
}
