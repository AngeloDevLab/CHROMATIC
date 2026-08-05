import { Portal } from '../entities/Portal.js';
import { Merchant } from '../entities/Merchant.js';
import { Token } from '../entities/Token.js';
import { Trapdoor } from '../entities/Trapdoor.js';
import { SecretDoor, SECRET_DOOR_PRISMA_COST } from '../entities/SecretDoor.js';
import { BuffTerminal } from '../entities/BuffTerminal.js';
import { MerchantDialogue } from '../ui/MerchantDialogue.js';
import { isTouchCapable, buildTouchButtonElement } from '../ui/TouchControls.js';

// How close the player needs to be (center to center) to the level-end
// portal for the [E] prompt to show/register - see _updatePortalPrompt()
// below. Reused as-is for the Merchant's own interact range
// (_updateMerchantPrompt()) - no reason for the two to differ.
const PORTAL_INTERACT_RANGE_PX = 40;

// Lvl 4 Gimmick (docs/GDD/02_game-structure.md 2.6) - how close the player's
// feet need to be to the Trapdoor's top edge before it starts opening, see
// _updateTrapdoorTrigger() below. Small on purpose - it should read as "the
// ground gives way right as you step on it", not visibly ahead of time.
const TRAPDOOR_TRIGGER_MARGIN_PX = 16;

// How far apart multi-Token boss drops land (see _buildTokenDrop()) - a
// Templateboss/Chapterboss's 2 Tokens spawn side by side instead of stacked
// on the exact same point, so they read as two distinct pickups at a glance.
const TOKEN_DROP_OFFSET_PX = 28;

// Shown for a Miniboss-tier Merchant (1 Token, never enough to afford an
// ability alone - see ABILITY_TOKEN_COST below) - pure flavor tease, no shop
// attached, just points at the Lvl 6 fight by name so the player has a reason
// to keep going (session decision, see project_refactor-roadmap memory).
const MINIBOSS_DIALOGUE_TEXT = "Heh, another wanderer with color to spare. Slay the Wraith that haunts the Grey City, and we'll talk business.";

// 03_mechanics.md 4.4: "An ability costs 2 Tokens." A Templateboss/
// Chapterboss Merchant (tokenReward >= this) is the only one that can ever
// afford one, so that's also the gate on whether the shop opens at all -
// see onBossDefeated()/_openMerchantDialogue() below.
const ABILITY_TOKEN_COST = 2;
const SHOP_MIN_TOKEN_REWARD = ABILITY_TOKEN_COST;

// 03_mechanics.md 4.4: "Double Jump and Dash are guaranteed first options at
// the Prologue Merchant" - the only two abilities that exist yet, so this is
// every Prologue shop's full, fixed option list.
const ABILITY_SHOP_OPTIONS = [
    { id: 'doubleJump', label: 'Double Jump', description: 'Press Jump twice.', cost: ABILITY_TOKEN_COST },
    { id: 'dash', label: 'Dash', description: 'Press A or D twice quickly to dash in that direction.', cost: ABILITY_TOKEN_COST },
];

// Portal/Merchant/Trapdoor/SecretDoor/BuffTerminal - every level object the
// player interacts with via proximity/[E], extracted out of LevelSession.js
// so that file isn't also the sole owner of every interactable's spawn/
// update/prompt-positioning/render on top of everything else it already
// does (same motivation as CombatCoordinator.js). `onComplete` is a
// callback rather than this class calling stateMachine.change('worldmap')
// itself - finishing the level is LevelSession's own concern (levelNumber,
// completedLevels), not this class's; Merchant/BuffTerminal don't need the
// same treatment, they already only ever open a dialogue or push a state, nothing
// LevelSession-specific about either.
export class Interactables {
    /**
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its object markers.
     * @param {Player} player - For proximity/range checks.
     * @param {object} options
     * @param {string} options.greyFilterCSS - ColorZone.greyFilterCSS, shared visual treatment for unrevealed entities.
     * @param {number} options.revealRadius - LevelSession's PLAYER_REVEAL_RADIUS, reused so "revealed" tracks the same distance as the color trail.
     * @param {DamageNumbers} options.damageNumbers - For "not enough Prisma" status text.
     * @param {Collision} options.collision - For the boss-drop Tokens' fall onto the floor (_updateTokens()).
     * @param {number} options.levelNumber - This level's number, to key `Game.claimedBossTokens` (onBossDefeated()) so a boss's Token reward is only ever granted once per level, independent of completedLevels/how the level is left.
     * @param {() => void} options.onComplete - Called when the player exits through the completed level's portal.
     */
    constructor(game, level, player, { greyFilterCSS, revealRadius, damageNumbers, collision, levelNumber, onComplete }) {
        this.game = game;
        this.player = player;
        this._revealRadius = revealRadius;
        this.damageNumbers = damageNumbers;
        this._collision = collision;
        this._levelNumber = levelNumber;
        this._onComplete = onComplete;

        this._spawnPortal(level, greyFilterCSS);
        this._spawnMerchant(level);
        this._spawnTrapdoor(level, greyFilterCSS);
        this._spawnSecretDoor(level, greyFilterCSS);
        this._spawnBuffTerminal(level);
    }

    /**
     * Builds one of the four [E]-prompt elements (Portal/Merchant/
     * SecretDoor/BuffTerminal) - on a touch device this is a wrapper around
     * a real Interact icon button (TouchControls.js's buildTouchButtonElement(),
     * same plate+icon look as the fixed corner buttons) plus a text label
     * below it, instead of the plain "[E] ..." text desktop gets. The button
     * taps through to InputHandler.triggerPress('interact'), the same
     * edge-triggered press a physical E key already produces, so
     * LevelSession's existing consumeInteractPress() poll picks either up
     * identically. Shown/hidden/positioned per-frame by each _update*Prompt()
     * method below exactly as before - this only changes how it's built.
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createInteractPrompt(text) {
        const el = document.createElement('div');
        el.className = 'interact-prompt';
        el.hidden = true;

        const touch = isTouchCapable();
        if (touch) {
            el.classList.add('tappable');
            const button = buildTouchButtonElement('btn-icon-interact', 'interact-prompt-icon');
            button.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                this.game.input.triggerPress('interact');
            });
            el.appendChild(button);
        }

        const label = document.createElement('div');
        // "[E] " reads as a stray artifact on a device with no E key.
        label.textContent = touch ? text.replace('[E] ', '') : text;
        el.appendChild(label);

        this.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Level-end portal (01_core-gameplay-loop.md) - locked until every enemy
     * is dead (see updatePrompts()'s levelFullyRevealed param), then
     * interactable via [E] in range. Not every level has one placed in
     * Tiled yet, hence the null-tolerant Portal? everywhere.
     * @param {Level} level
     * @param {string} greyFilterCSS
     */
    _spawnPortal(level, greyFilterCSS) {
        const spawn = level.getObjectsByType('ExitPortal')[0];
        this.portal = spawn ? new Portal(spawn.x, spawn.y, {
            closed: this.game.assets.getImage('portal-closed'),
            open: this.game.assets.getImage('portal-open'),
            opens: this.game.assets.getImage('portal-opens'),
        }, greyFilterCSS) : null;
        if (!this.portal) {
            console.warn('Interactables: no ExitPortal object in this level - it can\'t be completed.');
        }
        this.interactPromptEl = this._createInteractPrompt('[E] Exit Level');
    }

    /**
     * Real post-boss Merchant (05_enemies-bosses.md 6.2: "After a
     * Templateboss/Chapterboss, the Merchant appears in the same room" -
     * applied to the Miniboss here too, session decision). Doesn't spawn at
     * all until the boss is dead and every dropped Token (see
     * onBossDefeated()/_updateTokens()) is collected - this.merchant stays
     * null until then, same null-tolerant pattern as Portal, so every prompt/
     * render call below is already safe. Not every level has a Merchant
     * object placed in Tiled, same null-tolerant pattern otherwise.
     * @param {Level} level
     */
    _spawnMerchant(level) {
        this._merchantSpawn = level.getObjectsByType('Merchant')[0] ?? null;
        this.merchant = null;
        this.tokens = [];
        this.merchantDialogue = new MerchantDialogue(this.game.overlay);
        this.merchantPromptEl = this._createInteractPrompt('[E] Talk');
    }

    /**
     * Lvl 4 Gimmick (see TRAPDOOR_TRIGGER_MARGIN_PX above) - sized to the
     * Tiled object itself (not a fixed sprite size like Portal), so it
     * covers exactly the terrain gap it's placed over. Same null-tolerant
     * pattern as Portal/Merchant.
     * @param {Level} level
     * @param {string} greyFilterCSS
     */
    _spawnTrapdoor(level, greyFilterCSS) {
        const spawn = level.getObjectsByType('Trapdoor')[0];
        this.trapdoor = spawn
            ? new Trapdoor(spawn.x, spawn.y, spawn.width, spawn.height, {
                closed: this.game.assets.getImage('trapdoor-closed'),
                opens: this.game.assets.getImage('trapdoor-opens'),
                opensFrameCount: 10,
                opensFps: 12,
            }, greyFilterCSS)
            : null;
    }

    /**
     * Secret Room (Lvl 5 Gimmick, docs/GDD/02_game-structure.md 2.5) - same
     * null-tolerant pattern as everything else above. "Only visible once
     * the player has colored the surrounding area" needs no extra code at
     * all - it's just the same greyFilterCSS/revealed treatment as
     * Portal/Trapdoor, so it looks identical to unrevealed terrain until then.
     * @param {Level} level
     * @param {string} greyFilterCSS
     */
    _spawnSecretDoor(level, greyFilterCSS) {
        const spawn = level.getObjectsByType('SecretDoor')[0];
        this.secretDoor = spawn
            ? new SecretDoor(spawn.x, spawn.y, spawn.width, spawn.height, {
                closed: this.game.assets.getImage('secretdoor-closed'),
                open: this.game.assets.getImage('secretdoor-open'),
                opens: this.game.assets.getImage('secretdoor-opens'),
                opensFrameCount: 7,
                opensFps: 12,
            }, greyFilterCSS)
            : null;
        this.secretDoorPromptEl = this._createInteractPrompt(`[E] Open (${SECRET_DOOR_PRISMA_COST} Prisma)`);
    }

    /**
     * Gated on secretDoor.isOpen (see _updateBuffTerminalPrompt()), not its
     * own separate reveal/color state - it sits inside the room the door
     * already guards.
     * @param {Level} level
     */
    _spawnBuffTerminal(level) {
        const spawn = level.getObjectsByType('BuffTerminal')[0];
        this.buffTerminal = spawn
            ? new BuffTerminal(spawn.x, spawn.y, spawn.width, spawn.height, this.game.assets.getImage('buffterminal'))
            : null;
        // Already claimed on an earlier visit (Game.claimedSecretRoomBuffs,
        // BuffState.js's _choose()) - start pre-used so replaying this level
        // can't offer (and stack) a second buff choice from the same
        // terminal. `used` alone (BuffTerminal.js's own instance field)
        // doesn't survive a replay's fresh LevelSession on its own.
        if (this.buffTerminal && this.game.claimedSecretRoomBuffs.has(this._levelNumber)) {
            this.buffTerminal.used = true;
        }
        this.buffTerminalPromptEl = this._createInteractPrompt('[E] Choose Buff');
    }

    /**
     * Tears down every prompt element/dialogue this class added to the DOM.
     */
    destroy() {
        this.interactPromptEl?.remove();
        this.merchantPromptEl?.remove();
        this.merchantDialogue?.close();
        this.secretDoorPromptEl?.remove();
        this.buffTerminalPromptEl?.remove();
    }

    /**
     * AABB push-out along whichever axis has the smaller overlap - a closed
     * SecretDoor is the only entity in the game that needs to physically
     * block the player (see LevelSession.update()'s call site for why this
     * isn't just part of Collision.js). No-op if there's no SecretDoor, or
     * it's already open.
     */
    blockSecretDoor() {
        const door = this.secretDoor;
        if (!door || door.isOpen) return;
        const player = this.player;
        const overlapping = player.x < door.x + door.width && player.x + player.width > door.x
            && player.y < door.y + door.height && player.y + player.height > door.y;
        if (!overlapping) return;

        this._pushOutOfSecretDoor(door, player);
    }

    /**
     * @param {SecretDoor} door
     * @param {Player} player
     */
    _pushOutOfSecretDoor(door, player) {
        const overlapLeft = (player.x + player.width) - door.x;
        const overlapRight = (door.x + door.width) - player.x;
        const overlapTop = (player.y + player.height) - door.y;
        const overlapBottom = (door.y + door.height) - player.y;

        if (Math.min(overlapLeft, overlapRight) < Math.min(overlapTop, overlapBottom)) {
            player.x = overlapLeft < overlapRight ? door.x - player.width : door.x + door.width;
            player.vx = 0;
        } else {
            player.y = overlapTop < overlapBottom ? door.y - player.height : door.y + door.height;
            player.vy = 0;
        }
    }

    /**
     * @param {number} dt
     */
    updateEntities(dt) {
        this.portal?.update(dt);
        this.trapdoor?.update(dt);
        this._updateTrapdoorTrigger();
        this.secretDoor?.update(dt);
        this._updateTokens(dt);
    }

    /**
     * Called once by LevelSession when this level's boss dies (its death
     * animation has finished) - drops tokenReward separate Tokens at the
     * boss's position (see _buildTokenDrop()) for the player to walk over,
     * and remembers the boss's name (Boss.js) for _openMerchantDialogue()
     * once they're all collected. No-op if this level has no Merchant object
     * placed in Tiled, this has already fired once this session, or this
     * level's boss reward was already claimed on an earlier visit
     * (Game.claimedBossTokens - replaying a level, e.g. via the Worldmap or
     * by leaving through Pause instead of the exit portal, must not let the
     * same boss drop fresh Tokens indefinitely). Marks the reward claimed
     * and saves immediately, rather than waiting for the Tokens to actually
     * be picked up - once the boss is dead the reward is committed.
     * @param {number} centerX - Boss's centerX at time of death.
     * @param {number} centerY - Boss's centerY at time of death.
     * @param {string} bossName - Boss.name, shown in the Templateboss+ greeting.
     * @param {number} tokenReward - Boss.tokenReward, how many Tokens to drop.
     */
    onBossDefeated(centerX, centerY, bossName, tokenReward) {
        if (!this._merchantSpawn || this.tokens.length || this.merchant) return;
        if (this.game.claimedBossTokens.has(this._levelNumber)) return;
        this.game.claimedBossTokens.add(this._levelNumber);
        this.game.saveProgress();
        this._bossName = bossName;
        this._tokenReward = tokenReward;
        this.tokens = this._buildTokenDrop(centerX, centerY, tokenReward);
    }

    /**
     * Spreads `count` Tokens evenly around centerX, TOKEN_DROP_OFFSET_PX
     * apart, instead of stacking them on the exact same point.
     * @param {number} centerX
     * @param {number} centerY
     * @param {number} count
     * @returns {Token[]}
     */
    _buildTokenDrop(centerX, centerY, count) {
        const spread = (count - 1) * TOKEN_DROP_OFFSET_PX;
        return Array.from({ length: count }, (_, i) =>
            new Token(centerX - spread / 2 + i * TOKEN_DROP_OFFSET_PX, centerY, this.game.assets.getImage('token')));
    }

    /**
     * Falls/bobs (Token.js) until the player's hitbox overlaps it (no [E]
     * prompt, plain proximity pickup) - each collected Token adds 1 to
     * Game.tokens (read by LevelSession/WorldmapState's HUD counter); the
     * real Merchant spawns at its Tiled-placed position once every dropped
     * Token is gone.
     * @param {number} dt
     */
    _updateTokens(dt) {
        if (!this.tokens.length) return;
        for (const token of this.tokens) token.update(dt, this._collision);
        this.tokens = this.tokens.filter((token) => !this._collectToken(token));
        if (!this.tokens.length && !this.merchant) {
            this.merchant = new Merchant(this._merchantSpawn.x, this._merchantSpawn.y, this.game.assets.getImage('merchant'));
        }
    }

    /**
     * @param {Token} token
     * @returns {boolean} Whether this Token was just picked up.
     */
    _collectToken(token) {
        if (!this._overlapsPlayer(token)) return false;
        this.game.tokens++;
        this.game.saveProgress();
        this.game.sound.playSfx('token-pickup');
        return true;
    }

    /**
     * @param {Entity} entity
     * @returns {boolean}
     */
    _overlapsPlayer(entity) {
        const player = this.player;
        return player.x < entity.x + entity.width && player.x + player.width > entity.x
            && player.y < entity.y + entity.height && player.y + player.height > entity.y;
    }

    /**
     * Lvl 4 Gimmick - no [E] prompt, no interact press needed, this is
     * purely proximity-driven: horizontally over the trapdoor and close
     * enough above it that it reads as "the ground gives way as you step on
     * it" rather than opening early or late. Trapdoor.trigger() itself
     * no-ops once already opening/open, so calling this every frame while
     * standing over it is harmless.
     */
    _updateTrapdoorTrigger() {
        if (!this.trapdoor) return;

        if (!this.trapdoor.revealed) {
            const dist = Math.hypot(this.player.centerX - this.trapdoor.centerX, this.player.visualCenterY - this.trapdoor.centerY);
            if (dist <= this._revealRadius) this.trapdoor.revealed = true;
        }

        const horizontallyOver = this.player.centerX >= this.trapdoor.x && this.player.centerX <= this.trapdoor.x + this.trapdoor.width;
        const feetNearTop = Math.abs((this.player.y + this.player.height) - this.trapdoor.y) <= TRAPDOOR_TRIGGER_MARGIN_PX;
        if (horizontallyOver && feetNearTop) this.trapdoor.trigger();
    }

    /**
     * Marks the portal revealed outright - called once, the frame the level
     * fully clears (LevelSession.update()), independent of the proximity
     * check updatePrompts() does every frame.
     */
    markPortalRevealed() {
        if (this.portal) this.portal.revealed = true;
    }

    /**
     * @param {Camera} camera
     * @param {boolean} interactPressed
     * @param {boolean} levelFullyRevealed
     */
    updatePrompts(camera, interactPressed, levelFullyRevealed) {
        this._updatePortalPrompt(camera, interactPressed, levelFullyRevealed);
        this._updateMerchantPrompt(camera, interactPressed);
        this._updateSecretDoorPrompt(camera, interactPressed);
        this._updateBuffTerminalPrompt(camera, interactPressed);
    }

    /**
     * Locked until levelFullyRevealed (all enemies dead). interactPressed is
     * drained once in LevelSession.update() and handed to every _update*Prompt
     * method here, so they don't race each other for the same press.
     * @param {Camera} camera
     * @param {boolean} interactPressed
     * @param {boolean} levelFullyRevealed
     */
    _updatePortalPrompt(camera, interactPressed, levelFullyRevealed) {
        if (!this.portal) return;

        this.portal.active = levelFullyRevealed;

        // Same reveal radius as the player's own live-glow/permanent trail -
        // walking within it reveals the portal same as it would any other
        // ground, even before the level's full-reveal (which also sets
        // this, see markPortalRevealed()) guarantees it later.
        if (!this.portal.revealed) {
            const dist = Math.hypot(this.player.centerX - this.portal.centerX, this.player.visualCenterY - this.portal.centerY);
            if (dist <= this._revealRadius) this.portal.revealed = true;
        }

        const inRange = this.portal.isOpen && !this.player.dead
            && Math.hypot(this.player.centerX - this.portal.centerX, this.player.centerY - this.portal.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.interactPromptEl.hidden = !inRange;
        if (inRange) {
            // Screen position must match LevelSession.render()'s
            // ctx.scale(zoom)+translate exactly, or the prompt drifts from
            // the portal it's pointing at if camera.zoom (Camera.js) is
            // ever anything other than 1.
            this.interactPromptEl.style.left = `${(this.portal.centerX - camera.x) * camera.zoom}px`;
            this.interactPromptEl.style.top = `${(this.portal.y - camera.y) * camera.zoom}px`;
        }

        if (inRange && interactPressed) {
            this.game.sound.playSfx('portal');
            this._onComplete();
        }
    }

    /**
     * Post-boss Merchant (see onBossDefeated()) - null until every one of the
     * boss's dropped Tokens is collected, same null-tolerant/in-range/[E]
     * pattern as _updatePortalPrompt() above.
     * @param {Camera} camera
     * @param {boolean} interactPressed
     */
    _updateMerchantPrompt(camera, interactPressed) {
        if (!this.merchant) return;

        const inRange = !this.player.dead
            && Math.hypot(this.player.centerX - this.merchant.centerX, this.player.centerY - this.merchant.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.merchantPromptEl.hidden = !inRange;
        if (inRange) {
            // Same zoom correction as the portal prompt above.
            this.merchantPromptEl.style.left = `${(this.merchant.centerX - camera.x) * camera.zoom}px`;
            this.merchantPromptEl.style.top = `${(this.merchant.y - camera.y) * camera.zoom}px`;
        }

        // Hidden explicitly here, not left to the next frame's inRange
        // check above - MerchantDialogue freezes LevelSession's update loop
        // (see its own isOpen early-return), so this method stops running
        // the instant the dialogue opens and would otherwise never hide it.
        if (inRange && interactPressed) {
            this.merchantPromptEl.hidden = true;
            this._openMerchantDialogue();
        }
    }

    /**
     * Miniboss Tokens (1) can never afford an ability (ABILITY_TOKEN_COST is
     * 2), so that tier's Merchant stays the plain flavor tease with no shop.
     * A Templateboss/Chapterboss Merchant (tokenReward >= SHOP_MIN_TOKEN_REWARD)
     * instead greets the player by the boss they just killed and attaches the
     * ability shop - MerchantDialogue only opens it once that greeting
     * finishes typing (its own advance()).
     */
    _openMerchantDialogue() {
        if (this._tokenReward < SHOP_MIN_TOKEN_REWARD) {
            this.merchantDialogue.open(MINIBOSS_DIALOGUE_TEXT);
            return;
        }
        this.merchantDialogue.open(`You defeated ${this._bossName}. Let's see what I have for you.`, {
            options: ABILITY_SHOP_OPTIONS,
            getTokens: () => this.game.tokens,
            isOwned: (id) => this.game.abilities.has(id),
            buy: (id, cost) => this._buyAbility(id, cost),
        });
    }

    /**
     * @param {string} id - One of ABILITY_SHOP_OPTIONS's ids.
     * @param {number} cost - That option's Token cost.
     * @returns {boolean} Whether the purchase went through.
     */
    _buyAbility(id, cost) {
        if (this.game.abilities.has(id) || this.game.tokens < cost) return false;
        this.game.tokens -= cost;
        this.game.abilities.add(id);
        this.game.saveProgress();
        this.player.unlockAbility(id);
        this.game.sound.playSfx('power-up');
        return true;
    }

    /**
     * Secret Room entrance (Lvl 5 Gimmick, docs/GDD/02_game-structure.md 2.5)
     * - [E] in range pays SECRET_DOOR_PRISMA_COST and starts the door
     * opening; same reveal-before-color treatment as _updateTrapdoorTrigger() above.
     * @param {Camera} camera
     * @param {boolean} interactPressed
     */
    _updateSecretDoorPrompt(camera, interactPressed) {
        if (!this.secretDoor) return;

        if (!this.secretDoor.revealed) {
            const dist = Math.hypot(this.player.centerX - this.secretDoor.centerX, this.player.visualCenterY - this.secretDoor.centerY);
            if (dist <= this._revealRadius) this.secretDoor.revealed = true;
        }

        const inRange = !this.secretDoor.isOpen && !this.player.dead
            && Math.hypot(this.player.centerX - this.secretDoor.centerX, this.player.centerY - this.secretDoor.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.secretDoorPromptEl.hidden = !inRange;
        if (inRange) {
            this.secretDoorPromptEl.style.left = `${(this.secretDoor.centerX - camera.x) * camera.zoom}px`;
            this.secretDoorPromptEl.style.top = `${(this.secretDoor.y - camera.y) * camera.zoom}px`;
        }

        if (inRange && interactPressed) this._triggerSecretDoor();
    }

    _triggerSecretDoor() {
        if (this.player.consumeShield(SECRET_DOOR_PRISMA_COST)) {
            this.secretDoor.trigger();
            this.game.sound.playSfx('secret-door');
        } else {
            this.damageNumbers.spawnStatus(this.player.centerX, this.player.visualTopY, 'Not enough Prisma');
        }
    }

    /**
     * Buff Terminal (Lvl 5 Gimmick) - only interactable once the SecretDoor
     * is open (or there simply isn't one placed) and hasn't already been
     * used; pushes BuffState (see StateMachine.js's push()) rather than
     * granting anything directly.
     * @param {Camera} camera
     * @param {boolean} interactPressed
     */
    _updateBuffTerminalPrompt(camera, interactPressed) {
        if (!this.buffTerminal) return;

        const doorOpen = !this.secretDoor || this.secretDoor.isOpen;
        const inRange = doorOpen && !this.buffTerminal.used && !this.player.dead
            && Math.hypot(this.player.centerX - this.buffTerminal.centerX, this.player.centerY - this.buffTerminal.centerY) <= PORTAL_INTERACT_RANGE_PX;

        this.buffTerminalPromptEl.hidden = !inRange;
        if (inRange) {
            this.buffTerminalPromptEl.style.left = `${(this.buffTerminal.centerX - camera.x) * camera.zoom}px`;
            this.buffTerminalPromptEl.style.top = `${(this.buffTerminal.y - camera.y) * camera.zoom}px`;
        }

        // Hidden explicitly here, same reasoning as _updateMerchantPrompt()
        // above - pushing BuffState stops this session from getting any
        // more update() calls at all while it's on top, so nothing would
        // otherwise ever hide this again.
        if (inRange && interactPressed) {
            this.buffTerminalPromptEl.hidden = true;
            this.game.stateMachine.push('buff', { player: this.player, buffTerminal: this.buffTerminal, levelNumber: this._levelNumber });
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this.portal?.render(ctx);
        this.merchant?.render(ctx);
        for (const token of this.tokens) token.render(ctx);
        this.trapdoor?.render(ctx);
        this.secretDoor?.render(ctx);
        this.buffTerminal?.render(ctx);
    }
}
