import { Level } from '../world/Level.js';
import { buildTilesetRegistry } from '../world/TilesetRegistry.js';
import { Player } from '../entities/Player.js';
import { buildPlayerAnimations } from '../entities/CharacterAnimations.js';
import { PlayerFx } from '../mechanics/PlayerFx.js';
import { EnemyRoster, isBossSpawnName } from '../mechanics/EnemyRoster.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { DeathSequence, GHOST_FRAME_SIZE } from '../mechanics/DeathSequence.js';
import { Interactables } from '../mechanics/Interactables.js';
import { CombatCoordinator } from '../mechanics/CombatCoordinator.js';
import { TouchControls } from '../ui/TouchControls.js';
import { HUD, HEALTH_BAR, SHIELD_BAR, scaleRect } from '../ui/HUD.js';
import { DamageNumbers } from '../ui/DamageNumbers.js';

const FALLBACK_SPAWN = { x: 64, y: 0 };

// Slack past the level's bottom edge before a fall counts as death - a
// platform flush with the edge shouldn't feel like an instant kill.
const FALL_DEATH_MARGIN_PX = 64;

// Player's live-glow/permanent color trail radius (03_mechanics.md 4.1) -
// shared with Interactables.js's revealRadius option so Portal/Trapdoor/
// SecretDoor "revealed" tracks the same distance.
const PLAYER_REVEAL_RADIUS = 55;

// Real Prologue levels (Tiled exports, assets/levels/Lv_N.json). Player/enemy
// spawn positions come from each level's PlayerStart/EnemySpawn objects
// (10_technical-architecture.md 11.6.2); an unrecognized EnemySpawn name is
// skipped with a console warning rather than spawning the wrong thing.
export const LEVEL_JSON_KEYS = {
    1: 'lv1-level',
    2: 'lv2-level',
    3: 'lv3-level',
    4: 'lv4-level',
    5: 'lv5-level',
    6: 'lv6-level',
};

/**
 * Loads a throwaway Level for a quick property check (isBossLevel() below,
 * BossState.js's arena-sizing) before the real LevelSession builds its own -
 * cheap, the JSON's already in memory via AssetLoader.
 * @param {AssetLoader} assets
 * @param {number} levelNumber
 * @returns {Level|null}
 */
export function loadLevelPreview(assets, levelNumber) {
    const levelKey = LEVEL_JSON_KEYS[levelNumber];
    if (!levelKey) return null;

    return Level.load(assets, levelKey, buildTilesetRegistry(assets));
}

/**
 * Decides GameState vs BossState routing at level-load time, before a
 * LevelSession exists to ask - reads the same miniboss/templateboss spawn
 * names EnemyRoster.js uses to actually spawn a boss.
 * @param {AssetLoader} assets
 * @param {number} levelNumber
 * @returns {boolean}
 */
export function isBossLevel(assets, levelNumber) {
    const level = loadLevelPreview(assets, levelNumber);
    return !!level && level.getObjectsByType('EnemySpawn').some((spawn) => isBossSpawnName(spawn.name));
}

// Everything a running level needs - Level/Collision/Camera/ColorZone/Player/
// enemies/HUD/interactables/combat - extracted out of GameState.js so a
// level-hosting State doesn't have to rebuild all of this itself. Not a
// State (no enter()/exit()), just a plain constructor + update()/render()/
// destroy(), driven by whichever State owns it (GameState for a normal
// level, BossState for a boss arena).
export class LevelSession {
    /**
     * @param {Game} game - Owning Game instance.
     * @param {{chapterId: string, level: number}} params - Level to load.
     */
    constructor(game, { chapterId, level } = {}) {
        this.game = game;
        this.chapterId = chapterId;
        this.levelNumber = level;

        this._loadLevel();
        this._buildLevelCanvas();
        this._initColorZone();
        this._spawnPlayer();
        this.enemyRoster = new EnemyRoster(this.game, this.level, this.player, this.collision);
        this._initInteractablesAndHud();
        this._initCombat();
        // Camera zoom stays at Camera.js's default (1) here regardless of a
        // Boss spawning - BossState.js owns that (its own arena-sized buffer).
    }

    /**
     * Loads the Tiled level JSON and builds its Collision/Camera. "terrain"
     * is one-way; the optional "walls" layer stays fully solid regardless;
     * the optional "noDrop" layer exempts specific one-way floors from
     * Drop-Through-Platform. All three tolerate not existing in a given level.
     */
    _loadLevel() {
        const levelKey = LEVEL_JSON_KEYS[this.levelNumber];
        if (!levelKey) {
            throw new Error(`LevelSession: no level registered for level number ${this.levelNumber}`);
        }
        this.level = Level.load(this.game.assets, levelKey, buildTilesetRegistry(this.game.assets));
        this.collision = new Collision(this.level, 'terrain', { oneWay: true, wallLayerName: 'walls', noDropLayerName: 'noDrop' });
        this.camera = new Camera(this.game.width, this.game.height);
    }

    /**
     * Bakes the level's tile layers onto an offscreen canvas once, on top of
     * the shared Prologue forest backdrop tiled across the level's width - a
     * level's own "background" tile layer paints over this per level.
     * ColorZone.js's grey/color compositing reads from this baked canvas
     * rather than redrawing every tile layer every frame.
     */
    _buildLevelCanvas() {
        this.levelCanvas = document.createElement('canvas');
        this.levelCanvas.width = this.level.pixelWidth;
        this.levelCanvas.height = this.level.pixelHeight;
        const levelCtx = this.levelCanvas.getContext('2d');

        const parallax = this.game.assets.getImage('menu-parallax-bg');
        const parallaxScale = this.level.pixelHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        for (let x = 0; x < this.level.pixelWidth; x += parallaxWidth) {
            levelCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, x, 0, parallaxWidth, this.level.pixelHeight);
        }

        this.level.drawAllLayers(levelCtx);
    }

    /**
     * The color mechanic (03_mechanics.md 4.1): the player leaves a
     * permanent color trail while moving - unlike MenuState's decorative
     * fading-bubble ColorZone, this never reverts on its own.
     */
    _initColorZone() {
        this.colorZone = new ColorZone(this.level.pixelWidth, this.level.pixelHeight, PLAYER_REVEAL_RADIUS, {
            greyBrightness: 0.15,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.levelCanvas);
    }

    /**
     * Spawns the player at the level's PlayerStart marker (or a fallback) -
     * re-applies permanent Secret Room buffs/unlocked abilities, since those
     * live on Game, not any one Player instance.
     */
    _spawnPlayer() {
        this.deathSequence = new DeathSequence(this.game.assets.getImage('guardian-dead-ghost'));
        this.game.input.clearAttackPress();
        this.game.input.clearPausePress();
        this.game.input.clearJumpPress();
        this.game.input.clearDropPress();

        const playerStart = this.level.getObjectsByType('PlayerStart')[0] ?? FALLBACK_SPAWN;
        this.player = new Player(playerStart.x, playerStart.y, buildPlayerAnimations(this.game.assets));
        this.player.enableControl(this.game.input, this.collision);
        for (const buffId of this.game.buffs) this.player.applyBuff(buffId);
        for (const id of this.game.abilities) this.player.unlockAbility(id);
        this.playerFx = new PlayerFx(this.game, this.player);
    }

    /**
     * HUD/DamageNumbers/Interactables (Portal/Merchant/Trapdoor/SecretDoor/
     * BuffTerminal, see Interactables.js) and the player's own HP/Shield
     * text labels - grouped since Interactables needs damageNumbers to
     * already exist.
     */
    _initInteractablesAndHud() {
        this.hud = new HUD();
        this.damageNumbers = new DamageNumbers(this.game.overlay);

        this.interactables = new Interactables(this.game, this.level, this.player, {
            greyFilterCSS: this.colorZone.greyFilterCSS,
            revealRadius: PLAYER_REVEAL_RADIUS,
            damageNumbers: this.damageNumbers,
            collision: this.collision,
            onComplete: () => this._completeLevel(),
        });

        this.healthValueEl = this._createHudValueLabel(HEALTH_BAR);
        this.shieldValueEl = this._createHudValueLabel(SHIELD_BAR);
        this.tokenCounterEl = this._createTokenCounter();
        this.touchControls = new TouchControls(this.game);
    }

    /**
     * Icon+count readout below the HP/Shield bars - styled via CSS
     * (.hud-token's ::before), this only positions it and owns the text.
     * scaleRect() keeps the gap below the (also scaled) Shield bar
     * proportional instead of a fixed 4px.
     * @returns {HTMLElement}
     */
    _createTokenCounter() {
        const el = document.createElement('div');
        el.className = 'hud-token';
        const shield = scaleRect(SHIELD_BAR, this.game.hudScale);
        el.style.left = `${shield.x}px`;
        el.style.top = `${shield.y + shield.height + 4 * this.game.hudScale}px`;
        this.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Player's melee/ranged attack resolution, both projectile pools, and
     * the hit-stop timer they drive - see CombatCoordinator.js.
     */
    _initCombat() {
        this.combat = new CombatCoordinator(this.player, this.enemyRoster.enemies, this.collision, {
            damageNumbers: this.damageNumbers,
            thrownSwordSprite: this.game.assets.getImage('thrown-sword'),
            thrownSwordTrailSprite: this.game.assets.getImage('thrown-sword-trail'),
            sound: this.game.sound,
        });
    }

    /**
     * scaleRect() keeps this against the (also scaled, via Game.hudScale)
     * canvas-drawn bar regardless of buffer size - see that getter's comment.
     * @param {{x:number,y:number,width:number,height:number}} bar - HEALTH_BAR or SHIELD_BAR (HUD.js).
     * @returns {HTMLElement} The attached, positioned label element.
     */
    _createHudValueLabel(bar) {
        const el = document.createElement('div');
        el.className = 'hud-value';
        const scale = this.game.hudScale;
        const scaled = scaleRect(bar, scale);
        el.style.left = `${scaled.x + scaled.width + 4 * scale}px`;
        el.style.top = `${scaled.y - 2 * scale}px`;
        this.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Tears down everything this session added to the DOM, called by
     * whichever State hosts this session from its own exit().
     */
    destroy() {
        this.healthValueEl?.remove();
        this.shieldValueEl?.remove();
        this.tokenCounterEl?.remove();
        this.interactables.destroy();
        this.damageNumbers?.clear();
        this.touchControls.destroy();
    }

    /**
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this._handlePauseInput();

        const merchantDialogue = this.interactables.merchantDialogue;
        if (merchantDialogue.isOpen) {
            this._updateMerchantDialogue(dt, merchantDialogue);
            return;
        }

        if (this.combat.isFrozen) {
            this.combat.tickFrozen(dt);
            return;
        }

        this._updateWorld(dt);
    }

    /**
     * Merchant dialogue/Buff choice handle Escape themselves - this only
     * ever pushes Pause, and only once neither is active. Always drains the
     * press regardless of death state, so a stale one can't leak into
     * whatever comes after this session ends.
     */
    _handlePauseInput() {
        const pausePressed = this.game.input.consumePausePress();
        const merchantOpen = this.interactables.merchantDialogue.isOpen;
        if (pausePressed && !this.deathSequence.active && !merchantOpen) {
            this.game.stateMachine.push('pause');
        }
    }

    /**
     * Freezes gameplay the same way Pause does (update() early-returns,
     * render() keeps drawing the last frame) - [E] here means "advance the
     * dialogue", not "interact with the level".
     * @param {number} dt
     * @param {MerchantDialogue} merchantDialogue
     */
    _updateMerchantDialogue(dt, merchantDialogue) {
        if (this.game.input.consumeInteractPress()) merchantDialogue.advance();
        merchantDialogue.update(dt);
    }

    /**
     * The rest of a normal frame - player/enemies/interactables/combat, the
     * color mechanic, death, camera, and HUD text, in that order.
     * @param {number} dt
     */
    _updateWorld(dt) {
        this.player.godmode = this.game.devPanel.godmode;
        // Idempotent - cheap enough to poll so a DevPanel unlock takes
        // effect immediately instead of only on the next respawn.
        for (const id of this.game.abilities) this.player.unlockAbility(id);
        this.player.update(dt);
        this.playerFx.update(dt);
        this.interactables.blockSecretDoor();

        this.enemyRoster.updateEnemies(dt, this.combat, this.colorZone, PLAYER_REVEAL_RADIUS);
        this.interactables.updateEntities(dt);
        this._checkFallDeath();

        this.combat.update(dt, this.game.difficulty);
        this.enemyRoster.updateColorReveal(this.colorZone);
        this.enemyRoster.checkLevelFullyRevealed(this.colorZone, this.interactables);
        this.enemyRoster.checkBossDefeated(this.interactables);
        this._updateDeathSequence(dt);

        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        this._updateInteractablePrompts();
        this._updateColorZone(dt);
        this.damageNumbers.update(dt, this.camera);
        this._updateHudText();
    }

    /**
     * A gap with no floor below lets the player fall forever and keep
     * controlling mid-air - treat crossing the kill plane as death instead.
     */
    _checkFallDeath() {
        if (!this.player.dead && this.player.y > this.level.pixelHeight + FALL_DEATH_MARGIN_PX) {
            this.player.die();
        }
    }

    /**
     * Starts the ghost-rise once the fall animation finishes, then pushes
     * GameOverState once its fade-out completes - this session stops
     * getting update() calls from that point on, same freeze as Pause.
     * @param {number} dt
     */
    _updateDeathSequence(dt) {
        if (!this.deathSequence.active && this.player.dead && this.player.deathAnimationFinished) {
            this._startDeathSequence();
        }
        if (this.deathSequence.active && this.deathSequence.update(dt)) {
            this.game.stateMachine.push('gameover', { chapterId: this.chapterId, level: this.levelNumber });
        }
    }

    /**
     * Consumed once here rather than inside each of Interactables.js's own
     * _update*Prompt() methods - they'd otherwise race to drain the same
     * press, and whichever ran first would silently starve the others.
     */
    _updateInteractablePrompts() {
        const interactPressed = this.game.input.consumeInteractPress();
        this.interactables.updatePrompts(this.camera, interactPressed, this.enemyRoster.levelFullyRevealed);
    }

    /**
     * Stops feeding position updates once the death sequence's full-darken
     * sweep finishes - otherwise the normal per-frame reveal punches a
     * fresh colored hole right at the (frozen) death spot.
     * @param {number} dt
     */
    _updateColorZone(dt) {
        if (!this.deathSequence.active || this.colorZone.isTransitioning) {
            this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
        }
    }

    /**
     * Refreshes the player's HP/Shield HTML labels (_createHudValueLabel()).
     */
    _updateHudText() {
        this.healthValueEl.textContent = `${Math.round(this.player.health)}/${this.player.maxHealth}`;
        this.shieldValueEl.textContent = `${Math.round(this.player.shield)}/${this.player.maxShield}`;
        this.tokenCounterEl.textContent = `x ${this.game.tokens}`;
    }

    /**
     * completedLevels lives on Game, not this session, since WorldmapState
     * gets torn down/rebuilt on every visit.
     */
    _completeLevel() {
        this.game.completedLevels.add(this.levelNumber);
        this.game.saveProgress();
        this.game.stateMachine.change('worldmap', { justCompleted: this.levelNumber });
    }

    /**
     * Player death - the level darkens fully while a ghost rises from the
     * death spot and fades out, then the Game Over panel offers Retry/Main Menu.
     */
    _startDeathSequence() {
        // Falling into a pit can put the death position below what
        // Camera.js ever scrolls to (it clamps to the level's bottom edge) -
        // pin the ghost to the visible bottom edge instead of spawning it
        // off-screen where the rise-and-fade would never be seen.
        const visibleBottom = this.camera.y + this.game.height / this.camera.zoom - GHOST_FRAME_SIZE / 2;
        const x = this.player.centerX;
        const y = Math.min(this.player.visualCenterY, visibleBottom);
        this.deathSequence.start(x, y);
        this.colorZone.triggerFullDarken(x, y);
        this.game.sound.playSfx('player-death');
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        ctx.save();
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        this._renderWorld(ctx);
        if (this.game.devPanel.showHitboxes) this._renderHitboxes(ctx);

        ctx.restore();
        this.hud.renderPlayerBars(ctx, this.player, this.game.hudScale);
    }

    /**
     * Everything drawn in world (camera-translated) space, back-to-front:
     * buried enemies -> the baked level canvas -> the color mechanic ->
     * interactables/enemies/projectiles -> the player (or its death ghost).
     * Buried enemies (Sentinel.js, not yet triggered) draw before the
     * terrain layer so it occludes them instead of floating in front of it.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderWorld(ctx) {
        for (const enemy of this.enemyRoster.enemies) {
            if (enemy.buried) enemy.render(ctx);
        }
        ctx.drawImage(this.levelCanvas, 0, 0);
        this._renderColorZone(ctx);

        // Ahead of enemies/player, so it reads as level furniture rather
        // than a foreground object they'd otherwise render behind.
        this.interactables.render(ctx);
        for (const enemy of this.enemyRoster.enemies) {
            if (enemy.buried) continue;
            enemy.render(ctx);
            this.hud.renderEnemyBar(ctx, enemy);
        }
        this.combat.render(ctx);
        this.playerFx.render(ctx);

        if (this.deathSequence.active) {
            this.deathSequence.render(ctx);
        } else {
            this.player.render(ctx);
        }
    }

    /**
     * No liveGlow while dead - that would keep punching a hole open right
     * at the death spot every frame, fighting the full-darken effect.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderColorZone(ctx) {
        if (this.deathSequence.active) {
            this.colorZone.render(ctx);
        } else {
            this.colorZone.render(ctx, {
                x: this.player.centerX,
                y: this.player.visualCenterY,
                radius: PLAYER_REVEAL_RADIUS,
            });
        }
    }

    /**
     * Dev Panel toggle - draws each combat-relevant entity's actual
     * Collision/Combat box, not its usually-larger sprite frame, so hit
     * reads line up with what's on screen.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderHitboxes(ctx) {
        ctx.save();
        ctx.lineWidth = 1;

        ctx.strokeStyle = '#5cff8a';
        ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);

        ctx.strokeStyle = '#ffe75c';
        for (const enemy of this.enemyRoster.enemies) {
            if (enemy.dead || enemy.buried) continue;
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }

        ctx.strokeStyle = '#5cc9ff';
        for (const projectile of this.combat.projectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }
        for (const projectile of this.combat.enemyProjectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }

        ctx.restore();
    }
}
