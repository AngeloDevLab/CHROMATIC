import { WRAITH_WIDTH, WRAITH_HEIGHT, TOP_MARGIN_PX } from './WraithConstants.js';

/**
 * First solid `terrain`/`walls` row at pxX, scanning down from startY (not
 * from the level's very top) - the real floor a falling entity starting at
 * startY would actually land on, as opposed to Level.js's
 * findGroundSurfaceY() (built for cosmetic static scenes, walks every tile
 * layer regardless of whether it's solid, always from row 0).
 * @param {Collision} collision
 * @param {number} pxX
 * @param {number} startY
 * @returns {number}
 */
function findGroundY(collision, pxX, startY) {
    const tileSize = collision.level.tileSize;
    for (let y = Math.floor(startY / tileSize) * tileSize; y < collision.level.pixelHeight; y += tileSize) {
        if (collision.isSolidAt(pxX, y)) return y;
    }
    return collision.level.pixelHeight;
}

/**
 * Ground/top anchors from the actual level, not a fixed offset - see
 * findGroundY() above for why that's not Level.js's findGroundSurfaceY().
 * Also computes the two fixed X anchors ("Seitenwechsel") - the spawn
 * position and its mirror across the level's horizontal center, so Wraith.js
 * adapts to whatever width Lv_3 ends up being instead of a hardcoded offset.
 * Returned keys match Wraith.js's own `_groundY`/`_topY`/`_sideAX`/
 * `_sideBX`/`_onSideA` fields, so the constructor can `Object.assign(this, ...)` the result directly.
 * @param {Collision} collision
 * @param {number} x - World X spawn position.
 * @param {number} y - World Y spawn position.
 * @returns {{_groundY: number, _topY: number, _sideAX: number, _sideBX: number, _onSideA: boolean}}
 */
export function computeWraithAnchors(collision, x, y) {
    const centerX = x + WRAITH_WIDTH / 2;
    return {
        _groundY: findGroundY(collision, centerX, y) - WRAITH_HEIGHT,
        _topY: TOP_MARGIN_PX,
        _sideAX: x,
        _sideBX: collision.level.pixelWidth - x - WRAITH_WIDTH,
        _onSideA: true,
    };
}
