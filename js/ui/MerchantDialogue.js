import { Panel } from './Panel.js';

// Faster than CutsceneState's 10 chars/sec - that's tuned for a slow,
// scene-setting reveal, this is a quick in-level flavor line the player
// pages through mid-run and shouldn't feel like it's dragging.
const CHARS_PER_SECOND = 30;
const TITLE = 'Unknown Merchant';
const PORTRAIT_SRC = 'assets/images/objects/merchant-dialog-portrait.png';

// One-line teaser dialogue (05_enemies-bosses.md 6.2's real Merchant only
// appears after the Templateboss - this is a pre-Lvl-6 tease, no
// shop/Token interaction, see the session's scope discussion). Reuses
// Panel.js for the backdrop/box chrome, drives its own typewriter reveal on
// top the same way CutsceneState.js does for cutscene text. Portrait/name/
// text is laid out as its own bodyHTML (see _buildBodyHTML()) instead of
// Panel's generic title bar, so the portrait can sit beside the name rather
// than above the body.
export class MerchantDialogue {
    /**
     * @param {HTMLElement} overlayRoot - Element to mount the panel into.
     */
    constructor(overlayRoot) {
        this.panel = new Panel(overlayRoot);
        this.isOpen = false;
        this._textEl = null;
        this._tokens = null;
        this._revealedCount = 0;
        this._revealTimer = 0;
    }

    /**
     * @param {string} text - Dialogue line to reveal.
     */
    open(text) {
        this.isOpen = true;
        this._tokens = text.split('');
        this._revealedCount = 0;
        this._revealTimer = 0;

        this.panel.open('', this._buildBodyHTML(), {
            dismissible: true,
            // Backdrop-click/×/Escape all close the Panel internally without
            // going through this class's own close() - without this, isOpen
            // would stay stuck true and LevelSession.update() would never
            // leave its dialogue-frozen branch again.
            onClose: () => { this.isOpen = false; },
            onMount: (root) => {
                this._textEl = root.querySelector('.merchant-dialogue-text p');
                this._lockHeight(text);
            },
        });
    }

    /**
     * Renders the full (final) text once to measure its wrapped height, then
     * locks that as a min-height and clears it back out for the typewriter
     * reveal - without this, the panel visibly grows taller line by line as
     * update() reveals more characters instead of staying put from open().
     * @param {string} text - The full dialogue line, same as passed to open().
     */
    _lockHeight(text) {
        this._textEl.textContent = text;
        this._textEl.style.minHeight = `${this._textEl.offsetHeight}px`;
        this._textEl.textContent = '';
    }

    /**
     * @returns {string} Portrait + name + (initially empty) text paragraph.
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
     * @returns {boolean}
     */
    get _fullyRevealed() {
        return !this._tokens || this._revealedCount >= this._tokens.length;
    }

    /**
     * [E] pressed again while open: fast-forward the typewriter if it's
     * still typing, otherwise treat the press as "got it" and close - the
     * usual two-step advance so a fast reader isn't stuck waiting on the reveal.
     */
    advance() {
        if (!this.isOpen) return;
        if (!this._fullyRevealed) {
            this._revealedCount = this._tokens.length;
            this._textEl.textContent = this._tokens.join('');
        } else {
            this.close();
        }
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {
        if (!this.isOpen || this._fullyRevealed) return;

        this._revealTimer += dt;
        const tokensToShow = Math.floor(this._revealTimer * CHARS_PER_SECOND);
        if (tokensToShow > this._revealedCount) {
            this._revealedCount = Math.min(tokensToShow, this._tokens.length);
            this._textEl.textContent = this._tokens.slice(0, this._revealedCount).join('');
        }
    }
}
