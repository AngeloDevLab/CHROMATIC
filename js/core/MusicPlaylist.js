// Every OST track, in file order - the Main Menu/Worldmap's shared zone
// (02_game-structure.md's Worldmap has no music of its own, reuses the
// Menu's list). 'ost-08' ("The Iron Sentinel") plays here too now - no
// longer boss-exclusive, just also part of Lv3/Lv6's own zones below.
export const MENU_ZONE = 'menu';
export const MENU_TRACK_KEYS = ['ost-00', 'ost-01', 'ost-02', 'ost-03', 'ost-04', 'ost-05', 'ost-06', 'ost-07', 'ost-08'];

// Per-level-group zones (LevelSession.js picks the right one off
// this by levelNumber) - session decision on which tracks fit which levels,
// in the order they should play. Lv1/Lv2 share a zone (so walking from one
// into the other doesn't interrupt whatever's already playing), same for
// Lv4/Lv5. 'ost-08' also appears in Lv3/Lv6 (both boss levels) - it can
// come up in the natural rotation there instead of needing a forced
// override the instant a boss fight starts.
export const LEVEL_MUSIC_ZONES = {
    1: { zone: 'lv1-2', trackKeys: ['ost-00', 'ost-01', 'ost-02', 'ost-06'] },
    2: { zone: 'lv1-2', trackKeys: ['ost-00', 'ost-01', 'ost-02', 'ost-06'] },
    3: { zone: 'lv3', trackKeys: ['ost-07', 'ost-03', 'ost-08'] },
    4: { zone: 'lv4-5', trackKeys: ['ost-03', 'ost-04', 'ost-05'] },
    5: { zone: 'lv4-5', trackKeys: ['ost-03', 'ost-04', 'ost-05'] },
    6: { zone: 'lv6', trackKeys: ['ost-07', 'ost-08'] },
};

// Cycles sequentially (not randomly - session decision) through whichever
// zone's track list is currently active, crossfading into the next one once
// the current one ends. setZone() no-ops if the requested zone is already
// active, so moving between two screens that share one (Menu <-> Worldmap,
// Lv1 <-> Lv2, Lv4 <-> Lv5) never interrupts whatever's already playing - it
// only restarts (from that zone's first track) when the zone actually changes.
export class MusicPlaylist {
    /**
     * @param {SoundManager} sound - Owning SoundManager.
     */
    constructor(sound) {
        this.sound = sound;
        this.zone = null;
        this.trackKeys = [];
        this.index = 0;
        this.paused = false;
        // main.js sets the initial zone before start() is ever called (so
        // it's already in place the instant start() does run) - _started
        // gates setZone() from trying to play anything before that, since
        // playMusic() needs the AudioContext-unlocking user gesture start()
        // is itself gated behind (LoadingState.js's "press any key/tap").
        this._started = false;
        // SoundManager.playMusic()'s crossfade stops the outgoing track via
        // source.stop(), which - same as a track reaching its end on its
        // own - fires that track's onended. Without this, a track cut short
        // by a zone switch still fires its *own* onEnded a fadeSeconds
        // later, and since index/trackKeys live on this shared instance,
        // that stale callback would advance/replay whatever zone is current
        // by *then*, not the one it was actually attached to - a self-
        // sustaining cascade of tracks cutting each other off almost
        // immediately. Each _playCurrentTrack() call bumps this and only
        // its own onEnded closure's captured value still matches by the
        // time it fires - a stale one is silently ignored instead.
        this._generation = 0;
    }

    /**
     * Switches to a named zone's track list, starting from its first track -
     * a no-op if this zone is already the one playing. Only actually plays
     * once start() has run (see the constructor's note); before that, just
     * records which zone should play once it does.
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
     * Starts playback from the zone's current track - call once at boot,
     * after main.js's initial setZone(), from inside the user-gesture
     * handler that also resumes the AudioContext (SoundManager.resume()).
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
     * Plays the zone's track at `index`, advancing (and wrapping) to the
     * next one once it ends - guarded against a stale onEnded from a track
     * that got cut short by a since-superseded zone switch (see the
     * constructor's note on _generation).
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
