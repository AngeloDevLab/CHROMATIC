# 9. Menu Flow

## 9.1 State Overview

| State | Content |
|---|---|
| LandscapeGate | Mandatory - blocks play with a rotate-device prompt on portrait orientation on Mobile. Implemented as an always-on overlay rather than a flow step below - it can appear over any screen, not just at one particular point |
| LoadingState | Loading assets |
| MenuState | Continue (always visible, disabled/greyed out until a save exists) / New Game / Settings / Info. Background is a living demo scene rather than a static image - a small non-interactive slice of the real game (tileset, background art, an autopilot-controlled Guardian sprite) that repeats a two-step cycle: the Guardian walks across leaving a real, permanent color trail (same mode as actual gameplay), then a patrolling enemy crosses from a random side and darkens it all back, then it repeats. Shows the core color mechanic (and a preview of the enemy-darkens-color rule) before the game even starts. |
| CutsceneState | Intro and inter-chapter cutscenes (skippable) |
| GameState | Main game state |
| WorldmapState | Chapter/level selection, see 9.2 |
| PauseState | Resume / Settings / Main Menu |
| BossState | Miniboss, Templateboss, and Chapterboss fights alike - not Chapterboss-only |
| BuffState | Secret Room buff choice (pick one of the three permanent stat buffs, see [02-game-structure.md](02-game-structure.md) 2.5) - not Merchant ability purchases, which happen inline within GameState through the Merchant's own dialogue instead of a dedicated state |
| GameOverState | Death - restarts the level from the beginning (no checkpoint, see [04-health-save-system.md](04-health-save-system.md) 5.1) |

## 9.2 Flow

LoadingState → MenuState → "New Game" → Difficulty selection (Easy/Normal/Hard, see [04-health-save-system.md](04-health-save-system.md) 5.3) → CutsceneState (Intro: Guardian materializes on the beach in a color explosion) → WorldmapState.

Difficulty selection is an overlay panel (reusing the same panel component as Settings/Info) with a short one-line description per option, so the player knows what they're picking before committing - not just bare labels.

On the Worldmap: chapter bar at the top of the screen with 6 buttons - Prologue, Chap 1, Chap 2, Chap 3, Chap 4, Epilogue (see [02-game-structure.md](02-game-structure.md) 2.1). At the start of the game only "Prologue" is active - the rest are simply disabled/greyed out (a "Coming Soon" hint only shows on hover), and stay that way regardless of Prologue completion for now, since v1 was cut to Prologue-only (see [11-scope-milestones.md](11-scope-milestones.md) 12.1). The "unlocks once the previous chapter is completed" rule only takes effect once Chap 1+ actually exists.

After completing the Prologue: still needs a closing cutscene (not built yet, see [11-scope-milestones.md](11-scope-milestones.md) 12.4) that narratively teases/introduces Chap 1 as a hook for what's coming - even though the Worldmap's Chap 1 button itself stays disabled either way until that content actually exists.

## 9.3 Menu Items

- **Continue** - always visible, disabled/greyed out until a save exists, listed above New Game
- **New Game** - new game incl. difficulty selection
- **Settings** - Audio, Controls, Language (currently English only, see [10-technical-architecture.md](10-technical-architecture.md))
- **Info** - single button/panel covering Credits, Legal Notice, and Privacy Policy as separate sections
