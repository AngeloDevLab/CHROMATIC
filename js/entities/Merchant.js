import { Entity } from './Entity.js';

// Placeholder footprint only - no Merchant art exists yet (session decision:
// build the trigger/dialogue now, wire in real art later without touching
// this class beyond adding a sprite param, same as Portal.js's constructor
// shape). render() intentionally does nothing until then.
const WIDTH = 32;
const HEIGHT = 64;

export class Merchant extends Entity {
    constructor(x, y) {
        super(x, y, WIDTH, HEIGHT);
    }

    render(ctx) {}
}
