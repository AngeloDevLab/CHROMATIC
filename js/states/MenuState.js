import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { MenuButtons } from '../ui/MenuButtons.js';
import { Panel } from '../ui/Panel.js';

const PLAYER_SPEED = 60;
const CHARACTER_FRAME_SIZE = 96;
const BACKGROUND_OVERLAP_PX = 32;
const CHARACTER_GROUND_OFFSET_PX = 5;

// Settings/Info are self-contained (no dependency on states that don't exist
// yet) so they get real panels now. New Game/Continue are not in here on
// purpose - they lead to Difficulty selection -> CutsceneState ->
// WorldmapState (08_menu-flow.md 9.2), none of which exist yet.
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

        this.colorZone = new ColorZone(this.game.width, this.game.height, 55, {
            fadeDurationSeconds: 5,
            greyBrightness: 0.15,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
            stampIntervalSeconds: 0.25,
        });
        this.colorZone.paintGreyFrom(this.backgroundCanvas);

        const groundY = groundSurfaceY - 64 + CHARACTER_GROUND_OFFSET_PX;

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
        };

        this.player = new Player(0, groundY, animations);
        this.player.enableAutopilot(PLAYER_SPEED, { minX: 0, maxX: this.game.width - this.player.width });

        this._buildOverlay();
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
        const content = PANEL_CONTENT[id];
        if (content) this.panel.open(content.title, content.body);
    }

    exit() {
        this.titleEl?.remove();
        this.menuButtons?.unmount();
        this.panel?.close();
    }

    update(dt) {
        this.player.update(dt);
        this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
    }

    render(ctx) {
        ctx.drawImage(this.backgroundCanvas, 0, 0);
        this.colorZone.render(ctx);
        this.player.render(ctx);
    }
}
