"""One-off generator for the GameState physics-test placeholder tileset + level.
Full-cell opaque tiles (no transparent padding) per docs/GDD/10_technical-architecture.md
11.6.1 - real Prologue Level 1 art replaces this once ready.
"""
import json
from PIL import Image, ImageDraw

TILE = 32
WIDTH = 40
HEIGHT = 15

# --- Tileset: 2 tiles side by side (64x32), fully opaque edge to edge ---
tileset = Image.new("RGBA", (TILE * 2, TILE), (0, 0, 0, 255))
d = ImageDraw.Draw(tileset)

# Tile 0 (gid 1): ground-top
d.rectangle([0, 0, TILE - 1, TILE - 1], fill=(70, 140, 60, 255))
d.rectangle([0, 0, TILE - 1, 5], fill=(90, 170, 80, 255))

# Tile 1 (gid 2): ground-fill
d.rectangle([TILE, 0, TILE * 2 - 1, TILE - 1], fill=(75, 60, 45, 255))

tileset.save("assets/images/tilesets/gamestate-placeholder.png")

# --- Level: ground strip + a couple of floating platforms to test jumping ---
background = [0] * (WIDTH * HEIGHT)
terrain = [0] * (WIDTH * HEIGHT)

GROUND_TOP_ROW = 11

for row in range(GROUND_TOP_ROW, HEIGHT):
    gid = 1 if row == GROUND_TOP_ROW else 2
    for col in range(WIDTH):
        terrain[row * WIDTH + col] = gid

# A few floating platforms at varying heights/gaps to test jumping
platforms = [
    (8, 8, 5),   # (start_col, row, length)
    (16, 6, 4),
    (24, 8, 5),
    (32, 5, 6),
]
for start_col, row, length in platforms:
    for col in range(start_col, start_col + length):
        terrain[row * WIDTH + col] = 1

level = {
    "compressionlevel": -1,
    "width": WIDTH,
    "height": HEIGHT,
    "tilewidth": TILE,
    "tileheight": TILE,
    "orientation": "orthogonal",
    "renderorder": "right-down",
    "type": "map",
    "version": "1.10",
    "tiledversion": "1.10.2",
    "infinite": False,
    "nextlayerid": 3,
    "nextobjectid": 1,
    "layers": [
        {
            "id": 1,
            "name": "Background",
            "type": "tilelayer",
            "x": 0, "y": 0,
            "width": WIDTH, "height": HEIGHT,
            "opacity": 1, "visible": True,
            "data": background,
        },
        {
            "id": 2,
            "name": "Terrain/Collision",
            "type": "tilelayer",
            "x": 0, "y": 0,
            "width": WIDTH, "height": HEIGHT,
            "opacity": 1, "visible": True,
            "data": terrain,
        },
    ],
    "tilesets": [
        {
            "firstgid": 1,
            "source": "../images/tilesets/gamestate-placeholder.png",
        }
    ],
}

with open("assets/levels/gamestate-test.json", "w") as f:
    json.dump(level, f, indent=2)

print("done")
