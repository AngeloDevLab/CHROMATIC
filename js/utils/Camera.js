export class Camera {
    constructor(viewWidth, viewHeight) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.x = 0;
        this.y = 0;
    }

    follow(target, levelPixelWidth, levelPixelHeight) {
        const desiredX = target.centerX - this.viewWidth / 2;
        const desiredY = target.centerY - this.viewHeight / 2;

        const maxX = Math.max(0, levelPixelWidth - this.viewWidth);
        const maxY = Math.max(0, levelPixelHeight - this.viewHeight);

        this.x = Math.max(0, Math.min(desiredX, maxX));
        this.y = Math.max(0, Math.min(desiredY, maxY));
    }
}
