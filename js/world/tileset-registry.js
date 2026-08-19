/**
 * Maps each Tiled tileset basename to its manifest image key and column count.
 * Add an entry here when a new tileset is added to the project.
 */
const tileset_keys = {
    'tileset-grass': { imageKey: 'prologue-tileset', columns: 5 },
    'tileset-gravel': { imageKey: 'tileset-gravel', columns: 5 },
    'tileset-scifilab': { imageKey: 'tileset-scifilab', columns: 9 },
};

/**
 * Builds the tileset registry by resolving each basename to its loaded image.
 * @param {AssetLoader} assets - Loader holding the tileset images.
 * @returns {Object<string, {image: HTMLImageElement, columns: number}>} Resolved tileset data, keyed by basename.
 */
export function buildTilesetRegistry(assets) {
    const registry = {};
    for (const [basename, { imageKey, columns }] of Object.entries(tileset_keys)) {
        registry[basename] = { image: assets.getImage(imageKey), columns };
    }
    return registry;
}
