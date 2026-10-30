/**
 * Starfinder 2e tactical starship combat reference data (Tech Core, ORC license).
 * Numbers come from the Archives of Nethys starship builder. Rules text is not reproduced:
 * every action, upgrade and weapon links to its Archives of Nethys page instead.
 */

export const MODULE_ID = "sf2e-starship-sheets";
export const AON = "https://2e.aonsrd.com/";

export const GRADES = ["commercial", "tactical", "advanced", "superior", "elite", "ultimate", "paragon"];
export const GRADE_LABELS = ["Commercial", "Tactical", "Advanced", "Superior", "Elite", "Ultimate", "Paragon"];

/** Frame advancement rows: [level, HP, SP, AC, Fort, Ref, Will, Speed (zones)] */
export const FRAMES = {
  bulwark: {
    name: "Bulwark",
    url: "tactical-starship-combat/frames/1-bulwark",
    sensor: 5,
    defaults: { pilot: "ramming-prow", generator: null },
    adv: [
      [1, 27, 10, 17, 9, 6, 8, 2], [2, 42, 14, 18, 10, 7, 9, 2], [3, 57, 18, 19, 11, 10, 10, 2],
      [4, 72, 22, 20, 12, 11, 11, 2], [5, 92, 31, 21, 14, 13, 13, 2], [6, 108, 36, 22, 15, 14, 14, 2],
      [7, 124, 41, 25, 18, 15, 15, 2], [8, 140, 46, 26, 19, 16, 16, 2], [9, 156, 51, 27, 20, 17, 17, 2],
      [10, 172, 66, 28, 21, 18, 19, 3], [11, 188, 72, 29, 22, 19, 22, 3], [12, 204, 78, 30, 23, 20, 23, 3],
      [13, 220, 84, 33, 24, 21, 24, 3], [14, 236, 90, 34, 25, 22, 25, 3], [15, 267, 96, 35, 29, 24, 26, 3],
      [16, 284, 102, 36, 30, 25, 27, 3], [17, 301, 108, 39, 31, 26, 28, 3], [18, 318, 114, 40, 32, 27, 29, 3],
      [19, 335, 120, 41, 33, 28, 30, 4], [20, 372, 146, 42, 35, 29, 32, 4]
    ]
  },
  explorer: {
    name: "Explorer",
    url: "tactical-starship-combat/frames/2-explorer",
    sensor: 6,
    defaults: { pilot: null, generator: "pulse-shield" },
    adv: [
      [1, 24, 11, 15, 8, 6, 9, 3], [2, 36, 16, 16, 9, 7, 10, 3], [3, 48, 21, 17, 10, 10, 11, 3],
      [4, 60, 26, 18, 11, 11, 12, 3], [5, 77, 36, 20, 13, 13, 14, 3], [6, 90, 42, 21, 14, 14, 15, 3],
      [7, 103, 48, 24, 15, 15, 18, 4], [8, 116, 54, 25, 16, 16, 19, 4], [9, 129, 60, 26, 17, 17, 20, 4],
      [10, 142, 66, 28, 18, 19, 21, 4], [11, 155, 72, 29, 21, 20, 22, 4], [12, 168, 78, 30, 22, 21, 23, 4],
      [13, 181, 84, 33, 23, 22, 24, 4], [14, 194, 90, 34, 24, 23, 25, 4], [15, 222, 111, 35, 26, 24, 29, 5],
      [16, 236, 118, 36, 27, 25, 30, 5], [17, 250, 125, 39, 28, 26, 31, 5], [18, 264, 132, 40, 29, 27, 32, 5],
      [19, 278, 139, 41, 30, 28, 33, 5], [20, 292, 166, 43, 31, 30, 35, 5]
    ]
  },
  skirmisher: {
    name: "Skirmisher",
    url: "tactical-starship-combat/frames/3-skirmisher",
    sensor: 4,
    defaults: { pilot: "rotational-thrusters", generator: null },
    adv: [
      [1, 22, 8, 16, 6, 9, 8, 5], [2, 32, 12, 17, 7, 10, 9, 5], [3, 42, 16, 18, 10, 11, 10, 5],
      [4, 52, 20, 19, 11, 12, 11, 5], [5, 67, 29, 21, 13, 14, 13, 5], [6, 78, 34, 22, 14, 15, 14, 5],
      [7, 89, 39, 25, 15, 18, 15, 6], [8, 100, 44, 26, 16, 19, 16, 6], [9, 111, 49, 27, 17, 20, 17, 6],
      [10, 122, 64, 28, 18, 21, 19, 6], [11, 133, 70, 29, 19, 22, 22, 6], [12, 144, 76, 30, 20, 23, 23, 6],
      [13, 155, 82, 33, 21, 24, 24, 6], [14, 166, 88, 34, 22, 25, 25, 6], [15, 192, 94, 36, 24, 29, 26, 7],
      [16, 204, 100, 37, 25, 30, 27, 7], [17, 216, 106, 40, 26, 31, 28, 7], [18, 228, 112, 41, 27, 32, 29, 7],
      [19, 240, 118, 42, 28, 33, 30, 7], [20, 252, 144, 44, 29, 35, 32, 7]
    ]
  }
};

const SLOW_GRADES = [1, 2, 5, 8, 11, 14, 18];
const FAST_GRADES = [1, 2, 4, 10, 12, 16, 19];
const UPGRADE_SLOTS = [0, 1, 2, 2, 3, 3, 4];
const HELM_BONUS = [0, 0, 0, 1, 1, 2, 3];

/** Battle stations. `actions` maps a grade index to the station actions it unlocks. */
export const STATIONS = {
  pilot: {
    name: "Pilot's Console",
    url: "tactical-starship-combat/battle-stations/5-pilots-console",
    levels: SLOW_GRADES,
    upgrades: UPGRADE_SLOTS,
    helmedAC: [0, 0, 1, 1, 2, 2, 3],
    helmedRef: [0, 0, 0, 1, 1, 2, 3],
    actions: { 0: [596, 598, 597], 1: [599, 600], 2: [601, 602] }
  },
  generator: {
    name: "Generator",
    url: "tactical-starship-combat/battle-stations/2-generator",
    levels: SLOW_GRADES,
    upgrades: UPGRADE_SLOTS,
    helmedFort: HELM_BONUS,
    actions: { 0: [587, 588], 1: [589], 2: [590] }
  },
  gunnery: {
    name: "Gunnery",
    url: "tactical-starship-combat/battle-stations/3-gunnery",
    levels: FAST_GRADES,
    upgrades: UPGRADE_SLOTS,
    damageDice: [1, 1, 2, 2, 3, 3, 4],
    tracking: [0, 1, 1, 2, 2, 3, 3],
    actions: { 0: [591], 1: [592] }
  },
  conduit: {
    name: "Magic Conduit",
    url: "tactical-starship-combat/battle-stations/4-magic-conduit",
    levels: SLOW_GRADES,
    upgrades: UPGRADE_SLOTS,
    helmedWill: HELM_BONUS,
    actions: { 0: [593, 594] },
    spells: [503, 504, 505, 506]
  },
  scanners: {
    name: "Scanners",
    url: "tactical-starship-combat/battle-stations/6-scanners",
    levels: SLOW_GRADES,
    upgrades: UPGRADE_SLOTS,
    helmedWill: HELM_BONUS,
    sensor: [1, 1, 2, 2, 3, 3, 4],
    actions: { 0: [603, 604, 605], 1: [606, 607], 2: [608] }
  },
  drone: {
    name: "Drone Console",
    url: "tactical-starship-combat/battle-stations/1-drone-console",
    levels: FAST_GRADES,
    upgrades: UPGRADE_SLOTS,
    drones: [1, 2, 3, 4, 4, 5, 5],
    actions: { 0: [584, 585, 586] }
  }
};

/** Actions every battle station can use (Jump Start only at the stations listed in its check). */
export const UNIVERSAL_ACTIONS = [609, 610];

/**
 * What each station action asks the helming crew member to roll.
 * - `skills`: the helmer rolls one of these; `vs` is the target's DC to roll against (perception, fortitude,
 *   reflex, will), or `dc` is a fixed DC. `byStation` picks the skills from the station being helmed.
 * - `save`: the target rolls this save against the helmer's `dcSkill` DC (or class DC with `dcClass`).
 * - `secret`: the GM rolls it blind.
 */
export const ACTION_CHECKS = {
  416: { save: "fortitude", basic: true, dcSkill: "crafting" },
  418: { save: "fortitude", dcSkill: "crafting" },
  430: { save: "fortitude", basic: true, dcSkill: "piloting" },
  434: { save: "fortitude", basic: true, dcSkill: "piloting" },
  436: { skills: ["computers"], secret: true },
  570: { save: "reflex", basic: true, dcClass: true },
  573: { skills: ["crafting"], dc: 15 },
  575: { save: "will", dcClass: true },
  589: { skills: ["crafting", "perception"], vs: "reflex" },
  590: { save: "reflex", basic: true, dcSkill: "crafting" },
  599: { skills: ["piloting"], vs: "perception" },
  601: { skills: ["piloting"], vs: "reflex" },
  604: { skills: ["computers", "perception"], secret: true },
  605: { save: "will", dcSkill: "computers" },
  606: { skills: ["computers"], vs: "fortitude" },
  607: { skills: ["computers"], vs: "will" },
  608: { skills: ["computers"], vs: "will" },
  609: { byStation: { generator: ["crafting"], conduit: ["arcana", "occultism", "nature", "religion"], scanners: ["computers"] }, dc: 15 },
  610: { skills: ["computers", "crafting"] }
};

export const SKILL_LABELS = {
  arcana: "Arcana", computers: "Computers", crafting: "Crafting", nature: "Nature", occultism: "Occultism",
  perception: "Perception", piloting: "Piloting", religion: "Religion"
};
export const SAVE_LABELS = { fortitude: "Fortitude", reflex: "Reflex", will: "Will" };

/** Drones a drone console can deploy, with the station actions each grants while deployed. */
export const DRONES = {
  pyrotechnics: { name: "Pyrotechnics Drone", url: "tactical-starship-combat/drones/1-pyrotechnics-drone", actions: [569, 570, 571, 572] },
  repair: { name: "Repair Drone", url: "tactical-starship-combat/drones/2-repair-drone", actions: [573, 574] },
  scramble: { name: "Scramble Drone", url: "tactical-starship-combat/drones/3-scramble-drone", actions: [575, 576] }
};

/**
 * Action reference: [name, cost, traits, frequency, url path].
 * Cost: 1-3 actions, "r" reaction, "f" free action, "1-2"/"1-3" variable, "r/1" reaction or 1 action.
 */
const A = (name, cost, traits, freq, url) => ({ name, cost, traits, freq, url });
export const ACTIONS = {
  17: A("Area Fire", 2, ["Manipulate"], "", "actions/17-area-fire"),
  19: A("Auto-Fire", 2, ["Manipulate"], "", "actions/19-auto-fire"),
  412: A("Switch Gravity", 1, ["Manipulate", "Station"], "", "actions/412-switch-gravity"),
  413: A("Modify Starship", 1, ["Manipulate", "Station"], "", "actions/413-modify-starship"),
  414: A("Efficient Boost", 1, ["Manipulate", "Station"], "once per round", "actions/414-efficient-boost"),
  415: A("Shielding Foliage", "r", ["Manipulate", "Station"], "once per day", "actions/415-shielding-foliage"),
  416: A("Shield Pulse", 1, ["Manipulate", "Station"], "", "actions/416-shield-pulse"),
  417: A("Nova Shield", 1, ["Concentrate", "Station"], "once per 10 minutes", "actions/417-nova-shield"),
  418: A("Pull Starship", 1, ["Attack", "Manipulate", "Station"], "", "actions/418-pull-starship"),
  419: A("Deflect Munitions", "r", ["Manipulate", "Station"], "", "actions/419-deflect-munitions"),
  420: A("Rotate Armament", 1, ["Manipulate", "Station"], "", "actions/420-rotate-armament"),
  421: A("Connect Tow Cable", 1, ["Manipulate", "Station"], "", "actions/421-connect-tow-cable"),
  423: A("Transmute Vitality", 1, ["Manipulate", "Station"], "", "actions/423-transmute-vitality"),
  424: A("Snare Boarders", "r", ["Manipulate", "Primal", "Station"], "", "actions/424-snare-boarders"),
  425: A("Overclock Magic Conduit", "f", ["Manipulate", "Station"], "", "actions/425-overclock-magic-conduit"),
  426: A("Overclock Shielding", 1, ["Manipulate", "Station"], "once per round", "actions/426-overclock-shielding"),
  427: A("Warp Space and Time", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/427-warp-space-and-time"),
  428: A("Nova Ram", 2, ["Concentrate", "Manipulate", "Station"], "", "actions/428-nova-ram"),
  429: A("Overload Thrusters", "f", ["Station"], "once per minute", "actions/429-overload-thrusters"),
  430: A("Ram", 2, ["Manipulate", "Station"], "", "actions/430-ram"),
  431: A("Uncanny Turn", "r", ["Manipulate", "Station"], "once per round", "actions/431-uncanny-turn"),
  432: A("Nova Dash", 2, ["Concentrate", "Manipulate", "Station"], "", "actions/432-nova-dash"),
  434: A("Thasteron Burst", 2, ["Station"], "once per 10 minutes", "actions/434-thasteron-burst"),
  435: A("Cloak Starship", 2, ["Manipulate", "Station"], "once per day", "actions/435-cloak-starship"),
  436: A("Security Scan", 1, ["Manipulate", "Secret", "Station"], "", "actions/436-security-scan"),
  528: A("Fetch and Fix", "f", ["Concentrate", "Station"], "", "actions/528-fetch-and-fix"),
  529: A("Install Mine", 1, ["Manipulate", "Station"], "", "actions/529-install-mine"),
  530: A("Onboard Pet", 1, ["Concentrate", "Station"], "", "actions/530-onboard-pet"),
  531: A("Nova Weapon", "f", ["Manipulate", "Station"], "", "actions/531-nova-weapon"),
  533: A("Nova Strike", 1, ["Manipulate", "Station"], "", "actions/533-nova-strike"),
  534: A("Nova Blast", 1, ["Manipulate", "Station"], "", "actions/534-nova-blast"),
  536: A("Nova Surge", "r", ["Manipulate", "Station"], "", "actions/536-nova-surge"),
  569: A("Deploy Starship Mine", 1, ["Manipulate", "Station"], "once per round", "actions/569-deploy-starship-mine"),
  570: A("Detonate Starship Mine", "r/1", ["Manipulate", "Station"], "", "actions/570-detonate-starship-mine"),
  571: A("Modify Starship Mine", 1, ["Manipulate", "Station"], "", "actions/571-modify-starship-mine"),
  572: A("Move Starship Mine", 1, ["Manipulate", "Station"], "", "actions/572-move-starship-mine"),
  573: A("Repair Hull", 2, ["Healing", "Manipulate", "Station"], "", "actions/573-repair-hull"),
  574: A("Restore Functionality", 1, ["Healing", "Manipulate", "Station"], "", "actions/574-restore-functionality"),
  575: A("Harry Sensors", 1, ["Manipulate", "Station"], "", "actions/575-harry-sensors"),
  576: A("Intercept Munitions", "r", ["Manipulate", "Station"], "", "actions/576-intercept-munitions"),
  584: A("Deploy Drone", 1, ["Manipulate", "Station"], "", "actions/584-deploy-drone"),
  585: A("Drone Block", "r", ["Manipulate", "Station"], "", "actions/585-drone-block"),
  586: A("Retrieve Drone", 1, ["Manipulate", "Station"], "", "actions/586-retrieve-drone"),
  587: A("Boost Battle Station", 1, ["Manipulate", "Station"], "", "actions/587-boost-battle-station"),
  588: A("Generate Shields", 1, ["Manipulate", "Station"], "", "actions/588-generate-shields"),
  589: A("Reposition Shield", "r", ["Manipulate", "Station"], "", "actions/589-reposition-shield"),
  590: A("Vent Power", 2, ["Manipulate", "Station"], "once per round", "actions/590-vent-power"),
  591: A("Lock On", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/591-lock-on"),
  592: A("Target Battle Station", 1, ["Concentrate", "Incapacitation", "Manipulate", "Station"], "", "actions/592-target-battle-station"),
  593: A("Counter Magic", 2, ["Concentrate", "Manipulate", "Station"], "", "actions/593-counter-magic"),
  594: A("Scan For Magic", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/594-scan-for-magic"),
  596: A("Boost Thrusters", 1, ["Concentrate", "Manipulate", "Station"], "once per round", "actions/596-boost-thrusters"),
  597: A("Evade", "1-2", ["Concentrate", "Manipulate", "Station"], "", "actions/597-evade"),
  598: A("Change Heading", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/598-change-heading"),
  599: A("Juke", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/599-juke"),
  600: A("Stick To Cover", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/600-stick-to-cover"),
  601: A("Clear A Path", 1, ["Concentrate", "Manipulate", "Station"], "once per round", "actions/601-clear-a-path"),
  602: A("Smoke And Mirrors", "r", ["Concentrate", "Manipulate", "Station"], "", "actions/602-smoke-and-mirrors"),
  603: A("Hack Comms", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/603-hack-comms"),
  604: A("Seek Starships", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/604-seek-starships"),
  605: A("Target Lock", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/605-target-lock"),
  606: A("Hack Battle Station", 1, ["Concentrate", "Flourish", "Manipulate", "Station"], "", "actions/606-hack-battle-station"),
  607: A("Scan Target", 1, ["Concentrate", "Manipulate", "Station"], "", "actions/607-scan-target"),
  608: A("Hack Munition", "r", ["Concentrate", "Manipulate", "Station"], "", "actions/608-hack-munition"),
  609: A("Jump Start", 2, ["Concentrate", "Healing", "Manipulate"], "once per hour", "actions/609-jump-start"),
  610: A("Repair Station", 1, ["Concentrate", "Manipulate"], "", "actions/610-repair-station"),
  503: A("Cosmic Bombardment", "1-3", ["Concentrate", "Manipulate", "Station"], "", "spells/503-cosmic-bombardment"),
  504: A("Cosmic Cannon", 2, ["Attack", "Cantrip", "Concentrate", "Manipulate", "Station"], "", "spells/504-cosmic-cannon"),
  505: A("Cosmic Fortification", 1, ["Concentrate", "Manipulate", "Station"], "", "spells/505-cosmic-fortification"),
  506: A("Cosmic Repairs", 2, ["Concentrate", "Healing", "Manipulate", "Station"], "", "spells/506-cosmic-repairs")
};

/**
 * Starship upgrades. `tiers` (when present) are [station grade index, actions unlocked at that grade].
 * `weapons` raises how many weapons a gunnery can hold.
 */
const U = (name, id, level, station, actions = [], extra = {}) => ({ name, level, station, actions, url: `treasure/${id}`, ...extra });
export const UPGRADES = {
  "gunnery-turret-mount": U("Gunnery Turret Mount", "410-gunnery-turret-mount", 0, "gunnery"),
  "secondary-armaments": U("Secondary Armaments", "413-secondary-armaments", 0, "gunnery", [], { weapons: 2 }),
  "munitions-deflection-unit": U("Munitions Deflection Unit", "411-munitions-deflection-unit", 0, "gunnery", [419]),
  "ordnance-hinges": U("Ordnance Hinges", "412-ordnance-hinges", 0, "gunnery", [420]),
  "starship-weapon-crystal": U("Starship Weapon Crystal", "414-starship-weapon-crystal", 1, "gunnery", [], {
    tiers: [[0, [531, 533]], [1, [534]], [2, [536]]]
  }),
  "towing-winch": U("Towing Winch", "415-towing-winch", 1, "gunnery", [421]),
  "communications-overlay": U("Communications Overlay", "427-communications-overlay", 0, "scanners"),
  "security-relay": U("Security Relay", "428-security-relay", 0, "scanners", [436]),
  "cloaking-unit": U("Cloaking Unit", "426-cloaking-unit", 8, "scanners", [435]),
  "drone-shield-protocol": U("Drone Shield Protocol", "400-drone-shield-protocol", 0, "drone", [528]),
  "mine-deployment-shell": U("Mine Deployment Shell", "401-mine-deployment-shell", 0, "drone", [529]),
  "pet-drone-shell": U("Pet Drone Shell", "402-pet-drone-shell", 3, "drone", [530]),
  "gravity-toggle": U("Gravity Toggle", "403-gravity-toggle", 1, "generator", [412]),
  "mechanic-generator-module": U("Mechanic Generator Module", "404-mechanic-generator-module", 1, "generator", [413]),
  "operators-switchboard": U("Operator's Switchboard", "405-operators-switchboard", 3, "generator", [414]),
  "primal-shielding": U("Primal Shielding", "406-primal-shielding", 5, "generator", [415]),
  "pulse-shield": U("Pulse Shield", "407-pulse-shield", 1, "generator", [416]),
  "solar-generator-crystal": U("Solar Generator Crystal", "408-solar-generator-crystal", 1, "generator", [417]),
  "tractor-beam": U("Tractor Beam", "409-tractor-beam", 4, "generator", [418]),
  "mystic-magic-module": U("Mystic Magic Module", "416-mystic-magic-module", 0, "conduit", [423]),
  "tangle-ward": U("Tangle Ward", "417-tangle-ward", 0, "conduit", [424]),
  "technomancer-magic-module": U("Technomancer Magic Module", "418-technomancer-magic-module", 0, "conduit", [425, 426]),
  "witchwarper-magic-module": U("Witchwarper Magic Module", "419-witchwarper-magic-module", 0, "conduit", [427]),
  "nova-prow": U("Nova Prow", "420-nova-prow", 5, "pilot", [428]),
  "powerful-thrusters": U("Powerful Thrusters", "421-powerful-thrusters", 0, "pilot", [429]),
  "ramming-prow": U("Ramming Prow", "422-ramming-prow", 5, "pilot", [430]),
  "rotational-thrusters": U("Rotational Thrusters", "423-rotational-thrusters", 0, "pilot", [431]),
  "solar-thrusters": U("Solar Thrusters", "424-solar-thrusters", 2, "pilot", [432]),
  "thasteron-afterburner": U("Thasteron Afterburner", "425-thasteron-afterburner", 1, "pilot", [434])
};

/** Starship weapons: base die and damage type; dice count comes from the gunnery's grade. */
const W = (name, id, die, type, range, traits, category, group) => ({
  name, die, type, range, traits, category, group, url: `tactical-starship-combat/weapons/${id}`
});
export const WEAPONS = {
  "acid-capsule-launcher": W("Acid Capsule Launcher", "1-acid-capsule-launcher", 8, "acid", 4, ["Analog"], "simple", "Corrosive"),
  "asteroid-breacher": W("Asteroid Breacher", "2-asteroid-breacher", 6, "piercing", 3, ["Concussive", "Razing", "Tech", "Unwieldy"], "simple", "Projectile"),
  coilgun: W("Coilgun", "3-coilgun", 6, "piercing", 3, ["Agile", "Analog"], "simple", "Projectile"),
  "fragment-launcher": W("Fragment Launcher", "4-fragment-launcher", 8, "piercing", 2, ["Analog", "Area (cone)", "Concussive"], "simple", "Projectile"),
  "light-laser-cannon": W("Light Laser Cannon", "5-light-laser-cannon", 8, "fire", 5, ["Tech"], "simple", "Laser"),
  "pulsecaster-cannon": W("Pulsecaster Cannon", "6-pulsecaster-cannon", 6, "electricity", 3, ["Agile", "Tech"], "simple", "Shock"),
  starballista: W("Starballista", "7-starballista", 10, "piercing", 6, ["Analog", "Ordnance", "Unwieldy"], "simple", "Projectile"),
  "chain-repeater": W("Chain Repeater", "8-chain-repeater", 8, "piercing", 2, ["Analog", "Automatic"], "martial", "Projectile"),
  "disruptor-rifle": W("Disruptor Rifle", "9-disruptor-rifle", 10, "electricity", 8, ["Tech", "Volley 2 zones"], "martial", "Shock"),
  "farseeker-missiles": W("Farseeker Missiles", "10-farseeker-missiles", 8, "piercing", 6, ["Area (burst 1 zone)", "Razing", "Tech"], "martial", "Projectile"),
  "hypervelocity-macron-accelerator": W("Hypervelocity Macron Accelerator", "11-hypervelocity-macron-accelerator", 10, "electricity", 2, ["Area (cone)", "Concussive", "Tech"], "martial", "Shock"),
  "polarizing-beam": W("Polarizing Beam", "12-polarizing-beam", 8, "electricity", 2, ["Boost 1d8", "Ordnance"], "martial", "Shock"),
  "pulse-beam-cannon": W("Pulse Beam Cannon", "13-pulse-beam-cannon", 8, "electricity", 3, ["Area (line)", "Nonlethal", "Tech"], "martial", "Shock"),
  "aeon-cannon": W("Aeon Cannon", "14-aeon-cannon", 6, "fire", 4, ["Aeon", "Agile", "Caster", "Tech"], "advanced", "Laser"),
  "artillery-cannon": W("Artillery Cannon", "15-artillery-cannon", 10, "fire", 6, ["Critical (flame)", "Forceful", "Razing", "Tech"], "advanced", "Laser"),
  "gravity-cannon": W("Gravity Cannon", "16-gravity-cannon", 10, "bludgeoning", 5, ["Area (line)", "Ordnance", "Tech"], "advanced", "Shock"),
  "magnetar-rail": W("Magnetar Rail", "17-magnetar-rail", 10, "piercing", 6, ["Analog", "Automatic", "Ordnance"], "advanced", "Projectile")
};

/**
 * Weapons an NPC starship can carry: the starship weapons plus NPC-only ones from Tech Core stat blocks.
 * `defaultTiers` match the stat block the weapon comes from.
 */
export const NPC_WEAPONS = {
  ...WEAPONS,
  "breaching-ram": {
    name: "Breaching Ram", die: 10, type: "piercing", range: 0, traits: ["Melee"], category: "melee", group: "",
    url: "creatures/450-jinsul-breacher", defaultTiers: { attackTier: "moderate", damageTier: "high" }
  }
};

const COMMON_ACTIONS_URL = "rules/1423-common-actions-and-features";
const DEFAULT_ACTIONS_URL = "rules/1424-default-actions";
const NA = (key, name, cost, extra = {}) => ({ key, name, cost, traits: [], freq: "", url: COMMON_ACTIONS_URL, ...extra });

/** Common NPC starship station actions (Tech Core pg. 208), by battle station. */
export const NPC_STATION_ACTIONS = {
  pilot: [
    NA("boost-thrusters", "Boost Thrusters", 1, { traits: ["Move"], freq: "once per turn" }),
    NA("change-heading", "Change Heading", 1, { traits: ["Move"] }),
    NA("evade", "Evade", "1-2"),
    NA("stick-to-cover", "Stick to Cover", 1)
  ],
  generator: [
    NA("fortify-shield-points", "Fortify Shield Points", 1, { roll: "fortify" }),
    NA("tractor-beam", "Tractor Beam", 1, { save: "fortitude", range: "2 zones" })
  ],
  gunnery: [NA("engaged-strike", "Engaged Strike", "r")]
};

/** Actions every NPC starship can always use. */
export const NPC_DEFAULT_ACTIONS = [
  NA("repair-self", "Repair Self", 3, { url: DEFAULT_ACTIONS_URL, roll: "repairSelf" }),
  NA("seek-starships", "Seek Starships", 1, { url: DEFAULT_ACTIONS_URL, roll: "perception" })
];

export const npcActionByKey = (key) =>
  [...Object.values(NPC_STATION_ACTIONS).flat(), ...NPC_DEFAULT_ACTIONS].find((a) => a.key === key) ?? null;

/** NPC starship station types, as written in Tech Core stat blocks. */
export const NPC_STATIONS = {
  drone: "Drone Console",
  generator: "Generator",
  gunnery: "Gunnery",
  conduit: "Magic Conduit",
  pilot: "Pilot's Console",
  scanners: "Scanners",
  organ: "Organ (living starship)",
  other: "Other"
};

export const STARSHIP_IMMUNITIES =
  "bleed, death effects, disease, doomed, drained, fatigued, paralyzed, poison, sickened, spirit, unconscious, vitality, void";

/**
 * GM Core creature-building tables (pg. 124), which NPC starships use. Index 0 is level -1, up to level 24.
 * Tiers in order: extreme, high, moderate, low.
 */
export const NPC_TIERS = ["extreme", "high", "moderate", "low"];
export const NPC_TIER_LABELS = { extreme: "Extreme", high: "High", moderate: "Moderate", low: "Low" };
export const STRIKE_ATTACK_BONUS = [
  [10, 8, 6, 4], [10, 8, 6, 4], [11, 9, 7, 5], [13, 11, 9, 7], [14, 12, 10, 8], [16, 14, 12, 9], [17, 15, 13, 11],
  [19, 17, 15, 12], [20, 18, 16, 13], [22, 20, 18, 15], [23, 21, 19, 16], [25, 23, 21, 17], [27, 24, 22, 19],
  [28, 26, 24, 20], [29, 27, 25, 21], [31, 29, 27, 23], [32, 30, 28, 24], [34, 32, 30, 25], [35, 33, 31, 27],
  [37, 35, 33, 28], [38, 36, 34, 29], [40, 38, 36, 31], [41, 39, 37, 32], [43, 41, 39, 33], [44, 42, 40, 35],
  [46, 44, 42, 36]
];
/** Average damage per Strike (the number in parentheses in the Strike Damage table). */
export const STRIKE_DAMAGE_AVERAGE = [
  [4, 3, 3, 2], [6, 5, 4, 3], [8, 6, 5, 4], [11, 9, 8, 6], [15, 12, 10, 8], [18, 14, 12, 9], [20, 16, 13, 11],
  [23, 18, 15, 12], [25, 20, 17, 13], [28, 22, 18, 15], [30, 24, 20, 16], [33, 26, 22, 17], [35, 28, 23, 19],
  [38, 30, 25, 20], [40, 32, 27, 21], [43, 34, 28, 23], [45, 36, 30, 24], [48, 37, 31, 25], [50, 38, 32, 26],
  [53, 40, 33, 27], [55, 42, 35, 28], [58, 44, 37, 29], [60, 46, 38, 31], [63, 48, 40, 32], [65, 50, 42, 33],
  [68, 52, 44, 35]
];

/** GM Core Spell DC and Spell Attack Modifier table (pg. 126): spell attack modifier by level (-1 to 24). */
export const SPELL_TIERS = ["extreme", "high", "moderate"];
export const SPELL_ATTACK = [
  [11, 8, 5], [11, 8, 5], [12, 9, 6], [14, 10, 7], [15, 12, 9], [17, 13, 10], [18, 14, 11], [19, 16, 13], [21, 17, 14],
  [22, 18, 15], [24, 20, 17], [25, 21, 18], [26, 22, 19], [28, 24, 21], [29, 25, 22], [31, 26, 23], [32, 28, 25],
  [33, 29, 26], [35, 30, 27], [36, 32, 29], [38, 33, 30], [39, 34, 31], [40, 36, 33], [42, 37, 34], [43, 38, 35],
  [44, 40, 37]
];

/** The Strike Damage table's own damage expressions, used as-is when a weapon has the same die. */
export const STRIKE_DAMAGE_EXPRESSION = [
  ["1d6+1", "1d4+1", "1d4", "1d4"], ["1d6+3", "1d6+2", "1d4+2", "1d4+1"], ["1d8+4", "1d6+3", "1d6+2", "1d4+2"],
  ["1d12+4", "1d10+4", "1d8+4", "1d6+3"], ["1d12+8", "1d10+6", "1d8+6", "1d6+5"], ["2d10+7", "2d8+5", "2d6+5", "2d4+4"],
  ["2d12+7", "2d8+7", "2d6+6", "2d4+6"], ["2d12+10", "2d8+9", "2d6+8", "2d4+7"], ["2d12+12", "2d10+9", "2d8+8", "2d6+6"],
  ["2d12+15", "2d10+11", "2d8+9", "2d6+8"], ["2d12+17", "2d10+13", "2d8+11", "2d6+9"], ["2d12+20", "2d12+13", "2d10+11", "2d6+10"],
  ["2d12+22", "2d12+15", "2d10+12", "2d8+10"], ["3d12+19", "3d10+14", "3d8+12", "3d6+10"], ["3d12+21", "3d10+16", "3d8+14", "3d6+11"],
  ["3d12+24", "3d10+18", "3d8+15", "3d6+13"], ["3d12+26", "3d12+17", "3d10+14", "3d6+14"], ["3d12+29", "3d12+18", "3d10+15", "3d6+15"],
  ["3d12+31", "3d12+19", "3d10+16", "3d6+16"], ["3d12+34", "3d12+20", "3d10+17", "3d6+17"], ["4d12+29", "4d10+20", "4d8+17", "4d6+14"],
  ["4d12+32", "4d10+22", "4d8+19", "4d6+15"], ["4d12+34", "4d10+24", "4d8+20", "4d6+17"], ["4d12+37", "4d10+26", "4d8+22", "4d6+18"],
  ["4d12+39", "4d12+24", "4d10+20", "4d6+19"], ["4d12+42", "4d12+26", "4d10+22", "4d6+21"]
];

/** Expansion bay facilities (Tech Core). */
export const EXPANSION_BAY_OPTIONS = {
  "data-center": { name: "Data Center", url: "tactical-starship-combat/expansion-bays/1-data-center" },
  "fabrication-lab": { name: "Fabrication Lab", url: "tactical-starship-combat/expansion-bays/2-fabrication-lab" },
  "holo-den": { name: "Holo Den", url: "tactical-starship-combat/expansion-bays/3-holo-den" },
  "medical-bay": { name: "Medical Bay", url: "tactical-starship-combat/expansion-bays/4-medical-bay" },
  "passenger-quarters": { name: "Passenger Quarters", url: "tactical-starship-combat/expansion-bays/5-passenger-quarters" },
  "science-lab": { name: "Science Lab", url: "tactical-starship-combat/expansion-bays/6-science-lab" },
  "crew-quarters": { name: "Crew Quarters", url: "tactical-starship-combat/expansion-bays/7-crew-quarters" },
  lounge: { name: "Lounge", url: "tactical-starship-combat/expansion-bays/8-lounge" },
  "mess-bay": { name: "Mess Bay", url: "tactical-starship-combat/expansion-bays/9-mess-bay" }
};

export const RULES_URL = "rules/1329-tactical-starship-combat";
export const EXPANSION_BAYS_URL = "tactical-starship-combat/expansion-bays";
