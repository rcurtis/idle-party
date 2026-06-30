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
  rat: enemy("rat", "Tomb Rat", 55, 5, 1.2, 0, 7),
  skeleton: enemy("skeleton", "Skeleton", 100, 9, 1.4, 0.05, 12),
  ghoul: enemy("ghoul", "Ghoul", 165, 13, 1.5, 0.1, 18),
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
  drowned: enemy("drowned", "Drowned Thrall", 235, 18, 1.3, 0.12, 18),
  wraith: enemy("wraith", "Wraith", 325, 26, 1.5, 0.18, 26),
  golem: enemy("golem", "Bog Golem", 575, 34, 1.7, 0.3, 40),
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

// --- Dungeon 3: The Volcanic Forge ----------------------------------------

const forgeEnemies: Record<string, EnemyDef> = {
  fireImp: enemy("fireImp", "Fire Imp", 680, 40, 1.1, 0.1, 30),
  magmaHound: enemy("magmaHound", "Magma Hound", 1050, 58, 1.3, 0.2, 42),
  forgeGolem: enemy("forgeGolem", "Forge Golem", 1750, 78, 1.7, 0.38, 65),
  bossForgeTyrant: enemy("bossForgeTyrant", "The Forge Tyrant", 17000, 125, 1.2, 0.35, 1600),
};

const forge: DungeonDef = {
  id: "forge",
  name: "The Volcanic Forge",
  goldMultiplier: 5.5,
  enemies: forgeEnemies,
  levels: [
    { isBoss: false, packs: [["fireImp"], ["fireImp", "fireImp"], ["magmaHound"]] },
    {
      isBoss: false,
      packs: [["fireImp", "fireImp"], ["magmaHound"], ["magmaHound", "fireImp"]],
    },
    {
      isBoss: false,
      packs: [["magmaHound"], ["magmaHound", "fireImp", "fireImp"], ["forgeGolem"]],
    },
    {
      isBoss: false,
      packs: [["magmaHound", "magmaHound"], ["forgeGolem"], ["forgeGolem", "magmaHound"]],
    },
    { isBoss: true, packs: [["bossForgeTyrant"]] },
  ],
};

// --- Dungeon 4: The Clockwork Depths --------------------------------------

const clockworkEnemies: Record<string, EnemyDef> = {
  gearSentry: enemy("gearSentry", "Gear Sentry", 1450, 74, 1.0, 0.18, 50),
  steamGolem: enemy("steamGolem", "Steam Golem", 2300, 102, 1.4, 0.3, 70),
  warAutomaton: enemy("warAutomaton", "War Automaton", 3700, 132, 1.6, 0.45, 100),
  bossGrandEngine: enemy("bossGrandEngine", "The Grand Engine", 36000, 210, 1.1, 0.4, 3500),
};

const clockwork: DungeonDef = {
  id: "clockwork",
  name: "The Clockwork Depths",
  goldMultiplier: 12,
  enemies: clockworkEnemies,
  levels: [
    { isBoss: false, packs: [["gearSentry"], ["gearSentry", "gearSentry"], ["steamGolem"]] },
    {
      isBoss: false,
      packs: [["gearSentry", "gearSentry"], ["steamGolem"], ["steamGolem", "gearSentry"]],
    },
    {
      isBoss: false,
      packs: [["steamGolem"], ["steamGolem", "gearSentry", "gearSentry"], ["warAutomaton"]],
    },
    {
      isBoss: false,
      packs: [["steamGolem", "steamGolem"], ["warAutomaton"], ["warAutomaton", "steamGolem"]],
    },
    { isBoss: true, packs: [["bossGrandEngine"]] },
  ],
};

export const DUNGEONS: Record<string, DungeonDef> = {
  catacombs,
  crypt,
  forge,
  clockwork,
};

export const DUNGEON_ORDER: string[] = ["catacombs", "crypt", "forge", "clockwork"];

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
