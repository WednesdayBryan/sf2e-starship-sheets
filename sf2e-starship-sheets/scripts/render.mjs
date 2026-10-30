/**
 * HTML for the starship sheets. Pure functions of a view model, so they can be previewed outside Foundry.
 */
import { effectiveSpeed, normalizeHeading, novaBlastDamage, partsLabel } from "./logic.mjs";
import {
  NPC_DEFAULT_ACTIONS, NPC_STATION_ACTIONS, NPC_WEAPONS,
  AON, EXPANSION_BAY_OPTIONS, EXPANSION_BAYS_URL, FRAMES, GRADE_LABELS, NPC_STATIONS, NPC_TIER_LABELS, NPC_TIERS, RULES_URL, SAVE_LABELS, SKILL_LABELS, STARSHIP_IMMUNITIES, STATIONS, UPGRADES, WEAPONS } from "./data.mjs";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const signed = (n) => (n === null || n === undefined ? "—" : n >= 0 ? `+${n}` : `${n}`);
const link = (path, text) => `<a class="sss-link" href="${AON}${esc(path)}" target="_blank" rel="noopener" title="Open on Archives of Nethys">${esc(text)}</a>`;
const opt = (value, label, selected) => `<option value="${esc(value)}"${String(value) === String(selected ?? "") ? " selected" : ""}>${esc(label)}</option>`;
const dis = (editable) => (editable ? "" : " disabled");

/** Action cost glyph, using the system's action font. */
export function costGlyph(cost) {
  const g = (c) => `<span class="action-glyph">${{ 1: "1", 2: "2", 3: "3", r: "R", f: "F" }[c] ?? c}</span>`;
  if (cost === "1-2") return `${g(1)}–${g(2)}`;
  if (cost === "1-3") return `${g(1)}–${g(3)}`;
  if (cost === "r/1") return `${g("r")}/${g(1)}`;
  if (cost === "passive" || cost === null || cost === undefined) return "";
  return g(cost);
}

/** Spell repository buttons: Cosmic Cannon attacks and damage, or Cast for the other spells. */
function spellButtons(a, s) {
  const i = s.index;
  const off = s.malfunctioning ? " disabled" : "";
  if (a.id !== 504) return `<button type="button" class="sss-roll" data-action="castSpell" data-spell="${a.id}" data-station="${i}"${off} title="Choose a rank and roll">Cast</button>`;
  const caster = s.helmerData;
  if (!caster || caster.missing) return `<span class="sss-hint">Assign a spellcaster</span>`;
  if (caster.spellAttack === null || caster.spellAttack === undefined) return `<span class="sss-hint">${esc(caster.name)} can't cast spells</span>`;
  const rank = Math.max(1, Math.ceil(caster.level / 2));
  const attacks = [0, -5, -10]
    .map((pen, mi) => `<button type="button" class="sss-strike" data-action="spellAttack" data-station="${i}" data-map="${mi}"${off} title="Spell attack vs target's AC">${signed(caster.spellAttack + pen)}</button>`)
    .join("");
  return `${attacks}
    <button type="button" class="sss-roll" data-action="spellDamage" data-station="${i}"${off} title="Rank ${rank} cantrip">${1 + rank}d4 force</button>
    <button type="button" class="sss-roll" data-action="spellDamage" data-station="${i}" data-critical="1"${off}>Crit</button>`;
}

/** Starship Weapon Crystal buttons: the solarian's melee solar weapon stats and solar flare, by attunement. */
function novaButtons(a, s) {
  if (![531, 533, 534, 536].includes(a.id)) return "";
  const i = s.index;
  const off = s.malfunctioning ? " disabled" : "";
  const c = s.helmerData;
  if (!c || c.missing) return `<span class="sss-hint">Assign a solarian</span>`;
  const tune = c.attunement ? c.attunement[0].toUpperCase() + c.attunement.slice(1) : null;
  if (a.id === 531) {
    return tune
      ? `<span class="sss-trait">${tune}</span>${c.attunement === "photon" ? `<span class="sss-hint">+${Math.ceil(Math.max(1, c.level) / 2)} fire on nova weapon hits</span>` : `<span class="sss-hint">hits reduce the target's Speed by 1 zone</span>`}`
      : `<span class="sss-hint">${esc(c.name)} isn't attuned</span>`;
  }
  if (a.id === 533 || a.id === 536) {
    const w = c.solarWeapon;
    if (!w) return `<span class="sss-hint">${esc(c.name)} has no solar weapon Strike</span>`;
    const variants = (w.variants?.length ? w.variants : [signed(w.attack)]).slice(0, a.id === 536 ? 1 : 3);
    return `<span class="sss-dim" title="Rolled from ${esc(c.name)}'s character sheet">${esc(w.label)}</span>
      ${variants
        .map((label, mi) => `<button type="button" class="sss-strike" data-action="novaStrike" data-station="${i}" data-map="${mi}"${a.id === 536 ? ` data-surge="1"` : ""}${off}
        title="${a.id === 536 ? "Nova Surge: no multiple attack penalty" : `${esc(w.label)} Strike vs target's AC`}">${esc(label)}</button>`)
        .join("")}
      <button type="button" class="sss-roll" data-action="novaDamage" data-station="${i}"${off} title="${esc(w.label)} damage with d10 dice">Damage ${w.dice}d10</button>
      <button type="button" class="sss-roll" data-action="novaDamage" data-station="${i}" data-critical="1"${off}>Crit</button>`;
  }
  if (!c.solarFlare) return `<span class="sss-hint">${esc(c.name)} has no solar flare Strike</span>`;
  if (!c.attunement) return `<span class="sss-hint">${esc(c.name)} isn't attuned</span>`;
  const blast = novaBlastDamage(c.attunement, c.str);
  return `${[0, -5, -10]
    .map((pen, mi) => `<button type="button" class="sss-strike" data-action="novaBlast" data-station="${i}" data-map="${mi}"${off} title="Nova flare Strike vs target's AC">${signed(c.solarFlare.attack + pen)}</button>`)
    .join("")}
    <button type="button" class="sss-roll" data-action="novaBlastDamage" data-station="${i}"${off} title="Range increment ${blast.range} zones">${esc(partsLabel(blast.parts))}</button>
    <button type="button" class="sss-roll" data-action="novaBlastDamage" data-station="${i}" data-critical="1"${off}>Crit</button>`;
}

/** Temporary effects on the starship (from nova attacks and the like). */
function effectsBlock(ship, editable) {
  const effects = ship.effects ?? [];
  if (!effects.length) return "";
  return `<div class="sss-effects"><label>Effects</label><ul>${effects
    .map(
      (e, i) => `<li>${esc(e.label)}
      ${e.persistent ? `<button type="button" class="sss-roll" data-action="rollPersistent" data-index="${i}">Roll ${esc(e.persistent.formula)} ${esc(e.persistent.type)}</button>` : ""}
      ${editable ? `<button type="button" class="sss-x" data-action="removeEffect" data-index="${i}" title="Remove">✕</button>` : ""}</li>`
    )
    .join("")}</ul></div>`;
}

function actionRow(a, { station, stationName, helmerName, disabled, extraHtml = "" }) {
  const extra =
    a.id === 588 ? `<button type="button" data-action="generateShields" data-station="${station}" title="Roll and add Shield Points">Roll</button>` :
    a.id === 590 ? `<button type="button" data-action="ventPower" data-station="${station}" title="Roll Vent Power damage">Roll</button>` : "";
  // Repair Station is how a malfunctioning station gets fixed, so it stays usable.
  const locked = disabled && a.id !== 610;
  return `<li class="sss-action${locked ? " is-disabled" : ""}">
    <button type="button" class="sss-action-name" data-action="postAction" data-action-id="${a.id}" data-station="${station}" title="Post to chat${helmerName ? ` as ${esc(helmerName)}` : ""}">
      ${costGlyph(a.cost)} ${esc(a.name)}</button>
    ${a.freq ? `<span class="sss-freq">${esc(a.freq)}</span>` : ""}
    ${a.source && a.source !== "Universal" && a.source !== stationName ? `<span class="sss-src">${esc(a.source)}</span>` : ""}
    ${checkButtons(a, station, locked)}
    ${extra}${extraHtml}
    ${link(a.url, "↗")}
  </li>`;
}

/** Roll buttons for an action's check, or a button that posts the save the target must make. */
function checkButtons(a, station, locked) {
  const c = a.check;
  if (!c) return "";
  if (c.save) {
    return `<button type="button" class="sss-roll" data-action="postAction" data-action-id="${a.id}" data-station="${station}"${locked ? " disabled" : ""}
      title="Post the DC for the target's ${c.basic ? "basic " : ""}${SAVE_LABELS[c.save]} save">${SAVE_LABELS[c.save]} DC</button>`;
  }
  const against = c.dc ? ` vs DC ${c.dc}` : c.vs ? ` vs the target's ${SAVE_LABELS[c.vs] ?? "Perception"} DC` : "";
  return c.skills
    .map(
      (sk) => `<button type="button" class="sss-roll" data-action="rollActionCheck" data-action-id="${a.id}" data-station="${station}" data-skill="${sk}"${locked ? " disabled" : ""}
      title="Roll ${SKILL_LABELS[sk]}${against}${c.secret ? " (secret)" : ""}"><i class="fa-solid fa-dice-d20"></i> ${SKILL_LABELS[sk]}</button>`
    )
    .join("");
}

/** Heading 0/180 dropdown; which direction 0 means depends on whether this is the party's or an NPC starship. */
function headingControl(ship, kind, editable) {
  const ltr = "→ left to right";
  const rtl = "← right to left";
  const [zero, oneEighty] = kind === "pc" ? [ltr, rtl] : [rtl, ltr];
  return `<label>Heading</label>
    <select name="ship.heading" data-dtype="Number"${dis(editable)} title="Turns the starship's tokens to match">
      ${opt(0, `0° ${zero}`, normalizeHeading(ship.heading))}${opt(180, `180° ${oneEighty}`, normalizeHeading(ship.heading))}
    </select>
    <label class="sss-malf" title="Tick if this starship's picture points left">
      <input type="checkbox" name="ship.artFacesLeft"${ship.artFacesLeft ? " checked" : ""}${dis(editable)}> Art faces left</label>`;
}

function portrait(vm) {
  return `<div class="sss-portrait-box">
    <img src="${esc(vm.img)}" data-action="editImage" alt="" class="sss-portrait" title="${vm.editable ? "Change portrait" : ""}">
    ${vm.editable ? `<button type="button" class="sss-token-btn" data-action="editToken" title="Change token image"><i class="fa-solid fa-chess-pawn"></i> Token</button>` : ""}
  </div>`;
}

function compromisedPips(n, editable) {
  return Array.from({ length: 10 }, (_, i) => {
    const v = i + 1;
    return `<button type="button" class="sss-pip${v <= n ? " is-on" : ""}" data-action="setCompromised" data-value="${v === n ? v - 1 : v}"${dis(editable)} title="Compromised ${v}"></button>`;
  }).join("");
}

function hullBlock(vm) {
  const { ship, editable } = vm;
  const d = vm.derived ?? vm;
  return `
  <section class="sss-card sss-hull">
    <div class="sss-meter">
      <label>Hull Points</label>
      <div class="sss-big"><input type="number" name="${vm.hpField}" value="${vm.hp.value}" min="0" max="${vm.hp.max}"${dis(editable)}> <span>/ ${vm.hp.max}</span></div>
      <div class="sss-bar"><span style="width:${vm.hp.max ? Math.round((100 * vm.hp.value) / vm.hp.max) : 0}%"></span></div>
    </div>
    <div class="sss-meter sss-shields">
      <label>Shield Points</label>
      <div class="sss-big"><input type="number" name="ship.sp" data-dtype="Number" value="${ship.sp}" min="0" max="${vm.spMax}"${dis(editable)}> <span>/ ${vm.spMax}</span></div>
      <div class="sss-bar"><span style="width:${vm.spMax ? Math.round((100 * ship.sp) / vm.spMax) : 0}%"></span></div>
    </div>
    <div class="sss-buttons">
      <button type="button" data-action="damage"${dis(editable)}><i class="fa-solid fa-burst"></i> Damage</button>
      <button type="button" data-action="repairHull"${dis(editable)}><i class="fa-solid fa-screwdriver-wrench"></i> Restore HP</button>
      <button type="button" data-action="restoreShields"${dis(editable)}><i class="fa-solid fa-shield-halved"></i> Restore SP</button>
    </div>
    <div class="sss-condition">
      <label>Compromised</label>
      <div class="sss-pips">${compromisedPips(ship.compromised, editable)}</div>
      ${ship.compromised > 0 ? `<button type="button" data-action="hullIntegrity"${dis(editable)}>Hull Integrity Check (DC ${10 + ship.compromised})</button>` : ""}
    </div>
    ${effectsBlock(ship, editable)}
    <div class="sss-row">
      <label>Wrecked <input type="number" class="sss-small" name="ship.wrecked" data-dtype="Number" value="${ship.wrecked}" min="0"${dis(editable)}></label>
      ${ship.destroyed ? `<span class="sss-destroyed">DESTROYED</span> <button type="button" data-action="clearDestroyed"${dis(editable)}>Clear</button>` : ""}
    </div>
    ${d.fortify !== undefined ? `<div class="sss-row"><label>Fortify <input type="number" class="sss-small" name="ship.fortify" data-dtype="Number" value="${ship.fortify}"${dis(editable)}></label>
      <label>Max SP <input type="number" class="sss-small" name="ship.spMax" data-dtype="Number" value="${ship.spMax}"${dis(editable)}></label></div>` : ""}
  </section>`;
}

/* ---------------------------------- PC ---------------------------------- */

export function renderPCSheet(vm) {
  const { ship, derived: d, editable } = vm;
  const tab = vm.tab ?? "stations";
  const save = (key, label) => {
    const s = d.saves[key];
    return `<button type="button" class="sss-save" data-action="rollSave" data-save="${key}" title="Frame ${signed(s.base)}${s.item ? `, helmed ${signed(s.item)} item` : ""}">
      <span class="sss-save-label">${label}</span><span class="sss-save-mod">${signed(s.total)}</span>${s.item ? `<span class="sss-helmed">helmed ${signed(s.item)}</span>` : ""}</button>`;
  };
  return `
  <div class="sss-sheet sss-pc">
    <header class="sss-header">
      ${portrait(vm)}
      <div class="sss-title">
        <input type="text" name="name" value="${esc(vm.name)}" class="sss-name"${dis(editable)} placeholder="Starship name">
        <div class="sss-sub">
          <label>Frame <select name="ship.frame"${dis(editable)}>${Object.entries(FRAMES).map(([k, f]) => opt(k, f.name, ship.frame)).join("")}</select></label>
          <label>Level <select name="ship.level" data-dtype="Number"${dis(editable)}>${Array.from({ length: 20 }, (_, i) => opt(i + 1, i + 1, d.level)).join("")}</select></label>
          <span class="sss-tag">Medium</span>
          <input type="text" name="ship.traits" value="${esc(ship.traits)}" placeholder="Traits"${dis(editable)} class="sss-traits">
          ${link(d.frame.url, "Frame")} ${link(RULES_URL, "Rules")}
        </div>
      </div>
    </header>

    ${d.warnings.length ? `<ul class="sss-warnings">${d.warnings.map((w) => `<li><i class="fa-solid fa-triangle-exclamation"></i> ${esc(w)}</li>`).join("")}</ul>` : ""}

    <div class="sss-top">
      <section class="sss-card sss-defenses">
        <div class="sss-ac">
          <label>Armor Class</label>
          <div class="sss-ac-value" title="Frame ${d.ac.frame}${d.ac.pilotDC !== null ? `, pilot's Piloting DC ${d.ac.pilotDC}` : ""}${d.ac.item ? `, helmed +${d.ac.item} item` : ""}${d.ac.circumstance ? `, +${d.ac.circumstance} circumstance` : ""}">${d.ac.total}</div>
          <div class="sss-ac-parts">
            <span>Frame ${d.ac.frame}</span>
            <span>Pilot DC ${d.ac.pilotDC ?? "—"}</span>
            ${d.ac.item ? `<span>Helmed +${d.ac.item}</span>` : ""}
          </div>
          <select name="ship.acCircumstance" data-dtype="Number"${dis(editable)} title="Circumstance bonus to AC">
            ${opt(0, "No Evade/Cover", ship.acCircumstance)}${opt(1, "Evade +1", ship.acCircumstance)}${opt(2, "Evade +2", ship.acCircumstance)}${opt(4, "Cover +4", ship.acCircumstance)}
          </select>
        </div>
        <div class="sss-saves">${save("fortitude", "Fort")}${save("reflex", "Ref")}${save("will", "Will")}</div>
        <div class="sss-movement">
          <div title="${d.speed !== d.speedBase ? `Frame Speed ${d.speedBase}, changed by effects` : ""}"><label>Speed</label><strong>${d.speed}</strong> zones${d.speed !== d.speedBase ? ` <span class="sss-hint">(base ${d.speedBase})</span>` : ""}</div>
          <div title="Frame ${d.sensor.base}${d.sensor.bonus ? ` + scanners ${d.sensor.bonus}` : ""}"><label>Sensor Range</label><strong>${d.sensor.total}</strong> zones</div>
          <div>${headingControl(ship, "pc", editable)}</div>
        </div>
        <div class="sss-iwr">
          <div><label>Immunities</label> <span>${esc(STARSHIP_IMMUNITIES)}</span></div>
          <div><label>Resistances</label> <input type="text" name="ship.resistances" value="${esc(ship.resistances)}"${dis(editable)}></div>
        </div>
      </section>
      ${hullBlock({ ...vm, spMax: d.spMax })}
    </div>

    <nav class="sss-tabs">
      ${[["stations", "Battle Stations"], ["bays", "Expansion Bays"], ["notes", "Notes"]]
        .map(([k, l]) => `<button type="button" data-action="sssTab" data-tab="${k}" class="${tab === k ? "is-active" : ""}">${l}</button>`)
        .join("")}
    </nav>

    <div class="sss-tab-body">
      ${tab === "stations" ? `<div class="sss-stations">${d.stations.map((s) => stationCard(s, vm)).join("")}</div>` : ""}
      ${tab === "bays" ? baysTab(vm) : ""}
      ${tab === "notes" ? `<textarea name="ship.notes" class="sss-notes"${dis(editable)} placeholder="Crew, cargo, history…">${esc(ship.notes)}</textarea>` : ""}
    </div>
  </div>`;
}

/** The facility installed in a bay: its key, falling back to a facility typed by name in older versions. */
export function bayKey(bay) {
  if (bay?.key) return bay.key;
  const name = String(bay?.name ?? "").trim().toLowerCase();
  return Object.entries(EXPANSION_BAY_OPTIONS).find(([, o]) => o.name.toLowerCase() === name)?.[0] ?? "";
}

function baysTab({ ship, editable }) {
  return `<div class="sss-bays">
    <p class="sss-hint">${link(EXPANSION_BAYS_URL, "Expansion bays")} — choose the facility installed in each bay.</p>
    ${ship.bays
      .map((b, i) => {
        const key = bayKey(b);
        const facility = EXPANSION_BAY_OPTIONS[key];
        return `<div class="sss-bay"><span class="sss-bay-n">${i + 1}</span>
        <select name="ship.bays.${i}.key"${dis(editable)}>${opt("", "— Empty bay —", key)}${Object.entries(EXPANSION_BAY_OPTIONS)
          .map(([k, o]) => opt(k, o.name, key))
          .join("")}</select>
        <span class="sss-bay-link">${facility ? link(facility.url, `${facility.name} benefits on AoN ↗`) : ""}</span></div>`;
      })
      .join("")}
  </div>`;
}

function stationCard(s, vm) {
  const { editable } = vm;
  const i = s.index;
  const typeSelect = s.fixed
    ? `<strong>${esc(s.def?.name ?? "")}</strong>`
    : `<select name="ship.stations.${i}.type"${dis(editable)}>${opt("", "— Empty slot —", s.type)}${["gunnery", "scanners", "conduit", "drone", "pilot", "generator"]
        .map((k) => opt(k, STATIONS[k].name, s.type))
        .join("")}</select>`;
  if (s.empty) return `<article class="sss-station is-empty"><header>${typeSelect}<span class="sss-slot">Slot ${i + 1}</span></header></article>`;

  const crewSelect = `<select name="ship.stations.${i}.helmer"${dis(editable)} title="Crew member helming this station">
    ${opt("", "— Unhelmed —", s.helmer)}${vm.crewOptions.map((c) => opt(c.uuid, c.name, s.helmer)).join("")}
    ${s.helmer && !vm.crewOptions.some((c) => c.uuid === s.helmer) ? opt(s.helmer, s.helmerData?.name ?? "Unknown", s.helmer) : ""}</select>`;
  const gradeSelect = `<select name="ship.stations.${i}.gradeOverride"${dis(editable)} title="Grade (Auto follows starship level)">
    ${opt("", `Auto (${GRADE_LABELS[s.autoGrade]})`, s.gradeOverride)}${GRADE_LABELS.map((g, gi) => opt(gi, g, s.gradeOverride)).join("")}</select>`;

  const bonusBits = [];
  if (s.type === "pilot") bonusBits.push(`Helmed: AC +${s.bonuses.ac}, Reflex +${s.bonuses.ref}; AC uses pilot's Piloting DC if higher`);
  if (s.type === "generator") bonusBits.push(`Helmed: Fortitude +${s.bonuses.fort}`);
  if (s.type === "scanners") bonusBits.push(`Sensor range +${s.bonuses.sensor}; helmed: Will +${s.bonuses.will}`);
  if (s.type === "conduit") bonusBits.push(`Helmed: Will +${s.bonuses.will}; casters use starship spells`);
  if (s.type === "gunnery") bonusBits.push(`Weapons: ${s.bonuses.damageDice} damage ${s.bonuses.damageDice > 1 ? "dice" : "die"}, tracking +${s.bonuses.tracking}`);
  if (s.type === "drone") bonusBits.push(`Drones: ${s.bonuses.drones}`);

  const usableUpgrades = Object.entries(UPGRADES).filter(([k, u]) => u.station === s.type && !s.upgrades.includes(k) && k !== s.defaultUpgrade);
  const upgrades = `<div class="sss-upgrades">
    <label>Upgrades <span class="sss-count">${s.upgrades.length}/${s.upgradesAllowed}</span></label>
    <ul>${s.upgradeViews
      .map(
        (u) => `<li>${u.url ? link(u.url, u.name) : esc(u.name)}${u.isDefault ? ` <span class="sss-tag">frame default</span>` : editable ? ` <button type="button" class="sss-x" data-action="removeUpgrade" data-station="${i}" data-index="${u.index}" title="Remove">✕</button>` : ""}</li>`
      )
      .join("")}</ul>
    ${editable && usableUpgrades.length ? `<select data-action-change="addUpgrade" data-station="${i}"><option value="">+ Add upgrade…</option>${usableUpgrades.map(([k, u]) => opt(k, `${u.name} (lvl ${u.level})`, "")).join("")}</select>` : ""}
  </div>`;

  const weapons = s.type === "gunnery" ? weaponsBlock(s, vm) : "";
  const rowOpts = { station: i, stationName: s.def.name, helmerName: s.helmerData?.name, disabled: s.malfunctioning };
  const actions = `<ul class="sss-actions">${s.actions
    .filter((a) => a.id !== 17 && a.id !== 19)
    .map((a) => actionRow(a, { ...rowOpts, extraHtml: novaButtons(a, s) }))
    .join("")}</ul>`;
  const spells = s.spells
    ? `<div class="sss-sub-list"><label>Spell repository <span class="sss-hint">(the helmer casts with their own spell slots)</span></label><ul class="sss-actions">${s.spells
        .map((a) => actionRow(a, { ...rowOpts, extraHtml: spellButtons(a, s) }))
        .join("")}</ul></div>`
    : "";
  const drones = s.drones
    ? `<div class="sss-sub-list"><label>Drone actions (while that drone is deployed)</label>${s.drones
        .map((dr) => `<div class="sss-drone">${link(dr.url, dr.name)}<ul class="sss-actions">${dr.actionList.map((a) => actionRow(a, rowOpts)).join("")}</ul></div>`)
        .join("")}</div>`
    : "";

  return `<article class="sss-station sss-${s.type}${s.malfunctioning ? " is-malfunctioning" : ""}">
    <header>
      ${typeSelect}
      <span class="sss-slot">${s.fixed ? "Default" : `Slot ${i + 1}`}</span>
      ${link(s.def.url, "↗")}
    </header>
    <div class="sss-station-controls">
      ${gradeSelect}
      ${crewSelect}
      <label class="sss-malf" title="Malfunctioning: the helmer can't use station actions but keeps passive benefits">
        <input type="checkbox" name="ship.stations.${i}.malfunctioning"${s.malfunctioning ? " checked" : ""}${dis(editable)}> Malfunctioning</label>
    </div>
    <p class="sss-bonus">${esc(bonusBits.join(" · "))}</p>
    ${weapons}
    ${upgrades}
    ${actions}
    ${spells}
    ${drones}
  </article>`;
}

function weaponsBlock(s, vm) {
  const { editable } = vm;
  const i = s.index;
  const slots = s.upgrades.includes("secondary-armaments") ? 2 : 1;
  const canAdd = editable && s.weapons.length < slots;
  const rows = s.weaponsView
    .map((w) => {
      if (w.missing) return `<li class="sss-weapon">${esc(w.name)} <button type="button" class="sss-x" data-action="removeWeapon" data-station="${i}" data-index="${w.index}">✕</button></li>`;
      const strikes = w.attack === null
        ? `<span class="sss-hint">Assign a helmer or set an attack bonus</span>`
        : w.map.map((pen, mi) => `<button type="button" class="sss-strike" data-action="strike" data-station="${i}" data-weapon="${w.index}" data-map="${mi}"${s.malfunctioning ? " disabled" : ""}>${signed(w.attack + pen)}</button>`).join("");
      return `<li class="sss-weapon${w.active ? " is-active" : ""}">
        <div class="sss-weapon-head">
          ${slots > 1 ? `<input type="radio" name="ship.stations.${i}.activeWeapon" data-dtype="Number" value="${w.index}"${w.active ? " checked" : ""}${dis(editable)} title="Active weapon">` : ""}
          ${link(w.url, w.name)} <span class="sss-dim">${esc(w.category)} · ${w.range} zones</span>
          ${editable ? `<button type="button" class="sss-x" data-action="removeWeapon" data-station="${i}" data-index="${w.index}" title="Remove">✕</button>` : ""}
        </div>
        <div class="sss-weapon-roll">
          ${strikes}
          <button type="button" data-action="weaponDamage" data-station="${i}" data-weapon="${w.index}">${esc(w.formula)} ${esc(w.type)}</button>
          <button type="button" data-action="weaponDamage" data-station="${i}" data-weapon="${w.index}" data-critical="1">Crit</button>
          ${w.area ? `<button type="button" data-action="postAction" data-action-id="17" data-station="${i}">Area Fire</button>` : ""}
          ${w.automatic ? `<button type="button" data-action="postAction" data-action-id="19" data-station="${i}">Auto-Fire</button>` : ""}
        </div>
        <div class="sss-traits-list">${w.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}${w.tracking ? `<span class="sss-trait">Tracking +${w.tracking}</span>` : ""}</div>
      </li>`;
    })
    .join("");
  return `<div class="sss-weapons">
    <label>Weapons <span class="sss-count">${s.weapons.length}/${slots}</span>
      <span class="sss-override" title="Use this attack bonus instead of the helmer's (tracking is added)">Attack override
        <input type="number" class="sss-small" name="ship.stations.${i}.attackOverride" value="${s.attackOverride ?? ""}"${dis(editable)}></span></label>
    <ul>${rows}</ul>
    ${canAdd ? `<select data-action-change="addWeapon" data-station="${i}"><option value="">+ Install weapon…</option>${Object.entries(WEAPONS).map(([k, w]) => opt(k, `${w.name} (${w.category})`, "")).join("")}</select>` : ""}
  </div>`;
}

/* ---------------------------------- NPC ---------------------------------- */

export function renderNPCSheet(vm) {
  const { ship, editable } = vm;
  const tab = vm.tab ?? "combat";
  const stat = (label, value, action, data = "") =>
    `<button type="button" class="sss-save" data-action="${action}" ${data}><span class="sss-save-label">${label}</span><span class="sss-save-mod">${value}</span></button>`;
  return `
  <div class="sss-sheet sss-npc">
    <header class="sss-header">
      ${portrait(vm)}
      <div class="sss-title">
        <input type="text" name="name" value="${esc(vm.name)}" class="sss-name"${dis(editable)}>
        <div class="sss-sub">
          <span class="sss-tag">Starship ${vm.level}</span>
          <span class="sss-tag">${esc(vm.size)}</span>
          ${vm.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}
          ${vm.isGM ? `<button type="button" data-action="openSystemSheet" title="Edit strikes, actions, skills and stats in the system's NPC sheet"><i class="fa-solid fa-pen-to-square"></i> Edit stat block</button>` : ""}
        </div>
      </div>
    </header>

    <div class="sss-top">
      <section class="sss-card sss-defenses">
        <div class="sss-ac"><label>Armor Class</label>
          <div class="sss-ac-value" title="Stat block AC ${vm.ac}${ship.acCircumstance ? `, +${ship.acCircumstance} circumstance` : ""}">${vm.ac + (Number(ship.acCircumstance) || 0)}</div>
          <div class="sss-ac-parts">
            <span>Stat block ${vm.ac}</span>
            ${vm.pilotingDC ? `<span>Piloting DC ${vm.pilotingDC}</span>` : ""}
          </div>
          <select name="ship.acCircumstance" data-dtype="Number"${dis(editable)} title="Circumstance bonus to AC">
            ${opt(0, "No Evade/Cover", ship.acCircumstance)}${opt(1, "Evade +1 / Stick to Cover +1", ship.acCircumstance)}${opt(2, "Evade +2", ship.acCircumstance)}
          </select></div>
        <div class="sss-saves">
          ${stat("Fort", signed(vm.saves.fortitude), "rollSave", 'data-save="fortitude"')}
          ${stat("Ref", signed(vm.saves.reflex), "rollSave", 'data-save="reflex"')}
          ${stat("Will", signed(vm.saves.will), "rollSave", 'data-save="will"')}
        </div>
        <div class="sss-movement">
          <div><label>Speed</label><input type="number" class="sss-small" name="ship.speed" data-dtype="Number" value="${ship.speed}"${dis(editable)}> zones${effectiveSpeed(ship.speed, ship.effects) !== ship.speed ? ` <span class="sss-hint">(now ${effectiveSpeed(ship.speed, ship.effects)})</span>` : ""}</div>
          <div><label>Sensor Range</label><input type="number" class="sss-small" name="ship.sensor" data-dtype="Number" value="${ship.sensor}"${dis(editable)}> zones</div>
          <div>${headingControl(ship, "npc", editable)}</div>
        </div>
        <div class="sss-checks">
          ${stat("Perception", signed(vm.perception), "rollPerception")}
          ${vm.skills.map((sk) => stat(esc(sk.label), signed(sk.mod), "rollSkill", `data-skill="${esc(sk.slug)}"`)).join("")}
        </div>
        <div class="sss-abilities">${vm.abilities.map((a) => `<span><b>${a.label}</b> ${signed(a.mod)}</span>`).join("")}</div>
        <div class="sss-iwr">
          ${vm.immunities ? `<div><label>Immunities</label> <span>${esc(vm.immunities)}</span></div>` : ""}
          ${vm.resistances ? `<div><label>Resistances</label> <span>${esc(vm.resistances)}</span></div>` : ""}
          ${vm.weaknesses ? `<div><label>Weaknesses</label> <span>${esc(vm.weaknesses)}</span></div>` : ""}
        </div>
      </section>
      ${hullBlock({ ...vm, spMax: ship.spMax, derived: { fortify: ship.fortify } })}
    </div>

    <nav class="sss-tabs">
      ${[["combat", "Stations & Actions"], ["notes", "Notes"]]
        .map(([k, l]) => `<button type="button" data-action="sssTab" data-tab="${k}" class="${tab === k ? "is-active" : ""}">${l}</button>`)
        .join("")}
    </nav>
    <div class="sss-tab-body">
      ${tab === "combat" ? npcCombat(vm) : `<textarea name="ship.notes" class="sss-notes"${dis(editable)}>${esc(ship.notes)}</textarea>`}
    </div>
  </div>`;
}

/** Common NPC station actions or default actions: name posts a chat card with the AoN link; some also roll. */
function npcActionList(actions, { ship, disabled = false, level, perception }) {
  if (!actions.length) return "";
  const off = disabled ? " disabled" : "";
  return `<ul class="sss-actions sss-npc-actions">${actions
    .map((a) => {
      const extra =
        a.roll === "fortify" ? `<button type="button" class="sss-roll" data-action="npcFortify"${off} title="Regain Shield Points equal to the fortify value">+${ship.fortify} SP</button>` :
        a.key === "evade" ? [1, 2].map((v) => `<button type="button" class="sss-roll" data-action="npcSetEvade" data-value="${v}"${off} title="Set AC +${v} circumstance for 1 round">AC +${v}</button>`).join("") :
        a.key === "stick-to-cover" ? `<button type="button" class="sss-roll" data-action="npcSetEvade" data-value="1"${off} title="Set AC +1 circumstance while in cover">AC +1</button>` :
        a.roll === "repairSelf" ? `<button type="button" class="sss-roll" data-action="npcRepairSelf" title="Stop a battle station malfunctioning and regain Hull Points equal to its level">+${Math.max(0, level ?? 0)} HP, fix a station</button>` :
        a.roll === "perception" ? `<button type="button" class="sss-roll" data-action="rollPerception" title="Perception check vs. Stealth DCs"><i class="fa-solid fa-dice-d20"></i> Perception ${signed(perception)}</button>` :
        a.save ? `<span class="sss-freq">target: ${SAVE_LABELS[a.save]} save${a.range ? `, within ${esc(a.range)}` : ""}</span>` : "";
      return `<li class="sss-action${disabled ? " is-disabled" : ""}">
        <button type="button" class="sss-action-name" data-action="npcCommonAction" data-key="${a.key}" title="Post to chat">${costGlyph(a.cost)} ${esc(a.name)}</button>
        ${a.traits.length ? `<span class="sss-freq">${esc(a.traits.join(", "))}</span>` : ""}
        ${a.freq ? `<span class="sss-freq">${esc(a.freq)}</span>` : ""}
        ${extra}
        ${link(a.url, "↗")}
      </li>`;
    })
    .join("")}</ul>`;
}

/** Starship weapons on an NPC starship, with attack and damage from its level. */
function npcWeaponsBlock(vm) {
  const { ship, editable } = vm;
  const tierSelect = (name, value) =>
    `<select name="${name}"${dis(editable)}>${NPC_TIERS.map((t) => opt(t, NPC_TIER_LABELS[t], value)).join("")}</select>`;
  const malf = ship.stations.some((st) => st.type === "gunnery" && st.malfunctioning);
  const rows = (vm.weapons ?? [])
    .map((w) => {
      if (w.missing) return `<li class="sss-weapon">${esc(w.name)} ${editable ? `<button type="button" class="sss-x" data-action="removeNPCWeapon" data-index="${w.index}">✕</button>` : ""}</li>`;
      return `<li class="sss-weapon">
        <div class="sss-weapon-head">${link(w.url, w.name)} <span class="sss-dim">${w.range === 0 ? "melee · targets in the same zone" : `${esc(w.category)} · range increment ${w.range} zones`}</span>
          ${editable ? `<button type="button" class="sss-x" data-action="removeNPCWeapon" data-index="${w.index}" title="Remove">✕</button>` : ""}</div>
        <div class="sss-weapon-roll">
          ${w.map.map((pen, mi) => `<button type="button" class="sss-strike" data-action="npcWeaponStrike" data-weapon="${w.index}" data-map="${mi}" title="Attack vs target's AC">${signed(w.attack + pen)}</button>`).join("")}
          <button type="button" data-action="npcWeaponDamage" data-weapon="${w.index}">${esc(w.formula)} ${esc(w.type)}</button>
          <button type="button" data-action="npcWeaponDamage" data-weapon="${w.index}" data-critical="1">Crit</button>
          ${w.area ? `<button type="button" data-action="npcWeaponAction" data-action-id="17">Area Fire</button>` : ""}
          ${w.automatic ? `<button type="button" data-action="npcWeaponAction" data-action-id="19">Auto-Fire</button>` : ""}
        </div>
        <div class="sss-weapon-tiers">
          <label>Attack ${tierSelect(`ship.weapons.${w.index}.attackTier`, w.attackTier)}</label>
          <label>Damage ${tierSelect(`ship.weapons.${w.index}.damageTier`, w.damageTier)}</label>
        </div>
        <div class="sss-traits-list">${w.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}</div>
      </li>`;
    })
    .join("");
  return `<section class="sss-card">
    <label class="sss-section">Starship Weapons <span class="sss-hint">(gunnery; attack and damage from level ${vm.level} using GM Core's creature tables)</span>${malf ? ` <span class="sss-destroyed">gunnery malfunctioning</span>` : ""}</label>
    <ul class="sss-weapons-list">${rows || `<li class="sss-hint">No starship weapons yet.</li>`}</ul>
    ${editable ? `<select data-action-change="addNPCWeapon"><option value="">+ Add starship weapon…</option>${Object.entries(NPC_WEAPONS)
      .map(([k, w]) => opt(k, w.range === 0 ? `${w.name} (melee)` : `${w.name} (${w.category}, ${w.range} zones)`, ""))
      .join("")}</select>` : ""}
  </section>`;
}

function npcCombat(vm) {
  const { ship, editable } = vm;
  const stations = ship.stations
    .map(
      (st, i) => `<li class="sss-npc-station${st.malfunctioning ? " is-malfunctioning" : ""}">
      <select name="ship.stations.${i}.type"${dis(editable)}>${Object.entries(NPC_STATIONS).map(([k, l]) => opt(k, l, st.type)).join("")}</select>
      <input type="text" name="ship.stations.${i}.name" value="${esc(st.name)}" placeholder="What it runs (e.g. coilgun, Boost Thrusters)"${dis(editable)}>
      <label class="sss-malf"><input type="checkbox" name="ship.stations.${i}.malfunctioning"${st.malfunctioning ? " checked" : ""}${dis(editable)}> Malfunctioning</label>
      ${editable ? `<button type="button" class="sss-x" data-action="removeNPCStation" data-index="${i}" title="Remove">✕</button>` : ""}
      ${npcActionList(NPC_STATION_ACTIONS[st.type] ?? [], { ship, disabled: st.malfunctioning })}
    </li>`
    )
    .join("");

  const strikes = vm.strikes.length
    ? vm.strikes
        .map(
          (s) => `<li class="sss-weapon">
        <div class="sss-weapon-head"><strong>${esc(s.label)}</strong> <span class="sss-dim">${esc(s.kind)}</span></div>
        <div class="sss-weapon-roll">
          ${s.variants.map((v, vi) => `<button type="button" class="sss-strike" data-action="npcStrike" data-strike="${s.index}" data-variant="${vi}">${esc(v)}</button>`).join("")}
          <button type="button" data-action="npcDamage" data-strike="${s.index}">${esc(s.damage || "Damage")}</button>
          <button type="button" data-action="npcDamage" data-strike="${s.index}" data-critical="1">Crit</button>
        </div>
        <div class="sss-traits-list">${s.traits.map((t) => `<span class="sss-trait">${esc(t)}</span>`).join("")}</div>
      </li>`
        )
        .join("")
    : `<li class="sss-hint">No Strikes yet. Use “Edit stat block” to add them in the system's NPC sheet.</li>`;

  const groups = Object.entries(NPC_STATIONS)
    .map(([key, label]) => {
      const acts = vm.actions.filter((a) => (a.station || "other") === key);
      if (!acts.length) return "";
      const malf = ship.stations.some((st) => st.type === key && st.malfunctioning);
      return `<div class="sss-action-group${malf ? " is-malfunctioning" : ""}"><label>${esc(label)}${malf ? " — malfunctioning" : ""}</label><ul class="sss-actions">${acts
        .map(
          (a) => `<li class="sss-action">
          <button type="button" class="sss-action-name" data-action="npcAction" data-item="${a.id}">${costGlyph(a.cost)} ${esc(a.name)}</button>
          ${a.traits.length ? `<span class="sss-freq">${esc(a.traits.join(", "))}</span>` : ""}
          ${editable ? `<select data-action-change="assignStation" data-item="${a.id}" title="Battle station">${Object.entries(NPC_STATIONS).map(([k, l]) => opt(k, l, a.station || "other")).join("")}</select>` : ""}
        </li>`
        )
        .join("")}</ul></div>`;
    })
    .join("");

  return `
  <section class="sss-card">
    <label class="sss-section">Battle Stations ${editable ? `<button type="button" data-action="addNPCStation">+ Add</button>` : ""}</label>
    <ul class="sss-npc-stations">${stations}</ul>
  </section>
  ${npcWeaponsBlock(vm)}
  <section class="sss-card">
    <label class="sss-section">Strikes <span class="sss-hint">(from the NPC stat block)</span></label>
    <ul class="sss-weapons-list">${strikes}</ul>
  </section>
  <section class="sss-card">
    <label class="sss-section">Default actions <span class="sss-hint">every NPC starship can use these</span></label>
    ${npcActionList(NPC_DEFAULT_ACTIONS, { ship, level: vm.level, perception: vm.perception })}
    <label class="sss-section">Actions <span class="sss-hint">(from the NPC stat block)</span></label>
    ${groups || `<p class="sss-hint">No actions yet. Add them with “Edit stat block”, then assign each to a battle station here.</p>`}
  </section>`;
}
