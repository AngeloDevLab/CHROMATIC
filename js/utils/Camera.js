// 10_technical-architecture.md 11.7.3: a boss fight's zoom-out is a camera
// parameter, not a change to the base 640x360 resolution - GameState.render()
// applies `zoom` as a ctx.scale() around the world draw. 1 = normal (32px/
// tile); below 1 fits more world into the same buffer (e.g. 0.75 -> ~24px/
// tile, more field of view). follow() divides viewWidth/viewHeight by zoom
// to convert screen-space bounds into the matching world-space bounds before
// centering/clamping against the level.

export class Camera {
    /**
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
