import { describe, it, expect } from "vitest";
import { newSave, serialize, deserialize, migrate } from "./save";
import {
  recruit,
  purchaseNode,
  nodeCost,
  unlockWing,
  canPurchase,
  nodeStatus,
  buyNode,
} from "./economy";
import { resolveStats } from "./stats";
import { startRun, stepRun, manualCast, buildParty } from "./combat";
import { bankRun } from "./game";
import type { RunState, SaveState } from "./types";

/** Run a dungeon to completion (won or wiped) with fixed dt. */
function simulate(run: RunState, autoCast = true, maxSeconds = 600): RunState {
  const dt = 0.1;
  let t = 0;
  while (run.phase !== "won" && run.phase !== "wiped" && t < maxSeconds) {
    stepRun(run, dt, { autoCast });
    t += dt;
  }
  return run;
}

/** A maxed-out save: full roster, generous gold, solid defensive investment. */
function strongSave(): SaveState {
  let s = newSave();
  s = { ...s, gold: 100000, sigils: 5 };
  for (const id of ["ranger", "cleric", "mage", "warlock"] as const) {
    const r = recruit(s, id);
    expect(r.ok).toBe(true);
    if (r.ok) s = r.save;
  }
  // Tank + healer need real investment now that the base Knight is fragile.
  const buys = [
    "kn_hp", "kn_hp", "kn_hp", "kn_hp", "kn_hp", "kn_hp",
    "kn_armor", "kn_armor", "kn_armor",
    "kn_ironwall",
    "rg_dmg", "rg_volley",
    "cl_heal", "cl_heal", "cl_heal", "cl_heal",
    "cl_hp", "cl_hp",
  ];
  for (const id of buys) {
    const r = purchaseNode(s, id);
    if (r.ok) s = r.save;
  }
  return s;
}

describe("save", () => {
  it("new save starts with only the knight and first dungeon", () => {
    const s = newSave();
    expect(s.roster).toEqual(["knight"]);
    expect(s.unlockedDungeons).toEqual(["catacombs"]);
    expect(s.gold).toBe(0);
  });

  it("serializes and deserializes round-trip", () => {
    const s = newSave();
    s.gold = 1234;
    s.purchased["rg_dmg"] = 3;
    const back = deserialize(serialize(s));
    expect(back.gold).toBe(1234);
    expect(back.purchased["rg_dmg"]).toBe(3);
  });

  it("migrates partial/garbage saves to a valid state", () => {
    expect(migrate(null).roster).toEqual(["knight"]);
    const m = migrate({ gold: 50 });
    expect(m.gold).toBe(50);
    expect(m.unlockedDungeons).toEqual(["catacombs"]);
  });
});

describe("economy: recruiting", () => {
  it("cannot recruit without enough gold", () => {
    const s = newSave();
    const r = recruit(s, "ranger");
    expect(r.ok).toBe(false);
  });

  it("cannot recruit the starter knight (already in party)", () => {
    let s = newSave();
    s.gold = 1000;
    const r = recruit(s, "knight");
    expect(r.ok).toBe(false);
  });

  it("recruits the ranger first and deducts gold", () => {
    let s = newSave();
    s.gold = 200;
    const r = recruit(s, "ranger");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.roster).toContain("ranger");
      expect(r.save.gold).toBe(140); // 200 - 60
    }
  });

  it("cannot recruit the same class twice", () => {
    let s = newSave();
    s.gold = 1000;
    const r1 = recruit(s, "mage");
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      const r2 = recruit(r1.save, "mage");
      expect(r2.ok).toBe(false);
    }
  });
});

describe("economy: skill nodes", () => {
  it("node cost escalates with ranks", () => {
    const s = newSave();
    const c0 = nodeCost(s, "rg_dmg");
    s.purchased["rg_dmg"] = 2;
    const c2 = nodeCost(s, "rg_dmg");
    expect(c2).toBeGreaterThan(c0);
  });

  it("purchasing a node applies a stat bonus to that class", () => {
    let s = newSave();
    s.gold = 1000;
    const rr = recruit(s, "ranger");
    if (rr.ok) s = rr.save;
    const before = resolveStats("ranger", s).attack;
    const r = purchaseNode(s, "rg_dmg");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const after = resolveStats("ranger", r.save).attack;
      expect(after).toBeGreaterThan(before);
    }
  });

  it("cannot purchase a node behind an unrecruited class", () => {
    let s = newSave();
    s.gold = 1000;
    // mage not recruited on a fresh save
    expect(canPurchase(s, "mg_dmg")).toBe(false);
  });

  it("respects node prerequisites", () => {
    let s = newSave();
    s.gold = 100000;
    const rr = recruit(s, "ranger");
    if (rr.ok) s = rr.save;
    // rg_hp requires rg_dmg
    expect(canPurchase(s, "rg_hp")).toBe(false);
    const r = purchaseNode(s, "rg_dmg");
    expect(r.ok).toBe(true);
    if (r.ok) expect(canPurchase(r.save, "rg_hp")).toBe(true);
  });

  it("cannot exceed max ranks", () => {
    let s = newSave();
    s.gold = 1000000;
    // pt_dmg (party, maxRanks 10) now requires pt_hp first.
    const ph = purchaseNode(s, "pt_hp");
    if (ph.ok) s = ph.save;
    for (let i = 0; i < 10; i++) {
      const r = purchaseNode(s, "pt_dmg");
      expect(r.ok).toBe(true);
      if (r.ok) s = r.save;
    }
    expect(canPurchase(s, "pt_dmg")).toBe(false);
  });
});

describe("economy: sigil-locked wings", () => {
  it("locked-wing nodes are unavailable until the wing is unlocked", () => {
    let s = newSave();
    s.gold = 100000;
    expect(canPurchase(s, "as_dmg")).toBe(false); // ascendant locked
    const u = unlockWing(s, "ascendant");
    expect(u.ok).toBe(false); // no sigils
    s.sigils = 1;
    const u2 = unlockWing(s, "ascendant");
    expect(u2.ok).toBe(true);
    if (u2.ok) {
      expect(u2.save.sigils).toBe(0);
      expect(canPurchase(u2.save, "as_dmg")).toBe(true);
    }
  });
});

describe("skill graph gating", () => {
  it("recruits unlock sequentially down the spine", () => {
    const s = newSave();
    expect(nodeStatus(s, "rec_ranger").available).toBe(true);
    expect(nodeStatus(s, "rec_cleric").available).toBe(false);
    const r = buyNode({ ...s, gold: 1000 }, "rec_ranger");
    expect(r.ok).toBe(true);
    if (r.ok) expect(nodeStatus(r.save, "rec_cleric").available).toBe(true);
  });

  it("child upgrade nodes are locked until their parent is purchased", () => {
    let s: SaveState = { ...newSave(), gold: 100000 };
    for (const id of ["rec_ranger", "rec_cleric", "rec_mage"]) {
      const r = buyNode(s, id);
      if (r.ok) s = r.save;
    }
    expect(s.roster).toContain("mage");
    expect(nodeStatus(s, "mg_dmg").available).toBe(true);
    expect(nodeStatus(s, "mg_ability").available).toBe(false); // needs mg_dmg
    const r = buyNode(s, "mg_dmg");
    if (r.ok) s = r.save;
    expect(nodeStatus(s, "mg_ability").available).toBe(true);
  });

  it("buyNode refuses a locked node", () => {
    const s = { ...newSave(), gold: 100000 };
    expect(buyNode(s, "rec_cleric").ok).toBe(false); // ranger not recruited
    expect(buyNode(s, "mg_dmg").ok).toBe(false); // mage not recruited
  });
});

describe("combat", () => {
  it("is deterministic for the same seed and save", () => {
    const s = strongSave();
    const a = simulate(startRun(s, "catacombs", 42));
    const b = simulate(startRun(s, "catacombs", 42));
    expect(a.phase).toBe(b.phase);
    expect(a.goldEarned).toBe(b.goldEarned);
    expect(a.levelIndex).toBe(b.levelIndex);
  });

  it("a no-upgrade lone knight wipes early in the first level", () => {
    // The fragile base tank should die quickly with zero investment, forcing
    // the player to buy upgrades before they can progress.
    const run = simulate(startRun(newSave(), "catacombs", 7));
    expect(run.phase).toBe("wiped");
    expect(run.levelIndex).toBeLessThanOrEqual(1); // nowhere near the boss
    expect(run.goldEarned).toBeGreaterThan(0); // but earns a little to invest
  });

  it("cheap HP upgrades let the knight progress further", () => {
    const bare = simulate(startRun(newSave(), "catacombs", 7));
    let s = newSave();
    for (let i = 0; i < 4; i++) {
      const r = purchaseNode({ ...s, gold: 1000 }, "kn_hp");
      if (r.ok) s = r.save;
    }
    const upgraded = simulate(startRun(s, "catacombs", 7));
    // More HP => survives longer => earns strictly more gold before wiping.
    expect(upgraded.goldEarned).toBeGreaterThan(bare.goldEarned);
  });

  it("Iron Wall is locked until its node is purchased", () => {
    const base = newSave();
    const lockedKnight = buildParty(base).find((c) => c.classId === "knight")!;
    expect(lockedKnight.abilityUnlocked).toBe(false);

    // Iron Wall requires Thick Hide (kn_hp) first.
    let s = base;
    const pre = purchaseNode({ ...s, gold: 1000 }, "kn_hp");
    if (pre.ok) s = pre.save;
    const r = purchaseNode(s, "kn_ironwall");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const knight = buildParty(r.save).find((c) => c.classId === "knight")!;
      expect(knight.abilityUnlocked).toBe(true);
    }
  });

  it("a no-upgrade knight casting Iron Wall is a no-op (locked)", () => {
    const run = startRun(newSave(), "catacombs", 1);
    const knight = run.party.find((c) => c.classId === "knight")!;
    knight.abilityTimer = 0;
    manualCast(run, "knight");
    expect(knight.shield).toBe(0); // no shield gained
    expect(knight.abilityTimer).toBe(0); // ability never fired
  });

  it("a strong full party can clear the catacombs and earn a sigil", () => {
    let s = strongSave();
    // Pump party power so the slice is winnable.
    for (let i = 0; i < 10; i++) {
      const r = purchaseNode(s, "pt_hp");
      if (r.ok) s = r.save;
    }
    for (let i = 0; i < 10; i++) {
      const r = purchaseNode(s, "pt_dmg");
      if (r.ok) s = r.save;
    }
    const run = simulate(startRun(s, "catacombs", 3));
    expect(run.phase).toBe("won");
    expect(run.sigilsEarned).toBe(1);
  });

  it("manual cast respects cooldown", () => {
    const s = strongSave();
    const run = startRun(s, "catacombs", 1);
    const mage = run.party.find((c) => c.classId === "mage")!;
    mage.abilityTimer = 0;
    manualCast(run, "mage");
    expect(mage.abilityTimer).toBeGreaterThan(0);
    // second cast does nothing while on cooldown
    const cd = mage.abilityTimer;
    manualCast(run, "mage");
    expect(mage.abilityTimer).toBe(cd);
  });

  it("emits attack events with valid refs and damage during a fight", () => {
    const s = strongSave();
    const run = startRun(s, "catacombs", 5);
    // Step until something attacks.
    for (let i = 0; i < 50 && run.events.length === 0; i++) {
      stepRun(run, 0.1, { autoCast: false });
    }
    const atk = run.events.find((e) => e.t === "attack");
    expect(atk).toBeDefined();
    if (atk && atk.t === "attack") {
      expect(atk.amount).toBeGreaterThan(0);
      const arr = atk.from.side === "party" ? run.party : run.enemies;
      expect(arr[atk.from.index]).toBeDefined();
    }
  });

  it("a damage ability emits a crit attack event", () => {
    const s = strongSave();
    const run = startRun(s, "catacombs", 1);
    const mage = run.party.find((c) => c.classId === "mage")!;
    mage.abilityTimer = 0;
    run.events.length = 0;
    manualCast(run, "mage");
    const ev = run.events.find((e) => e.t === "attack");
    expect(ev?.t === "attack" && ev.crit).toBe(true);
  });

  it("party is ordered tank, healer, then dps", () => {
    const party = buildParty(strongSave());
    expect(party[0].role).toBe("tank");
    expect(party[1].role).toBe("healer");
    expect(party.slice(2).every((c) => c.role === "dps")).toBe(true);
  });
});

describe("game: banking run results", () => {
  it("banks gold and is idempotent", () => {
    const s = newSave();
    const run = simulate(startRun(s, "catacombs", 7));
    const r1 = bankRun(s, run);
    expect(r1.save.gold).toBe(run.goldEarned);
    const r2 = bankRun(r1.save, run);
    expect(r2.goldGained).toBe(0); // already resolved
  });

  it("first boss kill unlocks the next dungeon", () => {
    let s = strongSave();
    for (let i = 0; i < 10; i++) {
      const r = purchaseNode(s, "pt_hp");
      if (r.ok) s = r.save;
      const r2 = purchaseNode(s, "pt_dmg");
      if (r2.ok) s = r2.save;
    }
    const run = simulate(startRun(s, "catacombs", 3));
    expect(run.phase).toBe("won");
    const banked = bankRun(s, run);
    expect(banked.firstBossKill).toBe(true);
    expect(banked.newDungeon).toBe("crypt");
    expect(banked.save.unlockedDungeons).toContain("crypt");
    expect(banked.save.sigils).toBe(s.sigils + 1);
  });
});
