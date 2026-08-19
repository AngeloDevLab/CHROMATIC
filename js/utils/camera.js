// Boss zoom-out is a camera param, not a resolution change - `zoom` is
// applied via ctx.scale() elsewhere (1 = normal 32px/tile, e.g. 0.75 ->
// ~24px/tile for more FOV). follow() divides viewWidth/viewHeight by zoom
// to convert screen-space bounds into world-space before clamping.
export class Camera {
    /**
     * Sets up the camera at the origin with no zoom.
     * @param {number} viewWidth - Viewport width in screen pixels (640 at base resolution).
     * @param {number} viewHeight - Viewport height in screen pixels (360 at base resolution).
     */
    constructor(viewWidth, viewHeight) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.zoom = 1;
        this.x = 0;
        this.y = 0;
    }

    /**
     * Centers the camera on a target and clamps it to the level bounds.
     * @param {{centerX: number, centerY: number}} target - Entity to follow (typically the Player).
     * @param {number} levelPixelWidth - Level width in world pixels.
     * @param {number} levelPixelHeight - Level height in world pixels.
     */
    follow(target, levelPixelWidth, levelPixelHeight) {
        const effectiveWidth = this.viewWidth / this.zoom;
        const effectiveHeight = this.viewHeight / this.zoom;

        const desiredX = target.centerX - effectiveWidth / 2;
        const desiredY = target.centerY - effectiveHeight / 2;

        const maxX = Math.max(0, levelPixelWidth - effectiveWidth);
        const maxY = Math.max(0, levelPixelHeight - effectiveHeight);

        this.x = Math.max(0, Math.min(desiredX, maxX));
        this.y = Math.max(0, Math.min(desiredY, maxY));
    }
}
