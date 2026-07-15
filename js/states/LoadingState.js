import { State } from './State.js';

export class LoadingState extends State {
    enter() {
        this.label = document.createElement('div');
        this.label.className = 'loading-label';
        this.label.textContent = 'Loading...';
        this.game.overlay.appendChild(this.label);

        this._load();
    }

    async _load() {
        await this.game.assets.loadManifest({
            images: {
                'menu-tileset': 'assets/images/tilesets/tileset-grass.png',
                'guardian-idle': 'assets/images/character/idle.png',
                'guardian-running': 'assets/images/character/running.png',
                'guardian-jump': 'assets/images/character/jump.png',
                'guardian-attack': 'assets/images/character/attack.png',
                'menu-parallax-bg': 'assets/images/backgrounds/forest_bg.png',
                'cutscene-beach-bg': 'assets/images/backgrounds/beach_bg.png',
                'worldmap-prologue-bg': 'assets/images/backgrounds/worldmap_prolog.png',
                'lv1-tileset': 'assets/images/tilesets/tileset_grass.png',
                'enemy-maggot': 'assets/images/enemys/maggot.png',
                'enemy-maggot-running': 'assets/images/enemys/maggot_running.png',
            },
            json: {
                'menu-background-level': 'assets/levels/main-menu.json',
                'lv1-level': 'assets/levels/Lv_1.json',
            },
        });
        this.game.stateMachine.change('menu');
    }

    exit() {
        this.label?.remove();
    }

    render(ctx) {
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
}
