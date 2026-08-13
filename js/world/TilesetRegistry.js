/**
 * Tiled tileset basename
 * manifest image key + column count. 
 * Add an entry here when a new tileset is added to the project.
 */
const TILESET_KEYS = {
    tileset_grass: { imageKey: 'prologue-tileset', columns: 5 },
    tileset_gravel: { imageKey: 'tileset-gravel', columns: 5 },
    tileset_scifilab: { imageKey: 'tileset-scifilab', columns: 9 },
};

/**
 * Builds the tileset registry by resolving each basename to its loaded image.
 * @param {AssetLoader} assets - Loader holding the tileset images.
 * @returns {Object<string, {image: HTMLImageElement, columns: number}>} Resolved tileset data, keyed by basename.
 */
export function buildTilesetRegistry(assets) {
    const registry = {};
    for (const [basename, { imageKey, columns }] of Object.entries(TILESET_KEYS)) {
        registry[basename] = { image: assets.getImage(imageKey), columns };
    }
    return registry;
}
