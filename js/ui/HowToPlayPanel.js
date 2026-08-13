/**
 * Content for docs/GDD/07_ui-hud.md 8.1.
 */
const SECTIONS = [
    {
        title: 'The Color Trail',
        text: 'Walking reclaims the world, turning grey back to color. Explore to progress.',
    },
    {
        title: 'Movement',
        text: 'A/D or arrow keys to move, Space/W/Up to jump. S/Down drops you through a platform.',
    },
    {
        title: 'Combat',
        text: 'Click or F to attack: melee up close, auto-thrown at range. Touching an enemy hurts you both.',
    },
    {
        title: 'Health & Prisma',
        text: 'Prisma (top left) shields you and regenerates over time. Health only drops once Prisma is empty; 0 Health restarts the level.',
    },
    {
        title: 'Levels',
        text: 'Each level plays differently: combat, secret rooms with a buff, one-off gimmicks, boss fights.',
    },
];

/**
 * Takes an injected Panel (not owned) so it can share Menu/Pause's existing
 * instance - two independently-owned Panels would each register their own
 * Escape listener, closing both on a single press instead of just the top one.
 */
export class HowToPlayPanel {
    /**
     * @param {Panel} panel - Panel instance to open into (owned by the caller).
     */
    constructor(panel) {
        this.panel = panel;
        this.isOpen = false;
    }

    /**
     * @param {object} [options]
     * @param {() => void} [options.onClose] - Forwarded to Panel.open(), for
     *   callers that need to return to their own previous view.
     * @param {boolean} [options.closeOnEscape=true] - Set false by callers
     *   that handle Escape themselves (e.g. PauseState.js).
     */
    open({ onClose, closeOnEscape = true } = {}) {
        this.isOpen = true;
        this.panel.open('How to Play', this._buildBodyHTML(), {
            closeOnEscape,
            onClose: () => { this.isOpen = false; onClose?.(); },
        });
    }

    /**
     * Closes the panel, if open.
     */
    close() {
        this.panel.close();
    }

    /**
     * @returns {string} The full section list markup.
     */
    _buildBodyHTML() {
        const sections = SECTIONS.map((section) => `
            <div class="how-to-play-section">
                <h4>${section.title}</h4>
                <p>${section.text}</p>
            </div>
        `).join('');
        return `<div class="readable-body">${sections}</div>`;
    }
}
