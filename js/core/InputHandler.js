const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', Space: 'jump', KeyW: 'jump',
    ArrowDown: 'duck', KeyS: 'duck',
};

export class InputHandler {
    constructor() {
        this.actions = { left: false, right: false, jump: false, duck: false, attack: false };

        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousedown', this._onMouseDown);
    }

    _onKeyDown(e) {
        const action = KEY_MAP[e.code];
        if (action) this.actions[action] = true;
    }

    _onKeyUp(e) {
        const action = KEY_MAP[e.code];
        if (action) this.actions[action] = false;
    }

    _onMouseDown() {
        this.actions.attack = true;
    }

    isDown(action) {
        return !!this.actions[action];
    }
}
