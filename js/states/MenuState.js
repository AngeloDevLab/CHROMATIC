import { State } from './State.js';
import { Level } from '../world/Level.js';
import { buildTilesetRegistry } from '../world/TilesetRegistry.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { MenuButtons } from '../ui/MenuButtons.js';
import { Panel } from '../ui/Panel.js';
import { buildSettingsBody, wireSettingsPanel } from '../ui/SettingsPanel.js';
import { buildInfoBody } from '../ui/InfoPanelContent.js';
import { HowToPlayPanel } from '../ui/HowToPlayPanel.js';
import { MENU_ZONE, MENU_TRACK_KEYS } from '../core/MusicPlaylist.js';

const PLAYER_SPEED = 60;
const ENEMY_SPEED = 70;
const REVEAL_RADIUS = 55;
const DARKEN_RADIUS = 65;
const PASS_DELAY_SECONDS = 1;
const CHARACTER_FRAME_SIZE = 96;
/**
 * enemy-patroller-walking-idle.png is its own 64x64 sheet, unrelated to the
 * player's 96x96 convention above.
 */
const ENEMY_FRAME_SIZE = 64;
const BACKGROUND_OVERLAP_PX = 32;

/**
 * Difficulty scales only incoming damage - enemy HP and the player's own damage stay the same across all three.
 */
const DIFFICULTIES = [
    { id: 'easy', label: 'Easy', description: 'Can afford mistakes, survives several hits. (-50% incoming damage)' },
    { id: 'normal', label: 'Normal', description: 'Normal margin for error.' },
    { id: 'hard', label: 'Hard', description: 'Needs near-perfect play - many hits can be a one-shot. (+100% incoming damage)' },
];

// Continue jumps straight to WorldmapState (game.difficulty/completedLevels
// are already loaded from SaveSystem by then, see Game.js's loadProgress())
// - MenuButtons only enables the button once game.difficulty is non-null,
// i.e. New Game has been confirmed at least once.
//
// New Game opens Difficulty selection below, which resets existing
// progress (Game.resetProgress()) before continuing into CutsceneState ->
// WorldmapState - without that reset, a persisted save would make New Game
// silently resume the old one instead of actually restarting.
export class MenuState extends State {
    /**
     * Builds the living-background scene and the menu overlay.
     */
    enter() {
        this.level = Level.load(this.game.assets, 'menu-background-level', buildTilesetRegistry(this.game.assets));
        const groundSurfaceY = this.level.findGroundSurfaceY();

        this.game.music.setZone(MENU_ZONE, MENU_TRACK_KEYS);

        this._buildBackground(groundSurfaceY);
        this._buildColorZone();
        this._buildActors(groundSurfaceY);
        this._startPlayerPass();
        this._buildOverlay();
    }

    /**
     * Renders the shared parallax + level tile layers once onto a static
     * background canvas, cover-fit against the sky gap above the ground
     * line and extended slightly past it (BACKGROUND_OVERLAP_PX).
     * @param {number} groundSurfaceY - World-space Y of the visible ground surface.
     */
    _buildBackground(groundSurfaceY) {
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCanvas.width = this.game.width;
        this.backgroundCanvas.height = this.game.height;
        const bgCtx = this.backgroundCanvas.getContext('2d');
        const parallax = this.game.assets.getImage('menu-parallax-bg');
        const parallaxHeight = groundSurfaceY + BACKGROUND_OVERLAP_PX;
        const parallaxScale = parallaxHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        const parallaxX = (this.game.width - parallaxWidth) / 2;
        bgCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, parallaxX, 0, parallaxWidth, parallaxHeight);
        
        this.level.drawAllLayers(bgCtx);
    }

    /**
     * Permanent reveal (same mode as real gameplay), erased by the patroller pass.
     */
    _buildColorZone() {
        this.colorZone = new ColorZone(this.game.width, this.game.height, REVEAL_RADIUS, {
            greyBrightness: 0.3,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.backgroundCanvas);
    }

    /**
     * Spawns the player/patroller actors used for the living-background
     * choreography (see _startPlayerPass()/_startEnemyPass()/update()).
     * @param {number} groundSurfaceY - World-space Y of the visible ground surface.
     */
    _buildActors(groundSurfaceY) {
        this._buildPlayerActor(groundSurfaceY - 64);
        this._buildEnemyActor(groundSurfaceY);
    }

    /**
     * Spawns the decorative player actor for the living background.
     * @param {number} groundY - World-space Y of the player's feet.
     */
    _buildPlayerActor(groundY) {
        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
        };
        this.player = new Player(0, groundY, animations);
    }

    /**
     * Spawns the decorative patroller actor for the living background.
     * @param {number} groundSurfaceY - World-space Y of the visible ground surface.
     */
    _buildEnemyActor(groundSurfaceY) {
        const patrollerSprite = this.game.assets.getImage('enemy-patroller-walking-idle');
        this.enemy = new Enemy(0, groundSurfaceY - ENEMY_FRAME_SIZE, patrollerSprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE);
        this.enemy.setAnimations({
            running: new SpriteAnimation(patrollerSprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 10),
        });
    }

    /**
     * Random direction each pass; starts off the canvas edge on the entering side, ends once fully off the far edge (see _hasExited()).
     */
    _startPlayerPass() {
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.player.x = direction === 1 ? -this.player.width : this.game.width;
        this.player.enableFreeRun(direction * PLAYER_SPEED);
        this.phase = 'player';
    }

    /**
     * Mirrors _startPlayerPass() for the erasing patroller pass.
     */
    _startEnemyPass() {
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.enemy.x = direction === 1 ? -this.enemy.width : this.game.width;
        this.enemy.enableFreeRun(direction * ENEMY_SPEED);
        this.phase = 'enemy';
    }

    /**
     * Checks whether an entity has fully left the screen in its direction of travel.
     * @param {Entity} entity - Entity to check against the screen bounds.
     * @returns {boolean}
     */
    _hasExited(entity) {
        return entity.vx >= 0 ? entity.x > this.game.width : entity.x + entity.width < 0;
    }

    /**
     * Beat between passes; both actors are off-screen and nothing
     * renders/updates color during this phase, see update()/render().
     * @param {() => void} nextPass - Pass to start once the delay elapses.
     */
    _startDelay(nextPass) {
        this.phase = 'delay';
        this._delayTimer = PASS_DELAY_SECONDS;
        this._nextPass = nextPass;
    }

    /**
     * Builds the title and main menu button list.
     */
    _buildOverlay() {
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'menu-title';
        this.titleEl.textContent = 'CHROMATIC';
        this.game.overlay.appendChild(this.titleEl);
        this.panel = new Panel(this.game.overlay);
        this.howToPlayPanel = new HowToPlayPanel(this.panel);
        this.menuButtons = new MenuButtons(this.game.overlay, {
            hasSave: this.game.difficulty !== null,
            onSelect: (id) => this._handleMenuSelect(id),
        });
        this.menuButtons.mount();
    }

    /**
     * Dispatches a menu button selection to its handler.
     * @param {string} id - Selected menu item id.
     */
    _handleMenuSelect(id) {
        const handlers = {
            continue: () => this.game.stateMachine.change('worldmap'),
            'new-game': () => this._openDifficultySelect(),
            settings: () => this._openSettings(),
            'how-to-play': () => this._openHowToPlay(),
            info: () => this._openInfo(),
        };
        handlers[id]?.();
    }

    /**
     * Opens the Settings panel (volume/mute/fullscreen).
     */
    _openSettings() {
        this.panel.open('Settings', buildSettingsBody(this.game), {
            onMount: (root) => wireSettingsPanel(root, this.game),
        });
    }

    /**
     * Opens the Info panel - Credits (built from assets/credits.json,
     * already loaded by LoadingState.js), Legal Notice, Privacy Policy.
     */
    _openInfo() {
        this.panel.open('Info', buildInfoBody(this.game.assets));
    }

    /**
     * Opens How to Play into the shared Panel instance (see
     * HowToPlayPanel.js's own comment on why it takes an injected Panel).
     */
    _openHowToPlay() {
        this.howToPlayPanel.open();
    }

    /**
     * Opens the difficulty-choice panel.
     */
    _openDifficultySelect() {
        this.panel.open('Choose Difficulty', this._buildDifficultyOptionsHTML(), {
            onMount: (root) => this._wireDifficultyOptions(root),
        });
    }

    /**
     * Builds the difficulty-choice buttons' markup.
     * @returns {string} Markup for the difficulty-choice buttons.
     */
    _buildDifficultyOptionsHTML() {
        const options = DIFFICULTIES.map((difficulty) => `
            <button class="difficulty-option" data-id="${difficulty.id}">
                <span class="difficulty-label">${difficulty.label}</span>
                <span class="difficulty-description">${difficulty.description}</span>
            </button>
        `).join('');
        return `<div class="difficulty-options">${options}</div>`;
    }

    /**
     * Confirming a difficulty is the actual "start a new game" moment - resets
     * any existing progress first (see the top-of-file note on why), then
     * sets and persists the new difficulty.
     * @param {HTMLElement} root - The mounted panel's root element.
     */
    _wireDifficultyOptions(root) {
        for (const button of root.querySelectorAll('.difficulty-option')) {
            button.addEventListener('click', () => {
                this.game.resetProgress();
                this.game.difficulty = button.dataset.id;
                this.game.saveProgress();
                this.panel.close();
                this.game.stateMachine.change('cutscene');
            });
        }
    }

    /**
     * Tears down the menu overlay/scene.
     */
    exit() {
        this.titleEl?.remove();
        this.menuButtons?.unmount();
        this.panel?.close();
    }

    /**
     * Advances whichever actor's pass is currently playing.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (this.phase === 'player') {
            this.player.update(dt);
            this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
            if (this._hasExited(this.player)) this._startDelay(() => this._startEnemyPass());
        } else if (this.phase === 'enemy') {
            this.enemy.update(dt);
            this.colorZone.darken(this.enemy.centerX, this.enemy.centerY, DARKEN_RADIUS);
            if (this._hasExited(this.enemy)) this._startDelay(() => this._startPlayerPass());
        } else {
            this._delayTimer -= dt;
            if (this._delayTimer <= 0) this._nextPass();
        }
    }

    /**
     * Draws the background, color overlay, and whichever actor is active.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.drawImage(this.backgroundCanvas, 0, 0);
        if (this.phase === 'player') {
            this.colorZone.render(ctx, { x: this.player.centerX, y: this.player.visualCenterY, radius: REVEAL_RADIUS });
            this.player.render(ctx);
        } else {
            this.colorZone.render(ctx);
            if (this.phase === 'enemy') this.enemy.render(ctx);
        }
    }
}
