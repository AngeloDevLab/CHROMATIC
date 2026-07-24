import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { createEnemy } from '../entities/EnemyFactory.js';
import { Wraith } from '../entities/bosses/Wraith.js';
import { Boss } from '../entities/Boss.js';
import { Projectile } from '../entities/Projectile.js';
import { Portal } from '../entities/Portal.js';
import { Merchant } from '../entities/Merchant.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import { DeathSequence, GHOST_FRAME_SIZE } from '../mechanics/DeathSequence.js';
import {
    resolveMeleeAttack,
    resolveContactDamage,
    resolveProjectileHits,
    resolveEnemyProjectileHits,
    findNearestEnemy,
    isWithinMeleeRange,
    PLAYER_ATTACK_DAMAGE,
    RANGED_ATTACK_PRISMA_COST,
} from '../mechanics/Combat.js';
import { HUD, HEALTH_BAR, SHIELD_BAR } from '../ui/HUD.js';
import { DamageNumbers } from '../ui/DamageNumbers.js';
import { Panel } from '../ui/Panel.js';
import { MerchantDialogue } from '../ui/MerchantDialogue.js';

const CHARACTER_FRAME_SIZE = 96;
// Bigger canvas than the other sheets, deliberately - gives the sword extra
// room to swing past the body without clipping the frame edge. Doesn't need
// to be square - Player.js scales the attack frame by its own aspect ratio,
// so e.g. more side padding than vertical padding works fine too. Match
// these to whatever attack.png actually is.
const ATTACK_FRAME_WIDTH = 150;
const ATTACK_FRAME_HEIGHT = 96;
const FALLBACK_SPAWN = { x: 64, y: 0 };

// How far below the level's bottom edge the player has to fall before it
// counts as "into a pit" - a bit of slack past the visible bottom rather than
// killing the instant they cross it, so a platform flush with the level edge
// doesn't feel like an unfair instant death.
const FALL_DEATH_MARGIN_PX = 64;

// Combat feel: a brief total freeze the instant a hit lands (melee or
// contact), before anything reacts to it - update() early-returns while this
// is running (render() keeps drawing the last frame), same mechanism as the
// Pause early-return below. Short enough to read as "impact" rather than lag.
const HIT_STOP_SECONDS = 0.06;

// Sizes are independent of each other - the player's own live glow (render()
// below) always shows their immediate area as revealed regardless of what an
// enemy's darken() does to the persistent overlay there, so this doesn't need
// to stay smaller just to avoid getting overwritten near the player.
const PLAYER_REVEAL_RADIUS = 55;
const ENEMY_DARKEN_RADIUS = 65;
// A bit bigger than the darken radius above - dying reveals back what the
// enemy had darkened while patrolling, plus a bit more as a small death beat.
const ENEMY_DEATH_REVEAL_RADIUS = 90;

// How close the player needs to be (center to center) to the level-end
// portal for the [E] prompt to show/register - see _updatePortal() below.
// Reused as-is for the Merchant's own interact range (_updateMerchant()) -
// no reason for the two to differ.
const PORTAL_INTERACT_RANGE_PX = 40;

// 05_enemies-bosses.md 6.2.1's arena-presentation zoom, applied to the
// Miniboss too as a deliberate session-scoped deviation from the GDD (which
// only specifies it for Templateboss/Chapterboss) - see Camera.js.
// 10_technical-architecture.md 11.7.3 gives 0.75 as an example, but that read
// as barely noticeable in-game - 0.5 (~16px/tile instead of 32px/tile)
// confirmed by eye as the value that actually reads as "zoomed out".
const BOSS_CAMERA_ZOOM = 0.55;

// Pre-Lvl-6 teaser line only (05_enemies-bosses.md 6.2's real Merchant -
// shop, Token spend - only appears after the Templateboss) - placed early to
// tease the Lvl 6 fight by name. No gating on the Miniboss being defeated
// (unlike the real post-boss Merchant appearance) since this is just flavor,
// not a reward.
const MERCHANT_TEASER_TEXT = "Heh, another wanderer with color to spare. Slay the Wraith that haunts the Grey City, and we'll talk business.";

// Real Prologue levels (assets/levels/Lv_N.json), built in Tiled - which one
// loads is picked by number via LEVEL_JSON_KEYS below (only levels actually
// exported to JSON so far are registered there). Player/enemy spawn positions
// come from the Objects layer (PlayerStart/EnemySpawn) per
// 10_technical-architecture.md 11.6.2 - which enemy type spawns is read off
// each EnemySpawn object's own Tiled Name field (see EnemyFactory.js's
// ENEMY_SPRITE_SETS), not a separate custom property. Names that don't
// match a registered type (e.g. a typo in Tiled) are skipped with a console
// warning rather than spawning the wrong thing.
// All Prologue levels share the same tileset image so far (per
// 'prologue-tileset' in LoadingState.js) - add a distinct manifest key/lookup
// here too if a later level needs a different one.
export const LEVEL_JSON_KEYS = {
    1: 'lv1-level',
    2: 'lv2-level',
    3: 'lv3-level',
};

export class GameState extends State {
    enter({ chapterId, level } = {}) {
        this.chapterId = chapterId;
        this.levelNumber = level;

        const levelKey = LEVEL_JSON_KEYS[this.levelNumber];
        if (!levelKey) {
            throw new Error(`GameState: no level registered for level number ${this.levelNumber}`);
        }
        this.level = Level.load(this.game.assets, levelKey, 'prologue-tileset');
        // The Tiled layer is named "terrain", not the documented
        // "Terrain/Collision" - passed explicitly rather than renaming in Tiled.
        // One-way: the level is built from several stacked walkable floors, not
        // solid walls, so every terrain tile only blocks when landed on from
        // above (see utils/Collision.js). `walls` is an optional second layer,
        // always fully solid regardless of the one-way terrain above - lets a
        // level mark specific ledge/corner tiles as real walls (blocks sideways
        // movement too) without losing one-way behavior everywhere else.
        // Tolerates not existing yet - opt-in per level as it gets painted in.
        this.collision = new Collision(this.level, 'terrain', { oneWay: true, wallLayerName: 'walls' });
        this.camera = new Camera(this.game.width, this.game.height);

        this.levelCanvas = document.createElement('canvas');
        this.levelCanvas.width = this.level.pixelWidth;
        this.levelCanvas.height = this.level.pixelHeight;
        const levelCtx = this.levelCanvas.getContext('2d');

        // Base backdrop every Prologue level shares, tiled across the full
        // level width and cover-fit to its height - reuses the main menu's
        // forest image (10_technical-architecture.md 11.6.1). Tiled's own
        // "background" tile layer (drawn right after, per layerOrder) paints
        // on top of this per level - e.g. a cave-interior level (the planned
        // Gimmick level) covers this forest backdrop entirely with its own
        // rock/cave art instead of letting it show through gaps.
        const parallax = this.game.assets.getImage('menu-parallax-bg');
        const parallaxScale = this.level.pixelHeight / parallax.height;
        const parallaxWidth = parallax.width * parallaxScale;
        for (let x = 0; x < this.level.pixelWidth; x += parallaxWidth) {
            levelCtx.drawImage(parallax, 0, 0, parallax.width, parallax.height, x, 0, parallaxWidth, this.level.pixelHeight);
        }

        this.level.drawAllLayers(levelCtx);

        // Color mechanic (03_mechanics.md 4.1): the player leaves a permanent
        // color trail while moving (fadeDurationSeconds stays Infinity, the
        // ColorZone default) - unlike MenuState's decorative fading-bubble variant
        // of the same technique, real gameplay never reverts on its own. Grey
        // treatment matches the menu's tuned "Darkness" look for visual
        // consistency between the two scenes.
        this.colorZone = new ColorZone(this.level.pixelWidth, this.level.pixelHeight, PLAYER_REVEAL_RADIUS, {
            greyBrightness: 0.15,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.levelCanvas);

        const animations = {
            idle: new SpriteAnimation(this.game.assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
            running: new SpriteAnimation(this.game.assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
            jump: new SpriteAnimation(this.game.assets.getImage('guardian-jump'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 12),
            // Plays once per swing rather than looping (SpriteAnimation's loop:
            // false) - Player watches its `finished` flag to know when to hand
            // control back to normal locomotion.
            attack: new SpriteAnimation(this.game.assets.getImage('guardian-attack'), ATTACK_FRAME_WIDTH, ATTACK_FRAME_HEIGHT, 8, 16, { loop: false }),
            // Plays once on death, before the ghost-rise sequence below - see
            // Player.js's deathAnimationFinished/_enterDeathAnimation().
            dead: new SpriteAnimation(this.game.assets.getImage('guardian-dead'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 10, { loop: false }),
        };

        // Player death (04_health-save-system.md) - float-and-fade ghost, see
        // _startDeathSequence() and DeathSequence.js.
        this.deathSequence = new DeathSequence(this.game.assets.getImage('guardian-dead-ghost'));

        this.game.input.clearAttackPress();
        this.game.input.clearPausePress();
        this.game.input.clearJumpPress();
        this.game.input.clearDropPress();

        this.paused = false;
        this.panel = new Panel(this.game.overlay);

        const playerStart = this.level.getObjectsByType('PlayerStart')[0] ?? FALLBACK_SPAWN;
        this.player = new Player(playerStart.x, playerStart.y, animations);
        this.player.enableControl(this.game.input, this.collision);

        // "miniboss" bypasses the regular EnemyFactory - Wraith.js doesn't fit
        // its generic sprite-sheet wiring (different frame size/animation set/
        // clip-per-state shape, see _spawnWraith() below) and isn't part of
        // the regular roster to begin with.
        this.enemies = this.level.getObjectsByType('EnemySpawn')
            .map((spawn) => spawn.name?.toLowerCase() === 'miniboss'
                ? this._spawnWraith(spawn)
                : createEnemy(this.game.assets, this.collision, this.player, spawn))
            .filter(Boolean);

        // No dedicated "entering the arena" trigger - Lvl 3 is effectively
        // just the boss room itself, so the zoom applies for the whole level
        // session rather than needing a separate zone/state to turn it on.
        if (this.enemies.some((enemy) => enemy instanceof Boss)) {
            this.camera.zoom = BOSS_CAMERA_ZOOM;
        }

        // Level-end portal (01_core-gameplay-loop.md) - locked until every
        // enemy is dead (see update()'s _levelFullyRevealed check), then
        // interactable via [E] in range (_updatePortal()). Not every level has
        // one placed in Tiled yet, hence the null-tolerant Portal? everywhere.
        const portalSpawn = this.level.getObjectsByType('ExitPortal')[0];
        this.portal = portalSpawn ? new Portal(portalSpawn.x, portalSpawn.y, {
            closed: this.game.assets.getImage('portal-closed'),
            open: this.game.assets.getImage('portal-open'),
            opens: this.game.assets.getImage('portal-opens'),
        }, this.colorZone.greyFilterCSS) : null;
        if (!this.portal) {
            console.warn(`GameState: no ExitPortal object in this level - it can't be completed.`);
        }
        this.interactPromptEl = document.createElement('div');
        this.interactPromptEl.className = 'interact-prompt';
        this.interactPromptEl.textContent = '[E] Exit Level';
        this.interactPromptEl.hidden = true;
        this.game.overlay.appendChild(this.interactPromptEl);

        // Pre-Lvl-6 Merchant teaser (see MERCHANT_TEASER_TEXT above) - not
        // every level has one placed in Tiled, same null-tolerant pattern as
        // the Portal above. No sprite yet (Merchant.js's render() is a no-op
        // stub), so nothing is visible until real art exists - only the
        // trigger zone/dialogue work already.
        const merchantSpawn = this.level.getObjectsByType('Merchant')[0];
        this.merchant = merchantSpawn ? new Merchant(merchantSpawn.x, merchantSpawn.y) : null;
        this.merchantDialogue = new MerchantDialogue(this.game.overlay);
        this.merchantPromptEl = document.createElement('div');
        this.merchantPromptEl.className = 'interact-prompt';
        this.merchantPromptEl.textContent = '[E] Talk';
        this.merchantPromptEl.hidden = true;
        this.game.overlay.appendChild(this.merchantPromptEl);

        this.hud = new HUD();
        this.damageNumbers = new DamageNumbers(this.game.overlay);

        this.healthValueEl = this._createHudValueLabel(HEALTH_BAR);
        this.shieldValueEl = this._createHudValueLabel(SHIELD_BAR);

        this._levelFullyRevealed = false;
        this._hitStopTimer = 0;

        this.thrownSwordSprite = this.game.assets.getImage('thrown-sword');
        this.thrownSwordTrailSprite = this.game.assets.getImage('thrown-sword-trail');
        this.projectiles = [];
        // Separate from the player's own projectiles above rather than one
        // shared list with a "whose is this" flag - resolveProjectileHits
        // only ever checks player-thrown ones against enemies, and
        // resolveEnemyProjectileHits (Shooter.js's shots) only ever checks
        // these against the player, so there's no ambiguity to sort out.
        this.enemyProjectiles = [];
    }

    // Wraith.js's 6-clip-as-6-states shape (see that file's own comment) -
    // each animation is a distinct drawn pose, most one-shot (loop: false)
    // rather than a generic looping cycle, so this is built inline here
    // instead of going through EnemyFactory.js's one-size-fits-all wiring.
    // Frame sizes/counts match the actual 'boss-wraith-*' sheets
    // (LoadingState.js) - each a strip of 128x256 frames.
    _spawnWraith(spawn) {
        const wraith = new Wraith(spawn.x, spawn.y, this.collision, this.player);
        const assets = this.game.assets;
        const animations = {
            idle: new SpriteAnimation(assets.getImage('boss-wraith-idle'), 128, 256, 12, 8),
            toFiring: new SpriteAnimation(assets.getImage('boss-wraith-to-firing'), 128, 256, 12, 14, { loop: false }),
            firing: new SpriteAnimation(assets.getImage('boss-wraith-firing'), 128, 256, 1, 1),
            // Slow on purpose (session decision: "langsam wieder runter
            // gleiten") - he's still actively firing the whole way down
            // (Wraith.js's _activeBeam/trackY), not a quick drop, so 9
            // frames at 3fps stretches this to ~3s instead of the ~0.56s a
            // normal enemy-animation pace would give.
            toVulnerable: new SpriteAnimation(assets.getImage('boss-wraith-to-vulnerable'), 128, 256, 9, 3, { loop: false }),
            vulnerable: new SpriteAnimation(assets.getImage('boss-wraith-vulnerable'), 128, 256, 1, 1),
            toIdle: new SpriteAnimation(assets.getImage('boss-wraith-to-idle'), 128, 256, 8, 12, { loop: false }),
            // Enemy.js's _enterDeathAnimation()/deathAnimationFinished pick
            // this up automatically once hp hits 0 - same 'dead' key every
            // other enemy type uses.
            dead: new SpriteAnimation(assets.getImage('boss-wraith-dead'), 128, 256, 11, 14, { loop: false }),
        };
        wraith.setAnimations(animations, 'idle');
        // Enemy.render()'s deep fallback (anim/referenceAnim missing) draws
        // this.sprite directly - keep it a real image rather than the null
        // Wraith's constructor passes to super(), same reasoning Boss.render()
        // uses `!this.sprite` to decide whether art exists at all yet.
        wraith.sprite = animations.idle.image;
        return wraith;
    }

    _createHudValueLabel(bar) {
        const el = document.createElement('div');
        el.className = 'hud-value';
        el.style.left = `${bar.x + bar.width + 4}px`;
        el.style.top = `${bar.y - 2}px`;
        this.game.overlay.appendChild(el);
        return el;
    }

    exit() {
        this.healthValueEl?.remove();
        this.shieldValueEl?.remove();
        this.interactPromptEl?.remove();
        this.merchantPromptEl?.remove();
        this.merchantDialogue?.close();
        this.damageNumbers?.clear();
        this.panel?.close();
    }

    update(dt) {
        // Always drain the press regardless of death state, same reasoning as
        // the attack click - but ignore it once dead, Escape does nothing during
        // or after the death sequence (the Game Over panel handles that instead).
        const pausePressed = this.game.input.consumePausePress();
        if (pausePressed && !this.deathSequence.active) this._togglePause();
        if (this.paused) return;

        // Merchant dialogue (MerchantDialogue.js) freezes gameplay the same
        // way Pause does above (update() early-returns, render() keeps
        // drawing the last frame) - [E] here means "advance the dialogue",
        // not "interact with the level", so it's handled and consumed before
        // anything else gets a chance to read it.
        if (this.merchantDialogue.isOpen) {
            if (this.game.input.consumeInteractPress()) this.merchantDialogue.advance();
            this.merchantDialogue.update(dt);
            return;
        }

        if (this._hitStopTimer > 0) {
            this._hitStopTimer = Math.max(0, this._hitStopTimer - dt);
            return;
        }

        // Dev Panel (js/ui/DevPanel.js) - godmode is read off `game`, not owned
        // by GameState itself, since the panel's toggle state needs to survive
        // a level skip/retry (both tear down and rebuild GameState).
        this.player.godmode = this.game.devPanel.godmode;

        this.player.update(dt);
        for (const enemy of this.enemies) {
            enemy.update(dt);
            // Shooter.js's mailbox for a shot fired this frame - it has no
            // access to this shared array itself, see its own pendingProjectile.
            if (enemy.pendingProjectile) {
                this.enemyProjectiles.push(enemy.pendingProjectile);
                enemy.pendingProjectile = null;
            }
            // Wraith.js's mailbox for its beam-fire room-darken beat (session
            // decision) - same reasoning as pendingProjectile above, Wraith
            // itself has no access to ColorZone. Reuses PLAYER_REVEAL_RADIUS
            // for the safe pocket so it matches the size of the player's own
            // everyday reveal instead of a separately tuned number.
            if (enemy.pendingRoomDarken) {
                this.colorZone.darkenAllExcept(this.player.centerX, this.player.visualCenterY, PLAYER_REVEAL_RADIUS);
                enemy.pendingRoomDarken = false;
            }
        }
        this.portal?.update(dt);

        // Jump & Run gaps with no floor below (10_technical-architecture.md
        // Platform level type) currently let the player fall forever and keep
        // controlling mid-air - treat crossing the kill plane as death instead.
        if (!this.player.dead && this.player.y > this.level.pixelHeight + FALL_DEATH_MARGIN_PX) {
            this.player.die();
        }

        // 03_mechanics.md 4.3: melee if the nearest enemy is in reach, a
        // thrown-sword projectile otherwise - both share the same swing
        // animation/timing (Player.js is untouched), only what happens at the
        // swing's impact frame differs. The ranged throw spends Prisma (see
        // RANGED_ATTACK_PRISMA_COST in Combat.js) so it can't be spammed
        // indefinitely while an enemy sits just out of melee range - melee
        // itself stays free.
        let hits = [];
        if (this.player.consumeAttackImpact()) {
            const nearest = findNearestEnemy(this.player, this.enemies);
            if (nearest && !isWithinMeleeRange(this.player, nearest)) {
                if (this.player.consumeShield(RANGED_ATTACK_PRISMA_COST)) {
                    this.player.facing = nearest.centerX >= this.player.centerX ? 1 : -1;
                    const direction = this.player.facing;
                    const spawnCenterX = direction === 1 ? this.player.x + this.player.width : this.player.x;
                    this.projectiles.push(new Projectile(spawnCenterX, this.player.centerY, direction, this.thrownSwordSprite, PLAYER_ATTACK_DAMAGE, this.thrownSwordTrailSprite));
                } else {
                    this.damageNumbers.spawnStatus(this.player.centerX, this.player.visualTopY, 'No Prisma for Ranged Attack');
                }
            } else {
                hits = resolveMeleeAttack(this.player, this.enemies, this.enemyProjectiles);
            }
        }

        for (const projectile of this.projectiles) projectile.update(dt, this.collision);
        hits.push(...resolveProjectileHits(this.projectiles, this.enemies, this.enemyProjectiles));
        this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);

        for (const projectile of this.enemyProjectiles) projectile.update(dt, this.collision);
        const playerHits = resolveEnemyProjectileHits(this.enemyProjectiles, this.player, this.game.difficulty);
        for (const hit of playerHits) {
            // Anchored at the player, not "the enemy" like the hits loop
            // below - the Shooter that fired this may be far away (or dead)
            // by the time its shot actually lands, so showing the number at
            // the impact point (the player) is the only position that still
            // makes sense.
            this.damageNumbers.spawn(this.player.centerX, this.player.visualTopY, hit.amount);
        }
        if (playerHits.length > 0) this._hitStopTimer = HIT_STOP_SECONDS;
        this.enemyProjectiles = this.enemyProjectiles.filter((projectile) => !projectile.dead);

        hits.push(...resolveContactDamage(dt, this.player, this.enemies, this.game.difficulty));
        for (const hit of hits) {
            this.damageNumbers.spawn(hit.enemy.centerX, hit.enemy.visualTopY, hit.amount);
        }
        if (hits.length > 0) this._hitStopTimer = HIT_STOP_SECONDS;

        // 03_mechanics.md 4.1: "Enemy crosses a colored area -> the area turns
        // back to dark" - every living enemy continuously erases color around
        // itself as it patrols, independent of the player's own reveal below.
        // Dying reverses that once, revealing back what it had darkened (plus a
        // bit more) instead of just leaving a dark patch behind.
        for (const enemy of this.enemies) {
            if (!enemy.dead) {
                this.colorZone.darken(enemy.centerX, enemy.centerY, ENEMY_DARKEN_RADIUS);
            } else if (!enemy.colorRevealed) {
                enemy.colorRevealed = true;
                this.colorZone.reveal(enemy.centerX, enemy.centerY, ENEMY_DEATH_REVEAL_RADIUS);
            }
        }

        // Standing in for "Boss defeated" (03_mechanics.md 4.1) since Lv_1 has
        // no boss yet: clearing every enemy triggers the same color-explosion
        // reveal, once.
        if (!this._levelFullyRevealed && this.enemies.length > 0 && this.enemies.every((enemy) => enemy.dead)) {
            this._levelFullyRevealed = true;
            this.colorZone.triggerFullReveal(this.player.centerX, this.player.visualCenterY);
            // The portal's own reveal isn't position-keyed (see Portal.js) -
            // but a full-level reveal means everything around it is
            // revealed too by the time it's even usable, so it should be.
            if (this.portal) this.portal.revealed = true;
        }

        if (!this.deathSequence.active && this.player.dead && this.player.deathAnimationFinished) this._startDeathSequence();
        if (this.deathSequence.active) {
            if (this.deathSequence.update(dt)) this._openGameOverPanel();
        }

        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        // Consumed once here rather than inside each of _updatePortal()/
        // _updateMerchant() - both would otherwise race to drain the same
        // press, and whichever ran first would silently starve the other.
        const interactPressed = this.game.input.consumeInteractPress();
        this._updatePortal(interactPressed);
        this._updateMerchant(interactPressed);
        // Once the death sequence's full-darken sweep finishes, stop feeding
        // position updates entirely - otherwise this falls through to the
        // normal per-frame reveal-at-(x,y) behavior and punches a fresh
        // colored hole right at the (frozen) death spot.
        if (!this.deathSequence.active || this.colorZone.isTransitioning) {
            this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
        }
        this.damageNumbers.update(dt, this.camera);

        this.healthValueEl.textContent = `${Math.round(this.player.health)}/${this.player.maxHealth}`;
        this.shieldValueEl.textContent = `${Math.round(this.player.shield)}/${this.player.maxShield}`;
    }

    // Locked until _levelFullyRevealed (all enemies dead, set above).
    // interactPressed is drained once in update() and handed to both this and
    // _updateMerchant() below, see the comment at that call site.
    _updatePortal(interactPressed) {
        if (!this.portal) return;

        this.portal.active = this._levelFullyRevealed;

        // Same reveal radius as the player's own live-glow/permanent trail
        // (PLAYER_REVEAL_RADIUS) - walking within it reveals the portal same
        // as it would any other ground, even before the level's full-reveal
        // (which also sets this, see update() above) guarantees it later.
        if (!this.portal.revealed) {
            const dist = Math.hypot(this.player.centerX - this.portal.centerX, this.player.visualCenterY - this.portal.centerY);
            if (dist <= PLAYER_REVEAL_RADIUS) this.portal.revealed = true;
        }

        const inRange = this.portal.isOpen && !this.player.dead
            && Math.hypot(this.player.centerX - this.portal.centerX, this.player.centerY - this.portal.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.interactPromptEl.hidden = !inRange;
        if (inRange) {
            // Screen position must match render()'s ctx.scale(zoom)+translate
            // exactly, or the prompt drifts from the portal it's pointing at
            // once a boss fight sets camera.zoom below 1 (BOSS_CAMERA_ZOOM).
            this.interactPromptEl.style.left = `${(this.portal.centerX - this.camera.x) * this.camera.zoom}px`;
            this.interactPromptEl.style.top = `${(this.portal.y - this.camera.y) * this.camera.zoom}px`;
        }

        if (inRange && interactPressed) this._completeLevel();
    }

    // Pre-Lvl-6 Merchant teaser (MERCHANT_TEASER_TEXT above) - not gated on
    // anything (no boss to defeat yet at Lvl 3), just an [E]-in-range NPC
    // dialogue, same range/prompt pattern as _updatePortal() above.
    _updateMerchant(interactPressed) {
        if (!this.merchant) return;

        const inRange = !this.player.dead
            && Math.hypot(this.player.centerX - this.merchant.centerX, this.player.centerY - this.merchant.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.merchantPromptEl.hidden = !inRange;
        if (inRange) {
            // Same zoom correction as the portal prompt above.
            this.merchantPromptEl.style.left = `${(this.merchant.centerX - this.camera.x) * this.camera.zoom}px`;
            this.merchantPromptEl.style.top = `${(this.merchant.y - this.camera.y) * this.camera.zoom}px`;
        }

        if (inRange && interactPressed) this.merchantDialogue.open(MERCHANT_TEASER_TEXT);
    }

    // 01_core-gameplay-loop.md: "Reach the exit portal/level end - back to the
    // Worldmap" - completedLevels lives on Game (see Game.js), not this state,
    // since WorldmapState gets torn down/rebuilt on every visit.
    _completeLevel() {
        this.game.completedLevels.add(this.levelNumber);
        this.game.stateMachine.change('worldmap');
    }

    // Player death (04_health-save-system.md) - mirrors the victory full-reveal
    // above: instead of the level bursting into color, it darkens fully while a
    // ghost rises from the death spot and fades out (DeathSequence.js), then
    // the Game Over panel (same Panel/mechanism as Pause, see _togglePause())
    // offers Retry/Main Menu.
    _startDeathSequence() {
        // Falling into a pit (the kill plane above) can put the actual death
        // position below what Camera.js ever scrolls to (it clamps to the
        // level's bottom edge) - pin the ghost to the visible bottom edge of
        // the screen instead of spawning it off-screen where the rise-and-fade
        // would never be seen.
        // this.game.height is screen pixels - divide by zoom for the actual
        // world-space height currently visible (see Camera.js's follow()
        // doing the same for its own clamping).
        const visibleBottom = this.camera.y + this.game.height / this.camera.zoom - GHOST_FRAME_SIZE / 2;
        const x = this.player.centerX;
        const y = Math.min(this.player.visualCenterY, visibleBottom);
        this.deathSequence.start(x, y);
        this.colorZone.triggerFullDarken(x, y);
    }

    // Renders a [{ id, label, onClick }] choice list into a Panel - shared by
    // the Pause and Game Over panels below, which are otherwise identical
    // except for their title/choices.
    _openChoicePanel(title, choices, { dismissible = true } = {}) {
        const buttonsHTML = choices
            .map((choice) => `<button class="difficulty-option" data-action="${choice.id}">${choice.label}</button>`)
            .join('');

        this.panel.open(title, `<div class="difficulty-options">${buttonsHTML}</div>`, {
            dismissible,
            onMount: (root) => {
                for (const choice of choices) {
                    root.querySelector(`[data-action="${choice.id}"]`).addEventListener('click', choice.onClick);
                }
            },
        });
    }

    // Non-dismissible since there's no gameplay left to fall back to - the
    // player has to pick Retry or Main Menu explicitly.
    _openGameOverPanel() {
        this._openChoicePanel('Game Over', [
            { id: 'retry', label: 'Retry', onClick: () => this.game.stateMachine.change('game', { chapterId: this.chapterId, level: this.levelNumber }) },
            { id: 'menu', label: 'Main Menu', onClick: () => this.game.stateMachine.change('menu') },
        ], { dismissible: false });
    }

    // Pause: paused freezes update() (see update()'s early return) while
    // render() keeps drawing the last frame, so the panel shows on top of a
    // frozen (not blanked) screen. Non-dismissible for the same reason as Game
    // Over's panel - Escape/backdrop/× would desync `this.paused` from the
    // panel's actual visibility, so Resume is the only way back in, driven
    // through this same method Escape itself calls.
    _togglePause() {
        this.paused = !this.paused;
        if (this.paused) {
            this._openPausePanel();
        } else {
            this.panel.close();
        }
    }

    _openPausePanel() {
        this._openChoicePanel('Paused', [
            { id: 'resume', label: 'Resume', onClick: () => this._togglePause() },
            { id: 'menu', label: 'Main Menu', onClick: () => this.game.stateMachine.change('menu') },
        ], { dismissible: false });
    }

    render(ctx) {
        ctx.save();
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        // Buried enemies (Sentinel.js, not yet triggered) draw before the
        // terrain layer so it occludes them, instead of floating in front of
        // the ground they're meant to be hidden inside. Separate from
        // `dormant` (still true a bit longer, through the visible rise) -
        // see Sentinel.js.
        for (const enemy of this.enemies) {
            if (enemy.buried) enemy.render(ctx);
        }

        ctx.drawImage(this.levelCanvas, 0, 0);
        if (this.deathSequence.active) {
            // No liveGlow while dead - that would keep punching a hole open right
            // at the death spot every frame, fighting the full-darken effect.
            this.colorZone.render(ctx);
        } else {
            this.colorZone.render(ctx, {
                x: this.player.centerX,
                y: this.player.visualCenterY,
                radius: PLAYER_REVEAL_RADIUS,
            });
        }
        // Ahead of the enemies/player below, so it reads as part of the
        // background/level furniture rather than a foreground object they'd
        // otherwise render behind.
        this.portal?.render(ctx);
        this.merchant?.render(ctx);
        for (const enemy of this.enemies) {
            if (enemy.buried) continue;
            enemy.render(ctx);
            this.hud.renderEnemyBar(ctx, enemy);
        }
        for (const projectile of this.projectiles) projectile.render(ctx);
        for (const projectile of this.enemyProjectiles) projectile.render(ctx);
        if (this.deathSequence.active) {
            this.deathSequence.render(ctx);
        } else {
            this.player.render(ctx);
        }

        if (this.game.devPanel.showHitboxes) this._renderHitboxes(ctx);

        ctx.restore();

        this.hud.renderPlayerBars(ctx, this.player);
    }

    // Dev Panel toggle (js/ui/DevPanel.js) - draws each combat-relevant
    // entity's actual Collision/Combat box (Entity's x/y/width/height), not
    // its usually-larger sprite frame, so hit reads line up with what's on
    // screen. Still inside render()'s camera-translated ctx.save() block, so
    // these use world coordinates like everything else drawn above.
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
        for (const projectile of this.projectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }
        for (const projectile of this.enemyProjectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }

        ctx.restore();
    }
}
