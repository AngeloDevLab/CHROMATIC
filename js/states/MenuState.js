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

const PLAYER_SPEED = 60;
const ENEMY_SPEED = 70;
const REVEAL_RADIUS = 55;
const DARKEN_RADIUS = 65;
const PASS_DELAY_SECONDS = 1;
const CHARACTER_FRAME_SIZE = 96;
// enemy-patroller-walking-idle.png is its own 64x64 sheet, unrelated to the
// player's 96x96 convention above.
const ENEMY_FRAME_SIZE = 64;
const BACKGROUND_OVERLAP_PX = 32;

// Difficulty scales only incoming damage (04_health-save-system.md 5.3) -
// enemy HP and the player's own damage stay the same across all three.
const DIFFICULTIES = [
    { id: 'easy', label: 'Easy', description: 'Can afford mistakes, survives several hits. (-50% incoming damage)' },
    { id: 'normal', label: 'Normal', description: 'Normal margin for error.' },
    { id: 'hard', label: 'Hard', description: 'Needs near-perfect play - many hits can be a one-shot. (+100% incoming damage)' },
];

// Settings/Info are self-contained (no dependency on states that don't exist
// yet) so they get real panels now. Continue jumps straight to WorldmapState
// (game.difficulty/completedLevels/etc. are already loaded from SaveSystem by
// then, see Game.js's loadProgress()) - MenuButtons only enables the button
// once game.difficulty is non-null, i.e. New Game has been confirmed at
// least once. New Game opens Difficulty selection below, which resets
// existing progress (Game.resetProgress()) before continuing into
// CutsceneState -> WorldmapState (08_menu-flow.md 9.2) - without that reset,
// a persisted save would make New Game silently resume the old one instead
// of actually restarting.
const PANEL_CONTENT = {
    info: {
        title: 'Info',
        body: `
            <h3>Credits</h3>
            <p>Credits - coming soon.</p>
            <h3>Legal Notice</h3>
            <p>Legal notice - coming soon.</p>
            <h3>Privacy Policy</h3>
            <p>Privacy policy - coming soon.</p>
        `,
    },
};

export class MenuState extends State {
    /**
     * Builds the living-background scene and the menu overlay.
     */
    enter() {
        this.level = Level.load(this.game.assets, 'menu-background-level', buildTilesetRegistry(this.game.assets));
        const groundSurfaceY = this.level.findGroundSurfaceY();

        this._buildBackground(groundSurfaceY);
        this._buildColorZone();
        this._buildActors(groundSurfaceY);
        this._startPlayerPass();
        this._buildOverlay();
    }

    /**
     * Renders the shared forest parallax + level tile layers once onto a
     * static background canvas. Cover-fit against the sky gap
     * (0..groundSurfaceY) instead of the canvas width, so it reaches down
     * to the ground line with no gap and no vertical stretch - the
     * horizontal overflow this creates is center-cropped. Deliberately
     * extended a bit past the ground line (BACKGROUND_OVERLAP_PX) so it
     * peeks through the ground tiles' own transparent padding (grass
     * overhang etc.) instead of cutting off in a hard, exact seam.
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
     * Permanent reveal (same mode as real gameplay, 03_mechanics.md 4.1)
     * instead of the old decorative fading-bubble variant - the patroller
     * pass is what erases it instead, previewing the real reveal/darken
     * exchange rather than a separate menu-only effect.
     */
    _buildColorZone() {
        this.colorZone = new ColorZone(this.game.width, this.game.height, REVEAL_RADIUS, {
            greyBrightness: 0.15,
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
        const groundY = groundSurfaceY - 64;

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
        };
        this.player = new Player(0, groundY, animations);

        const patrollerSprite = this.game.assets.getImage('enemy-patroller-walking-idle');
        this.enemy = new Enemy(0, groundSurfaceY - ENEMY_FRAME_SIZE, patrollerSprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE);
        this.enemy.setAnimations({
            running: new SpriteAnimation(patrollerSprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 10),
        });
    }

    /**
     * Random direction each pass (03_mechanics.md 4.1's living-background
     * demo) so the loop doesn't always run the same way - starts off the
     * canvas edge on the entering side, ends once fully off the far edge
     * (see _hasExited()).
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
     * @param {Entity} entity
     * @returns {boolean}
     */
    _hasExited(entity) {
        return entity.vx >= 0 ? entity.x > this.game.width : entity.x + entity.width < 0;
    }

    /**
     * Beat between passes so the next entrance doesn't feel instant/glued
     * to the previous exit - both are off-screen and nothing
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

        this.menuButtons = new MenuButtons(this.game.overlay, {
            hasSave: this.game.difficulty !== null,
            onSelect: (id) => this._handleMenuSelect(id),
        });
        this.menuButtons.mount();
    }

    /**
     * @param {string} id - Selected menu item id.
     */
    _handleMenuSelect(id) {
        if (id === 'continue') {
            this.game.stateMachine.change('worldmap');
            return;
        }
        if (id === 'new-game') {
            this._openDifficultySelect();
            return;
        }
        if (id === 'settings') {
            this._openSettings();
            return;
        }

        const content = PANEL_CONTENT[id];
        if (content) this.panel.open(content.title, content.body);
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
     * Opens the difficulty-choice panel.
     */
    _openDifficultySelect() {
        this.panel.open('Choose Difficulty', this._buildDifficultyOptionsHTML(), {
            onMount: (root) => this._wireDifficultyOptions(root),
        });
    }

    /**
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
