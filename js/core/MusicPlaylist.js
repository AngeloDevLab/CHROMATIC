/**
 * Every OST track, in file order. Shared by the Main Menu and Worldmap zones.
 */
export const MENU_ZONE = 'menu';
export const MENU_TRACK_KEYS = ['ost-00', 'ost-01', 'ost-02', 'ost-03', 'ost-04', 'ost-05', 'ost-06', 'ost-07', 'ost-08'];

/**
 * Per-level-group zones, keyed by levelNumber. Lv1/Lv2 and Lv4/Lv5 share a
 * zone so moving between them doesn't interrupt playback.
 */
export const LEVEL_MUSIC_ZONES = {
    1: { zone: 'lv1-2', trackKeys: ['ost-00', 'ost-01', 'ost-02', 'ost-06'] },
    2: { zone: 'lv1-2', trackKeys: ['ost-00', 'ost-01', 'ost-02', 'ost-06'] },
    3: { zone: 'lv3', trackKeys: ['ost-07', 'ost-03', 'ost-08'] },
    4: { zone: 'lv4-5', trackKeys: ['ost-03', 'ost-04', 'ost-05'] },
    5: { zone: 'lv4-5', trackKeys: ['ost-03', 'ost-04', 'ost-05'] },
    6: { zone: 'lv6', trackKeys: ['ost-07', 'ost-08'] },
};

/**
 * Cycles sequentially through whichever zone's track list is currently
 * active, crossfading into the next track once the current one ends.
 * setZone() no-ops if the requested zone is already active.
 */
export class MusicPlaylist {
    zone = null;
    trackKeys = [];
    index = 0;
    paused = false;

    /**
     * Gates setZone() from playing anything before start() has been called.
     */
    _started = false;

    /**
     * Guards against a stale onEnded firing from a track cut short by a since-superseded zone switch.
     */
    _generation = 0;

    /**
     * @param {SoundManager} sound - Owning SoundManager.
     */
    constructor(sound) {
        this.sound = sound;
    }

    /**
     * Switches to a named zone's track list, starting from its first track.
     * A no-op if this zone is already active; before start() has run, just
     * records which zone should play.
     * @param {string} zone
     * @param {string[]} trackKeys
     */
    setZone(zone, trackKeys) {
        if (zone === this.zone) return;
        this.zone = zone;
        this.trackKeys = trackKeys;
        this.index = 0;
        if (this._started && !this.paused) this._playCurrentTrack();
    }

    /**
     * Starts playback from the zone's current track.
     */
    start() {
        this._started = true;
        this._playCurrentTrack();
    }

    /**
     * Stops the playlist from chaining in further tracks. The currently
     * playing track keeps ringing out; call SoundManager.stopMusic() too if
     * it should also be cut short (e.g. right before a boss track starts).
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resumes the rotation from wherever it left off in the current zone.
     */
    resume() {
        this.paused = false;
        this._playCurrentTrack();
    }

    /**
     * Plays the zone's track at `index`, advancing (and wrapping) to the next one once it ends.
     */
    _playCurrentTrack() {
        this._generation += 1;
        const generation = this._generation;
        const key = this.trackKeys[this.index];
        this.sound.playMusic(key, {
            loop: false,
            onEnded: () => {
                if (this.paused || generation !== this._generation) return;
                this.index = (this.index + 1) % this.trackKeys.length;
                this._playCurrentTrack();
            },
        });
    }
}
