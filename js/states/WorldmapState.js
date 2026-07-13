import { State } from './State.js';

// 02_game-structure.md 2.1 - only Prologue is active at game start, the rest
// unlock as previous chapters are completed. Real Worldmap art (background,
// node icons) replaces the placeholder background once it exists.
const CHAPTERS = [
    { id: 'prologue', label: 'Prologue', available: true },
    { id: 'chap1', label: 'Chap 1', available: false },
    { id: 'chap2', label: 'Chap 2', available: false },
    { id: 'chap3', label: 'Chap 3', available: false },
    { id: 'chap4', label: 'Chap 4', available: false },
    { id: 'epilogue', label: 'Epilogue', available: false },
];

export class WorldmapState extends State {
    enter() {
        this.chapterBar = document.createElement('div');
        this.chapterBar.className = 'chapter-bar';

        for (const chapter of CHAPTERS) {
            const button = document.createElement('button');
            button.className = 'chapter-button';
            button.textContent = chapter.label;

            if (chapter.available) {
                button.addEventListener('click', () => this._enterChapter(chapter.id));
            } else {
                button.disabled = true;
                button.title = 'Coming Soon';
            }

            this.chapterBar.appendChild(button);
        }

        this.game.overlay.appendChild(this.chapterBar);

        this.placeholderLabel = document.createElement('div');
        this.placeholderLabel.className = 'worldmap-placeholder-label';
        this.placeholderLabel.textContent = 'Worldmap - placeholder background';
        this.game.overlay.appendChild(this.placeholderLabel);
    }

    _enterChapter(chapterId) {
        this.game.stateMachine.change('game', chapterId);
    }

    exit() {
        this.chapterBar?.remove();
        this.placeholderLabel?.remove();
    }

    update(dt) {}

    render(ctx) {
        ctx.fillStyle = '#12141a';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
}
