// The render buffer must resize in enter() before LevelSession (and its Camera) is constructed,
// since Camera reads game.width/height at construction time.

import { State } from './state.js';
import { LevelSession, loadLevelPreview } from './level-session.js';
import { BOSS_BAR_HEIGHT, BOSS_BAR_TOP_PX } from '../ui/hud.js';

/**
 * Top-center stack: name label, then HUD.renderBossBar()'s canvas bar
 * (BOSS_BAR_TOP_PX/HEIGHT), then this HP value label right below it.
 */
const boss_name_top_px = 6;
const boss_health_value_top_px = BOSS_BAR_TOP_PX + BOSS_BAR_HEIGHT + 2;

/** A boss-level session: the same LevelSession as a normal level, plus an arena-sized render buffer and the top-center boss HP bar/name label. */
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
        this.bossHealthValueEl = this._buildHiddenLabel('boss-health-label');
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
        this.bossHealthValueEl.remove();
        this.game.resetBuffer();
    }

    /**
     * Delegates to the level session's own update.
     * @param {number} deltaTime - Fixed timestep in seconds.
     */
    update(deltaTime) {
        this.session.update(deltaTime);
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
        this.bossHealthValueEl.hidden = !showBar;
        if (!showBar) return;

        const scale = this.game.hudScale;
        this.session.hud.renderBossBar(ctx, boss, this.game.width, scale);
        this._renderLabels(boss, scale);
    }

    /**
     * Positions/fills the name + HP-value labels around hud.js's renderBossBar().
     * @param {Enemy} boss - Boss whose name/HP to display.
     * @param {number} scale - Current HUD scale factor.
     */
    _renderLabels(boss, scale) {
        const centerX = this.game.width / 2;
        this.bossNameEl.textContent = boss.name ?? '';
        this.bossNameEl.classList.toggle('enraged', boss.enraged);
        this.bossNameEl.style.left = `${centerX}px`;
        this.bossNameEl.style.top = `${boss_name_top_px * scale}px`;

        this.bossHealthValueEl.textContent = `${Math.round(boss.health)}/${boss.maxHealth}`;
        this.bossHealthValueEl.style.left = `${centerX}px`;
        this.bossHealthValueEl.style.top = `${boss_health_value_top_px * scale}px`;
    }
}
