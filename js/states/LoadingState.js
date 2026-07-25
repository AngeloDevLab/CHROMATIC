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
        try {
            await this._loadManifest();
            this.game.stateMachine.change('menu');
        } catch (error) {
            console.error(error);
            this.label.textContent = `Failed to load: ${error.message}. Reload the page to try again.`;
            this.label.classList.add('error');
        }
    }

    async _loadManifest() {
        await this.game.assets.loadManifest({
            images: {
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
                // Every tileset a level might reference - resolved to the
                // right image/gid-range per tile by world/TilesetRegistry.js,
                // not hardcoded to one shared tileset per level any more.
                'prologue-tileset': 'assets/images/tilesets/tileset_grass.png',
                'tileset-gravel': 'assets/images/tilesets/tileset_gravel.png',
                'tileset-scifilab': 'assets/images/tilesets/tileset_scifilab.png',
                'enemy-patroller-walking-idle': 'assets/images/enemys/patroller/patroller-walking-idle.png',
                'enemy-patroller-dead': 'assets/images/enemys/patroller/patroller-dead.png',
                'enemy-charger-walking-idle': 'assets/images/enemys/charger/charger-walking-idle.png',
                'enemy-charger-charge': 'assets/images/enemys/charger/charger-charge.png',
                'enemy-charger-dead': 'assets/images/enemys/charger/charger-dead.png',
                'enemy-sentinel-walking-idle': 'assets/images/enemys/sentinel/sentinel-walking-idle.png',
                'enemy-sentinel-dead': 'assets/images/enemys/sentinel/sentinel-dead.png',
                'enemy-shooter-walking-idle': 'assets/images/enemys/shooter/shooter-walking-idle.png',
                'enemy-shooter-shooting': 'assets/images/enemys/shooter/shooter-shooting.png',
                'enemy-shooter-dead': 'assets/images/enemys/shooter/shooter-dead.png',
                'enemy-shooter-projectile': 'assets/images/enemys/shooter/shooter-projectile.png',
                'portal-closed': 'assets/images/objects/portal-closed.png',
                'portal-open': 'assets/images/objects/portal-open.png',
                'portal-opens': 'assets/images/objects/portal-opens.png',
                // Lvl 4 Gimmick (entities/Trapdoor.js) - closed is a single
                // 128x32 frame, opens is a 10-frame 128x32 strip (1280x32).
                'trapdoor-closed': 'assets/images/objects/trapdoor-closed.png',
                'trapdoor-opens': 'assets/images/objects/trapdoor-opens.png',
                // Lvl 5 Secret Room (entities/SecretDoor.js) - closed/open are
                // single 32x64 frames, opens is a 7-frame 32x64 strip (224x64).
                'secretdoor-closed': 'assets/images/objects/secretdoor-closed.png',
                'secretdoor-open': 'assets/images/objects/secretdoor-open.png',
                'secretdoor-opens': 'assets/images/objects/secretdoor-opens.png',
                // Lvl 5 Secret Room (entities/BuffTerminal.js) - single static
                // 32x64 frame, no animation.
                'buffterminal': 'assets/images/objects/buffterminal.png',
                // Wraith of the Shifting Sands (Lvl 3 Miniboss, entities/bosses/
                // Wraith.js) - each a fixed 128x256 frame (see the earlier PixelLab
                // sizing discussion). idle loops; the rest are one-shot transitions
                // between held end-poses, matching how the sprites were actually
                // animated rather than a generic loop per state.
                'boss-wraith-idle': 'assets/images/enemys/bosses/floating-idle.png',
                'boss-wraith-to-firing': 'assets/images/enemys/bosses/from-idle-to-firing.png',
                'boss-wraith-firing': 'assets/images/enemys/bosses/firing.png',
                'boss-wraith-to-vulnerable': 'assets/images/enemys/bosses/from-firing-to-vulnerable.png',
                'boss-wraith-vulnerable': 'assets/images/enemys/bosses/vulnerable.png',
                'boss-wraith-to-idle': 'assets/images/enemys/bosses/from-vulnerable-to-idle.png',
                'boss-wraith-dead': 'assets/images/enemys/bosses/dead.png',
            },
            json: {
                'menu-background-level': 'assets/levels/mainMenu.json',
                'lv1-level': 'assets/levels/Lv_1.json',
                'lv2-level': 'assets/levels/Lv_2.json',
                'lv3-level': 'assets/levels/Lv_3.json',
                'lv4-level': 'assets/levels/Lv_4.json',
                'lv5-level': 'assets/levels/Lv_5.json',
            },
        });
    }

    exit() {
        this.label?.remove();
    }

    render(ctx) {
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
}
