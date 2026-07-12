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
                'menu-parallax-bg': 'assets/images/backgrounds/forest_bg.png',
            },
            json: {
                'menu-background-level': 'assets/levels/main-menu.json',
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
