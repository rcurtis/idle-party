# ⚔ Idle Party

A pixel-art **idle / incremental dungeon crawler**. Assemble a classic MMO
party — Tank, Healer, and three ranged DPS — send them on automated dungeon
runs to slay enemies and collect gold, then spend that gold in the tavern skill
tree to push deeper. Beat a dungeon's boss to earn a **Sigil** that unlocks
locked skill-tree wings and the next, harder dungeon.

Runs in any browser and is structured to package as a desktop app via Tauri.

## The loop

1. **Tavern** — recruit party members and buy skill-tree upgrades with gold.
2. **Dungeon run** — your party auto-advances and auto-fights. Tap a character's
   ability for an optional manual cast (or leave auto-cast on). Pick the speed
   (1× / 2× / 4×).
3. **Wipe or win** — gold (and any boss Sigils) are banked. Beating the final
   boss unlocks the next dungeon.
4. **Spend & repeat** — push the skill tree, unlock Sigil-gated wings, go deeper.

You start with only the **Ranger**. The Knight, Cleric, Mage, and Warlock must
be recruited with gold — building the party *is* part of the progression.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # run the core-logic unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run gen:art    # regenerate the pixel-art sprite sheet (src/assets/sprites.png)
```

## Project layout

```
src/
  core/      Pure game logic, no DOM — fully unit-tested
    types.ts        Shared data types
    characters.ts   Class definitions & base stats
    dungeons.ts     Dungeon / level / enemy / boss data
    skilltree.ts    Skill-tree wings & nodes (incl. Sigil-locked wings)
    stats.ts        Resolves final stats from purchased nodes
    economy.ts      Recruit / purchase / unlock rules
    combat.ts       Deterministic, tick-based run simulation
    game.ts         Banks run results into the save
    save.ts         localStorage save + versioned migration
  render/    Canvas sprite-sheet renderer + dungeon scene
  ui/        Tavern, Skill Tree, and Dungeon screens (no framework)
  assets/    Generated pixel-art sprite sheet + manifest
scripts/
  gen-art.mjs       Authors the sprite sheet as a PNG
docs/superpowers/specs/   Design spec
```

The `core/` layer never imports from `render/` or `ui/`, so all the game rules
are deterministic and testable in isolation (`npm test`).

## Inspecting / debugging the running game

The game is built so its state and visuals can be inspected programmatically —
no manual play-through or screenshots required.

In dev (`npm run dev`), the browser exposes:

- `window.__game` — the live `App` instance (save, current run, etc.).
- `app.debugAdvance(seconds)` — step the simulation forward even when the
  `requestAnimationFrame` loop is paused (e.g. a hidden/background tab).
- `window.__shoot(name)` — capture the current dungeon canvas to
  `.inspect/<name>.png` (served by a dev-only Vite middleware in
  `vite.config.ts`). Open that PNG to see exactly what's on screen.

Example (run in the browser console or via an automated eval):

```js
const g = window.__game;
g.save.roster = ['ranger','knight','cleric','mage','warlock'];
g.startDungeon('catacombs');
for (let i = 0; i < 50 && g.run.phase === 'fighting'; i++) g.debugAdvance(0.5);
await window.__shoot('my_frame');   // -> .inspect/my_frame.png
```

Game *rules* are covered headlessly by the Vitest suite, so most behavior can be
verified with `npm test` alone.

## Packaging for desktop (Tauri)

The web build is desktop-ready: relative asset paths, no server dependencies,
and saves use `localStorage`. To wrap it:

```bash
npm create tauri-app@latest   # point frontendDist at ./dist, devUrl at the Vite dev server
npm run build && npm run tauri build
```

## Tuning the game

Balance lives entirely in data files — edit `dungeons.ts` (enemy/boss stats,
gold), `characters.ts` (class power, recruit costs), and `skilltree.ts`
(upgrade values, costs, Sigil gates). The unit tests guard the core mechanics
while you tune.
