// Mercy of Tomorrow: a level 3 medical transport built on the Flint-class Mining Vessel (Tech Core pg. 240).
// Run as a GM Script macro. It fills in the existing NPC actor named "Mercy of Tomorrow" and can be
// run again safely (it updates instead of duplicating).

const NAME = "Mercy of Tomorrow";
const MODULE_ID = "sf2e-starship-sheets";
const actor = game.actors.getName(NAME);
if (!game.user.isGM) return ui.notifications.error("Run this macro as the GM.");
if (!actor) return ui.notifications.error(`No actor named "${NAME}". Create the NPC starship first.`);
if (actor.type !== "npc") return ui.notifications.error(`"${NAME}" is a ${actor.type} actor; it must be an NPC starship.`);

const FLINT = "https://2e.aonsrd.com/creatures/444-flint-class-mining-vessel";
const p = (...lines) => lines.map((l) => `<p>${l}</p>`).join("");

// Stat block: Flint-class Mining Vessel, unchanged (it is already level 3).
await actor.update({
  "system.details.level.value": 3,
  "system.traits.size.value": "med",
  "system.traits.value": ["tech"],
  "system.attributes.ac.value": 18,
  "system.attributes.hp.max": 30,
  "system.attributes.hp.value": 30,
  // Starship immunities (Tech Core pg. 172): starships also can never become doomed or unconscious.
  "system.attributes.immunities": [
    "bleed", "death-effects", "disease", "drained", "fatigued", "paralyzed", "poison",
    "sickened", "spirit", "vitality", "void", "doomed", "unconscious"
  ].map((type) => ({ type })),
  "system.attributes.resistances": [{ type: "bludgeoning", value: 3 }],
  "system.perception.mod": 8,
  "system.saves.fortitude.value": 10,
  "system.saves.reflex.value": 9,
  "system.saves.will.value": 8,
  "system.abilities.str.mod": 4,
  "system.abilities.dex.mod": 2,
  "system.abilities.con.mod": 3,
  "system.abilities.int.mod": 3,
  "system.abilities.wis.mod": 3,
  "system.abilities.cha.mod": 1,
  "system.skills": { computers: { base: 10 }, piloting: { base: 9 } },
  "system.details.publicNotes": p(
    "A Flint-class mining hull converted into a medical transport. Its ore holds are now medical bays and rows of stasis pods, and the red-and-white hull broadcasts a protected-vessel signal.",
    "The refit kept what a rescue ship needs. The mining lasers cut wreckage away from trapped crews, the hardlight hauling net now catches escape pods and drifting survivors, and the sensors that once found ore now read the damage and life signs of other ships."
  ),
  "system.details.privateNotes": p(
    `<strong>Base:</strong> <a href="${FLINT}">Flint-class Mining Vessel</a> (creature 3). Every number is unchanged; the weapons and sensors are renamed for the medical refit.`,
    "<strong>Medical refit:</strong> Triage Sensors also read hull damage and life signs, and the new Stabilization Beam restores Hull Points to an allied starship once per day.",
    "<strong>Tactics:</strong> It avoids fights. It keeps its distance with the rescue net, uses the beam on an ally (or itself) when one is badly damaged, and runs when it can."
  )
});

// Starship data for the NPC starship sheet.
const ship = foundry.utils.mergeObject(actor.getFlag(MODULE_ID, "ship") ?? {}, {
  version: 1,
  kind: "npc",
  sp: 10,
  spMax: 10,
  fortify: 5,
  sensor: 5,
  speed: 4,
  compromised: 0,
  wrecked: 0,
  destroyed: false,
  weapons: [],
  stations: [
    { type: "generator", name: "Fortify Shield Points, hardlight rescue net, Stabilization Beam", malfunctioning: false },
    { type: "gunnery", name: "coilgun, rescue lasers", malfunctioning: false },
    { type: "pilot", name: "Boost Thrusters, Change Heading", malfunctioning: false },
    { type: "scanners", name: "triage sensors", malfunctioning: false }
  ]
}, { inplace: false });
await actor.setFlag(MODULE_ID, "ship", ship);

// Strikes and actions. `station` is the battle station the NPC sheet files each action under.
const ICONS = { 1: "OneAction", 2: "TwoActions", free: "FreeAction", passive: "Passive" };
const action = (name, station, cost, traits, description, extra = {}) => ({
  name,
  type: "action",
  img: `systems/sf2e/icons/actions/${ICONS[cost]}.webp`,
  flags: { [MODULE_ID]: { station } },
  system: {
    actionType: { value: typeof cost === "number" ? "action" : cost },
    actions: { value: typeof cost === "number" ? cost : null },
    category: "offensive",
    description: { value: description },
    traits: { value: traits },
    ...extra
  }
});
// Ranged starship weapons get a huge maximum range and no range increment: the system measures range in feet,
// so this marks them ranged without foot-based range penalties or "out of range" refusals on the starship map.
const RANGED = { increment: null, max: 10000 };
// `zones` is the range increment in zones (0 = targets in the same zone), shown on the NPC starship sheet.
const strike = (name, bonus, damage, damageType, traits, description, zones, range = null) => ({
  name,
  type: "melee",
  img: "systems/sf2e/icons/default-icons/melee.svg",
  flags: { [MODULE_ID]: { zones } },
  system: {
    action: "strike",
    bonus: { value: bonus },
    damageRolls: { main: { damage, damageType } },
    description: { value: p(description) },
    range,
    traits: { value: traits }
  }
});

const items = [
  strike("Rescue Lasers", 12, "1d6+7", "slashing", ["razing", "tech"],
    "Melee starship weapon (targets in the same zone). The converted mining lasers, used to cut wreckage away from trapped crews.", 0),
  strike("Coilgun", 8, "1d6+5", "piercing", ["agile", "analog"],
    "Ranged starship weapon: range increment 3 zones.", 3, RANGED),
  action("Hardlight Rescue Net", "generator", 1, ["tech"],
    p("<strong>Area Fire</strong> 1-zone burst within 4 zones. Damage @Damage[1d6+7[bludgeoning]] with a @Check[reflex|dc:20|basic] save.",
      "On a failure, targets take a –2-zone status penalty to Speed for 1 round (2 rounds on a critical failure).",
      "The converted hauling net. Out of combat, it catches escape pods and drifting survivors.")),
  action("Triage Sensors", "scanners", "passive", [],
    p("The Mercy of Tomorrow passively scans starship hulls within sensor range and automatically discerns their immunities, weaknesses and resistances.",
      "<strong>Medical refit:</strong> it also knows each of those starships' current Hull Points and whether any of the creatures aboard are injured or dying."),
    { category: "defensive" }),
  action("Stabilization Beam", "generator", 2, ["healing", "manipulate"],
    p("<strong>Frequency</strong> once per day",
      "<strong>Effect</strong> The Mercy of Tomorrow locks a medical tractor field onto an allied starship within 2 zones (or itself), sealing breaches and stabilizing failing systems. The starship regains @Damage[2d8+5[healing]] Hull Points."),
    { category: "defensive", frequency: { max: 1, per: "day" } })
];

for (const data of items) {
  const existing = actor.items.find((i) => i.type === data.type && i.name === data.name);
  if (existing) await existing.update(data);
  else await actor.createEmbeddedDocuments("Item", [data]);
}

ui.notifications.info(`${NAME} is ready: Flint-class stat block with the medical refit.`);
actor.sheet.render(true);
