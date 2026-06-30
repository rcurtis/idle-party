import type { App } from "../app";
import { CLASSES } from "../core/characters";
import { resolveStats } from "../core/stats";
import { nodeStatus } from "../core/economy";
import { DUNGEON_ORDER, getDungeon } from "../core/dungeons";
import {
  WINGS,
  GRAPH_W,
  GRAPH_H,
  allNodes,
  getWing,
  getNode,
} from "../core/skilltree";
import type { ClassId, SaveState, SkillNode, StatKey } from "../core/types";
import { el, svgEl, fmt } from "./dom";

const NODE = 54; // node box size (px)

const STAT_LABEL: Record<StatKey, string> = {
  maxHp: "HP",
  attack: "DMG",
  attackInterval: "SPD",
  armor: "ARM",
  threat: "THR",
  healPower: "HEAL",
  abilityPower: "AP",
  abilityCooldown: "CD",
};

const STAT_NAME: Record<StatKey, string> = {
  maxHp: "Max HP",
  attack: "Attack",
  attackInterval: "Atk Speed",
  armor: "Armor",
  threat: "Threat",
  healPower: "Heal Power",
  abilityPower: "Ability Power",
  abilityCooldown: "Cooldown",
};

/** Colour family for a node, from its class/wing. */
function nodeFamily(node: SkillNode, wingId: string): string {
  const cls = node.recruit ?? node.unlock?.target ?? node.effect?.target;
  if (cls && cls !== "party") {
    const role = CLASSES[cls as ClassId].role;
    return role; // tank | healer | dps
  }
  if (node.unlockWing || wingId === "bulwark" || wingId === "ascendant") {
    return "locked";
  }
  return "party";
}

function statLabel(node: SkillNode): string {
  if (node.unlockWing) return "WING";
  if (node.unlock) return "WALL"; // ability unlock (Iron Wall)
  if (node.effect) return STAT_LABEL[node.effect.stat];
  return "?";
}

function effectText(node: SkillNode): string {
  const e = node.effect;
  if (!e) return node.unlock?.desc ?? "";
  if (e.op === "add") {
    if (e.stat === "armor") return `+${Math.round(e.value * 100)}% Armor / rank`;
    return `+${e.value} ${STAT_NAME[e.stat]} / rank`;
  }
  if (e.stat === "attackInterval" || e.stat === "abilityCooldown") {
    return `${Math.round((1 - e.value) * 100)}% faster ${STAT_NAME[e.stat]} / rank`;
  }
  return `+${Math.round((e.value - 1) * 100)}% ${STAT_NAME[e.stat]} / rank`;
}

export function renderHub(app: App): HTMLElement {
  const save = app.save;

  // Resolve all node states once.
  const statuses = new Map(allNodes().map(({ node }) => [node.id, nodeStatus(save, node.id)]));
  const posOf = (id: string) => allNodes().find((n) => n.node.id === id)?.node.pos;

  // --- Header ---
  const header = el("header", { class: "hub-topbar" }, [
    el("div", { class: "brand" }, ["⚔ Idle Party"]),
    el("div", { class: "currencies" }, [
      el("span", { class: "coin-amt", title: "Gold" }, ["🪙 " + fmt(save.gold)]),
      el("span", { class: "sigil-amt", title: "Sigils" }, ["🔹 " + save.sigils]),
    ]),
    el(
      "button",
      { class: "expedition-btn", onclick: () => overlay.classList.remove("hidden") },
      ["▶ Expedition"],
    ),
  ]);

  // --- Tooltip (single, repositioned on hover) ---
  const tip = el("div", { class: "node-tip hidden" }, []);

  // --- Wires (SVG) ---
  const wires = svgEl("svg", {
    class: "wires",
    width: GRAPH_W,
    height: GRAPH_H,
    viewBox: `0 0 ${GRAPH_W} ${GRAPH_H}`,
  });
  for (const { node } of allNodes()) {
    const from = node.pos;
    if (!from || !node.links) continue;
    for (const tgtId of node.links) {
      const to = posOf(tgtId);
      if (!to) continue;
      const lit = statuses.get(node.id)?.owned || statuses.get(tgtId)?.owned;
      wires.append(
        svgEl("line", {
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          class: "wire" + (lit ? " lit" : ""),
        }),
      );
    }
  }

  // --- Nodes ---
  const nodeEls: HTMLElement[] = [];
  for (const { node, wing } of allNodes()) {
    if (!node.pos) continue;
    const st = statuses.get(node.id)!;
    const fam = nodeFamily(node, wing.id);

    let state = "locked";
    if (st.maxed || (st.kind !== "stat" && st.owned)) state = "owned";
    else if (st.canBuy) state = "buyable";
    else if (st.available) state = "available";

    const body: (Node | string)[] = [];
    if (node.recruit) {
      const icon = app.sheet.toCanvas(node.recruit, 2);
      icon.className = "gnode-icon";
      body.push(icon);
    } else {
      body.push(el("span", { class: "gnode-label" }, [statLabel(node)]));
    }

    const children: (Node | string)[] = [el("div", { class: "gnode-body" }, body)];
    // Rank pips / count for multi-rank stat nodes.
    if (st.kind === "stat" && node.maxRanks > 1) {
      if (node.maxRanks <= 6) {
        children.push(
          el(
            "div",
            { class: "gnode-pips" },
            Array.from({ length: node.maxRanks }, (_, i) =>
              el("span", { class: "pip" + (i < st.ranks ? " on" : "") }, []),
            ),
          ),
        );
      } else {
        children.push(
          el("div", { class: "gnode-count" }, [`${st.ranks}/${node.maxRanks}`]),
        );
      }
    }

    // Lock badge + dimmed portrait for not-yet-unlocked recruits / wing gates.
    const showLock = (node.recruit || node.unlockWing) && !st.owned;
    if (showLock) children.push(el("span", { class: "gnode-lock" }, ["🔒"]));
    const lockClass = node.recruit && !st.owned ? " recruit-locked" : "";

    const gnode = el(
      "div",
      {
        class: `gnode fam-${fam} state-${state}${lockClass}`,
        style: `left:${node.pos.x - NODE / 2}px; top:${node.pos.y - NODE / 2}px`,
        onclick: () => app.buyNode(node.id),
        onmouseenter: (e: Event) =>
          showTip(tip, e.currentTarget as HTMLElement, node, wing.id, st, save),
        onmouseleave: () => tip.classList.add("hidden"),
      },
      children,
    );
    nodeEls.push(gnode);
  }

  const graph = el("div", { class: "graph", style: `width:${GRAPH_W}px; height:${GRAPH_H}px` }, [
    wires as unknown as Node,
    ...nodeEls,
  ]);
  // Tooltip lives in the (unscaled) wrapper so positioning isn't affected by
  // the graph's scale transform.
  const graphWrap = el("div", { class: "graph-wrap" }, [graph, tip]);

  // --- Footer (settings) ---
  const footer = el("footer", { class: "hub-footer" }, [
    el("label", { class: "toggle" }, [
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
    ]),
    el("label", { class: "toggle" }, [
      el("input", {
        type: "checkbox",
        ...(save.settings.soundEnabled ? { checked: true } : {}),
        onchange: (e: Event) => {
          const checked = (e.target as HTMLInputElement).checked;
          app.setSave({
            ...app.save,
            settings: { ...app.save.settings, soundEnabled: checked },
          });
        },
      }),
      " Sound effects",
    ]),
    el("div", { class: "spacer" }, []),
    el(
      "button",
      {
        class: "ghost-btn danger",
        onclick: () => {
          if (confirm("Wipe all progress and start over?")) app.hardReset();
        },
      },
      ["Reset Save"],
    ),
  ]);

  // --- Expedition overlay (dungeon picker) ---
  const overlay = buildExpedition(app);

  // Scale the fixed-size graph to fit the available width (no horizontal scroll).
  requestAnimationFrame(() => {
    const avail = graphWrap.clientWidth - 4;
    const s = Math.min(1, avail / GRAPH_W);
    graph.style.transformOrigin = "top center";
    graph.style.transform = `scale(${s})`;
    graphWrap.style.height = `${GRAPH_H * s + 20}px`;
  });

  return el("main", { class: "screen hub" }, [header, graphWrap, footer, overlay]);
}

function showTip(
  tip: HTMLElement,
  gnodeEl: HTMLElement,
  node: SkillNode,
  wingId: string,
  st: ReturnType<typeof nodeStatus>,
  save: SaveState,
): void {
  const lines: (Node | string)[] = [];

  if (node.recruit) {
    const def = CLASSES[node.recruit];
    lines.push(el("div", { class: "tip-title" }, [def.name + " — " + def.role]));
    lines.push(el("div", { class: "tip-eff" }, [def.blurb]));
    lines.push(statBlock(node.recruit, save));
    lines.push(
      el("div", { class: "tip-cost" }, [
        st.owned ? "✓ Recruited" : `Recruit · ${fmt(st.cost)}🪙`,
      ]),
    );
  } else if (node.unlockWing) {
    const wing = getWing(node.unlockWing);
    lines.push(el("div", { class: "tip-title" }, [wing.name.replace(" (Locked)", "") + " wing"]));
    lines.push(el("div", { class: "tip-eff" }, ["Unlocks a Sigil-gated upgrade wing."]));
    lines.push(
      el("div", { class: "tip-cost" }, [
        st.owned ? "✓ Unlocked" : `Unlock · ${st.cost}🔹`,
      ]),
    );
  } else {
    lines.push(
      el("div", { class: "tip-title" }, [
        node.name,
        node.maxRanks > 1
          ? el("span", { class: "tip-rank" }, [` ${st.ranks}/${node.maxRanks}`])
          : "",
      ]),
    );
    lines.push(el("div", { class: "tip-eff" }, [effectText(node)]));
    let costLine = `Buy · ${fmt(st.cost)}🪙`;
    if (st.maxed) costLine = "✓ Maxed";
    else if (!st.available) costLine = lockReason(node, wingId, save);
    lines.push(el("div", { class: "tip-cost" }, [costLine]));
  }

  tip.replaceChildren(...lines);

  // Position relative to the unscaled wrapper using the node's real on-screen
  // rect (so the graph's scale transform is accounted for). Flip below near the
  // top edge and clamp horizontally so edge nodes stay fully readable.
  tip.classList.remove("hidden"); // unhide first so we can measure its height
  const wrap = tip.parentElement;
  if (wrap) {
    const nr = gnodeEl.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const cx = nr.left - wr.left + nr.width / 2;
    const top = nr.top - wr.top;
    const bottom = nr.bottom - wr.top;
    // Flip below the node when there isn't room for the tooltip above it.
    const below = top < tip.offsetHeight + 12;
    const halfW = 90;
    tip.classList.toggle("tip-below", below);
    tip.style.left = `${Math.max(halfW, Math.min(wrap.clientWidth - halfW, cx))}px`;
    tip.style.top = `${below ? bottom + 8 : top - 8}px`;
  }
}

/** A compact 2-column grid of a party member's current (upgrade-resolved) stats. */
function statBlock(classId: ClassId, save: SaveState): HTMLElement {
  const s = resolveStats(classId, save);
  const role = CLASSES[classId].role;
  const rows: StatKey[] = ["maxHp", "attack", "attackInterval", "armor"];
  if (role === "tank") rows.push("threat");
  if (s.healPower > 0) rows.push("healPower");
  rows.push("abilityPower", "abilityCooldown");
  return el(
    "div",
    { class: "tip-stats" },
    rows.flatMap((k) => [
      el("span", { class: "tip-stat-k" }, [STAT_NAME[k]]),
      el("span", { class: "tip-stat-v" }, [fmtStat(k, s[k])]),
    ]),
  );
}

function fmtStat(stat: StatKey, v: number): string {
  switch (stat) {
    case "maxHp":
    case "healPower":
      return String(Math.round(v));
    case "attack":
    case "threat":
      return String(Math.round(v * 10) / 10);
    case "attackInterval":
      return `${v.toFixed(2)}s`;
    case "armor":
      return `${Math.round(v * 100)}%`;
    case "abilityPower":
      return `×${v.toFixed(2)}`;
    case "abilityCooldown":
      return `${v.toFixed(1)}s`;
    default:
      return String(v);
  }
}

function lockReason(node: SkillNode, wingId: string, save: SaveState): string {
  const wing = getWing(wingId);
  if (wing.sigilCost > 0 && !save.unlockedWings.includes(wing.id)) {
    return "🔒 Unlock this wing first";
  }
  const cls = node.effect?.target ?? node.unlock?.target;
  if (
    cls &&
    cls !== "party" &&
    !CLASSES[cls as ClassId].starter &&
    !save.roster.includes(cls as ClassId)
  ) {
    return `🔒 Recruit ${CLASSES[cls as ClassId].name} first`;
  }
  // Otherwise it's gated behind a wired parent node that isn't unlocked yet.
  const lockedParent = (node.links ?? [])
    .map((id) => getNode(id))
    .find((p) => !nodeStatus(save, p.id).owned);
  if (lockedParent) return `🔒 Unlock ${lockedParent.name} first`;
  return "🔒 Locked";
}

function buildExpedition(app: App): HTMLElement {
  const cards = DUNGEON_ORDER.map((id) => {
    const def = getDungeon(id);
    const unlocked = app.save.unlockedDungeons.includes(id);
    const beaten = app.save.bossesDefeated.includes(id);
    return el("div", { class: "exp-card" + (unlocked ? "" : " locked") }, [
      el("div", { class: "exp-name" }, [
        def.name,
        beaten ? el("span", { class: "beaten-tag" }, [" ✓ cleared"]) : "",
      ]),
      el("div", { class: "exp-meta" }, [
        `${def.levels.length} levels · boss · ${def.goldMultiplier}× gold`,
      ]),
      unlocked
        ? el("button", { class: "primary-btn", onclick: () => app.startDungeon(id) }, ["Enter"])
        : el("div", { class: "locked-hint" }, ["🔒 Defeat the previous boss"]),
    ]);
  });

  const overlay = el("div", { class: "exp-overlay hidden" }, []);
  const close = () => overlay.classList.add("hidden");
  const card = el("div", { class: "exp-modal" }, [
    el("div", { class: "exp-modal-head" }, [
      el("h2", {}, ["Choose an Expedition"]),
      el("button", { class: "ghost-btn", onclick: close }, ["✕"]),
    ]),
    el("div", { class: "exp-grid" }, cards),
  ]);
  overlay.append(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  return overlay;
}

// Re-export so callers needn't reach into core for wing data.
export { WINGS };
