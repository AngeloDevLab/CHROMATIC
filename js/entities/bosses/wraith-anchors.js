import { WRAITH_WIDTH, WRAITH_HEIGHT, TOP_MARGIN_PX } from './wraith-constants.js';

/**
 * Finds the first solid row at pxX, scanning down from startY instead of row 0.
 * @param {Collision} collision - Collision to scan against.
 * @param {number} pxX - World X to scan down at.
 * @param {number} startY - World Y to start scanning down from.
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
 * Computes ground/top Y anchors from the level, plus two fixed X anchors: the
 * spawn position and its mirror across the level's center.
 * @param {Collision} collision - Collision to scan against.
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
