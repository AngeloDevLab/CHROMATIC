// Two separate ways damage happens (03_mechanics.md 4.3 + 4.5), both operating
// on plain Entity-shaped objects (x/y/width/height) plus the takeDamage()
// contract Player and Enemy each implement:
// - resolveMeleeAttack: the active sword swing, once per swing, on request.
// - resolveContactDamage: the passive Prisma barrier, checked continuously.

// How far the melee hitbox extends past the player's own hitbox - a gameplay
// value independent of how far the sword sprite visually reaches, so the
// player isn't forced into the enemy's own contact range just to land a hit.
const ATTACK_REACH_PX = 40;

// 03_mechanics.md 4.3: uniform for melee and ranged, no separate balancing variable.
export const PLAYER_ATTACK_DAMAGE = 10;

// Ranged Sword Throw spends Prisma as a resource cost (Player.js's
// consumeShield(), not takeDamage()) rather than being free - without this it
// could be spammed as long as an enemy stays just out of melee range. Melee
// itself stays free; only the ranged path (GameState.js) charges this.
export const RANGED_ATTACK_PRISMA_COST = 10;

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

function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Auto-targeting (03_mechanics.md 4.3: Mobile's "automatic targeting of the
// nearest enemy", reused for Desktop too instead of real mouse-direction aim
// - the whole game is otherwise strictly left/right-facing, no entity has
// ever had a vertical or angled orientation) - nearest living enemy by
// horizontal distance, either side of the player.
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

// Mode-decision only - reuses ATTACK_REACH_PX so melee/ranged never overlap
// or gap. The actual melee hit still goes through resolveMeleeAttack's own
// facing-direction hitbox rect below, this just decides which path to take.
export function isWithinMeleeRange(player, enemy) {
    return Math.abs(enemy.centerX - player.centerX) <= ATTACK_REACH_PX;
}

// Returns the enemies actually hit (as { enemy, amount }) so the caller can
// drive UI feedback (floating damage numbers) without this module needing to
// know anything about rendering.
export function resolveMeleeAttack(player, enemies) {
    const hitbox = player.facing === 1
        ? { x: player.x + player.width, y: player.y, width: ATTACK_REACH_PX, height: player.height }
        : { x: player.x - ATTACK_REACH_PX, y: player.y, width: ATTACK_REACH_PX, height: player.height };

    const hits = [];
    for (const enemy of enemies) {
        if (!enemy.dead && rectsOverlap(hitbox, enemy)) {
            enemy.takeDamage(PLAYER_ATTACK_DAMAGE);
            enemy.applyAttackKnockback(player.facing * ENEMY_KNOCKBACK_SPEED);
            hits.push({ enemy, amount: PLAYER_ATTACK_DAMAGE });
        }
    }
    return hits;
}

// Same shape as the other resolve* functions (returns { enemy, amount } hits)
// so damage numbers/hit-stop/knockback all keep working through GameState's
// existing pipeline with no extra wiring beyond calling this once per frame.
export function resolveProjectileHits(projectiles, enemies) {
    const hits = [];
    for (const projectile of projectiles) {
        if (projectile.dead) continue;

        for (const enemy of enemies) {
            if (enemy.dead) continue;
            if (!rectsOverlap(projectile, enemy)) continue;

            enemy.takeDamage(projectile.damage);
            enemy.applyAttackKnockback(projectile.direction * ENEMY_KNOCKBACK_SPEED);
            hits.push({ enemy, amount: projectile.damage });
            projectile.dead = true;
            break;
        }
    }
    return hits;
}

// 03_mechanics.md 4.5: "Enemy touches the barrier -> Enemy takes damage,
// Prisma weakens" - a passive, always-on exchange distinct from the active
// swing above. Enemy -> player damage uses each enemy's own contactDamage
// (05_enemies-bosses.md 6.5 balancing table); the GDD doesn't give a separate
// barrier -> enemy value yet, so this mirrors the same amount back as a
// placeholder pending real balancing.
export function resolveContactDamage(dt, player, enemies, difficulty) {
    // Dead means no more Prisma barrier - nothing to zap enemies with, and
    // nothing left to hurt. Without this, an enemy idly overlapping the
    // player's frozen death-position hitbox keeps taking contact damage from
    // a "ghost" that shouldn't be a combatant anymore.
    if (player.dead) return [];

    const multiplier = DIFFICULTY_DAMAGE_MULTIPLIERS[difficulty] ?? DIFFICULTY_DAMAGE_MULTIPLIERS.normal;

    const hits = [];
    for (const enemy of enemies) {
        if (enemy.dead) continue;

        enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
        if (enemy.contactCooldown > 0) continue;

        if (!rectsOverlap(player, enemy)) continue;

        // A Charger mid-rush is deliberately attacking, not just idly bumping
        // into the barrier - hits harder and skips the self-damage mirror
        // below, or every successful charge would tick it to death off its
        // own rush (25 HP / 10 contactDamage = dead in 3 barrier touches,
        // which read as the Charger "suiciding" into the player). The 1s
        // contactCooldown above still applies either way, so this can't fire
        // more than once per second per enemy regardless of charging.
        const isCharging = !!enemy.charging;
        const playerDamage = enemy.contactDamage * multiplier * (isCharging ? CHARGE_CONTACT_DAMAGE_MULTIPLIER : 1);

        player.takeDamage(playerDamage);
        if (!isCharging) enemy.takeDamage(enemy.contactDamage);
        // Push both apart along whichever side the player is standing on,
        // rather than a fixed direction - mirrors the melee push above.
        const pushDir = player.centerX >= enemy.centerX ? 1 : -1;
        player.applyKnockback(pushDir * PLAYER_KNOCKBACK_SPEED);
        enemy.applyKnockback(-pushDir * ENEMY_KNOCKBACK_SPEED);
        enemy.contactCooldown = CONTACT_DAMAGE_COOLDOWN_SECONDS;
        hits.push({ enemy, amount: playerDamage });
    }
    return hits;
}
