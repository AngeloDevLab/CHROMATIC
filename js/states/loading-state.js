// Waits for pointerup, not pointerdown - Chrome's autoplay unlock isn't granted until a gesture
// completes.

import { State } from './state.js';

/** Loads every image/JSON/sound asset, then waits for a user gesture before entering the Menu. */
export class LoadingState extends State {
    /**
     * Shows the loading label and kicks off asset/sound loading.
     */
    enter() {
        this.label = document.createElement('div');
        this.label.className = 'loading-label';
        this.label.textContent = 'Loading... 0%';
        this.game.overlay.appendChild(this.label);
        this._progress = { done: 0, total: 0 };
        this._load();
    }

    /**
     * Loads every asset/sound manifest in parallel, then gates the state
     * transition behind a user gesture; shows an error message instead if
     * anything fails to load.
     */
    async _load() {
        try {
            await Promise.all([this._loadManifest(), this._loadSounds()]);
            this._waitForContinue();
        } catch (error) {
            console.error(error);
            this.label.textContent = `Failed to load: ${error.message}. Reload the page to try again.`;
            this.label.classList.add('error');
        }
    }

    /**
     * Updates the loading percentage display.
     */
    _onAssetLoaded() {
        this._progress.done++;
        const percent = Math.round((this._progress.done / this._progress.total) * 100);
        this.label.textContent = `Loading... ${percent}%`;
    }

    /**
     * Gates the state transition behind one user gesture.
     */
    _waitForContinue() {
        this.label.textContent = 'Press any key to continue';
        const proceed = () => {
            document.removeEventListener('keydown', proceed);
            document.removeEventListener('pointerup', proceed);
            this._applyFullscreenPreference();
            this.game.sound.resume();
            this.game.music.start();
            this.game.stateMachine.change('menu');
        };
        document.addEventListener('keydown', proceed);
        document.addEventListener('pointerup', proceed);
    }

    /**
     * Re-enters fullscreen if the player had it on last session.
     */
    _applyFullscreenPreference() {
        if (this.game.save.get('fullscreen', false) && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        }
    }

    /**
     * Loads every image/level JSON the Prologue can reference.
     */
    async _loadManifest() {
        const manifest = {
            images: {
                'guardian-idle': 'assets/images/character/idle.png',
                'guardian-running': 'assets/images/character/running.png',
                'guardian-jump': 'assets/images/character/jump.png',
                'guardian-attack': 'assets/images/character/attack.png',
                'guardian-afk-enter': 'assets/images/character/enter-afk.png',
                'guardian-afk': 'assets/images/character/afk.png',
                'guardian-dead-ghost': 'assets/images/character/dead-ghost.png',
                'guardian-dead': 'assets/images/character/dead.png',
                'thrown-sword': 'assets/images/character/thrown-sword.png',
                'thrown-sword-trail': 'assets/images/character/thrown-sword-trail.png',
                'menu-parallax-bg': 'assets/images/backgrounds/forest-bg.png',
                'cutscene-beach-bg': 'assets/images/backgrounds/beach-bg.png',
                'worldmap-prologue-bg': 'assets/images/backgrounds/worldmap-prolog.png',
                'prologue-tileset': 'assets/images/tilesets/tileset-grass.png',
                'tileset-gravel': 'assets/images/tilesets/tileset-gravel.png',
                'tileset-scifilab': 'assets/images/tilesets/tileset-scifilab.png',
                'enemy-patroller-walking-idle': 'assets/images/enemys/patroller/patroller-walking-idle.png',
                'enemy-patroller-dead': 'assets/images/enemys/patroller/patroller-dead.png',
                'enemy-charger-walking-idle': 'assets/images/enemys/charger/charger-walking-idle.png',
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
                'trapdoor-closed': 'assets/images/objects/trapdoor-closed.png',
                'trapdoor-opens': 'assets/images/objects/trapdoor-opens.png',
                'secretdoor-closed': 'assets/images/objects/secretdoor-closed.png',
                'secretdoor-open': 'assets/images/objects/secretdoor-open.png',
                'secretdoor-opens': 'assets/images/objects/secretdoor-opens.png',
                'buffterminal': 'assets/images/objects/buffterminal.png',
                'merchant': 'assets/images/objects/merchant.png',
                'token': 'assets/images/objects/token.png',
                'boss-wraith-idle': 'assets/images/enemys/bosses/prologue/lv-3-boss/floating-idle.png',
                'boss-wraith-to-firing': 'assets/images/enemys/bosses/prologue/lv-3-boss/from-idle-to-firing.png',
                'boss-wraith-firing': 'assets/images/enemys/bosses/prologue/lv-3-boss/firing.png',
                'boss-wraith-to-vulnerable': 'assets/images/enemys/bosses/prologue/lv-3-boss/from-firing-to-vulnerable.png',
                'boss-wraith-vulnerable': 'assets/images/enemys/bosses/prologue/lv-3-boss/vulnerable.png',
                'boss-wraith-to-idle': 'assets/images/enemys/bosses/prologue/lv-3-boss/from-vulnerable-to-idle.png',
                'boss-wraith-dead': 'assets/images/enemys/bosses/prologue/lv-3-boss/dead.png',
                'boss-templateboss-idle': 'assets/images/enemys/bosses/prologue/lv-6-boss/floating-idle.png',
                'boss-templateboss-to-firing': 'assets/images/enemys/bosses/prologue/lv-6-boss/from-idle-to-firing.png',
                'boss-templateboss-firing': 'assets/images/enemys/bosses/prologue/lv-6-boss/firing.png',
                'boss-templateboss-to-vulnerable': 'assets/images/enemys/bosses/prologue/lv-6-boss/from-firing-to-vulnerable.png',
                'boss-templateboss-vulnerable': 'assets/images/enemys/bosses/prologue/lv-6-boss/vulnerable.png',
                'boss-templateboss-to-idle': 'assets/images/enemys/bosses/prologue/lv-6-boss/from-vulnerable-to-idle.png',
                'boss-templateboss-dead': 'assets/images/enemys/bosses/prologue/lv-6-boss/dead.png',
                'vfx-jump': 'assets/images/vfx/jumping.png',
                'vfx-landing': 'assets/images/vfx/landing.png',
                'vfx-dash': 'assets/images/vfx/dash.png',
            },
            json: {
                'menu-background-level': 'assets/levels/main-menu.json',
                'lv1-level': 'assets/levels/lv-1.json',
                'lv2-level': 'assets/levels/lv-2.json',
                'lv3-level': 'assets/levels/lv-3.json',
                'lv4-level': 'assets/levels/lv-4.json',
                'lv5-level': 'assets/levels/lv-5.json',
                'lv6-level': 'assets/levels/lv-6.json',
                'credits': 'assets/credits.json',
            },
        };
        this._progress.total += Object.keys(manifest.images).length + Object.keys(manifest.json).length;
        await this.game.assets.loadManifest(manifest, () => this._onAssetLoaded());
    }

    /**
     * Loads the first OST track and every SFX blocking the loading screen,
     * then kicks off the rest of the OST rotation in the background.
     */
    async _loadSounds() {
        const manifest = {
            'ost-00': 'assets/sounds/ost/00-the-color-returns.mp3',
            'jump': 'assets/sounds/sfx/jump.wav',
            'footsteps': 'assets/sounds/sfx/footsteps.wav',
            'swoosh': 'assets/sounds/sfx/swoosh.wav',
            'landing': 'assets/sounds/sfx/landing.wav',
            'dash': 'assets/sounds/sfx/dash.wav',
            'hit-player': 'assets/sounds/sfx/hit.wav',
            'hit-enemy': 'assets/sounds/sfx/enemy-hit.wav',
            'enemy-death': 'assets/sounds/sfx/enemy-death.wav',
            'player-death': 'assets/sounds/sfx/player-dead.mp3',
            'token-pickup': 'assets/sounds/sfx/token-pickup.wav',
            'portal': 'assets/sounds/sfx/portal-open.wav',
            'secret-door': 'assets/sounds/sfx/laser-door.wav',
            'power-up': 'assets/sounds/sfx/power-up.mp3',
            'boss-beam': 'assets/sounds/sfx/boss-beam.wav',
        };
        this._progress.total += Object.keys(manifest).length;
        await this.game.sound.loadManifest(manifest, () => this._onAssetLoaded());
        this._loadBackgroundMusic();
    }

    /**
     * Fire-and-forget rest of the OST rotation - keeps running after the
     * player is already in the menu.
     */
    _loadBackgroundMusic() {
        this.game.sound.loadManifest({
            'ost-01': 'assets/sounds/ost/01-whispers-of-the-dawn.mp3',
            'ost-02': 'assets/sounds/ost/02-the-road-to-dawn.mp3',
            'ost-03': 'assets/sounds/ost/03-the-first-dawn.mp3',
            'ost-04': 'assets/sounds/ost/04-faded-kingdom.mp3',
            'ost-05': 'assets/sounds/ost/05-echoes-of-the-forgotten.mp3',
            'ost-06': 'assets/sounds/ost/06-whispers-in-the-hollows.mp3',
            'ost-07': 'assets/sounds/ost/07-the-hollow-between.mp3',
            'ost-08': 'assets/sounds/ost/08-the-iron-sentinel.mp3',
        });
    }

    /**
     * Removes the loading label.
     */
    exit() {
        this.label?.remove();
    }

    /**
     * Fills the canvas with the loading screen's background color.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
}
