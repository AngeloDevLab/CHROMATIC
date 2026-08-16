const RISE_PX = 20;
const DAMAGE_DURATION_SECONDS = 0.7;

const STATUS_DURATION_SECONDS = 1.2;

// Floating popups over an entity's head - damage numbers over enemies, short
// status text over the player. Rendered via the HTML overlay, not canvas
// fillText, so update() reprojects world coordinates through camera.zoom
// every frame to stay aligned with the canvas's own scaling.
export class DamageNumbers {
    /**
     * Sets up an empty popup pool over the given overlay.
     * @param {HTMLElement} overlay - Element to spawn popups into.
     */
    constructor(overlay) {
        this.overlay = overlay;
        this.active = [];
    }

    /**
     * Spawns a floating damage number.
     * @param {number} worldX - World X to float up from.
     * @param {number} worldY - World Y to float up from.
     * @param {number} amount - Damage amount, rounded for display.
     */
    spawn(worldX, worldY, amount) {
        this._spawn(worldX, worldY, String(Math.round(amount)), 'damage-number', DAMAGE_DURATION_SECONDS);
    }

    /**
     * Generic text popup - same float/fade mechanic as spawn(), just not
     * tied to a numeric amount.
     * @param {number} worldX - World X to float up from.
     * @param {number} worldY - World Y to float up from.
     * @param {string} text - Status text to display.
     */
    spawnStatus(worldX, worldY, text) {
        this._spawn(worldX, worldY, text, 'status-message', STATUS_DURATION_SECONDS);
    }

    /**
     * Creates and tracks one popup element.
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
     * Rises, fades, and repositions every active popup, pruning expired ones.
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
