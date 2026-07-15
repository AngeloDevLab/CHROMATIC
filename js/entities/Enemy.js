import { Entity } from './Entity.js';

// No behavior yet (05_enemies-bosses.md Patroller/Charger/Shooter/Sentinel AI
// comes later) - just spawns and renders a static sprite at its EnemySpawn
// position, to prove the Objects-layer spawn pipeline works end to end.
export class Enemy extends Entity {
    constructor(x, y, sprite, width = sprite.width, height = sprite.height) {
        super(x, y, width, height);
        this.sprite = sprite;
    }

    render(ctx) {
        ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    }
}
