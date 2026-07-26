import { State } from './State.js';
import { LevelSession, loadLevelPreview } from './LevelSession.js';
import { Boss } from '../entities/Boss.js';
import { BOSS_BAR_HEIGHT, BOSS_BAR_TOP_PX } from '../ui/HUD.js';

// Top-center stack: name label, then HUD.renderBossBar()'s canvas bar
// (BOSS_BAR_TOP_PX/HEIGHT), then this HP value label right below it.
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
// Session finding: the arena-sized buffer is necessarily wider/taller than
// the base 640x360 (Lv_3's is 960x512), so Game._handleResize()'s
// window-fit integer scale (Math.floor(innerWidth/game.width), see that
// method) ends up smaller too, for the same physical window - anything
// sized in fixed buffer-pixels (HUD bars, text) therefore renders smaller on
// screen during a boss fight than it does in a normal level, independent of
// any font-size choice made here. Bumping this file's own labels to 16px
// (never smaller, see the .boss-name-label/.boss-hp-label CSS) compensates
// for that partially; the player's own HEALTH_BAR/SHIELD_BAR (HUD.js) still
// look smaller during a boss fight than elsewhere for the same reason,
// unaddressed so far since fixing that generally would mean revisiting the
// integer-scale rule itself, not just this state's own labels.
export class BossState extends State {
    /**
     * @param {{chapterId: string, level: number}} params - Forwarded to LevelSession.
     */
    enter(params) {
        // Resized before the session (and its Camera, which reads
        // game.width/height) is constructed, and before this frame's first
        // render() - the player never sees the base 640x360 buffer for a
        // boss level, only the arena-sized one, so there's no mid-scene
        // buffer swap to hide (see Game.resizeBuffer()'s own comment on the
        // CSS transition covering the on-screen box growing/shrinking).
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

        const boss = this.session.enemies.find((enemy) => enemy instanceof Boss && !enemy.dead);
        this.bossNameEl.hidden = !boss;
        this.bossHpValueEl.hidden = !boss;
        if (!boss) return;

        this.session.hud.renderBossBar(ctx, boss, this.game.width);

        const centerX = this.game.width / 2;
        this.bossNameEl.textContent = boss.name ?? '';
        this.bossNameEl.classList.toggle('enraged', boss.enraged);
        this.bossNameEl.style.left = `${centerX}px`;
        this.bossNameEl.style.top = `${BOSS_NAME_TOP_PX}px`;

        this.bossHpValueEl.textContent = `${Math.round(boss.hp)}/${boss.maxHp}`;
        this.bossHpValueEl.style.left = `${centerX}px`;
        this.bossHpValueEl.style.top = `${BOSS_HP_VALUE_TOP_PX}px`;
    }
}
