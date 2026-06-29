import { STARTER_CLASS } from "./characters";
import { FIRST_DUNGEON } from "./dungeons";
import type { SaveState } from "./types";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "idle-party-save";

export function newSave(): SaveState {
  return {
    version: SAVE_VERSION,
    gold: 0,
    sigils: 0,
    roster: [STARTER_CLASS],
    purchased: {},
    unlockedWings: [],
    unlockedDungeons: [FIRST_DUNGEON],
    bossesDefeated: [],
    settings: { autoCastAbilities: true },
  };
}

/** Migrate an arbitrary parsed object up to the current save version. */
export function migrate(raw: unknown): SaveState {
  const base = newSave();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SaveState>;
  return {
    version: SAVE_VERSION,
    gold: typeof r.gold === "number" ? r.gold : base.gold,
    sigils: typeof r.sigils === "number" ? r.sigils : base.sigils,
    roster:
      Array.isArray(r.roster) && r.roster.length > 0 ? r.roster : base.roster,
    purchased:
      r.purchased && typeof r.purchased === "object"
        ? { ...r.purchased }
        : base.purchased,
    unlockedWings: Array.isArray(r.unlockedWings)
      ? [...r.unlockedWings]
      : base.unlockedWings,
    unlockedDungeons:
      Array.isArray(r.unlockedDungeons) && r.unlockedDungeons.length > 0
        ? [...r.unlockedDungeons]
        : base.unlockedDungeons,
    bossesDefeated: Array.isArray(r.bossesDefeated)
      ? [...r.bossesDefeated]
      : base.bossesDefeated,
    settings: {
      autoCastAbilities:
        r.settings?.autoCastAbilities ?? base.settings.autoCastAbilities,
    },
  };
}

export function serialize(save: SaveState): string {
  return JSON.stringify(save);
}

export function deserialize(text: string): SaveState {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return newSave();
  }
}

// --- localStorage helpers (no-op outside the browser) ---------------------

function hasStorage(): boolean {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
}

export function loadSave(): SaveState {
  if (!hasStorage()) return newSave();
  const text = globalThis.localStorage.getItem(SAVE_KEY);
  return text ? deserialize(text) : newSave();
}

export function persistSave(save: SaveState): void {
  if (!hasStorage()) return;
  globalThis.localStorage.setItem(SAVE_KEY, serialize(save));
}
