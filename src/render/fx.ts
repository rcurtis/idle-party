import type { ProjectileKind, RunState } from "../core/types";
import type { Layout, Pt } from "./layout";

interface Payload {
  targetKey: string;
  targetSide: "party" | "enemy";
  amount: number;
  lethal: boolean;
  crit: boolean;
}

interface Projectile {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  arc: number;
  kind: ProjectileKind;
  payload?: Payload;
}

interface FloatText {
  x: number;
  y: number;
  t: number;
  dur: number;
  text: string;
  color: string;
  size: number;
}

interface Impact {
  x: number;
  y: number;
  t: number;
  dur: number;
  color: string;
  radius: number;
  parts: number;
  seed: number;
}

interface SlotFx {
  lungeT: number;
  lungeDur: number;
  lungeDir: number;
  reactT: number;
  reactDur: number;
  reactAmp: number;
}

const COLORS: Record<ProjectileKind, string> = {
  arrow: "#e6d2a0",
  magic: "#7fd0ff",
  shadow: "#c08bff",
  holy: "#ffe9a8",
  fire: "#ff9b4d",
  none: "#ffffff",
};

/** Visual effects layer. Holds transient animations driven by combat events. */
export class Fx {
  private projs: Projectile[] = [];
  private floats: FloatText[] = [];
  private impacts: Impact[] = [];
  private slots = new Map<string, SlotFx>();
  private seed = 1;

  private rnd(): number {
    // Tiny deterministic PRNG so particle bursts look varied but reproducible.
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Translate a frame's combat events into visual effects, then clear them. */
  ingest(run: RunState, layout: Layout): void {
    for (const ev of run.events) {
      if (ev.t === "attack") {
        const from = this.center(ev.from, run, layout);
        const to = this.center(ev.to, run, layout);
        const payload: Payload = {
          targetKey: key(ev.to.side, ev.to.index),
          targetSide: ev.to.side,
          amount: ev.amount,
          lethal: ev.lethal,
          crit: !!ev.crit,
        };
        if (ev.ranged) {
          this.spawnProjectile(from, to, ev.projectile, payload);
        } else {
          this.lunge(key(ev.from.side, ev.from.index), ev.from.side === "party" ? 1 : -1);
          this.resolveHit(to, payload);
        }
      } else if (ev.t === "heal") {
        const to = this.center(ev.to, run, layout);
        this.floats.push({
          x: to.x,
          y: to.y - 14,
          t: 0,
          dur: 0.9,
          text: "+" + Math.max(1, Math.round(ev.amount)),
          color: "#7dffa6",
          size: 15,
        });
        this.impacts.push(impact(to, "#7dffa6", 16, 5, this.rnd()));
      } else if (ev.t === "dot") {
        const to = this.center(ev.to, run, layout);
        this.floats.push({
          x: to.x + 10,
          y: to.y,
          t: 0,
          dur: 0.8,
          text: "" + Math.max(1, Math.round(ev.amount)),
          color: "#c89bff",
          size: 13,
        });
      } else if (ev.t === "cast") {
        const from = this.center(ev.from, run, layout);
        if (ev.ability === "taunt") {
          this.impacts.push(impact(from, "#6fd3ff", 30, 0, this.rnd()));
        } else if (ev.ability === "bigheal") {
          this.impacts.push(impact(from, "#ffe9a8", 34, 8, this.rnd()));
          for (const t of ev.targets) {
            this.impacts.push(
              impact(this.center(t, run, layout), "#ffe9a8", 14, 0, this.rnd()),
            );
          }
        } else if (ev.projectile !== "none") {
          for (const t of ev.targets) {
            this.spawnProjectile(from, this.center(t, run, layout), ev.projectile);
          }
        }
      }
    }
    run.events.length = 0;
  }

  private center(
    ref: { side: "party" | "enemy"; index: number },
    run: RunState,
    layout: Layout,
  ): Pt {
    if (ref.side === "party") return layout.partyCenter(ref.index);
    const e = run.enemies[ref.index];
    return e
      ? layout.enemyCenter(ref.index, e)
      : { x: layout.W - 150, y: layout.baseY };
  }

  private spawnProjectile(
    from: Pt,
    to: Pt,
    kind: ProjectileKind,
    payload?: Payload,
  ): void {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.projs.push({
      sx: from.x,
      sy: from.y,
      tx: to.x,
      ty: to.y,
      t: 0,
      dur: Math.max(0.12, Math.min(0.32, dist / 1600)),
      arc: kind === "arrow" ? dist * 0.14 : dist * 0.05,
      kind,
      payload,
    });
  }

  private lunge(slotKey: string, dir: number): void {
    const s = this.slot(slotKey);
    s.lungeT = 0;
    s.lungeDur = 0.22;
    s.lungeDir = dir;
  }

  /** Number + impact burst + target recoil when a hit lands. */
  private resolveHit(at: Pt, p: Payload): void {
    const enemy = p.targetSide === "enemy";
    if (p.amount > 0) {
      this.floats.push({
        x: at.x + (this.rnd() - 0.5) * 14,
        y: at.y - 6,
        t: 0,
        dur: p.crit ? 1.0 : 0.8,
        text: "" + Math.max(1, Math.round(p.amount)),
        color: p.crit ? "#ffe14d" : enemy ? "#ffd9a0" : "#ff7a7a",
        size: p.crit ? 22 : 16,
      });
    }
    const col = enemy ? (p.crit ? "#ffe14d" : "#ffd27a") : "#ff7a7a";
    this.impacts.push(
      impact(at, col, p.lethal ? 34 : p.crit ? 26 : 18, p.lethal ? 10 : 5, this.rnd()),
    );
    const s = this.slot(p.targetKey);
    s.reactT = 0;
    s.reactDur = 0.22;
    s.reactAmp = p.lethal ? 5 : 3;
  }

  private slot(k: string): SlotFx {
    let s = this.slots.get(k);
    if (!s) {
      s = { lungeT: 99, lungeDur: 0, lungeDir: 1, reactT: 99, reactDur: 0, reactAmp: 0 };
      this.slots.set(k, s);
    }
    return s;
  }

  /** Per-sprite offset/scale for lunge + hit recoil. */
  slotOffset(slotKey: string): { dx: number; dy: number; scale: number } {
    const s = this.slots.get(slotKey);
    if (!s) return { dx: 0, dy: 0, scale: 1 };
    let dx = 0;
    let dy = 0;
    let scale = 1;
    if (s.lungeT < s.lungeDur) {
      const p = s.lungeT / s.lungeDur;
      dx += s.lungeDir * 14 * Math.sin(p * Math.PI);
    }
    if (s.reactT < s.reactDur) {
      const p = s.reactT / s.reactDur;
      dx += Math.sin(p * Math.PI * 6) * s.reactAmp * (1 - p);
      scale = 1 + 0.18 * Math.sin(p * Math.PI);
      dy -= 2 * Math.sin(p * Math.PI);
    }
    return { dx, dy, scale };
  }

  update(dt: number): void {
    for (const p of this.projs) p.t += dt;
    // Resolve arrivals.
    for (const p of this.projs) {
      if (p.t >= p.dur && !(p as { done?: boolean }).done) {
        (p as { done?: boolean }).done = true;
        if (p.payload) this.resolveHit({ x: p.tx, y: p.ty }, p.payload);
        else this.impacts.push(impact({ x: p.tx, y: p.ty }, COLORS[p.kind], 16, 4, this.rnd()));
      }
    }
    this.projs = this.projs.filter((p) => !(p as { done?: boolean }).done);
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < f.dur);
    for (const im of this.impacts) im.t += dt;
    this.impacts = this.impacts.filter((im) => im.t < im.dur);
    for (const s of this.slots.values()) {
      s.lungeT += dt;
      s.reactT += dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Impacts (rings + particles).
    for (const im of this.impacts) {
      const p = im.t / im.dur;
      const a = 1 - p;
      ctx.globalAlpha = a;
      ctx.strokeStyle = im.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(im.x, im.y, im.radius * (0.3 + p), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = im.color;
      for (let k = 0; k < im.parts; k++) {
        const ang = (k / im.parts) * Math.PI * 2 + im.seed * 6.28;
        const d = im.radius * (0.4 + p * 1.1);
        const px = im.x + Math.cos(ang) * d;
        const py = im.y + Math.sin(ang) * d;
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
    }
    ctx.globalAlpha = 1;

    // Projectiles.
    for (const p of this.projs) {
      const u = Math.min(1, p.t / p.dur);
      const x = p.sx + (p.tx - p.sx) * u;
      const y = p.sy + (p.ty - p.sy) * u - Math.sin(u * Math.PI) * p.arc;
      this.drawProjectile(ctx, p, x, y);
    }

    // Floating numbers.
    ctx.textAlign = "center";
    for (const f of this.floats) {
      const p = f.t / f.dur;
      ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.font = `bold ${f.size}px ui-monospace, monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      const yy = f.y - p * 26;
      ctx.strokeText(f.text, f.x, yy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, yy);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    p: Projectile,
    x: number,
    y: number,
  ): void {
    const color = COLORS[p.kind];
    if (p.kind === "arrow") {
      const ang = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(5, -3);
      ctx.lineTo(5, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    // Glowing orb (magic / shadow / holy / fire).
    const r = 7;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function impact(at: Pt, color: string, radius: number, parts: number, seed: number): Impact {
  return { x: at.x, y: at.y, t: 0, dur: 0.3, color, radius, parts, seed };
}

function key(side: "party" | "enemy", index: number): string {
  return `${side}:${index}`;
}
