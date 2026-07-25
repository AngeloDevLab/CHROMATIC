import { Game } from './core/Game.js';
import { AssetLoader } from './core/AssetLoader.js';
import { InputHandler } from './core/InputHandler.js';
import { SaveSystem } from './core/SaveSystem.js';
import { SoundManager } from './core/SoundManager.js';
import { MusicPlaylist } from './core/MusicPlaylist.js';
import { applyAudioPreferences } from './ui/SettingsPanel.js';
import { LoadingState } from './states/LoadingState.js';
import { MenuState } from './states/MenuState.js';
import { CutsceneState } from './states/CutsceneState.js';
import { WorldmapState } from './states/WorldmapState.js';
import { GameState } from './states/GameState.js';
import { DevPanel } from './ui/DevPanel.js';

/**
 * Persists the fullscreen state on every change, regardless of what
 * triggered it (Settings panel checkbox, browser F11, Escape key), so
 * LoadingState can re-apply it on the next boot.
 * @param {SaveSystem} save - Persisted player preferences.
 */
function trackFullscreenChanges(save) {
    document.addEventListener('fullscreenchange', () => {
        save.set('fullscreen', !!document.fullscreenElement);
    });
}

// 'ost-08' ("The Iron Sentinel") is deliberately excluded - reserved for
// boss encounters, wired in separately once GameState triggers it.
const AMBIENT_TRACK_KEYS = ['ost-00', 'ost-01', 'ost-02', 'ost-03', 'ost-04', 'ost-05', 'ost-06', 'ost-07'];

const game = new Game('game-canvas', 'ui-overlay');
game.assets = new AssetLoader();
game.input = new InputHandler(game.canvas);
game.save = new SaveSystem();
game.sound = new SoundManager();
game.music = new MusicPlaylist(game.sound, AMBIENT_TRACK_KEYS);
applyAudioPreferences(game);
trackFullscreenChanges(game.save);
game.devPanel = new DevPanel(game);
game.stateMachine.register('loading', new LoadingState(game));
game.stateMachine.register('menu', new MenuState(game));
game.stateMachine.register('cutscene', new CutsceneState(game));
game.stateMachine.register('worldmap', new WorldmapState(game));
game.stateMachine.register('game', new GameState(game));
game.stateMachine.change('loading');
game.start();
