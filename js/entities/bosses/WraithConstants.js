/**
 * Hitbox, narrower than the padded 128x256 sprite sheet. Don't grow HEIGHT to
 * fix soft-looking art - that's a render-buffer/art fix, not a hitbox one.
 */
export const WRAITH_WIDTH = 96;
export const WRAITH_HEIGHT = 128;

/**
 * WraithTemplateboss.js overrides hp/signatureHitDamage; contactDamage stays shared.
 */
export const WRAITH_HP = 300;
export const SIGNATURE_HIT_DAMAGE = 60;
export const WRAITH_CONTACT_DAMAGE = 40;

export const WRAITH_NAME = 'Wraith of the Shifting Sands';

/**
 * How close to the level's top edge the firing pose reaches.
 */
export const TOP_MARGIN_PX = 32;

/**
 * Hold durations for the two static poses (single-frame sprites, so screen
 * time needs an explicit timer) and the idle cooldown between attacks. All
 * three scale with Boss.timeScale on enrage, unlike the walk speed below.
 */
export const ATTACK_INTERVAL_SECONDS = 2.5;
export const FIRING_HOLD_SECONDS = 0.2;
export const VULNERABLE_HOLD_SECONDS = 4;

/**
 * Horizontal walk speed between vulnerable and idle. Doesn't scale via
 * Boss.timeScale like the hold timers above - uses this dedicated enraged value instead.
 */
export const WALK_SPEED_PX_PER_SEC = 100;
export const ENRAGE_WALK_SPEED_PX_PER_SEC = 130;
