import { getClass } from "./characters";
import { WINGS } from "./skilltree";
import type { ClassId, SaveState, Stats, StatKey } from "./types";

const STAT_KEYS: StatKey[] = [
  "maxHp",
  "attack",
  "attackInterval",
  "armor",
  "threat",
  "healPower",
  "abilityPower",
  "abilityCooldown",
];

/**
 * Resolve a character's final stats by applying every purchased skill-node
 * effect that targets this class (or the whole party). Additive bonuses are
 * applied first, then multiplicative, per stat — so ordering is deterministic.
 */
export function resolveStats(classId: ClassId, save: SaveState): Stats {
  const base = { ...getClass(classId).base };
  const adds: Record<string, number> = {};
  const muls: Record<string, number> = {};
  for (const k of STAT_KEYS) {
    adds[k] = 0;
    muls[k] = 1;
  }

  for (const wing of WINGS) {
    for (const n of wing.nodes) {
      const ranks = save.purchased[n.id] ?? 0;
      if (ranks <= 0) continue;
      const eff = n.effect;
      if (!eff) continue; // unlock-style node, no stat effect
      if (eff.target !== "party" && eff.target !== classId) continue;
      if (eff.op === "add") {
        adds[eff.stat] += eff.value * ranks;
      } else {
        muls[eff.stat] *= Math.pow(eff.value, ranks);
      }
    }
  }

  const out = { ...base } as Stats;
  for (const k of STAT_KEYS) {
    out[k] = (base[k] + adds[k]) * muls[k];
  }
  // Clamp sane bounds.
  out.armor = Math.min(0.8, Math.max(0, out.armor));
  out.attackInterval = Math.max(0.25, out.attackInterval);
  out.abilityCooldown = Math.max(1, out.abilityCooldown);
  out.maxHp = Math.round(out.maxHp);
  return out;
}
