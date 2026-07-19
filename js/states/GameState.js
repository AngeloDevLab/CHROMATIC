import { State } from './State.js';
import { Level } from '../world/Level.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Charger } from '../entities/enemies/Charger.js';
import { Projectile } from '../entities/Projectile.js';
import { Portal } from '../entities/Portal.js';
import { Collision } from '../utils/Collision.js';
import { Camera } from '../utils/Camera.js';
import { SpriteAnimation } from '../utils/SpriteAnimation.js';
import { ColorZone } from '../mechanics/ColorZone.js';
import {
    resolveMeleeAttack,
    resolveContactDamage,
    resolveProjectileHits,
    findNearestEnemy,
    isWithinMeleeRange,
    PLAYER_ATTACK_DAMAGE,
} from '../mechanics/Combat.js';
import { HUD, HEALTH_BAR, SHIELD_BAR } from '../ui/HUD.js';
import { DamageNumbers } from '../ui/DamageNumbers.js';
import { Panel } from '../ui/Panel.js';

const CHARACTER_FRAME_SIZE = 96;
// Enemy sheets (assets/images/enemys/<type>/) are their own 64x64 convention,
// independent of the player's 96x96 one above.
const ENEMY_FRAME_SIZE = 64;
// Maps an EnemySpawn object's Tiled Name field to its asset keys - add an
// entry here once a new enemy type actually exists in code (Shooter/Sentinel
// are art-only so far, see TODO.md). `charge` is Charger-only (its distinct
// rush sprite, see entities/enemies/Charger.js) - absent for types that don't
// use it.
const ENEMY_SPRITE_SETS = {
    patroller: { running: 'enemy-patroller-walking-idle', dead: 'enemy-patroller-dead' },
    charger: { running: 'enemy-charger-walking-idle', dead: 'enemy-charger-dead', charge: 'enemy-charger-charge' },
};
// Bigger canvas than the other sheets, deliberately - gives the sword extra
// room to swing past the body without clipping the frame edge. Doesn't need
// to be square - Player.js scales the attack frame by its own aspect ratio,
// so e.g. more side padding than vertical padding works fine too. Match
// these to whatever attack.png actually is.
const ATTACK_FRAME_WIDTH = 150;
const ATTACK_FRAME_HEIGHT = 96;
const FALLBACK_SPAWN = { x: 64, y: 0 };

const GHOST_FRAME_SIZE = 64;
const GHOST_RISE_SPEED = 25;
const GHOST_FADE_DURATION_SECONDS = 2.5;

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
const PORTAL_INTERACT_RANGE_PX = 40;

// Real Prologue levels (assets/levels/Lv_N.json), built in Tiled - which one
// loads is picked by number via LEVEL_JSON_KEYS below (only levels actually
// exported to JSON so far are registered there). Player/enemy spawn positions
// come from the Objects layer (PlayerStart/EnemySpawn) per
// 10_technical-architecture.md 11.6.2 - which enemy type spawns is read off
// each EnemySpawn object's own Tiled Name field (see ENEMY_SPRITE_SETS/
// _createEnemy() below), not a separate custom property. Names that don't
// match a registered type (typo, or a type not built yet - Shooter/Sentinel
// per 05_enemies-bosses.md) are skipped with a console warning rather than
// spawning the wrong thing.
// All Prologue levels share the same tileset image so far (per
// 'prologue-tileset' in LoadingState.js) - add a distinct manifest key/lookup
// here too if a later level needs a different one.
const LEVEL_JSON_KEYS = {
    1: 'lv1-level',
    2: 'lv2-level',
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
        // above (see utils/Collision.js).
        this.collision = new Collision(this.level, 'terrain', { oneWay: true });
        this.camera = new Camera(this.game.width, this.game.height);

        this.levelCanvas = document.createElement('canvas');
        this.levelCanvas.width = this.level.pixelWidth;
        this.levelCanvas.height = this.level.pixelHeight;
        const levelCtx = this.levelCanvas.getContext('2d');

        // Test: reuse the main menu's parallax image as a level backdrop, tiled
        // across the full level width and cover-fit to its height - real
        // per-level background art (10_technical-architecture.md 11.6.1) replaces
        // this once ready.
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
        // _startDeathSequence()/_updateDeathSequence().
        this.ghostAnimation = new SpriteAnimation(this.game.assets.getImage('guardian-dead-ghost'), GHOST_FRAME_SIZE, GHOST_FRAME_SIZE, 13, 10);
        this._deathSequence = null;

        this.game.input.clearAttackPress();
        this.game.input.clearPausePress();
        this.game.input.clearJumpPress();

        this.paused = false;
        this.panel = new Panel(this.game.overlay);

        const playerStart = this.level.getObjectsByType('PlayerStart')[0] ?? FALLBACK_SPAWN;
        this.player = new Player(playerStart.x, playerStart.y, animations);
        this.player.enableControl(this.game.input, this.collision);

        this.enemies = this.level.getObjectsByType('EnemySpawn')
            .map((spawn) => this._createEnemy(spawn))
            .filter(Boolean);

        // Level-end portal (01_core-gameplay-loop.md) - locked until every
        // enemy is dead (see update()'s _levelFullyRevealed check), then
        // interactable via [E] in range (_updatePortal()). Not every level has
        // one placed in Tiled yet, hence the null-tolerant Portal? everywhere.
        const portalSpawn = this.level.getObjectsByType('ExitPortal')[0];
        this.portal = portalSpawn ? new Portal(portalSpawn.x, portalSpawn.y, {
            closed: this.game.assets.getImage('portal-closed'),
            open: this.game.assets.getImage('portal-open'),
            opens: this.game.assets.getImage('portal-opens'),
        }) : null;
        if (!this.portal) {
            console.warn(`GameState: no ExitPortal object in this level - it can't be completed.`);
        }
        this.interactPromptEl = document.createElement('div');
        this.interactPromptEl.className = 'interact-prompt';
        this.interactPromptEl.textContent = '[E] Exit Level';
        this.interactPromptEl.hidden = true;
        this.game.overlay.appendChild(this.interactPromptEl);

        this.hud = new HUD();
        this.damageNumbers = new DamageNumbers(this.game.overlay);

        this.healthValueEl = this._createHudValueLabel(HEALTH_BAR);
        this.shieldValueEl = this._createHudValueLabel(SHIELD_BAR);

        this._levelFullyRevealed = false;
        this._hitStopTimer = 0;

        this.thrownSwordSprite = this.game.assets.getImage('thrown-sword');
        this.thrownSwordTrailSprite = this.game.assets.getImage('thrown-sword-trail');
        this.projectiles = [];
    }

    // Own SpriteAnimation instance per enemy - sharing one across all of them
    // would advance its frame timer once per enemy per game frame (animation
    // playing N times too fast for N enemies). Returns null (filtered out by
    // the caller) for a spawn name with no registered sprite.
    _createEnemy(spawn) {
        const spriteSet = ENEMY_SPRITE_SETS[spawn.name?.toLowerCase()];
        if (!spriteSet) {
            console.warn(`GameState: no enemy type registered for EnemySpawn name "${spawn.name}" at (${spawn.x}, ${spawn.y}) - skipped.`);
            return null;
        }

        const typeName = spawn.name.toLowerCase();
        const sprite = this.game.assets.getImage(spriteSet.running);
        const EnemyClass = typeName === 'charger' ? Charger : Enemy;
        const enemy = new EnemyClass(spawn.x, spawn.y, sprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE);

        const animations = {
            running: new SpriteAnimation(sprite, ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 10),
            // Plays once on death instead of vanishing instantly - see
            // Enemy.js's deathAnimationFinished/_enterDeathAnimation().
            dead: new SpriteAnimation(this.game.assets.getImage(spriteSet.dead), ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 12, { loop: false }),
        };
        if (spriteSet.charge) {
            animations.charge = new SpriteAnimation(this.game.assets.getImage(spriteSet.charge), ENEMY_FRAME_SIZE, ENEMY_FRAME_SIZE, 12, 14);
        }
        enemy.setAnimations(animations);

        enemy.enablePatrol(this.collision);
        if (enemy instanceof Charger) enemy.enableCharge(this.player);
        return enemy;
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
        this.damageNumbers?.clear();
        this.panel?.close();
    }

    update(dt) {
        // Always drain the press regardless of death state, same reasoning as
        // the attack click - but ignore it once dead, Escape does nothing during
        // or after the death sequence (the Game Over panel handles that instead).
        const pausePressed = this.game.input.consumePausePress();
        if (pausePressed && !this._deathSequence) this._togglePause();
        if (this.paused) return;

        if (this._hitStopTimer > 0) {
            this._hitStopTimer = Math.max(0, this._hitStopTimer - dt);
            return;
        }

        this.player.update(dt);
        for (const enemy of this.enemies) enemy.update(dt);
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
        // swing's impact frame differs.
        let hits = [];
        if (this.player.consumeAttackImpact()) {
            const nearest = findNearestEnemy(this.player, this.enemies);
            if (nearest && !isWithinMeleeRange(this.player, nearest)) {
                this.player.facing = nearest.centerX >= this.player.centerX ? 1 : -1;
                const direction = this.player.facing;
                const spawnCenterX = direction === 1 ? this.player.x + this.player.width : this.player.x;
                this.projectiles.push(new Projectile(spawnCenterX, this.player.centerY, direction, this.thrownSwordSprite, PLAYER_ATTACK_DAMAGE, this.thrownSwordTrailSprite));
            } else {
                hits = resolveMeleeAttack(this.player, this.enemies);
            }
        }

        for (const projectile of this.projectiles) projectile.update(dt, this.collision);
        hits.push(...resolveProjectileHits(this.projectiles, this.enemies));
        this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);

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
        }

        if (!this._deathSequence && this.player.dead && this.player.deathAnimationFinished) this._startDeathSequence();
        if (this._deathSequence) this._updateDeathSequence(dt);

        this.camera.follow(this.player, this.level.pixelWidth, this.level.pixelHeight);
        this._updatePortal();
        // Once the death sequence's full-darken sweep finishes, stop feeding
        // position updates entirely - otherwise this falls through to the
        // normal per-frame reveal-at-(x,y) behavior and punches a fresh
        // colored hole right at the (frozen) death spot.
        if (!this._deathSequence || this.colorZone.isTransitioning) {
            this.colorZone.update(dt, this.player.centerX, this.player.visualCenterY);
        }
        this.damageNumbers.update(dt, this.camera);

        this.healthValueEl.textContent = `${Math.round(this.player.health)}/${this.player.maxHealth}`;
        this.shieldValueEl.textContent = `${Math.round(this.player.shield)}/${this.player.maxShield}`;
    }

    // Locked until _levelFullyRevealed (all enemies dead, set above) - drains
    // the interact press every frame regardless of range/active, same
    // reasoning as the attack click, so a stray press well outside range
    // doesn't linger and fire the moment the player later steps into it.
    _updatePortal() {
        if (this.portal) this.portal.active = this._levelFullyRevealed;

        const interactPressed = this.game.input.consumeInteractPress();
        const inRange = !!this.portal && this.portal.isOpen && !this.player.dead
            && Math.hypot(this.player.centerX - this.portal.centerX, this.player.centerY - this.portal.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.interactPromptEl.hidden = !inRange;
        if (inRange) {
            this.interactPromptEl.style.left = `${this.portal.centerX - this.camera.x}px`;
            this.interactPromptEl.style.top = `${this.portal.y - this.camera.y}px`;
        }

        if (inRange && interactPressed) this._completeLevel();
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
    // ghost rises from the death spot and fades out, then the Game Over panel
    // (same Panel/mechanism as Pause, see _togglePause()) offers Retry/Main Menu.
    _startDeathSequence() {
        // Falling into a pit (the kill plane above) can put the actual death
        // position below what Camera.js ever scrolls to (it clamps to the
        // level's bottom edge) - pin the ghost to the visible bottom edge of
        // the screen instead of spawning it off-screen where the rise-and-fade
        // would never be seen.
        const visibleBottom = this.camera.y + this.game.height - GHOST_FRAME_SIZE / 2;
        this._deathSequence = {
            x: this.player.centerX,
            y: Math.min(this.player.visualCenterY, visibleBottom),
            elapsed: 0,
            gameOverShown: false,
        };
        this.ghostAnimation.reset();
        this.colorZone.triggerFullDarken(this._deathSequence.x, this._deathSequence.y);
    }

    _updateDeathSequence(dt) {
        this._deathSequence.elapsed += dt;
        this._deathSequence.y -= GHOST_RISE_SPEED * dt;
        this.ghostAnimation.update(dt);

        if (!this._deathSequence.gameOverShown && this._deathSequence.elapsed >= GHOST_FADE_DURATION_SECONDS) {
            this._deathSequence.gameOverShown = true;
            this._openGameOverPanel();
        }
    }

    // Same Panel + option-list pattern as the Pause menu below, non-dismissible
    // since there's no gameplay left to fall back to - the player has to pick
    // Retry or Main Menu explicitly.
    _openGameOverPanel() {
        this.panel.open('Game Over', `
            <div class="difficulty-options">
                <button class="difficulty-option" data-action="retry">Retry</button>
                <button class="difficulty-option" data-action="menu">Main Menu</button>
            </div>
        `, {
            dismissible: false,
            onMount: (root) => {
                root.querySelector('[data-action="retry"]').addEventListener('click', () => {
                    this.game.stateMachine.change('game', { chapterId: this.chapterId, level: this.levelNumber });
                });
                root.querySelector('[data-action="menu"]').addEventListener('click', () => {
                    this.game.stateMachine.change('menu');
                });
            },
        });
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
        this.panel.open('Paused', `
            <div class="difficulty-options">
                <button class="difficulty-option" data-action="resume">Resume</button>
                <button class="difficulty-option" data-action="menu">Main Menu</button>
            </div>
        `, {
            dismissible: false,
            onMount: (root) => {
                root.querySelector('[data-action="resume"]').addEventListener('click', () => this._togglePause());
                root.querySelector('[data-action="menu"]').addEventListener('click', () => {
                    this.game.stateMachine.change('menu');
                });
            },
        });
    }

    _renderGhost(ctx) {
        const alpha = Math.max(0, 1 - this._deathSequence.elapsed / GHOST_FADE_DURATION_SECONDS);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        this.ghostAnimation.draw(
            ctx,
            this._deathSequence.x - GHOST_FRAME_SIZE / 2,
            this._deathSequence.y - GHOST_FRAME_SIZE / 2,
            GHOST_FRAME_SIZE,
            GHOST_FRAME_SIZE
        );
        ctx.restore();
    }

    render(ctx) {
        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        ctx.drawImage(this.levelCanvas, 0, 0);
        if (this._deathSequence) {
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
        for (const enemy of this.enemies) {
            enemy.render(ctx);
            this.hud.renderEnemyBar(ctx, enemy);
        }
        this.portal?.render(ctx);
        for (const projectile of this.projectiles) projectile.render(ctx);
        if (this._deathSequence) {
            this._renderGhost(ctx);
        } else {
            this.player.render(ctx);
        }

        ctx.restore();

        this.hud.renderPlayerBars(ctx, this.player);
    }
}
