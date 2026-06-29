import { loadSave, persistSave, newSave } from "./core/save";
import { startRun, stepRun, manualCast } from "./core/combat";
import { buyNode as buyNodeCore } from "./core/economy";
import { bankRun, type BankResult } from "./core/game";
import type { RunState, SaveState } from "./core/types";
import { SpriteSheet } from "./render/spritesheet";
import { Sfx } from "./render/sfx";
import { clear } from "./ui/dom";
import { renderHub } from "./ui/hub";
import { DungeonView } from "./ui/dungeon";

export type Screen = "tavern" | "dungeon";

const SIM_DT = 0.1; // fixed simulation timestep (seconds)

export class App {
  save: SaveState;
  sheet: SpriteSheet;
  root: HTMLElement;
  screen: Screen = "tavern";
  sfx = new Sfx();

  run: RunState | null = null;
  speed = 2;
  paused = false;
  lastResult: BankResult | null = null;

  private dungeonView: DungeonView | null = null;
  private acc = 0;
  private lastT = 0;
  private looping = false;

  constructor(root: HTMLElement, sheet: SpriteSheet) {
    this.root = root;
    this.sheet = sheet;
    this.save = loadSave();
    this.sfx.muted = !this.save.settings.soundEnabled;
  }

  persist(): void {
    persistSave(this.save);
  }

  setSave(save: SaveState): void {
    this.save = save;
    this.sfx.muted = !save.settings.soundEnabled;
    this.persist();
    this.render();
  }

  /** Toggle combat sound on/off (persisted) and re-render the controls. */
  toggleSound(): void {
    const soundEnabled = !this.save.settings.soundEnabled;
    this.setSave({
      ...this.save,
      settings: { ...this.save.settings, soundEnabled },
    });
  }

  go(screen: Screen): void {
    this.screen = screen;
    this.render();
  }

  hardReset(): void {
    this.save = newSave();
    this.run = null;
    this.lastResult = null;
    this.persist();
    this.go("tavern");
  }

  // --- run lifecycle -------------------------------------------------------
  startDungeon(dungeonId: string): void {
    const seed = (Math.floor(performance.now()) % 100000) + 1;
    this.run = startRun(this.save, dungeonId, seed);
    this.lastResult = null;
    this.paused = false;
    this.screen = "dungeon";
    this.render();
    this.ensureLoop();
  }

  togglePause(): void {
    this.paused = !this.paused;
    if (!this.paused) this.ensureLoop();
  }

  castAbility(classId: string): void {
    if (this.run) manualCast(this.run, classId);
  }

  /** Buy/recruit/unlock a skill-graph node; re-renders on success. */
  buyNode(nodeId: string): boolean {
    const r = buyNodeCore(this.save, nodeId);
    if (r.ok) this.setSave(r.save);
    return r.ok;
  }

  /** Called when a run reaches won/wiped: bank rewards into the save. */
  private resolveRun(): void {
    if (!this.run || this.run.resolved) return;
    this.lastResult = bankRun(this.save, this.run);
    this.save = this.lastResult.save;
    this.persist();
  }

  leaveRun(): void {
    // Fleeing banks whatever gold was collected this run (same as a wipe),
    // so the player can always cash out — important early when the lone tank
    // is too tanky to die but too slow to clear.
    if (this.run && !this.run.resolved) this.resolveRun();
    this.run = null;
    this.dungeonView = null;
    this.go("tavern");
  }

  // --- main loop -----------------------------------------------------------
  start(): void {
    this.render();
    if (import.meta.env.DEV) {
      const w = window as unknown as {
        __game: App;
        __shoot: (name?: string) => Promise<string>;
      };
      w.__game = this;
      // Save the current canvas to .inspect/<name>.png via the dev sink.
      w.__shoot = async (name = "shot") => {
        const cv = document.querySelector("canvas.scene") as HTMLCanvasElement | null;
        if (!cv) return "no canvas on screen";
        await fetch(`/__shot?name=${encodeURIComponent(name)}`, {
          method: "POST",
          body: cv.toDataURL("image/png"),
        });
        return `saved .inspect/${name}.png`;
      };
    }
    this.ensureLoop();
  }

  /** Start the rAF loop if not already running. Self-suspends when idle. */
  private ensureLoop(): void {
    if (this.looping) return;
    this.looping = true;
    this.lastT = performance.now();
    const frame = (t: number) => {
      const dtReal = Math.min(0.25, (t - this.lastT) / 1000);
      this.lastT = t;
      this.tick(dtReal);
      // Keep looping only while a run is actively progressing.
      const active =
        this.screen === "dungeon" &&
        !!this.run &&
        (this.run.phase === "fighting" || this.run.phase === "advancing") &&
        !this.paused;
      if (active) {
        requestAnimationFrame(frame);
      } else {
        this.looping = false;
      }
    };
    requestAnimationFrame(frame);
  }

  /** Dev/test hook: advance real-time by `seconds` regardless of rAF. */
  debugAdvance(seconds: number): void {
    this.tick(seconds);
  }

  private tick(dtReal: number): void {
    if (this.screen === "dungeon" && this.run) {
      const fighting = this.run.phase === "fighting" || this.run.phase === "advancing";
      if (fighting && !this.paused) {
        this.acc += dtReal * this.speed;
        let steps = 0;
        while (this.acc >= SIM_DT && steps < 200) {
          stepRun(this.run, SIM_DT, {
            autoCast: this.save.settings.autoCastAbilities,
          });
          this.acc -= SIM_DT;
          steps++;
          if (this.run.phase === "won" || this.run.phase === "wiped") break;
        }
      }
      if (
        (this.run.phase === "won" || this.run.phase === "wiped") &&
        !this.run.resolved
      ) {
        this.resolveRun();
      }
      this.dungeonView?.update(dtReal);
    }
  }

  // --- rendering -----------------------------------------------------------
  render(): void {
    clear(this.root);
    this.dungeonView = null;
    if (this.screen === "dungeon" && this.run) {
      this.dungeonView = new DungeonView(this);
      this.root.append(this.dungeonView.mount());
      return;
    }
    this.root.append(renderHub(this));
  }
}
