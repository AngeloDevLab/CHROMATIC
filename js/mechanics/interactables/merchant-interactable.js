// onBossDefeated() is guarded by Game.claimedBossTokens so replaying a level can't drop the same
// boss's Tokens twice.

import { Merchant } from '../../entities/merchant.js';
import { Token } from '../../entities/token.js';
import { MerchantDialogue } from '../../ui/merchant-dialogue.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './interact-prompt.js';

const token_drop_offset_px = 28;

/**
 * Dialogue text shown for a Miniboss-tier Merchant (pure flavor, no shop).
 */
const miniboss_dialogue_text = "Heh, another wanderer with color to spare. Slay the Wraith that haunts the Grey City, and we'll talk business.";

const ability_token_cost = 2;

/**
 * Minimum boss Token reward for the ability shop to open.
 */
const shop_min_token_reward = ability_token_cost;

const ability_shop_options = [
    { id: 'doubleJump', label: 'Double Jump', description: 'Press Jump twice.', cost: ability_token_cost },
    { id: 'dash', label: 'Dash', description: 'Press A or D twice quickly to dash in that direction.', cost: ability_token_cost },
];

/** Drops the boss's Token reward, then spawns the Merchant and its shop dialogue once collected. */
export class MerchantInteractable {
    /**
     * Finds the level's Merchant marker and builds its dialogue/prompt.
     * @param {Game} game - Owning Game instance.
     * @param {Level} level - The loaded level, for its Merchant marker.
     * @param {Player} player - For proximity/range checks.
     * @param {object} options - Construction settings.
     * @param {Collision} options.collision - For the boss-drop Tokens' fall onto the floor.
     * @param {number} options.levelNumber - To key `Game.claimedBossTokens` in onBossDefeated().
     */
    constructor(game, level, player, { collision, levelNumber }) {
        this.game = game;
        this.player = player;
        this._collision = collision;
        this._levelNumber = levelNumber;
        this._merchantSpawn = level.getObjectsByType('Merchant')[0] ?? null;
        this._merchant = null;
        this._tokens = [];
        this.dialogue = new MerchantDialogue(game.overlay);
        this._promptEl = createInteractPrompt(game, '[E] Talk');
    }

    /**
     * Drops the boss's Token reward and records its name for the post-fight shop, once per boss per level.
     * @param {number} centerX - Boss's centerX at time of death.
     * @param {number} centerY - Boss's centerY at time of death.
     * @param {string} bossName - Boss.name, shown in the Templateboss+ greeting.
     * @param {number} tokenReward - Boss.tokenReward, how many Tokens to drop.
     */
    onBossDefeated(centerX, centerY, bossName, tokenReward) {
        if (!this._merchantSpawn || this._tokens.length || this._merchant) return;
        if (this.game.claimedBossTokens.has(this._levelNumber)) return;
        this.game.claimedBossTokens.add(this._levelNumber);
        this.game.saveProgress();
        this._bossName = bossName;
        this._tokenReward = tokenReward;
        this._tokens = this._buildTokenDrop(centerX, centerY, tokenReward);
    }

    /**
     * Spreads `count` Tokens evenly around centerX, token_drop_offset_px apart.
     * @param {number} centerX - World X to center the Token spread on.
     * @param {number} centerY - World Y to drop the Tokens at.
     * @param {number} count - How many Tokens to spawn.
     * @returns {Token[]}
     */
    _buildTokenDrop(centerX, centerY, count) {
        const spread = (count - 1) * token_drop_offset_px;
        return Array.from({ length: count }, (_, i) =>
            new Token(centerX - spread / 2 + i * token_drop_offset_px, centerY, this.game.assets.getImage('token')));
    }

    /**
     * Updates dropped Tokens until collected, then spawns the Merchant once all are gone.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (!this._tokens.length) return;
        for (const token of this._tokens) token.update(dt, this._collision);
        this._tokens = this._tokens.filter((token) => !this._collectToken(token));
        if (!this._tokens.length && !this._merchant) {
            this._merchant = new Merchant(this._merchantSpawn.x, this._merchantSpawn.y, this.game.assets.getImage('merchant'));
        }
    }

    /**
     * Collects a Token on player overlap, awarding it and playing feedback.
     * @param {Token} token - Token to check for pickup.
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
     * Checks whether an entity's bounds overlap the player's.
     * @param {Entity} entity - Entity to check against the player's bounds.
     * @returns {boolean}
     */
    _overlapsPlayer(entity) {
        const player = this.player;
        return player.x < entity.x + entity.width && player.x + player.width > entity.x
            && player.y < entity.y + entity.height && player.y + player.height > entity.y;
    }

    /**
     * No-op until the Merchant has spawned (all Tokens collected).
     * @param {Camera} camera - Camera to position the prompt against.
     * @param {boolean} interactPressed - Whether Interact was pressed this frame.
     */
    updatePrompt(camera, interactPressed) {
        if (!this._merchant) return;

        const inRange = !this.player.dead
            && Math.hypot(this.player.centerX - this._merchant.centerX, this.player.centerY - this._merchant.centerY) <= INTERACT_RANGE_PX;

        this._promptEl.hidden = !inRange;
        if (inRange) positionInteractPrompt(this._promptEl, camera, this._merchant.centerX, this._merchant.y);

        if (inRange && interactPressed) {
            this._promptEl.hidden = true;
            this._openDialogue();
        }
    }

    /**
     * Opens the post-boss dialogue: flavor-only for a Miniboss, or the ability shop for a Templateboss/Chapterboss.
     */
    _openDialogue() {
        if (this._tokenReward < shop_min_token_reward) {
            this.dialogue.open(miniboss_dialogue_text);
            return;
        }
        this.dialogue.open(`You defeated ${this._bossName}. Let's see what I have for you.`, {
            options: ability_shop_options,
            getTokens: () => this.game.tokens,
            isOwned: (id) => this.game.abilities.has(id),
            buy: (id, cost) => this._buyAbility(id, cost),
        });
    }

    /**
     * Spends Tokens to unlock an ability, if affordable and not already owned.
     * @param {string} id - One of ability_shop_options's ids.
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
     * Draws the Merchant and any still-uncollected Tokens.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this._merchant?.render(ctx);
        for (const token of this._tokens) token.render(ctx);
    }

    /**
     * Tears down the prompt element and dialogue this class added to the DOM.
     */
    destroy() {
        this._promptEl?.remove();
        this.dialogue?.close();
    }
}
