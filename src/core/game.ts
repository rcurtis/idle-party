import { nextDungeonId } from "./dungeons";
import type { RunState, SaveState } from "./types";

export interface BankResult {
  save: SaveState;
  /** Newly unlocked dungeon id this bank (for UI notification), if any. */
  newDungeon: string | null;
  /** True if this was the first-ever defeat of the dungeon boss. */
  firstBossKill: boolean;
  goldGained: number;
  sigilsGained: number;
}

/**
 * Bank the results of a finished (won or wiped) run into the save state:
 * award gold/sigils, record boss kills, unlock the next dungeon.
 * Idempotent per run via `run.resolved`.
 */
export function bankRun(save: SaveState, run: RunState): BankResult {
  if (run.resolved) {
    return {
      save,
      newDungeon: null,
      firstBossKill: false,
      goldGained: 0,
      sigilsGained: 0,
    };
  }
  run.resolved = true;

  let next: SaveState = {
    ...save,
    gold: save.gold + run.goldEarned,
    sigils: save.sigils + run.sigilsEarned,
  };

  let newDungeon: string | null = null;
  let firstBossKill = false;

  const bossKilled = run.phase === "won" && run.sigilsEarned > 0;
  if (bossKilled) {
    if (!next.bossesDefeated.includes(run.dungeonId)) {
      firstBossKill = true;
      next = {
        ...next,
        bossesDefeated: [...next.bossesDefeated, run.dungeonId],
      };
      const nd = nextDungeonId(run.dungeonId);
      if (nd && !next.unlockedDungeons.includes(nd)) {
        newDungeon = nd;
        next = { ...next, unlockedDungeons: [...next.unlockedDungeons, nd] };
      }
    }
  }

  return {
    save: next,
    newDungeon,
    firstBossKill,
    goldGained: run.goldEarned,
    sigilsGained: run.sigilsEarned,
  };
}
