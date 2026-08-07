import { LEVEL_JSON_KEYS, isBossLevel } from '../states/LevelSession.js';

const TOGGLE_KEY_CODE = 'Backquote';

/**
 * Prologue only, matches WorldmapState's level-skip target - no chapter
 * selector needed while only one chapter is playable at all
 * (11_scope-milestones.md 12.1).
 */
const CHAPTER_ID = 'prologue';
const LEVEL_COUNT = 6;

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
     * Appended straight to `document.body`, deliberately outside
     * `#ui-overlay` - that overlay is scaled together with the canvas
     * (`Game._handleResize`) to stay consistent with in-game HUD/menus, but
     * a dev tool reads better at a constant size regardless of window/game
     * scale.
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
                <button class="dev-panel-action" id="dev-panel-give-token">Give Token</button>
                <button class="dev-panel-ability locked" data-ability="doubleJump">Unlock Double Jump</button>
                <button class="dev-panel-ability locked" data-ability="dash">Unlock Dash</button>
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
                const level = Number(button.dataset.level);
                const target = isBossLevel(this.game.assets, level) ? 'boss' : 'game';
                this.game.stateMachine.change(target, { chapterId: CHAPTER_ID, level });
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

    /**
     * Dev/test-only Token grant (Game.tokens, same counter the boss-drop
     * Token pickup increments - Interactables.js's _updateTokens()) - a
     * shortcut around playing through a boss kill for testing the real
     * Merchant shop. Repeatable (a plain counter), unlike the ability
     * buttons below. Blurs on click for the same Space-key reason as
     * _wireLevelButtons().
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
     * Dev/test-only ability unlock (entities/DoubleJumpAbility.js/
     * DashAbility.js, Player.unlockAbility()) - bypasses the real Merchant's
     * Token cost entirely for testing. One-way like a real purchase (no
     * re-lock), so this is a plain button rather than a checkbox -
     * .locked/.unlocked (red/green, see style.css) is the only state, synced
     * on open and once more right after a click, then disabled so it reads
     * as "already bought" instead of a repeatable action.
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

    /** @param {HTMLButtonElement} button */
    _syncAbilityButton(button) {
        const unlocked = this.game.abilities.has(button.dataset.ability);
        button.classList.toggle('locked', !unlocked);
        button.classList.toggle('unlocked', unlocked);
        button.disabled = unlocked;
    }
}
