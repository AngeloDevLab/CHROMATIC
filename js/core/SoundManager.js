export class SoundManager {
    /**
     * Web Audio GainNode hierarchy: Master -> Music/SFX/Ambience. Each bus's
     * gain is the player-facing volume control; music additionally layers a
     * per-track gain on top for crossfading.
     */
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.buses = this._createBuses();
        this.buffers = new Map();
        this.currentTrack = null;
        this.volumes = { master: 0.5, music: 0.5, sfx: 0.5, ambience: 0.5 };
        this.muted = false;
    }

    /**
     * Builds the Master bus and the three sub-buses connected into it.
     * @returns {{master: GainNode, music: GainNode, sfx: GainNode, ambience: GainNode}}
     */
    _createBuses() {
        const master = this.context.createGain();
        master.connect(this.context.destination);
        return {
            master,
            music: this._connectedGain(master),
            sfx: this._connectedGain(master),
            ambience: this._connectedGain(master),
        };
    }

    /**
     * Creates a new gain node and wires it into a destination.
     * @param {AudioNode} destination - Node to connect the new gain into.
     * @returns {GainNode} A gain node already wired to destination.
     */
    _connectedGain(destination) {
        const gain = this.context.createGain();
        gain.connect(destination);
        return gain;
    }

    /**
     * Fetches and decodes an audio file, storing it under a key for playback.
     * @param {string} key - Identifier used by playMusic()/playSfx().
     * @param {string} src - URL/path to the audio file.
     */
    async load(key, src) {
        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            this.buffers.set(key, await this.context.decodeAudioData(arrayBuffer));
        } catch (error) {
            console.error(`Failed to load sound: ${src}`, error);
        }
    }

    /**
     * Loads every entry in a manifest in parallel.
     * @param {Object<string,string>} manifest - Key-to-path map of audio files.
     * @param {() => void} [onItemLoaded] - Called once per entry as it settles, for progress display.
     * @returns {Promise<void>} Resolves once every entry has settled.
     */
    async loadManifest(manifest, onItemLoaded) {
        await Promise.all(Object.entries(manifest).map(async ([key, src]) => {
            await this.load(key, src);
            onItemLoaded?.();
        }));
    }

    /**
     * Resumes the AudioContext. Browsers create it suspended until a user gesture.
     */
    resume() {
        if (this.context.state === 'suspended') this.context.resume();
    }

    /**
     * Plays a one-shot sound effect on the SFX bus.
     * @param {string} key - Key a sound was loaded under.
     */
    playSfx(key) {
        const buffer = this.buffers.get(key);
        if (!buffer) return;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.buses.sfx);
        source.start();
    }

    /**
     * Crossfades from whatever's currently playing on the Music bus into a new track.
     * @param {string} key - Key a track was loaded under.
     * @param {object} [options] - Optional playback settings.
     * @param {number} [options.fadeSeconds=1] - Crossfade duration, in seconds.
     * @param {boolean} [options.loop=true] - Whether the track repeats itself.
     * @param {() => void} [options.onEnded] - Called when a non-looping track finishes.
     */
    playMusic(key, { fadeSeconds = 1, loop = true, onEnded } = {}) {
        const buffer = this.buffers.get(key);
        if (!buffer) return;
        this._fadeOutCurrentTrack(fadeSeconds);
        this.currentTrack = this._startTrack(buffer, fadeSeconds, loop, onEnded);
    }

    /**
     * Fades out and stops whatever's currently playing on the Music bus, without starting a replacement.
     * @param {number} [fadeSeconds=1] - Fade-out duration, in seconds.
     */
    stopMusic(fadeSeconds = 1) {
        this._fadeOutCurrentTrack(fadeSeconds);
        this.currentTrack = null;
    }

    /**
     * Ramps the currently playing track's own gain to 0 and stops it once faded.
     * @param {number} fadeSeconds - Fade-out duration, in seconds.
     */
    _fadeOutCurrentTrack(fadeSeconds) {
        if (!this.currentTrack) return;
        const { source, gain } = this.currentTrack;
        const now = this.context.currentTime;
        gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        source.stop(now + fadeSeconds);
    }

    /**
     * Starts a buffer through its own gain node, ramped in from 0.
     * @param {AudioBuffer} buffer - Decoded audio to play.
     * @param {number} fadeSeconds - Fade-in duration, in seconds.
     * @param {boolean} loop - Whether the track repeats itself.
     * @param {(() => void)|undefined} onEnded - Called when a non-looping track finishes.
     * @returns {{source: AudioBufferSourceNode, gain: GainNode}} The new track's nodes.
     */
    _startTrack(buffer, fadeSeconds, loop, onEnded) {
        const gain = this._connectedGain(this.buses.music);
        const now = this.context.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + fadeSeconds);

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = loop;
        if (onEnded) source.onended = onEnded;
        source.connect(gain);
        source.start();
        return { source, gain };
    }

    /**
     * Sets a bus's overall volume. While muted, changes to Master are
     * remembered but not applied.
     * @param {'master'|'music'|'sfx'|'ambience'} bus - Which bus to adjust.
     * @param {number} value - Slider position, 0 (silent) to 1 (full volume).
     */
    setVolume(bus, value) {
        this.volumes[bus] = value;
        if (bus === 'master' && this.muted) return;
        this.buses[bus].gain.value = this._toGain(value);
    }

    /**
     * Mutes/unmutes all audio by zeroing the Master bus, without touching
     * the individual bus volumes those sliders represent.
     * @param {boolean} muted - Whether audio should be silenced.
     */
    setMuted(muted) {
        this.muted = muted;
        this.buses.master.gain.value = muted ? 0 : this._toGain(this.volumes.master);
    }

    /**
     * Converts a linear slider position (0-1) into actual gain, squared to
     * taper it closer to perceived loudness.
     * @param {number} sliderValue - Slider position, 0 to 1.
     * @returns {number} Actual linear gain to apply to a GainNode.
     */
    _toGain(sliderValue) {
        return sliderValue * sliderValue;
    }
}
