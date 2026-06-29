import { topBar, type App } from "../app";
import { ALL_CLASS_IDS, CLASSES } from "../core/characters";
import { DUNGEON_ORDER, getDungeon } from "../core/dungeons";
import { recruit } from "../core/economy";
import { el, fmt } from "./dom";

const ROLE_LABEL: Record<string, string> = {
  tank: "Tank",
  healer: "Healer",
  dps: "DPS",
};

export function renderTavern(app: App): HTMLElement {
  const save = app.save;

  // --- Party roster ---
  const rosterCards = save.roster.map((id) => {
    const def = CLASSES[id];
    const icon = app.sheet.toCanvas(id, 3);
    icon.className = "card-icon";
    return el("div", { class: `unit-card role-${def.role}` }, [
      icon,
      el("div", { class: "unit-info" }, [
        el("div", { class: "unit-name" }, [def.name]),
        el("div", { class: `unit-role ${def.role}` }, [ROLE_LABEL[def.role]]),
        el("div", { class: "unit-blurb" }, [def.blurb]),
      ]),
    ]);
  });

  // --- Recruitable classes ---
  const recruitable = ALL_CLASS_IDS.filter(
    (id) => !save.roster.includes(id),
  ).map((id) => {
    const def = CLASSES[id];
    const icon = app.sheet.toCanvas(id, 3);
    icon.className = "card-icon dim";
    const affordable = save.gold >= def.recruitCost;
    return el("div", { class: "unit-card recruit" }, [
      icon,
      el("div", { class: "unit-info" }, [
        el("div", { class: "unit-name" }, [def.name]),
        el("div", { class: `unit-role ${def.role}` }, [ROLE_LABEL[def.role]]),
        el("div", { class: "unit-blurb" }, [def.blurb]),
      ]),
      el(
        "button",
        {
          class: "recruit-btn" + (affordable ? "" : " disabled"),
          disabled: !affordable,
          onclick: () => {
            const r = recruit(app.save, id);
            if (r.ok) app.setSave(r.save);
          },
        },
        [`Recruit · ${fmt(def.recruitCost)}🪙`],
      ),
    ]);
  });

  // --- Dungeons ---
  const dungeonCards = DUNGEON_ORDER.map((id) => {
    const def = getDungeon(id);
    const unlocked = save.unlockedDungeons.includes(id);
    const beaten = save.bossesDefeated.includes(id);
    return el("div", { class: "dungeon-card" + (unlocked ? "" : " locked") }, [
      el("div", { class: "dungeon-name" }, [
        def.name,
        beaten ? el("span", { class: "beaten-tag" }, [" ✓ cleared"]) : "",
      ]),
      el("div", { class: "dungeon-meta" }, [
        `${def.levels.length} levels · boss · ${def.goldMultiplier}× gold`,
      ]),
      unlocked
        ? el(
            "button",
            {
              class: "primary-btn",
              onclick: () => app.startDungeon(id),
            },
            ["Enter"],
          )
        : el("div", { class: "locked-hint" }, ["🔒 Defeat the previous boss"]),
    ]);
  });

  // --- Settings footer ---
  const autocast = el(
    "label",
    { class: "toggle" },
    [
      el("input", {
        type: "checkbox",
        ...(save.settings.autoCastAbilities ? { checked: true } : {}),
        onchange: (e: Event) => {
          const checked = (e.target as HTMLInputElement).checked;
          app.setSave({
            ...app.save,
            settings: { ...app.save.settings, autoCastAbilities: checked },
          });
        },
      }),
      " Auto-cast abilities",
    ],
  );
  const resetBtn = el(
    "button",
    {
      class: "ghost-btn danger",
      onclick: () => {
        if (confirm("Wipe all progress and start over?")) app.hardReset();
      },
    },
    ["Reset Save"],
  );

  return el("main", { class: "screen tavern" }, [
    topBar(app, "tavern"),
    el("div", { class: "tavern-body" }, [
      el("section", {}, [
        el("h2", {}, ["Your Party"]),
        el("div", { class: "card-grid" }, rosterCards),
      ]),
      recruitable.length
        ? el("section", {}, [
            el("h2", {}, ["Recruit"]),
            el("p", { class: "section-hint" }, [
              "Spend gold to bring new adventurers into your party.",
            ]),
            el("div", { class: "card-grid" }, recruitable),
          ])
        : "",
      el("section", {}, [
        el("h2", {}, ["Dungeons"]),
        el("div", { class: "card-grid dungeons" }, dungeonCards),
      ]),
      el("footer", { class: "tavern-footer" }, [autocast, resetBtn]),
    ]),
  ]);
}
