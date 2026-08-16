import { Boss } from '../entities/Boss.js';

/**
 * Bar position/size, exported so GameState's HTML value labels can align to this canvas draw call.
 */
export const HEALTH_BAR = { x: 8, y: 8, width: 72, height: 8 };
export const SHIELD_BAR = { x: 8, y: 22, width: 72, height: 8 };

const ENEMY_BAR_WIDTH = 32;
const ENEMY_BAR_HEIGHT = 4;
const ENEMY_BAR_GAP_PX = 6;

/**
 * BossState.js's top-center HP bar, horizontally centered dynamically (see
 * renderBossBar()) since BossState's own buffer width varies per arena.
 * HEIGHT/TOP_PX exported so BossState's name/HP labels can align to this bar.
 */
const BOSS_BAR_WIDTH = 200;
export const BOSS_BAR_HEIGHT = 10;
export const BOSS_BAR_TOP_PX = 26;

/**
 * Scales a screen-fixed rect's position/size by Game.hudScale. Shared by
 * renderPlayerBars()/renderBossBar() below and by LevelSession.js/
 * BossState.js's own HTML label positioning.
 * @param {{x:number,y:number,width:number,height:number}} rect - Screen-fixed rect to scale.
 * @param {number} scale - Game.hudScale.
 * @returns {{x:number,y:number,width:number,height:number}}
 */
export function scaleRect(rect, scale) {
    return { x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale };
}

// HUD bar fills are canvas rectangles, not text - numbers/labels are
// the caller's HTML overlay job. Dormant enemies stay hidden until risen, so
// no bar spoils a buried ambush. Enemy.js's visualTopY already falls back to
// enemy.y when there's no reference animation (e.g. Boss.js placeholders).
export class HUD {
    /**
     * Screen-fixed - call outside the camera-translated block.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {Player} player - Player whose Health/Shield bars to draw.
     * @param {number} [scale=1] - Game.hudScale.
     */
    renderPlayerBars(ctx, player, scale = 1) {
        this._drawBar(ctx, scaleRect(HEALTH_BAR, scale), player.health / player.maxHealth, '#3a1414', '#d4453f');
        this._drawBar(ctx, scaleRect(SHIELD_BAR, scale), player.shield / player.maxShield, '#123244', '#3fc6e0');
    }

    /**
     * World-space (follows the enemy) - call inside the camera-translated
     * block, alongside enemy rendering. Skipped for Boss/Templateboss instances.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {Enemy} enemy - Enemy whose HP bar to draw.
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
     * Draws the boss HP bar fill, horizontally centered on the current
     * buffer width. Fill color shifts to the enrage color once `boss.enraged` is true.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     * @param {Enemy} boss - Boss whose HP bar to draw.
     * @param {number} gameWidth - Current buffer width (varies per boss arena).
     * @param {number} [scale=1] - Game.hudScale.
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
     * Draws a background-plus-fill bar with a 1px border.
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
