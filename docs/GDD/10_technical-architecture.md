# 11. Technical Architecture

## 11.1 Tech Stack

- HTML5 Canvas for rendering
- Vanilla JavaScript - ES Modules
- OOP with classes and inheritance
- State-driven architecture
- LocalStorage for save data

## 11.2 Folder Structure

| Folder | Content |
|---|---|
| core/ | Game.js, StateMachine.js, AssetLoader.js, InputHandler.js |
| states/ | State.js (base), LoadingState, MenuState, WorldmapState, GameState, PauseState, BossState, BuffState, GameOverState, CutsceneState |
| entities/ | Entity.js (base), Player.js |
| entities/enemies/ | Enemy.js (base), Patroller, Charger, Shooter, Sentinel |
| entities/bosses/ | Boss.js (base), Miniboss.js, Templateboss.js (Chapterboss inherits from Templateboss) |
| mechanics/ | Combat.js, ColorZone.js, Shield.js, Ability.js (base), DoubleJump, Dash, WallJump, TokenEconomy.js |
| world/ | World.js, Level.js, Room.js, Checkpoint.js |
| ui/ | HUD.js, BossHealthBar.js, ShieldBar.js, AbilityUnlock.js, MobileControls.js |
| utils/ | SaveManager.js, Camera.js, Collision.js, SpriteAnimation.js |

Inheritance chain: Entity → Enemy → Boss → Templateboss → Chapterboss. Patroller/Charger/Shooter/Sentinel inherit directly from Enemy, Player inherits directly from Entity. Abilities (DoubleJump/Dash/WallJump) are not inheritance, but composition - they're attached to the Player as Ability instances.

### 11.2.1 Assets Folder

| Folder | Content |
|---|---|
| assets/images/character/ | Player sprite sheets (e.g. `idle.png`, `running.png`) |
| assets/images/tilesets/ | Tileset PNGs + their Tiled `.tsx` companion files |
| assets/images/backgrounds/ | Parallax background images |
| assets/levels/ | Tiled JSON level exports |
| assets/fonts/ | Self-hosted font files (see [09_audio-visual.md](09_audio-visual.md) 10.1) |
| assets/sounds/ | Music, SFX |

## 11.3 Controls

| Platform | Movement | Attack | Pause |
|---|---|---|---|
| Desktop | WASD / Arrow keys | Mouse click | ESC |
| Mobile | Left/Right/Duck/Jump Button | Attack Button (auto-targeting) | Pause Button |

## 11.4 Language & Localization

The game's output (UI text, dialogue, story fragments) is **English**. The GDD documentation remains German as the working language. A localization/translation layer is **not planned** at this time - strings are authored directly in English, not routed through a translation system.

## 11.5 Asset Hosting

Sprites, images, and sounds are delivered as static files within the project - no Firebase or other backend needed. A regular static host (e.g. Netlify, Vercel, GitHub Pages) is enough for delivery via AssetLoader.js. Firebase remains relevant only as an optional Phase 2 extension for cross-device saves, see [04_health-save-system.md](04_health-save-system.md).

## 11.6 Level Design Pipeline (Tiled)

Levels are built in [Tiled](https://www.mapeditor.org/) and exported as JSON (not TMX/XML) - directly loadable via `fetch()` + `JSON.parse()`, no XML parsing needed in the game. Loaded via `world/Level.js`.

### 11.6.1 Layer Convention

| Layer | Type | Purpose |
|---|---|---|
| Background | Tile layer | Purely visual, no collision |
| Terrain/Collision | Tile layer | Every painted tile is solid - floor, wall, and ceiling are the same layer. Whether a touch means floor, wall (relevant for wall jump), or ceiling is decided by `utils/Collision.js` based on the direction of contact, not the layer |
| Decoration | Tile layer | Purely visual, never collidable. If a decoration element should block movement (e.g. a desk), that tile belongs in Terrain/Collision instead |
| Objects | Object layer (Tiled markers, not painted tiles) | Player start, enemy spawns, Secret Room trigger, boss trigger, exit portal, checkpoint, doors - see 11.6.2 |

Tiles in the Terrain/Collision layer must visually fill their full 32x32 cell, opaque edge to edge - a tile that only occupies half its cell (e.g. a thin grass strip with transparent padding above or below) leaves it ambiguous whether collision covers the whole cell or just the visible part, and `Collision.js` doesn't special-case partial tiles. Decorative overhang (taller grass tufts, edge detail poking above the grid line) belongs on the Decoration layer instead, layered on top of a fully solid Terrain/Collision tile.

### Background vs. Parallax

Two separate layers that complement rather than replace each other:

- **Tiled Background layer** (part of the tilemap): scrolls 1:1 with the camera, for the immediate wall/floor texture right behind the playable area
- **Parallax layer** (own images, not painted in Tiled, rendered in `Camera.js` with its own scroll factor e.g. 0.2x-0.5x): for distant atmosphere (sky, skyline, tree lines)

Both are generally present at the same time, only the visual weight shifts depending on the scene:

- **Enclosed spaces** (e.g. a cave passage): the Tiled Background carries the main work (rock wall right behind the platform) - little "distance" to show, parallax minimal or omitted
- **Open areas** (e.g. an overpass above that same cave): parallax carries most of the weight (trees/bushes/sky in the distance), the Tiled Background stays sparse (at most a few nearby bushes right at the bridge railing)

Saving effort: Combat/Exploration corridors get a simple, repeating tile pattern as background (reusable across many levels), real hand-painted background compositions are only worth it in boss rooms and Secret Rooms, where the player lingers and looks around.

### 11.6.2 Objects Layer: Markers Instead of Sprites

For data markers without a sprite, the rectangle/point tool on the Object Layer is enough - no dedicated tileset needed. Per object:

1. Set the **Class** (called "Type" in older Tiled versions), e.g. `EnemySpawn`, `Door`, `SecretTrigger`, `PlayerStart`, `ExitPortal`
2. Add **Custom Properties**, e.g. for `EnemySpawn` the property `enemyType` (string) = `"Patroller"`

Recommendation: predefine Custom Types once in Tiled's Custom Types Editor (Project menu), so every new object with that Class automatically comes with the matching property fields, instead of retyping the schema every time.

Example object in the JSON export:
```json
{
  "type": "EnemySpawn",
  "x": 320, "y": 480, "width": 32, "height": 32,
  "properties": [
    { "name": "enemyType", "type": "string", "value": "Patroller" }
  ]
}
```
The loader in `world/Level.js` reads `type` + `properties` and creates the matching entity from it (e.g. `new Patroller(320, 480)`). A door is deliberately treated as an Object/Entity rather than a Terrain tile, because it has a state (open/closed) that a static tile cannot represent.

## 11.7 Resolution, Scaling & Size Convention

### 11.7.1 Base Resolution

Internal render resolution: **640x360**. At common desktop resolutions this lands on a whole-number scale factor:

| Target Resolution | Scale Factor |
|---|---|
| 1280x720 | 2x |
| 1920x1080 (FullHD) | 3x |
| 2560x1440 | 4x |
| 3840x2160 (4K) | 6x |

The canvas element has two separate sizes: the drawing surface (`canvas.width/height` = 640x360, determines the field of view) and the display size (`canvas.style.width/height`, scaled up by the browser to the target resolution). `image-rendering: pixelated` makes sure this scaling happens via nearest-neighbor (crisp) instead of smooth interpolation (blurry).

The game always fills as much of the browser window as possible - scaling is fractional (`min(window.innerWidth/640, window.innerHeight/360)`, recalculated on resize), not restricted to the whole-number steps above. A whole-number match stays the crispest case, but any other window size still fills the screen (small letterbox bars only where the window's aspect ratio isn't 16:9) rather than snapping down to the next lower integer step and leaving large black bars. A dedicated fullscreen toggle (Fullscreen API, `requestFullscreen()`/`exitFullscreen()`) additionally lets the browser chrome (address bar, tabs) hide entirely, on both desktop and mobile.

Deliberately **no** larger field of view on larger screens - otherwise players with a higher resolution would have a visibility advantage (enemies, projectiles, Secret Rooms visible earlier). The field of view stays the same for everyone, only the display size changes.

### 11.7.2 Size Convention

- Tile size: 32x32 (already fixed by the existing tileset)
- Field of view at zoom 1.0: 20x11.25 tiles (640x360 ÷ 32)
- Object/sprite dimensions always as multiples of 32, otherwise pixel-snapping issues when placing in Tiled
- Player: 64x64 sprite canvas (2x2 tiles) - larger than the tile grid to allow more animation detail; the collision box stays narrower than the full sprite (roughly the previous 32x64 footprint) so hitbox/gameplay feel doesn't change
- Enemy: 32x32 up to 64x64 depending on type (multiples of 32)
- Door: 32x64
- Tilemap size is not limited by the canvas - the map can be arbitrarily large, `Camera.js` scrolls with the player. Width guidelines: Combat level ~30-40 tiles, Exploration level with Secret Rooms ~80-120 tiles
- Height guidelines (field of view is 11.25 tiles tall at zoom 1.0):

| Level Type | Height (tiles) | Reasoning |
|---|---|---|
| Combat | ~15-20 | Little verticality needed |
| Secret/Exploration | ~20-30 | Room for branches to Secret Rooms |
| Special/Gimmick | ~25-35 | Tension moments like "water rising" need height |
| Platform | ~40-60+ | Vertical climbing, relevant once Wall Jump unlocks (Chap 2+) |
| Boss level | ~20-30 | Should roughly match the boss zoom field of view (~26-27 tiles, see 11.7.3), otherwise an empty border shows when the camera zooms out |

Prologue/Chap 1 stay at a max of ~35 tiles height without Wall Jump.

### 11.7.3 Camera Zoom (Boss Fights)

Boss zoom-outs are a camera parameter, not a change to the base resolution. `Camera.js` normally renders tiles at an effective size of 32px (zoom 1.0). `BossState` sets a reduced zoom value on entry (e.g. 0.75 → effectively 24px per tile), which lets more tiles fit into the same 640x360 buffer (~26-27 instead of 20) - more field of view for the boss arena, without touching the base resolution or screen scaling. Zoom resets when leaving `BossState`.

## 11.8 UI Overlay & Text Rendering

UI text (HUD, menus, dialogue) is not drawn with `fillText()` on the canvas - at 640x360 internal resolution scaled up via `image-rendering: pixelated`, font glyph edges would scale up blocky instead of staying crisp. Instead, a `#ui-overlay` div sits absolutely positioned over the canvas (both inside a `position: relative` container), sized to the same 640x360 internal coordinate system and scaled with the same factor as the canvas (`transform: scale(...); transform-origin: top left;`) - so UI elements are positioned in game-space coordinates without per-resolution recalculation, while the text itself renders through the browser's normal font engine (sharp at any scale).

The overlay defaults to `pointer-events: none` so clicks/touches pass through to the canvas underneath, with `pointer-events: auto` set individually on interactive elements (buttons, mobile controls) so they still receive input.
