/**
 * Hitbox, narrower than the padded 128x256 sprite sheet. Don't grow HEIGHT
 * to fix soft-looking art under BossState's zoomed camera - it blows up the
 * on-screen boss size instead; that fix belongs on the art/render-buffer side.
 */
export const WRAITH_WIDTH = 96;
export const WRAITH_HEIGHT = 128;

/**
 * 05_enemies-bosses.md 6.5 (Miniboss row). SIGNATURE_HIT_DAMAGE is what the
 * beam (WraithBeam.js) deals; WRAITH_CONTACT_DAMAGE is the separate melee
 * contact damage. WraithTemplateboss.js overrides hp/signatureHitDamage;
 * contactDamage stays shared/inherited.
 */
export const WRAITH_HP = 300;
export const SIGNATURE_HIT_DAMAGE = 40;
export const WRAITH_CONTACT_DAMAGE = 10;

/**
 * 05_enemies-bosses.md's Miniboss row - BossState.js's HP bar label.
 */
export const WRAITH_NAME = 'Wraith of the Shifting Sands';

/**
 * How close to the level's top edge the firing pose reaches. The bottom
 * anchor (idle and vulnerable) is derived from the arena's own collision
 * instead (see WraithAnchors.js).
 */
export const TOP_MARGIN_PX = 32;

/**
 * Hold durations for the two static poses (firing.png/vulnerable.png are
 * single-frame, so screen time is an explicit timer) and the idle cooldown
 * between attacks, shared as-is by WraithTemplateboss.js. All three scale
 * with Boss.timeScale on enrage (unlike the walk speed below).
 */
export const ATTACK_INTERVAL_SECONDS = 2.5;
export const FIRING_HOLD_SECONDS = 0.2;
export const VULNERABLE_HOLD_SECONDS = 4;

/**
 * Horizontal walk to the arena's other side, between vulnerable and the
 * next idle. Doesn't scale via Boss.timeScale like the hold timers above -
 * uses its own dedicated enraged-speed value, checked directly in
 * _updateWalk() below. Also reused by WraithTemplateboss.js's firingSweep.
 */
export const WALK_SPEED_PX_PER_SEC = 100;
export const ENRAGE_WALK_SPEED_PX_PER_SEC = 130;
