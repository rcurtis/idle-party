import type { Enemy } from "../core/types";
import type { SpriteSheet } from "./spritesheet";

export const SCALE = 3;

export interface Pt {
  x: number;
  y: number;
}

/**
 * Shared geometry for the dungeon arena so the scene renderer and the FX layer
 * place combatants and projectiles at exactly the same coordinates. Positions
 * are keyed by a combatant's *stable* index within run.party / run.enemies.
 */
export class Layout {
  readonly unit: number; // source sprite size (px)
  readonly cell: number; // on-screen sprite size (px)
  readonly floorY: number;
  readonly baseY: number;

  constructor(
    readonly sheet: SpriteSheet,
    readonly W: number,
    readonly H: number,
  ) {
    this.unit = sheet.cell;
    this.cell = sheet.cell * SCALE;
    this.floorY = H - this.cell;
    this.baseY = this.floorY - this.cell + 4;
  }

  partyX(i: number): number {
    return 30 + i * (this.cell - 10);
  }
  partyTopY(): number {
    return this.baseY;
  }
  partyCenter(i: number): Pt {
    return { x: this.partyX(i) + this.cell / 2, y: this.baseY + this.cell / 2 };
  }

  enemyScale(e: Enemy): number {
    return SCALE * (e.isBoss ? 1.7 : 1);
  }
  enemyX(i: number, e: Enemy): number {
    const big = e.isBoss ? 1.7 : 1;
    return this.W - 150 - i * (this.cell - 4) - (big - 1) * this.unit * SCALE;
  }
  enemyTopY(e: Enemy): number {
    const big = e.isBoss ? 1.7 : 1;
    return this.baseY - (big - 1) * this.unit * SCALE;
  }
  enemyCenter(i: number, e: Enemy): Pt {
    const sz = this.unit * this.enemyScale(e);
    return { x: this.enemyX(i, e) + sz / 2, y: this.enemyTopY(e) + sz / 2 };
  }
}
