import sheetUrl from "../assets/sprites.png";
import manifest from "../assets/sprites.json";

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class SpriteSheet {
  readonly cell: number;
  private img: HTMLImageElement | null = null;
  private frames: Record<string, Frame>;

  constructor() {
    this.cell = manifest.cell;
    this.frames = manifest.frames as Record<string, Frame>;
  }

  async load(): Promise<void> {
    this.img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = sheetUrl;
    });
  }

  has(name: string): boolean {
    return name in this.frames;
  }

  /** Draw a sprite with nearest-neighbor scaling, top-left at (dx, dy). */
  draw(
    ctx: CanvasRenderingContext2D,
    name: string,
    dx: number,
    dy: number,
    scale = 1,
    flip = false,
  ): void {
    const f = this.frames[name];
    if (!f || !this.img) return;
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.save();
      ctx.translate(dx + f.w * scale, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, f.x, f.y, f.w, f.h, 0, 0, f.w * scale, f.h * scale);
      ctx.restore();
    } else {
      ctx.drawImage(
        this.img,
        f.x,
        f.y,
        f.w,
        f.h,
        dx,
        dy,
        f.w * scale,
        f.h * scale,
      );
    }
  }

  /** Render a single sprite into a freshly-sized canvas (for DOM icons). */
  toCanvas(name: string, scale = 2): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    const f = this.frames[name];
    cv.width = (f?.w ?? this.cell) * scale;
    cv.height = (f?.h ?? this.cell) * scale;
    cv.style.imageRendering = "pixelated";
    const ctx = cv.getContext("2d")!;
    this.draw(ctx, name, 0, 0, scale);
    return cv;
  }
}

/** Sprite name for a class or enemy id. Enemy instance ids look like "rat#3". */
export function spriteForEnemy(enemyId: string): string {
  return enemyId.split("#")[0];
}
