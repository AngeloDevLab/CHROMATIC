import { PortalInteractable } from './interactables/PortalInteractable.js';
import { MerchantInteractable } from './interactables/MerchantInteractable.js';
import { TrapdoorInteractable } from './interactables/TrapdoorInteractable.js';
import { SecretDoorInteractable } from './interactables/SecretDoorInteractable.js';
import { BuffTerminalInteractable } from './interactables/BuffTerminalInteractable.js';

// Portal/Merchant/Trapdoor/SecretDoor/BuffTerminal - every level object the
// player interacts with via proximity/[E]. Thin orchestrator/facade only:
// each type's actual spawn/update/prompt/render/destroy logic lives in its
// own class under js/mechanics/interactables/, the same "several small
// classes sharing a common shape" pattern EnemyFactory.js/Player.js's
// composed sub-objects already use elsewhere in this codebase - a new
// interactable type later is purely additive (one new file plus one line
// here), not another edit to a single do-everything class. `onComplete` is a
// callback rather than this class calling stateMachine.change('worldmap')
// itself - finishing the level is LevelSession's own concern (levelNumber,
// completedLevels), not this class's.
export class Interactables {
    /**
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its object markers.
     * @param {Player} player - For proximity/range checks.
     * @param {object} options
     * @param {string} options.greyFilterCSS - ColorZone.greyFilterCSS, shared visual treatment for unrevealed entities.
     * @param {number} options.revealRadius - LevelSession's PLAYER_REVEAL_RADIUS, reused so "revealed" tracks the same distance as the color trail.
     * @param {DamageNumbers} options.damageNumbers - For "not enough Prisma" status text.
     * @param {Collision} options.collision - For the boss-drop Tokens' fall onto the floor.
     * @param {number} options.levelNumber - This level's number, to key `Game.claimedBossTokens`/`Game.claimedSecretRoomBuffs` so a boss's Token reward and a Secret Room's buff are only ever granted once per level.
     * @param {() => void} options.onComplete - Called when the player exits through the completed level's portal.
     */
    constructor(game, level, player, { greyFilterCSS, revealRadius, damageNumbers, collision, levelNumber, onComplete }) {
        this.player = player;

        this.portal = new PortalInteractable(game, level, player, { greyFilterCSS, revealRadius, onComplete });
        this.trapdoor = new TrapdoorInteractable(game, level, player, { greyFilterCSS, revealRadius });
        this.secretDoor = new SecretDoorInteractable(game, level, player, { greyFilterCSS, revealRadius, damageNumbers });
        this.buffTerminal = new BuffTerminalInteractable(game, level, player, { levelNumber, isDoorOpen: () => this.secretDoor.isOpen });
        this.merchant = new MerchantInteractable(game, level, player, { collision, levelNumber });
    }

    /**
     * LevelSession reads this directly (its own dialogue-frozen update
     * branch) rather than reaching through interactables.merchant.dialogue.
     * @returns {MerchantDialogue}
     */
    get merchantDialogue() {
        return this.merchant.dialogue;
    }

    /**
     * Tears down every prompt element/dialogue every interactable type added to the DOM.
     */
    destroy() {
        this.portal.destroy();
        this.merchant.destroy();
        this.secretDoor.destroy();
        this.buffTerminal.destroy();
    }

    /**
     * @see SecretDoorInteractable.blockPlayer
     */
    blockSecretDoor() {
        this.secretDoor.blockPlayer(this.player);
    }

    /**
     * @param {number} dt
     */
    updateEntities(dt) {
        this.portal.update(dt);
        this.trapdoor.update(dt);
        this.secretDoor.update(dt);
        this.merchant.update(dt);
    }

    /**
     * @see MerchantInteractable.onBossDefeated
     * @param {number} centerX
     * @param {number} centerY
     * @param {string} bossName
     * @param {number} tokenReward
     */
    onBossDefeated(centerX, centerY, bossName, tokenReward) {
        this.merchant.onBossDefeated(centerX, centerY, bossName, tokenReward);
    }

    /**
     * @see PortalInteractable.markRevealed
     */
    markPortalRevealed() {
        this.portal.markRevealed();
    }

    /**
     * @param {Camera} camera
     * @param {boolean} interactPressed
     * @param {boolean} levelFullyRevealed
     */
    updatePrompts(camera, interactPressed, levelFullyRevealed) {
        this.portal.updatePrompt(camera, interactPressed, levelFullyRevealed);
        this.merchant.updatePrompt(camera, interactPressed);
        this.secretDoor.updatePrompt(camera, interactPressed);
        this.buffTerminal.updatePrompt(camera, interactPressed);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        this.portal.render(ctx);
        this.merchant.render(ctx);
        this.trapdoor.render(ctx);
        this.secretDoor.render(ctx);
        this.buffTerminal.render(ctx);
    }
}
