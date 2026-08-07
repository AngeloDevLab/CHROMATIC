import { Wraith } from './Wraith.js';
import { WraithBeam } from './WraithBeam.js';

/**
 * 05_enemies-bosses.md 6.5's Templateboss row (400 HP / 70 Signature Hit
 * Damage) and 6.3's name for the Lvl 6 fight.
 */
const TEMPLATEBOSS_HP = 400;
const TEMPLATEBOSS_SIGNATURE_HIT_DAMAGE = 70;
const TEMPLATEBOSS_NAME = 'Wraith of the Grey City';
const TEMPLATEBOSS_TOKEN_REWARD = 2;

// Wraith of the Grey City (Lvl 6 Templateboss) - extends Wraith.js rather
// than duplicating it, per 6.3.1's "expands [the Miniboss's moveset] rather
// than replacing it". Only the moment right after toFiring's rise finishes
// differs: instead of always firing horizontally in place, this rolls a
// random axis each attack -
//   horizontal: unchanged, inherited _enterFiring('horizontal').
//   vertical: a new 'firingSweep' state - glides to the OTHER fixed side
//   while still up at _topY (reusing Wraith.js's own _updateWalk() X-
//   interpolation via _updateCustomState()), with a vertical WraithBeam live
//   and tracking its column for the whole crossing, sweeping the floor
//   underneath it. No separate stationary hold for this axis - the crossing
//   duration *is* the firing duration.
// Either way, arrival feeds into the same inherited toVulnerable -> vulnerable
// -> toIdle -> walking -> idle cycle - "come back down, then vulnerable,
// then switch sides again" falls out of reusing that existing cycle
// unchanged, not from any special-cased bookkeeping here. A vertical attack
// therefore crosses sides twice per cycle (once while firing, once after
// vulnerable); a horizontal attack crosses once (the normal end-of-cycle walk).
export class WraithTemplateboss extends Wraith {
    /**
     * Last axis actually fired, for _rollAxis()'s enrage bias - null until
     * the first attack, so that first roll is always a fair coinflip.
     */
    _lastAxis = null;

    /**
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
     * Overrides Wraith.js's default (always horizontal) - rolls an axis
     * first, per 6.3.1's "either/or... never both at once".
     */
    _onRiseComplete() {
        const axis = this._rollAxis();
        this._lastAxis = axis;
        if (axis === 'horizontal') this._enterFiring('horizontal');
        else this._enterFiringSweep();
    }

    /**
     * 6.3.1's enrage addition: "increases how often it alternates... rather
     * than just faster" - below 50% HP, always pick the opposite axis from
     * last time instead of a fresh coinflip; above 50%, stays an independent
     * coinflip.
     * @returns {'horizontal'|'vertical'}
     */
    _rollAxis() {
        if (!this.enraged || !this._lastAxis) {
            return Math.random() < 0.5 ? 'horizontal' : 'vertical';
        }
        return this._lastAxis === 'horizontal' ? 'vertical' : 'horizontal';
    }

    /**
     * Templateboss-only alternative to _enterFiring() - see the class
     * comment above for the full shape. Reuses _walkTargetX/_onSideA
     * (Wraith.js's own "Seitenwechsel" bookkeeping) so the crossing lands on
     * whichever fixed anchor it isn't currently on, same as the normal
     * end-of-cycle walk.
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
     * 'firingSweep' isn't in Wraith.js's own switch - its default case routes
     * here. Reuses _updateWalk() verbatim (same X-interpolation/enrage-speed
     * as the normal end-of-cycle walk), only the arrival hook differs (see _onArrived()).
     * @param {number} dt
     */
    _updateCustomState(dt) {
        if (this.state === 'firingSweep') this._updateWalk(dt);
    }

    /**
     * Reached the far side of the sweep - unlike the horizontal beam (which
     * stays live through the whole toVulnerable descent), the vertical
     * sweep's beam is done firing the instant the crossing itself ends, so
     * it's killed here rather than left for the later _enterVulnerable() to
     * clean up - the boss then comes down beam-less before going vulnerable.
     * Falls back to the Miniboss's normal resume-idle behavior for every
     * other arrival (the regular end-of-cycle walk).
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
