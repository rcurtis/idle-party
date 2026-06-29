import { getClass } from "./characters";
import { getNode, getWing, getWingForNode } from "./skilltree";
import type { ClassId, SaveState } from "./types";

export type EconResult =
  | { ok: true; save: SaveState }
  | { ok: false; reason: string };

/** Recruit a class into the roster for its gold cost. */
export function recruit(save: SaveState, classId: ClassId): EconResult {
  if (save.roster.includes(classId)) {
    return { ok: false, reason: "Already recruited." };
  }
  const def = getClass(classId);
  if (def.starter) {
    return { ok: false, reason: "Starter is already in the party." };
  }
  if (save.gold < def.recruitCost) {
    return { ok: false, reason: "Not enough gold." };
  }
  return {
    ok: true,
    save: {
      ...save,
      gold: save.gold - def.recruitCost,
      roster: [...save.roster, classId],
    },
  };
}

/** Cost of the next rank of a node (escalates 35% per rank, rounded). */
export function nodeCost(save: SaveState, nodeId: string): number {
  const node = getNode(nodeId);
  const ranks = save.purchased[nodeId] ?? 0;
  return Math.round(node.cost * Math.pow(1.35, ranks));
}

function wingUnlocked(save: SaveState, wingId: string): boolean {
  const wing = getWing(wingId);
  return wing.sigilCost === 0 || save.unlockedWings.includes(wingId);
}

function requirementsMet(save: SaveState, nodeId: string): boolean {
  const node = getNode(nodeId);
  return node.requires.every((r) => (save.purchased[r] ?? 0) > 0);
}

/** Whether a node can currently be purchased (ignoring gold). */
export function canPurchase(save: SaveState, nodeId: string): boolean {
  const node = getNode(nodeId);
  const ranks = save.purchased[nodeId] ?? 0;
  if (ranks >= node.maxRanks) return false;
  if (!wingUnlocked(save, getWingForNode(nodeId).id)) return false;
  // The targeted class must be recruited (party-target nodes always allowed).
  if (node.effect.target !== "party" && !save.roster.includes(node.effect.target)) {
    return false;
  }
  return requirementsMet(save, nodeId);
}

/** Purchase one rank of a skill node. */
export function purchaseNode(save: SaveState, nodeId: string): EconResult {
  if (!canPurchase(save, nodeId)) {
    return { ok: false, reason: "Node not available." };
  }
  const cost = nodeCost(save, nodeId);
  if (save.gold < cost) {
    return { ok: false, reason: "Not enough gold." };
  }
  return {
    ok: true,
    save: {
      ...save,
      gold: save.gold - cost,
      purchased: {
        ...save.purchased,
        [nodeId]: (save.purchased[nodeId] ?? 0) + 1,
      },
    },
  };
}

/** Spend sigils to unlock a locked wing. */
export function unlockWing(save: SaveState, wingId: string): EconResult {
  const wing = getWing(wingId);
  if (wing.sigilCost === 0 || save.unlockedWings.includes(wingId)) {
    return { ok: false, reason: "Wing already open." };
  }
  if (save.sigils < wing.sigilCost) {
    return { ok: false, reason: "Not enough sigils." };
  }
  return {
    ok: true,
    save: {
      ...save,
      sigils: save.sigils - wing.sigilCost,
      unlockedWings: [...save.unlockedWings, wingId],
    },
  };
}
