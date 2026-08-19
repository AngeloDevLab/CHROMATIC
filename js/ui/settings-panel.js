const volume_buses = [
    { id: 'master', label: 'Master' },
    { id: 'music', label: 'Music' },
    { id: 'sfx', label: 'SFX' },
];

/**
 * Defaults to 50%, not full volume.
 */
const default_volume = 0.5;

/**
 * Reads a bus's saved volume, defaulting to default_volume when unset.
 * @param {Game} game - Owning Game instance (needs game.save).
 * @param {string} busId - 'master' | 'music' | 'sfx'.
 * @returns {number} Saved volume, 0 to 1.
 */
function getSavedVolume(game, busId) {
    return game.save.get(`volume.${busId}`, default_volume);
}

/**
 * Applies every saved bus volume and the saved mute state to the
 * SoundManager. Call once at boot so audio is already correct even before
 * the player opens Settings.
 * @param {Game} game - Owning Game instance (needs game.save and game.sound).
 */
export function applyAudioPreferences(game) {
    for (const bus of volume_buses) {
        game.sound.setVolume(bus.id, getSavedVolume(game, bus.id));
    }
    game.sound.setMuted(game.save.get('muted', false));
}

/**
 * Builds the mute checkbox + volume sliders markup for the Audio section.
 * @param {Game} game - Owning Game instance, used to read current values.
 * @returns {string} Audio section HTML.
 */
function buildAudioSection(game) {
    const sliders = volume_buses.map((bus) => `
        <label class="settings-row">
            <span>${bus.label} Volume</span>
            <input type="range" min="0" max="1" step="0.01" data-bus="${bus.id}" value="${getSavedVolume(game, bus.id)}">
        </label>
    `).join('');
    const muted = game.save.get('muted', false) ? 'checked' : '';

    return `
        <label class="settings-row">
            <span>Mute All</span>
            <input type="checkbox" id="settings-mute" ${muted}>
        </label>
        ${sliders}
    `;
}

/**
 * Builds the Display section markup (currently just the fullscreen toggle).
 * @returns {string} Display section HTML.
 */
function buildDisplaySection() {
    const checked = document.fullscreenElement ? 'checked' : '';
    return `
        <label class="settings-row">
            <span>Fullscreen</span>
            <input type="checkbox" id="settings-fullscreen" ${checked}>
        </label>
    `;
}

/**
 * Mirrors input-handler.js's KEY_MAP plus its two hardcoded keys (KeyP/KeyE)
 * and the mouse-click attack - read-only, no rebinding logic here. Key
 * rebinding UI is planned for Phase 2, not built yet.
 */
const controls = [
    { label: 'Run', keys: 'A / D or Left/Right Arrow' },
    { label: 'Jump', keys: 'W / Space / Up Arrow' },
    { label: 'Drop Through Platform', keys: 'S or Down Arrow' },
    { label: 'Attack', keys: 'Mouse Click or F' },
    { label: 'Interact', keys: 'E' },
    { label: 'Pause', keys: 'P' },
];

/**
 * Builds the read-only Controls section markup.
 * @returns {string} Controls section HTML.
 */
function buildControlsSection() {
    return controls.map((control) => `
        <div class="settings-row">
            <span>${control.label}</span>
            <span>${control.keys}</span>
        </div>
    `).join('');
}

/**
 * Builds the Settings panel's body HTML. Language stays a placeholder (no
 * i18n system exists yet); Controls is read-only (see controls above).
 * @param {Game} game - Owning Game instance, used to read current values.
 * @returns {string} Panel body HTML.
 */
export function buildSettingsBody(game) {
    return `
        <h3>Audio</h3>
        ${buildAudioSection(game)}
        <h3>Display</h3>
        ${buildDisplaySection()}
        <h3>Controls</h3>
        ${buildControlsSection()}
        <h3>Language</h3>
        <p>Language selection - coming soon.</p>
    `;
}

/**
 * Wires each volume slider to update the SoundManager live and persist the
 * change immediately.
 * @param {HTMLElement} root - The mounted panel's root element.
 * @param {Game} game - Owning Game instance (needs game.save and game.sound).
 */
function wireVolumeSliders(root, game) {
    for (const input of root.querySelectorAll('input[data-bus]')) {
        input.addEventListener('input', () => {
            const value = Number(input.value);
            game.sound.setVolume(input.dataset.bus, value);
            game.save.set(`volume.${input.dataset.bus}`, value);
        });
    }
}

/**
 * Wires the mute checkbox to the SoundManager, persisting the choice immediately.
 * @param {HTMLElement} root - The mounted panel's root element.
 * @param {Game} game - Owning Game instance (needs game.save and game.sound).
 */
function wireMuteToggle(root, game) {
    root.querySelector('#settings-mute').addEventListener('change', (event) => {
        game.sound.setMuted(event.target.checked);
        game.save.set('muted', event.target.checked);
    });
}

/**
 * Wires the fullscreen checkbox to the browser Fullscreen API. The
 * preference itself is persisted by main.js's global fullscreenchange
 * listener, not here.
 * @param {HTMLElement} root - The mounted panel's root element.
 */
function wireFullscreenToggle(root) {
    const checkbox = root.querySelector('#settings-fullscreen');
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            document.documentElement.requestFullscreen().catch(() => { checkbox.checked = false; });
        } else {
            document.exitFullscreen();
        }
    });
}

/**
 * Wires up every interactive control in the Settings panel.
 * @param {HTMLElement} root - The mounted panel's root element.
 * @param {Game} game - Owning Game instance (needs game.save and game.sound).
 */
export function wireSettingsPanel(root, game) {
    wireVolumeSliders(root, game);
    wireMuteToggle(root, game);
    wireFullscreenToggle(root);
}
