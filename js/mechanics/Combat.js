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

// Per-enemy cooldown between contact-damage ticks, so standing inside an enemy
// doesn't deal damage every single frame.
const CONTACT_DAMAGE_COOLDOWN_SECONDS = 1;

function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
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
            hits.push({ enemy, amount: PLAYER_ATTACK_DAMAGE });
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
export function resolveContactDamage(dt, player, enemies) {
    const hits = [];
    for (const enemy of enemies) {
        if (enemy.dead) continue;

        enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
        if (enemy.contactCooldown > 0) continue;

        if (!rectsOverlap(player, enemy)) continue;

        player.takeDamage(enemy.contactDamage);
        enemy.takeDamage(enemy.contactDamage);
        enemy.contactCooldown = CONTACT_DAMAGE_COOLDOWN_SECONDS;
        hits.push({ enemy, amount: enemy.contactDamage });
    }
    return hits;
}
