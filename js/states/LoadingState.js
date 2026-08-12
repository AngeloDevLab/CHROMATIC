import { State } from './State.js';

// Full-manifest loading screen: images/JSON (_loadManifest()) block state
// entry; sounds (_loadSounds()) load in two waves - the first OST track
// plus every SFX block too, the rest of the OST rotation loads unblocked in
// the background afterward (_loadBackgroundMusic()), since
// MusicPlaylist.js doesn't reach them until minutes into playback.
// Progress (_onAssetLoaded()) is counted by manifest entry, not by byte.
//
// The final state transition waits for one user gesture
// (_waitForContinue()): both the saved fullscreen preference and the
// SoundManager's AudioContext can only be (re-)applied/resumed inside a
// click/keypress handler. Listens for `pointerup` rather than `pointerdown`
// since Chrome's Web Audio autoplay unlock isn't reliably granted until a
// gesture completes (https://developer.chrome.com/blog/autoplay/#web_audio).
//
// _loadManifest()'s asset notes:
// - Tileset images are resolved to the right image/gid-range per tile by
//   world/TilesetRegistry.js, not hardcoded to one shared tileset per level.
// - trapdoor (Lvl 4 Gimmick, Trapdoor.js): closed is a single 128x32 frame,
//   opens is a 10-frame 128x32 strip (1280x32).
// - secretdoor (Lvl 5 Secret Room, SecretDoor.js): closed/open are single
//   32x64 frames, opens is a 7-frame 32x64 strip (224x64).
// - buffterminal (Lvl 5 Secret Room, BuffTerminal.js), merchant (post-boss,
//   Merchant.js), and token (boss-drop pickup, Token.js) are all single
//   static frames, no animation.
// - boss-wraith-* (Lvl 3 Miniboss, entities/bosses/Wraith.js) and
//   boss-templateboss-* (Lvl 6 Templateboss, WraithTemplateboss.js) share
//   the same 7-clip shape (idle loops, the rest are one-shot transitions
//   between held end-poses); the Templateboss frame is smaller (96x150 vs
//   128x256), see CharacterAnimations.js's buildTemplatebossAnimations().
// - vfx-* (player action VFX, VfxEffect.js) are 64x64 frames, triggered via
//   Player.js's pendingVfx mailbox (PlayerFx.js).
// - credits (MenuState.js's Info panel) is the single source of truth for Credits.
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
                'thrown-sword': 'assets/images/character/thrown_sword.png',
                'thrown-sword-trail': 'assets/images/character/thrown_sword_trail.png',
                'menu-parallax-bg': 'assets/images/backgrounds/forest_bg.png',
                'cutscene-beach-bg': 'assets/images/backgrounds/beach_bg.png',
                'worldmap-prologue-bg': 'assets/images/backgrounds/worldmap_prolog.png',
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
                'trapdoor-closed': 'assets/images/objects/trapdoor-closed.png',
                'trapdoor-opens': 'assets/images/objects/trapdoor-opens.png',
                'secretdoor-closed': 'assets/images/objects/secretdoor-closed.png',
                'secretdoor-open': 'assets/images/objects/secretdoor-open.png',
                'secretdoor-opens': 'assets/images/objects/secretdoor-opens.png',
                'buffterminal': 'assets/images/objects/buffterminal.png',
                'merchant': 'assets/images/objects/merchant.png',
                'token': 'assets/images/objects/token.png',
                'boss-wraith-idle': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/floating-idle.png',
                'boss-wraith-to-firing': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/from-idle-to-firing.png',
                'boss-wraith-firing': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/firing.png',
                'boss-wraith-to-vulnerable': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/from-firing-to-vulnerable.png',
                'boss-wraith-vulnerable': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/vulnerable.png',
                'boss-wraith-to-idle': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/from-vulnerable-to-idle.png',
                'boss-wraith-dead': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/dead.png',
                'boss-templateboss-idle': 'assets/images/enemys/bosses/prologue/lv_6_boss/floating-idle.png',
                'boss-templateboss-to-firing': 'assets/images/enemys/bosses/prologue/lv_6_boss/from-idle-to-firing.png',
                'boss-templateboss-firing': 'assets/images/enemys/bosses/prologue/lv_6_boss/firing.png',
                'boss-templateboss-to-vulnerable': 'assets/images/enemys/bosses/prologue/lv_6_boss/from-firing-to-vulnerable.png',
                'boss-templateboss-vulnerable': 'assets/images/enemys/bosses/prologue/lv_6_boss/vulnerable.png',
                'boss-templateboss-to-idle': 'assets/images/enemys/bosses/prologue/lv_6_boss/from-vulnerable-to-idle.png',
                'boss-templateboss-dead': 'assets/images/enemys/bosses/prologue/lv_6_boss/dead.png',
                'vfx-jump': 'assets/images/vfx/jumping.png',
                'vfx-landing': 'assets/images/vfx/landing.png',
                'vfx-dash': 'assets/images/vfx/dash.png',
            },
            json: {
                'menu-background-level': 'assets/levels/mainMenu.json',
                'lv1-level': 'assets/levels/Lv_1.json',
                'lv2-level': 'assets/levels/Lv_2.json',
                'lv3-level': 'assets/levels/Lv_3.json',
                'lv4-level': 'assets/levels/Lv_4.json',
                'lv5-level': 'assets/levels/Lv_5.json',
                'lv6-level': 'assets/levels/Lv_6.json',
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
            'ost-00': 'assets/sounds/ost/00_The_Color_Returns.mp3',
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
            'ost-01': 'assets/sounds/ost/01_Whispers_of_the_Dawn.mp3',
            'ost-02': 'assets/sounds/ost/02_The_Road_to_Dawn.mp3',
            'ost-03': 'assets/sounds/ost/03_The_First_Dawn.mp3',
            'ost-04': 'assets/sounds/ost/04_Faded_Kingdom.mp3',
            'ost-05': 'assets/sounds/ost/05_Echoes_of_the_Forgotten.mp3',
            'ost-06': 'assets/sounds/ost/06_Whispers_in_the_Hollows.mp3',
            'ost-07': 'assets/sounds/ost/07_The_Hollow_Between.mp3',
            'ost-08': 'assets/sounds/ost/08_The_Iron_Sentinel.mp3',
        });
    }

    /**
     * Removes the loading label.
     */
    exit() {
        this.label?.remove();
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
}
