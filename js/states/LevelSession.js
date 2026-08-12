import { Level } from '../world/Level.js';
import { buildTilesetRegistry } from '../world/TilesetRegistry.js';
import { EnemyRoster, isBossSpawnName } from '../mechanics/EnemyRoster.js';
import { GHOST_FRAME_SIZE } from '../mechanics/DeathSequence.js';
import { LevelSessionSetup } from './LevelSessionSetup.js';
import { LevelSessionRenderer } from './LevelSessionRenderer.js';

/**
 * Slack past the level's bottom edge before a fall counts as death.
 */
const FALL_DEATH_MARGIN_PX = 64;

/**
 * Player's live-glow/permanent color trail radius (03_mechanics.md 4.1),
 * shared with Interactables.js's revealRadius option.
 */
export const PLAYER_REVEAL_RADIUS = 55;

/**
 * Real Prologue levels (Tiled exports, assets/levels/Lv_N.json).
 * Player/enemy spawn positions come from each level's PlayerStart/
 * EnemySpawn objects (10_technical-architecture.md 11.6.2); an
 * unrecognized EnemySpawn name is skipped with a console warning.
 */
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
 * BossState.js's arena-sizing) before the real LevelSession builds its own.
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
// enemies/HUD/interactables/combat - extracted out of GameState.js. Not a
// State (no enter()/exit()), just a plain constructor + update()/render()/
// destroy(), driven by whichever State owns it (GameState for a normal
// level, BossState for a boss arena). Construction (LevelSessionSetup.js)
// and rendering (LevelSessionRenderer.js) are composed onto this class the
// same way Player.js composes PlayerHealth/PlayerRenderer/PlayerMovement.
//
// A few non-obvious choices, gathered here instead of scattered near their
// call sites: the constructor leaves Camera's zoom at its default (1) even
// for a Boss - BossState.js handles that separately, via its own
// arena-sized buffer. _updateWorld() re-applies every unlocked ability
// every frame - idempotent, so a DevPanel unlock takes effect immediately
// instead of only on the next respawn. _startDeathSequence() clamps the
// ghost's rise position to the camera's visible bottom edge, since a pit
// death can land below where Camera.js ever scrolls - without this the
// rise-and-fade would spawn off-screen.
export class LevelSession {
    /**
     * @param {Game} game - Owning Game instance.
     * @param {{chapterId: string, level: number}} params - Level to load.
     */
    constructor(game, { chapterId, level } = {}) {
        this.game = game;
        this.chapterId = chapterId;
        this.levelNumber = level;
        this.renderer = new LevelSessionRenderer(this);

        const setup = new LevelSessionSetup(this);
        setup.loadLevel();
        setup.setMusicZone();
        setup.buildLevelCanvas();
        setup.initColorZone();
        setup.spawnPlayer();
        this.enemyRoster = new EnemyRoster(this.game, this.level, this.player, this.collision);
        setup.initInteractablesAndHud();
        setup.initCombat();
    }

    /**
     * Tears down everything this session added to the DOM, called by
     * whichever State hosts this session from its own exit().
     */
    destroy() {
        this.healthValueEl?.remove();
        this.shieldValueEl?.remove();
        this.healthIconEl?.remove();
        this.shieldIconEl?.remove();
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
     * Only pushes Pause when neither Merchant dialogue nor Buff choice is
     * active. Always drains the press, even while dead, so a stale one
     * can't leak into whatever comes next.
     */
    _handlePauseInput() {
        const pausePressed = this.game.input.consumePausePress();
        const merchantOpen = this.interactables.merchantDialogue.isOpen;
        if (pausePressed && !this.deathSequence.active && !merchantOpen) {
            this.game.stateMachine.push('pause');
        }
    }

    /**
     * Freezes gameplay the same way Pause does; [E] here advances the dialogue instead of interacting with the level.
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
        this._updatePlayer(dt);
        this._updateEnemiesAndInteractables(dt);
        this._updateCombatAndReveal(dt);
        this._updateCameraAndHud(dt);
    }

    /**
     * @param {number} dt
     */
    _updatePlayer(dt) {
        this.player.godmode = this.game.devPanel.godmode;
        for (const id of this.game.abilities) this.player.unlockAbility(id);
        this.player.update(dt);
        this.playerFx.update(dt);
        this.interactables.blockSecretDoor();
    }

    /**
     * @param {number} dt
     */
    _updateEnemiesAndInteractables(dt) {
        this.enemyRoster.updateEnemies(dt, this.combat, this.colorZone, PLAYER_REVEAL_RADIUS);
        this.interactables.updateEntities(dt);
        this._checkFallDeath();
    }

    /**
     * @param {number} dt
     */
    _updateCombatAndReveal(dt) {
        this.combat.update(dt, this.game.difficulty);
        this.enemyRoster.updateColorReveal(this.colorZone);
        this.enemyRoster.checkLevelFullyRevealed(this.colorZone, this.interactables);
        this.enemyRoster.checkBossDefeated(this.interactables);
        this._updateDeathSequence(dt);
    }

    /**
     * @param {number} dt
     */
    _updateCameraAndHud(dt) {
        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        this._updateInteractablePrompts();
        this._updateColorZone(dt);
        this.damageNumbers.update(dt, this.camera);
        this._updateHudText();
    }

    /**
     * Kills the player once they fall past the level's bottom edge (with margin).
     */
    _checkFallDeath() {
        if (!this.player.dead && this.player.y > this.level.pixelHeight + FALL_DEATH_MARGIN_PX) {
            this.player.die();
        }
    }

    /**
     * Starts the ghost-rise once the fall animation finishes, then pushes GameOverState once its fade-out completes.
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
     * Consumed once here rather than in each of Interactables.js's own
     * _update*Prompt() methods, which would otherwise race to drain the same press.
     */
    _updateInteractablePrompts() {
        const interactPressed = this.game.input.consumeInteractPress();
        this.interactables.updatePrompts(this.camera, interactPressed, this.enemyRoster.levelFullyRevealed);
    }

    /**
     * Stops feeding position updates once the death sequence's full-darken
     * sweep finishes, to avoid punching a fresh colored hole at the frozen death spot.
     * @param {number} dt
     */
    _updateColorZone(dt) {
        if (!this.deathSequence.active || this.colorZone.isTransitioning) {
            this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
        }
    }

    /**
     * Refreshes the player's HP/Shield HTML labels (LevelSessionSetup.js's
     * _createHudValueLabel()).
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
        this.renderer.render(ctx);
    }
}
