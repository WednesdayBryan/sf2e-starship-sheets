# SF2e Starship Sheets

Player and NPC starship sheets for **Starfinder Second Edition** tactical starship combat (Tech Core), for Foundry VTT v14 and the `sf2e` system 1.6+.

## Safe by design

The `sf2e` system refuses actor types added by modules. When a module that defines one is turned off, the world can fail to load. This module never adds an actor type:

- **Player starships** are the system's own **Vehicle** actors.
- **NPC starships** are the system's own **NPC** actors.
- Everything starship-specific (frame, battle stations, Shield Points, compromised and so on) is stored in actor flags.

If you disable or uninstall the module, those actors still load as ordinary vehicles and NPCs.

## Creating starships

In the **Actors** sidebar, click **Create Starship**, then choose:

- **Player starship**: pick a frame (Bulwark, Explorer or Skirmisher) and a level. The sheet fills in HP, SP, AC, saves, Speed and sensor range from the frame table.
- **NPC starship**: creates an NPC actor with the starship sheet. Click **Edit stat block** to enter strikes, actions, skills, AC, saves and HP in the system's normal NPC sheet. Back on the starship sheet, assign each action to a battle station.

To turn an existing vehicle or NPC into a starship, open its sheet, click **Sheet** in the title bar and choose **Starship (Player)** or **Starship (NPC)**.

Give your players **Owner** permission on the player starship so they can use it.

## Player starship sheet

- **Defenses.** AC uses the pilot's Piloting DC when it's higher, plus the pilot's console's helmed AC bonus and Evade/Cover. Fortitude, Reflex and Will add the helmed station bonuses, and each one rolls in chat when clicked.
- **Battle stations.** The two default stations come with the frame's default upgrade, plus 4 customizable slots. Grades follow the ship's level automatically, or you can set one. Assign a crew member to helm each station and mark stations as malfunctioning.
- **Upgrades and weapons.** Each station lists only the upgrades that fit it. The sheet warns you if a station has more upgrades than its grade allows. A gunnery holds one weapon, or two with Secondary Armaments.
- **Strikes.** A gunner's attack is Dexterity + proficiency for the weapon category + tracking. The sheet shows three buttons for the multiple attack penalty (agile weapons: −4/−8). If you target a token, the chat message shows the degree of success against its AC. Damage dice scale with the gunnery's grade.
- **Station actions.** Every action unlocked by the station's grade or its upgrades is listed. Clicking an action's name posts it to chat, with a link to its rules on Archives of Nethys. Generate Shields rolls and adds SP; Vent Power rolls its damage.
- **Rolling station actions.** Actions that call for a check show a button for each skill they allow, such as Piloting for Juke or Computers for Scan Target. The button rolls that skill from the character sheet of the crew member helming the station, using the system's normal check. If no one is assigned, it rolls for the clicking player's own character.
  - If the action rolls against the target's DC (Juke, Clear a Path, Scan Target, Hack Battle Station and so on), target the enemy starship first and the DC fills in automatically.
  - Fixed DCs (Repair Hull and Jump Start, both DC 15) are included.
  - Secret checks (Seek Starships, Security Scan) are rolled blind for the GM.
  - Actions where the enemy saves instead (Target Lock, Ram, Pull Starship and so on) have a DC button. It posts the helmer's DC for the enemy's save.
  - Jump Start only appears at the generator, magic conduit and scanners, using the skill for that station.
- **Magic conduit spells.** The helmer casts with their own spellcasting, choosing their best spell attack modifier.
  - **Cosmic Cannon** has spell attack buttons with the multiple attack penalty. Target the enemy starship and the roll shows the result against its AC. Damage and Crit buttons use the cantrip's automatic heightening (half the caster's level, rounded up).
  - **Cosmic Bombardment** asks for a rank and the actions spent, then rolls its automatic-hit missiles.
  - **Cosmic Fortification** and **Cosmic Repairs** ask for a rank, roll, and restore Shield Points or Hull Points. They affect the targeted starship if you own it; otherwise they affect this one.
  - Chat reminds the caster which rank of spell slot to expend.
- **Starship Weapon Crystal (solarian).** The gunnery's helmer uses their own solar armaments. Graviton or photon comes from the stellar attunement on their character sheet.
  - **Nova Weapon** shows the helmer's attunement and what it adds.
  - **Nova Strike** rolls the solar weapon Strike from the solarian's own sheet, such as "Advanced Solar Weapon (Photon)", with its attack buttons. Damage is that Strike's own damage (crystals, Strength and photon fire included) with its weapon dice changed to d10s, for example 2d10 instead of 2d8.
  - **Nova Surge** rolls the same Strike's first attack only, with no multiple attack penalty, and the same d10 damage.
  - A graviton Nova Strike or Surge hit gives the target −1 zone Speed until the end of its next turn.
  - **Nova Blast** uses the solar flare's attack bonus against the targeted starship's AC. Damage is graviton 1d8 bludgeoning (range 2 zones) or photon 1d6 fire (range 4 zones), plus Strength.
  - On a Nova Blast critical hit, a graviton blast makes the target off-kilter with −1 zone Speed, and a photon blast gives it 1d6 persistent fire.
- **Starship effects.** Effects from these attacks appear on the target starship's sheet:
  - Speed shows the reduced value.
  - Persistent damage has a Roll button.
  - Each effect has a ✕ to remove it when it ends.
  - When a player hits a starship they don't own, the GM's client adds the effect, so a GM must be connected.
- **Hull and shields:**
  - **Damage** takes damage from SP first; bypassing damage skips SP.
  - At 0 HP the ship becomes compromised, adding its wrecked value, and every station becomes malfunctioning.
  - Taking damage while compromised adds 1 to compromised (2 on a critical hit). Compromised 10 destroys the ship.
  - **Restore HP** ends compromised and adds 1 to wrecked.
  - **Hull Integrity Check** rolls the flat check against DC 10 + compromised.
- **Expansion bays.** Each of the 4 bays has a dropdown of the Tech Core facilities (Data Center, Fabrication Lab, Holo Den, Medical Bay, Passenger Quarters, Science Lab, Crew Quarters, Lounge, Mess Bay), with a link to the chosen facility's benefits on Archives of Nethys.
- **Notes.**

## NPC starship sheet

The NPC starship sheet shows the stat block from the NPC actor: Perception, skills, attributes, AC, saves, HP, Strikes and actions. It uses the system's own strike, damage, save and skill rolls. It also tracks Shield Points, fortify, sensor range, Speed in zones, heading, battle stations (malfunctioning stations are flagged) and compromised/wrecked.

## Damage from the system's chat buttons

With the world setting **Shields absorb system damage** turned on (the default), damage applied to a starship with the system's chat damage buttons comes off Shield Points first. It also updates compromised. The system doesn't say whether the hit was critical or bypassing, so for those cases use the sheet's **Damage** button instead.

## Not automated

The GM still decides these:

- Each station action's own effect. Chat links to the rules.
- Area Fire and Auto-Fire DCs.
- Off-guard from heading, and the sensor map.
- Drone deployment and the effects of upgrade grades.

Rules data comes from the Archives of Nethys starship builder (Tech Core, ORC license). The module links to rules text instead of reproducing it.
