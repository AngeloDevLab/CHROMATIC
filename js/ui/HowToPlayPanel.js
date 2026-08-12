/**
 * Content for docs/GDD/07_ui-hud.md 8.1.
 */
const SECTIONS = [
    {
        title: 'The Color Trail',
        text: 'Moving through the world permanently reclaims the ground beneath you, turning it back from grey to color. Exploring is how you make progress - the more you walk, the more of the world comes back to life.',
    },
    {
        title: 'Movement',
        text: 'Move left and right with A/D or the arrow keys, and jump with Space, W, or the up arrow. While standing on a platform, press S or the down arrow to drop straight down through it instead of landing on it.',
    },
    {
        title: 'Combat',
        text: 'Attack by clicking, or press F. Up close you swing your sword in melee; against an enemy too far away to reach, you throw it instead - the game switches automatically based on distance, there is no separate button for it. Throwing deals half of melee\'s damage and has a short cooldown before you can throw again, so it\'s the safer option, not a spammable one. Simply touching an enemy also hurts both of you, so getting in close for melee always carries some risk.',
    },
    {
        title: 'Health & Prisma',
        text: 'Health and Prisma are your two resources, shown as the two bars top left. Prisma is a color barrier around you: it absorbs hits before Health does, damages any enemy that touches it, and slowly regenerates on its own over time. Only once Prisma is fully depleted does incoming damage start hurting your actual Health. Losing all Health restarts the level from the beginning.',
    },
    {
        title: 'Levels',
        text: 'Every level plays differently: some are combat-heavy, some hide a Secret Room with a permanent buff, some twist the rules with a one-off gimmick, and some end in a boss fight.',
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
        return SECTIONS.map((section) => `
            <div class="how-to-play-section">
                <h4>${section.title}</h4>
                <p>${section.text}</p>
            </div>
        `).join('');
    }
}
