import type { ClassDef, ClassId, Stats } from "./types";

const baseDefaults: Stats = {
  maxHp: 100,
  attack: 10,
  attackInterval: 1.5,
  armor: 0,
  threat: 1,
  healPower: 0,
  abilityPower: 1,
  abilityCooldown: 8,
};

function stats(overrides: Partial<Stats>): Stats {
  return { ...baseDefaults, ...overrides };
}

export const CLASSES: Record<ClassId, ClassDef> = {
  knight: {
    id: "knight",
    name: "Knight",
    role: "tank",
    starter: true,
    recruitCost: 0,
    base: stats({
      maxHp: 95,
      attack: 9,
      attackInterval: 1.5,
      armor: 0.12,
      threat: 4,
      // Iron Wall is a strong rank-1 shield, so it sits on a longer leash than
      // the default 8s ability cooldown.
      abilityCooldown: 10,
    }),
    ability: {
      id: "taunt",
      name: "Iron Wall",
      kind: "taunt",
      // Shield = maxHp * magnitude * abilityPower. At rank one (abilityPower 1)
      // this is a modest ~12% max-HP shield per cast; later AP upgrades scale it.
      magnitude: 0.12,
      requiresNode: "kn_ironwall",
    },
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "dps",
    starter: false,
    recruitCost: 60,
    base: stats({
      maxHp: 80,
      attack: 11,
      attackInterval: 1.4,
      armor: 0.02,
    }),
    ability: {
      id: "volley",
      name: "Volley",
      kind: "volley",
      // Per-target damage is intentionally below a normal shot: Volley trades
      // single-target punch for hitting up to 3 enemies at once.
      magnitude: 0.7,
      requiresNode: "rg_volley",
    },
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    role: "healer",
    starter: false,
    recruitCost: 220,
    base: stats({
      maxHp: 110,
      attack: 5,
      attackInterval: 3.5,
      armor: 0.08,
      healPower: 6,
      abilityCooldown: 20,
    }),
    ability: { id: "bigheal", name: "Sanctuary", kind: "bigheal", magnitude: 4 },
  },
  mage: {
    id: "mage",
    name: "Mage",
    role: "dps",
    starter: false,
    recruitCost: 280,
    base: stats({
      maxHp: 70,
      attack: 18,
      attackInterval: 1.8,
      armor: 0,
      abilityCooldown: 9,
    }),
    ability: { id: "nuke", name: "Fireball", kind: "nuke", magnitude: 5 },
  },
  warlock: {
    id: "warlock",
    name: "Warlock",
    role: "dps",
    starter: false,
    recruitCost: 360,
    base: stats({
      maxHp: 85,
      attack: 9,
      attackInterval: 1.4,
      armor: 0.03,
      abilityCooldown: 7,
    }),
    ability: { id: "dot", name: "Curse", kind: "dot", magnitude: 6 },
  },
};

export const STARTER_CLASS: ClassId = "knight";

// Order here drives the tavern recruit list: Ranger first, then the Healer,
// then the remaining DPS. (The Knight is the starter and is filtered out.)
export const ALL_CLASS_IDS: ClassId[] = [
  "knight",
  "ranger",
  "cleric",
  "mage",
  "warlock",
];

export function getClass(id: ClassId): ClassDef {
  return CLASSES[id];
}
