import { getClass } from "./characters";
import { getNode, getWing, getWingForNode } from "./skilltree";
import type { ClassId, SaveState } from "./types";

export type EconResult =
  | { ok: true; save: SaveState }
  | { ok: false; reason: string };

/** UI-facing state for a graph node (recruit anchor, wing gate, or stat node). */
export interface NodeStatus {
  kind: "recruit" | "gate" | "stat";
  ranks: number;
  maxRanks: number;
  /** ranks > 0 (stat), recruited (recruit), or wing-unlocked (gate). */
  owned: boolean;
  maxed: boolean;
  cost: number;
  costKind: "gold" | "sigil";
  /** Unlockable right now ignoring affordability (prereqs/recruit/wing met). */
  available: boolean;
  /** Available AND affordable AND not maxed. */
  canBuy: boolean;
}

/** Resolve the current state of any graph node for rendering + interaction. */
export function nodeStatus(save: SaveState, nodeId: string): NodeStatus {
  const node = getNode(nodeId);

  if (node.recruit) {
    const owned = save.roster.includes(node.recruit);
    const cost = getClass(node.recruit).recruitCost;
    // Sequential gating: the previous class on the spine must be recruited.
    const predOk = (node.links ?? [])
      .map((id) => getNode(id))
      .filter((p) => p.recruit)
      .every((p) => getClass(p.recruit!).starter || save.roster.includes(p.recruit!));
    const available = !owned && !getClass(node.recruit).starter && predOk;
    return {
      kind: "recruit",
      ranks: owned ? 1 : 0,
      maxRanks: 1,
      owned,
      maxed: owned,
      cost,
      costKind: "gold",
      available,
      canBuy: available && save.gold >= cost,
    };
  }

  if (node.unlockWing) {
    const wing = getWing(node.unlockWing);
    const owned = wing.sigilCost === 0 || save.unlockedWings.includes(wing.id);
    return {
      kind: "gate",
      ranks: owned ? 1 : 0,
      maxRanks: 1,
      owned,
      maxed: owned,
      cost: wing.sigilCost,
      costKind: "sigil",
      available: !owned,
      canBuy: !owned && save.sigils >= wing.sigilCost,
    };
  }

  const ranks = save.purchased[nodeId] ?? 0;
  const maxed = ranks >= node.maxRanks;
  const cost = nodeCost(save, nodeId);
  const available = canPurchase(save, nodeId);
  return {
    kind: "stat",
    ranks,
    maxRanks: node.maxRanks,
    owned: ranks > 0,
    maxed,
    cost,
    costKind: "gold",
    available,
    canBuy: available && !maxed && save.gold >= cost,
  };
}

/** Unified click action for a graph node: recruit, unlock wing, or buy a rank. */
export function buyNode(save: SaveState, nodeId: string): EconResult {
  const node = getNode(nodeId);
  // Gate everything on the node being reachable (parent unlocked / prereqs met).
  if (!nodeStatus(save, nodeId).available) {
    return { ok: false, reason: "Locked." };
  }
  if (node.recruit) return recruit(save, node.recruit);
  if (node.unlockWing) return unlockWing(save, node.unlockWing);
  return purchaseNode(save, nodeId);
}

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
  const reqClass =
    node.effect && node.effect.target !== "party"
      ? node.effect.target
      : node.unlock?.target;
  if (reqClass && !save.roster.includes(reqClass)) return false;
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
