export class Entity {
    /**
     * @param {number} x - World X position (top-left).
     * @param {number} y - World Y position (top-left).
     * @param {number} width - Bounding box width, in pixels.
     * @param {number} height - Bounding box height, in pixels.
     */
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.vx = 0;
        this.vy = 0;
    }

    /**
     * Integrates position from velocity. Subclasses call super.update(dt)
     * and layer additional behavior on top.
     * @param {number} dt - Fixed timestep in seconds.
     */
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    /**
     * No-op by default; subclasses override to draw themselves.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {}

    /**
     * @returns {number} World X of the bounding box's horizontal center.
     */
    get centerX() {
        return this.x + this.width / 2;
    }

    /**
     * @returns {number} World Y of the bounding box's vertical center.
     */
    get centerY() {
        return this.y + this.height / 2;
    }
}
