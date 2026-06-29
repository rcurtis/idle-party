import type { ClassId, NodeEffect, SkillNode, SkillWing } from "./types";

function node(
  id: string,
  name: string,
  cost: number,
  maxRanks: number,
  effect: NodeEffect,
  requires: string[] = [],
): SkillNode {
  return { id, name, cost, maxRanks, effect, requires };
}

/** A one-time node that unlocks a character ability rather than boosting a stat. */
function unlockNode(
  id: string,
  name: string,
  cost: number,
  unlock: { target: ClassId; desc: string },
  requires: string[] = [],
): SkillNode {
  return { id, name, cost, maxRanks: 1, unlock, requires };
}

/** Wing-entry node: clicking it recruits the class (cost is the class recruitCost). */
function recruitAnchor(id: string, recruit: ClassId, name: string): SkillNode {
  return { id, name, cost: 0, maxRanks: 1, recruit, requires: [] };
}

/** Gate node: clicking spends sigils to unlock a locked wing. */
function gate(id: string, unlockWing: string, name: string): SkillNode {
  return { id, name, cost: 0, maxRanks: 1, unlockWing, requires: [] };
}

// Open-from-start wings (one per class + a shared party wing).

const marksman: SkillWing = {
  id: "marksman",
  name: "Marksman (Ranger)",
  sigilCost: 0,
  nodes: [
    recruitAnchor("rec_ranger", "ranger", "Ranger"),
    node("rg_dmg", "Sharpened Tips", 18, 8, {
      target: "ranger",
      stat: "attack",
      op: "add",
      value: 4,
    }),
    node("rg_speed", "Quick Draw", 45, 5, {
      target: "ranger",
      stat: "attackInterval",
      op: "mul",
      value: 0.92,
    }),
    node(
      "rg_hp",
      "Survival Training",
      30,
      6,
      { target: "ranger", stat: "maxHp", op: "add", value: 20 },
      ["rg_dmg"],
    ),
  ],
};

const vanguard: SkillWing = {
  id: "vanguard",
  name: "Vanguard (Knight)",
  sigilCost: 0,
  nodes: [
    recruitAnchor("rec_knight", "knight", "Knight"),
    node("kn_hp", "Thick Hide", 12, 10, {
      target: "knight",
      stat: "maxHp",
      op: "add",
      value: 45,
    }),
    node("kn_armor", "Plate Mastery", 22, 6, {
      target: "knight",
      stat: "armor",
      op: "add",
      value: 0.04,
    }),
    unlockNode(
      "kn_ironwall",
      "Iron Wall",
      40,
      {
        target: "knight",
        desc: "Unlocks Iron Wall: the Knight gains a damage-absorbing shield on cooldown.",
      },
      ["kn_hp"],
    ),
    node(
      "kn_threat",
      "Provoke",
      28,
      4,
      { target: "knight", stat: "threat", op: "mul", value: 1.2 },
      ["kn_hp"],
    ),
  ],
};

const devotion: SkillWing = {
  id: "devotion",
  name: "Devotion (Cleric)",
  sigilCost: 0,
  nodes: [
    recruitAnchor("rec_cleric", "cleric", "Cleric"),
    node("cl_heal", "Greater Mending", 28, 8, {
      target: "cleric",
      stat: "healPower",
      op: "add",
      value: 6,
    }),
    node("cl_speed", "Swift Prayer", 50, 5, {
      target: "cleric",
      stat: "attackInterval",
      op: "mul",
      value: 0.93,
    }),
    node(
      "cl_hp",
      "Blessed Vigor",
      32,
      6,
      { target: "cleric", stat: "maxHp", op: "add", value: 25 },
      ["cl_heal"],
    ),
  ],
};

const arcane: SkillWing = {
  id: "arcane",
  name: "Arcane (Mage)",
  sigilCost: 0,
  nodes: [
    recruitAnchor("rec_mage", "mage", "Mage"),
    node("mg_dmg", "Spell Power", 26, 10, {
      target: "mage",
      stat: "attack",
      op: "add",
      value: 6,
    }),
    node(
      "mg_ability",
      "Empowered Nukes",
      70,
      5,
      { target: "mage", stat: "abilityPower", op: "mul", value: 1.15 },
      ["mg_dmg"],
    ),
    node(
      "mg_cd",
      "Mental Clarity",
      80,
      4,
      { target: "mage", stat: "abilityCooldown", op: "mul", value: 0.9 },
      ["mg_ability"],
    ),
  ],
};

const affliction: SkillWing = {
  id: "affliction",
  name: "Affliction (Warlock)",
  sigilCost: 0,
  nodes: [
    recruitAnchor("rec_warlock", "warlock", "Warlock"),
    node("wl_dmg", "Virulence", 24, 10, {
      target: "warlock",
      stat: "attack",
      op: "add",
      value: 4,
    }),
    node(
      "wl_ability",
      "Deeper Curse",
      60,
      6,
      { target: "warlock", stat: "abilityPower", op: "mul", value: 1.18 },
      ["wl_dmg"],
    ),
    node(
      "wl_cd",
      "Rapid Hexes",
      80,
      4,
      { target: "warlock", stat: "abilityCooldown", op: "mul", value: 0.9 },
      ["wl_ability"],
    ),
  ],
};

const warband: SkillWing = {
  id: "warband",
  name: "Warband (Party)",
  sigilCost: 0,
  nodes: [
    node("pt_hp", "Hearty Stock", 35, 10, {
      target: "party",
      stat: "maxHp",
      op: "mul",
      value: 1.05,
    }),
    node(
      "pt_dmg",
      "Battle Drills",
      45,
      10,
      { target: "party", stat: "attack", op: "mul", value: 1.04 },
      ["pt_hp"],
    ),
  ],
};

// Sigil-locked wings (unlocked by defeating bosses).

const bulwark: SkillWing = {
  id: "bulwark",
  name: "Bulwark (Locked)",
  sigilCost: 1,
  nodes: [
    gate("gate_bulwark", "bulwark", "Bulwark"),
    node("bw_armor", "Aegis", 150, 5, {
      target: "party",
      stat: "armor",
      op: "add",
      value: 0.03,
    }),
    node("bw_knhp", "Living Fortress", 200, 6, {
      target: "knight",
      stat: "maxHp",
      op: "add",
      value: 120,
    }),
    node(
      "bw_heal",
      "Divine Font",
      220,
      6,
      { target: "cleric", stat: "healPower", op: "add", value: 14 },
      ["bw_knhp"],
    ),
  ],
};

const ascendant: SkillWing = {
  id: "ascendant",
  name: "Ascendant (Locked)",
  sigilCost: 1,
  nodes: [
    gate("gate_ascendant", "ascendant", "Ascendant"),
    node("as_dmg", "Killing Edge", 180, 8, {
      target: "party",
      stat: "attack",
      op: "mul",
      value: 1.06,
    }),
    node("as_ap", "Overcharge", 240, 6, {
      target: "party",
      stat: "abilityPower",
      op: "mul",
      value: 1.1,
    }),
  ],
};

export const WINGS: SkillWing[] = [
  marksman,
  vanguard,
  devotion,
  arcane,
  affliction,
  warband,
  bulwark,
  ascendant,
];

/** Virtual coordinate space the hub graph is authored in. */
export const GRAPH_W = 1040;
export const GRAPH_H = 600;

/**
 * Hand-authored node positions (centers) and visual wires. The Knight anchor
 * sits top-left; class wings stack down a left spine and fan out to the right;
 * locked wings hang off the party cluster on the right.
 */
const LAYOUT: Record<string, { x: number; y: number; links?: string[] }> = {
  // Knight (starter)
  rec_knight: { x: 90, y: 70 },
  kn_hp: { x: 235, y: 48, links: ["rec_knight"] },
  kn_armor: { x: 235, y: 112, links: ["rec_knight"] },
  kn_ironwall: { x: 380, y: 48, links: ["kn_hp"] },
  kn_threat: { x: 380, y: 112, links: ["kn_hp"] },
  // Ranger
  rec_ranger: { x: 90, y: 185, links: ["rec_knight"] },
  rg_dmg: { x: 235, y: 178, links: ["rec_ranger"] },
  rg_speed: { x: 235, y: 240, links: ["rec_ranger"] },
  rg_hp: { x: 380, y: 178, links: ["rg_dmg"] },
  // Cleric
  rec_cleric: { x: 90, y: 300, links: ["rec_ranger"] },
  cl_heal: { x: 235, y: 300, links: ["rec_cleric"] },
  cl_speed: { x: 235, y: 362, links: ["rec_cleric"] },
  cl_hp: { x: 380, y: 300, links: ["cl_heal"] },
  // Mage
  rec_mage: { x: 90, y: 415, links: ["rec_cleric"] },
  mg_dmg: { x: 235, y: 425, links: ["rec_mage"] },
  mg_ability: { x: 380, y: 425, links: ["mg_dmg"] },
  mg_cd: { x: 520, y: 425, links: ["mg_ability"] },
  // Warlock
  rec_warlock: { x: 90, y: 528, links: ["rec_mage"] },
  wl_dmg: { x: 235, y: 528, links: ["rec_warlock"] },
  wl_ability: { x: 380, y: 528, links: ["wl_dmg"] },
  wl_cd: { x: 520, y: 528, links: ["wl_ability"] },
  // Warband (party) — central cluster
  pt_hp: { x: 560, y: 120, links: ["kn_ironwall"] },
  pt_dmg: { x: 560, y: 184, links: ["pt_hp"] },
  // Bulwark (locked)
  gate_bulwark: { x: 700, y: 270, links: ["pt_dmg"] },
  bw_armor: { x: 840, y: 235, links: ["gate_bulwark"] },
  bw_knhp: { x: 840, y: 300, links: ["gate_bulwark"] },
  bw_heal: { x: 975, y: 300, links: ["bw_knhp"] },
  // Ascendant (locked)
  gate_ascendant: { x: 700, y: 430, links: ["gate_bulwark"] },
  as_dmg: { x: 840, y: 410, links: ["gate_ascendant"] },
  as_ap: { x: 840, y: 475, links: ["gate_ascendant"] },
};

for (const wing of WINGS) {
  for (const n of wing.nodes) {
    const l = LAYOUT[n.id];
    if (l) {
      n.pos = { x: l.x, y: l.y };
      n.links = l.links ?? [];
    }
  }
}

const NODE_INDEX: Record<string, { node: SkillNode; wing: SkillWing }> = {};
for (const wing of WINGS) {
  for (const n of wing.nodes) NODE_INDEX[n.id] = { node: n, wing };
}

/** All nodes across all wings, flat (for graph rendering). */
export function allNodes(): { node: SkillNode; wing: SkillWing }[] {
  return WINGS.flatMap((wing) => wing.nodes.map((node) => ({ node, wing })));
}

export function getNode(id: string): SkillNode {
  const entry = NODE_INDEX[id];
  if (!entry) throw new Error(`Unknown skill node: ${id}`);
  return entry.node;
}

export function getWingForNode(id: string): SkillWing {
  const entry = NODE_INDEX[id];
  if (!entry) throw new Error(`Unknown skill node: ${id}`);
  return entry.wing;
}

export function getWing(id: string): SkillWing {
  const w = WINGS.find((w) => w.id === id);
  if (!w) throw new Error(`Unknown wing: ${id}`);
  return w;
}
