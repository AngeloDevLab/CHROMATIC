// enemyRoster is built between spawnPlayer() and initInteractablesAndHud() (Interactables needs
// it) - that one step stays inline in LevelSession's constructor instead of moving here.

import { Level } from '../world/level.js';
import { buildTilesetRegistry } from '../world/tileset-registry.js';
import { Player } from '../entities/player.js';
import { buildPlayerAnimations } from '../entities/character-animations.js';
import { PlayerFx } from '../mechanics/player-fx.js';
import { Collision } from '../utils/collision.js';
import { Camera } from '../utils/camera.js';
import { ColorZone } from '../mechanics/color-zone.js';
import { DeathSequence } from '../mechanics/death-sequence.js';
import { Interactables } from '../mechanics/interactables.js';
import { CombatCoordinator } from '../mechanics/combat-coordinator.js';
import { TouchControls } from '../ui/touch-controls.js';
import { LEVEL_MUSIC_ZONES } from '../core/music-playlist.js';
import { HUD, HEALTH_BAR, SHIELD_BAR, scaleRect } from '../ui/hud.js';
import { DamageNumbers } from '../ui/damage-numbers.js';
import { LEVEL_JSON_KEYS, PLAYER_REVEAL_RADIUS } from './level-session.js';

const fallback_spawn = { x: 64, y: 0 };

/** LevelSession's constructor-time build-out, composed onto it the same way level-session-renderer.js owns rendering. */
export class LevelSessionSetup {
    /**
     * Binds this setup helper to the LevelSession it builds.
     * @param {LevelSession} session - Owning LevelSession to build state onto.
     */
    constructor(session) {
        this.session = session;
    }

    /**
     * Loads the Tiled level JSON and builds its Collision/Camera.
     */
    loadLevel() {
        const session = this.session;
        const levelKey = LEVEL_JSON_KEYS[session.levelNumber];
        if (!levelKey) {
            throw new Error(`LevelSession: no level registered for level number ${session.levelNumber}`);
        }
        session.level = Level.load(session.game.assets, levelKey, buildTilesetRegistry(session.game.assets));
        session.collision = new Collision(session.level, 'terrain', { oneWay: true, wallLayerName: 'walls', noDropLayerName: 'noDrop' });
        session.camera = new Camera(session.game.width, session.game.height);
    }

    /**
     * Switches the music playlist to this level's zone (music-playlist.js's LEVEL_MUSIC_ZONES); a no-op if it's already active.
     */
    setMusicZone() {
        const session = this.session;
        const { zone, trackKeys } = LEVEL_MUSIC_ZONES[session.levelNumber];
        session.game.music.setZone(zone, trackKeys);
    }

    /**
     * Bakes the level's tile layers onto an offscreen canvas once, on top of
     * the shared Prologue forest backdrop tiled across the level's width - a
     * level's own "background" tile layer paints over this per level.
     * color-zone.js's grey/color compositing reads from this baked canvas.
     */
    buildLevelCanvas() {
        const session = this.session;
        session.levelCanvas = document.createElement('canvas');
        session.levelCanvas.width = session.level.pixelWidth;
        session.levelCanvas.height = session.level.pixelHeight;
        const levelCtx = session.levelCanvas.getContext('2d');

        const parallax = session.game.assets.getImage('menu-parallax-bg');
        const parallaxScale = session.level.pixelHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        for (let x = 0; x < session.level.pixelWidth; x += parallaxWidth) {
            levelCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, x, 0, parallaxWidth, session.level.pixelHeight);
        }

        session.level.drawAllLayers(levelCtx);
    }

    /**
     * The color mechanic - a permanent color trail, unlike MenuState's decorative fading-bubble ColorZone.
     */
    initColorZone() {
        const session = this.session;
        session.colorZone = new ColorZone(session.level.pixelWidth, session.level.pixelHeight, PLAYER_REVEAL_RADIUS, {
            greyBrightness: 0.3,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        session.colorZone.paintGreyFrom(session.levelCanvas);
    }

    /**
     * Spawns the player at the level's PlayerStart marker (or a fallback),
     * re-applying permanent Secret Room buffs/unlocked abilities that live
     * on Game, not the Player instance.
     */
    spawnPlayer() {
        const session = this.session;
        session.deathSequence = new DeathSequence(session.game.assets.getImage('guardian-dead-ghost'));
        session.game.input.clearAttackPress();
        session.game.input.clearPausePress();
        session.game.input.clearJumpPress();
        session.game.input.clearDropPress();

        const playerStart = session.level.getObjectsByType('PlayerStart')[0] ?? fallback_spawn;
        session.player = new Player(playerStart.x, playerStart.y, buildPlayerAnimations(session.game.assets));
        session.player.enableControl(session.game.input, session.collision);
        for (const buffId of session.game.buffs) session.player.applyBuff(buffId);
        for (const id of session.game.abilities) session.player.unlockAbility(id);
        session.playerFx = new PlayerFx(session.game, session.player);
    }

    /**
     * Builds HUD/DamageNumbers/Interactables (Portal/Merchant/Trapdoor/
     * SecretDoor/BuffTerminal, see interactables.js) and the player's own
     * HP/Shield text labels; grouped since Interactables needs
     * damageNumbers to already exist.
     */
    initInteractablesAndHud() {
        const session = this.session;
        session.hud = new HUD();
        session.damageNumbers = new DamageNumbers(session.game.overlay);
        this._buildInteractables();
        this._buildPlayerHud();
    }

    /**
     * Builds the level's Interactables set.
     */
    _buildInteractables() {
        const session = this.session;
        session.interactables = new Interactables(session.game, session.level, session.player, {
            greyFilterCSS: session.colorZone.greyFilterCSS,
            revealRadius: PLAYER_REVEAL_RADIUS,
            damageNumbers: session.damageNumbers,
            collision: session.collision,
            levelNumber: session.levelNumber,
            onComplete: () => session._completeLevel(),
        });
    }

    /**
     * Builds the player's own HP/Shield labels+icons, token counter, and touch controls.
     */
    _buildPlayerHud() {
        const session = this.session;
        session.healthValueEl = this._createHudValueLabel(HEALTH_BAR, 'health');
        session.shieldValueEl = this._createHudValueLabel(SHIELD_BAR, 'shield');
        session.healthIconEl = this._createHudBarIcon(HEALTH_BAR, 'health');
        session.shieldIconEl = this._createHudBarIcon(SHIELD_BAR, 'shield');
        session.tokenCounterEl = this._createTokenCounter();
        session.touchControls = new TouchControls(session.game);
    }

    /**
     * Icon+count readout below the HP/Shield bars, styled via CSS (.hud-token's ::before) - this only positions it and owns the text.
     * @returns {HTMLElement}
     */
    _createTokenCounter() {
        const session = this.session;
        const el = document.createElement('div');
        el.className = 'hud-token';
        const shield = scaleRect(SHIELD_BAR, session.game.hudScale);
        el.style.left = `${shield.x}px`;
        el.style.top = `${shield.y + shield.height + 4 * session.game.hudScale}px`;
        session.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Kept aligned to the (also scaled, via Game.hudScale) canvas-drawn bar via scaleRect().
     * @param {{x:number,y:number,width:number,height:number}} bar - HEALTH_BAR or SHIELD_BAR (hud.js).
     * @param {'health'|'shield'} variant - Which stat this label displays.
     * @returns {HTMLElement} The attached, positioned label element.
     */
    _createHudValueLabel(bar, variant) {
        const session = this.session;
        const el = document.createElement('div');
        el.className = `hud-value hud-value-${variant}`;
        const scale = session.game.hudScale;
        const scaled = scaleRect(bar, scale);
        const extraGap = variant === 'shield' ? 2 * scale : 0;
        el.style.left = `${scaled.x + scaled.width + 4 * scale}px`;
        el.style.top = `${scaled.y - 6 * scale + extraGap}px`;
        session.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Creates an icon element that clips slightly into the bar.
     * @param {{x:number,y:number,width:number,height:number}} bar - HEALTH_BAR or SHIELD_BAR (hud.js).
     * @param {'health'|'shield'} variant - Which stat this icon represents.
     * @returns {HTMLElement} The attached, positioned icon element.
     */
    _createHudBarIcon(bar, variant) {
        const session = this.session;
        const el = document.createElement('div');
        el.className = `hud-bar-icon hud-bar-icon-${variant}`;
        const scale = session.game.hudScale;
        const scaled = scaleRect(bar, scale);
        el.style.left = `${scaled.x - 10 * scale}px`;
        el.style.top = `${scaled.y + scaled.height / 2}px`;
        session.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Player's melee/ranged attack resolution, both projectile pools, and
     * the hit-stop timer they drive - see combat-coordinator.js.
     */
    initCombat() {
        const session = this.session;
        session.combat = new CombatCoordinator(session.player, session.enemyRoster.enemies, session.collision, {
            damageNumbers: session.damageNumbers,
            thrownSwordSprite: session.game.assets.getImage('thrown-sword'),
            thrownSwordTrailSprite: session.game.assets.getImage('thrown-sword-trail'),
            sound: session.game.sound,
        });
    }
}
