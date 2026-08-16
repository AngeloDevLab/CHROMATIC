import { State } from './State.js';
import { LevelSession, loadLevelPreview } from './LevelSession.js';
import { BOSS_BAR_HEIGHT, BOSS_BAR_TOP_PX } from '../ui/HUD.js';

/**
 * Top-center stack: name label, then HUD.renderBossBar()'s canvas bar
 * (BOSS_BAR_TOP_PX/HEIGHT), then this HP value label right below it.
 */
const BOSS_NAME_TOP_PX = 6;
const BOSS_HP_VALUE_TOP_PX = BOSS_BAR_TOP_PX + BOSS_BAR_HEIGHT + 2;

// A boss-level session - same LevelSession as a normal level, with two
// boss-specific additions: a dedicated render buffer sized to match the
// arena, and the top-center HP bar + name label. Routed to instead of
// GameState at level-load time via isBossLevel(), not a mid-session trigger.
//
// The buffer resize happens in enter() before the session (and its Camera,
// which reads game.width/height) is constructed.
//
// The arena buffer is larger than the base 640x360, so Game._handleResize()'s
// window-fit scale ends up smaller than in a normal level; name/HP-bar
// labels and HUD.js's renderBossBar() both correct for it via Game.hudScale.
export class BossState extends State {
    /**
     * Loads the arena preview, resizes the render buffer to match it, and starts the level session.
     * @param {{chapterId: string, level: number}} params - Forwarded to LevelSession.
     */
    enter(params) {
        const arena = loadLevelPreview(this.game.assets, params.level);
        this.game.resizeBuffer(arena.pixelWidth, arena.pixelHeight);

        this.session = new LevelSession(this.game, params);
        this.bossNameEl = this._buildHiddenLabel('boss-name-label');
        this.bossHpValueEl = this._buildHiddenLabel('boss-hp-label');
    }

    /**
     * A hidden-until-boss-visible HUD label, appended to the overlay.
     * @param {string} className - CSS class for the new label element.
     * @returns {HTMLDivElement}
     */
    _buildHiddenLabel(className) {
        const el = document.createElement('div');
        el.className = className;
        el.hidden = true;
        this.game.overlay.appendChild(el);
        return el;
    }

    /**
     * Tears down the level session and boss HUD labels, restores the base render buffer.
     */
    exit() {
        this.session.destroy();
        this.bossNameEl.remove();
        this.bossHpValueEl.remove();
        this.game.resetBuffer();
    }

    /**
     * Delegates to the level session's own update.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.session.update(dt);
    }

    /**
     * Renders the session, then the boss HP bar and its labels while the boss is alive.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        this.session.render(ctx);

        const boss = this.session.enemyRoster.boss;
        const showBar = boss && !boss.dead;
        this.bossNameEl.hidden = !showBar;
        this.bossHpValueEl.hidden = !showBar;
        if (!showBar) return;

        const scale = this.game.hudScale;
        this.session.hud.renderBossBar(ctx, boss, this.game.width, scale);
        this._renderLabels(boss, scale);
    }

    /**
     * Positions/fills the name + HP-value labels around HUD.js's renderBossBar().
     * @param {Enemy} boss - Boss whose name/HP to display.
     * @param {number} scale - Current HUD scale factor.
     */
    _renderLabels(boss, scale) {
        const centerX = this.game.width / 2;
        this.bossNameEl.textContent = boss.name ?? '';
        this.bossNameEl.classList.toggle('enraged', boss.enraged);
        this.bossNameEl.style.left = `${centerX}px`;
        this.bossNameEl.style.top = `${BOSS_NAME_TOP_PX * scale}px`;

        this.bossHpValueEl.textContent = `${Math.round(boss.hp)}/${boss.maxHp}`;
        this.bossHpValueEl.style.left = `${centerX}px`;
        this.bossHpValueEl.style.top = `${BOSS_HP_VALUE_TOP_PX * scale}px`;
    }
}
