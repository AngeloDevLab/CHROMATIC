/** Base class for every game object: position/size/velocity, update()/render(). */
export class Entity {
    /**
     * Sets up position, size, and zeroed velocity.
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
        this.velocityX = 0;
        this.velocityY = 0;
    }

    /**
     * Integrates position from velocity. Subclasses call super.update(deltaTime)
     * and layer additional behavior on top.
     * @param {number} deltaTime - Fixed timestep in seconds.
     */
    update(deltaTime) {
        this.x += this.velocityX * deltaTime;
        this.y += this.velocityY * deltaTime;
    }

    /**
     * No-op by default; subclasses override to draw themselves.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {}

    /**
     * Horizontal center of the bounding box.
     * @returns {number} World X of the bounding box's horizontal center.
     */
    get centerX() {
        return this.x + this.width / 2;
    }

    /**
     * Vertical center of the bounding box.
     * @returns {number} World Y of the bounding box's vertical center.
     */
    get centerY() {
        return this.y + this.height / 2;
    }
}
