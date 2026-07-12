# 10. Audio & Visual

| Element | Details |
|---|---|
| Art style | Pixel art (preferred) |
| Art direction | Medieval Fantasy as the base tone (villages, forests, castles, caves) with a Sci-Fi undercurrent - ancient Guardian ruins/technology as a visual contrast moment in Secret Rooms |
| Art assets | Free assets / AI-generated / hand-painted - open |
| Music | Suno AI or free assets |
| Sound FX | Free assets |
| Priority | Gameplay first, then assets |

## 10.1 Typography

| Use | Font |
|---|---|
| Game title, HUD numbers (Health/Prisma/Tokens), menu buttons, settings labels | **Jersey 10** - clean pixel font, stays legible at small sizes within the 640x360 internal resolution |
| Story/dialogue text, cutscene text (if used) | **Jacquard 24** - decorative Medieval-Fantasy display font, reserved for slower-read, larger text where its ornate style doesn't hurt legibility |

Both fonts are self-hosted (`assets/fonts/`, loaded via `@font-face`), not pulled from a CDN, so the game works fully offline. Rendered through the HTML/CSS UI overlay (see [10_technical-architecture.md](10_technical-architecture.md) 11.8), not `fillText()` on the canvas - canvas text scaled up via `image-rendering: pixelated` would turn font edges blocky instead of staying crisp.
