import { Merchant } from '../../entities/Merchant.js';
import { Token } from '../../entities/Token.js';
import { MerchantDialogue } from '../../ui/MerchantDialogue.js';
import { createInteractPrompt, positionInteractPrompt, INTERACT_RANGE_PX } from './InteractPrompt.js';

/**
 * How far apart multi-Token boss drops land - a Templateboss/Chapterboss's
 * 2 Tokens spawn side by side instead of stacked on the exact same point,
 * so they read as two distinct pickups at a glance.
 */
const TOKEN_DROP_OFFSET_PX = 28;

/**
 * Shown for a Miniboss-tier Merchant (1 Token, never enough to afford an
 * ability alone - see ABILITY_TOKEN_COST below) - pure flavor tease, no
 * shop attached, just points at the Lvl 6 fight by name so the player has a
 * reason to keep going (session decision, see project_refactor-roadmap memory).
 */
const MINIBOSS_DIALOGUE_TEXT = "Heh, another wanderer with color to spare. Slay the Wraith that haunts the Grey City, and we'll talk business.";

/**
 * 03_mechanics.md 4.4: "An ability costs 2 Tokens." A Templateboss/
 * Chapterboss Merchant (tokenReward >= this) is the only one that can ever
 * afford one, so that's also the gate on whether the shop opens at all -
 * see onBossDefeated()/_openDialogue() below.
 */
const ABILITY_TOKEN_COST = 2;
const SHOP_MIN_TOKEN_REWARD = ABILITY_TOKEN_COST;

/**
 * 03_mechanics.md 4.4: "Double Jump and Dash are guaranteed first options
 * at the Prologue Merchant" - the only two abilities that exist yet, so
 * this is every Prologue shop's full, fixed option list.
 */
const ABILITY_SHOP_OPTIONS = [
    { id: 'doubleJump', label: 'Double Jump', description: 'Press Jump twice.', cost: ABILITY_TOKEN_COST },
    { id: 'dash', label: 'Dash', description: 'Press A or D twice quickly to dash in that direction.', cost: ABILITY_TOKEN_COST },
];

// Real post-boss Merchant (05_enemies-bosses.md 6.2: "After a Templateboss/
// Chapterboss, the Merchant appears in the same room" - applied to the
// Miniboss here too, session decision). Doesn't spawn at all until the boss
// is dead and every dropped Token is collected - this._merchant stays null
// until then, same null-tolerant pattern as the other interactable types.
export class MerchantInteractable {
    /**
     * @param {Game} game
     * @param {Level} level
     * @param {Player} player
     * @param {object} options
     * @param {Collision} options.collision - For the boss-drop Tokens' fall onto the floor.
     * @param {number} options.levelNumber - To key `Game.claimedBossTokens` (onBossDefeated()) so a boss's Token reward is only ever granted once per level.
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
     * Called once by LevelSession when this level's boss dies (its death
     * animation has finished) - drops tokenReward separate Tokens at the
     * boss's position for the player to walk over, and remembers the boss's
     * name (Boss.js) for _openDialogue() once they're all collected. No-op
     * if this level has no Merchant object placed in Tiled, this has already
     * fired once this session, or this level's boss reward was already
     * claimed on an earlier visit (Game.claimedBossTokens - replaying a
     * level, e.g. via the Worldmap or by leaving through Pause instead of the
     * exit portal, must not let the same boss drop fresh Tokens
     * indefinitely). Marks the reward claimed and saves immediately, rather
     * than waiting for the Tokens to actually be picked up - once the boss
     * is dead the reward is committed.
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
     * Null until every one of the boss's dropped Tokens is collected, same
     * null-tolerant/in-range/[E] pattern as the other interactable types.
     * @param {Camera} camera
     * @param {boolean} interactPressed
     */
    updatePrompt(camera, interactPressed) {
        if (!this._merchant) return;

        const inRange = !this.player.dead
            && Math.hypot(this.player.centerX - this._merchant.centerX, this.player.centerY - this._merchant.centerY) <= INTERACT_RANGE_PX;

        this._promptEl.hidden = !inRange;
        if (inRange) positionInteractPrompt(this._promptEl, camera, this._merchant.centerX, this._merchant.y);

        // Hidden explicitly here, not left to the next frame's inRange check
        // above - MerchantDialogue freezes LevelSession's update loop (see
        // its own isOpen early-return), so this method stops running the
        // instant the dialogue opens and would otherwise never hide it.
        if (inRange && interactPressed) {
            this._promptEl.hidden = true;
            this._openDialogue();
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
