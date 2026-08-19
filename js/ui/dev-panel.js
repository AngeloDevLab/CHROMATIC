import { LEVEL_JSON_KEYS, isBossLevel } from '../states/level-session.js';

const TOGGLE_KEY_CODE = 'Backquote';

/**
 * Prologue only, matches WorldmapState's level-skip target.
 */
const CHAPTER_ID = 'prologue';
const LEVEL_COUNT = 6;

/**
 * In-game debug panel (backtick key to toggle): level skip, hitbox/godmode
 * toggles, and dev-only Token/ability grants that bypass the real Merchant
 * flow for testing - appended straight to document.body, outside #ui-overlay.
 * Interactive buttons blur themselves on click, since Space is both the jump
 * key and the browser's native "activate focused button" key - an unblurred
 * button would otherwise re-fire on the next jump-release.
 */
export class DevPanel {
    /**
     * Sets up default debug state and the toggle-key listener.
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
     * Toggles the panel open/closed on the backtick key.
     * @param {KeyboardEvent} e - The browser keydown event.
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
        this._wireGiveTokenButton();
        this._wireAbilityButtons();

        document.body.appendChild(this.element);
    }

    /**
     * Builds the level-skip button row.
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
     * Builds the panel's full markup.
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
                <button class="dev-panel-action" id="dev-panel-give-token">Give Token</button>
                <button class="dev-panel-ability locked" data-ability="doubleJump">Unlock Double Jump</button>
                <button class="dev-panel-ability locked" data-ability="dash">Unlock Dash</button>
            </div>
        `;
    }

    /**
     * Wires each level-skip button, blurring itself on click.
     */
    _wireLevelButtons() {
        for (const button of this.element.querySelectorAll('.dev-panel-level:not(:disabled)')) {
            button.addEventListener('click', () => {
                button.blur();
                const level = Number(button.dataset.level);
                const target = isBossLevel(this.game.assets, level) ? 'boss' : 'game';
                this.game.stateMachine.change(target, { chapterId: CHAPTER_ID, level });
            });
        }
    }

    /**
     * Wires a checkbox to a boolean field on this DevPanel, blurring itself on click.
     * @param {string} selector - CSS selector for the checkbox input.
     * @param {string} field - Field on this DevPanel to read/write.
     */
    _wireToggle(selector, field) {
        const input = this.element.querySelector(selector);
        input.checked = this[field];
        input.addEventListener('change', () => { this[field] = input.checked; });
        input.addEventListener('click', () => input.blur());
    }

    /**
     * Wires the dev-only Token grant button (Game.tokens), a repeatable
     * shortcut around a boss kill for testing the Merchant shop.
     */
    _wireGiveTokenButton() {
        const button = this.element.querySelector('#dev-panel-give-token');
        button.addEventListener('click', () => {
            button.blur();
            this.game.tokens++;
            this.game.saveProgress();
        });
    }

    /**
     * Wires the dev-only ability unlock buttons, bypassing the real
     * Merchant's Token cost for testing. Each button disables itself once unlocked.
     */
    _wireAbilityButtons() {
        for (const button of this.element.querySelectorAll('.dev-panel-ability')) {
            this._syncAbilityButton(button);
            button.addEventListener('click', () => {
                button.blur();
                this.game.abilities.add(button.dataset.ability);
                this.game.saveProgress();
                this._syncAbilityButton(button);
            });
        }
    }

    /**
     * Syncs an ability button's locked/unlocked look to actual ownership.
     * @param {HTMLButtonElement} button - Ability button to sync locked/unlocked state for.
     */
    _syncAbilityButton(button) {
        const unlocked = this.game.abilities.has(button.dataset.ability);
        button.classList.toggle('locked', !unlocked);
        button.classList.toggle('unlocked', unlocked);
        button.disabled = unlocked;
    }
}
