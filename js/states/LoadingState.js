import { State } from './State.js';

export class LoadingState extends State {
    /**
     * Shows the loading label and kicks off asset/sound loading.
     */
    enter() {
        this.label = document.createElement('div');
        this.label.className = 'loading-label';
        this.label.textContent = 'Loading...';
        this.game.overlay.appendChild(this.label);

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
     * Gates the state transition behind one user gesture. Assets are ready
     * at this point, but both a saved fullscreen preference (Fullscreen
     * API) and the SoundManager's AudioContext can only be (re-)applied/
     * resumed inside a click/keypress handler, never on load.
     */
    _waitForContinue() {
        this.label.textContent = 'Press any key to continue';
        const proceed = () => {
            document.removeEventListener('keydown', proceed);
            document.removeEventListener('pointerdown', proceed);
            this._applyFullscreenPreference();
            this.game.sound.resume();
            this.game.music.start();
            this.game.stateMachine.change('menu');
        };
        document.addEventListener('keydown', proceed);
        document.addEventListener('pointerdown', proceed);
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
                // Post-boss Merchant (entities/Merchant.js) - single static
                // 64x64 frame, no animation.
                'merchant': 'assets/images/objects/merchant.png',
                // Boss-drop Token pickup (entities/Token.js) - single static
                // 64x64 frame, no animation.
                'token': 'assets/images/objects/token.png',
                // Wraith of the Shifting Sands (Lvl 3 Miniboss, entities/bosses/
                // Wraith.js) - each a fixed 128x256 frame (see the earlier PixelLab
                // sizing discussion). idle loops; the rest are one-shot transitions
                // between held end-poses, matching how the sprites were actually
                // animated rather than a generic loop per state.
                'boss-wraith-idle': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/floating-idle.png',
                'boss-wraith-to-firing': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/from-idle-to-firing.png',
                'boss-wraith-firing': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/firing.png',
                'boss-wraith-to-vulnerable': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/from-firing-to-vulnerable.png',
                'boss-wraith-vulnerable': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/vulnerable.png',
                'boss-wraith-to-idle': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/from-vulnerable-to-idle.png',
                'boss-wraith-dead': 'assets/images/enemys/bosses/prologue/Lv_3_Boss/dead.png',
                // Wraith of the Grey City (Lvl 6 Templateboss, entities/bosses/
                // WraithTemplateboss.js) - same 7-clip shape as the Miniboss
                // above, but a smaller 96x150 frame (see LevelSession.js's
                // _buildTemplatebossAnimations()).
                'boss-templateboss-idle': 'assets/images/enemys/bosses/prologue/lv_6_boss/floating-idle.png',
                'boss-templateboss-to-firing': 'assets/images/enemys/bosses/prologue/lv_6_boss/from-idle-to-firing.png',
                'boss-templateboss-firing': 'assets/images/enemys/bosses/prologue/lv_6_boss/firing.png',
                'boss-templateboss-to-vulnerable': 'assets/images/enemys/bosses/prologue/lv_6_boss/from-firing-to-vulnerable.png',
                'boss-templateboss-vulnerable': 'assets/images/enemys/bosses/prologue/lv_6_boss/vulnerable.png',
                'boss-templateboss-to-idle': 'assets/images/enemys/bosses/prologue/lv_6_boss/from-vulnerable-to-idle.png',
                'boss-templateboss-dead': 'assets/images/enemys/bosses/prologue/lv_6_boss/dead.png',
                // Player action VFX (entities/VfxEffect.js) - 64x64 frames,
                // triggered via Player.js's pendingVfx mailbox
                // (LevelSession.js's _drainPlayerVfx()).
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
            },
        });
    }

    /**
     * Loads the ambient OST rotation, the boss track, and one-shot SFX.
     * 'ost-00'..'ost-07' are the generic playlist (see main.js's
     * MusicPlaylist); 'ost-08' ("The Iron Sentinel") is reserved for boss
     * encounters and deliberately left out of that rotation. SFX keys match
     * their trigger 1:1 (LevelSession.js's _drainPendingPlayerVfx()/
     * _updatePlayerActionSfx()) - more get added here as files exist,
     * SoundManager.load() already tolerates a missing/broken file on its own.
     */
    async _loadSounds() {
        await this.game.sound.loadManifest({
            'ost-00': 'assets/sounds/ost/00_The_Color_Returns.mp3',
            'ost-01': 'assets/sounds/ost/01_Whispers_of_the_Dawn.mp3',
            'ost-02': 'assets/sounds/ost/02_The_Road_to_Dawn.mp3',
            'ost-03': 'assets/sounds/ost/03_The_First_Dawn.mp3',
            'ost-04': 'assets/sounds/ost/04_Faded_Kingdom.mp3',
            'ost-05': 'assets/sounds/ost/05_Echoes_of_the_Forgotten.mp3',
            'ost-06': 'assets/sounds/ost/06_Whispers_in_the_Hollows.mp3',
            'ost-07': 'assets/sounds/ost/07_The_Hollow_Between.mp3',
            'ost-08': 'assets/sounds/ost/08_The_Iron_Sentinel.mp3',
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
