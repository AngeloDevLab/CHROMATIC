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
// scroll with Camera.js the way the canvas does. update()'s position math is
// multiplied by camera.zoom (Camera.js) to match render()'s own
// ctx.scale(zoom)+translate - without this, any camera zoom below 1 would
// leave these drifting away from the entity they're floating over.
export class DamageNumbers {
    /**
     * @param {HTMLElement} overlay - Element to spawn popups into.
     */
    constructor(overlay) {
        this.overlay = overlay;
        this.active = [];
    }

    /**
     * @param {number} worldX - World X to float up from.
     * @param {number} worldY - World Y to float up from.
     * @param {number} amount - Damage amount, rounded for display.
     */
    spawn(worldX, worldY, amount) {
        this._spawn(worldX, worldY, String(Math.round(amount)), 'damage-number', DAMAGE_DURATION_SECONDS);
    }

    /**
     * Generic text popup (see .status-message in style.css for its look,
     * distinct from .damage-number) - same float/fade mechanic as spawn(),
     * just not tied to a numeric amount.
     * @param {number} worldX - World X to float up from.
     * @param {number} worldY - World Y to float up from.
     * @param {string} text - Status text to display.
     */
    spawnStatus(worldX, worldY, text) {
        this._spawn(worldX, worldY, text, 'status-message', STATUS_DURATION_SECONDS);
    }

    /**
     * @param {number} worldX - World X to float up from.
     * @param {number} worldY - World Y to float up from.
     * @param {string} text - Text to display.
     * @param {string} className - CSS class controlling its look.
     * @param {number} durationSeconds - How long it stays visible.
     */
    _spawn(worldX, worldY, text, className, durationSeconds) {
        const el = document.createElement('div');
        el.className = className;
        el.textContent = text;
        this.overlay.appendChild(el);
        this.active.push({ el, worldX, worldY, age: 0, durationSeconds });
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     * @param {Camera} camera - Camera to project world coordinates through.
     */
    update(dt, camera) {
        for (const entry of this.active) {
            entry.age += dt;
            const progress = Math.min(1, entry.age / entry.durationSeconds);
            entry.el.style.left = `${(entry.worldX - camera.x) * camera.zoom}px`;
            entry.el.style.top = `${(entry.worldY - camera.y - RISE_PX * progress) * camera.zoom}px`;
            entry.el.style.opacity = String(1 - progress);
        }

        const expired = this.active.filter((entry) => entry.age >= entry.durationSeconds);
        for (const entry of expired) entry.el.remove();
        this.active = this.active.filter((entry) => entry.age < entry.durationSeconds);
    }

    /**
     * Removes every active popup immediately (e.g. on level teardown).
     */
    clear() {
        for (const entry of this.active) entry.el.remove();
        this.active = [];
    }
}
