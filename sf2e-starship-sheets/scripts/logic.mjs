/**
 * Pure starship rules logic: no Foundry globals, so it can be tested in a plain browser.
 */
import { ACTION_CHECKS, ACTIONS, DRONES, FRAMES, GRADE_LABELS, STATIONS, UNIVERSAL_ACTIONS, UPGRADES, WEAPONS } from "./data.mjs";

export const CUSTOM_SLOTS = 4;
export const EXPANSION_BAYS = 4;

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const int = (v, fallback = 0) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Math.trunc(Number(v)) : fallback);

/** A new player starship's module data. */
export function defaultPCShip(frameKey = "explorer", level = 1) {
  const frame = FRAMES[frameKey] ?? FRAMES.explorer;
  const station = (type, fixed, defaultUpgrade = null) => ({
    type, fixed, defaultUpgrade, gradeOverride: "", helmer: "", malfunctioning: false, upgrades: [], weapons: [], attackOverride: null
  });
  return {
    version: 1,
    kind: "pc",
    frame: frameKey in FRAMES ? frameKey : "explorer",
    level: clamp(int(level, 1), 1, 20),
    sp: frameRow(frameKey, level)[2],
    compromised: 0,
    wrecked: 0,
    destroyed: false,
    acCircumstance: 0,
    heading: "",
    traits: "Tech",
    resistances: "",
    notes: "",
    bays: Array.from({ length: EXPANSION_BAYS }, () => ({ name: "", notes: "" })),
    stations: [
      station("pilot", true, frame.defaults.pilot),
      station("generator", true, frame.defaults.generator),
      ...Array.from({ length: CUSTOM_SLOTS }, () => station("", false))
    ]
  };
}

/** A new NPC starship's module data (the rest of its stat block lives on the NPC actor). */
export function defaultNPCShip() {
  return {
    version: 1,
    kind: "npc",
    sp: 0,
    spMax: 0,
    fortify: 0,
    sensor: 4,
    speed: 4,
    compromised: 0,
    wrecked: 0,
    destroyed: false,
    heading: "",
    notes: "",
    stations: [{ type: "pilot", name: "Boost Thrusters, Change Heading", malfunctioning: false }]
  };
}

export function frameRow(frameKey, level) {
  const frame = FRAMES[frameKey] ?? FRAMES.explorer;
  return frame.adv[clamp(int(level, 1), 1, 20) - 1];
}

/** Highest grade index a station can have at a ship level. */
export function autoGradeIndex(type, level) {
  const levels = STATIONS[type]?.levels ?? [];
  let idx = 0;
  levels.forEach((l, i) => {
    if (l <= level) idx = i;
  });
  return idx;
}

export function gradeIndex(station, level) {
  if (!STATIONS[station.type]) return 0;
  const override = station.gradeOverride === "" || station.gradeOverride == null ? null : int(station.gradeOverride, null);
  return override === null ? autoGradeIndex(station.type, level) : clamp(override, 0, 6);
}

/** Weapons a gunnery can hold. */
export function weaponSlots(station) {
  return station.upgrades.some((u) => UPGRADES[u]?.weapons) ? 2 : 1;
}

/** Attack modifier a crew member gets with a starship weapon category. */
export function helmerAttack(helmer, category) {
  if (!helmer) return null;
  const rank = helmer.ranks?.[category] ?? 0;
  const proficiency = rank > 0 ? helmer.level + 2 * rank : 0;
  return helmer.dex + proficiency;
}

export function mapPenalties(traits) {
  return traits.includes("Agile") ? [0, -4, -8] : [0, -5, -10];
}

/**
 * Derive everything the PC sheet shows.
 * `crew` maps an actor UUID to { name, pilotDC, dex, level, ranks: { simple, martial, advanced } }.
 */
export function derivePCShip(ship, crew = {}) {
  const level = clamp(int(ship.level, 1), 1, 20);
  const frame = FRAMES[ship.frame] ?? FRAMES.explorer;
  const [, hp, spMax, frameAC, fort, ref, will, speed] = frameRow(ship.frame, level);
  const warnings = [];

  const stations = ship.stations.map((st, index) => deriveStation(st, index, level, crew, warnings));
  const helmed = (type) => stations.filter((s) => s.type === type && s.helmer);

  const pilot = helmed("pilot")[0];
  const pilotDC = pilot?.helmerData?.pilotDC ?? null;
  const acBase = pilotDC !== null ? Math.max(frameAC, pilotDC) : frameAC;
  const acItem = pilot ? pilot.bonuses.ac : 0;
  const acCirc = int(ship.acCircumstance, 0);
  const fortItem = Math.max(0, ...helmed("generator").map((s) => s.bonuses.fort));
  const refItem = pilot ? pilot.bonuses.ref : 0;
  const willItem = Math.max(0, ...helmed("scanners").map((s) => s.bonuses.will), ...helmed("conduit").map((s) => s.bonuses.will));
  const sensorBonus = Math.max(0, ...stations.filter((s) => s.type === "scanners").map((s) => s.bonuses.sensor));

  if (ship.compromised > 0) warnings.push("Compromised: the starship is inoperable and its battle stations are malfunctioning.");

  return {
    level,
    frame: { key: ship.frame, name: frame.name, url: frame.url },
    hpMax: hp,
    spMax,
    sp: clamp(int(ship.sp, 0), 0, spMax),
    ac: { frame: frameAC, pilotDC, base: acBase, item: acItem, circumstance: acCirc, total: acBase + acItem + acCirc },
    saves: {
      fortitude: { base: fort, item: fortItem, total: fort + fortItem },
      reflex: { base: ref, item: refItem, total: ref + refItem },
      will: { base: will, item: willItem, total: will + willItem }
    },
    speed,
    sensor: { base: frame.sensor, bonus: sensorBonus, total: frame.sensor + sensorBonus },
    shieldDice: generateShieldsDice(level),
    stations,
    warnings
  };
}

function deriveStation(st, index, level, crew, warnings) {
  const def = STATIONS[st.type];
  const base = { ...st, index, def: null, helmerData: st.helmer ? crew[st.helmer] ?? { name: "Unknown crew", missing: true } : null };
  if (!def) return { ...base, empty: true, actions: [], weaponsView: [], bonuses: {}, upgradeViews: [] };

  const g = gradeIndex(st, level);
  const minLevel = def.levels[g];
  if (minLevel > level) warnings.push(`${def.name} (slot ${index + 1}): ${GRADE_LABELS[g]} grade needs starship level ${minLevel}.`);

  const allowed = def.upgrades[g];
  const used = st.upgrades.length;
  if (used > allowed) warnings.push(`${def.name} (slot ${index + 1}): ${used} upgrades installed, ${GRADE_LABELS[g]} grade allows ${allowed}.`);

  const upgradeKeys = [st.defaultUpgrade, ...st.upgrades].filter(Boolean);
  const upgradeViews = upgradeKeys.map((key, i) => {
    const up = UPGRADES[key];
    const isDefault = i === 0 && !!st.defaultUpgrade;
    if (up && up.station !== st.type) warnings.push(`${up.name} is installed in a ${STATIONS[up.station].name}, not a ${def.name}.`);
    if (up && up.level > level) warnings.push(`${up.name} is a level ${up.level} upgrade.`);
    return { key, name: up?.name ?? key, url: up?.url ?? null, isDefault, index: isDefault ? -1 : i - (st.defaultUpgrade ? 1 : 0) };
  });

  const actions = [];
  const add = (id, source) => {
    if (!ACTIONS[id] || actions.some((a) => a.id === id)) return;
    const check = actionCheck(id, st.type);
    if (check === false) return;
    actions.push({ id, ...ACTIONS[id], source, check });
  };
  for (const [gi, ids] of Object.entries(def.actions)) if (Number(gi) <= g) ids.forEach((id) => add(id, def.name));
  for (const key of upgradeKeys) {
    const up = UPGRADES[key];
    if (!up) continue;
    up.actions.forEach((id) => add(id, up.name));
    (up.tiers ?? []).forEach(([gi, ids]) => {
      if (gi <= g) ids.forEach((id) => add(id, up.name));
    });
  }
  UNIVERSAL_ACTIONS.forEach((id) => add(id, "Universal"));

  const bonuses = {
    ac: def.helmedAC?.[g] ?? 0,
    ref: def.helmedRef?.[g] ?? 0,
    fort: def.helmedFort?.[g] ?? 0,
    will: def.helmedWill?.[g] ?? 0,
    sensor: def.sensor?.[g] ?? 0,
    drones: def.drones?.[g] ?? 0,
    damageDice: def.damageDice?.[g] ?? 0,
    tracking: def.tracking?.[g] ?? 0
  };

  let weaponsView = [];
  if (st.type === "gunnery") {
    const slots = weaponSlots(st);
    if (st.weapons.length > slots) warnings.push(`Gunnery (slot ${index + 1}) holds ${slots} weapon${slots > 1 ? "s" : ""}; ${st.weapons.length} installed.`);
    weaponsView = st.weapons.map((w, wi) => deriveWeapon(w, wi, st, bonuses, base.helmerData));
    if (weaponsView.some((w) => w.area)) add(17, "Area weapon");
    if (weaponsView.some((w) => w.automatic)) add(19, "Automatic weapon");
  }

  const extras = {};
  if (st.type === "conduit") extras.spells = def.spells.map((id) => ({ id, ...ACTIONS[id] }));
  if (st.type === "drone") {
    extras.drones = Object.entries(DRONES).map(([key, d]) => ({
      key, ...d, actionList: d.actions.map((id) => ({ id, ...ACTIONS[id], check: actionCheck(id, st.type) || null }))
    }));
  }

  return {
    ...base,
    ...extras,
    def,
    name: def.name,
    grade: g,
    gradeLabel: GRADE_LABELS[g],
    autoGrade: autoGradeIndex(st.type, level),
    upgradesAllowed: allowed,
    upgradeViews,
    actions,
    bonuses,
    weaponsView,
    helmed: !!st.helmer
  };
}

function deriveWeapon(w, wi, st, bonuses, helmerData) {
  const data = WEAPONS[w.key];
  if (!data) return { index: wi, key: w.key, name: w.key ?? "Unknown weapon", missing: true };
  const dice = bonuses.damageDice;
  const helmerMod = helmerAttack(helmerData && !helmerData.missing ? helmerData : null, data.category);
  const override = st.attackOverride === null || st.attackOverride === "" || st.attackOverride === undefined ? null : int(st.attackOverride, null);
  const attack = override !== null ? override + bonuses.tracking : helmerMod !== null ? helmerMod + bonuses.tracking : null;
  return {
    index: wi,
    key: w.key,
    ...data,
    active: wi === (st.activeWeapon ?? 0),
    dice,
    formula: `${dice}d${data.die}`,
    tracking: bonuses.tracking,
    attack,
    map: mapPenalties(data.traits),
    area: data.traits.some((t) => /^area/i.test(t)),
    automatic: data.traits.includes("Automatic")
  };
}

/**
 * The roll an action asks for at a given station: { skills, vs, dc, secret } for a check the helmer rolls,
 * { save, basic, dcSkill | dcClass } for a save the target makes, null for none, or false when the action
 * can't be used at that station (Jump Start).
 */
export function actionCheck(id, stationType) {
  const c = ACTION_CHECKS[id];
  if (!c) return null;
  if (c.byStation) {
    const skills = c.byStation[stationType];
    return skills ? { skills, dc: c.dc ?? null, vs: null, secret: false } : false;
  }
  if (c.save) return { save: c.save, basic: !!c.basic, dcSkill: c.dcSkill ?? null, dcClass: !!c.dcClass };
  return { skills: c.skills, vs: c.vs ?? null, dc: c.dc ?? null, secret: !!c.secret };
}

export function generateShieldsDice(level) {
  return 1 + Math.floor((Math.max(1, level) - 1) / 2);
}

export function ventPowerDice(level) {
  return level < 6 ? 1 : 2 + Math.floor((level - 6) / 2);
}

/**
 * Apply damage to a starship.
 * state: { hp, hpMax, sp, compromised, wrecked, destroyed, stationCount }
 * Returns the new state plus a list of human-readable notes.
 */
export function applyShipDamage(state, { amount, bypass = false, critical = false }) {
  const s = { ...state };
  const notes = [];
  let remaining = Math.max(0, int(amount, 0));
  if (remaining === 0 || s.destroyed) return { ...s, notes, hullDamage: 0, malfunctionAll: false };

  if (!bypass && s.sp > 0) {
    const absorbed = Math.min(s.sp, remaining);
    s.sp -= absorbed;
    remaining -= absorbed;
    notes.push(`Shields absorbed ${absorbed}.`);
  }

  let malfunctionAll = false;
  const hullDamage = remaining;
  if (remaining > 0) {
    const wasAtZero = s.hp <= 0;
    s.hp = Math.max(0, s.hp - remaining);
    notes.push(`Hull took ${remaining}.`);
    if (wasAtZero && s.compromised > 0) {
      const inc = critical ? 2 : 1;
      s.compromised += inc;
      notes.push(`Compromised +${inc}.`);
    } else if (s.hp === 0) {
      const start = (critical ? 2 : 1) + (s.wrecked ?? 0);
      s.compromised = Math.max(s.compromised, start);
      malfunctionAll = true;
      notes.push(`Hull Points reduced to 0: compromised ${s.compromised}, every battle station is malfunctioning.`);
    }
  }
  if (s.compromised >= 10) {
    s.compromised = 10;
    s.destroyed = true;
    notes.push("Compromised 10: the starship is destroyed.");
  }
  return { ...s, notes, hullDamage, malfunctionAll };
}

/** Restore Hull Points; regaining 1+ HP ends compromised and adds wrecked. */
export function applyHullRepair(state, amount) {
  const s = { ...state };
  const notes = [];
  if (s.destroyed) return { ...s, notes: ["A destroyed starship can only be repaired at a port."] };
  const gain = Math.max(0, int(amount, 0));
  s.hp = Math.min(s.hpMax, s.hp + gain);
  notes.push(`Hull restored ${gain}.`);
  if (s.compromised > 0 && s.hp >= 1) {
    s.compromised = 0;
    s.wrecked = (s.wrecked ?? 0) + 1;
    notes.push(`No longer compromised; wrecked ${s.wrecked}.`);
  }
  return { ...s, notes };
}

export function applyShieldGain(state, amount, spMax) {
  const sp = clamp(state.sp + Math.max(0, int(amount, 0)), 0, spMax);
  return { ...state, sp, notes: [`Shields now ${sp}/${spMax}.`] };
}

/** Degree of success: 0 crit fail, 1 fail, 2 success, 3 crit success. */
export function degreeOfSuccess(total, die, dc) {
  let degree = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  if (die === 20) degree = Math.min(3, degree + 1);
  if (die === 1) degree = Math.max(0, degree - 1);
  return degree;
}

export const DEGREE_LABELS = ["Critical Failure", "Failure", "Success", "Critical Success"];

/** Hull integrity flat check: DC 10 + compromised. */
export function hullIntegrity(compromised, die) {
  const dc = 10 + compromised;
  const degree = degreeOfSuccess(die, die, dc);
  const change = [2, 1, -1, -2][degree];
  const next = clamp(compromised + change, 0, 10);
  return { dc, degree, label: DEGREE_LABELS[degree], change, compromised: next, destroyed: next >= 10 };
}

/** Values to mirror onto the vehicle actor so tokens, targeting and the system see the right numbers. */
export function vehicleSync(derived, currentHP) {
  return {
    "system.details.level.value": derived.level,
    "system.attributes.hp.max": derived.hpMax,
    "system.attributes.hp.value": clamp(int(currentHP, derived.hpMax), 0, derived.hpMax),
    "system.attributes.ac.value": derived.ac.total,
    "system.saves.fortitude.value": derived.saves.fortitude.total,
    "system.details.speed": `${derived.speed} zones`,
    "system.traits.size.value": "med"
  };
}
