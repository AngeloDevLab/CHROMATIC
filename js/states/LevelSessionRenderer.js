import { PLAYER_REVEAL_RADIUS } from './LevelSession.js';

// LevelSession's render pipeline, composed onto it rather than kept inline -
// same pattern as PlayerRenderer.js. Reads state off the session reference
// passed in and owns nothing else.
export class LevelSessionRenderer {
    /**
     * @param {LevelSession} session
     */
    constructor(session) {
        this.session = session;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        const session = this.session;
        ctx.save();
        ctx.scale(session.camera.zoom, session.camera.zoom);
        ctx.translate(-Math.round(session.camera.x), -Math.round(session.camera.y));

        this._renderWorld(ctx);
        if (session.game.devPanel.showHitboxes) this._renderHitboxes(ctx);

        ctx.restore();
        session.hud.renderPlayerBars(ctx, session.player, session.game.hudScale);
    }

    /**
     * Everything drawn in world (camera-translated) space, back-to-front:
     * buried enemies -> the baked level canvas -> the color mechanic ->
     * interactables/enemies/projectiles -> the player (or its death ghost).
     * Buried enemies (Sentinel.js, not yet triggered) draw before the
     * terrain layer so it occludes them instead of floating in front of it.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderWorld(ctx) {
        const session = this.session;
        for (const enemy of session.enemyRoster.enemies) {
            if (enemy.buried) enemy.render(ctx);
        }
        ctx.drawImage(session.levelCanvas, 0, 0);
        this._renderColorZone(ctx);

        session.interactables.render(ctx);
        for (const enemy of session.enemyRoster.enemies) {
            if (enemy.buried) continue;
            enemy.render(ctx);
            session.hud.renderEnemyBar(ctx, enemy);
        }
        session.combat.render(ctx);
        session.playerFx.render(ctx);

        if (session.deathSequence.active) {
            session.deathSequence.render(ctx);
        } else {
            session.player.render(ctx);
        }
    }

    /**
     * No liveGlow while dead - that would keep punching a hole open right
     * at the death spot every frame, fighting the full-darken effect.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderColorZone(ctx) {
        const session = this.session;
        if (session.deathSequence.active) {
            session.colorZone.render(ctx);
        } else {
            session.colorZone.render(ctx, {
                x: session.player.centerX,
                y: session.player.visualCenterY,
                radius: PLAYER_REVEAL_RADIUS,
            });
        }
    }

    /**
     * Dev Panel toggle - draws each combat-relevant entity's actual
     * Collision/Combat box, not its usually-larger sprite frame, so hit
     * reads line up with what's on screen.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderHitboxes(ctx) {
        ctx.save();
        ctx.lineWidth = 1;
        this._renderPlayerHitbox(ctx);
        this._renderEnemyHitboxes(ctx);
        this._renderProjectileHitboxes(ctx);
        ctx.restore();
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderPlayerHitbox(ctx) {
        const player = this.session.player;
        ctx.strokeStyle = '#5cff8a';
        ctx.strokeRect(player.x, player.y, player.width, player.height);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderEnemyHitboxes(ctx) {
        ctx.strokeStyle = '#ffe75c';
        for (const enemy of this.session.enemyRoster.enemies) {
            if (enemy.dead || enemy.buried) continue;
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
    }

    /**
     * Player and enemy projectiles share one color - both pools are
     * combat-relevant the same way, unlike the player/enemy split above.
     * @param {CanvasRenderingContext2D} ctx
     */
    _renderProjectileHitboxes(ctx) {
        const session = this.session;
        ctx.strokeStyle = '#5cc9ff';
        for (const projectile of session.combat.projectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }
        for (const projectile of session.combat.enemyProjectiles) {
            ctx.strokeRect(projectile.x, projectile.y, projectile.width, projectile.height);
        }
    }
}
