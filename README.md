[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/rezanimo306-maker/best-stealth-game-20261121-1759-entry/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/rezanimo306-maker/best-stealth-game-20261121-1759-entry/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# Shadow Vault — a top-down stealth game

A top-down 2D stealth heist built for the make.fun bounty
**"Make the best stealth game"** (best-stealth-game-20261121-1759, $50, top 10).
Slip through three guarded floors, collect the shards, and reach the exit
unseen. No build step, no network: open `game/index.html` in a desktop
browser and play.

## The game

You are the infiltrator. Each floor hides **3 shards**; the exit only opens
once all three are collected. Guards patrol fixed routes with **visible
vision cones** — step into a cone and their suspicion meter climbs; fill it
and the **alarm** trips, the guards chase, and you must break line of sight
until it cools down.

- **Cover that works:** crates and walls block both movement and sight.
  Duck behind them and a cone sweeping past will not see you.
- **Shadows hide you:** dark floor patches slow detection to less than half
  speed. Crouch in them and wait for the gap.
- **Sneak:** hold Shift to move slowly and quietly — guards spot you half
  as fast.
- **Coins distract:** click anywhere to throw a coin (3 per floor). Guards
  leave their patrol to investigate the clink.
- **Three floors, three lessons:** the Lobby teaches cover, the Gallery
  teaches timing across long sightlines, the Vault teaches patience under
  overlapping patrols.
- **Ghost run:** finish all three floors without a single alarm for the
  flawless ending.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Sneak (slower, harder to spot) |
| Click | Throw a coin to distract a guard |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / continue |

## Files

| File | Job |
| --- | --- |
| `game/index.html` | The page: canvas, styles, controls |
| `game/src/main.js` | Game loop, state machine, input, alarm, level flow |
| `game/src/levels.js` | The three floors: walls, crates, shadows, shards, exits, patrols |
| `game/src/guards.js` | Patrols, vision cones, detection, chase / investigate / return |
| `game/src/player.js` | Movement, collision, sneaking, coin throws |
| `game/src/render.js` | Canvas drawing: floor, cones, guards, HUD, screens |
| `game/src/audio.js` | Synthesized WebAudio effects (no audio files) |
| `game/src/utils.js` | Shared math: angles, line of sight, ray casting |
| `game/src/shots.js` | Screenshot staging + in-browser self-test (`?scene=`, `?selftest=1`) |
| `vendor/makefun-game.ts` | make.fun's dossier library, copied unchanged from the kit |
| `main.ts` | Entry builder: copies `game/` + `screenshots/` to the output dir and writes `dossier.json` |

## Build

```sh
node main.ts            # writes ./out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` uses the Node 22 standard library only. The output is
deterministic: two runs produce byte-identical trees and `dossier.json`.

## License

MIT — see `LICENSE`.
