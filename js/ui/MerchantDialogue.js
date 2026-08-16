import { Panel } from './Panel.js';

/**
 * Faster than CutsceneState's 10 chars/sec.
 */
const CHARS_PER_SECOND = 30;
const TITLE = 'Unknown Merchant';
const PORTRAIT_SRC = 'assets/images/objects/merchant-dialog-portrait.png';

// Single-panel typewriter dialogue (Miniboss tier) that can optionally carry
// an ability shop (Templateboss/Chapterboss tier). Reuses Panel.js for the
// backdrop/box chrome; drives its own typewriter reveal on top, the same way
// CutsceneState.js does for cutscene text.
export class MerchantDialogue {
    /**
     * Sets up empty dialogue/shop state; call open() to actually show it.
     * @param {HTMLElement} overlayRoot - Element to mount the panel into.
     */
    constructor(overlayRoot) {
        this.panel = new Panel(overlayRoot);
        this.isOpen = false;
        this._textEl = null;
        this._shopEl = null;
        this._tokens = null;
        this._revealedCount = 0;
        this._revealTimer = 0;
        this._shop = null;
        this._shopRevealed = false;
    }

    /**
     * Opens the dialogue panel and starts its typewriter reveal. onClose is
     * wired directly (not routed through this class's own close()) so
     * backdrop-click/×/Escape all still clear `isOpen`.
     * @param {string} text - Dialogue line to reveal.
     * @param {object} [shop] - When given, its option grid is revealed in the
     *   same panel once `text` finishes typing (see _revealShopIfNeeded()).
     * @param {{id: string, label: string, description: string, cost: number}[]} shop.options - Purchasable ability options.
     * @param {() => number} shop.getTokens - Reads the player's current Token count.
     * @param {(id: string) => boolean} shop.isOwned - Whether an option is already unlocked.
     * @param {(id: string, cost: number) => boolean} shop.buy - Attempts a purchase, returns success.
     */
    open(text, shop = null) {
        this.isOpen = true;
        this._tokens = text.split('');
        this._revealedCount = 0;
        this._revealTimer = 0;
        this._shop = shop;
        this._shopRevealed = false;

        this.panel.open('', this._buildBodyHTML(), {
            dismissible: true,
            onClose: () => { this.isOpen = false; },
            onMount: (root) => this._onMount(root, text),
        });
    }

    /**
     * Locks the panel's height and wires shop buttons once mounted.
     * @param {HTMLElement} root - The mounted panel's root element.
     * @param {string} text - The full dialogue line, forwarded to _lockHeight().
     */
    _onMount(root, text) {
        this._textEl = root.querySelector('.merchant-dialogue-text p');
        this._shopEl = root.querySelector('.merchant-shop');
        this._lockHeight(text);
        if (this._shop) this._wireShopButtons();
    }

    /**
     * Measures the final text's wrapped height, locks it as min-height, then
     * clears the text back out for the typewriter reveal - without this, the
     * panel would grow taller line by line as more characters are revealed.
     * @param {string} text - The full dialogue line, same as passed to open().
     */
    _lockHeight(text) {
        this._textEl.textContent = text;
        this._textEl.style.minHeight = `${this._textEl.offsetHeight}px`;
        this._textEl.textContent = '';
    }

    /**
     * Builds the portrait/name/text markup, plus a hidden shop section if attached.
     * @returns {string} Portrait + name + (initially empty) text paragraph, plus a hidden shop section if `shop` was passed to open().
     */
    _buildBodyHTML() {
        return `
            <div class="merchant-dialogue">
                <img class="merchant-portrait" src="${PORTRAIT_SRC}" alt="${TITLE}">
                <div class="merchant-dialogue-text">
                    <div class="merchant-name">${TITLE}</div>
                    <p></p>
                </div>
            </div>
            ${this._shop ? `<div class="merchant-shop" hidden>${this._buildShopSectionHTML()}</div>` : ''}
        `;
    }

    /**
     * Closes the dialogue panel.
     */
    close() {
        this.isOpen = false;
        this.panel.close();
    }

    /**
     * Whether the typewriter has revealed every character.
     * @returns {boolean}
     */
    get _fullyRevealed() {
        return !this._tokens || this._revealedCount >= this._tokens.length;
    }

    /**
     * Fast-forwards the typewriter if still revealing text; otherwise
     * closes the dialogue, but only when no shop is attached - with one,
     * the panel stays open for the player to use its own buttons.
     */
    advance() {
        if (!this.isOpen) return;
        if (!this._fullyRevealed) {
            this._revealedCount = this._tokens.length;
            this._textEl.textContent = this._tokens.join('');
            this._revealShopIfNeeded();
        } else if (!this._shop) {
            this.close();
        }
    }

    /**
     * Advances the typewriter reveal by one tick.
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (!this.isOpen || this._fullyRevealed) return;

        this._revealTimer += dt;
        const tokensToShow = Math.floor(this._revealTimer * CHARS_PER_SECOND);
        if (tokensToShow > this._revealedCount) {
            this._revealedCount = Math.min(tokensToShow, this._tokens.length);
            this._textEl.textContent = this._tokens.slice(0, this._revealedCount).join('');
            this._revealShopIfNeeded();
        }
    }

    /**
     * Unhides the shop section the moment the typewriter finishes, whichever
     * way that happened (naturally in update(), or fast-forwarded by advance()).
     */
    _revealShopIfNeeded() {
        if (!this._shop || this._shopRevealed || !this._fullyRevealed) return;
        this._shopRevealed = true;
        this._shopEl.hidden = false;
    }

    /**
     * Builds the shop's option grid markup.
     * @returns {string} The option grid - no separate Token-count readout, each option shows its own cost (see _buildShopOptionHTML()).
     */
    _buildShopSectionHTML() {
        return `<div class="merchant-shop-options">${this._shop.options.map((opt) => this._buildShopOptionHTML(opt)).join('')}</div>`;
    }

    /**
     * Builds one shop option's markup, styled by owned/affordable state.
     * @param {{id: string, label: string, description: string, cost: number}} opt - Shop option to render.
     * @returns {string}
     */
    _buildShopOptionHTML(opt) {
        const owned = this._shop.isOwned(opt.id);
        const afford = this._shop.getTokens() >= opt.cost;
        const state = owned ? 'unlocked' : afford ? 'buyable' : 'unaffordable';

        return `
            <div class="merchant-shop-option ${state}">
                <div class="merchant-shop-option-info">
                    <div class="merchant-shop-option-title">${opt.label}</div>
                    <div class="merchant-shop-option-desc">${opt.description}</div>
                </div>
                <div class="merchant-shop-option-action">
                    <div class="merchant-shop-cost">Cost: ${opt.cost}</div>
                    <button class="merchant-shop-buy" data-ability="${opt.id}" ${owned || !afford ? 'disabled' : ''}>${owned ? 'Owned' : 'Unlock'}</button>
                </div>
            </div>
        `;
    }

    /**
     * Wires every Unlock button currently in the DOM. Called once on open()
     * and again after every purchase (see _handleShopBuy()).
     */
    _wireShopButtons() {
        for (const button of this._shopEl.querySelectorAll('.merchant-shop-buy:not(:disabled)')) {
            button.addEventListener('click', () => this._handleShopBuy(button.dataset.ability));
        }
    }

    /**
     * Rebuilds the shop section in place on a successful purchase, so every
     * option's owned/afford state and the token count reflect the new totals.
     * @param {string} id - Ability option id being purchased.
     */
    _handleShopBuy(id) {
        const option = this._shop.options.find((o) => o.id === id);
        if (!this._shop.buy(id, option.cost)) return;
        this._shopEl.innerHTML = this._buildShopSectionHTML();
        this._wireShopButtons();
    }
}
