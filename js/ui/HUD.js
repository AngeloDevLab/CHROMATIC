// Bar position/size as exported constants read by both this canvas draw call
// and GameState's HTML value labels (10_technical-architecture.md 11.8), so
// the two never drift out of sync with each other.
export const HEALTH_BAR = { x: 8, y: 8, width: 72, height: 8 };
export const SHIELD_BAR = { x: 8, y: 18, width: 72, height: 8 };

const ENEMY_BAR_WIDTH = 32;
const ENEMY_BAR_HEIGHT = 4;
const ENEMY_BAR_GAP_PX = 6;

// HUD bar fills are colored rectangles drawn on the canvas, not text
// (11.8.1) - this only ever draws bars; numbers/labels are the caller's job
// via the HTML overlay.
export class HUD {
    // Screen-fixed - call outside the camera-translated block.
    renderPlayerBars(ctx, player) {
        this._drawBar(ctx, HEALTH_BAR, player.health / player.maxHealth, '#3a1414', '#d4453f');
        this._drawBar(ctx, SHIELD_BAR, player.shield / player.maxShield, '#123244', '#3fc6e0');
    }

    // World-space (follows the enemy) - call inside the camera-translated
    // block, alongside enemy rendering.
    renderEnemyBar(ctx, enemy) {
        // Dormant (Sentinel.js) stays hidden until it's actually risen - no
        // HP bar spoiling a buried ambush before it triggers.
        if (enemy.dead || enemy.dormant || !enemy.referenceAnim) return;

        const rect = {
            x: enemy.centerX - ENEMY_BAR_WIDTH / 2,
            y: enemy.visualTopY - ENEMY_BAR_GAP_PX - ENEMY_BAR_HEIGHT,
            width: ENEMY_BAR_WIDTH,
            height: ENEMY_BAR_HEIGHT,
        };
        this._drawBar(ctx, rect, enemy.hp / enemy.maxHp, '#241010', '#d4453f');
    }

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
