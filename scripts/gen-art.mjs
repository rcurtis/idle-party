// Authors the game's pixel-art sprite sheet.
//
// Sprites are drawn into a uniform grid of 24x24 cells with a small pixel
// drawing API, then composited into a single PNG sprite sheet plus a JSON
// manifest mapping sprite name -> {x, y, w, h}. Re-run with `npm run gen:art`.

import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "assets");
const CELL = 24;

// --- Palette ---------------------------------------------------------------
const PAL = {
  ".": [0, 0, 0, 0], // transparent
  k: [20, 16, 28, 255], // outline / black
  s: [230, 184, 138, 255], // skin
  S: [180, 130, 95, 255], // skin shadow
  // metals
  g: [154, 164, 178, 255],
  G: [90, 100, 115, 255],
  // blues
  b: [74, 120, 208, 255],
  B: [42, 70, 140, 255],
  // greens
  n: [76, 175, 80, 255],
  N: [40, 100, 50, 255],
  // purples
  p: [156, 77, 204, 255],
  P: [90, 40, 130, 255],
  // whites / bone
  w: [240, 240, 245, 255],
  o: [220, 214, 192, 255],
  O: [170, 162, 140, 255],
  // gold
  y: [255, 206, 92, 255],
  Y: [201, 150, 46, 255],
  // red
  r: [224, 68, 79, 255],
  // lava (bright / dark)
  l: [255, 110, 50, 255],
  L: [170, 45, 25, 255],
  // copper / brass (light / dark)
  c: [196, 132, 74, 255],
  C: [130, 82, 42, 255],
  // brown
  m: [141, 110, 79, 255],
  M: [90, 68, 46, 255],
  // teal
  t: [60, 170, 170, 255],
  T: [34, 110, 110, 255],
  // stone
  h: [120, 120, 134, 255],
  H: [78, 78, 92, 255],
  // glow / flame / eye
  e: [120, 230, 255, 255],
  f: [255, 150, 60, 255],
  q: [190, 120, 255, 255], // arcane glow
};

// --- Drawing API -----------------------------------------------------------
function cell() {
  return Array.from({ length: CELL }, () => Array(CELL).fill("."));
}
const inb = (x, y) => x >= 0 && y >= 0 && x < CELL && y < CELL;
function px(c, x, y, col) {
  if (inb(x, y) && col !== ".") c[y][x] = col;
}
function rect(c, x, y, w, h, col) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(c, x + i, y + j, col);
}
function hline(c, x, y, w, col) {
  for (let i = 0; i < w; i++) px(c, x + i, y, col);
}
function vline(c, x, y, h, col) {
  for (let j = 0; j < h; j++) px(c, x, y + j, col);
}
function disc(c, cx, cy, r, col) {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++)
      if (i * i + j * j <= r * r) px(c, cx + i, cy + j, col);
}
// Outline filled pixels (4-neighborhood) that touch transparency, with 'k'.
function outline(c, col = "k") {
  const pts = [];
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      if (c[y][x] === ".") continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy;
        if (!inb(nx, ny) || c[ny][nx] === ".") pts.push([nx, ny]);
      }
    }
  for (const [x, y] of pts) px(c, x, y, col);
}

// --- Sprite builders -------------------------------------------------------

// Humanoid adventurer facing right. cfg: {robe,robeDark,skin,hair,accent,weapon}
function humanoid(cfg) {
  const c = cell();
  const { robe, robeDark, hair, accent, weapon } = cfg;
  const skin = cfg.skin ?? "s";
  // legs
  rect(c, 9, 19, 2, 3, robeDark);
  rect(c, 13, 19, 2, 3, robeDark);
  // robe / body
  rect(c, 8, 11, 8, 9, robe);
  rect(c, 14, 12, 2, 8, robeDark); // right-side shade
  hline(c, 8, 15, 8, accent); // belt / sash
  // arms
  rect(c, 7, 12, 1, 6, robeDark);
  rect(c, 16, 12, 1, 6, robe);
  // head
  rect(c, 9, 5, 6, 6, skin);
  rect(c, 14, 6, 1, 4, "S");
  // hair / hood
  rect(c, 9, 4, 6, 2, hair);
  rect(c, 8, 5, 1, 3, hair);
  // eye
  px(c, 13, 8, "k");
  // weapon along the right hand
  if (weapon === "bow") {
    vline(c, 18, 8, 9, "m");
    px(c, 17, 8, "m");
    px(c, 17, 16, "m");
    vline(c, 18, 9, 7, "w"); // string highlight area
    vline(c, 18, 9, 7, "m");
    px(c, 18, 12, "w");
  } else if (weapon === "staff") {
    vline(c, 18, 4, 14, "M");
    disc(c, 18, 4, 2, accent);
    px(c, 18, 4, "w");
  } else if (weapon === "mace") {
    vline(c, 18, 8, 8, "M");
    disc(c, 18, 7, 2, "g");
  } else if (weapon === "sword") {
    vline(c, 18, 4, 12, "g");
    hline(c, 17, 15, 3, "Y"); // crossguard
    px(c, 18, 3, "w");
  } else if (weapon === "shield") {
    rect(c, 5, 11, 3, 7, "g");
    rect(c, 5, 11, 1, 7, "G");
    px(c, 6, 14, accent);
  }
  outline(c);
  return c;
}

function knight() {
  const c = humanoid({
    robe: "g",
    robeDark: "G",
    hair: "G",
    accent: "b",
    weapon: "sword",
  });
  // helmet plume + shield
  rect(c, 5, 11, 3, 8, "g");
  rect(c, 5, 11, 1, 8, "G");
  px(c, 6, 14, "b");
  rect(c, 9, 3, 6, 2, "g"); // helm top
  px(c, 11, 2, "r"); // plume
  px(c, 12, 2, "r");
  outline(c);
  return c;
}
const cleric = () =>
  humanoid({ robe: "w", robeDark: "O", hair: "Y", accent: "y", weapon: "mace" });
const ranger = () =>
  humanoid({ robe: "n", robeDark: "N", hair: "N", accent: "m", weapon: "bow" });
const mage = () => {
  const c = humanoid({
    robe: "b",
    robeDark: "B",
    hair: "B",
    accent: "q",
    weapon: "staff",
  });
  // pointed hat
  px(c, 11, 1, "B");
  rect(c, 10, 2, 4, 2, "b");
  rect(c, 9, 4, 6, 1, "B");
  outline(c);
  return c;
};
const warlock = () => {
  const c = humanoid({
    robe: "P",
    robeDark: "k",
    hair: "k",
    accent: "n",
    weapon: "staff",
  });
  px(c, 13, 8, "n"); // glowing eye
  outline(c);
  return c;
};

// --- Enemies ---------------------------------------------------------------
function rat() {
  const c = cell();
  rect(c, 6, 15, 10, 4, "m"); // body
  rect(c, 6, 17, 10, 2, "M");
  disc(c, 16, 15, 2, "m"); // head
  px(c, 17, 14, "M"); // ear
  px(c, 18, 15, "r"); // eye
  vline(c, 4, 14, 1, "M");
  hline(c, 2, 16, 4, "M"); // tail
  px(c, 1, 17, "M");
  outline(c);
  return c;
}
function skeleton() {
  const c = cell();
  rect(c, 9, 4, 6, 6, "o"); // skull
  px(c, 11, 7, "k");
  px(c, 13, 7, "k");
  hline(c, 10, 9, 4, "O");
  vline(c, 11, 10, 9, "o"); // spine
  for (let r = 0; r < 4; r++) hline(c, 8, 11 + r * 2, 8, "o"); // ribs
  rect(c, 9, 19, 2, 3, "o");
  rect(c, 13, 19, 2, 3, "o");
  vline(c, 7, 11, 6, "o");
  vline(c, 16, 11, 6, "o");
  outline(c);
  return c;
}
function ghoul() {
  const c = humanoid({
    robe: "N",
    robeDark: "k",
    hair: "N",
    skin: "n",
    accent: "M",
    weapon: "claw",
  });
  px(c, 13, 8, "r");
  rect(c, 16, 14, 2, 2, "n"); // claw
  px(c, 18, 15, "k");
  outline(c);
  return c;
}
function drowned() {
  const c = humanoid({
    robe: "T",
    robeDark: "k",
    hair: "t",
    skin: "t",
    accent: "n",
    weapon: "claw",
  });
  px(c, 13, 8, "e");
  px(c, 8, 13, "t");
  px(c, 16, 16, "t"); // dripping
  outline(c);
  return c;
}
function wraith() {
  const c = cell();
  // floating shroud, no legs
  for (let y = 4; y < 20; y++) {
    const w = 4 + Math.floor((y - 4) / 2);
    rect(c, 12 - Math.floor(w / 2), y, w, 1, y % 2 ? "P" : "p");
  }
  // tattered bottom
  for (let x = 7; x < 18; x += 2) px(c, x, 20, "P");
  px(c, 10, 9, "e"); // eyes
  px(c, 13, 9, "e");
  outline(c);
  return c;
}
function golem() {
  const c = cell();
  rect(c, 6, 6, 12, 12, "h"); // bulky torso
  rect(c, 6, 6, 12, 2, "H");
  rect(c, 15, 6, 3, 12, "H");
  rect(c, 8, 4, 8, 3, "h"); // head
  px(c, 10, 5, "n"); // eyes (mossy)
  px(c, 13, 5, "n");
  rect(c, 3, 8, 3, 8, "h"); // arms
  rect(c, 18, 8, 3, 8, "h");
  rect(c, 7, 18, 4, 4, "H"); // legs
  rect(c, 13, 18, 4, 4, "H");
  // cracks
  px(c, 11, 10, "H");
  px(c, 12, 11, "H");
  px(c, 11, 12, "H");
  outline(c);
  return c;
}

// --- Bosses (fill most of the cell) ----------------------------------------
function bossLich() {
  const c = cell();
  // big robed lich with crown
  for (let y = 8; y < 22; y++) {
    const w = 6 + (y - 8);
    rect(c, 12 - Math.floor(w / 2), y, w, 1, y % 2 ? "P" : "p");
  }
  rect(c, 8, 3, 8, 7, "o"); // skull
  rect(c, 9, 6, 2, 2, "e"); // eye sockets glowing
  rect(c, 13, 6, 2, 2, "e");
  hline(c, 10, 9, 4, "O"); // teeth
  // crown
  hline(c, 8, 2, 8, "y");
  px(c, 9, 1, "y");
  px(c, 12, 1, "y");
  px(c, 15, 1, "y");
  px(c, 10, 1, "r"); // gems
  px(c, 14, 1, "e");
  // arms with staff
  vline(c, 4, 8, 12, "P");
  vline(c, 20, 6, 4, "M");
  disc(c, 20, 5, 2, "e");
  outline(c);
  return c;
}
function bossKraken() {
  const c = cell();
  disc(c, 12, 9, 6, "T"); // head bulb
  disc(c, 12, 8, 5, "t");
  px(c, 10, 8, "y"); // eyes
  px(c, 14, 8, "y");
  px(c, 10, 8, "k");
  px(c, 14, 8, "k");
  // tentacles
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 4;
    for (let y = 14; y < 23; y++) {
      const wob = Math.floor(Math.sin((y + i) * 0.9) * 1.5);
      px(c, x + wob, y, y % 2 ? "T" : "t");
      px(c, x + wob + 1, y, "T");
    }
  }
  outline(c);
  return c;
}

// --- Dungeon 3: Volcanic Forge enemies -------------------------------------
function fireImp() {
  const c = cell();
  rect(c, 9, 12, 6, 6, "r"); // torso
  rect(c, 9, 16, 6, 2, "L");
  disc(c, 12, 9, 3, "r"); // head
  px(c, 10, 9, "y");
  px(c, 14, 9, "y"); // eyes
  px(c, 9, 5, "L");
  px(c, 8, 4, "L"); // horns
  px(c, 15, 5, "L");
  px(c, 16, 4, "L");
  rect(c, 9, 18, 2, 3, "L"); // legs
  rect(c, 13, 18, 2, 3, "L");
  px(c, 6, 12, "f"); // flame aura
  px(c, 7, 13, "y");
  px(c, 18, 12, "f");
  px(c, 17, 13, "y");
  outline(c);
  return c;
}
function magmaHound() {
  const c = cell();
  rect(c, 5, 13, 12, 5, "L"); // body
  rect(c, 5, 13, 12, 2, "r"); // glowing back
  disc(c, 17, 13, 3, "L"); // head
  px(c, 18, 12, "y"); // eye
  rect(c, 6, 18, 2, 3, "L"); // legs
  rect(c, 10, 18, 2, 3, "L");
  rect(c, 14, 18, 2, 3, "L");
  px(c, 8, 15, "f"); // lava cracks
  px(c, 11, 14, "l");
  px(c, 13, 16, "f");
  hline(c, 2, 14, 3, "L"); // tail
  px(c, 1, 13, "f");
  outline(c);
  return c;
}
function forgeGolem() {
  const c = cell();
  rect(c, 6, 6, 12, 12, "H"); // dark stone torso
  rect(c, 6, 6, 12, 2, "h");
  rect(c, 8, 4, 8, 3, "H"); // head
  px(c, 10, 5, "f");
  px(c, 13, 5, "f"); // fiery eyes
  rect(c, 3, 8, 3, 8, "H"); // arms
  rect(c, 18, 8, 3, 8, "H");
  rect(c, 7, 18, 4, 4, "h"); // legs
  rect(c, 13, 18, 4, 4, "h");
  px(c, 11, 9, "l"); // glowing cracks
  px(c, 12, 10, "f");
  px(c, 11, 11, "l");
  px(c, 10, 12, "f");
  px(c, 13, 13, "l");
  outline(c);
  return c;
}
function bossForgeTyrant() {
  const c = cell();
  rect(c, 5, 7, 13, 13, "L"); // massive torso
  rect(c, 5, 7, 13, 2, "r");
  rect(c, 15, 8, 3, 12, "k"); // shadow side
  rect(c, 8, 2, 8, 6, "L"); // head
  px(c, 7, 1, "L"); // horns
  px(c, 16, 1, "L");
  rect(c, 9, 4, 2, 2, "f"); // eyes
  rect(c, 13, 4, 2, 2, "f");
  hline(c, 9, 6, 6, "y"); // mouth glow
  px(c, 9, 11, "l"); // lava cracks
  px(c, 11, 13, "f");
  px(c, 13, 15, "l");
  px(c, 8, 16, "f");
  px(c, 12, 17, "l");
  rect(c, 2, 9, 3, 8, "L"); // arm
  vline(c, 20, 6, 12, "M"); // hammer handle
  rect(c, 18, 4, 5, 4, "h"); // hammer head
  rect(c, 18, 4, 5, 1, "g");
  outline(c);
  return c;
}

// --- Dungeon 4: Clockwork Depths enemies ------------------------------------
function gearSentry() {
  const c = cell();
  disc(c, 12, 12, 4, "c"); // brass body
  disc(c, 12, 12, 2, "G"); // lens housing
  px(c, 12, 12, "e"); // glowing lens
  px(c, 12, 6, "C"); // gear teeth
  px(c, 12, 18, "C");
  px(c, 6, 12, "C");
  px(c, 18, 12, "C");
  px(c, 8, 8, "C");
  px(c, 16, 8, "C");
  px(c, 8, 16, "C");
  px(c, 16, 16, "C");
  outline(c);
  return c;
}
function steamGolem() {
  const c = cell();
  rect(c, 7, 7, 10, 11, "c"); // brass torso
  rect(c, 7, 7, 10, 2, "y"); // shine
  rect(c, 14, 8, 3, 10, "C"); // shade
  rect(c, 9, 3, 6, 4, "c"); // head
  px(c, 10, 5, "e"); // eyes
  px(c, 13, 5, "e");
  rect(c, 4, 9, 3, 7, "C"); // arms
  rect(c, 17, 9, 3, 7, "C");
  rect(c, 8, 18, 3, 4, "C"); // legs
  rect(c, 13, 18, 3, 4, "C");
  px(c, 9, 10, "G"); // rivets
  px(c, 14, 10, "G");
  px(c, 11, 14, "G");
  px(c, 8, 2, "g"); // steam pipe
  px(c, 8, 1, "w");
  outline(c);
  return c;
}
function warAutomaton() {
  const c = cell();
  rect(c, 5, 6, 14, 13, "G"); // steel torso
  rect(c, 5, 6, 14, 2, "g");
  rect(c, 16, 7, 3, 12, "k"); // shade
  rect(c, 8, 2, 8, 4, "g"); // head
  rect(c, 9, 3, 6, 2, "k");
  px(c, 10, 4, "r"); // red eyes
  px(c, 13, 4, "r");
  rect(c, 2, 8, 3, 9, "G"); // arms
  rect(c, 19, 8, 3, 9, "G");
  rect(c, 7, 19, 4, 3, "k"); // legs
  rect(c, 13, 19, 4, 3, "k");
  disc(c, 12, 12, 2, "c"); // chest core
  px(c, 12, 12, "e");
  px(c, 8, 9, "c"); // brass bolts
  px(c, 16, 9, "c");
  outline(c);
  return c;
}
function bossGrandEngine() {
  const c = cell();
  rect(c, 4, 5, 16, 15, "G"); // huge boiler torso
  rect(c, 4, 5, 16, 2, "g");
  rect(c, 17, 6, 3, 14, "k");
  disc(c, 12, 12, 4, "c"); // brass furnace core
  disc(c, 12, 12, 2, "f");
  px(c, 12, 12, "y");
  rect(c, 9, 1, 6, 4, "C"); // head / chimney
  px(c, 10, 0, "h");
  px(c, 13, 0, "h");
  px(c, 10, 3, "e"); // eyes
  px(c, 13, 3, "e");
  disc(c, 5, 7, 2, "C"); // gear shoulders
  disc(c, 19, 7, 2, "C");
  rect(c, 1, 9, 3, 9, "G"); // arms
  rect(c, 20, 9, 3, 9, "G");
  rect(c, 6, 20, 5, 3, "k"); // treads
  rect(c, 13, 20, 5, 3, "k");
  px(c, 7, 8, "y"); // rivets
  px(c, 16, 8, "y");
  px(c, 7, 16, "y");
  px(c, 16, 16, "y");
  outline(c);
  return c;
}

// --- Props -----------------------------------------------------------------
function coin() {
  const c = cell();
  disc(c, 12, 13, 4, "y");
  disc(c, 12, 13, 2, "Y");
  px(c, 11, 11, "w");
  px(c, 12, 12, "w");
  outline(c);
  return c;
}
function floorTile() {
  const c = cell();
  rect(c, 0, 0, CELL, CELL, "H");
  for (let y = 0; y < CELL; y += 6)
    for (let x = 0; x < CELL; x += 6) {
      rect(c, x + 1, y + 1, 4, 4, "h");
    }
  return c;
}
function wallTile() {
  const c = cell();
  rect(c, 0, 0, CELL, CELL, "H");
  for (let y = 0; y < CELL; y += 6) hline(c, 0, y, CELL, "k");
  for (let y = 0; y < CELL; y += 12)
    for (let x = 0; x < CELL; x += 12) vline(c, x, y, 6, "k");
  for (let y = 6; y < CELL; y += 12)
    for (let x = 6; x < CELL; x += 12) vline(c, x, y, 6, "k");
  return c;
}
function torch() {
  const c = cell();
  vline(c, 12, 12, 9, "M");
  disc(c, 12, 9, 3, "f");
  disc(c, 12, 8, 1, "y");
  px(c, 12, 6, "y");
  outline(c);
  return c;
}

// --- Compose sheet ---------------------------------------------------------
const SPRITES = {
  knight: knight(),
  cleric: cleric(),
  ranger: ranger(),
  mage: mage(),
  warlock: warlock(),
  rat: rat(),
  skeleton: skeleton(),
  ghoul: ghoul(),
  drowned: drowned(),
  wraith: wraith(),
  golem: golem(),
  fireImp: fireImp(),
  magmaHound: magmaHound(),
  forgeGolem: forgeGolem(),
  gearSentry: gearSentry(),
  steamGolem: steamGolem(),
  warAutomaton: warAutomaton(),
  bossLich: bossLich(),
  bossKraken: bossKraken(),
  bossForgeTyrant: bossForgeTyrant(),
  bossGrandEngine: bossGrandEngine(),
  coin: coin(),
  floor: floorTile(),
  wall: wallTile(),
  torch: torch(),
};

const names = Object.keys(SPRITES);
const cols = 6;
const rows = Math.ceil(names.length / cols);
const W = cols * CELL;
const H = rows * CELL;
const png = new PNG({ width: W, height: H });
const manifest = {};

names.forEach((name, idx) => {
  const cx = (idx % cols) * CELL;
  const cy = Math.floor(idx / cols) * CELL;
  manifest[name] = { x: cx, y: cy, w: CELL, h: CELL };
  const grid = SPRITES[name];
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const [r, g, b, a] = PAL[grid[y][x]] ?? PAL["."];
      const o = ((cy + y) * W + (cx + x)) * 4;
      png.data[o] = r;
      png.data[o + 1] = g;
      png.data[o + 2] = b;
      png.data[o + 3] = a;
    }
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "sprites.png"), PNG.sync.write(png));
writeFileSync(
  join(OUT_DIR, "sprites.json"),
  JSON.stringify({ cell: CELL, sheet: "sprites.png", frames: manifest }, null, 2),
);
console.log(`Wrote ${names.length} sprites to ${OUT_DIR}/sprites.png (${W}x${H})`);
