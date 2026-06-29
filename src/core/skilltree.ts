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

// Open-from-start wings (one per class + a shared party wing).

const marksman: SkillWing = {
  id: "marksman",
  name: "Marksman (Ranger)",
  sigilCost: 0,
  nodes: [
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
    node("mg_dmg", "Spell Power", 26, 10, {
      target: "mage",
      stat: "attack",
      op: "add",
      value: 6,
    }),
    node("mg_ability", "Empowered Nukes", 70, 5, {
      target: "mage",
      stat: "abilityPower",
      op: "mul",
      value: 1.15,
    }),
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
    node("wl_dmg", "Virulence", 24, 10, {
      target: "warlock",
      stat: "attack",
      op: "add",
      value: 4,
    }),
    node("wl_ability", "Deeper Curse", 60, 6, {
      target: "warlock",
      stat: "abilityPower",
      op: "mul",
      value: 1.18,
    }),
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
    node("pt_dmg", "Battle Drills", 45, 10, {
      target: "party",
      stat: "attack",
      op: "mul",
      value: 1.04,
    }),
  ],
};

// Sigil-locked wings (unlocked by defeating bosses).

const bulwark: SkillWing = {
  id: "bulwark",
  name: "Bulwark (Locked)",
  sigilCost: 1,
  nodes: [
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

const NODE_INDEX: Record<string, { node: SkillNode; wing: SkillWing }> = {};
for (const wing of WINGS) {
  for (const n of wing.nodes) NODE_INDEX[n.id] = { node: n, wing };
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
