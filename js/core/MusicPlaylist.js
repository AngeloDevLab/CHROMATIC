export class MusicPlaylist {
    /**
     * Cycles randomly through a set of tracks as ambient background music,
     * crossfading into the next one once the current one ends. A dedicated
     * track (e.g. a boss fight) can take over via SoundManager.playMusic()
     * directly; call pause()/resume() around that so the playlist doesn't
     * chain in a new track while the dedicated one is playing.
     * @param {SoundManager} sound - Owning SoundManager.
     * @param {string[]} trackKeys - Keys tracks were loaded under.
     */
    constructor(sound, trackKeys) {
        this.sound = sound;
        this.trackKeys = trackKeys;
        this.paused = false;
    }

    /**
     * Starts playback with a random track, then keeps chaining into more
     * random tracks as each one ends.
     */
    start() {
        this._playRandomTrack();
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
     * Resumes the rotation with a fresh random track.
     */
    resume() {
        this.paused = false;
        this._playRandomTrack();
    }

    /**
     * Picks a random track and chains the next one once it ends.
     */
    _playRandomTrack() {
        const key = this.trackKeys[Math.floor(Math.random() * this.trackKeys.length)];
        this.sound.playMusic(key, {
            loop: false,
            onEnded: () => { if (!this.paused) this._playRandomTrack(); },
        });
    }
}
