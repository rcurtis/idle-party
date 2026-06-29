# Idle Party — Design Spec

Date: 2026-06-26

## Summary

An idle/incremental pixel-art dungeon crawler. The player assembles and upgrades
a traditional MMO party (1 Tank, 1 Healer, 3 ranged DPS), sends them on automated
dungeon runs to kill enemies and collect gold, and spends that gold in a tavern
skill tree to push deeper. Runs end when the party wipes. Each dungeon has several
levels ending in a boss; the boss drops a special resource (Sigil) that unlocks
locked skill-tree wings and the next, harder dungeon.

Runs in the browser (HTML5 Canvas + TypeScript), packageable for desktop via Tauri.

## Goals

- Satisfying core loop: run → wipe → spend → run deeper.
- Party assembly is itself progression: start with one character, recruit the rest.
- Idle auto-combat with optional active abilities.
- Crisp pixel-art aesthetic from hand-authored sprite sheets.
- Single web codebase that also runs on desktop.

## Non-goals (first slice)

- Multiplayer, accounts, cloud save.
- More than 2 dungeons of content.
- Sound (stub hook only; can add later).
- Tauri packaging itself (architecture stays compatible; not built in slice 1).

## Tech / Architecture

- **Language/build:** TypeScript, Vite (dev server + production build).
- **Rendering:** HTML5 Canvas 2D, nearest-neighbor scaling for pixel crispness.
- **Persistence:** `localStorage` (JSON save blob), portable to Tauri FS later.

Module boundaries (each independently testable):

- `src/core/` — pure game logic, **no DOM**:
  - `types.ts` — shared data types (CharacterClass, Stats, RunState, SaveState…).
  - `characters.ts` — class definitions, base stats, recruit costs.
  - `combat.ts` — deterministic combat/run simulation stepped by ticks.
  - `economy.ts` — gold/Sigil costs, upgrade application.
  - `skilltree.ts` — tree definition, node unlock/purchase rules, wing gating.
  - `dungeons.ts` — dungeon/level/enemy/boss definitions and scaling.
  - `game.ts` — top-level GameState orchestration + reducer-style actions.
  - `save.ts` — serialize/deserialize/migrate save state.
- `src/render/` — Canvas renderer + sprite-sheet loader (depends on core types).
- `src/ui/` — screens (Tavern, SkillTree, Dungeon HUD), input handling.
- `src/assets/` — PNG sprite sheets (authored as part of the build).
- `src/main.ts` — bootstrap, game loop (requestAnimationFrame), wiring.

The game loop advances `core` by fixed timesteps; `render`/`ui` only read state
and dispatch actions. Core never imports from render/ui.

## Game Model

### Characters

Five classes; the player starts with the Ranger only and recruits the rest with gold.

| Class   | Role  | Niche                                  |
|---------|-------|----------------------------------------|
| Knight  | Tank  | High HP, generates threat, taunt-shield ability |
| Cleric  | Healer| Heals lowest-HP ally; big-heal ability |
| Ranger  | DPS   | Sustained single-target (starter)      |
| Mage    | DPS   | Burst nuke ability, AoE leanings       |
| Warlock | DPS   | Damage-over-time stacks                 |

Each character has stats: `maxHp`, `hp`, `attack`, `attackInterval`, plus role
stats (`threat` for tank, `healPower` for healer, `abilityPower`, ability cooldown).

### Combat / Run simulation (`combat.ts`)

- Deterministic, tick-based (e.g. 10 ticks/sec sim). Given the same seed + state,
  produces the same outcome — enables unit testing.
- Party advances through a level; enemies spawn in packs.
- Targeting: enemies attack the highest-threat alive party member (the Tank while
  alive, taunt boosts it); DPS focus the lowest-HP enemy; Cleric heals lowest-HP ally.
- Damage = attacker.attack scaled by simple armor/level mitigation. DoT for Warlock.
- Gold awarded per enemy killed; bonus on level clear and boss kill.
- Active abilities: each character has one ability on cooldown. Auto-cast by default
  with sensible triggers; the player may tap to cast early during a run.
- Run ends when all party members are dead → return to Tavern with accumulated gold
  (+ Sigil if a boss was killed this run).

### Dungeons (`dungeons.ts`)

- A dungeon = ordered list of **levels**; final level = **boss**.
- Slice content: **Dungeon 1 (Catacombs)** ~5 levels + boss; **Dungeon 2 (Crypt)**
  unlocked after D1 boss, higher enemy scaling and gold.
- Enemy stats scale per level and per dungeon. Boss is a single high-HP, high-damage
  encounter that drops 1 Sigil on first kill (and gold each kill).
- The player picks which unlocked dungeon to run; a run starts at level 1 of it.
  (Deepest-reached tracking can inform scaling/UX but each run starts fresh — classic
  idle restart.)

### Economy & Skill Tree (`economy.ts`, `skilltree.ts`)

- **Gold**: earned in runs, spent on recruiting characters and on skill-tree nodes.
- **Sigils**: dropped by bosses, spend/consume to **unlock locked wings**.
- Skill tree wings:
  - Per-character wings (offense/defense/utility for each class).
  - Shared wings (party HP, gold find, ability haste).
  - Some wings **locked** until a Sigil is spent to open them.
- Nodes have escalating gold cost and provide stat multipliers/flat bonuses applied
  to characters at run start. Purchases persist across runs.
- Recruiting: each non-starter class has a one-time gold cost; recruited characters
  join the party and become upgradeable.

### Save (`save.ts`)

- Single JSON blob in `localStorage` under a versioned key.
- Stores: gold, sigils, recruited classes, purchased node ids, unlocked wings,
  unlocked dungeons, deepest progress, settings.
- Versioned with a migration hook for forward compatibility.

## UI / Screens (`ui/`)

- **Tavern (home):** shows party roster, gold, sigils; buttons to Recruit, open
  Skill Tree, and Enter Dungeon (choose unlocked dungeon).
- **Skill Tree:** scrollable wings; nodes show cost/effect; locked wings show Sigil
  gate. Buy with gold; unlock wings with Sigils.
- **Dungeon (run) view:** pixel scene of party vs enemies advancing; HUD with each
  character's HP bars + ability cooldown buttons; gold/level counters; live log.
  On wipe → results summary → back to Tavern.

## Pixel Art (`assets/`)

- Hand-authored PNG sprite sheets, ~32×32 per frame, dark-fantasy tavern/dungeon palette.
- Sheets: party classes (idle + attack frames), enemy types per dungeon, boss,
  gold/coin pickup, dungeon floor/wall tiles, UI frame elements.
- Loaded once at boot; drawn with image-smoothing disabled.

## Testing Strategy

- TDD on all of `src/core/` (Vitest): combat determinism, gold math, upgrade
  application, recruit gating, wing unlock rules, boss → Sigil drop, dungeon unlock,
  save round-trip + migration.
- Render/UI verified manually in-browser (and via screenshot once running).

## Milestone (this slice = full vertical slice)

Start with Ranger → earn gold → recruit Knight/Cleric/Mage/Warlock → buy upgrades →
clear Dungeon 1 levels → beat D1 boss → receive Sigil → unlock a locked wing →
unlock & enter Dungeon 2. Playable in browser via `npm run dev`.
