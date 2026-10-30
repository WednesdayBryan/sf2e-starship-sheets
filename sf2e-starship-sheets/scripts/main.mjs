/**
 * SF2e Starship Sheets: Foundry glue.
 * Player starships are system `vehicle` actors and NPC starships are system `npc` actors; all starship data is
 * stored in flags, so disabling this module never leaves the world with actors it can't load.
 */
import { ACTIONS, AON, FRAMES, MODULE_ID, NPC_STATIONS, STATIONS, UPGRADES, WEAPONS } from "./data.mjs";
import {
  DEGREE_LABELS, applyHullRepair, applyShieldGain, applyShipDamage, defaultNPCShip, defaultPCShip, degreeOfSuccess,
  derivePCShip, frameRow, hullIntegrity, ventPowerDice, vehicleSync
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

function crewInfo(uuid) {
  const a = uuid ? fromUuidSync(uuid) : null;
  if (!a) return null;
  const att = a.system?.proficiencies?.attacks ?? {};
  return {
    name: a.name,
    actor: a,
    pilotDC: a.skills?.piloting?.dc?.value ?? null,
    dex: a.system?.abilities?.dex?.mod ?? 0,
    level: a.level ?? 0,
    ranks: { simple: att.simple?.rank ?? 0, martial: att.martial?.rank ?? 0, advanced: att.advanced?.rank ?? 0 }
  };
}

function crewMap(ship) {
  const map = {};
  for (const st of ship.stations ?? []) if (st.helmer && !map[st.helmer]) map[st.helmer] = crewInfo(st.helmer) ?? { name: "Missing crew member", missing: true };
  return map;
}

export function derivedFor(actor) {
  const ship = getShip(actor);
  return { ship, derived: derivePCShip(ship, crewMap(ship)) };
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

async function rollDamage({ formula, type, critical = false, flavor, speaker }) {
  const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");
  let roll = null;
  if (DamageRoll) {
    try {
      roll = new DamageRoll(critical ? `{(2*(${formula}))[${type}]}` : `{(${formula})[${type}]}`);
      await roll.evaluate();
    } catch (err) {
      console.warn(`${MODULE_ID} | System damage roll failed, using a plain roll`, err);
      roll = null;
    }
  }
  if (!roll) {
    roll = new Roll(critical ? `2*(${formula})` : formula);
    await roll.evaluate();
  }
  return roll.toMessage({ speaker, flavor });
}

/** AC of the first targeted token, if any. */
function targetAC() {
  const target = [...game.user.targets][0]?.actor;
  if (!target) return null;
  if (target.type === "vehicle" && isStarship(target)) return { name: target.name, ac: derivedFor(target).derived.ac.total };
  const ac = target.attributes?.ac?.value ?? target.system?.attributes?.ac?.value;
  return Number.isFinite(ac) ? { name: target.name, ac } : null;
}

async function rollCheck({ label, mod, speaker, dc = null, extra = "" }) {
  const roll = new Roll("1d20 + @mod", { mod });
  await roll.evaluate();
  const die = roll.dice[0]?.total ?? 0;
  let outcome = "";
  if (dc) {
    const degree = degreeOfSuccess(roll.total, die, dc.ac);
    outcome = `<div class="sss-outcome sss-degree-${degree}">vs ${esc(dc.name)} (AC ${dc.ac}): <strong>${DEGREE_LABELS[degree]}</strong></div>`;
  }
  return roll.toMessage({ speaker, flavor: `<strong>${esc(label)}</strong> ${extra}${outcome}` });
}

/* ---------------------------------- dialogs ---------------------------------- */

async function numberDialog(title, fields) {
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
      label: "Apply",
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
      tab: StarshipSheetBase.#onTab,
      editImage: StarshipSheetBase.#onEditImage,
      setCompromised: StarshipSheetBase.#onSetCompromised,
      hullIntegrity: StarshipSheetBase.#onHullIntegrity,
      clearDestroyed: StarshipSheetBase.#onClearDestroyed,
      damage: StarshipSheetBase.#onDamage,
      repairHull: StarshipSheetBase.#onRepairHull,
      restoreShields: StarshipSheetBase.#onRestoreShields
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
    this.normalizeShip(ship, before, update);
    update[FLAG] = ship;
    await actor.update(update, { [MODULE_ID]: true });
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
    if (!this.isEditable) return;
    const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new FP({ type: "image", current: this.document.img, callback: (path) => this.document.update({ img: path }) }).browse();
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
      ship,
      derived,
      hp: { value: actor.system.attributes.hp.value, max: derived.hpMax },
      hpField: "system.attributes.hp.value",
      crewOptions,
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

  static async #onPostAction(event, target) {
    const { st } = this.#station(target);
    const a = ACTIONS[Number(target.dataset.actionId)];
    if (!a) return;
    const malf = st?.malfunctioning ? `<p class="sss-warn">This station is malfunctioning: its station actions can't be used until someone uses Repair Station.</p>` : "";
    await ChatMessage.create({
      speaker: this.#speaker(st),
      content: `<div class="sss-chat">
        <header><strong>${esc(a.name)}</strong> ${costGlyph(a.cost)}</header>
        <div class="sss-traits-list">${a.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}</div>
        <p>${esc(this.document.name)} · ${esc(st?.name ?? "")}${a.freq ? ` · <em>${esc(a.freq)}</em>` : ""}</p>
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
      dc: targetAC(),
      extra: `<div class="sss-traits-list">${w.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}${w.tracking ? `<span class="sss-trait">Tracking +${w.tracking}</span>` : ""}</div>`
    });
  }

  static async #onWeaponDamage(event, target) {
    const { st } = this.#station(target);
    const w = st?.weaponsView[Number(target.dataset.weapon)];
    if (!w || w.missing) return;
    const critical = target.dataset.critical === "1";
    await rollDamage({
      formula: w.formula,
      type: w.type,
      critical,
      speaker: this.#speaker(st),
      flavor: `<strong>${esc(w.name)}</strong> ${critical ? "critical " : ""}damage`
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
        label: s.label ?? s.item?.name ?? "Strike",
        kind: s.item?.isRanged ? "Ranged" : "Melee",
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
      tab: this._tab ?? "combat"
    };
  }

  renderSheet(context) {
    return renderNPCSheet(context);
  }

  normalizeShip(ship) {
    for (const k of ["sp", "spMax", "fortify", "sensor", "speed", "wrecked"]) ship[k] = Math.max(0, Number(ship[k]) || 0);
    ship.sp = Math.min(ship.sp, ship.spMax);
  }

  onActionChange(kind, el) {
    if (kind !== "assignStation") return;
    const item = this.document.items.get(el.dataset.item);
    return item?.update({ [`flags.${MODULE_ID}.station`]: el.value });
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
    await this.#strike(target)?.variants?.[Number(target.dataset.variant)]?.roll({ event });
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
    flags: { [MODULE_ID]: { ship }, core: { sheetClass: `${MODULE_ID}.NPCStarshipSheet` } }
  };
}

/* ---------------------------------- hooks ---------------------------------- */

Hooks.once("init", () => {
  if (!["sf2e", "pf2e"].includes(game.system.id)) {
    console.warn(`${MODULE_ID} | Needs the Starfinder 2e system; staying inactive.`);
    return;
  }
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
  Hooks.on("updateActor", (actor) => {
    if (actor.type !== "character") return;
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof PCStarshipSheet && app.rendered && app.ship.stations.some((s) => s.helmer === actor.uuid)) app.render();
    }
  });

  game.modules.get(MODULE_ID).api = { getShip, derivedFor, isStarship, createStarshipDialog };
  console.log(`${MODULE_ID} | Ready`);
});
