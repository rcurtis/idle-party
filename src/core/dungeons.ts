import type { DungeonDef, EnemyDef } from "./types";

function enemy(
  id: string,
  name: string,
  hp: number,
  attack: number,
  attackInterval: number,
  armor: number,
  goldValue: number,
): EnemyDef {
  return { id, name, hp, attack, attackInterval, armor, goldValue };
}

// --- Dungeon 1: The Catacombs ---------------------------------------------

const catacombsEnemies: Record<string, EnemyDef> = {
  rat: enemy("rat", "Tomb Rat", 30, 5, 1.2, 0, 4),
  skeleton: enemy("skeleton", "Skeleton", 55, 9, 1.4, 0.05, 7),
  ghoul: enemy("ghoul", "Ghoul", 90, 13, 1.5, 0.1, 12),
  bossLich: enemy("bossLich", "The Bone Lich", 1400, 28, 1.3, 0.2, 220),
};

const catacombs: DungeonDef = {
  id: "catacombs",
  name: "The Catacombs",
  goldMultiplier: 1,
  enemies: catacombsEnemies,
  levels: [
    { isBoss: false, packs: [["rat"], ["rat", "rat"], ["skeleton"]] },
    { isBoss: false, packs: [["rat", "rat"], ["skeleton"], ["skeleton", "rat"]] },
    {
      isBoss: false,
      packs: [["skeleton"], ["skeleton", "rat", "rat"], ["ghoul"]],
    },
    {
      isBoss: false,
      packs: [["skeleton", "skeleton"], ["ghoul"], ["ghoul", "skeleton"]],
    },
    { isBoss: true, packs: [["bossLich"]] },
  ],
};

// --- Dungeon 2: The Sunken Crypt ------------------------------------------

const cryptEnemies: Record<string, EnemyDef> = {
  drowned: enemy("drowned", "Drowned Thrall", 130, 18, 1.3, 0.12, 18),
  wraith: enemy("wraith", "Wraith", 180, 26, 1.5, 0.18, 26),
  golem: enemy("golem", "Bog Golem", 320, 34, 1.7, 0.3, 40),
  bossKraken: enemy("bossKraken", "The Tide Maw", 4200, 55, 1.2, 0.32, 700),
};

const crypt: DungeonDef = {
  id: "crypt",
  name: "The Sunken Crypt",
  goldMultiplier: 2.4,
  enemies: cryptEnemies,
  levels: [
    { isBoss: false, packs: [["drowned"], ["drowned", "drowned"], ["wraith"]] },
    {
      isBoss: false,
      packs: [["drowned", "drowned"], ["wraith"], ["wraith", "drowned"]],
    },
    {
      isBoss: false,
      packs: [["wraith"], ["wraith", "drowned", "drowned"], ["golem"]],
    },
    {
      isBoss: false,
      packs: [["wraith", "wraith"], ["golem"], ["golem", "wraith"]],
    },
    { isBoss: true, packs: [["bossKraken"]] },
  ],
};

export const DUNGEONS: Record<string, DungeonDef> = {
  catacombs,
  crypt,
};

export const DUNGEON_ORDER: string[] = ["catacombs", "crypt"];

export const FIRST_DUNGEON = "catacombs";

export function getDungeon(id: string): DungeonDef {
  const d = DUNGEONS[id];
  if (!d) throw new Error(`Unknown dungeon: ${id}`);
  return d;
}

/** The dungeon unlocked by defeating the given dungeon's boss, if any. */
export function nextDungeonId(id: string): string | null {
  const idx = DUNGEON_ORDER.indexOf(id);
  if (idx === -1 || idx + 1 >= DUNGEON_ORDER.length) return null;
  return DUNGEON_ORDER[idx + 1];
}
