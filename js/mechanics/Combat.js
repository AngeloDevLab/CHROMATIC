// Two separate ways damage happens (03_mechanics.md 4.3 + 4.5), both operating
// on plain Entity-shaped objects (x/y/width/height) plus the takeDamage()
// contract Player and Enemy each implement:
// - resolveMeleeAttack: the active sword swing, once per swing, on request.
// - resolveContactDamage: the passive Prisma barrier, checked continuously.

// How far the melee hitbox extends past the player's own hitbox - a gameplay
// value independent of how far the sword sprite visually reaches, so the
// player isn't forced into the enemy's own contact range just to land a hit.
const ATTACK_REACH_PX = 40;

export const PLAYER_ATTACK_DAMAGE = 10;

// Ranged Sword Throw deals less than melee (deliberately half, session
// decision - melee is the stronger option, ranged is for reach/safety) and
// no longer spends Prisma (see RANGED_ATTACK_COOLDOWN_SECONDS below for what
// replaced that as the anti-spam gate).
export const RANGED_ATTACK_DAMAGE = PLAYER_ATTACK_DAMAGE * 0.5;

// Cooldown between ranged throws (CombatCoordinator.js's own timer, same
// pattern as its hit-stop timer) - replaces the old Prisma cost as the
// reason a player can't just spam ranged while an enemy sits just out of
// melee range. Cut 3->2 this session's balancing pass, 3s read as too
// sluggish for a half-damage option that's supposed to be the safer/faster
// alternative to closing the distance.
export const RANGED_ATTACK_COOLDOWN_SECONDS = 2;

// Per-enemy cooldown between contact-damage ticks, so standing inside an enemy
// doesn't deal damage every single frame.
const CONTACT_DAMAGE_COOLDOWN_SECONDS = 1;

// Combat feel: knockback speed applied away from whoever landed the hit -
// both entities' own knockback lock (Player.js/Enemy.js) briefly overrides
// normal movement so the push is actually visible instead of being stomped
// by input/patrol logic the very next frame.
const ENEMY_KNOCKBACK_SPEED = 180;
const PLAYER_KNOCKBACK_SPEED = 150;

// 04_health-save-system.md 5.3: difficulty scales only incoming damage, enemy
// HP and the player's own damage stay the same across all three. Deliberately
// round (-50%/+100%) rather than an odd fraction, so it's easy to state as a
// one-line "what changes" info wherever difficulty is shown. Falls back to
// Normal (1) for an unrecognized/missing difficulty (e.g. a level tested
// directly without going through the menu's difficulty selection first).
const DIFFICULTY_DAMAGE_MULTIPLIERS = { easy: 0.5, normal: 1, hard: 2 };

// Charger mid-rush (entities/enemies/Charger.js's `charging`) hits harder
// through the passive barrier below, instead of also zapping itself for the
// normal contactDamage amount - see resolveContactDamage.
const CHARGE_CONTACT_DAMAGE_MULTIPLIER = 2;

/**
 * @param {{x:number,y:number,width:number,height:number}} a
 * @param {{x:number,y:number,width:number,height:number}} b
 * @returns {boolean}
 */
function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Auto-targeting (03_mechanics.md 4.3: Mobile's "automatic targeting of the
 * nearest enemy", reused for Desktop too instead of real mouse-direction aim
 * - the whole game is otherwise strictly left/right-facing, no entity has
 * ever had a vertical or angled orientation) - nearest living enemy by
 * horizontal distance, either side of the player.
 * @param {Player} player
 * @param {Enemy[]} enemies
 * @returns {Enemy|null}
 */
export function findNearestEnemy(player, enemies) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of enemies) {
        if (enemy.dead) continue;
        const dist = Math.abs(enemy.centerX - player.centerX);
        if (dist < nearestDist) {
            nearest = enemy;
            nearestDist = dist;
        }
    }
    return nearest;
}

/**
 * Mode-decision only - reuses ATTACK_REACH_PX so melee/ranged never overlap
 * or gap. The actual melee hit still goes through resolveMeleeAttack()'s own
 * facing-direction hitbox rect, this just decides which path to take.
 * Edge-to-edge gap, not center-to-center distance - entities aren't the same
 * width (enemies are 64px, the player's hitbox is 32px), so two touching
 * bodies can already be 48px+ apart center-to-center despite having zero gap
 * between them. A negative gap (already overlapping) still counts as in range.
 * @param {Player} player
 * @param {Enemy} enemy
 * @returns {boolean}
 */
export function isWithinMeleeRange(player, enemy) {
    const gap = player.centerX <= enemy.centerX
        ? enemy.x - (player.x + player.width)
        : player.x - (enemy.x + enemy.width);
    return gap <= ATTACK_REACH_PX;
}

/**
 * Returns the enemies actually hit (as { enemy, amount }) so the caller can
 * drive UI feedback (floating damage numbers) without this module needing to
 * know anything about rendering.
 * @param {Player} player
 * @param {Enemy[]} enemies
 * @param {ShooterProjectile[]} [enemyProjectiles]
 * @returns {{enemy:Enemy,amount:number}[]}
 */
export function resolveMeleeAttack(player, enemies, enemyProjectiles = []) {
    const hitbox = _buildMeleeHitbox(player);
    const hits = _damageOverlappingEnemies(hitbox, enemies, player.facing);
    _destroyOverlappingProjectiles(hitbox, enemyProjectiles);
    return hits;
}

/**
 * @param {Player} player
 * @returns {{x:number,y:number,width:number,height:number}} Facing-direction melee hitbox.
 */
function _buildMeleeHitbox(player) {
    return player.facing === 1
        ? { x: player.x + player.width, y: player.y, width: ATTACK_REACH_PX, height: player.height }
        : { x: player.x - ATTACK_REACH_PX, y: player.y, width: ATTACK_REACH_PX, height: player.height };
}

/**
 * @param {{x:number,y:number,width:number,height:number}} hitbox
 * @param {Enemy[]} enemies
 * @param {1|-1} facing
 * @returns {{enemy:Enemy,amount:number}[]}
 */
function _damageOverlappingEnemies(hitbox, enemies, facing) {
    const hits = [];
    for (const enemy of enemies) {
        if (!enemy.dead && rectsOverlap(hitbox, enemy)) {
            const applied = enemy.takeDamage(PLAYER_ATTACK_DAMAGE);
            enemy.applyAttackKnockback(facing * ENEMY_KNOCKBACK_SPEED);
            hits.push({ enemy, amount: applied });
        }
    }
    return hits;
}

/**
 * The same swing also swats an incoming Shooter.js bolt out of the air - no
 * damage number, just destroyed (see resolveProjectileHits() for the
 * player's own thrown sword doing the same).
 * @param {{x:number,y:number,width:number,height:number}} hitbox
 * @param {ShooterProjectile[]} enemyProjectiles
 */
function _destroyOverlappingProjectiles(hitbox, enemyProjectiles) {
    for (const enemyProjectile of enemyProjectiles) {
        if (!enemyProjectile.dead && rectsOverlap(hitbox, enemyProjectile)) {
            enemyProjectile.dead = true;
        }
    }
}

/**
 * Same shape as the other resolve* functions (returns { enemy, amount } hits)
 * so damage numbers/hit-stop/knockback all keep working through GameState's
 * existing pipeline with no extra wiring beyond calling this once per frame.
 * @param {Projectile[]} projectiles
 * @param {Enemy[]} enemies
 * @param {ShooterProjectile[]} [enemyProjectiles]
 * @returns {{enemy:Enemy,amount:number}[]}
 */
export function resolveProjectileHits(projectiles, enemies, enemyProjectiles = []) {
    const hits = [];
    for (const projectile of projectiles) {
        if (projectile.dead) continue;
        const hit = _hitFirstOverlappingEnemy(projectile, enemies);
        if (hit) hits.push(hit);
        else _clashWithEnemyProjectile(projectile, enemyProjectiles);
    }
    return hits;
}

/**
 * @param {Projectile} projectile
 * @param {Enemy[]} enemies
 * @returns {{enemy:Enemy,amount:number}|null} The hit, if the projectile struck a living enemy.
 */
function _hitFirstOverlappingEnemy(projectile, enemies) {
    for (const enemy of enemies) {
        if (enemy.dead || !rectsOverlap(projectile, enemy)) continue;

        const applied = enemy.takeDamage(projectile.damage);
        enemy.applyAttackKnockback(projectile.direction * ENEMY_KNOCKBACK_SPEED);
        projectile.dead = true;
        return { enemy, amount: applied };
    }
    return null;
}

/**
 * The player's own thrown sword cuts through an incoming Shooter.js bolt the
 * same way - destroys the bolt, the thrown sword itself keeps flying (a
 * clash isn't a hit on either the player's or the enemy's *character*, so
 * nothing goes in `hits`).
 * @param {Projectile} projectile
 * @param {ShooterProjectile[]} enemyProjectiles
 */
function _clashWithEnemyProjectile(projectile, enemyProjectiles) {
    for (const enemyProjectile of enemyProjectiles) {
        if (!enemyProjectile.dead && rectsOverlap(projectile, enemyProjectile)) {
            enemyProjectile.dead = true;
            break;
        }
    }
}

/**
 * Shooter.js's fired shots (05_enemies-bosses.md 6.1 "keeps distance, fires
 * projectiles") - the enemy-side mirror of resolveProjectileHits() above,
 * checked against the single player instead of a list of enemies. Incoming
 * damage scales with difficulty (04_health-save-system.md 5.3), same as
 * resolveContactDamage() below - unlike the player's own outgoing damage
 * (PLAYER_ATTACK_DAMAGE), which never scales.
 * @param {ShooterProjectile[]} projectiles
 * @param {Player} player
 * @param {string} difficulty
 * @returns {{amount:number}[]}
 */
export function resolveEnemyProjectileHits(projectiles, player, difficulty) {
    const hits = [];
    if (player.dead) return hits;

    const multiplier = DIFFICULTY_DAMAGE_MULTIPLIERS[difficulty] ?? DIFFICULTY_DAMAGE_MULTIPLIERS.normal;

    for (const projectile of projectiles) {
        if (projectile.dead) continue;
        if (!rectsOverlap(projectile, player)) continue;

        const amount = projectile.damage * multiplier;
        player.takeDamage(amount);
        player.applyKnockback(projectile.direction * PLAYER_KNOCKBACK_SPEED);
        hits.push({ amount });
        projectile.dead = true;
    }
    return hits;
}

/**
 * 03_mechanics.md 4.5: "Enemy touches the barrier -> Enemy takes damage,
 * Prisma weakens" - a passive, always-on exchange distinct from the active
 * swing above. Enemy -> player damage uses each enemy's own contactDamage
 * (05_enemies-bosses.md 6.5 balancing table); the GDD doesn't give a
 * separate barrier -> enemy value yet, so this mirrors the same amount back
 * as a placeholder pending real balancing. Dead means no more Prisma barrier
 * - without this, an enemy idly overlapping the player's frozen
 * death-position hitbox would keep taking contact damage from a "ghost"
 * that shouldn't be a combatant anymore.
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player
 * @param {Enemy[]} enemies
 * @param {string} difficulty
 * @returns {{enemy:Enemy,amount:number}[]}
 */
export function resolveContactDamage(dt, player, enemies, difficulty) {
    if (player.dead) return [];

    const multiplier = DIFFICULTY_DAMAGE_MULTIPLIERS[difficulty] ?? DIFFICULTY_DAMAGE_MULTIPLIERS.normal;
    const hits = [];
    for (const enemy of enemies) {
        const hit = _resolveEnemyContact(dt, player, enemy, multiplier);
        if (hit) hits.push(hit);
    }
    return hits;
}

/**
 * Dormant (Sentinel.js, buried and not yet triggered) is harmless by design
 * - the ambush is the aggro range, not a surprise touch. A Charger mid-rush
 * is deliberately attacking, not just idly bumping into the barrier - hits
 * harder and skips the self-damage mirror, or every successful charge would
 * tick it to death off its own rush (25 HP / 10 contactDamage = dead in 3
 * barrier touches, which read as the Charger "suiciding" into the player).
 * The 1s contactCooldown still applies either way, so this can't fire more
 * than once per second per enemy regardless of charging. Pushes both apart
 * along whichever side the player is standing on, rather than a fixed
 * direction - mirrors the melee push above.
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player
 * @param {Enemy} enemy
 * @param {number} multiplier - Difficulty damage multiplier.
 * @returns {{enemy:Enemy,amount:number}|null} The hit, if contact damage actually landed this frame.
 */
function _resolveEnemyContact(dt, player, enemy, multiplier) {
    if (enemy.dead || enemy.dormant) return null;

    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    if (enemy.contactCooldown > 0) return null;
    if (!rectsOverlap(player, enemy)) return null;

    const isCharging = !!enemy.charging;
    const playerDamage = enemy.contactDamage * multiplier * (isCharging ? CHARGE_CONTACT_DAMAGE_MULTIPLIER : 1);

    player.takeDamage(playerDamage);
    if (!isCharging) enemy.takeDamage(enemy.contactDamage);

    const pushDir = player.centerX >= enemy.centerX ? 1 : -1;
    player.applyKnockback(pushDir * PLAYER_KNOCKBACK_SPEED);
    enemy.applyKnockback(-pushDir * ENEMY_KNOCKBACK_SPEED);
    enemy.contactCooldown = CONTACT_DAMAGE_COOLDOWN_SECONDS;
    return { enemy, amount: playerDamage };
}
