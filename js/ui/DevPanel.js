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
    constructor(game) {
        this.game = game;
        this.open = false;
        this.showHitboxes = false;
        this.godmode = false;
        this.element = null;
        this._onKeyDown = this._onKeyDown.bind(this);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _onKeyDown(e) {
        if (e.code !== TOGGLE_KEY_CODE) return;
        this.open ? this._close() : this._render();
    }

    _close() {
        this.open = false;
        this.element?.remove();
        this.element = null;
    }

    _render() {
        this.open = true;

        this.element = document.createElement('div');
        this.element.className = 'dev-panel';

        const levelButtons = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1)
            .map((level) => {
                const available = !!LEVEL_JSON_KEYS[level];
                return `<button class="dev-panel-level" data-level="${level}" ${available ? '' : 'disabled title="Level not registered yet"'}>${level}</button>`;
            })
            .join('');

        this.element.innerHTML = `
            <div class="dev-panel-title">Dev Panel</div>
            <div class="dev-panel-section">
                <div class="dev-panel-label">Skip to level</div>
                <div class="dev-panel-levels">${levelButtons}</div>
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

        for (const button of this.element.querySelectorAll('.dev-panel-level:not(:disabled)')) {
            button.addEventListener('click', () => {
                // A clicked <button> keeps DOM focus - Space is both our own
                // jump key (InputHandler.js) AND the browser's native "activate
                // the focused button" key on keyup, so without this, releasing
                // jump during gameplay kept re-firing this click and resetting
                // the level right back to spawn. Same reasoning applied to the
                // checkbox inputs below.
                button.blur();
                this.game.stateMachine.change('game', { chapterId: CHAPTER_ID, level: Number(button.dataset.level) });
            });
        }

        const hitboxesInput = this.element.querySelector('#dev-panel-hitboxes');
        hitboxesInput.checked = this.showHitboxes;
        hitboxesInput.addEventListener('change', () => { this.showHitboxes = hitboxesInput.checked; });
        hitboxesInput.addEventListener('click', () => hitboxesInput.blur());

        const godmodeInput = this.element.querySelector('#dev-panel-godmode');
        godmodeInput.checked = this.godmode;
        godmodeInput.addEventListener('change', () => { this.godmode = godmodeInput.checked; });
        godmodeInput.addEventListener('click', () => godmodeInput.blur());

        document.body.appendChild(this.element);
    }
}
