/**
 * 128x96 hitbox - the tested footprint the arena/feel was tuned against,
 * narrower than the padded 128x256 sheet on purpose (same reasoning as
 * Player.js's HITBOX_WIDTH/HEIGHT). Don't grow HEIGHT to match the
 * sprite's opaque height to fix soft-looking art under BossState's
 * zoomed-out camera - tried that, it blows the on-screen boss up past
 * this tested size instead; the real fix belongs on the art/render-buffer
 * side.
 */
export const WRAITH_WIDTH = 96;
export const WRAITH_HEIGHT = 128;

/**
 * 05_enemies-bosses.md 6.5 (Miniboss row - 300 HP, chosen so it's not
 * weaker than the player's own ~200 Health+Shield pool). SIGNATURE_HIT_DAMAGE
 * is what the beam (WraithBeam.js) deals to the player, not contact damage -
 * WRAITH_CONTACT_DAMAGE below is deliberately separate (bugfix: this used
 * to double as contactDamage too, mirroring 40 back at melee/contact hits,
 * 4-5x every other enemy's, see Enemy.js's DEFAULT_CONTACT_DAMAGE).
 * WraithTemplateboss.js overrides hp/signatureHitDamage with its own
 * values; contactDamage stays shared/inherited.
 */
export const WRAITH_HP = 300;
export const SIGNATURE_HIT_DAMAGE = 40;
export const WRAITH_CONTACT_DAMAGE = 10;

/**
 * 05_enemies-bosses.md's Miniboss row - BossState.js's HP bar label.
 */
export const WRAITH_NAME = 'Wraith of the Shifting Sands';

/**
 * How close to the level's top edge the firing pose reaches - the bottom
 * anchor (idle AND vulnerable both sit there) is derived from the actual
 * arena's collision instead (see WraithAnchors.js), so the wraith travels
 * the arena's real full height rather than a fixed offset that'd need
 * re-tuning every time Lv_3's layout changes.
 */
export const TOP_MARGIN_PX = 32;

/**
 * Hold durations for the two static poses (firing.png/vulnerable.png are
 * single-frame, so screen time is an explicit timer, not animation length)
 * and the idle cooldown between attacks - first-guess like every other
 * tuning constant here, shared as-is by WraithTemplateboss.js (never
 * overridden). Vulnerable is deliberately generous: the wraith lands at a
 * fixed spot and the player has to run over to it, so the window needs
 * real travel slack. All three scale with Boss.timeScale on enrage (unlike
 * the walk speed below, which uses its own dedicated enraged value - see
 * that constant's own comment).
 */
export const ATTACK_INTERVAL_SECONDS = 2.5;
export const FIRING_HOLD_SECONDS = 0.2;
export const VULNERABLE_HOLD_SECONDS = 4;

/**
 * Horizontal walk to the arena's other side ("Seitenwechsel"), between
 * vulnerable and the next idle - first-guess like every other timing
 * constant here. Doesn't scale via Boss.timeScale/`enraged` like the hold
 * timers above - inverting that ratio read as too fast in playtesting, so
 * this is its own dedicated enraged-speed value, checked directly in
 * _updateWalk() below. Also reused by WraithTemplateboss.js's firingSweep.
 */
export const WALK_SPEED_PX_PER_SEC = 100;
export const ENRAGE_WALK_SPEED_PX_PER_SEC = 130;
