const STORAGE_KEY = 'chromatic-save';

/**
 * Thin JSON-over-localStorage wrapper for player preferences and progress.
 * Reads/writes a single namespaced blob (rather than one localStorage key
 * per value) so unrelated keys never collide with anything else on the
 * same origin, and a single JSON.parse/stringify covers every read/write.
 */
export class SaveSystem {
    constructor() {
        this.data = this._load();
    }

    /**
     * Reads and parses the stored blob, tolerating missing or corrupt data.
     * @returns {object} Parsed save data, or an empty object if none exists.
     */
    _load() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    /**
     * Reads a single value from the save data.
     * @param {string} key - Property name to read.
     * @param {*} [fallback] - Value to return if the key is absent.
     * @returns {*} The stored value, or fallback.
     */
    get(key, fallback) {
        return key in this.data ? this.data[key] : fallback;
    }

    /**
     * Writes a single value and persists the whole blob immediately.
     * @param {string} key - Property name to write.
     * @param {*} value - Value to store.
     */
    set(key, value) {
        this.data[key] = value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }
}
