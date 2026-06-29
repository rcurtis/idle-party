import { topBar, type App } from "../app";
import { CLASSES } from "../core/characters";
import { canPurchase, nodeCost, purchaseNode, unlockWing } from "../core/economy";
import { WINGS } from "../core/skilltree";
import type { ClassId, SkillNode, StatKey } from "../core/types";
import { el, fmt } from "./dom";

const STAT_LABEL: Record<StatKey, string> = {
  maxHp: "Max HP",
  attack: "Attack",
  attackInterval: "Atk Speed",
  armor: "Armor",
  threat: "Threat",
  healPower: "Heal Power",
  abilityPower: "Ability Power",
  abilityCooldown: "Cooldown",
};

function targetLabel(t: ClassId | "party"): string {
  return t === "party" ? "Party" : CLASSES[t].name;
}

function describeEffect(node: SkillNode): string {
  const e = node.effect;
  const who = targetLabel(e.target);
  if (e.op === "add") {
    if (e.stat === "armor") return `+${Math.round(e.value * 100)}% ${STAT_LABEL.armor} (${who})`;
    return `+${e.value} ${STAT_LABEL[e.stat]} (${who})`;
  }
  // multiplicative
  const pct = Math.round((e.value - 1) * 100);
  const sign = pct >= 0 ? "+" : "";
  // For interval/cooldown a reduction is good; show as faster.
  if (e.stat === "attackInterval" || e.stat === "abilityCooldown") {
    return `${Math.round((1 - e.value) * 100)}% faster ${STAT_LABEL[e.stat]} (${who})`;
  }
  return `${sign}${pct}% ${STAT_LABEL[e.stat]} (${who})`;
}

export function renderSkillTree(app: App): HTMLElement {
  const save = app.save;

  const wingPanels = WINGS.map((wing) => {
    const isLocked = wing.sigilCost > 0 && !save.unlockedWings.includes(wing.id);

    const header = el("div", { class: "wing-header" }, [
      el("h3", {}, [wing.name.replace(" (Locked)", "")]),
      isLocked
        ? el(
            "button",
            {
              class:
                "unlock-btn" + (save.sigils >= wing.sigilCost ? "" : " disabled"),
              disabled: save.sigils < wing.sigilCost,
              onclick: () => {
                const r = unlockWing(app.save, wing.id);
                if (r.ok) app.setSave(r.save);
              },
            },
            [`🔒 Unlock · ${wing.sigilCost}🔹`],
          )
        : "",
    ]);

    const nodes = wing.nodes.map((node) => {
      const ranks = save.purchased[node.id] ?? 0;
      const maxed = ranks >= node.maxRanks;
      const cost = nodeCost(save, node.id);
      const available = canPurchase(save, node.id);
      const affordable = save.gold >= cost;
      const needsClass =
        node.effect.target !== "party" &&
        !save.roster.includes(node.effect.target);

      let hint = "";
      if (isLocked) hint = "Wing locked";
      else if (needsClass) hint = `Recruit ${targetLabel(node.effect.target)} first`;
      else if (node.requires.length && !available && !maxed)
        hint = "Requires earlier node";

      return el(
        "div",
        { class: "node" + (maxed ? " maxed" : "") + (isLocked ? " dim" : "") },
        [
          el("div", { class: "node-top" }, [
            el("span", { class: "node-name" }, [node.name]),
            el("span", { class: "node-rank" }, [`${ranks}/${node.maxRanks}`]),
          ]),
          el("div", { class: "node-eff" }, [describeEffect(node)]),
          maxed
            ? el("div", { class: "node-maxed" }, ["MAX"])
            : el(
                "button",
                {
                  class:
                    "buy-btn" +
                    (available && affordable && !isLocked ? "" : " disabled"),
                  disabled: !(available && affordable && !isLocked),
                  onclick: () => {
                    const r = purchaseNode(app.save, node.id);
                    if (r.ok) app.setSave(r.save);
                  },
                },
                [hint ? hint : `Buy · ${fmt(cost)}🪙`],
              ),
        ],
      );
    });

    return el(
      "div",
      { class: "wing" + (isLocked ? " locked" : "") },
      [header, el("div", { class: "wing-nodes" }, nodes)],
    );
  });

  return el("main", { class: "screen skilltree" }, [
    topBar(app, "skilltree"),
    el("div", { class: "tree-body" }, [
      el("p", { class: "section-hint" }, [
        "Spend gold to upgrade your party. Defeat dungeon bosses to earn Sigils 🔹 that unlock the locked wings.",
      ]),
      el("div", { class: "wing-grid" }, wingPanels),
    ]),
  ]);
}
