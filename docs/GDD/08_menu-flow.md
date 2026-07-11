# 9. Menu Flow

## 9.1 State Overview

| State | Content |
|---|---|
| LandscapeCheck | Mandatory - prompt on portrait orientation on Mobile |
| LoadingState | Loading assets |
| MenuState | New Game / Continue (only if a save exists) / Settings / Credits / Imprint / Privacy |
| CutsceneState | Intro and inter-chapter cutscenes (skippable) |
| GameState | Main game state |
| WorldmapState | Chapter/level selection, see 9.2 |
| PauseState | Resume / Settings / Main Menu |
| BossState | Dedicated Chapterboss fight state |
| BuffState | Ability purchase at the Merchant (2 Tokens per ability) |
| GameOverState | Death - return to checkpoint |

## 9.2 Flow

LoadingState → MenuState → "New Game" → Difficulty selection (Easy/Normal/Hard, see [04_health-save-system.md](04_health-save-system.md) 5.3) → CutsceneState (Intro: Guardian materializes on the beach in a color explosion) → WorldmapState.

On the Worldmap: chapter bar at the top of the screen with 6 buttons - Prologue, Chap 1, Chap 2, Chap 3, Chap 4, Epilogue (see [02_game-structure.md](02_game-structure.md) 2.1). At the start of the game only "Prologue" is active, the others show "Coming Soon" until the respective previous chapter is completed.

After completing the Prologue: automatic save point (`prologComplete: true`), short CutsceneState, then "Chap 1" unlocks on the chapter bar.

## 9.3 Menu Items

- **New Game** - new game incl. difficulty selection, only visible if no save exists or alongside Continue
- **Continue** - only if a save exists
- **Settings** - Audio, Controls, Language (currently English only, see [10_technical-architecture.md](10_technical-architecture.md))
- **Credits**
- **Imprint**
- **Privacy**
