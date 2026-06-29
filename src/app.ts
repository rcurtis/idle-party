import { loadSave, persistSave, newSave } from "./core/save";
import { startRun, stepRun, manualCast } from "./core/combat";
import { bankRun, type BankResult } from "./core/game";
import type { RunState, SaveState } from "./core/types";
import { SpriteSheet } from "./render/spritesheet";
import { el, clear } from "./ui/dom";
import { renderTavern } from "./ui/tavern";
import { renderSkillTree } from "./ui/skilltree";
import { DungeonView } from "./ui/dungeon";

export type Screen = "tavern" | "skilltree" | "dungeon";

const SIM_DT = 0.1; // fixed simulation timestep (seconds)

export class App {
  save: SaveState;
  sheet: SpriteSheet;
  root: HTMLElement;
  screen: Screen = "tavern";

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
  }

  persist(): void {
    persistSave(this.save);
  }

  setSave(save: SaveState): void {
    this.save = save;
    this.persist();
    this.render();
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

  /** Called when a run reaches won/wiped: bank rewards into the save. */
  private resolveRun(): void {
    if (!this.run || this.run.resolved) return;
    this.lastResult = bankRun(this.save, this.run);
    this.save = this.lastResult.save;
    this.persist();
  }

  leaveRun(): void {
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
    const content =
      this.screen === "skilltree" ? renderSkillTree(this) : renderTavern(this);
    this.root.append(content);
  }
}

/** Shared top bar with currencies and navigation. */
export function topBar(app: App, active: Screen): HTMLElement {
  const navBtn = (label: string, screen: Screen) =>
    el(
      "button",
      {
        class: "nav-btn" + (active === screen ? " active" : ""),
        onclick: () => app.go(screen),
      },
      [label],
    );
  return el("header", { class: "topbar" }, [
    el("div", { class: "brand" }, ["⚔ Idle Party"]),
    el("div", { class: "currencies" }, [
      el("span", { class: "coin-amt", title: "Gold" }, [
        "🪙 " + Math.floor(app.save.gold).toLocaleString(),
      ]),
      el("span", { class: "sigil-amt", title: "Sigils" }, [
        "🔹 " + app.save.sigils,
      ]),
    ]),
    el("nav", {}, [navBtn("Tavern", "tavern"), navBtn("Skill Tree", "skilltree")]),
  ]);
}
