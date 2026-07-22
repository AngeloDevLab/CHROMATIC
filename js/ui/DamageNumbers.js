const RISE_PX = 20;
const DAMAGE_DURATION_SECONDS = 0.7;
// Text takes longer to read than a 2-3 digit damage number, held up longer.
const STATUS_DURATION_SECONDS = 1.2;

// Floating popups over an entity's head - damage numbers over enemies, and
// short one-off status text over the player (e.g. GameState's "No Prisma"
// ranged-attack warning). Text always renders through the HTML overlay,
// never canvas fillText (10_technical-architecture.md 11.8/11.8.1) - so this
// manages a small pool of overlay elements and recomputes their screen
// position from world coordinates every frame, since #ui-overlay doesn't
// scroll with Camera.js the way the canvas does.
export class DamageNumbers {
    constructor(overlay) {
        this.overlay = overlay;
        this.active = [];
    }

    spawn(worldX, worldY, amount) {
        this._spawn(worldX, worldY, String(Math.round(amount)), 'damage-number', DAMAGE_DURATION_SECONDS);
    }

    // Generic text popup (see .status-message in style.css for its look,
    // distinct from .damage-number) - same float/fade mechanic as spawn()
    // above, just not tied to a numeric amount.
    spawnStatus(worldX, worldY, text) {
        this._spawn(worldX, worldY, text, 'status-message', STATUS_DURATION_SECONDS);
    }

    _spawn(worldX, worldY, text, className, durationSeconds) {
        const el = document.createElement('div');
        el.className = className;
        el.textContent = text;
        this.overlay.appendChild(el);
        this.active.push({ el, worldX, worldY, age: 0, durationSeconds });
    }

    update(dt, camera) {
        for (const entry of this.active) {
            entry.age += dt;
            const progress = Math.min(1, entry.age / entry.durationSeconds);
            entry.el.style.left = `${entry.worldX - camera.x}px`;
            entry.el.style.top = `${entry.worldY - camera.y - RISE_PX * progress}px`;
            entry.el.style.opacity = String(1 - progress);
        }

        const expired = this.active.filter((entry) => entry.age >= entry.durationSeconds);
        for (const entry of expired) entry.el.remove();
        this.active = this.active.filter((entry) => entry.age < entry.durationSeconds);
    }

    clear() {
        for (const entry of this.active) entry.el.remove();
        this.active = [];
    }
}
