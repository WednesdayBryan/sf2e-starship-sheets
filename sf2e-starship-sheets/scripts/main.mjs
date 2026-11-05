/**
 * SF2e Starship Sheets: Foundry glue.
 * Player starships are system `vehicle` actors and NPC starships are system `npc` actors; all starship data is
 * stored in flags, so disabling this module never leaves the world with actors it can't load.
 */
import {
  CREW_QUARTERS_TYPES, PASSENGER_QUARTERS_TYPES,
  ACTIONS, AON, EXPANSION_BAY_OPTIONS, FRAMES, MODULE_ID, NPC_STATION_ACTIONS, NPC_STATIONS, NPC_WEAPONS, SAVE_LABELS, SKILL_LABELS,
  npcActionByKey
} from "./data.mjs";
import {
  DEGREE_LABELS, applyHullRepair, applyShieldGain, applyShipDamage, cantripRank, cosmicSpell, defaultNPCShip, defaultPCShip,
  degreeOfSuccess, derivePCShip, frameRow, hullIntegrity, normalizeHeading, novaBlastDamage, novaEffects, novaWeaponDamage, npcSpellAttack, npcWeapon, attackFromBehind, availableSlots, bayCount, vitalityTransferCap, vitalityRegen, vitalityTransfer,
  npcWeaponOffKilter, conditionPenalty, npcWeaponConditions, expiringItems, ACTION_OUTCOME_CONDITIONS, tokenFacesLeft, ventPowerDice, vehicleSync
} from "./logic.mjs";
import { costGlyph, esc, renderNPCSheet, renderPCSheet, signed } from "./render.mjs";

const { ActorSheetV2 } = foundry.applications.sheets;
const { DialogV2 } = foundry.applications.api;
const fu = foundry.utils;
const FLAG = `flags.${MODULE_ID}.ship`;

/* ------------------------------ ship data access ------------------------------ */

export function getShip(actor) {
  const stored = actor?.flags?.[MODULE_ID]?.ship;
  const base = actor?.type === "npc" ? defaultNPCShip() : defaultPCShip(stored?.frame, stored?.level);
  if (!stored) return base;
  const ship = fu.mergeObject(base, fu.deepClone(stored), { inplace: false });
  if (Array.isArray(stored.stations)) ship.stations = fu.deepClone(stored.stations);
  if (Array.isArray(stored.bays)) ship.bays = fu.deepClone(stored.bays);
  if (ship.kind === "pc") {
    ship.stations = ship.stations.map((s) => ({ upgrades: [], weapons: [], gradeOverride: "", helmer: "", malfunctioning: false, ...s }));
  }
  return ship;
}

export const isStarship = (actor) => !!actor?.flags?.[MODULE_ID]?.ship;

/** The crew member's best spellcasting entry (starship spells exist in all four traditions). */
function spellcastingEntry(actor) {
  const entries = (actor?.itemTypes?.spellcastingEntry ?? []).filter((e) => Number.isFinite(e.statistic?.check?.mod));
  return entries.sort((x, y) => y.statistic.check.mod - x.statistic.check.mod)[0] ?? null;
}

/** "photon", "graviton" or null, from the solarian's stellar attunement toggle on their character sheet. */
function stellarAttunement(actor) {
  const options = actor?.getRollOptions?.(["all"]) ?? [];
  if (options.includes("stellar-attunement:photon")) return "photon";
  if (options.includes("stellar-attunement:graviton")) return "graviton";
  return null;
}

/** The solarian's solar weapon and solar flare Strikes (granted by the system while attuned). */
function solarStrikes(actor) {
  const strikes = actor?.system?.actions ?? [];
  // The system names the solar weapon Strike after its crystals, e.g. "Advanced Solar Weapon (Photon)".
  const find = (slug, pattern) => {
    const matches = strikes
      .map((strike, index) => ({ strike, index }))
      .filter(({ strike: s }) => s.type === "strike" && (s.slug === slug || s.item?.slug === slug || pattern.test(s.label ?? s.item?.name ?? "")));
    return matches.sort((a, b) => (b.strike.totalModifier ?? 0) - (a.strike.totalModifier ?? 0))[0] ?? null;
  };
  return { weapon: find("solar-weapon", /solar weapon/i), flare: find("solar-flare", /solar flare/i) };
}

/** A Strike's weapon traits (after the system's trait alterations, e.g. the solar weapon's chosen traits). */
function strikeTraits(strike) {
  const item = strike?.item;
  return [...(item?.traits ?? []), ...(item?.system?.traits?.value ?? [])].map(String);
}

/** Number of weapon damage dice, including a striking crystal. */
function strikeDice(strike) {
  const system = strike?.item?.system;
  return Math.max(system?.damage?.dice ?? 1, 1 + (Number(system?.runes?.striking) || 0));
}

/**
 * Nova weapon damage: the solar weapon Strike's own damage (crystals, Strength, photon fire and all) with its
 * weapon dice made d10s. Falls back to the module's own formula if the system's formula isn't available.
 */
async function rollNovaWeaponDamage(info, strike, { event, critical, speaker }) {
  const method = critical ? strike.critical : strike.damage;
  // Without reach, the nova weapon deals the solar weapon's own damage, so the system rolls it as is.
  if (!info.solarWeapon?.reach) return method?.call(strike, { event });
  let formula = null;
  try {
    formula = await method?.call(strike, { event, getFormula: true });
  } catch (err) {
    console.warn(`${MODULE_ID} | Couldn't read the solar weapon's damage formula`, err);
  }
  const flavor = `<strong>Nova weapon</strong> (${esc(strike.label ?? "solar weapon")}) ${critical ? "critical " : ""}damage — d10 dice (solar weapon has reach)`;
  const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");
  if (typeof formula === "string" && DamageRoll) {
    const novaFormula = formula.replace(/(\d+)d(?:4|6|8|10|12)\b/, "$1d10");
    try {
      const roll = new DamageRoll(novaFormula);
      await roll.evaluate();
      return roll.toMessage({ speaker, flavor });
    } catch (err) {
      console.warn(`${MODULE_ID} | Nova damage from the system formula failed, using the module's formula`, err);
    }
  }
  return rollDamage({ parts: novaWeaponDamage(info.solarWeapon, info.str, info.level, info.attunement), critical, speaker, flavor });
}

function crewInfo(uuid) {
  const a = uuid ? fromUuidSync(uuid) : null;
  if (!a) return null;
  const att = a.system?.proficiencies?.attacks ?? {};
  const solar = solarStrikes(a);
  const weapon = solar.weapon?.strike;
  const weaponItem = weapon?.item?.system;
  return {
    name: a.name,
    actor: a,
    spellAttack: spellcastingEntry(a)?.statistic.check.mod ?? null,
    str: a.system?.abilities?.str?.mod ?? 0,
    attunement: stellarAttunement(a),
    solarWeapon: weapon
      ? {
          label: weapon.label ?? weapon.item?.name ?? "Solar Weapon",
          variants: (weapon.variants ?? []).map((v) => v.label),
          attack: weapon.totalModifier,
          agile: strikeTraits(weapon).includes("agile"),
          // A solar weapon with reach gives the nova weapon a d10 die instead (and the nova weapon loses reach).
          reach: strikeTraits(weapon).includes("reach"),
          die: weaponItem?.damage?.die ?? "d8",
          dice: strikeDice(weapon),
          type: weaponItem?.damage?.damageType ?? "bludgeoning"
        }
      : null,
    solarFlare: solar.flare ? { attack: solar.flare.strike.totalModifier, dice: strikeDice(solar.flare.strike) } : null,
    pilotDC: a.skills?.piloting?.dc?.value ?? null,
    dex: a.system?.abilities?.dex?.mod ?? 0,
    level: a.level ?? 0,
    ranks: { simple: att.simple?.rank ?? 0, martial: att.martial?.rank ?? 0, advanced: att.advanced?.rank ?? 0 },
    // Class proficiencies with their own definitions, e.g. an operative's "martial-simple-guns" and "advanced-guns".
    customAttacks: Object.entries(att)
      .filter(([, p]) => p?.definition && Number(p.rank) > 0)
      .map(([slug, p]) => ({ slug, label: p.label ?? slug, rank: Number(p.rank), definition: JSON.parse(JSON.stringify(p.definition)) })),
    specialization: weaponSpecialization(a),
    aim: aimInfo(a),
    vitality: vitalityInfo(a),
    classDC: a.classDC?.dc?.value ?? a.system?.attributes?.classDC?.value ?? null,
    primaryTarget: (a.itemTypes?.feat ?? []).some((f) => (f.slug ?? f.system?.slug) === "primary-target")
  };
}

/**
 * A mystic's vitality network (the system's "vitality-network" special resource): current and maximum Hit Points,
 * how much one Transfer Vitality can move, and how much it regains at the start of each turn.
 */
function vitalityInfo(actor) {
  const pool = actor?.getResource?.("vitality-network");
  if (!pool || !Number.isFinite(Number(pool.max)) || Number(pool.max) <= 0) return null;
  const spellRank = Math.max(0, ...(actor.itemTypes?.spellcastingEntry ?? []).map((e) => Number(e.statistic?.rank ?? e.system?.proficiency?.value) || 0));
  return { value: Number(pool.value) || 0, max: Number(pool.max), cap: vitalityTransferCap(actor.level ?? 1), regen: vitalityRegen(spellRank) };
}

/** "greater", "normal" or null, from the character's Weapon Specialization class features. */
function weaponSpecialization(actor) {
  const slugs = new Set((actor.itemTypes?.feat ?? []).map((f) => f.slug ?? f.system?.slug));
  if (slugs.has("greater-weapon-specialization")) return "greater";
  if (slugs.has("weapon-specialization")) return "normal";
  return null;
}

/** The operative's Aim while "Effect: Aim" is on them: precision dice from the system's operative flags. */
function aimInfo(actor) {
  const active = (actor.itemTypes?.effect ?? []).some((e) => (e.slug ?? e.system?.slug) === "effect-aim");
  if (!active) return null;
  const flags = actor.flags?.system?.operative?.aim ?? {};
  const level = actor.level ?? 1;
  return {
    dice: Number(flags.diceNumber) || (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1),
    die: Number(flags.dieSize) || 4
  };
}

/** Whether Aim applies against the current target: the targeted token must be the one marked by Aim. */
function aimHitsTarget(actor) {
  const marks = actor?.synthetics?.tokenMarks;
  const target = [...game.user.targets][0];
  if (!marks || !target) return true;
  // The system keeps a list of mark slugs per marked token (e.g. ["aim"]).
  const mark = marks.get(target.document?.uuid);
  return Array.isArray(mark) ? mark.includes("aim") : mark === "aim";
}

function crewMap(ship) {
  const map = {};
  for (const st of ship.stations ?? []) if (st.helmer && !map[st.helmer]) map[st.helmer] = crewInfo(st.helmer) ?? { name: "Missing crew member", missing: true };
  return map;
}

export function derivedFor(actor) {
  const ship = getShip(actor);
  return { ship, derived: derivePCShip(ship, crewMap(ship), shipStatus(actor)) };
}

/* ---------------------------------- conditions ---------------------------------- */

const CONDITIONS_PACK = "starship-conditions";

/** The custom Off-Kilter condition (an effect, since the system has no off-kilter condition). */
const OFF_KILTER = {
  name: "Off-Kilter",
  type: "effect",
  img: "icons/svg/windmill.svg",
  system: {
    slug: "off-kilter",
    description: {
      value: `<p>The starship is askew: a –2 circumstance penalty to attack rolls, Area Fire and Auto-Fire DCs, and Reflex saves, and it can't use station actions that would move it. Using Change Heading rights the starship and ends this condition.</p>
<p><a href="${AON}conditions/50-off-kilter" target="_blank" rel="noopener">Off-Kilter on Archives of Nethys</a></p>`
    },
    rules: [{ key: "FlatModifier", label: "Off-Kilter", slug: "off-kilter", selector: ["attack", "reflex"], type: "circumstance", value: -2 }],
    duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
    start: { value: 0, initiative: null },
    level: { value: 1 },
    tokenIcon: { show: true },
    traits: { value: [] }
  }
};

/** Lock On's effect on the target. The module removes it when the combat turn advances (end of the gunner's turn). */
const LOCKED_ON = {
  name: "Locked On",
  type: "effect",
  img: "icons/svg/target.svg",
  system: {
    slug: "locked-on",
    description: {
      value: `<p>A gunner has locked on to this starship. Until the end of that gunner's turn, it takes a –1 status penalty to AC against their Strikes and a –1 circumstance penalty to Reflex saves against their Area Fire and Auto-Fire.</p>
<p>Removed automatically when the combat turn advances.</p>
<p><a href="${AON}actions/591-lock-on" target="_blank" rel="noopener">Lock On on Archives of Nethys</a></p>`
    },
    rules: [
      { key: "FlatModifier", label: "Locked On", slug: "locked-on", selector: "ac", type: "status", value: -1 },
      { key: "FlatModifier", label: "Locked On (Area Fire / Auto-Fire)", slug: "locked-on-reflex", selector: "reflex", type: "circumstance", value: -1 }
    ],
    duration: { value: -1, unit: "unlimited", expiry: null, sustained: false },
    start: { value: 0, initiative: null },
    level: { value: 1 },
    tokenIcon: { show: true },
    traits: { value: [] }
  }
};

/** Effects that last until the end of the current turn: removed when the combat turn advances. */
const TURN_EFFECT_SLUGS = ["locked-on"];

/** An actor's conditions (frightened, clumsy, ...) as [{ slug, value }] for `conditionPenalty`. */
const actorConditions = (actor) =>
  (actor?.itemTypes?.condition ?? []).map((c) => ({ slug: c.slug ?? c.system?.slug, value: c.value ?? c.system?.value?.value ?? 1 }));

/** An NPC starship weapon at its level, with condition and off-kilter penalties. */
function npcWeaponView(actor, entry, index) {
  const w = npcWeaponConditions(npcWeapon(entry, actor.level, index), actorConditions(actor));
  return hasOffKilter(actor) ? npcWeaponOffKilter(w) : w;
}

/** "Includes frightened 2 (−2)." for a chat card, when a condition changed the roll. */
const conditionNote = (c) => (c?.penalty ? `<div>Includes ${esc(c.label)} (${c.penalty}).</div>` : "");

const hasOffKilter = (actor) => (actor?.itemTypes?.effect ?? []).some((e) => (e.slug ?? e.system?.slug) === "off-kilter");

/** Conditions on a starship that change its numbers. */
function shipStatus(actor) {
  return { offGuard: !!actor?.hasCondition?.("off-guard"), offKilter: hasOffKilter(actor) };
}

/**
 * Make sure the world has a "Starship Conditions" compendium holding Off-Kilter, and remember its UUID.
 * Only the active GM can create compendiums, so this runs on the GM's client.
 */
/** The custom starship effects in the world's Starship Conditions compendium, and the setting holding each UUID. */
const STARSHIP_EFFECTS = [[OFF_KILTER, "offKilterUuid"], [LOCKED_ON, "lockOnUuid"]];

/** The GM's client creates the Starship Conditions compendium and its effects (Off-Kilter, Locked On) if missing. */
export async function ensureOffKilter() {
  if (game.users.activeGM?.id !== game.user.id) return;
  let pack = null;
  for (const [effect, setting] of STARSHIP_EFFECTS) {
    const saved = game.settings.get(MODULE_ID, setting);
    if (saved && (await fromUuid(saved).catch(() => null))) continue;
    if (!pack) {
      const CC = foundry.documents.collections?.CompendiumCollection ?? globalThis.CompendiumCollection;
      pack = game.packs.get(`world.${CONDITIONS_PACK}`) ?? (await CC.createCompendium({ label: "Starship Conditions", name: CONDITIONS_PACK, type: "Item" }));
    }
    const entry = (await pack.getIndex()).find((e) => e.name === effect.name);
    const uuid = entry ? entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}` : (await Item.create(effect, { pack: pack.collection })).uuid;
    await game.settings.set(MODULE_ID, setting, uuid);
  }
}

/**
 * When the combat turn advances, remove effects that last until the end of a turn (Locked On) from every starship
 * on the combat's scene and every actor in the world. Run by the active GM.
 */
export async function removeTurnEffects(combat, { ended = false } = {}) {
  const actors = new Set(game.actors ?? []);
  for (const t of (combat?.scene ?? canvas?.scene)?.tokens ?? []) if (t.actor) actors.add(t.actor);
  for (const c of combat?.combatants ?? []) if (c.actor) actors.add(c.actor);
  // At the start of this combatant's turn, 1-round starship conditions and "until your next turn" effects end.
  const now = { combat: combat?.id, combatant: combat?.combatant?.id, round: combat?.round };
  const expire = !ended && now.combatant && game.settings.get(MODULE_ID, "endRoundEffects");
  for (const actor of actors) {
    const ids = new Set((actor.itemTypes?.effect ?? []).filter((e) => TURN_EFFECT_SLUGS.includes(e.slug ?? e.system?.slug)).map((e) => e.id));
    if (expire) {
      const ship = isStarship(actor);
      const items = [...(actor.itemTypes?.condition ?? []), ...(actor.itemTypes?.effect ?? [])].map((i) => ({
        id: i.id, type: i.type, slug: i.slug ?? i.system?.slug, isStarship: ship, duration: i.system?.duration,
        appliedTurn: i.flags?.[MODULE_ID]?.appliedTurn, granted: !!(i.grantedBy ?? i.flags?.pf2e?.grantedBy)
      }));
      for (const id of expiringItems(items, now)) ids.add(id);
    }
    // The system may already have removed an expired effect: only delete what's still there.
    const present = [...ids].filter((id) => actor.items?.get ? actor.items.get(id) : true);
    if (present.length) await actor.deleteEmbeddedDocuments("Item", present).catch((err) => console.warn(`${MODULE_ID} | Couldn't remove expired effects from ${actor.name}`, err));
  }
}

/** Record whose turn it is when a condition or effect is added during combat, so it can end at the right time. */
function recordAppliedTurn(item) {
  const combat = game.combat;
  if (!combat?.started || !combat.combatant || !["condition", "effect"].includes(item.type)) return;
  item.updateSource({ [`flags.${MODULE_ID}.appliedTurn`]: { combat: combat.id, combatant: combat.combatant.id, round: combat.round } });
}

/** UUID of a system condition (e.g. Off-Guard) in the system's condition compendium. */
async function systemConditionUuid(name) {
  for (const pack of game.packs) {
    if (pack.documentName !== "Item" || pack.metadata.packageType !== "system") continue;
    const index = await pack.getIndex({ fields: ["type"] });
    const entry = index.find((e) => e.name === name && e.type === "condition");
    if (entry) return entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`;
  }
  return null;
}

const CONDITION_NAMES = { "off-guard": "Off-Guard", "off-kilter": "Off-Kilter" };

/** After a station action's check, post the conditions its result puts on the target as draggable links. */
async function postOutcomeConditions(actionId, degree, speakerActor) {
  const slugs = ACTION_OUTCOME_CONDITIONS[actionId]?.[degree];
  if (!slugs?.length) return;
  const links = [];
  for (const slug of slugs) {
    const uuid = slug === "off-kilter" ? game.settings.get(MODULE_ID, "offKilterUuid") : await systemConditionUuid(CONDITION_NAMES[slug]);
    links.push(uuid ? `@UUID[${uuid}]{${CONDITION_NAMES[slug]}}` : `<strong>${CONDITION_NAMES[slug]}</strong>`);
  }
  const target = [...game.user.targets][0];
  const a = ACTIONS[actionId];
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: speakerActor }),
    content: `<div class="sss-chat">
      <header><strong>${esc(a.name)}: ${DEGREE_LABELS[degree]}</strong></header>
      <p>${target ? esc(target.name) : "The target"} is ${slugs.map((s) => CONDITION_NAMES[s].toLowerCase()).join(" and ")} for 1 round.</p>
      <p>Drag onto the enemy starship's token: ${links.join(" ")}</p>
      ${game.settings.get(MODULE_ID, "endRoundEffects") ? `<p class="sss-hint">Removed automatically at the start of this crew member's next turn.</p>` : ""}
    </div>`
  });
}

/** Current damage state of any starship actor. */
function damageState(actor) {
  const ship = getShip(actor);
  const hp = actor.system.attributes.hp;
  const spMax = ship.kind === "pc" ? frameRow(ship.frame, ship.level)[2] : ship.spMax;
  return { ship, spMax, state: { hp: hp.value, hpMax: hp.max, sp: ship.sp, compromised: ship.compromised, wrecked: ship.wrecked, destroyed: ship.destroyed } };
}

/** Write a damage/repair result back onto the actor. */
async function writeState(actor, ship, result, { malfunctionAll = false } = {}) {
  const next = { ...ship, sp: result.sp, compromised: result.compromised, wrecked: result.wrecked, destroyed: result.destroyed };
  if (malfunctionAll) next.stations = ship.stations.map((s) => ({ ...s, malfunctioning: s.type ? true : s.malfunctioning }));
  await actor.update({ "system.attributes.hp.value": result.hp, [FLAG]: next }, { [MODULE_ID]: true });
}

async function postNotes(actor, title, notes) {
  if (!notes?.length) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="sss-chat"><strong>${esc(title)}</strong><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`
  });
}

/* ---------------------------------- rolls ---------------------------------- */

/** Roll damage, as the system's damage roll when possible so its apply-damage buttons appear. `parts` mixes types. */
async function rollDamage({ formula, type, parts, critical = false, flavor, speaker }) {
  parts ??= [{ formula, type }];
  const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");
  let roll = null;
  if (DamageRoll) {
    try {
      const instances = parts.map((p) => (critical ? `(2*(${p.formula}))[${p.type}]` : `(${p.formula})[${p.type}]`));
      roll = new DamageRoll(`{${instances.join(",")}}`);
      await roll.evaluate();
    } catch (err) {
      console.warn(`${MODULE_ID} | System damage roll failed, using a plain roll`, err);
      roll = null;
    }
  }
  if (!roll) {
    const sum = parts.map((p) => `(${p.formula})`).join(" + ");
    roll = new Roll(critical ? `2*(${sum})` : sum);
    await roll.evaluate();
  }
  return roll.toMessage({ speaker, flavor });
}

/* ---------------------------------- effects ---------------------------------- */

/** Add temporary effects to a starship (the caller must be able to update it). */
async function addEffects(actor, effects) {
  const ship = getShip(actor);
  const added = effects.map((e) => ({ ...e, id: fu.randomID() }));
  await actor.update({ [`${FLAG}.effects`]: [...(ship.effects ?? []), ...added] }, { [MODULE_ID]: true });
}

/** Put effects on the targeted starship; the active GM applies them when the user can't. */
async function applyEffectsToTarget(effects) {
  if (!effects.length) return;
  const target = [...game.user.targets][0]?.actor;
  if (!target || !isStarship(target)) {
    ui.notifications.info(`Apply to the target: ${effects.map((e) => e.label).join("; ")}`);
    return;
  }
  if (target.isOwner) return addEffects(target, effects);
  if (!game.users.activeGM) return ui.notifications.warn("A GM must be connected to apply effects to that starship.");
  game.socket.emit(`module.${MODULE_ID}`, { type: "addEffects", uuid: target.uuid, effects });
}

/** A DC (perception, fortitude, reflex or will) of the first targeted token, if any. */
function targetDC(kind) {
  const target = [...game.user.targets][0]?.actor;
  if (!target) return null;
  let value = null;
  if (target.type === "vehicle" && isStarship(target)) {
    const save = derivedFor(target).derived.saves[kind];
    value = save ? 10 + save.total : null;
  } else {
    value = kind === "perception" ? target.perception?.dc?.value : target.saves?.[kind]?.dc?.value;
  }
  return Number.isFinite(value) ? { value, label: `${target.name}'s ${kind === "perception" ? "Perception" : SAVE_LABELS[kind]} DC` } : null;
}

/** The helmer's DC a target saves against: a skill DC or their class DC. */
function helmerDC(helmer, check) {
  if (!helmer) return null;
  if (check.dcClass) {
    const value = helmer.classDC?.dc?.value ?? helmer.system?.attributes?.classDC?.value;
    return Number.isFinite(value) ? { value, label: "class DC" } : null;
  }
  const value = helmer.skills?.[check.dcSkill]?.dc?.value;
  return Number.isFinite(value) ? { value, label: `${SKILL_LABELS[check.dcSkill]} DC` } : null;
}

/** AC of the first targeted token, if any. */
/** The starship's token on the current scene, if any. */
function shipToken(actor) {
  const tokens = actor?.getActiveTokens?.() ?? [];
  return tokens.find((t) => t.scene?.id === canvas?.scene?.id) ?? tokens[0] ?? null;
}

/** Whether the attacking starship is behind the targeted starship (so the target is off-guard to the attack). */
function behindTarget(attacker) {
  const target = [...game.user.targets][0];
  if (!target?.actor || !isStarship(target.actor) || !attacker) return false;
  const source = shipToken(attacker);
  if (!source || source === target) return false;
  const ship = getShip(target.actor);
  const zones = Number(game.settings.get(MODULE_ID, "zoneWidth")) || 1;
  return attackFromBehind({
    targetX: target.center?.x,
    attackerX: source.center?.x,
    targetHeadsLeft: tokenFacesLeft(ship.kind, ship.heading, false),
    zoneWidth: (canvas?.grid?.size ?? 100) * zones
  });
}

/**
 * The targeted starship's AC for an attack from `attacker`: -2 when attacked from behind (off-guard), unless the
 * target is already off-guard.
 */
function targetAC(attacker = null) {
  const target = [...game.user.targets][0]?.actor;
  if (!target) return null;
  let ac;
  let offGuard;
  if (target.type === "vehicle" && isStarship(target)) {
    const derived = derivedFor(target).derived;
    ac = derived.ac.total;
    offGuard = derived.conditions?.offGuard;
  } else {
    const base = target.attributes?.ac?.value ?? target.system?.attributes?.ac?.value;
    // An NPC starship's Evade or Stick to Cover adds a circumstance bonus on top of its stat block AC.
    ac = Number.isFinite(base) ? base + (isStarship(target) ? Number(getShip(target).acCircumstance) || 0 : 0) : NaN;
    offGuard = !!target.hasCondition?.("off-guard");
  }
  if (!Number.isFinite(ac)) return null;
  const behind = !offGuard && behindTarget(attacker);
  return { name: target.name, ac: behind ? ac - 2 : ac, behind };
}

/** What a starship sheet shows about the user's target: the first targeted token, which attacks are rolled against. */
function targetInfo(attacker) {
  const tokens = [...(game.user?.targets ?? [])];
  if (!tokens.length) return null;
  const actor = tokens[0].actor;
  const t = targetAC(attacker);
  return {
    name: tokens[0].name ?? actor?.name ?? "Unknown",
    img: actor?.img ?? "",
    ac: t?.ac ?? null,
    behind: !!t?.behind,
    starship: !!actor && isStarship(actor),
    self: !!actor && actor === attacker,
    count: tokens.length
  };
}

/**
 * The party starship's crew for the combat tracker: the active party's characters and every station's helmer.
 * With neither, every character a player owns.
 */
function crewForCombat(ship) {
  const crew = new Map();
  const add = (a) => {
    if (a?.type === "character" && !crew.has(a.id)) crew.set(a.id, a);
  };
  for (const member of game.actors.party?.members ?? []) add(member);
  for (const st of ship.stations ?? []) if (st.helmer) add(fromUuidSync(st.helmer));
  if (!crew.size) for (const a of game.actors) if (a.hasPlayerOwner) add(a);
  return [...crew.values()];
}

/** For attacks the system rolls itself: +2 to the attack instead of -2 to the AC when attacking from behind. */
function behindModifiers(attacker) {
  const target = [...game.user.targets][0]?.actor;
  if (!behindTarget(attacker) || target?.hasCondition?.("off-guard")) return undefined;
  const Modifier = game.pf2e?.Modifier ?? game.sf2e?.Modifier;
  return Modifier ? [new Modifier({ slug: "off-guard-from-behind", label: "Target off-guard (attacked from behind)", modifier: 2 })] : undefined;
}

async function rollCheck({ label, mod, speaker, dc = null, extra = "" }) {
  const roll = new Roll("1d20 + @mod", { mod });
  await roll.evaluate();
  const die = roll.dice[0]?.total ?? 0;
  let outcome = "";
  let degree = null;
  if (dc) {
    degree = degreeOfSuccess(roll.total, die, dc.ac);
    outcome = `<div class="sss-outcome sss-degree-${degree}">vs ${esc(dc.name)} (AC ${dc.ac}${dc.behind ? ", off-guard: attacked from behind" : ""}): <strong>${DEGREE_LABELS[degree]}</strong></div>`;
  }
  await roll.toMessage({ speaker, flavor: `<strong>${esc(label)}</strong> ${extra}${outcome}` });
  return { degree };
}

/* ---------------------------------- images ---------------------------------- */

const DEFAULT_ICONS = ["icons/svg/mystery-man.svg", "icons/svg/target.svg"];

/** Open the file picker for the portrait ("img") or the token ("token"). */
function pickImage(sheet, target) {
  if (!sheet.isEditable) return;
  const actor = sheet.document;
  const current = target === "token" ? actor.prototypeToken.texture.src : actor.img;
  const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  new FP({ type: "image", current, callback: (path) => setImage(actor, path, target) }).render(true);
}

/**
 * A new portrait also becomes the token image while the token still shows the old portrait or a default icon,
 * matching the system's own sheets. Linked tokens already on the current scene follow the token image.
 */
export async function setImage(actor, path, target) {
  const tokenSrc = actor.prototypeToken.texture.src;
  const update = {};
  if (target === "token") update["prototypeToken.texture.src"] = path;
  else {
    update.img = path;
    if (!tokenSrc || tokenSrc === actor.img || DEFAULT_ICONS.includes(tokenSrc)) update["prototypeToken.texture.src"] = path;
  }
  await actor.update(update, { [MODULE_ID]: true });

  if (!update["prototypeToken.texture.src"] || !actor.prototypeToken.actorLink || !canvas?.scene) return;
  const tokens = canvas.scene.tokens.filter((t) => t.actorId === actor.id && t.actorLink && t.isOwner).map((t) => ({ _id: t.id, "texture.src": path }));
  if (tokens.length) await canvas.scene.updateEmbeddedDocuments("Token", tokens);
}

/* ---------------------------------- heading ---------------------------------- */

/** Horizontal token scale for a starship's heading, keeping the token's current size. */
const headingScale = (actor, texture) => {
  const ship = getShip(actor);
  const sign = tokenFacesLeft(ship.kind, ship.heading, ship.artFacesLeft) ? -1 : 1;
  return sign * Math.abs(Number(texture?.scaleX) || 1);
};

/**
 * Mirror a starship's tokens to match its heading: a token-only (unlinked) starship turns just that token;
 * otherwise the prototype token and every linked token of the starship the user can update.
 */
export async function applyHeading(actor) {
  if (actor.isToken) {
    const token = actor.token;
    if (token?.isOwner) await token.update({ "texture.scaleX": headingScale(actor, token.texture) });
    return;
  }
  await actor.update({ "prototypeToken.texture.scaleX": headingScale(actor, actor.prototypeToken.texture) }, { [MODULE_ID]: true });
  for (const scene of game.scenes ?? []) {
    const updates = scene.tokens
      .filter((t) => t.actorId === actor.id && t.actorLink && t.isOwner)
      .map((t) => ({ _id: t.id, "texture.scaleX": headingScale(actor, t.texture) }));
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }
}

/**
 * Change Heading: reverse the starship's heading (turning its tokens) and end off-kilter, both the Off-Kilter
 * effect and the off-kilter part of a module effect such as a graviton Nova Blast's (its Speed penalty stays).
 * Returns a sentence for the chat card.
 */
export async function changeHeading(actor) {
  const ship = getShip(actor);
  const heading = normalizeHeading(ship.heading) === 180 ? 0 : 180;
  const wasModuleOffKilter = (ship.effects ?? []).some((e) => e.offKilter);
  const effects = (ship.effects ?? []).map((e) =>
    e.offKilter ? { ...e, offKilter: false, label: String(e.label).replace(/^off-kilter,\s*/i, "") } : e
  );
  await actor.update({ [`${FLAG}.heading`]: heading, [`${FLAG}.effects`]: effects }, { [MODULE_ID]: true });
  await applyHeading(actor);
  const offKilter = (actor.itemTypes?.effect ?? []).filter((e) => (e.slug ?? e.system?.slug) === "off-kilter").map((e) => e.id);
  if (offKilter.length) await actor.deleteEmbeddedDocuments("Item", offKilter);
  const facing = tokenFacesLeft(ship.kind, heading, ship.artFacesLeft) ? "← right to left" : "→ left to right";
  return `Heading is now ${heading}° (${facing})${offKilter.length || wasModuleOffKilter ? "; the starship is no longer off-kilter" : ""}.`;
}

/* ---------------------------------- spell slots ---------------------------------- */

/** A caster's slot-based spellcasting entries in the plain form `availableSlots` expects. */
function slotSources(actor) {
  return (actor?.itemTypes?.spellcastingEntry ?? [])
    .filter((e) => e.isPrepared || e.isSpontaneous)
    .map((e) => ({
      id: e.id,
      name: e.name,
      mode: e.isFlexible ? "flexible" : e.isPrepared ? "prepared" : "spontaneous",
      slots: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => {
          const s = e.system?.slots?.[`slot${rank}`];
          const prepared = (s?.prepared ?? []).map((p) => ({ id: p?.id ?? null, expended: !!p?.expended, name: p?.id ? actor.items?.get(p.id)?.name ?? "" : "" }));
          return [rank, s ? { value: Number(s.value) || 0, max: Number(s.max) || 0, prepared } : null];
        })
      ),
      // The entry's leveled spells (its repertoire, for spontaneous casters).
      spells: (actor.itemTypes?.spell ?? [])
        .filter((sp) => sp.system?.location?.value === e.id && !sp.isCantrip && !sp.isFocusSpell && !sp.isRitual)
        .map((sp) => ({ name: sp.name, rank: Number(sp.baseRank ?? sp.system?.level?.value) || 1, signature: !!sp.system?.location?.signature }))
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    }));
}

/** Mark a spell slot as used on the caster's sheet: a prepared spell becomes expended, or one slot is spent. */
async function expendSlot(actor, slot) {
  const entry = actor.items?.get(slot.entryId);
  if (!entry) return false;
  if (slot.index >= 0) return !!(await entry.setSlotExpendedState(slot.rank, slot.index, true));
  const value = Number(entry.system?.slots?.[`slot${slot.rank}`]?.value) || 0;
  if (value <= 0) return false;
  await entry.update({ [`system.slots.slot${slot.rank}.value`]: value - 1 });
  return true;
}

/** The Cast dialog's spell choices, grouped by spellcasting entry. */
export function slotOptionsHtml(options) {
  const groups = new Map();
  for (const o of options) {
    const name = o.entryName ?? "";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(o);
  }
  // The group already names the entry: "Rank 2 — Heal (2 of 3 left)", or "Rank 2 slot (2 of 3 left)" with no spell listed.
  const option = (o) => `<option value="${esc(o.key)}">${esc(o.label.replace(`${o.entryName}: `, "").replace(` — ${o.entryName} `, " slot "))}</option>`;
  return [...groups].map(([name, list]) => (name ? `<optgroup label="${esc(name)}">${list.map(option).join("")}</optgroup>` : list.map(option).join(""))).join("");
}

/** Choose which spell (and its slot) to expend, and for Cosmic Bombardment the actions spent. */
async function castDialog(title, options, withActions) {
  const content = `<div class="form-group"><label>Spell to expend</label>
      <select name="slot">${slotOptionsHtml(options)}</select></div>
    ${withActions ? `<div class="form-group"><label>Actions spent (1–3)</label><input type="number" name="actions" value="3" min="1" max="3"></div>` : ""}
    <p class="hint">The starship spell is cast at the chosen spell's slot rank, and that spell or slot is marked as used on the character sheet.</p>`;
  const result = await DialogV2.wait({
    window: { title },
    content,
    buttons: [{
      action: "cast",
      label: "Cast",
      default: true,
      callback: (event, button) => {
        const f = button.form.elements;
        return { slot: options.find((o) => o.key === f.slot.value), actions: withActions ? Number(f.actions.value) || 1 : 1 };
      }
    }],
    rejectClose: false
  }).catch(() => null);
  return result && typeof result === "object" && result.slot ? result : null;
}

/* ---------------------------------- dialogs ---------------------------------- */

async function numberDialog(title, fields, okLabel = "Apply") {
  const content = fields
    .map((f) =>
      f.type === "checkbox"
        ? `<div class="form-group"><label><input type="checkbox" name="${f.name}"> ${esc(f.label)}</label></div>`
        : `<div class="form-group"><label>${esc(f.label)}</label><input type="number" name="${f.name}" value="${f.value ?? ""}" min="0" autofocus></div>`
    )
    .join("");
  const result = await DialogV2.wait({
    window: { title },
    content,
    buttons: [{
      action: "ok",
      label: okLabel,
      default: true,
      callback: (event, button) => {
        const out = {};
        for (const f of fields) {
          const el = button.form.elements[f.name];
          out[f.name] = f.type === "checkbox" ? el.checked : Number(el.value) || 0;
        }
        return out;
      }
    }],
    rejectClose: false
  }).catch(() => null);
  return result && typeof result === "object" ? result : null;
}

/* ---------------------------------- sheets ---------------------------------- */

class StarshipSheetBase extends ActorSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["sf2e-starship-sheets"],
    position: { width: 900, height: 860 },
    window: { resizable: true, icon: "fa-solid fa-rocket" },
    form: { handler: StarshipSheetBase.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      // Not "tab": Foundry's applications reserve that action for their own tab groups.
      sssTab: StarshipSheetBase.#onTab,
      editImage: StarshipSheetBase.#onEditImage,
      editToken: StarshipSheetBase.#onEditToken,
      setCompromised: StarshipSheetBase.#onSetCompromised,
      hullIntegrity: StarshipSheetBase.#onHullIntegrity,
      clearDestroyed: StarshipSheetBase.#onClearDestroyed,
      damage: StarshipSheetBase.#onDamage,
      repairHull: StarshipSheetBase.#onRepairHull,
      restoreShields: StarshipSheetBase.#onRestoreShields,
      removeEffect: StarshipSheetBase.#onRemoveEffect,
      rollPersistent: StarshipSheetBase.#onRollPersistent
    }
  };

  _tab = null;

  get title() {
    return this.document.name;
  }

  get ship() {
    return getShip(this.document);
  }

  async _renderHTML(context) {
    return this.renderSheet(context);
  }

  /** Redraw the sheet, keeping the scroll position so edits near the bottom don't jump to the top. */
  _replaceHTML(result, content) {
    const scrollTop = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = scrollTop;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const el of this.element.querySelectorAll("[data-action-change]")) {
      el.addEventListener("change", (event) => {
        event.stopPropagation();
        this.onActionChange(el.dataset.actionChange, el, event);
      });
    }
  }

  /** Apply submitted form values; `ship.*` names edit the module flag. */
  static async #onSubmit(event, form, formData) {
    const actor = this.document;
    const ship = this.ship;
    const before = fu.deepClone(ship);
    const update = {};
    for (const [key, value] of Object.entries(formData.object)) {
      if (key.startsWith("ship.")) fu.setProperty(ship, key.slice(5), value);
      else update[key] = value;
    }
    ship.heading = normalizeHeading(ship.heading);
    ship.artFacesLeft = !!ship.artFacesLeft;
    this.normalizeShip(ship, before, update);
    update[FLAG] = ship;
    await actor.update(update, { [MODULE_ID]: true });
    if (ship.heading !== normalizeHeading(before.heading) || ship.artFacesLeft !== !!before.artFacesLeft) await applyHeading(actor);
  }

  normalizeShip() {}

  async updateShip(mutator) {
    const ship = this.ship;
    const before = fu.deepClone(ship);
    mutator(ship);
    const update = {};
    this.normalizeShip(ship, before, update);
    update[FLAG] = ship;
    return this.document.update(update, { [MODULE_ID]: true });
  }

  onActionChange() {}

  static #onTab(event, target) {
    this._tab = target.dataset.tab;
    this.render();
  }

  static #onEditImage() {
    return pickImage(this, "img");
  }

  static #onEditToken() {
    return pickImage(this, "token");
  }

  static async #onSetCompromised(event, target) {
    const value = Number(target.dataset.value) || 0;
    await this.updateShip((s) => {
      s.compromised = value;
      s.destroyed = value >= 10;
    });
  }

  static async #onHullIntegrity() {
    const ship = this.ship;
    if (!ship.compromised) return;
    const roll = new Roll("1d20");
    await roll.evaluate();
    const r = hullIntegrity(ship.compromised, roll.total);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<strong>Hull Integrity Check</strong> (flat DC ${r.dc}): <strong>${r.label}</strong> — compromised ${ship.compromised} → ${r.compromised}${r.destroyed ? " — <strong>DESTROYED</strong>" : ""}`
    });
    await this.updateShip((s) => {
      s.compromised = r.compromised;
      s.destroyed = r.destroyed;
    });
  }

  static async #onClearDestroyed() {
    await this.updateShip((s) => {
      s.destroyed = false;
      if (s.compromised >= 10) s.compromised = 9;
    });
  }

  static async #onDamage() {
    const input = await numberDialog(`Damage ${this.document.name}`, [
      { name: "amount", label: "Damage" },
      { name: "bypass", label: "Bypassing (ignores Shield Points)", type: "checkbox" },
      { name: "critical", label: "Critical hit / critically failed save", type: "checkbox" }
    ]);
    if (!input) return;
    const { ship, state } = damageState(this.document);
    const result = applyShipDamage(state, input);
    await writeState(this.document, ship, result, { malfunctionAll: result.malfunctionAll });
    await postNotes(this.document, `${this.document.name} takes ${input.amount} damage`, result.notes);
  }

  static async #onRepairHull() {
    const input = await numberDialog(`Restore Hull Points: ${this.document.name}`, [{ name: "amount", label: "Hull Points restored" }]);
    if (!input) return;
    const { ship, state } = damageState(this.document);
    const result = applyHullRepair(state, input.amount);
    await writeState(this.document, ship, result);
    await postNotes(this.document, `${this.document.name} repairs its hull`, result.notes);
  }

  static async #onRemoveEffect(event, target) {
    const index = Number(target.dataset.index);
    await this.updateShip((s) => s.effects.splice(index, 1));
  }

  static async #onRollPersistent(event, target) {
    const effect = this.ship.effects?.[Number(target.dataset.index)];
    if (!effect?.persistent) return;
    await rollDamage({
      ...effect.persistent,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<strong>Persistent ${esc(effect.persistent.type)} damage</strong> on ${esc(this.document.name)}`
    });
  }

  static async #onRestoreShields() {
    const input = await numberDialog(`Restore Shield Points: ${this.document.name}`, [{ name: "amount", label: "Shield Points restored" }]);
    if (!input) return;
    const { ship, spMax, state } = damageState(this.document);
    const result = applyShieldGain(state, input.amount, spMax);
    await writeState(this.document, ship, result);
  }
}

/* ---------------------------------- PC sheet ---------------------------------- */

export class PCStarshipSheet extends StarshipSheetBase {
  static DEFAULT_OPTIONS = {
    classes: ["sss-app-pc"],
    actions: {
      rollSave: PCStarshipSheet.#onRollSave,
      postAction: PCStarshipSheet.#onPostAction,
      rollActionCheck: PCStarshipSheet.#onRollActionCheck,
      transmuteVitality: PCStarshipSheet.#onTransmuteVitality,
      vitalityRegen: PCStarshipSheet.#onVitalityRegen,
      addCrewToCombat: PCStarshipSheet.#onAddCrewToCombat,
      areaFire: PCStarshipSheet.#onAreaFire,
      areaDamage: PCStarshipSheet.#onAreaDamage,
      primaryTarget: PCStarshipSheet.#onPrimaryTarget,
      spellAttack: PCStarshipSheet.#onSpellAttack,
      spellDamage: PCStarshipSheet.#onSpellDamage,
      castSpell: PCStarshipSheet.#onCastSpell,
      novaStrike: PCStarshipSheet.#onNovaStrike,
      novaDamage: PCStarshipSheet.#onNovaDamage,
      novaBlast: PCStarshipSheet.#onNovaBlast,
      novaBlastDamage: PCStarshipSheet.#onNovaBlastDamage,
      generateShields: PCStarshipSheet.#onGenerateShields,
      ventPower: PCStarshipSheet.#onVentPower,
      strike: PCStarshipSheet.#onStrike,
      weaponDamage: PCStarshipSheet.#onWeaponDamage,
      removeUpgrade: PCStarshipSheet.#onRemoveUpgrade,
      removeWeapon: PCStarshipSheet.#onRemoveWeapon
    }
  };

  async _prepareContext(options) {
    const actor = this.document;
    const { ship, derived } = derivedFor(actor);
    const crewOptions = game.actors
      .filter((a) => a.type === "character" && a.testUserPermission(game.user, "LIMITED"))
      .map((a) => ({ uuid: a.uuid, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.#syncVehicle(derived);
    return {
      name: actor.name,
      img: actor.img,
      editable: this.isEditable,
      isGM: game.user.isGM,
      ship,
      derived,
      hp: { value: actor.system.attributes.hp.value, max: derived.hpMax },
      hpField: "system.attributes.hp.value",
      crewOptions,
      target: targetInfo(actor),
      tab: this._tab ?? "stations"
    };
  }

  renderSheet(context) {
    return renderPCSheet(context);
  }

  /** Keep the vehicle's own AC/HP/Fortitude in step (e.g. after the pilot's Piloting improves). Active GM only. */
  #syncing = false;
  #syncVehicle(derived) {
    const actor = this.document;
    if (this.#syncing || game.users.activeGM?.id !== game.user.id) return;
    const wanted = vehicleSync(derived, actor.system.attributes.hp.value);
    const changed = Object.entries(wanted).some(([k, v]) => fu.getProperty(actor._source, k) !== v);
    if (!changed) return;
    this.#syncing = true;
    actor.update(wanted, { [MODULE_ID]: true }).finally(() => (this.#syncing = false));
  }

  normalizeShip(ship, before, update) {
    ship.level = Math.clamp(Number(ship.level) || 1, 1, 20);
    // Expansion bays: universal bays (crew quarters, lounge, mess bay) don't take a slot; comfortable crew
    // quarters add a fifth slot. Keep one entry per slot, and drop universal bays saved in slots by older versions.
    if (!CREW_QUARTERS_TYPES[ship.crewQuarters]) ship.crewQuarters = "bunks";
    ship.basicPassengerQuarters = !!ship.basicPassengerQuarters;
    ship.bays = Array.from({ length: Math.max(bayCount(ship), ship.bays.length) }, (_, i) => ship.bays[i] ?? { key: "", name: "" });
    for (const bay of ship.bays) {
      if (!("key" in bay) && bay.name) bay.key = Object.entries(EXPANSION_BAY_OPTIONS).find(([, o]) => o.name.toLowerCase() === String(bay.name).trim().toLowerCase())?.[0] ?? "";
      if (!(bay.key in EXPANSION_BAY_OPTIONS)) bay.key = "";
      bay.name = EXPANSION_BAY_OPTIONS[bay.key]?.name ?? "";
      if (bay.key === "passenger-quarters" && !PASSENGER_QUARTERS_TYPES[bay.type]) bay.type = "prison";
    }
    if (!(ship.frame in FRAMES)) ship.frame = "explorer";
    ship.acCircumstance = Number(ship.acCircumstance) || 0;
    ship.wrecked = Math.max(0, Number(ship.wrecked) || 0);
    if (ship.frame !== before.frame) {
      const defaults = FRAMES[ship.frame].defaults;
      for (const st of ship.stations) if (st.fixed) st.defaultUpgrade = defaults[st.type] ?? null;
    }
    ship.stations.forEach((st, i) => {
      const old = before.stations[i];
      if (old && st.type !== old.type) Object.assign(st, { upgrades: [], weapons: [], gradeOverride: "", attackOverride: null, activeWeapon: 0 });
      if (st.gradeOverride !== "" && st.gradeOverride !== null) st.gradeOverride = Number(st.gradeOverride);
      st.activeWeapon = Number(st.activeWeapon) || 0;
      if (st.attackOverride === "" || Number.isNaN(st.attackOverride)) st.attackOverride = null;
    });
    const derived = derivePCShip(ship, crewMap(ship));
    ship.sp = Math.clamp(Number(ship.sp) || 0, 0, derived.spMax);
    const hp = update["system.attributes.hp.value"] ?? this.document.system.attributes.hp.value;
    Object.assign(update, vehicleSync(derived, hp));
  }

  onActionChange(kind, el) {
    const i = Number(el.dataset.station);
    const value = el.value;
    if (!value) return;
    if (kind === "addUpgrade") return this.updateShip((s) => s.stations[i].upgrades.push(value));
    if (kind === "addWeapon") return this.updateShip((s) => s.stations[i].weapons.push({ key: value }));
  }

  #station(target) {
    const { ship, derived } = derivedFor(this.document);
    const st = derived.stations[Number(target.dataset.station)];
    return { ship, derived, st };
  }

  #speaker(st) {
    const helmer = st?.helmerData?.actor;
    return ChatMessage.getSpeaker(helmer ? { actor: helmer } : { actor: this.document });
  }

  static async #onRollSave(event, target) {
    const { derived } = derivedFor(this.document);
    const key = target.dataset.save;
    const s = derived.saves[key];
    const label = { fortitude: "Fortitude", reflex: "Reflex", will: "Will" }[key];
    await rollCheck({ label: `${this.document.name}: ${label} save`, mod: s.total, speaker: ChatMessage.getSpeaker({ actor: this.document }) });
  }

  /** The crew member rolling for a station: its helmer, or the user's own character. */
  #roller(st) {
    const actor = st?.helmerData?.actor ?? game.user.character ?? null;
    if (!actor) ui.notifications.warn(`Assign a crew member to helm the ${st?.name ?? "station"} first.`);
    return actor;
  }

  static async #onRollActionCheck(event, target) {
    const { st } = this.#station(target);
    const id = Number(target.dataset.actionId);
    const a = st?.actions.find((x) => x.id === id) ?? st?.drones?.flatMap((d) => d.actionList).find((x) => x.id === id);
    const check = a?.check;
    const skill = target.dataset.skill;
    if (!check?.skills) return;
    const actor = this.#roller(st);
    if (!actor) return;
    const statistic = skill === "perception" ? actor.perception : actor.skills?.[skill];
    if (!statistic?.roll) return ui.notifications.warn(`${actor.name} has no ${SKILL_LABELS[skill] ?? skill} skill.`);
    const dc = check.dc ? { value: check.dc } : check.vs ? targetDC(check.vs) : null;
    if (check.vs && !dc) ui.notifications.info(`Target the other starship to roll ${a.name} against its ${SAVE_LABELS[check.vs] ?? "Perception"} DC.`);
    const params = { event, label: `${a.name} (${SKILL_LABELS[skill]})` };
    if (dc) params.dc = dc;
    if (check.secret) params.rollMode = "blindroll";
    const roll = await statistic.roll(params);
    // Juke and similar: post the conditions the result gives the target, as draggable links.
    const degree = roll?.degreeOfSuccess ?? roll?.options?.degreeOfSuccess;
    if (Number.isFinite(degree)) await postOutcomeConditions(id, degree, actor);
  }

  /** Cosmic Cannon: ranged spell attack against the targeted starship's AC. */
  static async #onSpellAttack(event, target) {
    const { st } = this.#station(target);
    const actor = this.#roller(st);
    const entry = spellcastingEntry(actor);
    if (!actor) return;
    if (!entry) return ui.notifications.warn(`${actor.name} can't cast spells.`);
    const mi = Number(target.dataset.map) || 0;
    const penalty = [0, -5, -10][mi];
    const ac = targetAC(this.document);
    const label = `Cosmic Cannon: spell attack${mi ? ` (MAP ${penalty})` : ""}`;
    const Modifier = game.pf2e?.Modifier ?? game.sf2e?.Modifier;
    if (penalty === 0 || Modifier) {
      const params = { event, label };
      if (ac) params.dc = { value: ac.ac, label: `${ac.name}'s AC${ac.behind ? " (off-guard: attacked from behind)" : ""}` };
      if (penalty) params.modifiers = [new Modifier({ slug: "multiple-attack-penalty", label: "Multiple Attack Penalty", modifier: penalty })];
      return entry.statistic.roll(params);
    }
    return rollCheck({ label, mod: entry.statistic.check.mod + penalty, speaker: ChatMessage.getSpeaker({ actor }), dc: ac });
  }

  static async #onSpellDamage(event, target) {
    const { st } = this.#station(target);
    const actor = this.#roller(st);
    if (!actor) return;
    const rank = cantripRank(actor.level ?? 1);
    const critical = target.dataset.critical === "1";
    await rollDamage({
      ...cosmicSpell(504, rank),
      critical,
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<strong>Cosmic Cannon</strong> (rank ${rank}) ${critical ? "critical " : ""}damage`
    });
  }

  /**
   * Cosmic Bombardment, Cosmic Fortification or Cosmic Repairs: the caster expends one of their own leveled spell
   * slots (rank 1+), which is marked as used on their character sheet, and the spell is cast at that slot's rank.
   */
  static async #onCastSpell(event, target) {
    const { st } = this.#station(target);
    const actor = this.#roller(st);
    if (!actor) return;
    const id = Number(target.dataset.spell);
    const name = ACTIONS[id].name;
    const options = availableSlots(slotSources(actor));
    if (!options.length) return ui.notifications.warn(`${actor.name} has no unused spell slots of rank 1 or higher.`);
    const input = await castDialog(`${name}: ${actor.name}`, options, id === 503);
    if (!input) return;
    if (!(await expendSlot(actor, input.slot))) return ui.notifications.warn(`Couldn't expend that spell slot on ${actor.name}'s sheet.`);
    input.rank = input.slot.rank;
    const spell = cosmicSpell(id, input.rank, input.actions);
    const speaker = ChatMessage.getSpeaker({ actor });
    const slot = input.slot.spell
      ? `Expended ${esc(input.slot.spell)} (${esc(input.slot.entryName ?? "")}, rank ${input.rank} slot).`
      : `Expended a rank ${input.rank} slot (${esc(input.slot.entryName ?? input.slot.label.replace(/^Rank \d+ — /, ""))}).`;

    if (id === 503) {
      return rollDamage({
        formula: spell.formula, type: spell.type, speaker,
        flavor: `<strong>Cosmic Bombardment</strong> (rank ${input.rank}): ${spell.missiles} missile${spell.missiles > 1 ? "s" : ""}, automatically hit. ${slot}`
      });
    }

    // Fortification and Repairs heal the targeted starship if the user can update it, otherwise this one.
    const targeted = [...game.user.targets][0]?.actor;
    const ship = targeted && isStarship(targeted) && targeted.isOwner ? targeted : this.document;
    const roll = new Roll(spell.formula);
    await roll.evaluate();
    const { ship: data, spMax, state } = damageState(ship);
    const result = spell.restores === "sp" ? applyShieldGain(state, roll.total, spMax) : applyHullRepair(state, roll.total);
    await roll.toMessage({
      speaker,
      flavor: `<strong>${name}</strong> (rank ${input.rank}) on ${esc(ship.name)}: +${roll.total} ${spell.restores === "sp" ? "Shield" : "Hull"} Points. ${esc(result.notes.join(" "))} ${slot}`
    });
    await writeState(ship, data, result);
  }

  /** The helmer's solar armaments (melee solar weapon stats, solar flare, attunement), or a warning. */
  #solarian(target, need) {
    const { st } = this.#station(target);
    const actor = this.#roller(st);
    if (!actor) return null;
    const info = crewInfo(actor.uuid) ?? {};
    if (need === "weapon" ? !info.solarWeapon : !info.solarFlare) {
      ui.notifications.warn(`${actor.name} has no ${need === "weapon" ? "solar weapon" : "solar flare"} Strike. Check their stellar attunement on their character sheet.`);
      return null;
    }
    if (need === "flare" && !info.attunement) {
      ui.notifications.warn(`${actor.name} isn't graviton- or photon-attuned.`);
      return null;
    }
    return { actor, info, strikes: solarStrikes(actor), speaker: ChatMessage.getSpeaker({ actor }) };
  }

  /**
   * Nova Strike / Nova Surge: the solarian's solar weapon Strike from their own sheet (e.g. "Advanced Solar
   * Weapon (Photon)"), rolled by the system against the targeted starship. Nova Surge is its first attack only,
   * with no multiple attack penalty. A graviton hit slows the target.
   */
  static async #onNovaStrike(event, target) {
    const s = this.#solarian(target, "weapon");
    if (!s) return;
    // Rolled by the sheet (not the system's Strike card), so the only damage button is the sheet's nova damage,
    // and the target's Evade and attacks from behind count.
    const w = s.info.solarWeapon;
    const surge = target.dataset.surge === "1";
    const mi = surge ? 0 : Number(target.dataset.map) || 0;
    const penalty = (w.agile ? [0, -4, -8] : [0, -5, -10])[mi];
    const { degree } = await rollCheck({
      label: `${surge ? "Nova Surge" : "Nova Strike"}: ${w.label}${mi ? ` (MAP ${penalty})` : ""}`,
      mod: w.attack + penalty,
      speaker: s.speaker,
      dc: targetAC(this.document),
      extra: `<div class="sss-hint">Roll damage with the starship sheet's nova damage button${w.reach ? " (d10 dice)" : ""}.</div>`
    });
    await applyEffectsToTarget(novaEffects("weapon", s.info.attunement, Number.isFinite(degree) ? degree : -1));
  }

  /** Nova weapon damage: the solar weapon's own damage with d10 dice. */
  static async #onNovaDamage(event, target) {
    const s = this.#solarian(target, "weapon");
    if (!s) return;
    await rollNovaWeaponDamage(s.info, s.strikes.weapon.strike, { event, critical: target.dataset.critical === "1", speaker: s.speaker });
  }

  /** Nova Blast: the solar flare's attack bonus against the targeted starship's AC; critical effects by attunement. */
  static async #onNovaBlast(event, target) {
    const s = this.#solarian(target, "flare");
    if (!s) return;
    const mi = Number(target.dataset.map) || 0;
    const penalty = [0, -5, -10][mi];
    const { degree } = await rollCheck({
      label: `Nova Blast (${s.info.attunement})${mi ? ` (MAP ${penalty})` : ""}`,
      mod: s.info.solarFlare.attack + penalty,
      speaker: s.speaker,
      dc: targetAC(this.document)
    });
    await applyEffectsToTarget(novaEffects("blast", s.info.attunement, degree ?? -1));
  }

  static async #onNovaBlastDamage(event, target) {
    const s = this.#solarian(target, "flare");
    if (!s) return;
    const critical = target.dataset.critical === "1";
    // The nova flare has as many dice as the solar flare; take them from the system's own flare formula when it can say.
    let dice = s.info.solarFlare.dice;
    try {
      const formula = await s.strikes.flare?.strike.damage?.({ getFormula: true });
      const match = typeof formula === "string" && formula.match(/(\d+)d\d+/);
      if (match) dice = Number(match[1]);
    } catch (err) {
      console.warn(`${MODULE_ID} | Couldn't read the solar flare's damage formula`, err);
    }
    await rollDamage({
      parts: novaBlastDamage(s.info.attunement, s.info.str, dice).parts,
      critical,
      speaker: s.speaker,
      flavor: `<strong>Nova Blast</strong> (${s.info.attunement}) ${critical ? "critical " : ""}damage`
    });
  }

  static async #onPostAction(event, target) {
    const { st } = this.#station(target);
    const id = Number(target.dataset.actionId);
    const a = ACTIONS[id];
    if (!a) return;
    const check = st?.actions.find((x) => x.id === id)?.check ?? st?.drones?.flatMap((d) => d.actionList).find((x) => x.id === id)?.check;
    let roll = "";
    if (check?.save) {
      const helmer = st?.helmerData?.actor ?? game.user.character;
      const dc = helmerDC(helmer, check);
      roll = `<p><strong>The target attempts a ${check.basic ? "basic " : ""}${SAVE_LABELS[check.save]} save</strong>${dc ? ` against <strong>DC ${dc.value}</strong> (${esc(helmer.name)}'s ${esc(dc.label)})` : ` against the helmer's ${check.dcClass ? "class" : SKILL_LABELS[check.dcSkill]} DC`}.</p>`;
    } else if (check?.skills) {
      const against = check.dc ? ` against DC ${check.dc}` : check.vs ? ` against the target's ${SAVE_LABELS[check.vs] ?? "Perception"} DC` : "";
      roll = `<p>Roll: ${check.skills.map((s) => SKILL_LABELS[s]).join(" or ")}${against}${check.secret ? " (secret, rolled by the GM)" : ""}.</p>`;
    }
    const malf = st?.malfunctioning && id !== 610 ? `<p class="sss-warn">This station is malfunctioning: its station actions can't be used until someone uses Repair Station.</p>` : "";
    // Change Heading turns the starship around and rights it if it's off-kilter.
    let result = "";
    if (id === 598) {
      if (st?.malfunctioning) ui.notifications.warn("The pilot's console is malfunctioning, so the heading wasn't changed.");
      else result = `<p><strong>${esc(await changeHeading(this.document))}</strong></p>`;
    }
    // Lock On: a draggable Locked On effect for the target, removed when the turn advances.
    if (id === 591) {
      const uuid = game.settings.get(MODULE_ID, "lockOnUuid");
      const targetName = [...game.user.targets][0]?.name;
      result = `<p>${targetName ? `<strong>${esc(targetName)}</strong>` : "The target"} takes a –1 status penalty to AC against this gunner's Strikes and a –1 circumstance penalty to Reflex saves against their Area Fire and Auto-Fire until the end of the turn.</p>
        <p>Drag onto the target starship's token: ${uuid ? `@UUID[${uuid}]{Locked On}` : "<strong>Locked On</strong>"} <span class="sss-hint">(removed when the turn advances)</span></p>`;
    }
    await ChatMessage.create({
      speaker: this.#speaker(st),
      content: `<div class="sss-chat">
        <header><strong>${esc(a.name)}</strong> ${costGlyph(a.cost)}</header>
        <div class="sss-traits-list">${a.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}</div>
        <p>${esc(this.document.name)} · ${esc(st?.name ?? "")}${a.freq ? ` · <em>${esc(a.freq)}</em>` : ""}</p>
        ${roll}
        ${result}
        ${malf}
        <a href="${AON}${a.url}" target="_blank" rel="noopener">Read the rules on Archives of Nethys</a>
      </div>`
    });
  }

  static async #onGenerateShields(event, target) {
    const { ship, derived, st } = this.#station(target);
    const roll = new Roll(`${derived.shieldDice}d4`);
    await roll.evaluate();
    const sp = Math.min(derived.spMax, derived.sp + roll.total);
    await roll.toMessage({
      speaker: this.#speaker(st),
      flavor: `<strong>Generate Shields</strong>: +${roll.total} SP (${derived.sp} → ${sp} / ${derived.spMax})`
    });
    await this.document.update({ [`${FLAG}.sp`]: sp }, { [MODULE_ID]: true });
  }

  static async #onVentPower(event, target) {
    const { derived, st } = this.#station(target);
    const dc = st?.helmerData?.actor?.skills?.crafting?.dc?.value;
    await rollDamage({
      formula: `${ventPowerDice(derived.level)}d10`,
      type: "fire",
      speaker: this.#speaker(st),
      flavor: `<strong>Vent Power</strong> — basic Reflex save${dc ? ` against Crafting DC ${dc}` : " against the helmer's Crafting DC"}`
    });
  }

  static async #onStrike(event, target) {
    const { st } = this.#station(target);
    const w = st?.weaponsView[Number(target.dataset.weapon)];
    if (!w || w.attack === null) return;
    const mi = Number(target.dataset.map) || 0;
    const mod = w.attack + w.map[mi];
    const mapText = mi ? ` (MAP ${w.map[mi]})` : "";
    await rollCheck({
      label: `${w.name} Strike${mapText}`,
      mod,
      speaker: this.#speaker(st),
      dc: targetAC(this.document),
      extra: `<div class="sss-traits-list">${w.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}${w.tracking ? `<span class="sss-trait">Tracking +${w.tracking}</span>` : ""}</div>`
    });
  }

  static async #onWeaponDamage(event, target) {
    const { st } = this.#station(target);
    const w = st?.weaponsView[Number(target.dataset.weapon)];
    if (!w || w.missing) return;
    const critical = target.dataset.critical === "1";
    const helmer = st.helmerData?.actor;
    const aim = w.aimDice > 0 && aimHitsTarget(helmer);
    const formula = aim ? `${w.formula}+(${w.aimDice}d${w.aimDie}[precision])` : w.formula;
    const notes = [w.specialization ? `weapon specialization +${w.specialization}` : "", aim ? `Aim +${w.aimDice}d${w.aimDie} precision` : ""].filter(Boolean);
    await rollDamage({
      formula,
      type: w.type,
      critical,
      speaker: this.#speaker(st),
      flavor: `<strong>${esc(w.name)}</strong> ${critical ? "critical " : ""}damage${notes.length ? ` (${notes.join(", ")})` : ""}`
    });
  }

  /**
   * Transmute Vitality: move Hit Points from the mystic's vitality network into the starship's Hull Points,
   * up to the Transfer Vitality limit for their level.
   */
  static async #onTransmuteVitality(event, target) {
    const { st } = this.#station(target);
    const actor = this.#roller(st);
    const v = actor ? vitalityInfo(actor) : null;
    if (!v) return actor && ui.notifications.warn(`${actor.name} has no vitality network.`);
    if (st?.malfunctioning) return ui.notifications.warn("The magic conduit is malfunctioning.");
    const { ship, spMax, state } = damageState(this.document);
    const most = vitalityTransfer({ cap: v.cap, network: v.value, hp: state.hp, hpMax: state.hpMax });
    if (!most) return ui.notifications.info(v.value ? `${this.document.name} has no Hull Points to restore.` : `${actor.name}'s vitality network is empty.`);
    const input = await numberDialog(`Transmute Vitality: ${actor.name}`, [{ name: "amount", label: `Hull Points to transfer (up to ${most})`, value: most }], "Transfer");
    if (!input) return;
    const amount = vitalityTransfer({ requested: input.amount, cap: v.cap, network: v.value, hp: state.hp, hpMax: state.hpMax });
    if (!amount) return;
    await actor.updateResource("vitality-network", v.value - amount);
    const result = applyHullRepair(state, amount);
    await writeState(this.document, ship, result);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sss-chat"><header><strong>Transmute Vitality</strong> ${costGlyph(1)}</header>
        <p>${esc(actor.name)} transfers <strong>${amount} HP</strong> from their vitality network into ${esc(this.document.name)}'s hull
          (network ${v.value} → ${v.value - amount} / ${v.max}).</p>
        <p>${esc(result.notes.join(" "))}</p></div>`
    });
  }

  /** Start of the mystic's turn: the vitality network regains 4, 6 or 8 Hit Points, up to its maximum. */
  /**
   * Add the crew to the combat tracker without dragging their tokens onto the map: the party's members and every
   * station's helmer. A character with a token on the combat's scene is added with that token; the rest are added
   * as actors with no token. Starts an encounter on the current scene when there's none.
   */
  static async #onAddCrewToCombat() {
    if (!game.user.isGM) return;
    const crew = crewForCombat(this.ship);
    if (!crew.length) return ui.notifications.warn("No crew found: assign helmers to the stations, or set up the party.");
    let combat = game.combat;
    if (!combat) {
      combat = await Combat.implementation.create({ scene: canvas?.scene?.id ?? null, active: true });
      if (!combat) return;
    }
    const scene = combat.scene ?? canvas?.scene ?? null;
    const missing = crew.filter((a) => !combat.combatants.some((c) => c.actorId === a.id || c.actor === a));
    if (!missing.length) return ui.notifications.info("The whole crew is already in the combat tracker.");
    await combat.createEmbeddedDocuments("Combatant", missing.map((a) => {
      const token = scene?.tokens?.find((t) => t.actorId === a.id && t.actorLink);
      return token ? { actorId: a.id, tokenId: token.id, sceneId: scene.id, hidden: token.hidden } : { actorId: a.id, hidden: false };
    }));
    ui.notifications.info(`Added to the combat tracker: ${missing.map((a) => a.name).join(", ")}.`);
    ui.combat?.render?.();
  }

  static async #onVitalityRegen(event, target) {
    const { st } = this.#station(target);
    const actor = this.#roller(st);
    const v = actor ? vitalityInfo(actor) : null;
    if (!v) return;
    const next = Math.min(v.max, v.value + v.regen);
    await actor.updateResource("vitality-network", next);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="sss-chat"><strong>Vitality network</strong> regains ${next - v.value} HP (${v.value} → ${next} / ${v.max}).</div>`
    });
  }

  /**
   * Area Fire (area weapons) or Auto-Fire (automatic weapons): two actions, no attack roll; each starship in the
   * area attempts a basic Reflex save against the gunner's class DC + the weapon's tracking.
   */
  static async #onAreaFire(event, target) {
    const { st } = this.#station(target);
    const w = st?.weaponsView[Number(target.dataset.weapon)];
    if (!w || w.missing) return;
    const auto = target.dataset.kind === "auto";
    const a = ACTIONS[auto ? 19 : 17];
    const area = auto ? `a ${w.autoFireRange}-zone cone` : w.areaShape;
    const dc = w.saveDC !== null
      ? `<strong>DC ${w.saveDC}</strong> (${esc(st.helmerData?.name ?? "the gunner")}'s class DC${w.tracking ? ` + tracking ${w.tracking}` : ""})`
      : "the gunner's class DC + the weapon's tracking";
    await ChatMessage.create({
      speaker: this.#speaker(st),
      content: `<div class="sss-chat">
        <header><strong>${esc(a.name)}</strong> ${costGlyph(2)} — ${esc(w.name)}</header>
        <p>Area: ${esc(area)}. No attack roll.</p>
        <p>Each starship in the area attempts a <strong>basic Reflex save</strong> against ${dc}.
          On a critical failure, it suffers the weapon's critical hit effects.</p>
        ${w.primaryTarget ? `<p>Primary Target: before this, make a free-action Strike against one starship in the area; on a hit, its success becomes a failure.</p>` : ""}
        <a href="${AON}${a.url}" target="_blank" rel="noopener">Read the rules on Archives of Nethys</a>
      </div>`
    });
  }

  /** Area damage for Area Fire / Auto-Fire: no Aim, since these aren't Strikes. */
  static async #onAreaDamage(event, target) {
    const { st } = this.#station(target);
    const w = st?.weaponsView[Number(target.dataset.weapon)];
    if (!w || w.missing) return;
    await rollDamage({
      formula: w.formula,
      type: w.type,
      speaker: this.#speaker(st),
      flavor: `<strong>${esc(w.name)}</strong> area damage — each target applies its basic Reflex save${w.specialization ? ` (includes weapon specialization +${w.specialization})` : ""}`
    });
  }

  /** Soldier's Primary Target: a free-action Strike with the area weapon, no multiple attack penalty. */
  static async #onPrimaryTarget(event, target) {
    const { st } = this.#station(target);
    const w = st?.weaponsView[Number(target.dataset.weapon)];
    if (!w || w.missing || w.attack === null) return;
    await rollCheck({
      label: `${w.name}: Primary Target`,
      mod: w.attack,
      speaker: this.#speaker(st),
      dc: targetAC(this.document),
      extra: `<div>Free action, no multiple attack penalty. On a hit, if this target succeeds at its save against the ${w.automatic && !w.area ? "Auto-Fire" : "Area Fire"}, it gets a failure instead.</div>`
    });
  }

  static async #onRemoveUpgrade(event, target) {
    const i = Number(target.dataset.station);
    const idx = Number(target.dataset.index);
    await this.updateShip((s) => s.stations[i].upgrades.splice(idx, 1));
  }

  static async #onRemoveWeapon(event, target) {
    const i = Number(target.dataset.station);
    const idx = Number(target.dataset.index);
    await this.updateShip((s) => {
      s.stations[i].weapons.splice(idx, 1);
      s.stations[i].activeWeapon = 0;
    });
  }
}

/* ---------------------------------- NPC sheet ---------------------------------- */

const ABILITIES = [["str", "Str"], ["dex", "Dex"], ["con", "Con"], ["int", "Int"], ["wis", "Wis"], ["cha", "Cha"]];

function itemCost(item) {
  const type = item.system?.actionType?.value;
  if (type === "reaction") return "r";
  if (type === "free") return "f";
  if (type === "passive") return "passive";
  return item.system?.actions?.value ?? 1;
}

/** A Strike's range in zones (starship range increment), from the sheet's flag; melee Strikes reach 0 zones. */
function strikeZones(item) {
  const zones = Number(item?.flags?.[MODULE_ID]?.zones);
  if (Number.isFinite(zones) && zones >= 0) return zones;
  return item?.isRanged ? null : 0;
}

function labelList(list) {
  return (list ?? []).map((x) => x.label ?? x.type ?? String(x)).join(", ");
}

export class NPCStarshipSheet extends StarshipSheetBase {
  static DEFAULT_OPTIONS = {
    classes: ["sss-app-npc"],
    position: { width: 820, height: 860 },
    actions: {
      rollSave: NPCStarshipSheet.#onRollSave,
      rollPerception: NPCStarshipSheet.#onRollPerception,
      rollSkill: NPCStarshipSheet.#onRollSkill,
      npcStrike: NPCStarshipSheet.#onStrike,
      npcDamage: NPCStarshipSheet.#onDamageRoll,
      npcAction: NPCStarshipSheet.#onAction,
      npcCommonAction: NPCStarshipSheet.#onCommonAction,
      npcFortify: NPCStarshipSheet.#onFortify,
      npcSetEvade: NPCStarshipSheet.#onSetEvade,
      npcSpellCard: NPCStarshipSheet.#onSpellCard,
      npcSpellAttack: NPCStarshipSheet.#onSpellAttack,
      npcSpellDamage: NPCStarshipSheet.#onSpellDamage,
      npcCastSpell: NPCStarshipSheet.#onCastSpell,
      npcRepairSelf: NPCStarshipSheet.#onRepairSelf,
      npcWeaponStrike: NPCStarshipSheet.#onWeaponStrike,
      npcWeaponDamage: NPCStarshipSheet.#onWeaponDamage,
      npcAreaFire: NPCStarshipSheet.#onAreaFire,
      removeNPCWeapon: NPCStarshipSheet.#onRemoveWeapon,
      addNPCStation: NPCStarshipSheet.#onAddStation,
      removeNPCStation: NPCStarshipSheet.#onRemoveStation,
      openSystemSheet: NPCStarshipSheet.#onOpenSystemSheet
    }
  };

  async _prepareContext(options) {
    const actor = this.document;
    const ship = this.ship;
    const sys = actor.system;
    const strikes = (sys.actions ?? [])
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s.type === "strike")
      .map(({ s, index }) => ({
        index,
        itemId: s.item?.id ?? null,
        label: s.label ?? s.item?.name ?? "Strike",
        kind: s.item?.isRanged ? "Ranged" : "Melee",
        zones: strikeZones(s.item),
        variants: (s.variants ?? []).map((v) => v.label),
        damage: Object.values(s.item?.system?.damageRolls ?? {}).map((r) => `${r.damage} ${r.damageType ?? ""}`.trim()).join(" + "),
        traits: (s.weaponTraits ?? s.traits ?? []).map((t) => t.label ?? t.name ?? String(t))
      }));
    const actions = (actor.itemTypes?.action ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      cost: itemCost(item),
      traits: (item.system?.traits?.value ?? []).map((t) => CONFIG.PF2E?.actionTraits?.[t] ? game.i18n.localize(CONFIG.PF2E.actionTraits[t]) : t),
      station: item.flags?.[MODULE_ID]?.station ?? "other"
    }));
    const skills = Object.entries(sys.skills ?? {})
      .filter(([, sk]) => sk.visible)
      .map(([slug, sk]) => ({ slug, label: actor.skills?.[slug]?.label ?? sk.label ?? slug, mod: actor.skills?.[slug]?.mod ?? sk.mod ?? 0 }));
    const sizeKey = sys.traits?.size?.value;
    return {
      name: actor.name,
      img: actor.img,
      editable: this.isEditable,
      isGM: game.user.isGM,
      ship,
      level: actor.level,
      size: CONFIG.PF2E?.actorSizes?.[sizeKey] ? game.i18n.localize(CONFIG.PF2E.actorSizes[sizeKey]) : sizeKey ?? "",
      traits: (sys.traits?.value ?? []).map((t) => (CONFIG.PF2E?.creatureTraits?.[t] ? game.i18n.localize(CONFIG.PF2E.creatureTraits[t]) : t)),
      ac: actor.attributes?.ac?.value ?? sys.attributes?.ac?.value ?? 0,
      pilotingDC: actor.skills?.piloting?.dc?.value ?? null,
      saves: {
        fortitude: actor.saves?.fortitude?.mod ?? 0,
        reflex: actor.saves?.reflex?.mod ?? 0,
        will: actor.saves?.will?.mod ?? 0
      },
      perception: actor.perception?.mod ?? sys.perception?.mod ?? 0,
      skills,
      abilities: ABILITIES.map(([k, label]) => ({ label, mod: sys.abilities?.[k]?.mod ?? 0 })),
      immunities: labelList(sys.attributes?.immunities),
      resistances: labelList(sys.attributes?.resistances),
      weaknesses: labelList(sys.attributes?.weaknesses),
      hp: { value: sys.attributes.hp.value, max: sys.attributes.hp.max },
      hpField: "system.attributes.hp.value",
      strikes,
      actions,
      weapons: (ship.weapons ?? []).map((w, i) => npcWeaponView(actor, w, i)),
      offKilter: hasOffKilter(actor),
      spellCondition: conditionPenalty(actorConditions(actor), "spell"),
      conditionPenalties: ["ranged", "melee", "spell", "dc"].map((k) => [k, conditionPenalty(actorConditions(actor), k)]).filter(([, c]) => c.penalty),
      target: targetInfo(actor),
      tab: this._tab ?? "combat"
    };
  }

  renderSheet(context) {
    return renderNPCSheet(context);
  }

  normalizeShip(ship) {
    ship.acCircumstance = Number(ship.acCircumstance) || 0;
    if (!["extreme", "high", "moderate"].includes(ship.spellTier)) ship.spellTier = "high";
    for (const k of ["sp", "spMax", "fortify", "sensor", "speed", "wrecked"]) ship[k] = Math.max(0, Number(ship[k]) || 0);
    ship.sp = Math.min(ship.sp, ship.spMax);
  }

  onActionChange(kind, el) {
    if (kind === "addNPCWeapon" && el.value) {
      const tiers = NPC_WEAPONS[el.value]?.defaultTiers ?? { attackTier: "high", damageTier: "moderate" };
      return this.updateShip((s) => {
        s.weapons = [...(s.weapons ?? []), { key: el.value, ...tiers }];
      });
    }
    if (kind === "strikeZones") {
      const item = this.document.items.get(el.dataset.item);
      const zones = el.value === "" ? null : Math.max(0, Math.floor(Number(el.value) || 0));
      return item?.update({ [`flags.${MODULE_ID}.zones`]: zones });
    }
    if (kind !== "assignStation") return;
    const item = this.document.items.get(el.dataset.item);
    return item?.update({ [`flags.${MODULE_ID}.station`]: el.value });
  }

  /** Post a common NPC starship action to chat with its AoN link. */
  static async #onCommonAction(event, target) {
    const a = npcActionByKey(target.dataset.key);
    if (!a) return;
    const station = Object.entries(NPC_STATION_ACTIONS).find(([, list]) => list.includes(a))?.[0];
    const malf = station && this.ship.stations.some((st) => st.type === station && st.malfunctioning);
    if (malf) ui.notifications.warn(`${a.name}: the ${NPC_STATIONS[station]} is malfunctioning.`);
    const save = a.save ? `<p>The target${a.range ? ` within ${esc(a.range)}` : ""} attempts a <strong>${SAVE_LABELS[a.save]} save</strong>.</p>` : "";
    // Change Heading turns the starship around and rights it if it's off-kilter.
    const result = a.key === "change-heading" && !malf ? `<p><strong>${esc(await changeHeading(this.document))}</strong></p>` : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<div class="sss-chat">
        <header><strong>${esc(a.name)}</strong> ${costGlyph(a.cost)}</header>
        ${a.traits.length ? `<div class="sss-traits-list">${a.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}</div>` : ""}
        <p>${esc(this.document.name)}${station ? ` · ${esc(NPC_STATIONS[station])}` : ""}${a.freq ? ` · <em>${esc(a.freq)}</em>` : ""}</p>
        ${save}
        ${result}
        ${malf ? `<p class="sss-warn">This station is malfunctioning.</p>` : ""}
        <a href="${AON}${a.url}" target="_blank" rel="noopener">Read the rules on Archives of Nethys</a>
      </div>`
    });
  }

  /* ----- magic conduit: starship spells at the NPC's level ----- */

  get #spellRank() {
    return cantripRank(this.document.level ?? 1);
  }

  #conduitMalfunctioning() {
    const malf = this.ship.stations.some((st) => st.type === "conduit" && st.malfunctioning);
    if (malf) ui.notifications.warn(`${this.document.name}'s magic conduit is malfunctioning.`);
    return malf;
  }

  static async #onSpellCard(event, target) {
    const a = ACTIONS[Number(target.dataset.spell)];
    if (!a) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<div class="sss-chat"><header><strong>${esc(a.name)}</strong> ${costGlyph(a.cost)}</header>
        <p>${esc(this.document.name)} · Magic Conduit · rank ${this.#spellRank}</p>
        <a href="${AON}${a.url}" target="_blank" rel="noopener">Read the rules on Archives of Nethys</a></div>`
    });
  }

  /** Cosmic Cannon: spell attack (GM Core table at the ship's level) against the targeted starship's AC. */
  static async #onSpellAttack(event, target) {
    this.#conduitMalfunctioning();
    const mi = Number(target.dataset.map) || 0;
    const penalty = [0, -5, -10][mi];
    const condition = conditionPenalty(actorConditions(this.document), "spell");
    await rollCheck({
      label: `Cosmic Cannon: spell attack${mi ? ` (MAP ${penalty})` : ""}`,
      mod: npcSpellAttack(this.document.level, this.ship.spellTier) + penalty + condition.penalty,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      dc: targetAC(this.document),
      extra: conditionNote(condition)
    });
  }

  static async #onSpellDamage(event, target) {
    const rank = this.#spellRank;
    const critical = target.dataset.critical === "1";
    await rollDamage({
      ...cosmicSpell(504, rank),
      critical,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<strong>Cosmic Cannon</strong> (rank ${rank}) ${critical ? "critical " : ""}damage`
    });
  }

  /** Cosmic Bombardment, Fortification or Repairs at a chosen rank (default: the ship's highest). */
  static async #onCastSpell(event, target) {
    this.#conduitMalfunctioning();
    const id = Number(target.dataset.spell);
    const name = ACTIONS[id].name;
    const fields = [{ name: "rank", label: "Spell rank", value: this.#spellRank }];
    if (id === 503) fields.push({ name: "actions", label: "Actions spent (1–3)", value: 3 });
    const input = await numberDialog(`${name}: ${this.document.name}`, fields, "Cast");
    if (!input) return;
    const spell = cosmicSpell(id, input.rank, input.actions);
    const speaker = ChatMessage.getSpeaker({ actor: this.document });
    if (id === 503) {
      return rollDamage({
        formula: spell.formula, type: spell.type, speaker,
        flavor: `<strong>Cosmic Bombardment</strong> (rank ${input.rank}): ${spell.missiles} missile${spell.missiles > 1 ? "s" : ""}, automatically hit`
      });
    }
    // Restores the targeted starship if it's one the user can update (an ally), otherwise this one.
    const targeted = [...game.user.targets][0]?.actor;
    const ship = targeted && isStarship(targeted) && targeted.isOwner ? targeted : this.document;
    const roll = new Roll(spell.formula);
    await roll.evaluate();
    const { ship: data, spMax, state } = damageState(ship);
    const result = spell.restores === "sp" ? applyShieldGain(state, roll.total, spMax) : applyHullRepair(state, roll.total);
    await roll.toMessage({
      speaker,
      flavor: `<strong>${name}</strong> (rank ${input.rank}) on ${esc(ship.name)}: +${roll.total} ${spell.restores === "sp" ? "Shield" : "Hull"} Points. ${esc(result.notes.join(" "))}`
    });
    await writeState(ship, data, result);
  }

  /** Evade / Stick to Cover: set the circumstance bonus to AC. */
  static async #onSetEvade(event, target) {
    const value = Number(target.dataset.value) || 0;
    await this.updateShip((s) => (s.acCircumstance = value));
  }

  /** Fortify Shield Points: regain SP equal to the fortify value. */
  static async #onFortify() {
    const { ship, spMax, state } = damageState(this.document);
    const result = applyShieldGain(state, ship.fortify, spMax);
    await writeState(this.document, ship, result);
    await postNotes(this.document, `${this.document.name}: Fortify Shield Points (+${ship.fortify})`, result.notes);
  }

  /** Repair Self: stop one battle station malfunctioning and regain Hull Points equal to the starship's level. */
  static async #onRepairSelf() {
    const { ship, state } = damageState(this.document);
    const result = applyHullRepair(state, Math.max(0, this.document.level ?? 0));
    const fixed = ship.stations.findIndex((st) => st.malfunctioning);
    if (fixed >= 0) {
      ship.stations[fixed] = { ...ship.stations[fixed], malfunctioning: false };
      result.notes.push(`${NPC_STATIONS[ship.stations[fixed].type] ?? "A battle station"} is no longer malfunctioning.`);
    }
    await writeState(this.document, ship, result);
    await postNotes(this.document, `${this.document.name}: Repair Self`, result.notes);
  }

  #weapon(target) {
    const index = Number(target.dataset.weapon);
    const entry = this.ship.weapons?.[index];
    return entry ? npcWeaponView(this.document, entry, index) : null;
  }

  /** Starship weapon Strike against the targeted starship's AC. */
  static async #onWeaponStrike(event, target) {
    const w = this.#weapon(target);
    if (!w || w.missing) return;
    const mi = Number(target.dataset.map) || 0;
    const penalty = w.map[mi];
    if (this.ship.stations.some((st) => st.type === "gunnery" && st.malfunctioning)) {
      ui.notifications.warn(`${this.document.name}'s gunnery is malfunctioning.`);
    }
    await rollCheck({
      label: `${w.name} Strike${mi ? ` (MAP ${penalty})` : ""}`,
      mod: w.attack + penalty,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      dc: targetAC(this.document),
      extra: `${conditionNote(w.attackCondition)}<div class="sss-traits-list">${w.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}<span class="sss-trait">range ${w.range} zones</span></div>`
    });
  }

  static async #onWeaponDamage(event, target) {
    const w = this.#weapon(target);
    if (!w || w.missing) return;
    const critical = target.dataset.critical === "1";
    await rollDamage({
      formula: w.formula,
      type: w.type,
      critical,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<strong>${esc(w.name)}</strong> ${critical ? "critical " : ""}damage`
    });
  }

  /** Area Fire / Auto-Fire: no attack roll; targets attempt a basic Reflex save against the ship's DC. */
  static async #onAreaFire(event, target) {
    const w = this.#weapon(target);
    if (!w || w.missing) return;
    const auto = target.dataset.kind === "auto";
    const a = ACTIONS[auto ? 19 : 17];
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<div class="sss-chat"><header><strong>${esc(a.name)}</strong> ${costGlyph(2)} — ${esc(w.name)}</header>
        <p>Area: ${esc(auto ? `a ${w.autoFireRange}-zone cone` : w.areaShape)}. No attack roll.</p>
        <p>Each starship in the area attempts a <strong>basic Reflex save</strong> against <strong>DC ${w.saveDC}</strong>.
          On a critical failure, it suffers the weapon's critical hit effects.</p>
        ${conditionNote(w.dcCondition)}
        <a href="${AON}${a.url}" target="_blank" rel="noopener">Read the rules on Archives of Nethys</a></div>`
    });
  }

  static async #onRemoveWeapon(event, target) {
    const index = Number(target.dataset.index);
    await this.updateShip((s) => s.weapons.splice(index, 1));
  }

  #strike(target) {
    return this.document.system.actions?.[Number(target.dataset.strike)];
  }

  static async #onRollSave(event, target) {
    await this.document.saves?.[target.dataset.save]?.roll({ event });
  }

  static async #onRollPerception(event) {
    await this.document.perception?.roll({ event });
  }

  static async #onRollSkill(event, target) {
    await this.document.skills?.[target.dataset.skill]?.roll({ event });
  }

  static async #onStrike(event, target) {
    await this.#strike(target)?.variants?.[Number(target.dataset.variant)]?.roll({ event, modifiers: behindModifiers(this.document) });
  }

  static async #onDamageRoll(event, target) {
    const strike = this.#strike(target);
    if (!strike) return;
    await (target.dataset.critical === "1" ? strike.critical?.({ event }) : strike.damage?.({ event }));
  }

  static async #onAction(event, target) {
    const item = this.document.items.get(target.dataset.item);
    if (!item) return;
    const station = item.flags?.[MODULE_ID]?.station;
    if (station && this.ship.stations.some((s) => s.type === station && s.malfunctioning)) {
      ui.notifications.warn(`${item.name}: the ${NPC_STATIONS[station]} is malfunctioning.`);
    }
    await item.toMessage?.(event);
  }

  static async #onAddStation() {
    await this.updateShip((s) => s.stations.push({ type: "gunnery", name: "", malfunctioning: false }));
  }

  static async #onRemoveStation(event, target) {
    await this.updateShip((s) => s.stations.splice(Number(target.dataset.index), 1));
  }

  static #onOpenSystemSheet() {
    const entry = Object.values(CONFIG.Actor.sheetClasses.npc ?? {}).find((e) => !e.id.startsWith(`${MODULE_ID}.`) && e.default)
      ?? Object.values(CONFIG.Actor.sheetClasses.npc ?? {}).find((e) => !e.id.startsWith(`${MODULE_ID}.`));
    if (!entry) return ui.notifications.warn("No system NPC sheet found.");
    const cls = entry.cls;
    const isV2 = cls.prototype instanceof foundry.applications.api.ApplicationV2;
    const app = isV2 ? new cls({ document: this.document }) : new cls(this.document, { editable: true });
    app.render(isV2 ? { force: true } : true);
  }
}

/* ---------------------------------- system damage → shields ---------------------------------- */

/**
 * Damage applied through the system's chat buttons lowers Hull Points directly. Route it through
 * Shield Points first, and track compromised/wrecked, so starships follow Tech Core rules.
 */
function onPreUpdateActor(actor, changes, options) {
  if (options[MODULE_ID] || options.damageUndo || !isStarship(actor)) return;
  if (!game.settings.get(MODULE_ID, "shieldsAbsorb")) return;
  const newHP = fu.getProperty(changes, "system.attributes.hp.value");
  if (typeof newHP !== "number") return;
  const { ship, state } = damageState(actor);
  const delta = typeof options.damageTaken === "number" ? options.damageTaken : state.hp - newHP;
  if (!delta) return;

  if (delta > 0) {
    const result = applyShipDamage(state, { amount: delta });
    fu.setProperty(changes, "system.attributes.hp.value", result.hp);
    const next = { sp: result.sp, compromised: result.compromised, destroyed: result.destroyed };
    if (result.malfunctionAll) next.stations = ship.stations.map((s) => ({ ...s, malfunctioning: s.type ? true : s.malfunctioning }));
    fu.setProperty(changes, FLAG, fu.mergeObject(fu.getProperty(changes, FLAG) ?? {}, next));
    options.damageTaken = state.hp - result.hp;
    if (result.notes.length) postNotes(actor, `${actor.name} takes ${delta} damage`, result.notes);
  } else if (ship.compromised > 0 && newHP >= 1) {
    const result = applyHullRepair({ ...state, hp: 0 }, newHP);
    fu.setProperty(changes, FLAG, fu.mergeObject(fu.getProperty(changes, FLAG) ?? {}, { compromised: 0, wrecked: result.wrecked }));
  }
}

/* ---------------------------------- creation ---------------------------------- */

async function createStarshipDialog() {
  const frames = Object.entries(FRAMES).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join("");
  const r = await DialogV2.wait({
    window: { title: "Create Starship", icon: "fa-solid fa-rocket" },
    content: `<div class="form-group"><label>Name</label><input type="text" name="name" autofocus></div>
      <div class="form-group"><label>Type</label><select name="kind"><option value="pc">Player starship</option><option value="npc">NPC starship</option></select></div>
      <div class="form-group"><label>Frame (player starship)</label><select name="frame">${frames}</select></div>
      <div class="form-group"><label>Level</label><input type="number" name="level" value="1" min="-1" max="25"></div>`,
    buttons: [{
      action: "create",
      label: "Create",
      default: true,
      callback: (event, button) => {
        const f = button.form.elements;
        return { name: f.name.value.trim(), kind: f.kind.value, frame: f.frame.value, level: Number(f.level.value) || 1 };
      }
    }],
    rejectClose: false
  }).catch(() => null);
  if (!r || typeof r !== "object") return;
  const actor = await Actor.create(r.kind === "pc" ? pcActorData(r) : npcActorData(r));
  actor?.sheet?.render(true);
}

function pcActorData({ name, frame, level }) {
  const ship = defaultPCShip(frame, Math.clamp(level, 1, 20));
  const derived = derivePCShip(ship, {});
  return {
    name: name || "New Starship",
    type: "vehicle",
    img: "icons/svg/target.svg",
    system: fu.expandObject(vehicleSync(derived, derived.hpMax)).system,
    prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY },
    flags: { [MODULE_ID]: { ship }, core: { sheetClass: `${MODULE_ID}.PCStarshipSheet` } }
  };
}

function npcActorData({ name, level }) {
  const ship = defaultNPCShip();
  return {
    name: name || "NPC Starship",
    type: "npc",
    img: "icons/svg/target.svg",
    system: {
      details: { level: { value: level } },
      traits: { value: ["tech"], size: { value: "med" } }
    },
    // Heading 0 is right-to-left for NPC starships.
    prototypeToken: { texture: { scaleX: -1 } },
    flags: { [MODULE_ID]: { ship }, core: { sheetClass: `${MODULE_ID}.NPCStarshipSheet` } }
  };
}

/* ---------------------------------- hooks ---------------------------------- */

Hooks.once("init", () => {
  if (!["sf2e", "pf2e"].includes(game.system.id)) {
    console.warn(`${MODULE_ID} | Needs the Starfinder 2e system; staying inactive.`);
    return;
  }
  game.settings.register(MODULE_ID, "zoneWidth", {
    name: "Zone width (grid squares)",
    hint: "For the heading rule: starships closer than this left-to-right are in the same zone, so neither counts as attacking from behind.",
    scope: "world",
    config: true,
    type: Number,
    default: 1
  });
  game.settings.register(MODULE_ID, "offKilterUuid", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "lockOnUuid", { scope: "world", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "endRoundEffects", {
    name: "End 1-round conditions automatically",
    hint: "At the start of the next turn of whoever was acting when it was added: remove off-guard and off-kilter from starships (Juke, Raider Beam), and effects that last until the start of a turn (such as Aim).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "shieldsAbsorb", {
    name: "Shields absorb system damage",
    hint: "When damage is applied to a starship with the system's chat buttons, take it from Shield Points first and track the compromised condition.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  const DSC = foundry.applications.apps.DocumentSheetConfig;
  DSC.registerSheet(Actor, MODULE_ID, PCStarshipSheet, { types: ["vehicle"], makeDefault: false, label: "Starship (Player)" });
  DSC.registerSheet(Actor, MODULE_ID, NPCStarshipSheet, { types: ["npc"], makeDefault: false, label: "Starship (NPC)" });
  Hooks.on("preUpdateActor", onPreUpdateActor);

  Hooks.on("renderActorDirectory", (app, html) => {
    if (!game.user.isGM && !game.user.can?.("ACTOR_CREATE")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root || root.querySelector(".sss-create")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sss-create";
    btn.innerHTML = `<i class="fa-solid fa-rocket"></i> Create Starship`;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      createStarshipDialog();
    });
    (root.querySelector(".header-actions, .directory-header .action-buttons") ?? root.querySelector("header") ?? root).append(btn);
  });

  // A crew member's Piloting, Dexterity or proficiency changes what the ship sheet shows.
  const refreshCrew = (actor) => {
    if (actor?.type !== "character") return;
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof PCStarshipSheet && app.rendered && app.ship.stations.some((s) => s.helmer === actor.uuid)) app.render();
    }
  };
  Hooks.on("updateActor", refreshCrew);
  // Effects such as Aim, and feats, are items on the crew member.
  for (const hook of ["createItem", "updateItem", "deleteItem"]) Hooks.on(hook, (item) => refreshCrew(item.parent));

  // The target banner: redraw open starship sheets when this user's targets change, when tokens move
  // (attacking from behind), or when the targeted actor changes (its AC).
  const refreshTargetBanners = foundry.utils.debounce(() => {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof StarshipSheetBase && app.rendered) app.render();
    }
  }, 50);
  Hooks.on("targetToken", (user) => {
    if (user === game.user) refreshTargetBanners();
  });
  Hooks.on("updateToken", (token, changes) => {
    if (game.user.targets.size && ("x" in changes || "y" in changes)) refreshTargetBanners();
  });
  const targeted = (actor) => !!actor && [...game.user.targets].some((t) => t.actor === actor);
  Hooks.on("updateActor", (actor) => {
    if (targeted(actor)) refreshTargetBanners();
  });
  // Conditions such as off-guard are items on the target.
  for (const hook of ["createItem", "deleteItem"]) Hooks.on(hook, (item) => {
    if (targeted(item.parent)) refreshTargetBanners();
  });

  // When the turn advances, the active GM removes Locked On (end of the gunner's turn), and at the start of a
  // combatant's turn the 1-round starship conditions and "until your next turn" effects they applied.
  Hooks.on("preCreateItem", (item) => recordAppliedTurn(item));
  Hooks.on("updateCombat", (combat, changes) => {
    if (!("turn" in changes || "round" in changes) || game.users.activeGM?.id !== game.user.id) return;
    removeTurnEffects(combat).catch((err) => console.error(`${MODULE_ID} | Couldn't remove expired effects`, err));
  });
  // Ending the combat ends Locked On too.
  Hooks.on("deleteCombat", (combat) => {
    if (game.users.activeGM?.id === game.user.id) removeTurnEffects(combat, { ended: true }).catch(() => {});
  });

  // Players can't update starships they don't own; the active GM applies effects for them.
  Hooks.once("ready", () => {
    ensureOffKilter().catch((err) => console.error(`${MODULE_ID} | Couldn't create the Off-Kilter condition`, err));
    game.socket.on(`module.${MODULE_ID}`, (data) => {
      if (data?.type !== "addEffects" || game.users.activeGM?.id !== game.user.id) return;
      const actor = fromUuidSync(data.uuid);
      if (actor && isStarship(actor)) addEffects(actor, data.effects);
    });
  });

  game.modules.get(MODULE_ID).api = { getShip, derivedFor, isStarship, createStarshipDialog };
  console.log(`${MODULE_ID} | Ready`);
});
