import { State } from './State.js';
import { LevelSession, loadLevelPreview } from './LevelSession.js';
import { BOSS_BAR_HEIGHT, BOSS_BAR_TOP_PX } from '../ui/HUD.js';

/**
 * Top-center stack: name label, then HUD.renderBossBar()'s canvas bar
 * (BOSS_BAR_TOP_PX/HEIGHT), then this HP value label right below it.
 */
const BOSS_NAME_TOP_PX = 6;
const BOSS_HP_VALUE_TOP_PX = BOSS_BAR_TOP_PX + BOSS_BAR_HEIGHT + 2;

// A boss-level session - same LevelSession as a normal level (GameState.js),
// with two boss-specific additions this class owns instead of branching
// GameState/LevelSession on "is this a boss level": a dedicated render
// buffer sized to exactly match the arena (see enter(), no empty border to
// hide per docs/GDD/10_technical-architecture.md 11.7.2's Boss level type),
// and the top-center HP bar + name label. Routing to this instead of
// GameState happens at level-load time via isBossLevel() (LevelSession.js),
// not a mid-session trigger.
// Session finding: the arena buffer is necessarily larger than the base
// 640x360 (Lv_3's is 960x512), so Game._handleResize()'s window-fit scale
// ends up smaller for the same physical window - without correction, this
// file's name/HP-bar/labels and HUD.js's renderBossBar() would render
// smaller during a boss fight than in a normal level. Both correct for it
// via Game.hudScale (see that getter's own comment for the general mechanism).
export class BossState extends State {
    /**
     * Resizes the render buffer to exactly match the arena before the
     * session (and its Camera, which reads game.width/height) is
     * constructed, and before this frame's first render() - the player
     * never sees the base 640x360 buffer for a boss level, only the
     * arena-sized one, so there's no mid-scene buffer swap to hide (see
     * Game.resizeBuffer()'s own comment on the CSS transition covering the
     * on-screen box growing/shrinking).
     * @param {{chapterId: string, level: number}} params - Forwarded to LevelSession.
     */
    enter(params) {
        const arena = loadLevelPreview(this.game.assets, params.level);
        this.game.resizeBuffer(arena.pixelWidth, arena.pixelHeight);

        this.session = new LevelSession(this.game, params);

        this.bossNameEl = document.createElement('div');
        this.bossNameEl.className = 'boss-name-label';
        this.bossNameEl.hidden = true;
        this.game.overlay.appendChild(this.bossNameEl);

        this.bossHpValueEl = document.createElement('div');
        this.bossHpValueEl.className = 'boss-hp-label';
        this.bossHpValueEl.hidden = true;
        this.game.overlay.appendChild(this.bossHpValueEl);
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
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.session.update(dt);
    }

    /**
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
     * Positions/fills the name + HP-value labels around HUD.js's
     * renderBossBar() - BOSS_NAME_TOP_PX/BOSS_HP_VALUE_TOP_PX are both
     * scaled as a whole by `scale` (Game.hudScale) rather than recomputed,
     * since that preserves their relative spacing around the (also scaled)
     * canvas bar regardless of the arena's actual buffer size.
     * @param {Enemy} boss
     * @param {number} scale
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
