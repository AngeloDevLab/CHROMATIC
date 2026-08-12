// Two separate ways damage happens (03_mechanics.md 4.3 + 4.5), both operating
// on plain Entity-shaped objects (x/y/width/height) plus the takeDamage()
// contract Player and Enemy each implement:
// - resolveMeleeAttack: the active sword swing, once per swing, on request.
// - resolveContactDamage: the passive Prisma barrier, checked continuously.

/**
 * How far the melee hitbox extends past the player's own hitbox -
 * independent of how far the sword sprite visually reaches.
 */
const ATTACK_REACH_PX = 40;

export const PLAYER_ATTACK_DAMAGE = 10;

/**
 * Ranged Sword Throw deals half of melee's damage and no longer spends
 * Prisma - a cooldown (CombatCoordinator.js's own timer) is the anti-spam
 * gate instead.
 */
export const RANGED_ATTACK_DAMAGE = PLAYER_ATTACK_DAMAGE * 0.5;
export const RANGED_ATTACK_COOLDOWN_SECONDS = 2;

/**
 * Per-enemy cooldown between contact-damage ticks.
 */
const CONTACT_DAMAGE_COOLDOWN_SECONDS = 1;

/**
 * Combat feel: knockback speed applied away from whoever landed the hit.
 * Both entities' own knockback lock (Player.js/Enemy.js) briefly overrides normal movement.
 */
const ENEMY_KNOCKBACK_SPEED = 180;
const PLAYER_KNOCKBACK_SPEED = 150;

/**
 * 04_health-save-system.md 5.3: difficulty scales only incoming damage;
 * enemy HP and the player's own damage stay the same across all three.
 * Falls back to Normal (1) for an unrecognized/missing difficulty.
 */
const DIFFICULTY_DAMAGE_MULTIPLIERS = { easy: 0.5, normal: 1, hard: 2 };

/**
 * Charger mid-rush (entities/enemies/Charger.js's `charging`) hits harder
 * through the passive barrier below, instead of also zapping itself for the
 * normal contactDamage amount - see resolveContactDamage.
 */
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
 * nearest enemy", reused for Desktop too) - nearest living enemy by
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
 * Edge-to-edge gap, not center-to-center distance. A negative gap (already
 * overlapping) still counts as in range.
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
 * Returns the enemies actually hit (as { enemy, amount }).
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
 * Same shape as the other resolve* functions (returns { enemy, amount } hits).
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
 * same way - destroys the bolt, the thrown sword keeps flying. A clash isn't
 * a hit on either character, so nothing goes in `hits`.
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
 * Resolves Shooter.js's fired shots against the player - the enemy-side mirror of resolveProjectileHits().
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
        const hit = _resolveEnemyProjectileHit(projectile, player, multiplier);
        if (hit) hits.push(hit);
    }
    return hits;
}

/**
 * @param {ShooterProjectile} projectile
 * @param {Player} player
 * @param {number} multiplier - Difficulty damage multiplier.
 * @returns {{amount:number}|null} The hit, if this projectile actually landed this frame.
 */
function _resolveEnemyProjectileHit(projectile, player, multiplier) {
    if (projectile.dead || !rectsOverlap(projectile, player)) return null;

    const amount = projectile.damage * multiplier;
    player.takeDamage(amount);
    player.applyKnockback(projectile.direction * PLAYER_KNOCKBACK_SPEED);
    projectile.dead = true;
    return { amount };
}

/**
 * Resolves passive contact damage between the player and every enemy this frame.
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player
 * @param {Enemy[]} enemies
 * @param {string} difficulty
 * @returns {{enemy:Enemy,playerAmount:number,enemyAmount:number}[]}
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
 * Resolves contact damage between the player and one enemy, if cooldown and
 * overlap allow it. A charging enemy skips the self-damage mirror
 * (enemyAmount 0) - otherwise every charge would tick it to death off its own rush.
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player
 * @param {Enemy} enemy
 * @param {number} multiplier - Difficulty damage multiplier.
 * @returns {{enemy:Enemy,playerAmount:number,enemyAmount:number}|null} The hit, if contact damage actually landed this frame.
 */
function _resolveEnemyContact(dt, player, enemy, multiplier) {
    if (!_canContactDamage(dt, player, enemy)) return null;

    const isCharging = !!enemy.charging;
    const playerAmount = enemy.contactDamage * multiplier * (isCharging ? CHARGE_CONTACT_DAMAGE_MULTIPLIER : 1);
    const enemyAmount = isCharging ? 0 : enemy.takeDamage(enemy.contactDamage);
    _applyContactHit(player, enemy, playerAmount);
    return { enemy, playerAmount, enemyAmount };
}

/**
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player
 * @param {Enemy} enemy
 * @returns {boolean}
 */
function _canContactDamage(dt, player, enemy) {
    if (enemy.dead || enemy.dormant) return false;
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    if (enemy.contactCooldown > 0) return false;
    return rectsOverlap(player, enemy);
}

/**
 * Applies the player's damage/knockback and resets the enemy's contact cooldown.
 * @param {Player} player
 * @param {Enemy} enemy
 * @param {number} playerAmount
 */
function _applyContactHit(player, enemy, playerAmount) {
    player.takeDamage(playerAmount);

    const pushDir = player.centerX >= enemy.centerX ? 1 : -1;
    player.applyKnockback(pushDir * PLAYER_KNOCKBACK_SPEED);
    enemy.applyKnockback(-pushDir * ENEMY_KNOCKBACK_SPEED);
    enemy.contactCooldown = CONTACT_DAMAGE_COOLDOWN_SECONDS;
}
