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
                'menu-tileset': 'assets/images/tilesets/tileset_grass.png',
                'guardian-idle': 'assets/images/character/idle.png',
                'guardian-running': 'assets/images/character/running.png',
                'guardian-jump': 'assets/images/character/jump.png',
                'guardian-attack': 'assets/images/character/attack.png',
                'guardian-dead-ghost': 'assets/images/character/dead-ghost.png',
                'guardian-dead': 'assets/images/character/dead.png',
                'thrown-sword': 'assets/images/character/thrown_sword.png',
                'thrown-sword-trail': 'assets/images/character/thrown_sword_trail.png',
                'menu-parallax-bg': 'assets/images/backgrounds/forest_bg.png',
                'cutscene-beach-bg': 'assets/images/backgrounds/beach_bg.png',
                'worldmap-prologue-bg': 'assets/images/backgrounds/worldmap_prolog.png',
                // Shared by every Prologue level so far (see LEVEL_JSON_KEYS in
                // GameState.js) - not "lv1-tileset" since Lv_2 reuses it too.
                'prologue-tileset': 'assets/images/tilesets/tileset_grass.png',
                'enemy-patroller-walking-idle': 'assets/images/enemys/patroller/patroller-walking-idle.png',
                'enemy-patroller-dead': 'assets/images/enemys/patroller/patroller-dead.png',
                'enemy-charger-walking-idle': 'assets/images/enemys/charger/charger-walking-idle.png',
                'enemy-charger-charge': 'assets/images/enemys/charger/charger-charge.png',
                'enemy-charger-dead': 'assets/images/enemys/charger/charger-dead.png',
                'portal-closed': 'assets/images/objects/portal-closed.png',
                'portal-open': 'assets/images/objects/portal-open.png',
                'portal-opens': 'assets/images/objects/portal-opens.png',
            },
            json: {
                'menu-background-level': 'assets/levels/mainMenu.json',
                'lv1-level': 'assets/levels/Lv_1.json',
                'lv2-level': 'assets/levels/Lv_2.json',
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
