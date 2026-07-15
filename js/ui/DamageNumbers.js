const RISE_PX = 20;
const DURATION_SECONDS = 0.7;

// Floating damage numbers over an enemy's head. Text always renders through
// the HTML overlay, never canvas fillText (10_technical-architecture.md
// 11.8/11.8.1) - so this manages a small pool of overlay elements and
// recomputes their screen position from world coordinates every frame, since
// #ui-overlay doesn't scroll with Camera.js the way the canvas does.
export class DamageNumbers {
    constructor(overlay) {
        this.overlay = overlay;
        this.active = [];
    }

    spawn(worldX, worldY, amount) {
        const el = document.createElement('div');
        el.className = 'damage-number';
        el.textContent = String(Math.round(amount));
        this.overlay.appendChild(el);
        this.active.push({ el, worldX, worldY, age: 0 });
    }

    update(dt, camera) {
        for (const entry of this.active) {
            entry.age += dt;
            const progress = Math.min(1, entry.age / DURATION_SECONDS);
            entry.el.style.left = `${entry.worldX - camera.x}px`;
            entry.el.style.top = `${entry.worldY - camera.y - RISE_PX * progress}px`;
            entry.el.style.opacity = String(1 - progress);
        }

        const expired = this.active.filter((entry) => entry.age >= DURATION_SECONDS);
        for (const entry of expired) entry.el.remove();
        this.active = this.active.filter((entry) => entry.age < DURATION_SECONDS);
    }

    clear() {
        for (const entry of this.active) entry.el.remove();
        this.active = [];
    }
}
