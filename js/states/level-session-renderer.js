import { PLAYER_REVEAL_RADIUS } from './level-session.js';

/** LevelSession's render pipeline, composed onto it rather than kept inline. */
export class LevelSessionRenderer {
    /**
     * Binds this renderer to the LevelSession it draws.
     * @param {LevelSession} session - Owning LevelSession to read state from.
     */
    constructor(session) {
        this.session = session;
    }

    /**
     * Draws the camera-transformed world, then the screen-space HUD bars.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
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
     * Buried enemies draw before the terrain layer so it occludes them.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderWorld(ctx) {
        this._renderBackground(ctx);
        this._renderEntities(ctx);
        this._renderPlayerOrGhost(ctx);
    }

    /**
     * Draws buried enemies, the baked level canvas, then the color zone.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderBackground(ctx) {
        const session = this.session;
        for (const enemy of session.enemyRoster.enemies) {
            if (enemy.buried) enemy.render(ctx);
        }
        ctx.drawImage(session.levelCanvas, 0, 0);
        this._renderColorZone(ctx);
    }

    /**
     * Draws interactables, non-buried enemies with their HP bars, combat projectiles, and player/enemy FX.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderEntities(ctx) {
        const session = this.session;
        session.interactables.render(ctx);
        for (const enemy of session.enemyRoster.enemies) {
            if (enemy.buried) continue;
            enemy.render(ctx);
            session.hud.renderEnemyBar(ctx, enemy);
        }
        session.combat.render(ctx);
        session.playerFx.render(ctx);
        session.enemyRoster.render(ctx);
    }

    /**
     * Draws the death ghost while active, otherwise the player.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderPlayerOrGhost(ctx) {
        const session = this.session;
        if (session.deathSequence.active) {
            session.deathSequence.render(ctx);
        } else {
            session.player.render(ctx);
        }
    }

    /**
     * No liveGlow while dead, to avoid punching a hole at the death spot every frame during the full-darken effect.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
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
     * Dev Panel toggle - draws each combat-relevant entity's actual Collision/Combat box, not its usually-larger sprite frame.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
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
     * Outlines the player's hitbox.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderPlayerHitbox(ctx) {
        const player = this.session.player;
        ctx.strokeStyle = '#5cff8a';
        ctx.strokeRect(player.x, player.y, player.width, player.height);
    }

    /**
     * Outlines every living, non-buried enemy's hitbox.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
     */
    _renderEnemyHitboxes(ctx) {
        ctx.strokeStyle = '#ffe75c';
        for (const enemy of this.session.enemyRoster.enemies) {
            if (enemy.dead || enemy.buried) continue;
            ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
    }

    /**
     * Player and enemy projectiles share one color.
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw into.
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
