// Two separate ways damage happens, both operating on plain Entity-shaped
// objects (x/y/width/height) plus the takeDamage() contract Player and Enemy
// each implement: resolveMeleeAttack (active swing, on request) vs
// resolveContactDamage (passive, checked continuously).

/**
 * How far the melee hitbox extends past the player's own hitbox -
 * independent of how far the sword sprite visually reaches.
 */
const ATTACK_REACH_PX = 40;

export const PLAYER_ATTACK_DAMAGE = 10;

/**
 * No longer spends Prisma - the cooldown (combat-coordinator.js's own timer) is the anti-spam gate instead.
 */
export const RANGED_ATTACK_DAMAGE = PLAYER_ATTACK_DAMAGE * 0.5;
export const RANGED_ATTACK_COOLDOWN_SECONDS = 2;

const CONTACT_DAMAGE_COOLDOWN_SECONDS = 1;

/**
 * Both entities' own knockback lock (player.js/enemy.js) briefly overrides normal movement while this plays out.
 */
const ENEMY_KNOCKBACK_SPEED = 180;
const PLAYER_KNOCKBACK_SPEED = 150;

/**
 * Difficulty scales only incoming damage; enemy HP and the player's own damage stay the same across all three.
 */
const DIFFICULTY_DAMAGE_MULTIPLIERS = { easy: 0.5, normal: 1, hard: 2 };

/**
 * Charger mid-rush (entities/enemies/charger.js's `charging`) hits harder through the passive contact-damage barrier.
 */
const CHARGE_CONTACT_DAMAGE_MULTIPLIER = 2;

/**
 * Checks two axis-aligned rects for overlap.
 * @param {{x:number,y:number,width:number,height:number}} a - First rect to check.
 * @param {{x:number,y:number,width:number,height:number}} b - Second rect to check.
 * @returns {boolean}
 */
function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Finds the nearest living enemy to the player, used for auto-targeting on both mobile and desktop.
 * @param {Player} player - Player to find the nearest enemy to.
 * @param {Enemy[]} enemies - Enemies to search among.
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
 * Mode-decision only - reuses ATTACK_REACH_PX so melee/ranged never overlap or gap.
 * @param {Player} player - Attacking player.
 * @param {Enemy} enemy - Enemy to check range against.
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
 * @param {Player} player - Attacking player.
 * @param {Enemy[]} enemies - Enemies to check the swing against.
 * @param {ShooterProjectile[]} [enemyProjectiles] - Enemy projectiles the swing can also swat out of the air.
 * @returns {{enemy:Enemy,amount:number}[]}
 */
export function resolveMeleeAttack(player, enemies, enemyProjectiles = []) {
    const hitbox = _buildMeleeHitbox(player);
    const hits = _damageOverlappingEnemies(hitbox, enemies, player.facing);
    _destroyOverlappingProjectiles(hitbox, enemyProjectiles);
    return hits;
}

/**
 * Builds the melee hitbox extending ATTACK_REACH_PX past the player, in the direction they're facing.
 * @param {Player} player - Attacking player.
 * @returns {{x:number,y:number,width:number,height:number}} Facing-direction melee hitbox.
 */
function _buildMeleeHitbox(player) {
    return player.facing === 1
        ? { x: player.x + player.width, y: player.y, width: ATTACK_REACH_PX, height: player.height }
        : { x: player.x - ATTACK_REACH_PX, y: player.y, width: ATTACK_REACH_PX, height: player.height };
}

/**
 * Damages and knocks back every living enemy overlapping the hitbox.
 * @param {{x:number,y:number,width:number,height:number}} hitbox - Melee hitbox to check overlap against.
 * @param {Enemy[]} enemies - Enemies to check the hitbox against.
 * @param {1|-1} facing - Direction to apply knockback in.
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
 * Swats an incoming shooter.js bolt out of the air, same as the thrown sword's own clash check.
 * @param {{x:number,y:number,width:number,height:number}} hitbox - Melee hitbox to check overlap against.
 * @param {ShooterProjectile[]} enemyProjectiles - Enemy projectiles to swat out of the air.
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
 * @param {Projectile[]} projectiles - The player's own thrown-sword projectiles.
 * @param {Enemy[]} enemies - Enemies to check for hits.
 * @param {ShooterProjectile[]} [enemyProjectiles] - Enemy projectiles a clash can destroy.
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
 * Damages and destroys the projectile against the first living enemy it overlaps.
 * @param {Projectile} projectile - Projectile to check against every enemy.
 * @param {Enemy[]} enemies - Enemies to check for hits.
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
 * Destroys an overlapping enemy bolt; the thrown sword itself survives and isn't counted as a hit.
 * @param {Projectile} projectile - The player's own thrown-sword projectile.
 * @param {ShooterProjectile[]} enemyProjectiles - Enemy projectiles it can clash with.
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
 * Resolves shooter.js's fired shots against the player - the enemy-side mirror of resolveProjectileHits().
 * @param {ShooterProjectile[]} projectiles - Enemy-fired projectiles to resolve.
 * @param {Player} player - Player to check for hits.
 * @param {string} difficulty - Game.difficulty, for incoming-damage scaling.
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
 * Damages and knocks back the player if this projectile overlaps them.
 * @param {ShooterProjectile} projectile - Enemy-fired projectile to check.
 * @param {Player} player - Player to check for a hit.
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
 * @param {Player} player - Player to check for contact damage.
 * @param {Enemy[]} enemies - Enemies to check for contact damage.
 * @param {string} difficulty - Game.difficulty, for incoming-damage scaling.
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
 * A charging enemy skips the self-damage mirror (enemyAmount 0) - otherwise
 * every charge would tick it to death off its own rush.
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player - Player to check for contact damage.
 * @param {Enemy} enemy - Enemy to check for contact damage.
 * @param {number} multiplier - Difficulty damage multiplier.
 * @returns {{enemy:Enemy,playerAmount:number,enemyAmount:number}|null} The hit, if contact damage actually landed this frame.
 */
function _resolveEnemyContact(dt, player, enemy, multiplier) {
    if (!_canContactDamage(dt, player, enemy)) return null;

    const isCharging = !!enemy.charging;
    const playerAmount = enemy.contactDamage * multiplier * (isCharging ? CHARGE_CONTACT_DAMAGE_MULTIPLIER : 1);
    const selfDamage = enemy.contactDamage * enemy.contactSelfDamageMultiplier;
    const enemyAmount = isCharging ? 0 : enemy.takeDamage(selfDamage, { scaleForVulnerable: false });
    _applyContactHit(player, enemy, playerAmount);
    return { enemy, playerAmount, enemyAmount };
}

/**
 * Ticks the enemy's contact cooldown and checks whether it's eligible to hit the player this frame.
 * @param {number} dt - Elapsed time in seconds.
 * @param {Player} player - Player to check overlap against.
 * @param {Enemy} enemy - Enemy to check overlap and cooldown against.
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
 * @param {Player} player - Player taking the damage/knockback.
 * @param {Enemy} enemy - Enemy whose contact cooldown resets.
 * @param {number} playerAmount - Damage amount applied to the player.
 */
function _applyContactHit(player, enemy, playerAmount) {
    player.takeDamage(playerAmount);

    const pushDir = player.centerX >= enemy.centerX ? 1 : -1;
    player.applyKnockback(pushDir * PLAYER_KNOCKBACK_SPEED);
    enemy.applyKnockback(-pushDir * ENEMY_KNOCKBACK_SPEED);
    enemy.contactCooldown = CONTACT_DAMAGE_COOLDOWN_SECONDS;
}
