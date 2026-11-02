/**
 * Pure starship rules logic: no Foundry globals, so it can be tested in a plain browser.
 */
import {
  ACTION_CHECKS, ACTIONS, CREW_QUARTERS_TYPES, DRONES, FRAMES, GRADE_LABELS, NPC_TIERS, NPC_WEAPONS, STATIONS, STRIKE_ATTACK_BONUS, STRIKE_DAMAGE_AVERAGE,
  STRIKE_DAMAGE_EXPRESSION, SPELL_ATTACK, SPELL_TIERS, CREATURE_DC,
  UNIVERSAL_ACTIONS, UPGRADES, WEAPONS
} from "./data.mjs";

export const CUSTOM_SLOTS = 4;
export const EXPANSION_BAYS = 4;

/** Expansion bay slots: the frame's 4, plus 1 with comfortable crew quarters. */
export const bayCount = (ship) => EXPANSION_BAYS + (CREW_QUARTERS_TYPES[ship?.crewQuarters]?.extraBays ?? 0);

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
    heading: 0,
    artFacesLeft: false,
    traits: "Tech",
    resistances: "",
    notes: "",
    crewQuarters: "bunks",
    basicPassengerQuarters: false,
    effects: [],
    bays: Array.from({ length: EXPANSION_BAYS }, () => ({ key: "", name: "" })),
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
    acCircumstance: 0,
    spellTier: "high",
    fortify: 0,
    sensor: 4,
    speed: 4,
    compromised: 0,
    wrecked: 0,
    destroyed: false,
    heading: 0,
    artFacesLeft: false,
    notes: "",
    effects: [],
    weapons: [],
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
/**
 * Test a system predicate (as written in rule elements: strings, arrays meaning "all", and
 * { or | and | not | nor | gte | gt | lte | lt } objects) against a list of roll options.
 */
export function predicateTest(predicate, options) {
  const set = options instanceof Set ? options : new Set(options);
  const numeric = (term) => {
    if (typeof term === "number") return term;
    for (const o of set) if (o.startsWith(`${term}:`) && Number.isFinite(Number(o.slice(term.length + 1)))) return Number(o.slice(term.length + 1));
    return Number.isFinite(Number(term)) ? Number(term) : null;
  };
  const test = (s) => {
    if (typeof s === "string") return set.has(s);
    if (Array.isArray(s)) return s.every(test);
    if (!s || typeof s !== "object") return false;
    if ("or" in s) return s.or.some(test);
    if ("and" in s) return s.and.every(test);
    if ("nor" in s) return !s.nor.some(test);
    if ("not" in s) return !test(s.not);
    for (const op of ["gte", "gt", "lte", "lt", "eq"]) {
      if (op in s) {
        const [a, b] = s[op].map(numeric);
        if (a === null || b === null) return false;
        return { gte: a >= b, gt: a > b, lte: a <= b, lt: a < b, eq: a === b }[op];
      }
    }
    return false;
  };
  return test(Array.isArray(predicate) ? predicate : [predicate]);
}

/** Roll options describing a starship weapon, in the system's item:… form, so proficiency definitions can match it. */
export function weaponRollOptions(data) {
  const slug = (t) => String(t).toLowerCase().split(/[\s(]/)[0];
  return [
    "item:type:weapon",
    data.range === 0 ? "item:melee" : "item:ranged",
    `item:category:${data.category}`,
    `item:group:${slug(data.group || "none")}`,
    ...data.traits.map((t) => `item:trait:${slug(t)}`)
  ];
}

/**
 * A crew member's proficiency rank with a starship weapon: the better of their category rank (simple, martial,
 * advanced) and any class proficiency whose definition the weapon matches, such as an operative's guns
 * (ranged weapons with the analog or tech trait).
 */
export function helmerRank(helmer, weapon) {
  if (!helmer) return 0;
  const options = weaponRollOptions(weapon);
  const special = (helmer.customAttacks ?? []).filter((c) => predicateTest(c.definition, options)).map((c) => c.rank);
  return Math.max(helmer.ranks?.[weapon.category] ?? 0, ...special);
}

export function helmerAttack(helmer, weapon) {
  if (!helmer) return null;
  const rank = typeof weapon === "string" ? helmer.ranks?.[weapon] ?? 0 : helmerRank(helmer, weapon);
  const proficiency = rank > 0 ? helmer.level + 2 * rank : 0;
  return helmer.dex + proficiency;
}

/**
 * Area Fire shape for an area weapon: a burst of the listed radius centered within the first range increment,
 * or a cone or line as long as the range increment.
 */
export function areaShape(data) {
  const trait = data.traits.find((t) => /^area/i.test(t));
  if (!trait) return null;
  const burst = trait.match(/burst\s+(\d+)/i);
  if (burst) return `burst ${burst[1]} zone${burst[1] === "1" ? "" : "s"}, centered within ${data.range} zones`;
  const kind = /cone/i.test(trait) ? "cone" : /line/i.test(trait) ? "line" : "area";
  return `${data.range}-zone ${kind}`;
}

/** Weapon specialization damage: 2/3/4 at expert/master/legendary, doubled with greater weapon specialization. */
export function specializationBonus(helmer, rank) {
  if (!helmer?.specialization || rank < 2) return 0;
  return [0, 0, 2, 3, 4][Math.min(rank, 4)] * (helmer.specialization === "greater" ? 2 : 1);
}

export function mapPenalties(traits) {
  return traits.includes("Agile") ? [0, -4, -8] : [0, -5, -10];
}

/**
 * Derive everything the PC sheet shows.
 * `crew` maps an actor UUID to { name, pilotDC, dex, level, ranks: { simple, martial, advanced } }.
 */
export function derivePCShip(ship, crew = {}, status = {}) {
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

  // Conditions on the starship: off-guard is -2 circumstance to AC; off-kilter is -2 circumstance to attack rolls,
  // Area Fire / Auto-Fire DCs and Reflex saves.
  const offGuard = status.offGuard ? -2 : 0;
  const offKilter = status.offKilter ? -2 : 0;
  if (offKilter) applyOffKilter(stations);

  return {
    level,
    frame: { key: ship.frame, name: frame.name, url: frame.url },
    hpMax: hp,
    spMax,
    sp: clamp(int(ship.sp, 0), 0, spMax),
    ac: { frame: frameAC, pilotDC, base: acBase, item: acItem, circumstance: acCirc, offGuard, total: acBase + acItem + acCirc + offGuard },
    conditions: { offGuard: !!offGuard, offKilter: !!offKilter },
    saves: {
      fortitude: { base: fort, item: fortItem, total: fort + fortItem },
      reflex: { base: ref, item: refItem, offKilter, total: ref + refItem + offKilter },
      will: { base: will, item: willItem, total: will + willItem }
    },
    speed: effectiveSpeed(speed, ship.effects),
    speedBase: speed,
    sensor: { base: frame.sensor, bonus: sensorBonus, total: frame.sensor + sensorBonus },
    shieldDice: generateShieldsDice(level),
    stations,
    warnings
  };
}

/** Off-kilter: -2 to the starship's weapon attack rolls and Area Fire / Auto-Fire DCs. */
function applyOffKilter(stations) {
  for (const st of stations) {
    for (const w of st.weaponsView ?? []) {
      if (w.attack !== null && w.attack !== undefined) w.attack -= 2;
      if (w.saveDC !== null && w.saveDC !== undefined) w.saveDC -= 2;
      w.offKilter = true;
    }
  }
}

/** The same off-kilter penalty for an NPC starship's weapon. */
export function npcWeaponOffKilter(w) {
  if (w.missing) return w;
  return { ...w, attack: w.attack - 2, saveDC: w.saveDC - 2, offKilter: true };
}

/**
 * Conditions a station action's own check result puts on the target starship, by degree of success
 * (3 critical success, 2 success). Juke: off-guard on a success; off-kilter and off-guard on a critical success.
 */
export const ACTION_OUTCOME_CONDITIONS = {
  599: { 3: ["off-kilter", "off-guard"], 2: ["off-guard"] }
};

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
  const helmer = helmerData && !helmerData.missing ? helmerData : null;
  const rank = helmerRank(helmer, data);
  const helmerMod = helmerAttack(helmer, data);
  const override = st.attackOverride === null || st.attackOverride === "" || st.attackOverride === undefined ? null : int(st.attackOverride, null);
  const attack = override !== null ? override + bonuses.tracking : helmerMod !== null ? helmerMod + bonuses.tracking : null;
  const area = data.traits.some((t) => /^area/i.test(t));
  const specialization = specializationBonus(helmer, rank);
  // Aim (operative) adds precision dice to ranged Strikes that aren't area attacks.
  const aimDice = !area && helmer?.aim ? helmer.aim.dice : 0;
  const formula = withMod(`${dice}d${data.die}`, specialization);
  return {
    index: wi,
    key: w.key,
    ...data,
    active: wi === (st.activeWeapon ?? 0),
    dice,
    rank,
    specialization,
    aimDice,
    aimDie: helmer?.aim?.die ?? 4,
    formula,
    tracking: bonuses.tracking,
    attack,
    map: mapPenalties(data.traits),
    area,
    automatic: data.traits.includes("Automatic"),
    // Area Fire / Auto-Fire: targets attempt a basic Reflex save against the gunner's class DC + the weapon's tracking.
    areaShape: areaShape(data),
    autoFireRange: Math.max(1, Math.floor(data.range / 2)),
    saveDC: Number.isFinite(helmer?.classDC) ? helmer.classDC + bonuses.tracking : null,
    primaryTarget: !!helmer?.primaryTarget
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

const withMod = (base, mod) => {
  const m = Math.trunc(mod) || 0;
  return `${base}${m ? (m > 0 ? `+${m}` : `${m}`) : ""}`;
};

/** "2d10+4 slashing + 3 fire" */
export const partsLabel = (parts) => parts.map((p) => `${p.formula} ${p.type}`).join(" + ");

/**
 * Nova weapon damage (Nova Strike / Nova Surge): the solar weapon's dice as d10s plus Strength, and with photon
 * attunement extra fire damage equal to half the solarian's level (rounded up).
 */
export function novaWeaponDamage(weapon, str, level, attunement) {
  const parts = [{ formula: withMod(`${weapon.dice ?? 1}d10`, str), type: weapon.type ?? "bludgeoning" }];
  if (attunement === "photon") parts.push({ formula: String(Math.ceil(Math.max(1, level) / 2)), type: "fire" });
  return parts;
}

/**
 * Nova Blast: graviton d8 bludgeoning (range 2 zones) or photon d6 fire (range 4 zones), plus Strength. The number
 * of dice is the solar flare's, since the nova flare benefits from the solar flare's crystals (striking crystals add dice).
 */
export function novaBlastDamage(attunement, str, dice = 1) {
  const photon = attunement === "photon";
  const n = Math.max(1, Math.trunc(dice) || 1);
  return { parts: [{ formula: withMod(`${n}${photon ? "d6" : "d8"}`, str), type: photon ? "fire" : "bludgeoning" }], range: photon ? 4 : 2 };
}

/**
 * Effects a nova attack puts on the target starship, by attunement and degree of success
 * (0 critical failure … 3 critical success).
 */
export function novaEffects(kind, attunement, degree) {
  if (kind === "weapon" && attunement === "graviton" && degree >= 2) {
    return [{ label: "−1 zone Speed until the end of its next turn (graviton nova weapon)", speed: -1 }];
  }
  if (kind === "blast" && degree === 3) {
    if (attunement === "graviton") return [{ label: "Off-kilter, −1 zone Speed for 1 round (graviton Nova Blast)", speed: -1, offKilter: true }];
    if (attunement === "photon") return [{ label: "1d6 persistent fire damage (photon Nova Blast)", persistent: { formula: "1d6", type: "fire" } }];
  }
  return [];
}

/** Speed after temporary effects. */
export const effectiveSpeed = (speed, effects = []) => Math.max(0, speed + effects.reduce((n, e) => n + (Number(e.speed) || 0), 0));

/**
 * An NPC starship's starship weapon, built with GM Core's creature tables at the ship's level: the attack bonus
 * for the chosen tier, and the weapon's own die with the table's dice count plus a flat modifier that reaches
 * the tier's average damage.
 */
export function npcWeapon(entry, level, index = 0) {
  const data = NPC_WEAPONS[entry.key];
  if (!data) return { index, key: entry.key, name: entry.key ?? "Unknown weapon", missing: true };
  const row = clamp(int(level, 0), -1, 24) + 1;
  const attackTier = NPC_TIERS.includes(entry.attackTier) ? entry.attackTier : "high";
  const damageTier = NPC_TIERS.includes(entry.damageTier) ? entry.damageTier : "moderate";
  const dice = row <= 4 ? 1 : row <= 12 ? 2 : row <= 19 ? 3 : 4;
  const tier = NPC_TIERS.indexOf(damageTier);
  // Same die as the table's expression: use it exactly. Otherwise reach the table's average with the weapon's die.
  const expression = STRIKE_DAMAGE_EXPRESSION[row][tier];
  const sameDie = expression.match(/^\d+d(\d+)/)?.[1] === String(data.die);
  const flat = Math.round(STRIKE_DAMAGE_AVERAGE[row][tier] - dice * (data.die + 1) / 2);
  return {
    index,
    key: entry.key,
    ...data,
    attackTier,
    damageTier,
    attack: STRIKE_ATTACK_BONUS[row][NPC_TIERS.indexOf(attackTier)],
    map: mapPenalties(data.traits),
    formula: sameDie ? expression : withMod(`${dice}d${data.die}`, flat),
    area: data.traits.some((t) => /^area/i.test(t)),
    automatic: data.traits.includes("Automatic"),
    // Area Fire / Auto-Fire save DC: GM Core's creature DC at the ship's level, matching the attack tier (low uses moderate).
    saveDC: CREATURE_DC[row][Math.min(NPC_TIERS.indexOf(attackTier), 2)],
    areaShape: areaShape(data),
    autoFireRange: Math.max(1, Math.floor(data.range / 2))
  };
}

export const normalizeHeading = (heading) => (Number(heading) === 180 ? 180 : 0);

/**
 * Tech Core heading rule: a starship is off-guard to attacks made from the opposite direction of its heading,
 * but starships in the same zone always treat each other as ahead. Positions are the tokens' x coordinates;
 * `zoneWidth` is how far apart (in the same units) two ships must be to be in different zones.
 */
export function attackFromBehind({ targetX, attackerX, targetHeadsLeft, zoneWidth }) {
  const dx = attackerX - targetX;
  if (!Number.isFinite(dx) || Math.abs(dx) < zoneWidth) return false;
  return targetHeadsLeft ? dx > 0 : dx < 0;
}

/**
 * Whether a starship's token should face left (be mirrored). Heading 0 is left-to-right for the party's
 * starship and right-to-left for NPC starships; ship art is assumed to face right unless `artFacesLeft`.
 */
export function tokenFacesLeft(kind, heading, artFacesLeft = false) {
  const h = normalizeHeading(heading);
  const left = kind === "pc" ? h === 180 : h === 0;
  return artFacesLeft ? !left : left;
}

/** An NPC starship's spell attack modifier from GM Core's table at its level (default tier: high). */
export function npcSpellAttack(level, tier = "high") {
  const row = clamp(int(level, 0), -1, 24) + 1;
  const t = SPELL_TIERS.includes(tier) ? tier : "high";
  return SPELL_ATTACK[row][SPELL_TIERS.indexOf(t)];
}

/**
 * Spell slots a caster can expend to cast a leveled starship spell (rank 1 or higher). `sources` describe their
 * spellcasting entries: { id, name, mode: "prepared" | "spontaneous" | "flexible",
 * slots: { [rank]: { value, max, prepared: [{ id, expended, name }] } } }. A prepared caster gives up an
 * unexpended prepared spell; spontaneous and flexible casters use one of the rank's remaining slots.
 */
export function availableSlots(sources) {
  const out = [];
  for (const src of sources ?? []) {
    for (const [rankKey, slot] of Object.entries(src.slots ?? {})) {
      const rank = Number(rankKey);
      if (!slot || !(rank >= 1)) continue;
      if (src.mode === "prepared") {
        (slot.prepared ?? []).forEach((p, index) => {
          if (p.id && !p.expended) {
            out.push({ key: `${src.id}|${rank}|${index}`, entryId: src.id, rank, index, label: `Rank ${rank} — ${src.name}: ${p.name || "prepared spell"}` });
          }
        });
      } else if (Number(slot.value) > 0) {
        out.push({ key: `${src.id}|${rank}|-1`, entryId: src.id, rank, index: -1, label: `Rank ${rank} — ${src.name} (${slot.value} of ${slot.max} left)` });
      }
    }
  }
  return out.sort((a, b) => b.rank - a.rank);
}

/** Transfer Vitality limit: up to 10 HP, +10 at 5th, 10th, 15th and 20th level. */
export const vitalityTransferCap = (level) => 10 * (1 + Math.floor(Math.max(1, Math.trunc(level) || 1) / 5));

/** Vitality network regain at the start of each turn: 4, or 6 at master spell DC, or 8 at legendary. */
export const vitalityRegen = (spellRank) => (spellRank >= 4 ? 8 : spellRank >= 3 ? 6 : 4);

/** How much Transmute Vitality can move into the starship: limited by the cap, the network and missing Hull Points. */
export function vitalityTransfer({ requested, cap, network, hp, hpMax }) {
  const most = Math.max(0, Math.min(cap, network, hpMax - hp));
  return requested === undefined || requested === null ? most : clamp(Math.trunc(requested) || 0, 0, most);
}

/** Rank a cantrip is automatically heightened to. */
export const cantripRank = (level) => Math.max(1, Math.ceil(level / 2));

/**
 * Magic conduit spell repository at a rank: Cosmic Bombardment (503), Cosmic Cannon (504),
 * Cosmic Fortification (505) and Cosmic Repairs (506).
 */
export function cosmicSpell(id, rank, actions = 1) {
  const r = Math.max(1, Math.trunc(rank) || 1);
  if (id === 503) {
    const missiles = clamp(Math.trunc(actions) || 1, 1, 3) * (1 + Math.floor((r - 1) / 2));
    return { formula: `${missiles}d4+${missiles}`, type: "force", missiles };
  }
  if (id === 504) return { formula: `${1 + r}d4`, type: "force" };
  if (id === 505) return { formula: `${r}d4+${4 * r}`, restores: "sp" };
  if (id === 506) return { formula: `${r}d8+${8 * r}`, restores: "hp" };
  return null;
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
    // Conditions (off-guard) are left to the system, which applies them to the vehicle's own AC.
    "system.attributes.ac.value": derived.ac.total - (derived.ac.offGuard ?? 0),
    "system.saves.fortitude.value": derived.saves.fortitude.total,
    "system.details.speed": `${derived.speed} zones`,
    "system.traits.size.value": "med"
  };
}
