import { Merchant } from '../../entities/Merchant.js';
import { Token } from '../../entities/Token.js';
import { MerchantDialogue } from '../../ui/MerchantDialogue.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './InteractPrompt.js';

/**
 * Horizontal spacing between multiple Tokens dropped by a boss.
 */
const TOKEN_DROP_OFFSET_PX = 28;

/**
 * Dialogue text shown for a Miniboss-tier Merchant (pure flavor, no shop).
 */
const MINIBOSS_DIALOGUE_TEXT = "Heh, another wanderer with color to spare. Slay the Wraith that haunts the Grey City, and we'll talk business.";

/**
 * 03_mechanics.md 4.4: "An ability costs 2 Tokens."
 */
const ABILITY_TOKEN_COST = 2;

/**
 * Minimum boss Token reward for the ability shop to open.
 */
const SHOP_MIN_TOKEN_REWARD = ABILITY_TOKEN_COST;

/**
 * 03_mechanics.md 4.4: "Double Jump and Dash are guaranteed first options
 * at the Prologue Merchant."
 */
const ABILITY_SHOP_OPTIONS = [
    { id: 'doubleJump', label: 'Double Jump', description: 'Press Jump twice.', cost: ABILITY_TOKEN_COST },
    { id: 'dash', label: 'Dash', description: 'Press A or D twice quickly to dash in that direction.', cost: ABILITY_TOKEN_COST },
];

// Post-boss Merchant (05_enemies-bosses.md 6.2). Doesn't spawn until the
// boss is dead and every dropped Token is collected.
//
// updatePrompt() hides its prompt immediately when [E] opens the dialogue,
// since opening MerchantDialogue freezes LevelSession's update loop and
// nothing else would run to hide it afterward.
//
// onBossDefeated() is guarded by Game.claimedBossTokens so replaying a
// level can't drop the same boss's Tokens twice; the reward is marked
// claimed as soon as the boss dies, not once its Tokens are picked up.
export class MerchantInteractable {
    /**
     * @param {Game} game
     * @param {Level} level
     * @param {Player} player
     * @param {object} options
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
     * Spreads `count` Tokens evenly around centerX, TOKEN_DROP_OFFSET_PX apart.
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
     * Updates dropped Tokens until collected, then spawns the Merchant once all are gone.
     * @param {number} dt
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
     * No-op until the Merchant has spawned (all Tokens collected).
     * @param {Camera} camera
     * @param {boolean} interactPressed
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
        if (this._tokenReward < SHOP_MIN_TOKEN_REWARD) {
            this.dialogue.open(MINIBOSS_DIALOGUE_TEXT);
            return;
        }
        this.dialogue.open(`You defeated ${this._bossName}. Let's see what I have for you.`, {
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
     * @param {CanvasRenderingContext2D} ctx
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
