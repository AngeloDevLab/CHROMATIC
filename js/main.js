import { Game } from './core/Game.js';
import { AssetLoader } from './core/AssetLoader.js';
import { InputHandler } from './core/InputHandler.js';
import { LoadingState } from './states/LoadingState.js';
import { MenuState } from './states/MenuState.js';

const game = new Game('game-canvas', 'ui-overlay');
game.assets = new AssetLoader();
game.input = new InputHandler();

game.stateMachine.register('loading', new LoadingState(game));
game.stateMachine.register('menu', new MenuState(game));

game.stateMachine.change('loading');
game.start();

const fullscreenBtn = document.getElementById('fullscreen-btn');
fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen().catch(() => {});
    }
});
document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.textContent = document.fullscreenElement ? '⤢' : '⛶';
});
