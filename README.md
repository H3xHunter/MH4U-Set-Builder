# MH4U Set Builder

A free, in-browser set builder for **Monster Hunter 4 Ultimate** (3DS). Pick a weapon, armor, decorations and a charm, and see your skills, defense and more update instantly.

**Use it here: https://h3xhunter.github.io/MH4U-Set-Builder/**

No download, no account, no install. Everything runs in your browser.

> **Status:** early development. The site currently shows a placeholder while the builder is being built.

## Features

- Choose a weapon (with its decoration slots) and one armor piece per slot, with search and filters
- Slot decorations into your weapon, armor and charm, with slot validation
- Create and save your own charms, including slot-only charms with no skills
- Skills table showing base points, points added by decorations, totals, and the active skill level, including negative skills
- Defense and elemental resistances, with a normal/max armor level toggle
- For each armor piece: the materials to craft it and the monsters they come from
- Torso Up handled correctly
- Planned: damage estimates (effective raw and effective element) for blademaster weapons first, then gunners

This is a theorycrafting tool. It does not search for or optimize sets. Find a set you like with any set searcher, then recreate and tweak it here.

## Privacy

- No accounts, no analytics, no cookies, no server.
- Your saved charms are stored only in your own browser (localStorage). Clearing your browser data removes them.
- Builds are not uploaded anywhere. To share a build, take a screenshot.

## Unofficial fan project

This is an **unofficial, non-commercial fan project**. It is **not affiliated with, endorsed by, or sponsored by Capcom**.

Monster Hunter, Monster Hunter 4 Ultimate, and all related names, characters and game data are trademarks or copyrighted works of **Capcom Co., Ltd.** This project is based on Capcom's intellectual property and will always be free, with no ads and no paid features. It contains no game audio or other game assets. The only game artwork is a small set of icons (armor slots, weapon classes, decoration, charm), which are Capcom's, used as-is in a non-commercial fan tool, and will be removed on request.
Icon sources and rights: see `src/assets/icons/NOTICE.md`

Fonts (Barlow, Barlow Condensed, JetBrains Mono) are bundled under the SIL Open Font License 1.1; see THIRD_PARTY_NOTICES.md.

If you represent Capcom and have any concern about this project, please open an issue and it will be addressed promptly.

## Data

The game data comes from the open-source [MH4U Database](https://github.com/gatheringhallstudios/MonsterHunter4UDatabase) Android app (MIT License, Copyright (c) 2014 DavianCorp; maintained by Gathering Hall Studios as a fork of kamegami13's project), converted into JSON by this project's own converter. The license covers that app's source code only; the game data itself belongs to Capcom. Full notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The data is a snapshot of the game as of that database. If you spot an error or a missing item, please [open an issue](../../issues).

## Development

Requirements: the Node version in `.nvmrc` (see `engines` in `package.json`).

```bash
npm ci --ignore-scripts   # install exactly the locked dependencies
npm run dev               # start the dev server
npm run lint              # lint
npm run typecheck         # type-check
npm test                  # run the tests
npm run build             # production build into dist/
npm run preview           # serve the production build locally
```

The site is deployed to GitHub Pages by a GitHub Actions workflow when `main` is updated.

### Regenerating the data

The converted JSON in `public/data/` is committed, so you normally never need this. To regenerate it you need a local copy of the source database (not included in this repo):

```bash
python3 -I tools/convert.py --db PATH/TO/mh4u.db --out public/data \
  --source-url https://github.com/gatheringhallstudios/MonsterHunter4UDatabase \
  --source-commit 62bf6ce53476acd1699c4d98d3f1aace7f371238
python3 -I -m unittest discover -s tools/tests   # converter tests
```

The output format is documented in [docs/data-format.md](docs/data-format.md).

### Security notes

- All data is validated at load time, and stored charms are treated as untrusted input.
- Nothing from the data or from the user is ever inserted into the page as HTML.
- Runtime dependencies are kept minimal and pinned to exact versions. A strict Content Security Policy is applied at build time.
