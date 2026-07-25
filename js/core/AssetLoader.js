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

    getImage(key) {
        return this.images.get(key);
    }

    getJSON(key) {
        return this.json.get(key);
    }
}
