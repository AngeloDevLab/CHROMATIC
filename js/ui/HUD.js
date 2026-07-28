import { Boss } from '../entities/Boss.js';

// Bar position/size as exported constants read by both this canvas draw call
// and GameState's HTML value labels (10_technical-architecture.md 11.8), so
// the two never drift out of sync with each other.
export const HEALTH_BAR = { x: 8, y: 8, width: 72, height: 8 };
export const SHIELD_BAR = { x: 8, y: 18, width: 72, height: 8 };

const ENEMY_BAR_WIDTH = 32;
const ENEMY_BAR_HEIGHT = 4;
const ENEMY_BAR_GAP_PX = 6;

// BossState.js's top-center HP bar - wider/taller than the floating
// per-enemy bar above, since it's the sole focus of a boss encounter.
// Horizontally centered dynamically (see renderBossBar() below), not a
// fixed x, since BossState's own buffer width varies per arena. HEIGHT/
// TOP_PX exported (same reasoning as HEALTH_BAR/SHIELD_BAR above) so
// BossState.js's own name label (above) and HP value label (below) can
// position themselves relative to this canvas-drawn bar without
// duplicating these numbers a second time.
const BOSS_BAR_WIDTH = 200;
export const BOSS_BAR_HEIGHT = 10;
export const BOSS_BAR_TOP_PX = 26;

/**
 * Scales a screen-fixed rect's position/size by Game.hudScale - shared by
 * renderPlayerBars()/renderBossBar() below and by LevelSession.js/
 * BossState.js, which need the exact same scaled numbers to position their
 * own HTML labels right against these canvas-drawn bars.
 * @param {{x:number,y:number,width:number,height:number}} rect
 * @param {number} scale
 * @returns {{x:number,y:number,width:number,height:number}}
 */
export function scaleRect(rect, scale) {
    return { x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
}

// HUD bar fills are colored rectangles drawn on the canvas, not text
// (11.8.1) - this only ever draws bars; numbers/labels are the caller's job
// via the HTML overlay. Dormant enemies (Sentinel.js) stay hidden until
// actually risen - no HP bar spoiling a buried ambush before it triggers. No
// `referenceAnim` guard needed - Enemy.js's visualTopY already falls back to
// `enemy.y` when there isn't one (e.g. Boss.js subclasses still on
// placeholder rendering, no animations wired in yet - see Wraith.js).
export class HUD {
    /**
     * Screen-fixed - call outside the camera-translated block. `scale`
     * (Game.hudScale) keeps this the same on-screen size during a boss
     * fight's bigger render buffer as in a normal level - see that
     * getter's own comment.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {Player} player
     * @param {number} [scale=1] - Game.hudScale.
     */
    renderPlayerBars(ctx, player, scale = 1) {
        this._drawBar(ctx, scaleRect(HEALTH_BAR, scale), player.health / player.maxHealth, '#3a1414', '#d4453f');
        this._drawBar(ctx, scaleRect(SHIELD_BAR, scale), player.shield / player.maxShield, '#123244', '#3fc6e0');
    }

    /**
     * World-space (follows the enemy) - call inside the camera-translated
     * block, alongside enemy rendering. Skipped for Boss/Templateboss
     * instances - BossState.js's top-center renderBossBar() already covers
     * that HP, a second floating bar right over its head was redundant.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {Enemy} enemy
     */
    renderEnemyBar(ctx, enemy) {
        if (enemy.dead || enemy.dormant || enemy instanceof Boss) return;

        const rect = {
            x: enemy.centerX - ENEMY_BAR_WIDTH / 2,
            y: enemy.visualTopY - ENEMY_BAR_GAP_PX - ENEMY_BAR_HEIGHT,
            width: ENEMY_BAR_WIDTH,
            height: ENEMY_BAR_HEIGHT,
        };
        this._drawBar(ctx, rect, enemy.hp / enemy.maxHp, '#241010', '#d4453f');
    }

    /**
     * Screen-fixed, horizontally centered on the current buffer width - call
     * outside the camera-translated block. BossState.js owns the boss-name
     * HTML label that goes with this (11.8's text-vs-canvas boundary), this
     * only ever draws the fill. Fill color shifts to Phase 2's enrage color
     * once boss.enraged (Boss.js) is true - a visible tell for the speed-up,
     * since otherwise the only sign is the moveset itself ticking faster.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {Enemy} boss
     * @param {number} gameWidth - Current buffer width (varies per boss arena).
     * @param {number} [scale=1] - Game.hudScale, same reasoning as renderPlayerBars() above.
     */
    renderBossBar(ctx, boss, gameWidth, scale = 1) {
        const width = BOSS_BAR_WIDTH * scale;
        const rect = {
            x: gameWidth / 2 - width / 2,
            y: BOSS_BAR_TOP_PX * scale,
            width,
            height: BOSS_BAR_HEIGHT * scale,
        };
        const fillColor = boss.enraged ? '#ff8a3f' : '#d4453f';
        this._drawBar(ctx, rect, boss.hp / boss.maxHp, '#241010', fillColor);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {{x:number,y:number,width:number,height:number}} rect - Bar bounds.
     * @param {number} ratio - Fill ratio, clamped to 0-1.
     * @param {string} bgColor - Background (empty) color.
     * @param {string} fillColor - Fill color.
     */
    _drawBar(ctx, rect, ratio, bgColor, fillColor) {
        const clamped = Math.max(0, Math.min(1, ratio));

        ctx.fillStyle = bgColor;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        ctx.fillStyle = fillColor;
        ctx.fillRect(rect.x, rect.y, rect.width * clamped, rect.height);

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
    }
}
