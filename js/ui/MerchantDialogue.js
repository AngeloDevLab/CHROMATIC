import { Panel } from './Panel.js';

// Faster than CutsceneState's 10 chars/sec - that's tuned for a slow,
// scene-setting reveal, this is a quick in-level flavor line the player
// pages through mid-run and shouldn't feel like it's dragging.
const CHARS_PER_SECOND = 30;
const TITLE = 'Merchant';

// One-line teaser dialogue (05_enemies-bosses.md 6.2's real Merchant only
// appears after the Templateboss - this is a pre-Lvl-6 tease, no
// shop/Token interaction, see the session's scope discussion). Reuses
// Panel.js for the backdrop/box chrome, drives its own typewriter reveal on
// top the same way CutsceneState.js does for cutscene text.
export class MerchantDialogue {
    constructor(overlayRoot) {
        this.panel = new Panel(overlayRoot);
        this.isOpen = false;
        this._textEl = null;
        this._tokens = null;
        this._revealedCount = 0;
        this._revealTimer = 0;
    }

    open(text) {
        this.isOpen = true;
        this._tokens = text.split('');
        this._revealedCount = 0;
        this._revealTimer = 0;

        this.panel.open(TITLE, '<p></p>', {
            dismissible: true,
            onMount: (root) => {
                this._textEl = root.querySelector('.panel-body p');
            },
        });
    }

    close() {
        this.isOpen = false;
        this.panel.close();
    }

    get _fullyRevealed() {
        return !this._tokens || this._revealedCount >= this._tokens.length;
    }

    // [E] pressed again while open: fast-forward the typewriter if it's still
    // typing, otherwise treat the press as "got it" and close - the usual
    // two-step advance so a fast reader isn't stuck waiting on the reveal.
    advance() {
        if (!this.isOpen) return;
        if (!this._fullyRevealed) {
            this._revealedCount = this._tokens.length;
            this._textEl.textContent = this._tokens.join('');
        } else {
            this.close();
        }
    }

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
