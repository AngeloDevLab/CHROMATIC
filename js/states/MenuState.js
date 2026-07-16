import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { MenuButtons } from '../ui/MenuButtons.js';
import { Panel } from '../ui/Panel.js';

const PLAYER_SPEED = 60;
const ENEMY_SPEED = 70;
const REVEAL_RADIUS = 55;
const DARKEN_RADIUS = 65;
const PASS_DELAY_SECONDS = 1;
const CHARACTER_FRAME_SIZE = 96;
const BACKGROUND_OVERLAP_PX = 32;

// Difficulty scales only incoming damage (04_health-save-system.md 5.3) -
// enemy HP and the player's own damage stay the same across all three.
const DIFFICULTIES = [
    { id: 'easy', label: 'Easy', description: 'Can afford mistakes, survives several hits.' },
    { id: 'normal', label: 'Normal', description: 'Normal margin for error.' },
    { id: 'hard', label: 'Hard', description: 'Needs near-perfect play - many hits can be a one-shot.' },
];

// Settings/Info are self-contained (no dependency on states that don't exist
// yet) so they get real panels now. Continue has no action yet - it stays
// disabled until a SaveManager exists. New Game opens Difficulty selection
// below, which continues into CutsceneState -> WorldmapState (08_menu-flow.md 9.2).
const PANEL_CONTENT = {
    settings: { title: 'Settings', body: '<p>Audio, Controls, and Language settings - coming soon.</p>' },
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
    enter() {
        this.level = Level.load(this.game.assets, 'menu-background-level', 'menu-tileset');
        const groundSurfaceY = this.level.findGroundSurfaceY();

        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundCanvas.width = this.game.width;
        this.backgroundCanvas.height = this.game.height;
        const bgCtx = this.backgroundCanvas.getContext('2d');

        // Cover-fit the parallax image against the sky gap (0..groundSurfaceY) instead of
        // the canvas width, so it reaches down to the ground line with no gap and no
        // vertical stretch - the horizontal overflow this creates is center-cropped.
        // It's deliberately extended a bit past the ground line (BACKGROUND_OVERLAP_PX)
        // so it peeks through the ground tiles' own transparent padding (grass overhang
        // etc.) instead of cutting off in a hard, exact seam.
        const parallax = this.game.assets.getImage('menu-parallax-bg');
        const parallaxHeight = groundSurfaceY + BACKGROUND_OVERLAP_PX;
        const parallaxScale = parallaxHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        const parallaxX = (this.game.width - parallaxWidth) / 2;
        bgCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, parallaxX, 0, parallaxWidth, parallaxHeight);

        this.level.drawAllLayers(bgCtx);

        // Permanent reveal now (same mode as real gameplay, 03_mechanics.md 4.1)
        // instead of the old decorative fading-bubble variant - the maggot pass
        // below is what erases it instead, previewing the real
        // reveal/darken exchange rather than a separate menu-only effect.
        this.colorZone = new ColorZone(this.game.width, this.game.height, REVEAL_RADIUS, {
            greyBrightness: 0.15,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.backgroundCanvas);

        const groundY = groundSurfaceY - 64;

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
        };
        this.player = new Player(0, groundY, animations);

        const maggotSprite = this.game.assets.getImage('enemy-maggot');
        this.enemy = new Enemy(0, groundSurfaceY - maggotSprite.height, maggotSprite);
        this.enemy.setAnimations({
            running: new SpriteAnimation(this.game.assets.getImage('enemy-maggot-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 10),
        });

        // Living background choreography: the player runs across leaving a
        // permanent trail, then once they've fully exited, a maggot runs
        // across erasing it, then it repeats - see _startPlayerPass()/
        // _startEnemyPass()/update().
        this._startPlayerPass();

        this._buildOverlay();
    }

    // Random direction each pass (03_mechanics.md 4.1's living-background
    // demo) so the loop doesn't always run the same way - starts off the
    // canvas edge on the entering side, ends once fully off the far edge
    // (see _hasExited()).
    _startPlayerPass() {
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.player.x = direction === 1 ? -this.player.width : this.game.width;
        this.player.enableFreeRun(direction * PLAYER_SPEED);
        this.phase = 'player';
    }

    _startEnemyPass() {
        const direction = Math.random() < 0.5 ? 1 : -1;
        this.enemy.x = direction === 1 ? -this.enemy.width : this.game.width;
        this.enemy.enableFreeRun(direction * ENEMY_SPEED);
        this.phase = 'enemy';
    }

    _hasExited(entity) {
        return entity.vx >= 0 ? entity.x > this.game.width : entity.x + entity.width < 0;
    }

    // Beat between passes so the next entrance doesn't feel instant/glued to
    // the previous exit - both are off-screen and nothing renders/updates
    // color during this phase, see update()/render().
    _startDelay(nextPass) {
        this.phase = 'delay';
        this._delayTimer = PASS_DELAY_SECONDS;
        this._nextPass = nextPass;
    }

    _buildOverlay() {
        this.titleEl = document.createElement('div');
        this.titleEl.className = 'menu-title';
        this.titleEl.textContent = 'CHROMATIC';
        this.game.overlay.appendChild(this.titleEl);

        this.panel = new Panel(this.game.overlay);

        this.menuButtons = new MenuButtons(this.game.overlay, {
            hasSave: false,
            onSelect: (id) => this._handleMenuSelect(id),
        });
        this.menuButtons.mount();
    }

    _handleMenuSelect(id) {
        if (id === 'new-game') {
            this._openDifficultySelect();
            return;
        }

        const content = PANEL_CONTENT[id];
        if (content) this.panel.open(content.title, content.body);
    }

    _openDifficultySelect() {
        const options = DIFFICULTIES.map((difficulty) => `
            <button class="difficulty-option" data-id="${difficulty.id}">
                <span class="difficulty-label">${difficulty.label}</span>
                <span class="difficulty-description">${difficulty.description}</span>
            </button>
        `).join('');

        this.panel.open('Choose Difficulty', `<div class="difficulty-options">${options}</div>`, {
            onMount: (root) => {
                for (const button of root.querySelectorAll('.difficulty-option')) {
                    button.addEventListener('click', () => {
                        // No SaveManager yet - difficulty just lives on Game for now,
                        // properly persisted once 04_health-save-system.md 5.4 exists.
                        this.game.difficulty = button.dataset.id;
                        this.panel.close();
                        this.game.stateMachine.change('cutscene');
                    });
                }
            },
        });
    }

    exit() {
        this.titleEl?.remove();
        this.menuButtons?.unmount();
        this.panel?.close();
    }

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

    render(ctx) {
        ctx.drawImage(this.backgroundCanvas, 0, 0);
        this.colorZone.render(ctx);
        if (this.phase === 'player') {
            this.player.render(ctx);
        } else if (this.phase === 'enemy') {
            this.enemy.render(ctx);
        }
    }
}
