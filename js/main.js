import { Game } from './core/game.js';
import { AssetLoader } from './core/asset-loader.js';
import { InputHandler } from './core/input-handler.js';
import { SaveSystem } from './core/save-system.js';
import { SoundManager } from './core/sound-manager.js';
import { MusicPlaylist, MENU_ZONE, MENU_TRACK_KEYS } from './core/music-playlist.js';
import { applyAudioPreferences } from './ui/settings-panel.js';
import { LoadingState } from './states/loading-state.js';
import { MenuState } from './states/menu-state.js';
import { CutsceneState } from './states/cutscene-state.js';
import { WorldmapState } from './states/worldmap-state.js';
import { GameState } from './states/game-state.js';
import { BossState } from './states/boss-state.js';
import { PauseState } from './states/pause-state.js';
import { GameOverState } from './states/game-over-state.js';
import { BuffState } from './states/buff-state.js';
import { DevPanel } from './ui/dev-panel.js';
import { LandscapeGate } from './ui/landscape-gate.js';

/**
 * Persists the fullscreen state on every change, regardless of what triggered it.
 * @param {SaveSystem} save - Persisted player preferences.
 */
function trackFullscreenChanges(save) {
    document.addEventListener('fullscreenchange', () => {
        save.set('fullscreen', !!document.fullscreenElement);
    });
}

/**
 * Creates the Game instance and wires up its core singleton systems.
 * @returns {Game} The configured game instance.
 */
function createGame() {
    const game = new Game('game-canvas', 'ui-overlay');
    game.assets = new AssetLoader();
    game.input = new InputHandler(game.canvas);
    game.save = new SaveSystem();
    game.loadProgress();
    game.sound = new SoundManager();
    game.music = new MusicPlaylist(game.sound);
    game.music.setZone(MENU_ZONE, MENU_TRACK_KEYS);
    applyAudioPreferences(game);
    return game;
}

/**
 * Registers every screen state with the game's state machine.
 * @param {Game} game - The game instance to register states on.
 */
function registerStates(game) {
    game.stateMachine.register('loading', new LoadingState(game));
    game.stateMachine.register('menu', new MenuState(game));
    game.stateMachine.register('cutscene', new CutsceneState(game));
    game.stateMachine.register('worldmap', new WorldmapState(game));
    game.stateMachine.register('game', new GameState(game));
    game.stateMachine.register('boss', new BossState(game));
    game.stateMachine.register('pause', new PauseState(game));
    game.stateMachine.register('gameover', new GameOverState(game));
    game.stateMachine.register('buff', new BuffState(game));
}

/**
 * Boots the game: builds core systems, registers states, and starts the loop.
 */
function bootstrap() {
    const game = createGame();
    trackFullscreenChanges(game.save);
    game.devPanel = new DevPanel(game);
    game.landscapeGate = new LandscapeGate(game);
    registerStates(game);
    game.stateMachine.change('loading');
    game.start();
}

bootstrap();
