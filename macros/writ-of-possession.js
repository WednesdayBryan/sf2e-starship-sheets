// Writ of Possession: a level 8 Free Captain starship built on the Dread Dominator (Tech Core pg. 217),
// refitted for boarding. Run as a GM Script macro. It fills in the existing NPC actor named
// "Writ of Possession" and can be run again safely (it updates instead of duplicating).

const NAME = "Writ of Possession";
const MODULE_ID = "sf2e-starship-sheets";
const actor = game.actors.getName(NAME);
if (!game.user.isGM) return ui.notifications.error("Run this macro as the GM.");
if (!actor) return ui.notifications.error(`No actor named "${NAME}". Create the NPC starship first.`);
if (actor.type !== "npc") return ui.notifications.error(`"${NAME}" is a ${actor.type} actor; it must be an NPC starship.`);

const DOMINATOR = "https://2e.aonsrd.com/creatures/397-dread-dominator";
const p = (...lines) => lines.map((l) => `<p>${l}</p>`).join("");
// Link to the system's Off-Guard condition, wherever its compendium is.
let offGuard = "<strong>off-guard</strong>";
for (const pack of game.packs) {
  if (pack.documentName !== "Item" || pack.metadata.packageType !== "system") continue;
  const entry = (await pack.getIndex({ fields: ["type"] })).find((e) => e.name === "Off-Guard" && e.type === "condition");
  if (entry) {
    offGuard = `@UUID[${entry.uuid ?? `Compendium.${pack.collection}.Item.${entry._id}`}]{off-guard}`;
    break;
  }
}
const degrees = (cs, s, f, cf) =>
  `<hr /><p><strong>Critical Success</strong> ${cs}</p><p><strong>Success</strong> ${s}</p><p><strong>Failure</strong> ${f}</p><p><strong>Critical Failure</strong> ${cf}</p>`;

// Stat block: Dread Dominator, unchanged (it is already level 8).
await actor.update({
  "system.details.level.value": 8,
  "system.traits.size.value": "lg",
  "system.traits.value": ["tech"],
  "system.attributes.ac.value": 24,
  "system.attributes.hp.max": 122,
  "system.attributes.hp.value": 122,
  // Starship immunities (Tech Core pg. 172): starships also can never become doomed or unconscious.
  "system.attributes.immunities": [
    "bleed", "death-effects", "disease", "drained", "fatigued", "paralyzed", "poison",
    "sickened", "spirit", "vitality", "void", "doomed", "unconscious"
  ].map((type) => ({ type })),
  "system.perception.mod": 17,
  "system.saves.fortitude.value": 17,
  "system.saves.reflex.value": 13,
  "system.saves.will.value": 17,
  "system.abilities.str.mod": 6,
  "system.abilities.dex.mod": 2,
  "system.abilities.con.mod": 4,
  "system.abilities.int.mod": 3,
  "system.abilities.wis.mod": 2,
  "system.abilities.cha.mod": 4,
  "system.skills": { computers: { base: 15 }, crafting: { base: 15 }, piloting: { base: 14 } },
  "system.details.publicNotes": p(
    "A Sovereign Dominator stolen from the Azlanti Star Empire's fleet and refitted by the Free Captains for one job: taking ships intact.",
    "Its polarizing beam and harpoon launcher are still there, but the prow now carries rotating chainsaw blades and magnetic boarding clamps, and a pressurized boarding pod rides in a launch cradle under the keel."
  ),
  "system.details.privateNotes": p(
    `<strong>Base:</strong> <a href="${DOMINATOR}">Dread Dominator</a> (creature 8). Starship immunities are set as the actor's immunities; unlike most objects, it isn't immune to mental or nonlethal effects.`,
    "<strong>Boarding refit:</strong> adds Chainsaw Prow (it clings to a target of any size), Reel In and Deploy Boarders.",
    "<strong>Tactics:</strong> Raider Beam the target, Piercing Harpoon it, Reel In to close to 0 zones, then Chainsaw Prow to cling and Deploy Boarders. It tries not to destroy its prey: the goal is a prize ship.",
    "<strong>Boarding party:</strong> GM's choice. The system's Free Captain creatures fit (Starfinder Alien Core): a Free Captain (creature 6) leading Free Captain Gunners (creature 2) or Knaves (creature 1)."
  )
});

// Starship data for the NPC starship sheet.
const ship = foundry.utils.mergeObject(actor.getFlag(MODULE_ID, "ship") ?? {}, {
  version: 1,
  kind: "npc",
  sp: 32,
  spMax: 32,
  fortify: 16,
  sensor: 8,
  speed: 2,
  compromised: 0,
  wrecked: 0,
  destroyed: false,
  weapons: [],
  stations: [
    { type: "pilot", name: "Boost Thrusters, Change Heading, Chainsaw Prow, Deploy Boarders", malfunctioning: false },
    { type: "gunnery", name: "overcharged polarizing beam, Piercing Harpoon", malfunctioning: false },
    { type: "generator", name: "Fortify Shields, overcharged polarizing beam, Reel In", malfunctioning: false },
    { type: "scanners", name: "Raider Beam, Wave Holo-Roger", malfunctioning: false }
  ]
}, { inplace: false });
await actor.setFlag(MODULE_ID, "ship", ship);

// Strike and actions. `station` is the battle station the NPC sheet files each action under.
const action = (name, station, cost, traits, description, extra = {}) => ({
  name,
  type: "action",
  img: `systems/sf2e/icons/actions/${{ 1: "OneAction", 2: "TwoActions", free: "FreeAction" }[cost]}.webp`,
  flags: { [MODULE_ID]: { station } },
  system: {
    actionType: { value: cost === "free" ? "free" : "action" },
    actions: { value: cost === "free" ? null : cost },
    category: "offensive",
    description: { value: description },
    traits: { value: traits },
    ...extra
  }
});

const items = [
  {
    name: "Overcharged Polarizing Beam",
    type: "melee",
    img: "systems/sf2e/icons/default-icons/melee.svg",
    system: {
      action: "strike",
      bonus: { value: 15 },
      damageRolls: { beam: { damage: "2d10+8", damageType: "electricity" } },
      description: { value: p("Ranged starship weapon: range increment 1 zone, ordnance. Fired from the gunnery or the generator.") },
      range: null,
      traits: { value: ["boost-2d10", "tech", "versatile-acid"] }
    }
  },
  action("Piercing Harpoon", "gunnery", 2, [],
    p("The Free Captain starship launches a harpoon at another starship within 1 zone. The target starship takes @Damage[3d8[piercing]] damage and attempts a @Check[fortitude|dc:23] save.") +
    degrees(
      "The target is unaffected.",
      "The target takes half damage.",
      "The target takes full damage, and the Free Captain starship chooses a battle station on the target starship to become malfunctioning. The harpoon's line stays attached until the end of the Writ of Possession's next turn (see Reel In).",
      "The target takes double damage, and the Free Captain starship chooses a battle station on the target to become malfunctioning. Additionally, the harpoon causes a Hull Breach hazard to appear in a space adjacent to the malfunctioning battle station. The line stays attached, and the Writ of Possession can use Deploy Boarders."
    )),
  action("Raider Beam", "scanners", 1, [],
    p(`The Dominator emits a harmless laser beam that plants a unique signal onto a starship within sensor range. The target must attempt a @Check[will|dc:23] save. On a failure, it becomes ${offGuard} to the Dominator and its allies within sensor range for 1 round. On a critical failure, the target also can't benefit from cover against starships it's off-guard to for the duration.`)),
  action("Wave Holo-Roger", "scanners", 1, ["mental", "visual"],
    p("A Free Captain starship's holo-roger is a sight that gives rise to courage in the hearts of its allies. Allied creatures and starships within sensor range of the starship gain a +2 circumstance bonus to Will saves against fear effects for 1 round."),
    { category: "interaction" }),
  action("Chainsaw Prow", "pilot", 1, [],
    p("The Free Captain starship sinks its rotating blades into the hull of a starship within 0 zones. The target takes @Damage[2d8+7[slashing]] damage with a @Check[fortitude|dc:23|basic] save.",
      "<strong>Boarding clamps (refit):</strong> If Chainsaw Prow deals damage to the target's Hull Points, the Writ of Possession clings to the target, whatever its size. Until the start of the Writ of Possession's next turn, it moves with the target whenever the target moves.")),
  action("Reel In", "generator", 1, [],
    p("<strong>Requirements</strong> A starship failed its save against the Writ of Possession's Piercing Harpoon since the end of the Writ's last turn, and the harpoon's line is still attached.",
      "<strong>Effect</strong> The harpoon winch hauls on the line. The harpooned starship attempts a @Check[fortitude|dc:23] save.") +
    degrees(
      "The line snaps. The target is no longer harpooned.",
      "The target holds its position, but the line stays attached.",
      "The target is pulled 1 zone toward the Writ of Possession.",
      "The target is pulled into the Writ of Possession's zone (0 zones), and the Writ of Possession clings to it as if it had dealt damage with Chainsaw Prow."
    )),
  action("Deploy Boarders", "pilot", "free", [],
    p("<strong>Frequency</strong> twice per day",
      "<strong>Trigger</strong> The Writ of Possession deals damage to a starship's Hull Points with Chainsaw Prow, or a starship critically fails its save against the Writ's Piercing Harpoon.",
      "<strong>Effect</strong> The Writ of Possession fires its boarding pod into the target. The pod creates a breach in a space on the target starship and unloads a boarding party there (GM's choice; see the GM notes)."),
    { frequency: { max: 2, per: "day" } })
];

for (const data of items) {
  const existing = actor.items.find((i) => i.type === data.type && i.name === data.name);
  if (existing) await existing.update(data);
  else await actor.createEmbeddedDocuments("Item", [data]);
}

ui.notifications.info(`${NAME} is ready: Dread Dominator stat block with the boarding refit.`);
actor.sheet.render(true);
