# SF2e Starship Sheets — project status

Last updated: October 31, 2026. Current release: **v0.12.0**.

## Where things are

- **This folder** (Dropbox\Claude\SF2e Starship Sheets) is the working copy and a Git repository.
- **GitHub:** https://github.com/WednesdayBryan/sf2e-starship-sheets (public, account WednesdayBryan).
- **Install / update in Foundry or The Forge** with the manifest URL:
  `https://github.com/WednesdayBryan/sf2e-starship-sheets/releases/latest/download/module.json`
- The game runs on The Forge (Foundry v14 build 369, Starfinder 2e system 1.6+), and the module is in use in the live campaign.

## Folder layout

| Path | What it is |
|---|---|
| `sf2e-starship-sheets/` | The module itself (this is what goes in the zip) |
| `sf2e-starship-sheets/scripts/data.mjs` | Rules data: frames, stations, actions, upgrades, weapons, GM Core tables, NPC actions |
| `sf2e-starship-sheets/scripts/logic.mjs` | Pure rules math (stats, damage, compromised, NPC weapons, spells, heading) |
| `sf2e-starship-sheets/scripts/render.mjs` | HTML for both sheets |
| `sf2e-starship-sheets/scripts/main.mjs` | Foundry code: sheets, rolls, chat, hooks, Create Starship button |
| `sf2e-starship-sheets/README.md` | Full description of every feature |
| `test/harness.html` | Test page: 148 rules/render checks plus previews of both sheets |
| `test/serve.ps1` | Tiny local web server for the test page (`http://localhost:8767/`) |
| `build.ps1` | Builds `dist/module.zip` and `dist/module.json` for a release |
| `dist/` | Build output (not in Git) |

## Design decisions to keep

- **Never add a new actor type.** The Starfinder 2e system refuses module actor types, and a disabled module's types once crashed the campaign world (Causodes Ship Combat, October 30, 2026). The party's starship is a system **vehicle** actor and NPC starships are system **npc** actors. All starship data lives in `flags.sf2e-starship-sheets.ship`.
- The sheets are Foundry ApplicationV2 `ActorSheetV2` classes that render plain HTML (no Handlebars).
- Don't use the button action name `tab`: Foundry reserves it. The sheets use `sssTab`.
- Rules text isn't copied in; actions, upgrades and weapons link to Archives of Nethys.
- Damage from the system's chat buttons goes through Shield Points first (world setting "Shields absorb system damage").

## What's done

**Party starship sheet (vehicle actor):** frames and levels 1–20; six battle stations with automatic grades, helmers, upgrades and malfunctioning; AC (pilot's Piloting DC, helm bonus, Evade/Cover), saves, Speed, sensor range; HP/SP with damage, compromised, wrecked and hull integrity checks; gunnery Strikes and damage; station action checks rolled from the helmer's own sheet against the targeted ship's DC; magic conduit spells from the caster's spellcasting; Starship Weapon Crystal (Nova Strike/Surge from the solarian's solar weapon Strike with d10 damage, Nova Blast, attunement effects on the target); expansion bay dropdowns with AoN links; notes; heading 0°/180° that flips tokens; portrait and token image buttons; effects list; gunnery uses the gunner's class weapon proficiencies (e.g. operative guns), weapon specialization and operative Aim; area weapons fire only with Area Fire and automatic weapons add Auto-Fire, with save DCs (class DC + tracking); soldier Primary Target; Juke posts Off-Guard/Off-Kilter links; Change Heading reverses the heading and removes off-kilter; off-guard and off-kilter adjust the sheet's numbers.

**NPC starship sheet (npc actor):** stat block from the system NPC (Edit stat block button opens the system sheet); SP, fortify, sensor range, Speed, battle stations; starship weapons (17 Tech Core weapons plus the Breaching Ram) with attack and damage from GM Core's creature tables at the ship's level, matching the Sword-class, Raider Trident and Jinsul Breacher stat blocks; common station actions (pilot's console, generator, gunnery) and default actions (Repair Self, Seek Starships); Evade/Stick to Cover AC bonus; magic conduit spells from GM Core's spell attack table; heading that flips tokens; area/automatic weapons use Area Fire/Auto-Fire with a GM Core creature DC; Change Heading; off-kilter penalties.

**Both sheets:** attacks against a targeted starship from behind (by its heading and the tokens' positions, outside its zone) treat it as off-guard (−2 AC); world setting "Zone width (grid squares)". A "Starship Conditions" world compendium holds the custom Off-Kilter effect, created by the GM's client.

## Known limits

- Juke is the only station action whose result posts condition links; other actions' conditions are applied by hand.
- The Off-Kilter effect has no duration: Change Heading removes it automatically; otherwise remove it when Juke's 1 round ends.
- Nova Strike / Nova Surge roll through the system's own Strike, so their hit/miss doesn't include an NPC's Evade bonus. Add it by hand.
- Ending effects at the right time (Evade, Speed penalties, persistent damage) is manual.
- Not automated: each station action's effect beyond its roll, Area Fire / Auto-Fire DCs, off-guard from heading, the sensor map, drone deployment, upgrade grade improvements, spell slot tracking.
- Everything is checked on the test page with stand-in data. Real-game testing happens on The Forge; send the F12 Console's red lines if something breaks.

## How to make and publish a change

1. Edit the files under `sf2e-starship-sheets/`.
2. Test: run `powershell -File test/serve.ps1 -Port 8767` and open `http://localhost:8767/`. The first line should read **ALL PASSED**.
3. In `sf2e-starship-sheets/module.json`, bump `version` and change the version in `download` to match.
4. Run `.\build.ps1`.
5. Commit and push, then publish the release:
   `gh release create vX.Y.Z dist/module.json dist/module.zip --title "vX.Y.Z" --notes-file dist/notes.md`
   (Put the release notes in `dist/notes.md`; passing notes with quotation marks directly breaks in Windows PowerShell.)
6. In Foundry, click **Update** on the module and press F5. (A change to module.json settings, such as `socket`, needs a world restart.)

Git and the GitHub CLI are installed on this PC, and the CLI is signed in as WednesdayBryan.

## Release history

| Version | Change |
|---|---|
| 0.1.0 | First release: party and NPC starship sheets |
| 0.1.1 | Sheets scroll and keep their place |
| 0.1.2 | Readable dropdown lists |
| 0.1.3 | Portrait and token image buttons |
| 0.2.0 | Station action checks roll from the helmer's own sheet |
| 0.3.0 | Magic conduit spells (party) |
| 0.4.0 | Starship Weapon Crystal |
| 0.5.0 | Attunement damage and effects on the target |
| 0.5.1 | Tabs fixed |
| 0.6.0 | Expansion bay dropdowns; nova weapon uses the solar weapon Strike with d10s |
| 0.7.0 | NPC starship weapons from the ship's level |
| 0.8.0 | Breaching Ram; NPC station and default actions |
| 0.9.0 | Heading flips tokens |
| 0.9.1 | NPC Evade / Stick to Cover AC |
| 0.10.0 | NPC magic conduit spells |
| 0.11.0 | Playtest fixes: gun proficiency, weapon specialization, Aim; Area Fire and Auto-Fire with save DCs; Primary Target; Juke condition links; Off-Kilter compendium |
| 0.11.1 | Change Heading reverses the heading, turns the tokens and removes off-kilter |
| 0.12.0 | Attacks from behind: target is off-guard (-2 AC) by heading and token positions; Zone width setting |
