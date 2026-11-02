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
- **Strikes.** A gunner's attack is Dexterity + their best proficiency for the weapon + tracking. Class proficiencies count when the weapon matches them; for example, an operative's guns proficiency covers ranged starship weapons with the analog or tech trait. Damage adds weapon specialization (+2/+3/+4 at expert/master/legendary, doubled with greater weapon specialization). While an operative has "Effect: Aim", Strikes against the ship they marked add Aim's precision dice.
- **Area and automatic weapons.** Area weapons (like Farseeker Missiles) can't Strike: they use **Area Fire**, two actions with no attack roll, where each target attempts a basic Reflex save against the gunner's class DC + the weapon's tracking. Automatic weapons can Strike and also **Auto-Fire** (a cone half the range increment). A soldier with Primary Target gets a free-action Strike button for these attacks. NPC area weapons work the same way, with a DC from GM Core's creature DC table.
- **Conditions.** Juke posts its result's conditions as links you can drag onto the enemy token: Off-Guard on a success, Off-Guard and Off-Kilter on a critical success. Off-Kilter is a custom effect the module puts in a **Starship Conditions** compendium in your world (the GM's client creates it). Clicking **Change Heading** (party or NPC sheet) reverses the heading, turns the tokens and removes off-kilter; nothing changes if the pilot's console is malfunctioning. An off-guard starship shows −2 AC; an off-kilter one has −2 to its weapon attacks, area DCs and Reflex saves.
- **Strike buttons.** The sheet shows three buttons for the multiple attack penalty (agile weapons: −4/−8). If you target a token, the chat message shows the degree of success against its AC. Damage dice scale with the gunnery's grade.
- **Station actions.** Every action unlocked by the station's grade or its upgrades is listed. Clicking an action's name posts it to chat, with a link to its rules on Archives of Nethys. Generate Shields rolls and adds SP; Vent Power rolls its damage.
- **Rolling station actions.** Actions that call for a check show a button for each skill they allow, such as Piloting for Juke or Computers for Scan Target. The button rolls that skill from the character sheet of the crew member helming the station, using the system's normal check. If no one is assigned, it rolls for the clicking player's own character.
  - If the action rolls against the target's DC (Juke, Clear a Path, Scan Target, Hack Battle Station and so on), target the enemy starship first and the DC fills in automatically.
  - Fixed DCs (Repair Hull and Jump Start, both DC 15) are included.
  - Secret checks (Seek Starships, Security Scan) are rolled blind for the GM.
  - Actions where the enemy saves instead (Target Lock, Ram, Pull Starship and so on) have a DC button. It posts the helmer's DC for the enemy's save.
  - Jump Start only appears at the generator, magic conduit and scanners, using the skill for that station.
- **Magic conduit spells.** The helmer casts with their own spellcasting, choosing their best spell attack modifier.
  - **Cosmic Cannon** is a cantrip: it's free, with spell attack buttons including the multiple attack penalty. Target the enemy starship and the roll shows the result against its AC. Damage and Crit buttons use the cantrip's automatic heightening (half the caster's level, rounded up).
  - **Cosmic Bombardment**, **Cosmic Fortification** and **Cosmic Repairs** expend one of the caster's own spell slots of rank 1 or higher. **Cast** lists only the caster's unused slots; the spell is cast at the chosen slot's rank, and the slot is marked as used on the character sheet. A prepared caster gives up one of their prepared spells of that rank, and a spontaneous or flexible caster uses one of that rank's slots. With no slots left, the spell isn't cast.
  - Bombardment also asks for the actions spent, then rolls its automatic-hit missiles. Fortification and Repairs restore Shield Points or Hull Points to the targeted starship if you own it; otherwise they affect this one.
  - **Transmute Vitality** (Mystic Magic Module) shows the mystic helmer's vitality network (current and maximum, read from their sheet). **Heal ship** moves Hit Points from the network into the starship's Hull Points, up to the Transfer Vitality limit for their level (10, +10 at 5th, 10th, 15th and 20th). **Regain** adds the network's start-of-turn regain (+4, or +6 at master spell DC, +8 at legendary).
- **Starship Weapon Crystal (solarian).** The gunnery's helmer uses their own solar armaments. Graviton or photon comes from the stellar attunement on their character sheet.
  - **Nova Weapon** shows the helmer's attunement and what it adds.
  - **Nova Strike** uses the attack bonus of the solar weapon Strike on the solarian's own sheet, such as "Advanced Solar Weapon (Photon)". The sheet rolls it, so the attack card has no system damage buttons, and the target's Evade, Off-Guard and attacks from behind count. Roll damage with the sheet's damage button: that Strike's own damage (crystals, Strength and photon fire included). If the solar weapon has reach, the nova weapon uses d10 dice instead, for example 2d10 instead of 2d8.
  - **Nova Surge** rolls the same attack once, with no multiple attack penalty, and the same damage.
  - A graviton Nova Strike or Surge hit gives the target −1 zone Speed until the end of its next turn.
  - **Nova Blast** uses the solar flare's attack bonus against the targeted starship's AC. Damage is graviton d8 bludgeoning (range 2 zones) or photon d6 fire (range 4 zones), plus Strength, with as many dice as the solar flare has (striking crystals add dice), for example 2d6+4 fire.
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
- **Attacks from behind.** Following Tech Core's heading rule, a starship is off-guard (−2 AC) to attacks from the opposite direction of its heading, unless the ships share a zone. When you attack a targeted starship from the sheet, the module compares the two ship tokens' positions with the target's heading, and if the attacker is behind, the roll uses the lower AC and the chat says "off-guard: attacked from behind". This applies to gunnery Strikes, Primary Target, Cosmic Cannon, Nova attacks and NPC weapons and Strikes, but not to saves (Area Fire). Ships less than one grid square apart left to right count as the same zone; change this with the world setting **Zone width (grid squares)**.
- **Heading.** Choose 0° or 180°, and the starship's tokens turn to match: the token template plus every placed token linked to the ship. On the party's ship, 0° faces left to right; on NPC starships, 0° faces right to left. Ship art is assumed to point right; tick **Art faces left** for art that points the other way. An NPC token that isn't linked to its actor turns on its own when you change the heading on that token's sheet.
- **Expansion bays.** **Universal** bays don't take a slot: Crew Quarters (choose Bunks, Budget, Comfortable or Extravagant), Lounge, Mess Bay, and optional Basic Passenger Quarters. **Selected** bays fill the frame's 4 slots, or 5 with Comfortable crew quarters: Data Center, Fabrication Lab, Holo Den, Medical Bay, Passenger Quarters (Prison or Luxury) and Science Lab. Each bay shows a one-line summary of its benefit and a link to Archives of Nethys.
- **Notes.**

## NPC starship sheet

**Starship weapons.** Under **Stations & Actions**, pick any of the 17 Tech Core starship weapons for the NPC starship.
- Its attack bonus and damage come from GM Core's creature-building tables at the ship's level, which Tech Core uses for NPC starships. Each weapon has an **Attack** tier and a **Damage** tier (Extreme, High, Moderate or Low), defaulting to High attack and Moderate damage.
- Damage uses the weapon's own die, with the table's number of dice for that level and a flat bonus that reaches the tier's average.
- Attack buttons include the multiple attack penalty (−4/−8 for agile weapons) and roll against the targeted starship's AC.
- Damage and Crit roll as system damage, so the chat buttons can apply it, with Shield Points absorbing first.
- Area and automatic weapons get Area Fire and Auto-Fire buttons.
- If the ship's level changes, its weapons update automatically.
- When the weapon's die matches the table's damage expression, the table's expression is used exactly.
- The list also has the **Breaching Ram**, a melee weapon (d10 piercing, same zone) from the Jinsul Breacher. It defaults to Moderate attack and High damage, which reproduces that stat block (+10, 1d10+6 at level 3).

**Magic conduit spells.** An NPC starship with a Magic Conduit battle station gets the starship spell repository under that station.
- **Cosmic Cannon** has spell attack buttons (with the multiple attack penalty) that use GM Core's Spell Attack Modifier table at the ship's level. Pick the tier: Extreme, High (the default, for primary casters) or Moderate. Damage and Crit buttons roll the cantrip at the ship's rank (half its level, rounded up).
- **Cosmic Bombardment**, **Cosmic Fortification** and **Cosmic Repairs** have Cast buttons that ask for a rank (defaulting to the ship's highest) and roll. Fortification and Repairs restore the targeted allied starship, or this one.
- A malfunctioning conduit greys these out and warns if they're used.

**Evade and cover.** The NPC sheet's AC has a circumstance dropdown: none, Evade +1 / Stick to Cover +1, or Evade +2. The Evade and Stick to Cover actions have AC buttons that set it. The big AC number includes the bonus, and the party's Strikes, spell attacks and nova attacks rolled from the starship sheet compare against the raised AC. Set it back to none when the effect ends.

**Station actions.** Each NPC battle station lists Tech Core's common NPC starship actions. Click a name to post it to chat with its Archives of Nethys link.
- **Pilot's console:** Boost Thrusters, Change Heading, Evade, Stick to Cover.
- **Generator:** Fortify Shield Points (with a +SP button that adds the fortify value) and Tractor Beam.
- **Gunnery:** Engaged Strike.
- **Default actions** every NPC starship can use:
  - **Repair Self** has a button that restores Hull Points equal to the ship's level and fixes one malfunctioning station.
  - **Seek Starships** rolls Perception.
- A malfunctioning station's actions are greyed out.

Add special attacks and abilities as Strikes and actions with **Edit stat block**.

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
