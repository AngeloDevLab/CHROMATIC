export class Camera {
    constructor(viewWidth, viewHeight) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        // 10_technical-architecture.md 11.7.3: a boss fight's zoom-out is a
        // camera parameter, not a change to the base 640x360 resolution -
        // GameState.render() applies this as a ctx.scale() around the world
        // draw. 1 = normal (32px/tile); below 1 fits more world into the same
        // buffer (e.g. 0.75 -> ~24px/tile, more field of view).
        this.zoom = 1;
        this.x = 0;
        this.y = 0;
    }

    follow(target, levelPixelWidth, levelPixelHeight) {
        // At zoom < 1, more world is visible on screen than viewWidth/Height
        // (screen pixels) actually covers - divide by zoom to get how much
        // world-space the camera needs to center/clamp against.
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
