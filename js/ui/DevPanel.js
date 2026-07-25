import { LEVEL_JSON_KEYS } from '../states/GameState.js';

// Fixed to the document, deliberately outside #ui-overlay - that overlay is
// scaled together with the canvas (Game._handleResize) to stay consistent
// with in-game HUD/menus, but a dev tool reads better at a constant size
// regardless of window/game scale.
const TOGGLE_KEY_CODE = 'Backquote';

// Prologue only, matches WorldmapState's level-skip target - no chapter
// selector needed while only one chapter is playable at all
// (11_scope-milestones.md 12.1).
const CHAPTER_ID = 'prologue';
const LEVEL_COUNT = 6;

// Not implemented yet: Token economy + Merchant, and purchasable abilities,
// don't exist as systems (see TODO.md) - these two stay disabled stubs so the
// panel's shape is already in place once there's something to actually grant.
const UNAVAILABLE_TITLE = 'Not implemented yet - system not built';

export class DevPanel {
    /**
     * @param {Game} game - Owning Game instance.
     */
    constructor(game) {
        this.game = game;
        this.open = false;
        this.showHitboxes = false;
        this.godmode = false;
        this.element = null;
        this._onKeyDown = this._onKeyDown.bind(this);
        window.addEventListener('keydown', this._onKeyDown);
    }

    /**
     * @param {KeyboardEvent} e
     */
    _onKeyDown(e) {
        if (e.code !== TOGGLE_KEY_CODE) return;
        this.open ? this._close() : this._render();
    }

    /**
     * Detaches the panel and clears its open state.
     */
    _close() {
        this.open = false;
        this.element?.remove();
        this.element = null;
    }

    /**
     * Builds and attaches the panel, then wires up its interactive controls.
     */
    _render() {
        this.open = true;
        this.element = document.createElement('div');
        this.element.className = 'dev-panel';
        this.element.innerHTML = this._buildMarkup();

        this._wireLevelButtons();
        this._wireToggle('#dev-panel-hitboxes', 'showHitboxes');
        this._wireToggle('#dev-panel-godmode', 'godmode');

        document.body.appendChild(this.element);
    }

    /**
     * @returns {string} One button per level, disabled if not yet registered.
     */
    _buildLevelButtons() {
        return Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
            .map((level) => {
                const available = !!LEVEL_JSON_KEYS[level];
                return `<button class="dev-panel-level" data-level="${level}" ${available ? '' : 'disabled title="Level not registered yet"'}>${level}</button>`;
            })
            .join('');
    }

    /**
     * @returns {string} The full panel markup.
     */
    _buildMarkup() {
        return `
            <div class="dev-panel-title">Dev Panel</div>
            <div class="dev-panel-section">
                <div class="dev-panel-label">Skip to level</div>
                <div class="dev-panel-levels">${this._buildLevelButtons()}</div>
            </div>
            <div class="dev-panel-section">
                <label class="dev-panel-toggle"><input type="checkbox" id="dev-panel-hitboxes"> Show hitboxes</label>
                <label class="dev-panel-toggle"><input type="checkbox" id="dev-panel-godmode"> Godmode</label>
            </div>
            <div class="dev-panel-section">
                <button class="dev-panel-stub" disabled title="${UNAVAILABLE_TITLE}">Give Token</button>
                <button class="dev-panel-stub" disabled title="${UNAVAILABLE_TITLE}">Give Ability</button>
            </div>
        `;
    }

    /**
     * Wires each level-skip button. Blurs on click - a clicked <button>
     * keeps DOM focus, and Space is both our own jump key (InputHandler.js)
     * and the browser's native "activate the focused button" key on keyup,
     * so without this, releasing jump during gameplay kept re-firing this
     * click and resetting the level right back to spawn.
     */
    _wireLevelButtons() {
        for (const button of this.element.querySelectorAll('.dev-panel-level:not(:disabled)')) {
            button.addEventListener('click', () => {
                button.blur();
                this.game.stateMachine.change('game', { chapterId: CHAPTER_ID, level: Number(button.dataset.level) });
            });
        }
    }

    /**
     * Wires a checkbox to a boolean field on this DevPanel, blurring on
     * click for the same Space-key reason as _wireLevelButtons().
     * @param {string} selector - CSS selector for the checkbox input.
     * @param {string} field - Field on this DevPanel to read/write.
     */
    _wireToggle(selector, field) {
        const input = this.element.querySelector(selector);
        input.checked = this[field];
        input.addEventListener('change', () => { this[field] = input.checked; });
        input.addEventListener('click', () => input.blur());
    }
}
