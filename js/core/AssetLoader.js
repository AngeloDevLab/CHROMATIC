export class AssetLoader {
    constructor() {
        this.images = new Map();
        this.json = new Map();
    }

    loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(key, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }

    async loadJSON(key, src) {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Failed to load JSON: ${src}`);
        const data = await response.json();
        this.json.set(key, data);
        return data;
    }

    async loadManifest(manifest) {
        const tasks = [
            ...Object.entries(manifest.images ?? {}).map(([key, src]) => this.loadImage(key, src)),
            ...Object.entries(manifest.json ?? {}).map(([key, src]) => this.loadJSON(key, src)),
        ];
        await Promise.all(tasks);
    }

    // Stitches multiple same-width tileset images into one, stacked
    // top-to-bottom in the given order, and registers the result under `key`
    // - lets a level span more than one Tiled tileset (matches Tiled's own
    // global gid numbering: firstgid order is exactly "concatenate tilesets
    // in this order") without Level.js needing to know about multiple images
    // or gid ranges. Only correct when every source tileset's own tile count
    // is an exact multiple of its column count (true for every tileset in
    // this project so far, no partial last row) - a partial row would
    // misalign the next tileset's first tile.
    composeTileset(key, sourceKeys) {
        const images = sourceKeys.map((sourceKey) => this.images.get(sourceKey));
        const canvas = document.createElement('canvas');
        canvas.width = images[0].width;
        canvas.height = images.reduce((sum, image) => sum + image.height, 0);

        const ctx = canvas.getContext('2d');
        let y = 0;
        for (const image of images) {
            ctx.drawImage(image, 0, y);
            y += image.height;
        }

        this.images.set(key, canvas);
        return canvas;
    }

    getImage(key) {
        return this.images.get(key);
    }

    getJSON(key) {
        return this.json.get(key);
    }
}
