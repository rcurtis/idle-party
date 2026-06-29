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
    blurb: "Holds the front line. High HP, draws enemy aggression. You start with the Knight.",
    base: stats({
      maxHp: 260,
      attack: 7,
      attackInterval: 1.6,
      armor: 0.35,
      threat: 4,
    }),
    ability: {
      id: "taunt",
      name: "Iron Wall",
      kind: "taunt",
      magnitude: 0.6,
      requiresNode: "kn_ironwall",
    },
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "dps",
    starter: false,
    recruitCost: 90,
    blurb: "Steady single-target arrows. Your first recruit — adds the damage your Knight lacks.",
    base: stats({
      maxHp: 80,
      attack: 14,
      attackInterval: 1.1,
      armor: 0.02,
    }),
    ability: { id: "volley", name: "Volley", kind: "volley", magnitude: 2.2 },
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    role: "healer",
    starter: false,
    recruitCost: 220,
    blurb: "Keeps the party standing. Heals the most wounded ally.",
    base: stats({
      maxHp: 110,
      attack: 5,
      attackInterval: 2.0,
      armor: 0.08,
      healPower: 16,
      abilityCooldown: 10,
    }),
    ability: { id: "bigheal", name: "Sanctuary", kind: "bigheal", magnitude: 4 },
  },
  mage: {
    id: "mage",
    name: "Mage",
    role: "dps",
    starter: false,
    recruitCost: 280,
    blurb: "Glass-cannon burst. Devastating nukes on cooldown.",
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
    blurb: "Stacks corrosive damage-over-time on foes.",
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
