import { Game } from './core/Game.js';
import { AssetLoader } from './core/AssetLoader.js';
import { InputHandler } from './core/InputHandler.js';
import { LoadingState } from './states/LoadingState.js';
import { MenuState } from './states/MenuState.js';
import { CutsceneState } from './states/CutsceneState.js';
import { WorldmapState } from './states/WorldmapState.js';
import { GameState } from './states/GameState.js';

const game = new Game('game-canvas', 'ui-overlay');
game.assets = new AssetLoader();
game.input = new InputHandler(game.canvas);

game.stateMachine.register('loading', new LoadingState(game));
game.stateMachine.register('menu', new MenuState(game));
game.stateMachine.register('cutscene', new CutsceneState(game));
game.stateMachine.register('worldmap', new WorldmapState(game));
game.stateMachine.register('game', new GameState(game));

game.stateMachine.change('loading');
game.start();

const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen().catch(() => { });
    }
});
document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.textContent = document.fullscreenElement ? '⤢' : '⛶';
});
