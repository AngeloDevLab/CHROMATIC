import { State } from './state.js';
import { isBossLevel } from './level-session.js';
import { ColorZone } from '../mechanics/color-zone.js';
import { MENU_ZONE, MENU_TRACK_KEYS } from '../core/music-playlist.js';

/**
 * Only Prologue is active at game start, the rest unlock as previous chapters are completed.
 */
const chapters = [
    { id: 'prologue', label: 'Prologue', available: true },
    { id: 'chap1', label: 'Chap 1', available: false },
    { id: 'chap2', label: 'Chap 2', available: false },
    { id: 'chap3', label: 'Chap 3', available: false },
    { id: 'chap4', label: 'Chap 4', available: false },
    { id: 'epilogue', label: 'Epilogue', available: false },
];

/**
 * Positions along the path, as a fraction of the SOURCE worldmap image
 * (768x256), converted to screen coordinates via _layoutNodes()'s
 * contain-fit offset/scale. Rough estimate tracing the visible path, tune
 * further once checked against the art.
 */
const prologue_nodes = [
    { level: 1, type: 'Combat (Tutorial)', hasSecret: false, x: 0.06, y: 0.40 },
    { level: 2, type: 'Combat (Tutorial)', hasSecret: false, x: 0.20, y: 0.75 },
    { level: 3, type: 'Miniboss', hasSecret: false, x: 0.35, y: 0.45 },
    { level: 4, type: 'Special', hasSecret: false, x: 0.50, y: 0.55 },
    { level: 5, type: 'Secret', hasSecret: true, x: 0.65, y: 0.45 },
    { level: 6, type: 'Templateboss', hasSecret: false, x: 0.80, y: 0.55 },
];

const node_size = 64;

/**
 * Worldmap screen: shows Prologue level nodes over a background image
 * split into per-node color zones (see _initColorZone()) that reveal as
 * levels are completed. Rebuilt on every enter()/exit(); completedLevels
 * reads Game.completedLevels directly (persisted via SaveSystem) rather
 * than owning a local copy, since a copy would forget completions between visits.
 */
export class WorldmapState extends State {
    /**
     * Builds the worldmap scene: background, color zones, chapter bar,
     * nodes, token counter, back button.
     * @param {{justCompleted?: number}} [params] - Forwarded from LevelSession's exit-portal transition.
     */
    enter(params) {
        this.background = this.game.assets.getImage('worldmap-prologue-bg');
        this._computeFit();
        this.game.music.setZone(MENU_ZONE, MENU_TRACK_KEYS);
        this.completedLevels = this.game.completedLevels;
        this.selectedIndex = null;
        this._initColorZone(params?.justCompleted ?? null);
        this._buildChapterBar();
        this._buildNodes();
        this._buildTokenCounter();
        this._buildBackButton();
        this._onOutsideClick = this._onOutsideClick.bind(this);
        document.addEventListener('click', this._onOutsideClick);
    }

    /**
     * Sets up the color zone and reveals already-completed level zones.
     * @param {number|null} justCompletedLevel - Animates as a wipe instead of an instant reveal.
     */
    _initColorZone(justCompletedLevel) {
        this.colorZone = new ColorZone(this.background.width, this.background.height, undefined, {
            greyBrightness: 0.3,
            greyTint: { sepia: 0.4, hueRotate: 180, saturate: 2 },
        });
        this.colorZone.paintGreyFrom(this.background);
        this._revealCompletedZones(justCompletedLevel);
    }

    /**
     * Reveals every already-completed zone, hard-edged and flush against
     * any neighboring zone. justCompletedLevel's own zone animates as a
     * left-to-right wipe instead of popping in instantly.
     * @param {number|null} justCompletedLevel - Level number just finished, whose zone animates in; null if none.
     */
    _revealCompletedZones(justCompletedLevel) {
        const bounds = this._computeZoneBounds();

        for (let i = 0; i < prologue_nodes.length; i++) {
            const node = prologue_nodes[i];
            if (!this.completedLevels.has(node.level)) continue;

            const { xStart, xEnd } = bounds[i];
            if (node.level === justCompletedLevel) {
                this.colorZone.triggerZoneWipe(xStart, xEnd);
            } else {
                this.colorZone.revealZone(xStart, xEnd);
            }
        }
    }

    /**
     * Per-node zone boundaries in the background image's native pixel space -
     * split at the midpoint (x) between neighboring nodes, first/last zone
     * extend to the image edges.
     * @returns {{xStart:number, xEnd:number}[]}
     */
    _computeZoneBounds() {
        const xs = prologue_nodes.map((node) => node.x * this.background.width);
        return xs.map((x, i) => ({
            xStart: i === 0 ? 0 : (xs[i - 1] + x) / 2,
            xEnd: i === xs.length - 1 ? this.background.width : (x + xs[i + 1]) / 2,
        }));
    }

    /**
     * Same icon+count readout as LevelSession's in-level HUD (.hud-token's
     * ::before), just repositioned (.worldmap-token-counter) for this
     * screen's top-right corner instead of under the HP/Shield bars.
     */
    _buildTokenCounter() {
        this.tokenCounterEl = document.createElement('div');
        this.tokenCounterEl.className = 'worldmap-token-counter';
        this.tokenCounterEl.textContent = `x ${this.game.tokens}`;
        this.game.overlay.appendChild(this.tokenCounterEl);
    }

    /**
     * Top-left, the only way back to MenuState from here since Pause/
     * GameOverState's own "Main Menu" choice only exists inside a level.
     * Same change('menu') target and .chapter-button look as the chapter
     * bar, just repositioned via .worldmap-back-button.
     */
    _buildBackButton() {
        this.backButtonEl = document.createElement('button');
        this.backButtonEl.className = 'chapter-button worldmap-back-button';
        this.backButtonEl.textContent = '‹ Menu';
        this.backButtonEl.addEventListener('click', () => this.game.stateMachine.change('menu'));
        this.game.overlay.appendChild(this.backButtonEl);
    }

    /**
     * Builds the top chapter-selection bar (only Prologue enabled).
     */
    _buildChapterBar() {
        this.chapterBar = document.createElement('div');
        this.chapterBar.className = 'chapter-bar';
        for (const chapter of chapters) this.chapterBar.appendChild(this._buildChapterButton(chapter));
        this.game.overlay.appendChild(this.chapterBar);
    }

    /**
     * Builds one chapter-bar button, disabled if unavailable.
     * @param {{label: string, available: boolean}} chapter - Chapter to build a button for.
     * @returns {HTMLButtonElement}
     */
    _buildChapterButton(chapter) {
        const button = document.createElement('button');
        button.className = 'chapter-button';
        button.textContent = chapter.label;
        if (!chapter.available) {
            button.disabled = true;
            button.title = 'Coming Soon';
        }
        return button;
    }

    /**
     * Builds one button element per Prologue node and lays them out.
     */
    _buildNodes() {
        this.nodeContainer = document.createElement('div');
        this.nodeContainer.className = 'worldmap-nodes';
        this.game.overlay.appendChild(this.nodeContainer);
        this.nodeElements = prologue_nodes.map((_, index) => this._buildNodeButton(index));
        this._layoutNodes();
    }

    /**
     * Builds one level node button that selects itself on click.
     * @param {number} index - Index into prologue_nodes, selected on click.
     * @returns {HTMLButtonElement}
     */
    _buildNodeButton(index) {
        const el = document.createElement('button');
        el.className = 'worldmap-node';
        el.addEventListener('click', (event) => {
            event.stopPropagation();
            this._selectNode(index);
        });
        this.nodeContainer.appendChild(el);
        return el;
    }

    /**
     * Contain-fit (whole image visible, letterboxed) rather than cover-fit,
     * since the source image's 3:1 aspect ratio would otherwise crop the
     * beach start / castle end of the path.
     */
    _computeFit() {
        const width = this.game.width;
        const height = this.game.height;
        const scale = Math.min(width / this.background.width, height / this.background.height);

        this.bgDrawWidth = this.background.width * scale;
        this.bgDrawHeight = this.background.height * scale;
        this.bgOffsetX = (width - this.bgDrawWidth) / 2;
        this.bgOffsetY = (height - this.bgDrawHeight) / 2;
    }

    /**
     * Converts a node's fractional position into screen coordinates.
     * @param {number} index - Index into prologue_nodes.
     * @returns {{x:number,y:number}} Screen-space position of that node.
     */
    _nodeScreenPos(index) {
        const data = prologue_nodes[index];
        return {
            x: this.bgOffsetX + data.x * this.bgDrawWidth,
            y: this.bgOffsetY + data.y * this.bgDrawHeight,
        };
    }

    /**
     * Whether this node is locked (the previous node's level isn't completed yet).
     * @param {number} index - Index into prologue_nodes.
     * @returns {boolean}
     */
    _isLocked(index) {
        return index > 0 && !this.completedLevels.has(prologue_nodes[index - 1].level);
    }

    /**
     * Selects a node and shows its info card, unless locked.
     * @param {number} index - Index into prologue_nodes.
     */
    _selectNode(index) {
        if (this._isLocked(index)) return;
        this.selectedIndex = index;
        this._layoutNodes();
        this._showInfoCard(index);
    }

    /** Positions every node element and syncs its locked/completed/selected classes. */
    _layoutNodes() {
        for (let i = 0; i < prologue_nodes.length; i++) {
            const el = this.nodeElements[i];
            const { x, y } = this._nodeScreenPos(i);

            el.style.left = `${x - node_size / 2}px`;
            el.style.top = `${y - node_size / 2}px`;
            el.disabled = this._isLocked(i);
            el.classList.toggle('locked', this._isLocked(i));
            el.classList.toggle('completed', this.completedLevels.has(prologue_nodes[i].level));
            el.classList.toggle('selected', this.selectedIndex === i);
        }
    }

    /**
     * Opens the info card for a node.
     * @param {number} index - Index into prologue_nodes.
     */
    _showInfoCard(index) {
        this._closeInfoCard();
        const data = prologue_nodes[index];

        this.infoCard = document.createElement('div');
        this.infoCard.className = 'worldmap-info-card';
        this.infoCard.innerHTML = this._buildInfoCardMarkup(data);
        this._wireInfoCard(index);
        this.game.overlay.appendChild(this.infoCard);
        this._positionInfoCard();
    }

    /**
     * Builds the info card's markup.
     * @param {{level:number,type:string,hasSecret:boolean}} data - This node's static data.
     * @returns {string} Info card markup.
     */
    _buildInfoCardMarkup(data) {
        const secretsTotal = data.hasSecret ? 1 : 0;
        const secretsFound = this.completedLevels.has(data.level) ? secretsTotal : 0;
        return `
            <button class="worldmap-info-close" aria-label="Close">&times;</button>
            <div class="worldmap-info-title">Lvl ${data.level}</div>
            <div class="worldmap-info-type">${data.type}</div>
            <div class="worldmap-info-secrets">Secrets: ${secretsFound}/${secretsTotal}</div>
            <button class="worldmap-info-start">Start</button>
        `;
    }

    /**
     * Wires the info card's start/close buttons.
     * @param {number} index - Index into prologue_nodes.
     */
    _wireInfoCard(index) {
        this.infoCard.addEventListener('click', (event) => event.stopPropagation());
        this.infoCard.querySelector('.worldmap-info-start').addEventListener('click', () => this._enterLevel(index));
        this.infoCard.querySelector('.worldmap-info-close').addEventListener('click', () => this._deselect());
    }

    /**
     * Positions the info card next to its selected node.
     */
    _positionInfoCard() {
        if (!this.infoCard || this.selectedIndex === null) return;

        const { x, y } = this._nodeScreenPos(this.selectedIndex);
        this.infoCard.style.left = `${Math.min(x + node_size / 2 + 12, this.game.width - 160)}px`;
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
     * Starts the chosen level, routing bosses to BossState.
     * @param {number} index - Index into prologue_nodes.
     */
    _enterLevel(index) {
        const data = prologue_nodes[index];
        const target = isBossLevel(this.game.assets, data.level) ? 'boss' : 'game';
        this.game.stateMachine.change(target, { chapterId: 'prologue', level: data.level });
    }

    /**
     * Deselects the current node, if any. Node buttons and the info card
     * both stopPropagation() their own clicks, so this only fires for
     * genuine outside clicks.
     */
    _onOutsideClick() {
        this._deselect();
    }

    /**
     * Clears the current selection and closes the info card.
     */
    _deselect() {
        this.selectedIndex = null;
        this._closeInfoCard();
        this._layoutNodes();
    }

    /**
     * Tears down the chapter bar/nodes/info card and the canvas listener.
     */
    exit() {
        document.removeEventListener('click', this._onOutsideClick);

        this.chapterBar?.remove();
        this.nodeContainer?.remove();
        this.tokenCounterEl?.remove();
        this.backButtonEl?.remove();
        this._closeInfoCard();
    }

    /**
     * Advances the color zone's zone-wipe transition, if active.
     * @param {number} deltaTime - Elapsed time in seconds.
     */
    update(deltaTime) {
        if (this.colorZone.isTransitioning) this.colorZone.update(deltaTime, 0, 0);
    }

    /**
     * Draws the background and its color overlay, contain-fit.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    render(ctx) {
        ctx.fillStyle = '#12141a';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.drawImage(this.background, this.bgOffsetX, this.bgOffsetY, this.bgDrawWidth, this.bgDrawHeight);
        ctx.drawImage(this.colorZone.overlayCanvas, this.bgOffsetX, this.bgOffsetY, this.bgDrawWidth, this.bgDrawHeight);
    }
}
