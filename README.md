# SF2e Starship Sheets

Player and NPC starship sheets for **Starfinder Second Edition** tactical starship combat (Tech Core) in Foundry VTT v14.

## Install

In Foundry (or The Forge), go to **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/WednesdayBryan/sf2e-starship-sheets/releases/latest/download/module.json
```

Requires Foundry VTT v14 and the Starfinder 2e (`sf2e`) system 1.6.0 or newer.

See [the module README](sf2e-starship-sheets/README.md) for how the sheets work.

## Development

- `sf2e-starship-sheets/` — the module itself.
- `test/harness.html` — runs the rules checks and previews both sheets in a browser. Serve the repository with `test/serve.ps1` and open `http://localhost:8766/`.
- `build.ps1` — builds `dist/module.zip` and `dist/module.json` for a release. Bump `version` and `download` in `module.json` first.
