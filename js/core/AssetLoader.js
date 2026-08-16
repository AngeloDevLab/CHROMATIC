export class AssetLoader {
    constructor() {
        this.images = new Map();
        this.json = new Map();
    }

    /**
     * Loads an image and stores it under a key for later lookup.
     * @param {string} key - Identifier used by getImage() to retrieve it.
     * @param {string} src - URL/path to the image file.
     * @returns {Promise<HTMLImageElement>} Resolves with the loaded image.
     */
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

    /**
     * Fetches and parses a JSON file, storing it under a key for later lookup.
     * @param {string} key - Identifier used by getJSON() to retrieve it.
     * @param {string} src - URL/path to the JSON file.
     * @returns {Promise<object>} Resolves with the parsed JSON data.
     */
    async loadJSON(key, src) {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Failed to load JSON: ${src}`);
        const data = await response.json();
        this.json.set(key, data);
        return data;
    }

    /**
     * Loads every image/JSON entry in a manifest in parallel.
     * @param {{images?: Object<string,string>, json?: Object<string,string>}} manifest - Key-to-path maps per asset type.
     * @param {() => void} [onItemLoaded] - Called once per entry as it finishes, for progress display.
     * @returns {Promise<void>} Resolves once every entry has loaded.
     */
    async loadManifest(manifest, onItemLoaded) {
        const track = (promise) => promise.then((result) => { onItemLoaded?.(); return result; });
        const tasks = [
            ...Object.entries(manifest.images ?? {}).map(([key, src]) => track(this.loadImage(key, src))),
            ...Object.entries(manifest.json ?? {}).map(([key, src]) => track(this.loadJSON(key, src))),
        ];
        await Promise.all(tasks);
    }

    /**
     * Looks up a previously loaded image.
     * @param {string} key - Key an image was loaded under.
     * @returns {HTMLImageElement|undefined} The loaded image, if present.
     */
    getImage(key) {
        return this.images.get(key);
    }

    /**
     * Looks up a previously loaded JSON file.
     * @param {string} key - Key a JSON file was loaded under.
     * @returns {object|undefined} The parsed JSON data, if present.
     */
    getJSON(key) {
        return this.json.get(key);
    }
}
