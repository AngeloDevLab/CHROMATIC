import { Level } from '../world/Level.js';
import { buildTilesetRegistry } from '../world/TilesetRegistry.js';
import { Player } from '../entities/Player.js';
import { createEnemy } from '../entities/EnemyFactory.js';
import { Wraith } from '../entities/bosses/Wraith.js';
import { WraithTemplateboss } from '../entities/bosses/WraithTemplateboss.js';
import { VfxEffect } from '../entities/VfxEffect.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { DeathSequence, GHOST_FRAME_SIZE } from '../mechanics/DeathSequence.js';
import { Interactables } from '../mechanics/Interactables.js';
import { CombatCoordinator } from '../mechanics/CombatCoordinator.js';
import { HUD, HEALTH_BAR, SHIELD_BAR, scaleRect } from '../ui/HUD.js';
import { DamageNumbers } from '../ui/DamageNumbers.js';

const CHARACTER_FRAME_SIZE = 96;
// attack.png is a bigger canvas than the other guardian sheets, deliberately
// - gives the sword room to swing past the body without clipping the frame
// edge. Doesn't need to be square - Player.js scales the attack frame by its
// own aspect ratio, so more side padding than vertical padding is fine.
const ATTACK_FRAME_WIDTH = 150;
const ATTACK_FRAME_HEIGHT = 96;
const FALLBACK_SPAWN = { x: 64, y: 0 };

// How far below the level's bottom edge the player has to fall before it
// counts as "into a pit" - a bit of slack past the visible bottom rather than
// killing the instant they cross it, so a platform flush with the level edge
// doesn't feel like an unfair instant death.
const FALL_DEATH_MARGIN_PX = 64;

// Player's own live-glow/permanent color trail radius (03_mechanics.md 4.1) -
// also handed to Interactables.js (see its own revealRadius option) so
// Portal/Trapdoor/SecretDoor "revealed" tracks the same distance, one shared
// source of truth instead of two independently-tuned numbers.
const PLAYER_REVEAL_RADIUS = 55;
// Every living enemy continuously erases color around itself while
// patrolling, independent of the player's own reveal.
const ENEMY_DARKEN_RADIUS = 65;
// A bit bigger than the darken radius above - dying reveals back what the
// enemy had darkened while patrolling, plus a bit more as a small death beat.
const ENEMY_DEATH_REVEAL_RADIUS = 90;

// Player action smoke (entities/VfxEffect.js, Player.js's pendingVfx mailbox)
// - all three sheets are 64x64 frames (assets/images/vfx/*.png); frame counts
// read off each sheet's width, fps first-guess (same reasoning as every other
// tuning constant in this codebase) to land around a quick ~0.4-0.5s playtime.
const VFX_FRAME_SIZE = 64;
const VFX_CLIPS = {
    jump: { imageKey: 'vfx-jump', frameCount: 11, fps: 24 },
    landing: { imageKey: 'vfx-landing', frameCount: 9, fps: 20 },
    dash: { imageKey: 'vfx-dash', frameCount: 14, fps: 28 },
};

// How often a footstep plays while running (see _updateFootstepSfx()) -
// first-guess, same reasoning as every other timing constant in this
// codebase, needs a real ear against the running animation's own cadence.
const FOOTSTEP_INTERVAL_SECONDS = 0.40;

// Real Prologue levels (assets/levels/Lv_N.json), built in Tiled - which one
// loads is picked by number via LEVEL_JSON_KEYS below (only levels actually
// exported to JSON so far are registered there). Player/enemy spawn positions
// come from the Objects layer (PlayerStart/EnemySpawn) per
// 10_technical-architecture.md 11.6.2 - which enemy type spawns is read off
// each EnemySpawn object's own Tiled Name field (see EnemyFactory.js's
// ENEMY_SPRITE_SETS), not a separate custom property. Names that don't match
// a registered type (e.g. a typo in Tiled) are skipped with a console warning
// rather than spawning the wrong thing. Which tileset(s) a level's own
// `tilesets` array needs is resolved generically (TilesetRegistry.js) - no
// per-level tileset lookup needed here, Level.load() gets the whole registry
// every time.
export const LEVEL_JSON_KEYS = {
    1: 'lv1-level',
    2: 'lv2-level',
    3: 'lv3-level',
    4: 'lv4-level',
    5: 'lv5-level',
    6: 'lv6-level',
};

/**
 * Loads a throwaway Level for a quick property check before the real
 * LevelSession constructs its own copy for gameplay (see isBossLevel()
 * below and BossState.js's arena-sizing) - cheap, the JSON's already in
 * memory via AssetLoader (no fetch/decode), just object construction.
 * @param {AssetLoader} assets
 * @param {number} levelNumber
 * @returns {Level|null}
 */
export function loadLevelPreview(assets, levelNumber) {
    const levelKey = LEVEL_JSON_KEYS[levelNumber];
    if (!levelKey) return null;

    return Level.load(assets, levelKey, buildTilesetRegistry(assets));
}

/**
 * Decides GameState vs BossState routing at level-load time - every
 * current/planned boss level IS the arena (no mid-session "entering the
 * boss room" trigger), so whichever code starts a level (WorldmapState/
 * DevPanel's level-select, GameOverState's Retry) checks this first instead
 * of always going to 'game'. Reads the same miniboss/templateboss spawn
 * names LevelSession's own _spawnEnemies() uses to actually spawn a boss, so
 * the two can never drift apart.
 * @param {AssetLoader} assets
 * @param {number} levelNumber
 * @returns {boolean}
 */
export function isBossLevel(assets, levelNumber) {
    const level = loadLevelPreview(assets, levelNumber);
    return !!level && level.getObjectsByType('EnemySpawn').some((spawn) => _isBossSpawnName(spawn.name));
}

/**
 * @param {string} [name] - EnemySpawn's Tiled Name field.
 * @returns {boolean}
 */
function _isBossSpawnName(name) {
    const lower = name?.toLowerCase();
    return lower === 'miniboss' || lower === 'templateboss';
}

// Everything a running level needs - Level/Collision/Camera/ColorZone/Player/
// enemies/HUD/interactables/combat resolution - extracted out of GameState.js
// so a level-hosting State doesn't have to rebuild all of this itself. Not a
// State: no enter()/exit() contract, just a
// plain constructor + update()/render()/destroy(), driven by whichever State
// owns it (GameState for a normal level, BossState for a boss arena - both
// construct one of these and delegate their own update()/render() to it).
// Pause/Game Over/Buff are pushed onto the StateMachine's stack (see
// StateMachine.js) directly from update() below - they're state-agnostic
// overlays, not something this session needs to own or know the internals of.
export class LevelSession {
    /**
     * @param {Game} game - Owning Game instance.
     * @param {{chapterId: string, level: number}} params - Level to load.
     */
    constructor(game, { chapterId, level } = {}) {
        this.game = game;
        this.chapterId = chapterId;
        this.levelNumber = level;

        this._loadLevel();
        this._buildLevelCanvas();
        this._initColorZone();
        this._spawnPlayer();
        this._spawnEnemies();
        this._initInteractablesAndHud();
        this._initCombat();
        // Camera zoom is left at Camera.js's default (1) here regardless of
        // whether a Boss spawned - BossState.js owns that decision (its own
        // arena-sized buffer, see that file), since it's boss presentation,
        // not a fact about the level.
    }

    /**
     * Loads the Tiled level JSON and builds its Collision/Camera - the base
     * every other init step below depends on. The "terrain" layer is
     * one-way (Lvl 1-3's stacked-floor layout); an optional "walls" layer
     * stays fully solid regardless (ledges/corners that need to block
     * sideways movement too); an optional "noDrop" layer exempts specific
     * one-way floors from Drop-Through-Platform (Lvl 4/5, where some
     * platforms need to stay the actual intended path). All three tolerate
     * not existing in a given level's Tiled export.
     */
    _loadLevel() {
        const levelKey = LEVEL_JSON_KEYS[this.levelNumber];
        if (!levelKey) {
            throw new Error(`LevelSession: no level registered for level number ${this.levelNumber}`);
        }
        this.level = Level.load(this.game.assets, levelKey, buildTilesetRegistry(this.game.assets));
        this.collision = new Collision(this.level, 'terrain', { oneWay: true, wallLayerName: 'walls', noDropLayerName: 'noDrop' });
        this.camera = new Camera(this.game.width, this.game.height);
    }

    /**
     * Bakes the level's tile layers onto an offscreen canvas once, on top
     * of the shared Prologue forest backdrop (10_technical-architecture.md
     * 11.6.1) tiled across the level's width and cover-fit to its height -
     * a level's own "background" tile layer paints over this per level
     * (e.g. the planned cave-interior Gimmick level hides it entirely with
     * its own art). ColorZone.js's grey/color compositing reads from this
     * baked canvas rather than redrawing every tile layer every frame.
     */
    _buildLevelCanvas() {
        this.levelCanvas = document.createElement('canvas');
        this.levelCanvas.width = this.level.pixelWidth;
        this.levelCanvas.height = this.level.pixelHeight;
        const levelCtx = this.levelCanvas.getContext('2d');

        const parallax = this.game.assets.getImage('menu-parallax-bg');
        const parallaxScale = this.level.pixelHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        for (let x = 0; x < this.level.pixelWidth; x += parallaxWidth) {
            levelCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, x, 0, parallaxWidth, this.level.pixelHeight);
        }

        this.level.drawAllLayers(levelCtx);
    }

    /**
     * The color mechanic (03_mechanics.md 4.1): the player leaves a
     * permanent color trail while moving - unlike MenuState's decorative
     * fading-bubble variant of the same ColorZone technique, real gameplay
     * never reverts on its own. Grey treatment matches the menu's tuned
     * "Darkness" look for visual consistency between the two scenes.
     */
    _initColorZone() {
        this.colorZone = new ColorZone(this.level.pixelWidth, this.level.pixelHeight, PLAYER_REVEAL_RADIUS, {
            greyBrightness: 0.15,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.levelCanvas);
    }

    /**
     * @returns {object} Named SpriteAnimation set for guardian-idle/running/jump/attack/dead.
     */
    _buildPlayerAnimations() {
        return {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
            jump: new SpriteAnimation(this.game.assets.getImage('guardian-jump'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 12),
            // Plays once per swing (loop: false) - Player watches `finished`
            // to know when to hand control back to normal locomotion.
            attack: new SpriteAnimation(this.game.assets.getImage('guardian-attack'), ATTACK_FRAME_WIDTH, ATTACK_FRAME_HEIGHT, 8, 16, { loop: false }),
            // Plays once on death, before the ghost-rise sequence (_spawnPlayer()).
            dead: new SpriteAnimation(this.game.assets.getImage('guardian-dead'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 10, { loop: false }),
        };
    }

    /**
     * Spawns the player at the level's PlayerStart marker (or a fallback if
     * one isn't placed yet) - re-applies any permanent Secret Room buffs
     * (Game.buffs, docs/GDD/02_game-structure.md 2.5) since those live on
     * Game, not any one Player instance.
     */
    _spawnPlayer() {
        this.deathSequence = new DeathSequence(this.game.assets.getImage('guardian-dead-ghost'));
        this.game.input.clearAttackPress();
        this.game.input.clearPausePress();
        this.game.input.clearJumpPress();
        this.game.input.clearDropPress();

        const playerStart = this.level.getObjectsByType('PlayerStart')[0] ?? FALLBACK_SPAWN;
        this.player = new Player(playerStart.x, playerStart.y, this._buildPlayerAnimations());
        this.player.enableControl(this.game.input, this.collision);
        for (const buffId of this.game.buffs) this.player.applyBuff(buffId);
        for (const id of this.game.abilities) this.player.unlockAbility(id);
        this.playerVfx = [];
        this._wasAttacking = false;
        this._footstepTimer = 0;
    }

    /**
     * "miniboss"/"templateboss" bypass the regular EnemyFactory - Wraith.js/
     * WraithTemplateboss.js don't fit its generic sprite-sheet wiring
     * (different frame size/animation set/clip-per-state shape, see
     * _spawnWraith()/_spawnWraithTemplateboss()) and aren't part of the
     * regular roster to begin with.
     */
    _spawnEnemies() {
        this.boss = null;
        this.enemies = this.level.getObjectsByType('EnemySpawn')
            .map((spawn) => this._spawnFromMarker(spawn))
            .filter(Boolean);
    }

    /**
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {Enemy|Wraith|WraithTemplateboss}
     */
    _spawnFromMarker(spawn) {
        const name = spawn.name?.toLowerCase();
        if (name === 'miniboss') return this._spawnWraith(spawn);
        if (name === 'templateboss') return this._spawnWraithTemplateboss(spawn);
        return createEnemy(this.game.assets, this.collision, this.player, spawn);
    }

    /**
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {Wraith}
     */
    _spawnWraith(spawn) {
        const wraith = new Wraith(spawn.x, spawn.y, this.collision, this.player);
        wraith.setAnimations(this._buildWraithAnimations(), 'idle');
        // Enemy.render()'s deep fallback (anim/referenceAnim missing) draws
        // this.sprite directly - keep it a real image rather than the null
        // Wraith's constructor passes to super().
        wraith.sprite = wraith.animations.idle.image;
        // _checkBossDefeated() reads this to know when to drop the
        // Merchant's Token (Interactables.js's onBossDefeated()).
        this.boss = wraith;
        return wraith;
    }

    /**
     * @param {object} spawn - EnemySpawn Tiled object.
     * @returns {WraithTemplateboss}
     */
    _spawnWraithTemplateboss(spawn) {
        const boss = new WraithTemplateboss(spawn.x, spawn.y, this.collision, this.player);
        boss.setAnimations(this._buildTemplatebossAnimations(), 'idle');
        boss.sprite = boss.animations.idle.image;
        this.boss = boss;
        return boss;
    }

    /**
     * Wraith.js's 6-clip-as-6-states shape (see that file's own comment) -
     * each animation is a distinct drawn pose, most one-shot, rather than a
     * generic looping cycle, so this is built inline here instead of going
     * through EnemyFactory.js's one-size-fits-all wiring. Frame sizes/
     * counts match the actual 'boss-wraith-*' sheets (LoadingState.js) -
     * each a strip of 128x256 frames.
     * @returns {object} Named SpriteAnimation set for the Wraith's state machine.
     */
    _buildWraithAnimations() {
        const assets = this.game.assets;
        return {
            idle: new SpriteAnimation(assets.getImage('boss-wraith-idle'), 128, 256, 12, 8),
            toFiring: new SpriteAnimation(assets.getImage('boss-wraith-to-firing'), 128, 256, 12, 14, { loop: false }),
            firing: new SpriteAnimation(assets.getImage('boss-wraith-firing'), 128, 256, 1, 1),
            // Slow on purpose ("langsam wieder runter gleiten" - Wraith.js's
            // _activeBeam/track() keeps firing the whole way down): 9 frames
            // at 3fps stretches this to ~3s instead of the ~0.56s a normal
            // enemy-animation pace would give.
            toVulnerable: new SpriteAnimation(assets.getImage('boss-wraith-to-vulnerable'), 128, 256, 9, 3, { loop: false }),
            vulnerable: new SpriteAnimation(assets.getImage('boss-wraith-vulnerable'), 128, 256, 1, 1),
            toIdle: new SpriteAnimation(assets.getImage('boss-wraith-to-idle'), 128, 256, 8, 12, { loop: false }),
            // Enemy.js's _enterDeathAnimation()/deathAnimationFinished pick
            // this up automatically once hp hits 0 - same 'dead' key every
            // other enemy type uses.
            dead: new SpriteAnimation(assets.getImage('boss-wraith-dead'), 128, 256, 11, 14, { loop: false }),
        };
    }

    /**
     * Same 7-clip-as-7-states shape as _buildWraithAnimations() above -
     * WraithTemplateboss extends Wraith and reuses its whole state machine,
     * just against the lv_6_boss sheets' own 96x150 frame size/counts. fps
     * values mirrored proportionally from the Miniboss's own pacing,
     * first-guess like every other tuning constant in this codebase.
     * @returns {object} Named SpriteAnimation set for the Templateboss's state machine.
     */
    _buildTemplatebossAnimations() {
        const assets = this.game.assets;
        return {
            idle: new SpriteAnimation(assets.getImage('boss-templateboss-idle'), 96, 150, 9, 8),
            toFiring: new SpriteAnimation(assets.getImage('boss-templateboss-to-firing'), 96, 150, 6, 14, { loop: false }),
            firing: new SpriteAnimation(assets.getImage('boss-templateboss-firing'), 96, 150, 1, 1),
            toVulnerable: new SpriteAnimation(assets.getImage('boss-templateboss-to-vulnerable'), 96, 150, 11, 3, { loop: false }),
            vulnerable: new SpriteAnimation(assets.getImage('boss-templateboss-vulnerable'), 96, 150, 1, 1),
            toIdle: new SpriteAnimation(assets.getImage('boss-templateboss-to-idle'), 96, 150, 7, 12, { loop: false }),
            dead: new SpriteAnimation(assets.getImage('boss-templateboss-dead'), 96, 150, 9, 14, { loop: false }),
        };
    }

    /**
     * HUD/DamageNumbers/Interactables (Portal/Merchant/Trapdoor/SecretDoor/
     * BuffTerminal, see Interactables.js) and the player's own HP/Shield
     * text labels - grouped since Interactables needs damageNumbers to
     * already exist.
     */
    _initInteractablesAndHud() {
        this.hud = new HUD();
        this.damageNumbers = new DamageNumbers(this.game.overlay);

        this.interactables = new Interactables(this.game, this.level, this.player, {
            greyFilterCSS: this.colorZone.greyFilterCSS,
            revealRadius: PLAYER_REVEAL_RADIUS,
            damageNumbers: this.damageNumbers,
            collision: this.collision,
            onComplete: () => this._completeLevel(),
        });

        this.healthValueEl = this._createHudValueLabel(HEALTH_BAR);
        this.shieldValueEl = this._createHudValueLabel(SHIELD_BAR);
        this.tokenCounterEl = this._createTokenCounter();
        this._levelFullyRevealed = false;
        this._bossDefeated = false;
    }

    /**
     * Icon+count readout just below the HP/Shield bars (HEALTH_BAR/
     * SHIELD_BAR, HUD.js) - styled via CSS (.hud-token's ::before renders
     * the token icon, both sized off the same --hud-scale custom property
     * Game.resizeBuffer() sets), this only positions it and owns the text.
     * scaleRect() keeps the gap below the (also scaled) Shield bar
     * proportional instead of a fixed 4px that'd look too tight once scaled up.
     * @returns {HTMLElement}
     */
    _createTokenCounter() {
        const el = document.createElement('div');
        el.className = 'hud-token';
        const shield = scaleRect(SHIELD_BAR, this.game.hudScale);
        el.style.left = `${shield.x}px`;
        el.style.top = `${shield.y + shield.height + 4 * this.game.hudScale}px`;
        this.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Player's melee/ranged attack resolution, both projectile pools, and
     * the hit-stop timer they drive - see CombatCoordinator.js.
     */
    _initCombat() {
        this.combat = new CombatCoordinator(this.player, this.enemies, this.collision, {
            damageNumbers: this.damageNumbers,
            thrownSwordSprite: this.game.assets.getImage('thrown-sword'),
            thrownSwordTrailSprite: this.game.assets.getImage('thrown-sword-trail'),
        });
    }

    /**
     * scaleRect() keeps this against the (also scaled, via Game.hudScale)
     * canvas-drawn bar regardless of buffer size - see that getter's comment.
     * @param {{x:number,y:number,width:number,height:number}} bar - HEALTH_BAR or SHIELD_BAR (HUD.js).
     * @returns {HTMLElement} The attached, positioned label element.
     */
    _createHudValueLabel(bar) {
        const el = document.createElement('div');
        el.className = 'hud-value';
        const scale = this.game.hudScale;
        const scaled = scaleRect(bar, scale);
        el.style.left = `${scaled.x + scaled.width + 4 * scale}px`;
        el.style.top = `${scaled.y - 2 * scale}px`;
        this.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Tears down everything this session added to the DOM, called by
     * whichever State hosts this session from its own exit().
     */
    destroy() {
        this.healthValueEl?.remove();
        this.shieldValueEl?.remove();
        this.tokenCounterEl?.remove();
        this.interactables.destroy();
        this.damageNumbers?.clear();
    }

    /**
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this._handlePauseInput();

        const merchantDialogue = this.interactables.merchantDialogue;
        if (merchantDialogue.isOpen) {
            this._updateMerchantDialogue(dt, merchantDialogue);
            return;
        }

        if (this.combat.isFrozen) {
            this.combat.tickFrozen(dt);
            return;
        }

        this._updateWorld(dt);
    }

    /**
     * Escape means something different depending on what else is open -
     * Merchant dialogue/Buff choice both handle it themselves (see their
     * own classes' Escape handling), this only ever pushes Pause, and only
     * once neither is active. Always drains the press regardless of death
     * state, same reasoning as the attack click, so a stale press can't
     * leak into whatever comes after this session ends.
     */
    _handlePauseInput() {
        const pausePressed = this.game.input.consumePausePress();
        const merchantOpen = this.interactables.merchantDialogue.isOpen;
        if (pausePressed && !this.deathSequence.active && !merchantOpen) {
            this.game.stateMachine.push('pause');
        }
    }

    /**
     * Freezes gameplay the same way Pause does (update() early-returns,
     * render() keeps drawing the last frame) - [E] here means "advance the
     * dialogue", not "interact with the level".
     * @param {number} dt
     * @param {MerchantDialogue} merchantDialogue
     */
    _updateMerchantDialogue(dt, merchantDialogue) {
        if (this.game.input.consumeInteractPress()) merchantDialogue.advance();
        merchantDialogue.update(dt);
    }

    /**
     * The rest of a normal frame - player/enemies/interactables/combat, the
     * color mechanic, death, camera, and HUD text, in that order.
     * @param {number} dt
     */
    _updateWorld(dt) {
        this.player.godmode = this.game.devPanel.godmode;
        // Idempotent (Player.unlockAbility()), at most 2 Set entries - cheap
        // enough to poll every frame so a DevPanel unlock takes effect
        // immediately instead of only on the next respawn.
        for (const id of this.game.abilities) this.player.unlockAbility(id);
        this.player.update(dt);
        this._updatePlayerVfx(dt);
        this._updatePlayerActionSfx(dt);
        this.interactables.blockSecretDoor();

        this._updateEnemies(dt);
        this.interactables.updateEntities(dt);
        this._checkFallDeath();

        this.combat.update(dt, this.game.difficulty);
        this._updateEnemyColorReveal();
        this._checkLevelFullyRevealed();
        this._checkBossDefeated();
        this._updateDeathSequence(dt);

        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        this._updateInteractablePrompts();
        this._updateColorZone(dt);
        this.damageNumbers.update(dt, this.camera);
        this._updateHudText();
    }

    /**
     * @param {number} dt
     */
    _updateEnemies(dt) {
        for (const enemy of this.enemies) {
            enemy.update(dt);
            // Shooter.js's mailbox for a shot fired this frame - it has no
            // access to CombatCoordinator's array itself, see its own pendingProjectile.
            if (enemy.pendingProjectile) {
                this.combat.enemyProjectiles.push(enemy.pendingProjectile);
                enemy.pendingProjectile = null;
            }
            // Wraith.js's mailbox for its beam-fire room-darken beat
            // (session decision) - Wraith itself has no access to
            // ColorZone. Reuses PLAYER_REVEAL_RADIUS for the safe pocket so
            // it matches the player's own everyday reveal.
            if (enemy.pendingRoomDarken) {
                this.colorZone.darkenAllExcept(this.player.centerX, this.player.visualCenterY, PLAYER_REVEAL_RADIUS);
                enemy.pendingRoomDarken = false;
            }
        }
    }

    /**
     * Drains Player.js's pendingVfx mailbox into live VfxEffect instances,
     * then advances/prunes the ones already playing.
     * @param {number} dt
     */
    _updatePlayerVfx(dt) {
        this._drainPendingPlayerVfx();
        for (const vfx of this.playerVfx) vfx.update(dt);
        this.playerVfx = this.playerVfx.filter((vfx) => !vfx.dead);
    }

    /**
     * All three (jump/landing/dash) are ground-contact effects - each
     * anchors to its own detected ground line (VfxEffect.js) on the
     * player's feet, not floating at torso height. Each key doubles as an
     * SFX key of the same name (SoundManager.playSfx() is fail-soft, so this
     * is safe even for a key with no sound file loaded yet).
     */
    _drainPendingPlayerVfx() {
        const feetY = this.player.y + this.player.height;
        for (const key of this.player.pendingVfx) {
            this.playerVfx.push(new VfxEffect(this.player.centerX, feetY, this._buildVfxAnimation(key)));
            this.game.sound.playSfx(key);
        }
        this.player.pendingVfx.length = 0;
    }

    /**
     * Attack's swing sound and the running footstep loop - neither has a
     * matching VfxEffect (unlike jump/landing/dash above), so they're kept
     * separate from _drainPendingPlayerVfx() rather than forced through a
     * mailbox built for spawning sprite-sheet effects.
     * @param {number} dt
     */
    _updatePlayerActionSfx(dt) {
        if (this.player.attacking && !this._wasAttacking) this.game.sound.playSfx('swoosh');
        this._wasAttacking = this.player.attacking;
        this._updateFootstepSfx(dt);
    }

    /**
     * Repeats every FOOTSTEP_INTERVAL_SECONDS while actually running under
     * control (grounded, moving, not mid-swing) - resets to fire on the very
     * next step rather than waiting out a stale interval once running starts again.
     * @param {number} dt
     */
    _updateFootstepSfx(dt) {
        const running = this.player.grounded && !this.player.dead && !this.player.attacking && this.player.vx !== 0;
        if (!running) {
            this._footstepTimer = 0;
            return;
        }
        this._footstepTimer -= dt;
        if (this._footstepTimer > 0) return;
        this.game.sound.playSfx('footsteps');
        this._footstepTimer = FOOTSTEP_INTERVAL_SECONDS;
    }

    /**
     * @param {'jump'|'landing'|'dash'} key
     * @returns {SpriteAnimation}
     */
    _buildVfxAnimation(key) {
        const { imageKey, frameCount, fps } = VFX_CLIPS[key];
        const image = this.game.assets.getImage(imageKey);
        return new SpriteAnimation(image, VFX_FRAME_SIZE, VFX_FRAME_SIZE, frameCount, fps, { loop: false });
    }

    /**
     * Jump & Run gaps with no floor below (10_technical-architecture.md
     * Platform level type) currently let the player fall forever and keep
     * controlling mid-air - treat crossing the kill plane as death instead.
     */
    _checkFallDeath() {
        if (!this.player.dead && this.player.y > this.level.pixelHeight + FALL_DEATH_MARGIN_PX) {
            this.player.die();
        }
    }

    /**
     * 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns
     * back to dark" - dying reverses that once, revealing back what it had
     * darkened (plus a bit more) instead of leaving a dark patch behind.
     */
    _updateEnemyColorReveal() {
        for (const enemy of this.enemies) {
            if (!enemy.dead) {
                this.colorZone.darken(enemy.centerX, enemy.centerY, ENEMY_DARKEN_RADIUS);
            } else if (!enemy.colorRevealed) {
                enemy.colorRevealed = true;
                this.colorZone.reveal(enemy.centerX, enemy.centerY, ENEMY_DEATH_REVEAL_RADIUS);
            }
        }
    }

    /**
     * Standing in for "Boss defeated" (03_mechanics.md 4.1) since Lv_1 has
     * no boss yet: clearing every enemy triggers the same color-explosion
     * reveal, once.
     */
    _checkLevelFullyRevealed() {
        if (this._levelFullyRevealed || this.enemies.length === 0 || !this.enemies.every((enemy) => enemy.dead)) return;

        this._levelFullyRevealed = true;
        this.colorZone.triggerFullReveal(this.player.centerX, this.player.visualCenterY);
        // The portal's own reveal isn't position-keyed (see Portal.js) -
        // but a full-level reveal means everything around it is revealed
        // too by the time it's even usable, so it should be.
        this.interactables.markPortalRevealed();
    }

    /**
     * Drops the boss's Token the frame its death animation finishes (see
     * Interactables.js's onBossDefeated()) - separate from
     * _checkLevelFullyRevealed() above since that fires on every enemy dead
     * (including non-boss levels), this only ever cares about the one boss
     * entity (this.boss, set by _spawnWraith()).
     */
    _checkBossDefeated() {
        if (this._bossDefeated || !this.boss || !this.boss.dead || !this.boss.deathAnimationFinished) return;

        this._bossDefeated = true;
        this.interactables.onBossDefeated(this.boss.centerX, this.boss.centerY, this.boss.name, this.boss.tokenReward);
    }

    /**
     * Starts the ghost-rise the frame the fall animation finishes, then
     * pushes GameOverState (StateMachine.js's push()) the frame its
     * fade-out completes - this session stops getting update() calls from
     * that point on, same freeze as Pause, while its own render() (still in
     * the stack) keeps drawing the now-finished (invisible) ghost/full-darken.
     * @param {number} dt
     */
    _updateDeathSequence(dt) {
        if (!this.deathSequence.active && this.player.dead && this.player.deathAnimationFinished) {
            this._startDeathSequence();
        }
        if (this.deathSequence.active && this.deathSequence.update(dt)) {
            this.game.stateMachine.push('gameover', { chapterId: this.chapterId, level: this.levelNumber });
        }
    }

    /**
     * Consumed once here rather than inside each of Interactables.js's own
     * _update*Prompt() methods - they'd otherwise race to drain the same
     * press, and whichever ran first would silently starve the others.
     */
    _updateInteractablePrompts() {
        const interactPressed = this.game.input.consumeInteractPress();
        this.interactables.updatePrompts(this.camera, interactPressed, this._levelFullyRevealed);
    }

    /**
     * Once the death sequence's full-darken sweep finishes, stops feeding
     * position updates entirely - otherwise this falls through to the
     * normal per-frame reveal-at-(x,y) behavior and punches a fresh colored
     * hole right at the (frozen) death spot.
     * @param {number} dt
     */
    _updateColorZone(dt) {
        if (!this.deathSequence.active || this.colorZone.isTransitioning) {
            this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
        }
    }

    /**
     * Refreshes the player's HP/Shield HTML labels (_createHudValueLabel()).
     */
    _updateHudText() {
        this.healthValueEl.textContent = `${Math.round(this.player.health)}/${this.player.maxHealth}`;
        this.shieldValueEl.textContent = `${Math.round(this.player.shield)}/${this.player.maxShield}`;
        this.tokenCounterEl.textContent = `x ${this.game.tokens}`;
    }

    /**
     * 01_core-gameplay-loop.md: "Reach the exit portal/level end - back to
     * the Worldmap" - completedLevels lives on Game (see Game.js), not this
     * session, since WorldmapState gets torn down/rebuilt on every visit.
     */
    _completeLevel() {
        this.game.completedLevels.add(this.levelNumber);
        this.game.saveProgress();
        this.game.stateMachine.change('worldmap');
    }

    /**
     * Player death (04_health-save-system.md) - mirrors the victory
     * full-reveal above: instead of the level bursting into color, it
     * darkens fully while a ghost rises from the death spot and fades out
     * (DeathSequence.js), then the Game Over panel (Panel.openChoices(),
     * same shape as PauseState.js) offers Retry/Main Menu.
     */
    _startDeathSequence() {
        // Falling into a pit (the kill plane above) can put the actual
        // death position below what Camera.js ever scrolls to (it clamps to
        // the level's bottom edge) - pin the ghost to the visible bottom
        // edge of the screen instead of spawning it off-screen where the
        // rise-and-fade would never be seen. this.game.height is screen
        // pixels - divide by zoom for the actual world-space height
        // currently visible (see Camera.js's follow() doing the same for
        // its own clamping).
        const visibleBottom = this.camera.y + this.game.height / this.camera.zoom - GHOST_FRAME_SIZE / 2;
        const x = this.player.centerX;
        const y = Math.min(this.player.visualCenterY, visibleBottom);
        this.deathSequence.start(x, y);
        this.colorZone.triggerFullDarken(x, y);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        ctx.save();
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        this._renderWorld(ctx);
        if (this.game.devPanel.showHitboxes) this._renderHitboxes(ctx);

        ctx.restore();
        this.hud.renderPlayerBars(ctx, this.player, this.game.hudScale);
    }

    /**
     * Everything drawn in world (camera-translated) space, back-to-front:
     * buried enemies -> the baked level canvas -> the color mechanic ->
     * interactables/enemies/projectiles -> the player (or its death ghost).
     * Buried enemies (Sentinel.js, not yet triggered) draw before the
     * terrain layer so it occludes them, instead of floating in front of
     * the ground they're meant to be hidden inside - separate from
     * `dormant` (still true a bit longer, through the visible rise).
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderWorld(ctx) {
        for (const enemy of this.enemies) {
            if (enemy.buried) enemy.render(ctx);
        }
        ctx.drawImage(this.levelCanvas, 0, 0);
        this._renderColorZone(ctx);

        // Ahead of the enemies/player below, so it reads as part of the
        // background/level furniture rather than a foreground object they'd
        // otherwise render behind.
        this.interactables.render(ctx);
        for (const enemy of this.enemies) {
            if (enemy.buried) continue;
            enemy.render(ctx);
            this.hud.renderEnemyBar(ctx, enemy);
        }
        this.combat.render(ctx);
        for (const vfx of this.playerVfx) vfx.render(ctx);

        if (this.deathSequence.active) {
            this.deathSequence.render(ctx);
        } else {
            this.player.render(ctx);
        }
    }

    /**
     * No liveGlow while dead - that would keep punching a hole open right
     * at the death spot every frame, fighting the full-darken effect.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderColorZone(ctx) {
        if (this.deathSequence.active) {
            this.colorZone.render(ctx);
        } else {
            this.colorZone.render(ctx, {
                x: this.player.centerX,
                y: this.player.visualCenterY,
                radius: PLAYER_REVEAL_RADIUS,
            });
        }
    }

    /**
     * Dev Panel toggle (js/ui/DevPanel.js) - draws each combat-relevant
     * entity's actual Collision/Combat box (Entity's x/y/width/height), not
     * its usually-larger sprite frame, so hit reads line up with what's on
     * screen. Still inside render()'s camera-translated ctx.save() block, so
     * these use world coordinates like everything else drawn above.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderHitboxes(ctx) {
        ctx.save();
        ctx.lineWidth = 1;

        ctx.strokeStyle = '#5cff8a';
        ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);

        ctx.strokeStyle = '#ffe75c';
        for (const enemy of this.enemies) {
            if (enemy.dead || enemy.buried) continue;
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }

        ctx.strokeStyle = '#5cc9ff';
        for (const projectile of this.combat.projectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }
        for (const projectile of this.combat.enemyProjectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }

        ctx.restore();
    }
}
