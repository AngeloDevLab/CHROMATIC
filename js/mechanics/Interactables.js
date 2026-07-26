import { Portal } from '../entities/Portal.js';
import { Merchant } from '../entities/Merchant.js';
import { Trapdoor } from '../entities/Trapdoor.js';
import { SecretDoor, SECRET_DOOR_PRISMA_COST } from '../entities/SecretDoor.js';
import { BuffTerminal } from '../entities/BuffTerminal.js';
import { MerchantDialogue } from '../ui/MerchantDialogue.js';

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

// Pre-Lvl-6 teaser line only (05_enemies-bosses.md 6.2's real Merchant -
// shop, Token spend - only appears after the Templateboss) - placed early to
// tease the Lvl 6 fight by name. No gating on the Miniboss being defeated
// (unlike the real post-boss Merchant appearance) since this is just flavor,
// not a reward.
const MERCHANT_TEASER_TEXT = "Heh, another wanderer with color to spare. Slay the Wraith that haunts the Grey City, and we'll talk business.";

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
     * @param {() => void} options.onComplete - Called when the player exits through the completed level's portal.
     */
    constructor(game, level, player, { greyFilterCSS, revealRadius, damageNumbers, onComplete }) {
        this.game = game;
        this.player = player;
        this._revealRadius = revealRadius;
        this.damageNumbers = damageNumbers;
        this._onComplete = onComplete;

        this._spawnPortal(level, greyFilterCSS);
        this._spawnMerchant(level);
        this._spawnTrapdoor(level, greyFilterCSS);
        this._spawnSecretDoor(level, greyFilterCSS);
        this._spawnBuffTerminal(level);
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
        this.interactPromptEl = document.createElement('div');
        this.interactPromptEl.className = 'interact-prompt';
        this.interactPromptEl.textContent = '[E] Exit Level';
        this.interactPromptEl.hidden = true;
        this.game.overlay.appendChild(this.interactPromptEl);
    }

    /**
     * Pre-Lvl-6 Merchant teaser (MERCHANT_TEASER_TEXT above) - not every
     * level has one placed in Tiled, same null-tolerant pattern as the
     * Portal above. No sprite yet (Merchant.js's render() is a no-op stub),
     * so nothing is visible until real art exists - only the trigger
     * zone/dialogue work already.
     * @param {Level} level
     */
    _spawnMerchant(level) {
        const spawn = level.getObjectsByType('Merchant')[0];
        this.merchant = spawn ? new Merchant(spawn.x, spawn.y) : null;
        this.merchantDialogue = new MerchantDialogue(this.game.overlay);
        this.merchantPromptEl = document.createElement('div');
        this.merchantPromptEl.className = 'interact-prompt';
        this.merchantPromptEl.textContent = '[E] Talk';
        this.merchantPromptEl.hidden = true;
        this.game.overlay.appendChild(this.merchantPromptEl);
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
        this.secretDoorPromptEl = document.createElement('div');
        this.secretDoorPromptEl.className = 'interact-prompt';
        this.secretDoorPromptEl.textContent = `[E] Open (${SECRET_DOOR_PRISMA_COST} Prisma)`;
        this.secretDoorPromptEl.hidden = true;
        this.game.overlay.appendChild(this.secretDoorPromptEl);
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
        this.buffTerminalPromptEl = document.createElement('div');
        this.buffTerminalPromptEl.className = 'interact-prompt';
        this.buffTerminalPromptEl.textContent = '[E] Choose Buff';
        this.buffTerminalPromptEl.hidden = true;
        this.game.overlay.appendChild(this.buffTerminalPromptEl);
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

        if (inRange && interactPressed) this._onComplete();
    }

    /**
     * Pre-Lvl-6 Merchant teaser (MERCHANT_TEASER_TEXT above) - not gated on
     * anything (no boss to defeat yet at Lvl 3), just an [E]-in-range NPC
     * dialogue, same range/prompt pattern as _updatePortalPrompt() above.
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

        if (inRange && interactPressed) this.merchantDialogue.open(MERCHANT_TEASER_TEXT);
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

        if (inRange && interactPressed) {
            this.game.stateMachine.push('buff', { player: this.player, buffTerminal: this.buffTerminal });
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this.portal?.render(ctx);
        this.merchant?.render(ctx);
        this.trapdoor?.render(ctx);
        this.secretDoor?.render(ctx);
        this.buffTerminal?.render(ctx);
    }
}
