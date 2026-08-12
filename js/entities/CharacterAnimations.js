import { SpriteAnimation } from '../utils/SpriteAnimation.js';

/**
 * attack.png uses a wider canvas than the other guardian sheets, to fit the sword's swing.
 */
const CHARACTER_FRAME_SIZE = 96;
const ATTACK_FRAME_WIDTH = 150;
const ATTACK_FRAME_HEIGHT = 96;

/**
 * enter-afk.png/afk.png use a smaller 64x64 canvas than the other guardian
 * sheets; the renderer scales to idle's size regardless.
 */
const AFK_FRAME_SIZE = 64;

/**
 * Player action smoke (entities/VfxEffect.js, Player.js's pendingVfx
 * mailbox); all three sheets are 64x64 frames.
 */
export const VFX_FRAME_SIZE = 64;
export const VFX_CLIPS = {
    jump: { imageKey: 'vfx-jump', frameCount: 11, fps: 24 },
    landing: { imageKey: 'vfx-landing', frameCount: 9, fps: 20 },
    dash: { imageKey: 'vfx-dash', frameCount: 14, fps: 28 },
};

/**
 * @param {AssetLoader} assets
 * @returns {object} Named SpriteAnimation set for guardian-idle/running/jump/attack/dead.
 */
export function buildPlayerAnimations(assets) {
    return {
        idle: new SpriteAnimation(assets.getImage('guardian-idle'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 9, 8),
        running: new SpriteAnimation(assets.getImage('guardian-running'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 12, 14),
        jump: new SpriteAnimation(assets.getImage('guardian-jump'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 12),
        attack: new SpriteAnimation(assets.getImage('guardian-attack'), ATTACK_FRAME_WIDTH, ATTACK_FRAME_HEIGHT, 8, 16, { loop: false }),
        afkEnter: new SpriteAnimation(assets.getImage('guardian-afk-enter'), AFK_FRAME_SIZE, AFK_FRAME_SIZE, 11, 10, { loop: false }),
        afk: new SpriteAnimation(assets.getImage('guardian-afk'), AFK_FRAME_SIZE, AFK_FRAME_SIZE, 5, 6),
        dead: new SpriteAnimation(assets.getImage('guardian-dead'), CHARACTER_FRAME_SIZE, CHARACTER_FRAME_SIZE, 13, 10, { loop: false }),
    };
}

/**
 * Wraith.js's 6-clip-as-6-states shape; each a distinct drawn pose, not a generic looping cycle.
 * @param {AssetLoader} assets
 * @returns {object} Named SpriteAnimation set for the Wraith's state machine.
 */
export function buildWraithAnimations(assets) {
    return {
        idle: new SpriteAnimation(assets.getImage('boss-wraith-idle'), 128, 256, 12, 8),
        toFiring: new SpriteAnimation(assets.getImage('boss-wraith-to-firing'), 128, 256, 12, 14, { loop: false }),
        firing: new SpriteAnimation(assets.getImage('boss-wraith-firing'), 128, 256, 1, 1),
        toVulnerable: new SpriteAnimation(assets.getImage('boss-wraith-to-vulnerable'), 128, 256, 9, 3, { loop: false }),
        vulnerable: new SpriteAnimation(assets.getImage('boss-wraith-vulnerable'), 128, 256, 1, 1),
        toIdle: new SpriteAnimation(assets.getImage('boss-wraith-to-idle'), 128, 256, 8, 12, { loop: false }),
        dead: new SpriteAnimation(assets.getImage('boss-wraith-dead'), 128, 256, 11, 14, { loop: false }),
    };
}

/**
 * Same 7-clip-as-7-states shape as buildWraithAnimations(), sized for the lv_6_boss sheets' 96x150 frames.
 * @param {AssetLoader} assets
 * @returns {object} Named SpriteAnimation set for the Templateboss's state machine.
 */
export function buildTemplatebossAnimations(assets) {
    return {
        idle: new SpriteAnimation(assets.getImage('boss-templateboss-idle'), 96, 150, 9, 8),
        toFiring: new SpriteAnimation(assets.getImage('boss-templateboss-to-firing'), 96, 150, 6, 14, { loop: false }),
        firing: new SpriteAnimation(assets.getImage('boss-templateboss-firing'), 96, 150, 1, 1),
        toVulnerable: new SpriteAnimation(assets.getImage('boss-templateboss-to-vulnerable'), 96, 150, 11, 3, { loop: false }),
        vulnerable: new SpriteAnimation(assets.getImage('boss-templateboss-vulnerable'), 96, 150, 1, 1),
        toIdle: new SpriteAnimation(assets.getImage('boss-templateboss-to-idle'), 96, 150, 7, 12, { loop: false }),
        dead: new SpriteAnimation(assets.getImage('boss-templateboss-dead'), 96, 150, 9, 14, { loop: false }),
    };
}

/**
 * @param {AssetLoader} assets
 * @param {'jump'|'landing'|'dash'} key
 * @returns {SpriteAnimation}
 */
export function buildVfxAnimation(assets, key) {
    const { imageKey, frameCount, fps } = VFX_CLIPS[key];
    return new SpriteAnimation(assets.getImage(imageKey), VFX_FRAME_SIZE, VFX_FRAME_SIZE, frameCount, fps, { loop: false });
}
