import type { RunState } from "../core/types";
import { spriteForEnemy } from "./spritesheet";
import { Layout, SCALE } from "./layout";
import type { Fx } from "./fx";

/** Draw the dungeon arena: floor, walls, party (left) vs enemies (right) + FX. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  run: RunState,
  layout: Layout,
  fx: Fx,
  frame: number,
): void {
  ctx.imageSmoothingEnabled = false;
  const sheet = layout.sheet;
  const { W, H, cell, floorY } = layout;

  // Background gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1a1326");
  grad.addColorStop(1, "#0e0a16");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Wall row (top) + floor row (bottom).
  for (let x = 0; x < W; x += cell) {
    sheet.draw(ctx, "wall", x, 0, SCALE);
    sheet.draw(ctx, "floor", x, floorY, SCALE);
  }
  sheet.draw(ctx, "torch", Math.floor(W * 0.25) - cell / 2, cell, SCALE);
  sheet.draw(ctx, "torch", Math.floor(W * 0.7) - cell / 2, cell, SCALE);

  const baseY = layout.baseY;

  // Advancing banner.
  if (run.phase === "advancing") {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, H / 2 - 22, W, 44);
    ctx.fillStyle = "#ffce5c";
    ctx.font = "20px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Advancing…", W / 2, H / 2 + 7);
    ctx.textAlign = "left";
  }

  // Party on the left, facing right.
  run.party.forEach((c, i) => {
    const x = layout.partyX(i);
    const bob = c.alive ? Math.sin((frame + i * 7) * 0.18) * 2 : 0;
    const y = baseY + bob;
    const off = fx.slotOffset(`party:${i}`);
    ctx.globalAlpha = c.alive ? 1 : 0.25;
    drawSprite(ctx, layout, c.classId, x, y, SCALE, false, off);
    ctx.globalAlpha = 1;
    const barW = 44;
    const bx = x + (cell - barW) / 2;
    if (c.alive) drawBar(ctx, bx, y - 8, barW, c.hp / c.stats.maxHp, "#6fff97");
    if (c.alive && c.shield > 0) {
      drawBar(ctx, bx, y - 13, barW, Math.min(1, c.shield / c.stats.maxHp), "#6fd3ff");
    }
  });

  // Enemies on the right, facing left. Indexed by stable slot; dead ones are
  // skipped (their death burst is drawn by the FX layer).
  run.enemies.forEach((e, i) => {
    if (!e.alive) return;
    const sc = layout.enemyScale(e);
    const x = layout.enemyX(i, e);
    const bob = Math.sin((frame + i * 9) * 0.16) * 2;
    const y = layout.enemyTopY(e) + bob;
    const off = fx.slotOffset(`enemy:${i}`);
    drawSprite(ctx, layout, spriteForEnemy(e.id), x, y, sc, true, off);
    const fullW = sheet.cell * sc;
    const ebarW = e.isBoss ? fullW : fullW * 0.7;
    const ebx = x + (fullW - ebarW) / 2;
    drawBar(ctx, ebx, y - 8, ebarW, e.hp / e.maxHp, e.isBoss ? "#ff5c6c" : "#ff8a5c");
    if (e.dotStacks > 0) {
      ctx.fillStyle = "#9c4dcc";
      ctx.fillRect(ebx, y - 12, Math.min(ebarW, e.dotStacks * 3), 2);
    }
    drawLabel(ctx, e.name, x + fullW / 2, y - 16, e.isBoss);
  });

  // Effects on top of everything.
  fx.draw(ctx);
}

/** Draw a sprite with a lunge/recoil offset and a centered "pop" scale. */
function drawSprite(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  name: string,
  x: number,
  y: number,
  baseScale: number,
  flip: boolean,
  off: { dx: number; dy: number; scale: number },
): void {
  const base = layout.unit * baseScale;
  const scaled = base * off.scale;
  const cx = x + off.dx - (scaled - base) / 2;
  const cy = y + off.dy - (scaled - base) / 2;
  layout.sheet.draw(ctx, name, cx, cy, baseScale * off.scale, flip);
}

/** Draw an enemy name centered at (cx) with a baseline at (y), with a shadow. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  isBoss: boolean,
): void {
  ctx.font = `${isBoss ? "12px" : "10px"} ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillText(text, cx + 1, y + 1);
  ctx.fillStyle = isBoss ? "#ffd45c" : "#f0e6d2";
  ctx.fillText(text, cx, y);
  ctx.textAlign = "left";
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  pct: number,
  color: string,
): void {
  const p = Math.max(0, Math.min(1, pct));
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * p, 3);
}
