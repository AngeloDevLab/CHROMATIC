import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { resolveMeleeAttack, resolveContactDamage } from '../mechanics/Combat.js';
import { HUD, HEALTH_BAR, SHIELD_BAR } from '../ui/HUD.js';
import { DamageNumbers } from '../ui/DamageNumbers.js';

const CHARACTER_FRAME_SIZE = 96;
// Bigger canvas than the other sheets, deliberately - gives the sword extra
// room to swing past the body without clipping the frame edge. Doesn't need
// to be square - Player.js scales the attack frame by its own aspect ratio,
// so e.g. more side padding than vertical padding works fine too. Match
// these to whatever attack.png actually is.
const ATTACK_FRAME_WIDTH = 150;
const ATTACK_FRAME_HEIGHT = 96;
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
            attack: new SpriteAnimation(this.game.assets.getImage('guardian-attack'), ATTACK_FRAME_WIDTH, ATTACK_FRAME_HEIGHT, 8, 16, { loop: false }),
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

        this.hud = new HUD();
        this.damageNumbers = new DamageNumbers(this.game.overlay);

        this.healthValueEl = this._createHudValueLabel(HEALTH_BAR);
        this.shieldValueEl = this._createHudValueLabel(SHIELD_BAR);

        this._levelFullyRevealed = false;
    }

    _createHudValueLabel(bar) {
        const el = document.createElement('div');
        el.className = 'hud-value';
        el.style.left = `${bar.x + bar.width + 4}px`;
        el.style.top = `${bar.y - 2}px`;
        this.game.overlay.appendChild(el);
        return el;
    }

    exit() {
        this.healthValueEl?.remove();
        this.shieldValueEl?.remove();
        this.damageNumbers?.clear();
    }

    update(dt) {
        this.player.update(dt);
        for (const enemy of this.enemies) enemy.update(dt);

        const hits = this.player.consumeAttackImpact() ? resolveMeleeAttack(this.player, this.enemies) : [];
        hits.push(...resolveContactDamage(dt, this.player, this.enemies));
        for (const hit of hits) {
            this.damageNumbers.spawn(hit.enemy.centerX, hit.enemy.visualTopY, hit.amount);
        }

        // 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns
        // back to dark" - every living enemy continuously erases color around
        // itself as it patrols, independent of the player's own reveal below.
        for (const enemy of this.enemies) {
            if (!enemy.dead) this.colorZone.darken(enemy.centerX, enemy.centerY);
        }

        // Standing in for "Boss defeated" (03_mechanics.md 4.1) since Lv_1 has
        // no boss yet: clearing every enemy triggers the same color-explosion
        // reveal, once.
        if (!this._levelFullyRevealed && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.dead)) {
            this._levelFullyRevealed = true;
            this.colorZone.triggerFullReveal(this.player.centerX, this.player.visualCenterY);
        }

        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
        this.damageNumbers.update(dt, this.camera);

        this.healthValueEl.textContent = `${Math.round(this.player.health)}/${this.player.maxHealth}`;
        this.shieldValueEl.textContent = `${Math.round(this.player.shield)}/${this.player.maxShield}`;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        ctx.drawImage(this.levelCanvas, 0, 0);
        this.colorZone.render(ctx);
        for (const enemy of this.enemies) {
            enemy.render(ctx);
            this.hud.renderEnemyBar(ctx, enemy);
        }
        this.player.render(ctx);

        ctx.restore();

        this.hud.renderPlayerBars(ctx, this.player);
    }
}
