import { State } from './State.js';

// 02_game-structure.md 2.1 - only Prologue is active at game start, the rest
// unlock as previous chapters are completed.
const CHAPTERS = [
    { id: 'prologue', label: 'Prologue', available: true },
    { id: 'chap1', label: 'Chap 1', available: false },
    { id: 'chap2', label: 'Chap 2', available: false },
    { id: 'chap3', label: 'Chap 3', available: false },
    { id: 'chap4', label: 'Chap 4', available: false },
    { id: 'epilogue', label: 'Epilogue', available: false },
];

// Positions along the path, as a fraction of the SOURCE worldmap image
// (768x256) - not the viewport, since the image is contain-fit (see render())
// and converted to screen coordinates via that fit's offset/scale in
// _layoutNodes(). Rough estimate tracing the visible path, tune further once
// checked against the art. Slots match 02_game-structure.md 2.6 (Prologue,
// 1 Template, 6 levels).
const PROLOGUE_NODES = [
    { level: 1, type: 'Combat (Tutorial)', hasSecret: false, x: 0.06, y: 0.40 },
    { level: 2, type: 'Combat (Tutorial)', hasSecret: false, x: 0.20, y: 0.75 },
    { level: 3, type: 'Miniboss', hasSecret: false, x: 0.35, y: 0.45 },
    { level: 4, type: 'Special', hasSecret: false, x: 0.50, y: 0.55 },
    { level: 5, type: 'Secret', hasSecret: true, x: 0.65, y: 0.45 },
    { level: 6, type: 'Templateboss', hasSecret: false, x: 0.80, y: 0.55 },
];

const NODE_SIZE = 64;

export class WorldmapState extends State {
    /**
     * this.completedLevels reads Game.completedLevels rather than owning its
     * own Set - this state is torn down/rebuilt on every visit
     * (enter()/exit()), so a local Set here would forget completions the
     * instant the player left for a level and came back. No persistence
     * across page reloads yet (see TODO.md's LocalStorage save system entry).
     */
    enter() {
        this.background = this.game.assets.getImage('worldmap-prologue-bg');
        this._computeFit();

        this.completedLevels = this.game.completedLevels;
        this.selectedIndex = null;

        this._buildChapterBar();
        this._buildNodes();

        this._onCanvasClick = this._onCanvasClick.bind(this);
        this.game.canvas.addEventListener('click', this._onCanvasClick);
    }

    /**
     * Builds the top chapter-selection bar (only Prologue enabled).
     */
    _buildChapterBar() {
        this.chapterBar = document.createElement('div');
        this.chapterBar.className = 'chapter-bar';

        for (const chapter of CHAPTERS) {
            const button = document.createElement('button');
            button.className = 'chapter-button';
            button.textContent = chapter.label;

            if (!chapter.available) {
                button.disabled = true;
                button.title = 'Coming Soon';
            }

            this.chapterBar.appendChild(button);
        }

        this.game.overlay.appendChild(this.chapterBar);
    }

    /**
     * Builds one button element per Prologue node and lays them out.
     */
    _buildNodes() {
        this.nodeContainer = document.createElement('div');
        this.nodeContainer.className = 'worldmap-nodes';
        this.game.overlay.appendChild(this.nodeContainer);

        this.nodeElements = PROLOGUE_NODES.map((_, index) => {
            const el = document.createElement('button');
            el.className = 'worldmap-node';
            el.addEventListener('click', (event) => {
                event.stopPropagation();
                this._selectNode(index);
            });
            this.nodeContainer.appendChild(el);
            return el;
        });

        this._layoutNodes();
    }

    /**
     * Contain-fit (whole image visible, letterboxed) rather than cover-fit
     * (cropped) - the source image is 3:1 while the viewport is ~1.78:1, and
     * cropping would cut off the beach start / castle end of the path.
     */
    _computeFit() {
        const w = this.game.width;
        const h = this.game.height;
        const scale = Math.min(w / this.background.width, h / this.background.height);

        this.bgDrawWidth = this.background.width * scale;
        this.bgDrawHeight = this.background.height * scale;
        this.bgOffsetX = (w - this.bgDrawWidth) / 2;
        this.bgOffsetY = (h - this.bgDrawHeight) / 2;
    }

    /**
     * @param {number} index - Index into PROLOGUE_NODES.
     * @returns {{x:number,y:number}} Screen-space position of that node.
     */
    _nodeScreenPos(index) {
        const data = PROLOGUE_NODES[index];
        return {
            x: this.bgOffsetX + data.x * this.bgDrawWidth,
            y: this.bgOffsetY + data.y * this.bgDrawHeight,
        };
    }

    /**
     * completedLevels stores the Tiled/GameState level *number*
     * (PROLOGUE_NODES[i].level, 1-based), not the array index - matters
     * once node order and level number can diverge (e.g. a reordered
     * Special/Secret node).
     * @param {number} index - Index into PROLOGUE_NODES.
     * @returns {boolean}
     */
    _isLocked(index) {
        return index > 0 && !this.completedLevels.has(PROLOGUE_NODES[index - 1].level);
    }

    /**
     * @param {number} index - Index into PROLOGUE_NODES.
     */
    _selectNode(index) {
        if (this._isLocked(index)) return;
        this.selectedIndex = index;
        this._layoutNodes();
        this._showInfoCard(index);
    }

    /**
     * locked/completed both overlay the same always-visible default badge
     * (see .worldmap-node::before in style.css) - mutually exclusive in
     * practice, a completed level was necessarily unlocked to begin with.
     */
    _layoutNodes() {
        for (let i = 0; i < PROLOGUE_NODES.length; i++) {
            const el = this.nodeElements[i];
            const { x, y } = this._nodeScreenPos(i);

            el.style.left = `${x - NODE_SIZE / 2}px`;
            el.style.top = `${y - NODE_SIZE / 2}px`;
            el.disabled = this._isLocked(i);
            el.classList.toggle('locked', this._isLocked(i));
            el.classList.toggle('completed', this.completedLevels.has(PROLOGUE_NODES[i].level));
            el.classList.toggle('selected', this.selectedIndex === i);
        }
    }

    /**
     * @param {number} index - Index into PROLOGUE_NODES.
     */
    _showInfoCard(index) {
        this._closeInfoCard();
        const data = PROLOGUE_NODES[index];

        this.infoCard = document.createElement('div');
        this.infoCard.className = 'worldmap-info-card';
        this.infoCard.innerHTML = this._buildInfoCardMarkup(data);
        this._wireInfoCard(index);
        this.game.overlay.appendChild(this.infoCard);
        this._positionInfoCard();
    }

    /**
     * @param {{level:number,type:string,hasSecret:boolean}} data - This node's static data.
     * @returns {string} Info card markup.
     */
    _buildInfoCardMarkup(data) {
        const secretsTotal = data.hasSecret ? 1 : 0;
        const secretsFound = this.completedLevels.has(data.level) ? secretsTotal : 0;
        return `
            <div class="worldmap-info-title">Lvl ${data.level}</div>
            <div class="worldmap-info-type">${data.type}</div>
            <div class="worldmap-info-secrets">Secrets: ${secretsFound}/${secretsTotal}</div>
            <button class="worldmap-info-start">Start</button>
        `;
    }

    /**
     * @param {number} index - Index into PROLOGUE_NODES.
     */
    _wireInfoCard(index) {
        this.infoCard.addEventListener('click', (event) => event.stopPropagation());
        this.infoCard.querySelector('.worldmap-info-start').addEventListener('click', () => this._enterLevel(index));
    }

    /**
     * Positions the info card next to its selected node.
     */
    _positionInfoCard() {
        if (!this.infoCard || this.selectedIndex === null) return;

        const { x, y } = this._nodeScreenPos(this.selectedIndex);
        this.infoCard.style.left = `${Math.min(x + NODE_SIZE / 2 + 12, this.game.width - 160)}px`;
        this.infoCard.style.top = `${y - 20}px`;
    }

    /**
     * Removes the info card, if open.
     */
    _closeInfoCard() {
        this.infoCard?.remove();
        this.infoCard = null;
    }

    /**
     * @param {number} index - Index into PROLOGUE_NODES.
     */
    _enterLevel(index) {
        const data = PROLOGUE_NODES[index];
        this.game.stateMachine.change('game', { chapterId: 'prologue', level: data.level });
    }

    /**
     * Deselects the current node (background click).
     */
    _onCanvasClick() {
        this.selectedIndex = null;
        this._closeInfoCard();
        this._layoutNodes();
    }

    /**
     * Tears down the chapter bar/nodes/info card and the canvas listener.
     */
    exit() {
        this.game.canvas.removeEventListener('click', this._onCanvasClick);

        this.chapterBar?.remove();
        this.nodeContainer?.remove();
        this._closeInfoCard();
    }

    /**
     * @param {number} dt - Elapsed time in seconds.
     */
    update(dt) {}

    /**
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.fillStyle = '#12141a';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.drawImage(this.background, this.bgOffsetX, this.bgOffsetY, this.bgDrawWidth, this.bgDrawHeight);
    }
}
