import { Wraith } from './Wraith.js';
import { WraithBeam } from './WraithBeam.js';

const TEMPLATEBOSS_HP = 400;
const TEMPLATEBOSS_SIGNATURE_HIT_DAMAGE = 80;
const TEMPLATEBOSS_NAME = 'Wraith of the Grey City';
const TEMPLATEBOSS_TOKEN_REWARD = 2;

// Wraith of the Grey City (Lvl 6 Templateboss); extends Wraith.js rather than
// duplicating it. Rolls a random axis each attack instead of always firing horizontal.
export class WraithTemplateboss extends Wraith {
    /**
     * Last axis actually fired, for _rollAxis()'s enrage bias; null until the first attack.
     */
    _lastAxis = null;

    /**
     * Sets up Wraith's base state, then overrides stats to the Templateboss tier.
     * @param {number} x - World X spawn position.
     * @param {number} y - World Y spawn position (Tiled's EnemySpawn row).
     * @param {Collision} collision - Level collision, for ground/wall scans.
     * @param {Player} player - Tracked to face/aim at.
     */
    constructor(x, y, collision, player) {
        super(x, y, collision, player);
        this.hp = TEMPLATEBOSS_HP;
        this.maxHp = TEMPLATEBOSS_HP;
        this.signatureHitDamage = TEMPLATEBOSS_SIGNATURE_HIT_DAMAGE;
        this.name = TEMPLATEBOSS_NAME;
        this.tokenReward = TEMPLATEBOSS_TOKEN_REWARD;
    }

    /**
     * Overrides Wraith.js's default (always horizontal) - rolls an axis first.
     */
    _onRiseComplete() {
        const axis = this._rollAxis();
        this._lastAxis = axis;
        if (axis === 'horizontal') this._enterFiring('horizontal');
        else this._enterFiringSweep();
    }

    /**
     * Below 50% HP (enraged), flips to the opposite axis instead of rolling fresh.
     * @returns {'horizontal'|'vertical'}
     */
    _rollAxis() {
        if (!this.enraged || !this._lastAxis) {
            return Math.random() < 0.5 ? 'horizontal' : 'vertical';
        }
        return this._lastAxis === 'horizontal' ? 'vertical' : 'horizontal';
    }

    /**
     * Templateboss-only alternative to _enterFiring(); crosses to whichever
     * fixed anchor it isn't currently on.
     */
    _enterFiringSweep() {
        this.telegraphing = false;
        this.y = this._topY;
        this.state = 'firingSweep';
        this._walkTargetX = this._onSideA ? this._sideBX : this._sideAX;
        this.facing = this._walkTargetX >= this.x ? 1 : -1;
        this._setAnimation('firing');

        const beam = new WraithBeam(this.centerX, this.centerY, this.facing, this.collision, this.signatureHitDamage, 'vertical');
        this.pendingProjectile = beam;
        this._activeBeam = beam;
        this.pendingRoomDarken = true;
    }

    /**
     * Handles 'firingSweep', which isn't in Wraith.js's own switch.
     * @param {number} dt - Elapsed time in seconds.
     */
    _updateCustomState(dt) {
        if (this.state === 'firingSweep') this._updateWalk(dt);
    }

    /**
     * Handles arrival at the end of a sweep; falls back to the inherited
     * resume-idle behavior outside firingSweep.
     */
    _onArrived() {
        if (this.state !== 'firingSweep') {
            super._onArrived();
            return;
        }
        if (this._activeBeam) {
            this._activeBeam.dead = true;
            this._activeBeam = null;
        }
        this._enterTransition('toVulnerable', this._topY, this._groundY);
    }
}
