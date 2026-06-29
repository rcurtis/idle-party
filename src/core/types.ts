// Shared core data types. No DOM, no rendering concerns.

export type ClassId = "knight" | "cleric" | "ranger" | "mage" | "warlock";
export type Role = "tank" | "healer" | "dps";

/** Stat bundle resolved for a character at the start of a run. */
export interface Stats {
  maxHp: number;
  /** Damage per hit (before mitigation). */
  attack: number;
  /** Seconds between auto-attacks. */
  attackInterval: number;
  /** Damage reduction, 0..~0.8 (armor). */
  armor: number;
  /** Tank: extra threat multiplier. */
  threat: number;
  /** Healer: HP restored per heal. */
  healPower: number;
  /** Multiplier applied to active-ability effects. */
  abilityPower: number;
  /** Seconds between ability casts. */
  abilityCooldown: number;
}

export type StatKey = keyof Stats;

/** Definition of a playable class (static data). */
export interface ClassDef {
  id: ClassId;
  name: string;
  role: Role;
  /** True if the player owns this from the start. */
  starter: boolean;
  /** One-time gold cost to recruit (ignored if starter). */
  recruitCost: number;
  base: Stats;
  ability: AbilityDef;
  /** Short flavor for UI. */
  blurb: string;
}

export type AbilityKind = "taunt" | "bigheal" | "nuke" | "dot" | "volley";

export interface AbilityDef {
  id: string;
  name: string;
  kind: AbilityKind;
  /** Tuning magnitude; meaning depends on kind. */
  magnitude: number;
  /** If set, the ability is locked until this skill node is purchased. */
  requiresNode?: string;
}

/** A character instance the player owns (persistent, between runs). */
export interface OwnedCharacter {
  classId: ClassId;
}

/** Live combatant during a run (party member). */
export interface Combatant {
  classId: ClassId;
  role: Role;
  name: string;
  stats: Stats;
  hp: number;
  /** Seconds until next auto-attack. */
  atkTimer: number;
  /** Seconds until ability ready (0 = ready). */
  abilityTimer: number;
  ability: AbilityDef;
  /** False if the ability is gated behind an unpurchased skill node. */
  abilityUnlocked: boolean;
  alive: boolean;
  /** Flat damage absorbed before HP (from taunt-shield). */
  shield: number;
}

/** Live enemy during a run. */
export interface Enemy {
  id: string;
  name: string;
  isBoss: boolean;
  maxHp: number;
  hp: number;
  attack: number;
  attackInterval: number;
  armor: number;
  atkTimer: number;
  goldValue: number;
  /** Active damage-over-time stacks applied by warlock. */
  dotStacks: number;
  /** Damage dealt per second per stack while dotStacks > 0. */
  dotDps: number;
  dotTimer: number;
  alive: boolean;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  attack: number;
  attackInterval: number;
  armor: number;
  goldValue: number;
}

export interface LevelDef {
  /** Enemy packs; each entry is a list of enemy def ids that spawn together. */
  packs: string[][];
  isBoss: boolean;
}

export interface DungeonDef {
  id: string;
  name: string;
  /** Enemy definitions available in this dungeon, by id. */
  enemies: Record<string, EnemyDef>;
  levels: LevelDef[];
  /** Multiplies all gold earned in this dungeon. */
  goldMultiplier: number;
}

// ---- Skill tree -----------------------------------------------------------

export type ModifierOp = "add" | "mul";

/** Applies to a class's stat, or "party" for all. */
export interface NodeEffect {
  target: ClassId | "party";
  stat: StatKey;
  op: ModifierOp;
  value: number;
}

export interface SkillNode {
  id: string;
  name: string;
  cost: number;
  /** Number of times this node can be purchased. */
  maxRanks: number;
  /** Stat effect per rank. Omitted for unlock-style nodes. */
  effect?: NodeEffect;
  /** Unlock-style node (no stat effect): which class it belongs to + blurb. */
  unlock?: { target: ClassId; desc: string };
  /** Recruit-anchor node: clicking recruits this class (cost = recruitCost in gold). */
  recruit?: ClassId;
  /** Gate node: clicking spends sigils to unlock the given wing. */
  unlockWing?: string;
  /** Authored graph position (center), in the hub's virtual coordinate space. */
  pos?: { x: number; y: number };
  /** Other node ids this node is wired to in the graph (visual links). */
  links?: string[];
  /** Node ids that must be purchased (>=1 rank) before this unlocks. */
  requires: string[];
}

export interface SkillWing {
  id: string;
  name: string;
  /** Sigils required to unlock the wing; 0 = open from start. */
  sigilCost: number;
  nodes: SkillNode[];
}

// ---- Persistent + run state ----------------------------------------------

export interface SaveState {
  version: number;
  gold: number;
  sigils: number;
  /** Class ids the player has recruited (includes starter). */
  roster: ClassId[];
  /** node id -> ranks purchased. */
  purchased: Record<string, number>;
  /** Wing ids the player has unlocked with sigils. */
  unlockedWings: string[];
  /** Dungeon ids the player has unlocked. */
  unlockedDungeons: string[];
  /** Dungeon ids whose boss has been defeated at least once. */
  bossesDefeated: string[];
  settings: {
    autoCastAbilities: boolean;
  };
}

// ---- Combat events (for rendering/FX; do not affect simulation) ----------

export type Side = "party" | "enemy";

/** Points at a combatant by its index within run.party / run.enemies. */
export interface CombatRef {
  side: Side;
  index: number;
}

export type ProjectileKind =
  | "arrow"
  | "magic"
  | "shadow"
  | "holy"
  | "fire"
  | "none";

/**
 * A visual-only record of something that happened during a step. The renderer
 * drains these each frame to spawn projectiles, numbers, impacts, etc. They
 * carry no authority over game state.
 */
export type CombatEvent =
  | {
      t: "attack";
      from: CombatRef;
      to: CombatRef;
      ranged: boolean;
      projectile: ProjectileKind;
      amount: number;
      lethal: boolean;
      crit?: boolean;
    }
  | { t: "heal"; from: CombatRef; to: CombatRef; amount: number }
  | { t: "dot"; to: CombatRef; amount: number }
  | {
      t: "cast";
      from: CombatRef;
      ability: AbilityKind;
      projectile: ProjectileKind;
      targets: CombatRef[];
    };

export type RunPhase = "fighting" | "advancing" | "won" | "wiped";

/** Snapshot of an in-progress dungeon run. */
export interface RunState {
  dungeonId: string;
  levelIndex: number;
  phase: RunPhase;
  party: Combatant[];
  enemies: Enemy[];
  /** Gold earned so far this run. */
  goldEarned: number;
  /** Sigils earned this run (boss kills). */
  sigilsEarned: number;
  /** Seconds elapsed in current advance transition. */
  advanceTimer: number;
  /** Index of next pack to spawn within the current level. */
  packIndex: number;
  log: string[];
  /** True once results have been banked into the save. */
  resolved: boolean;
  /** Deterministic RNG state. */
  rngState: number;
  /** Visual-only events since last drain (rendering FX); capped. */
  events: CombatEvent[];
}
