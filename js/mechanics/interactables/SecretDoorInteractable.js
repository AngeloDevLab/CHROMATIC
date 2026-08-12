import { SecretDoor, SECRET_DOOR_PRISMA_COST } from '../../entities/SecretDoor.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './InteractPrompt.js';

// Secret Room (Lvl 5 Gimmick, docs/GDD/02_game-structure.md 2.5) - uses the
// same greyFilterCSS/revealed treatment as Portal/Trapdoor.
export class SecretDoorInteractable {
    /**
     * @param {Game} game
     * @param {Level} level
     * @param {Player} player
     * @param {object} options
     * @param {string} options.greyFilterCSS
     * @param {number} options.revealRadius
     * @param {DamageNumbers} options.damageNumbers - For "not enough Prisma" status text.
     */
    constructor(game, level, player, { greyFilterCSS, revealRadius, damageNumbers }) {
        this.game = game;
        this.player = player;
        this._revealRadius = revealRadius;
        this._damageNumbers = damageNumbers;
        this._secretDoor = this._buildSecretDoor(game, level, greyFilterCSS);
        this._promptEl = createInteractPrompt(game, `[E] Open (${SECRET_DOOR_PRISMA_COST} Prisma)`);
    }

    /**
     * @param {Game} game
     * @param {Level} level
     * @param {string} greyFilterCSS
     * @returns {SecretDoor|null}
     */
    _buildSecretDoor(game, level, greyFilterCSS) {
        const spawn = level.getObjectsByType('SecretDoor')[0];
        if (!spawn) return null;
        return new SecretDoor(spawn.x, spawn.y, spawn.width, spawn.height, {
            closed: game.assets.getImage('secretdoor-closed'),
            open: game.assets.getImage('secretdoor-open'),
            opens: game.assets.getImage('secretdoor-opens'),
            opensFrameCount: 7,
            opensFps: 12,
        }, greyFilterCSS);
    }

    /**
     * True if there's no door placed in this level, or the door has finished opening.
     * @returns {boolean}
     */
    get isOpen() {
        return !this._secretDoor || this._secretDoor.isOpen;
    }

    /**
     * AABB push-out along whichever axis has the smaller overlap. No-op if there's no SecretDoor, or it's already open.
     * @param {Player} player
     */
    blockPlayer(player) {
        const door = this._secretDoor;
        if (!door || door.isOpen) return;
        const overlapping = player.x < door.x + door.width && player.x + player.width > door.x
            && player.y < door.y + door.height && player.y + player.height > door.y;
        if (!overlapping) return;

        this._pushOutOfDoor(door, player);
    }

    /**
     * @param {SecretDoor} door
     * @param {Player} player
     */
    _pushOutOfDoor(door, player) {
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
    update(dt) {
        this._secretDoor?.update(dt);
    }

    /**
     * [E] in range pays SECRET_DOOR_PRISMA_COST and starts the door opening.
     * @param {Camera} camera
     * @param {boolean} interactPressed
     */
    updatePrompt(camera, interactPressed) {
        if (!this._secretDoor) return;

        if (!this._secretDoor.revealed) {
            const dist = Math.hypot(this.player.centerX - this._secretDoor.centerX, this.player.visualCenterY - this._secretDoor.centerY);
            if (dist <= this._revealRadius) this._secretDoor.revealed = true;
        }

        const inRange = !this._secretDoor.isOpen && !this.player.dead
            && Math.hypot(this.player.centerX - this._secretDoor.centerX, this.player.centerY - this._secretDoor.centerY) <= INTERACT_RANGE_PX;

        this._promptEl.hidden = !inRange;
        if (inRange) positionInteractPrompt(this._promptEl, camera, this._secretDoor.centerX, this._secretDoor.y);

        if (inRange && interactPressed) this._trigger();
    }

    /**
     * Spends the Prisma cost to open the door, or shows a status message if
     * the player can't afford it.
     */
    _trigger() {
        if (this.player.consumeShield(SECRET_DOOR_PRISMA_COST)) {
            this._secretDoor.trigger();
            this.game.sound.playSfx('secret-door');
        } else {
            this._damageNumbers.spawnStatus(this.player.centerX, this.player.visualTopY, 'Not enough Prisma');
        }
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this._secretDoor?.render(ctx);
    }

    /**
     * Tears down the prompt element this class added to the DOM.
     */
    destroy() {
        this._promptEl?.remove();
    }
}
