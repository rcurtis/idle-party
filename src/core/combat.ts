import { getClass } from "./characters";
import { getDungeon } from "./dungeons";
import { resolveStats } from "./stats";
import type {
  ClassId,
  CombatEvent,
  CombatRef,
  Combatant,
  DungeonDef,
  Enemy,
  ProjectileKind,
  RunState,
  SaveState,
} from "./types";

export interface StepOpts {
  autoCast: boolean;
}

const ADVANCE_TIME = 0.7; // seconds between packs / levels
const PARTY_ORDER: ReadonlyArray<Combatant["role"]> = [
  "tank",
  "healer",
  "dps",
];

/** Build live combatants from the player's roster, ordered tank→healer→dps. */
export function buildParty(save: SaveState): Combatant[] {
  const members = save.roster.map((classId) => {
    const def = getClass(classId);
    const stats = resolveStats(classId, save);
    const c: Combatant = {
      classId,
      role: def.role,
      name: def.name,
      stats,
      hp: stats.maxHp,
      atkTimer: stats.attackInterval,
      abilityTimer: stats.abilityCooldown,
      ability: def.ability,
      abilityUnlocked:
        !def.ability.requiresNode ||
        (save.purchased[def.ability.requiresNode] ?? 0) > 0,
      alive: true,
      shield: 0,
    };
    return c;
  });
  members.sort(
    (a, b) => PARTY_ORDER.indexOf(a.role) - PARTY_ORDER.indexOf(b.role),
  );
  return members;
}

function makeEnemy(def: DungeonDef, enemyId: string, seq: number): Enemy {
  const e = def.enemies[enemyId];
  if (!e) throw new Error(`Unknown enemy ${enemyId} in ${def.id}`);
  return {
    id: `${e.id}#${seq}`,
    name: e.name,
    isBoss: e.id.startsWith("boss"),
    maxHp: e.hp,
    hp: e.hp,
    attack: e.attack,
    attackInterval: e.attackInterval,
    armor: e.armor,
    atkTimer: e.attackInterval,
    goldValue: Math.round(e.goldValue * def.goldMultiplier),
    dotStacks: 0,
    dotDps: 0,
    dotTimer: 0,
    alive: true,
  };
}

let enemySeq = 0;

function spawnPack(run: RunState, def: DungeonDef): void {
  const level = def.levels[run.levelIndex];
  const pack = level.packs[run.packIndex] ?? [];
  run.enemies = pack.map((id) => makeEnemy(def, id, enemySeq++));
}

/** Create a fresh run for the given dungeon. */
export function startRun(
  save: SaveState,
  dungeonId: string,
  seed = 1,
): RunState {
  const def = getDungeon(dungeonId);
  const run: RunState = {
    dungeonId,
    levelIndex: 0,
    phase: "fighting",
    party: buildParty(save),
    enemies: [],
    goldEarned: 0,
    sigilsEarned: 0,
    advanceTimer: 0,
    packIndex: 0,
    log: [],
    resolved: false,
    rngState: seed | 0,
    events: [],
  };
  spawnPack(run, def);
  log(run, `Entered ${def.name}.`);
  return run;
}

function log(run: RunState, msg: string): void {
  run.log.push(msg);
  if (run.log.length > 60) run.log.shift();
}

/** Record a visual-only event (drained by the renderer). Capped to bound memory. */
function emit(run: RunState, ev: CombatEvent): void {
  run.events.push(ev);
  if (run.events.length > 300) run.events.shift();
}

function pRef(run: RunState, c: Combatant): CombatRef {
  return { side: "party", index: run.party.indexOf(c) };
}
function eRef(run: RunState, e: Enemy): CombatRef {
  return { side: "enemy", index: run.enemies.indexOf(e) };
}

/** How a class's basic attack should look. */
function classProjectile(id: ClassId): {
  ranged: boolean;
  projectile: ProjectileKind;
} {
  switch (id) {
    case "ranger":
      return { ranged: true, projectile: "arrow" };
    case "mage":
      return { ranged: true, projectile: "magic" };
    case "warlock":
      return { ranged: true, projectile: "shadow" };
    case "cleric":
    case "knight":
      return { ranged: false, projectile: "none" };
  }
}

function aliveParty(run: RunState): Combatant[] {
  return run.party.filter((c) => c.alive);
}
function aliveEnemies(run: RunState): Enemy[] {
  return run.enemies.filter((e) => e.alive);
}

/** Enemy aggro target: highest-threat living member, tie-break by party order. */
function aggroTarget(run: RunState): Combatant | null {
  let best: Combatant | null = null;
  let bestThreat = -Infinity;
  for (const c of run.party) {
    if (!c.alive) continue;
    if (c.stats.threat > bestThreat) {
      bestThreat = c.stats.threat;
      best = c;
    }
  }
  return best;
}

function lowestEnemy(run: RunState): Enemy | null {
  let best: Enemy | null = null;
  for (const e of run.enemies) {
    if (!e.alive) continue;
    if (!best || e.hp < best.hp) best = e;
  }
  return best;
}

function mostWoundedAlly(run: RunState): Combatant | null {
  let best: Combatant | null = null;
  let bestMissing = 0;
  for (const c of run.party) {
    if (!c.alive) continue;
    const missing = c.stats.maxHp - c.hp;
    if (missing > bestMissing) {
      bestMissing = missing;
      best = c;
    }
  }
  return best;
}

/** Apply damage to a party member; returns total HP+shield removed. */
function dealToCombatant(c: Combatant, rawDamage: number): number {
  const dmg = rawDamage * (1 - c.stats.armor);
  let remaining = dmg;
  if (c.shield > 0) {
    const absorbed = Math.min(c.shield, remaining);
    c.shield -= absorbed;
    remaining -= absorbed;
  }
  c.hp -= remaining;
  if (c.hp <= 0) {
    c.hp = 0;
    c.alive = false;
  }
  return dmg;
}

/** Apply damage to an enemy; returns HP removed (post-armor). */
function dealToEnemy(e: Enemy, rawDamage: number): number {
  const dmg = rawDamage * (1 - e.armor);
  e.hp -= dmg;
  if (e.hp <= 0) {
    e.hp = 0;
    e.alive = false;
  }
  return dmg;
}

function castAbilityFor(run: RunState, c: Combatant): boolean {
  const power = c.stats.abilityPower;
  const self = pRef(run, c);
  switch (c.ability.kind) {
    case "taunt": {
      c.shield += c.stats.maxHp * c.ability.magnitude * power;
      emit(run, {
        t: "cast",
        from: self,
        ability: "taunt",
        projectile: "none",
        targets: [self],
      });
      log(run, `${c.name} raises ${c.ability.name}!`);
      return true;
    }
    case "bigheal": {
      const amount = c.stats.healPower * c.ability.magnitude * power;
      const allies = aliveParty(run);
      emit(run, {
        t: "cast",
        from: self,
        ability: "bigheal",
        projectile: "holy",
        targets: allies.map((a) => pRef(run, a)),
      });
      for (const ally of allies) {
        const healed = Math.min(ally.stats.maxHp - ally.hp, amount);
        ally.hp = Math.min(ally.stats.maxHp, ally.hp + amount);
        if (healed > 0)
          emit(run, { t: "heal", from: self, to: pRef(run, ally), amount: healed });
      }
      log(run, `${c.name} casts ${c.ability.name}.`);
      return true;
    }
    case "nuke": {
      const t = lowestEnemy(run);
      if (!t) return false;
      const dealt = dealToEnemy(t, c.stats.attack * c.ability.magnitude * power);
      emit(run, {
        t: "attack",
        from: self,
        to: eRef(run, t),
        ranged: true,
        projectile: "fire",
        amount: dealt,
        lethal: !t.alive,
        crit: true,
      });
      log(run, `${c.name} hurls ${c.ability.name}!`);
      return true;
    }
    case "volley": {
      const targets = aliveEnemies(run).slice(0, 3);
      if (targets.length === 0) return false;
      for (const t of targets) {
        const dealt = dealToEnemy(t, c.stats.attack * c.ability.magnitude * power);
        emit(run, {
          t: "attack",
          from: self,
          to: eRef(run, t),
          ranged: true,
          projectile: "arrow",
          amount: dealt,
          lethal: !t.alive,
          crit: true,
        });
      }
      log(run, `${c.name} looses a ${c.ability.name}.`);
      return true;
    }
    case "dot": {
      const t = lowestEnemy(run);
      if (!t) return false;
      t.dotStacks += 1;
      t.dotDps = c.stats.attack * c.ability.magnitude * power * 0.25;
      t.dotTimer = 0;
      emit(run, {
        t: "cast",
        from: self,
        ability: "dot",
        projectile: "shadow",
        targets: [eRef(run, t)],
      });
      log(run, `${c.name} applies ${c.ability.name}.`);
      return true;
    }
  }
}

/** Should this character auto-cast its ability right now? */
function shouldAutoCast(run: RunState, c: Combatant): boolean {
  if (c.abilityTimer > 0) return false;
  switch (c.ability.kind) {
    case "taunt":
      return c.hp < c.stats.maxHp * 0.7 || c.shield <= 0;
    case "bigheal": {
      const hurt = aliveParty(run).some(
        (a) => a.hp < a.stats.maxHp * 0.6,
      );
      return hurt;
    }
    default:
      return aliveEnemies(run).length > 0;
  }
}

/** Player-triggered ability cast (ignores auto rules but respects cooldown). */
export function manualCast(run: RunState, classId: string): RunState {
  if (run.phase !== "fighting") return run;
  const c = run.party.find((m) => m.classId === classId && m.alive);
  if (!c || !c.abilityUnlocked || c.abilityTimer > 0) return run;
  if (castAbilityFor(run, c)) {
    c.abilityTimer = c.stats.abilityCooldown;
  }
  return run;
}

/**
 * Advance the run by a fixed timestep (seconds). Mutates and returns `run`.
 * Caller is responsible for calling repeatedly with small, fixed dt.
 */
export function stepRun(run: RunState, dt: number, opts: StepOpts): RunState {
  if (run.phase === "won" || run.phase === "wiped") return run;
  const def = getDungeon(run.dungeonId);

  // Between-pack / between-level transition.
  if (run.phase === "advancing") {
    run.advanceTimer -= dt;
    if (run.advanceTimer <= 0) {
      run.phase = "fighting";
      spawnPack(run, def);
    }
    return run;
  }

  // Cooldown ticks + abilities.
  for (const c of run.party) {
    if (!c.alive) continue;
    c.atkTimer -= dt;
    c.abilityTimer = Math.max(0, c.abilityTimer - dt);
    if (opts.autoCast && c.abilityUnlocked && shouldAutoCast(run, c)) {
      if (castAbilityFor(run, c)) c.abilityTimer = c.stats.abilityCooldown;
    }
  }

  // Party auto-attacks / heals.
  for (const c of aliveParty(run)) {
    if (c.atkTimer > 0) continue;
    c.atkTimer += c.stats.attackInterval;
    if (c.role === "healer") {
      const wounded = mostWoundedAlly(run);
      if (wounded && wounded.hp < wounded.stats.maxHp * 0.95) {
        const healed = Math.min(
          wounded.stats.maxHp - wounded.hp,
          c.stats.healPower,
        );
        wounded.hp = Math.min(
          wounded.stats.maxHp,
          wounded.hp + c.stats.healPower,
        );
        emit(run, {
          t: "heal",
          from: pRef(run, c),
          to: pRef(run, wounded),
          amount: healed,
        });
        continue;
      }
    }
    const target = lowestEnemy(run);
    if (target) {
      const dealt = dealToEnemy(target, c.stats.attack);
      const look = classProjectile(c.classId);
      emit(run, {
        t: "attack",
        from: pRef(run, c),
        to: eRef(run, target),
        ranged: look.ranged,
        projectile: look.projectile,
        amount: dealt,
        lethal: !target.alive,
      });
    }
  }

  // Damage-over-time ticks (emit a number roughly twice a second).
  for (const e of aliveEnemies(run)) {
    if (e.dotStacks > 0) {
      dealToEnemy(e, e.dotDps * e.dotStacks * dt);
      e.dotTimer += dt;
      if (e.dotTimer >= 0.5) {
        emit(run, {
          t: "dot",
          to: eRef(run, e),
          amount: e.dotDps * e.dotStacks * e.dotTimer,
        });
        e.dotTimer = 0;
      }
    }
  }

  // Enemy attacks.
  for (const e of aliveEnemies(run)) {
    e.atkTimer -= dt;
    if (e.atkTimer > 0) continue;
    e.atkTimer += e.attackInterval;
    const target = aggroTarget(run);
    if (target) {
      const dealt = dealToCombatant(target, e.attack);
      emit(run, {
        t: "attack",
        from: eRef(run, e),
        to: pRef(run, target),
        ranged: e.isBoss,
        projectile: e.isBoss ? "magic" : "none",
        amount: dealt,
        lethal: !target.alive,
      });
    }
  }

  // Resolve enemy deaths → gold.
  for (const e of run.enemies) {
    if (!e.alive && e.goldValue > 0) {
      run.goldEarned += e.goldValue;
      if (e.isBoss) {
        run.sigilsEarned += 1;
        log(run, `Defeated ${e.name}! A Sigil drops.`);
      } else {
        log(run, `Slew ${e.name} (+${e.goldValue}g).`);
      }
      e.goldValue = 0; // mark counted
    }
  }

  // Party wipe?
  if (aliveParty(run).length === 0) {
    run.phase = "wiped";
    log(run, "The party has fallen...");
    return run;
  }

  // Pack cleared?
  if (aliveEnemies(run).length === 0) {
    const level = def.levels[run.levelIndex];
    const wasBoss = level.isBoss;
    run.packIndex += 1;
    if (run.packIndex < level.packs.length) {
      run.phase = "advancing";
      run.advanceTimer = ADVANCE_TIME;
    } else if (wasBoss) {
      run.phase = "won";
      log(run, "Dungeon cleared!");
    } else if (run.levelIndex + 1 < def.levels.length) {
      run.levelIndex += 1;
      run.packIndex = 0;
      run.phase = "advancing";
      run.advanceTimer = ADVANCE_TIME;
      log(run, `Descending to level ${run.levelIndex + 1}...`);
    } else {
      run.phase = "won";
      log(run, "Dungeon cleared!");
    }
  }

  return run;
}
