// onComplete is a callback rather than this class calling stateMachine.change('worldmap') itself -
// finishing the level stays LevelSession's own concern.

import { PortalInteractable } from './interactables/portal-interactable.js';
import { MerchantInteractable } from './interactables/merchant-interactable.js';
import { TrapdoorInteractable } from './interactables/trapdoor-interactable.js';
import { SecretDoorInteractable } from './interactables/secret-door-interactable.js';
import { BuffTerminalInteractable } from './interactables/buff-terminal-interactable.js';

/** Portal/Merchant/Trapdoor/SecretDoor/BuffTerminal - every level object the player interacts with via proximity/[E]. */
export class Interactables {
    /**
     * Constructs each interactable type, sharing the player/collision/damage-number wiring.
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its object markers.
     * @param {Player} player - For proximity/range checks.
     * @param {object} options - Construction settings.
     * @param {string} options.greyFilterCSS - ColorZone.greyFilterCSS, shared visual treatment for unrevealed entities.
     * @param {number} options.revealRadius - LevelSession's PLAYER_REVEAL_RADIUS.
     * @param {DamageNumbers} options.damageNumbers - For "not enough Prisma" status text.
     * @param {Collision} options.collision - For the boss-drop Tokens' fall onto the floor.
     * @param {number} options.levelNumber - This level's number, to key `Game.claimedBossTokens`/`Game.claimedSecretRoomBuffs`.
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
     * Delegates to SecretDoorInteractable.blockPlayer().
     */
    blockSecretDoor() {
        this.secretDoor.blockPlayer(this.player);
    }

    /**
     * Updates every interactable type.
     * @param {number} dt - Elapsed time in seconds.
     */
    updateEntities(dt) {
        this.portal.update(dt);
        this.trapdoor.update(dt);
        this.secretDoor.update(dt);
        this.merchant.update(dt);
    }

    /**
     * Delegates to MerchantInteractable.onBossDefeated().
     * @param {number} centerX - Boss's centerX at time of death.
     * @param {number} centerY - Boss's centerY at time of death.
     * @param {string} bossName - Boss.name, shown in the Templateboss+ greeting.
     * @param {number} tokenReward - Boss.tokenReward, how many Tokens to drop.
     */
    onBossDefeated(centerX, centerY, bossName, tokenReward) {
        this.merchant.onBossDefeated(centerX, centerY, bossName, tokenReward);
    }

    /**
     * Delegates to PortalInteractable.markRevealed().
     */
    markPortalRevealed() {
        this.portal.markRevealed();
    }

    /**
     * Updates each interactable type's proximity prompt.
     * @param {Camera} camera - Camera to position prompts against.
     * @param {boolean} interactPressed - Whether Interact was pressed this frame.
     * @param {boolean} levelFullyRevealed - Whether every enemy in the level is dead.
     */
    updatePrompts(camera, interactPressed, levelFullyRevealed) {
        this.portal.updatePrompt(camera, interactPressed, levelFullyRevealed);
        this.merchant.updatePrompt(camera, interactPressed);
        this.secretDoor.updatePrompt(camera, interactPressed);
        this.buffTerminal.updatePrompt(camera, interactPressed);
    }

    /**
     * Draws every interactable type.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.portal.render(ctx);
        this.merchant.render(ctx);
        this.trapdoor.render(ctx);
        this.secretDoor.render(ctx);
        this.buffTerminal.render(ctx);
    }
}
