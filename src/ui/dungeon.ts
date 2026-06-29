import type { App } from "../app";
import { getDungeon } from "../core/dungeons";
import type { Combatant } from "../core/types";
import { drawScene } from "../render/scene";
import { Layout } from "../render/layout";
import { Fx } from "../render/fx";
import { el, fmt } from "./dom";

const CANVAS_W = 760;
const CANVAS_H = 320;

export class DungeonView {
  private app: App;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private layout!: Layout;
  private fx = new Fx();
  private frame = 0;

  private levelEl!: HTMLElement;
  private goldEl!: HTMLElement;
  private logEl!: HTMLElement;
  private abilityRow!: HTMLElement;
  private overlay!: HTMLElement;
  private abilityBtns = new Map<string, HTMLButtonElement>();
  private resultsShown = false;

  constructor(app: App) {
    this.app = app;
  }

  mount(): HTMLElement {
    const app = this.app;
    const run = app.run!;
    const dungeon = getDungeon(run.dungeonId);

    this.canvas = el("canvas", { width: CANVAS_W, height: CANVAS_H, class: "scene" });
    this.ctx = this.canvas.getContext("2d")!;
    this.layout = new Layout(app.sheet, CANVAS_W, CANVAS_H, run.party.length);

    this.levelEl = el("span", { class: "run-stat" }, []);
    this.goldEl = el("span", { class: "run-stat gold" }, []);

    const speedBtn = (mult: number) =>
      el(
        "button",
        {
          class: "speed-btn" + (app.speed === mult ? " active" : ""),
          onclick: (e: Event) => {
            app.speed = mult;
            (e.currentTarget as HTMLElement)
              .parentElement?.querySelectorAll(".speed-btn")
              .forEach((b) => b.classList.remove("active"));
            (e.currentTarget as HTMLElement).classList.add("active");
          },
        },
        [`${mult}×`],
      );

    const controls = el("div", { class: "run-controls" }, [
      this.levelEl,
      this.goldEl,
      el("div", { class: "spacer" }, []),
      speedBtn(1),
      speedBtn(2),
      speedBtn(4),
      el(
        "button",
        {
          class: "ghost-btn",
          title: app.save.settings.soundEnabled ? "Mute sound" : "Unmute sound",
          onclick: () => app.toggleSound(),
        },
        [app.save.settings.soundEnabled ? "🔊" : "🔇"],
      ),
      el(
        "button",
        { class: "ghost-btn", onclick: () => app.togglePause() },
        ["⏯"],
      ),
      el("button", { class: "ghost-btn flee", onclick: () => app.leaveRun() }, [
        "Flee",
      ]),
    ]);

    this.abilityRow = el("div", { class: "ability-row" }, []);
    this.buildAbilityButtons(run.party);

    this.logEl = el("div", { class: "run-log" }, []);
    this.overlay = el("div", { class: "results-overlay hidden" }, []);

    return el("div", { class: "dungeon-screen" }, [
      el("div", { class: "dungeon-title" }, [
        dungeon.name,
        el("span", { class: "muted" }, [" — fight on!"]),
      ]),
      el("div", { class: "scene-wrap" }, [this.canvas, this.overlay]),
      controls,
      this.abilityRow,
      this.logEl,
    ]);
  }

  private buildAbilityButtons(party: Combatant[]): void {
    this.abilityRow.replaceChildren();
    this.abilityBtns.clear();
    for (const c of party) {
      const icon = this.app.sheet.toCanvas(c.classId, 2);
      icon.className = "ab-icon";
      const btn = el(
        "button",
        {
          class: "ability-btn",
          onclick: () => this.app.castAbility(c.classId),
          title: `${c.name}: ${c.ability.name}`,
        },
        [
          icon,
          el("span", { class: "ab-cd" }, []),
          el("span", { class: "ab-name" }, [c.ability.name]),
        ],
      ) as HTMLButtonElement;
      this.abilityBtns.set(c.classId, btn);
      this.abilityRow.append(btn);
    }
  }

  update(dt = 0): void {
    const run = this.app.run;
    if (!run) return;
    this.frame++;
    this.app.sfx.ingest(run); // sound first — Fx.ingest clears run.events
    this.fx.ingest(run, this.layout);
    this.fx.update(dt);
    drawScene(this.ctx, run, this.layout, this.fx, this.frame);

    this.levelEl.textContent =
      run.enemies.length && run.phase !== "advancing"
        ? `Level ${run.levelIndex + 1}`
        : `Level ${run.levelIndex + 1}`;
    // Live total gold: banked gold plus what's been collected this run so far.
    // Once the run resolves, goldEarned is folded into save.gold, so stop
    // adding it to avoid double-counting on the results screen.
    const liveGold = this.app.save.gold + (run.resolved ? 0 : run.goldEarned);
    this.goldEl.textContent = `🪙 ${fmt(liveGold)}`;

    // Ability cooldown overlays.
    for (const c of run.party) {
      const btn = this.abilityBtns.get(c.classId);
      if (!btn) continue;
      const cd = btn.querySelector(".ab-cd") as HTMLElement;
      const locked = !c.abilityUnlocked;
      const ready = c.alive && !locked && c.abilityTimer <= 0;
      btn.classList.toggle("ready", ready);
      btn.classList.toggle("dead", !c.alive);
      btn.classList.toggle("locked", locked);
      btn.disabled = !ready;
      btn.title = locked
        ? `${c.name}: ${c.ability.name} — unlock in the skill tree`
        : `${c.name}: ${c.ability.name}`;
      cd.textContent = !c.alive
        ? "✖"
        : locked
          ? "🔒"
          : c.abilityTimer > 0
            ? c.abilityTimer.toFixed(1)
            : "●";
    }

    // Log (last few lines).
    const lines = run.log.slice(-6);
    if (this.logEl.childElementCount !== lines.length || this.frame % 6 === 0) {
      this.logEl.replaceChildren(
        ...lines.map((l) => el("div", { class: "log-line" }, [l])),
      );
    }

    if (
      (run.phase === "won" || run.phase === "wiped") &&
      run.resolved &&
      !this.resultsShown
    ) {
      this.showResults();
    }
  }

  private showResults(): void {
    this.resultsShown = true;
    const app = this.app;
    const run = app.run!;
    const res = app.lastResult;
    const won = run.phase === "won";

    const lines: (Node | string)[] = [
      el("h2", { class: won ? "win" : "lose" }, [
        won ? "Dungeon Cleared!" : "The Party Has Fallen",
      ]),
      el("p", {}, [`Gold collected: ${fmt(run.goldEarned)} 🪙`]),
    ];
    if (run.sigilsEarned > 0) {
      lines.push(el("p", { class: "sigil" }, [`Sigils earned: ${run.sigilsEarned} 🔹`]));
    }
    if (res?.firstBossKill) {
      lines.push(
        el("p", { class: "unlock" }, ["★ First boss defeated! A skill-tree wing can now be unlocked with a Sigil."]),
      );
    }
    if (res?.newDungeon) {
      lines.push(
        el("p", { class: "unlock" }, [
          `★ New dungeon unlocked: ${getDungeon(res.newDungeon).name}!`,
        ]),
      );
    }

    lines.push(
      el("div", { class: "result-actions" }, [
        el(
          "button",
          {
            class: "primary-btn",
            onclick: () => app.startDungeon(run.dungeonId),
          },
          ["Run Again"],
        ),
        el(
          "button",
          { class: "ghost-btn", onclick: () => app.leaveRun() },
          ["Return to Tavern"],
        ),
      ]),
    );

    this.overlay.replaceChildren(el("div", { class: "results-card" }, lines));
    this.overlay.classList.remove("hidden");
  }
}
