# HANZ Design Collective website — notes for Claude

Live site: https://hanzdesigncollective.com — a single static page, no build step.

## Hosting and deploy

- GitHub repo `yuhan795/hdc-website`, branch `main`. GitHub Pages serves the repo root; pushing to `main` redeploys in about 1 minute.
- Domain bought at Squarespace; DNS stays on Squarespace nameservers: apex A records → GitHub Pages IPs (185.199.108–111.153), `www` CNAME → `yuhan795.github.io`. `CNAME` file in the repo holds the domain — never delete it.
- No Cloudflare or admin panel here (unlike the owner's other site, BAD STUDIO, which uses Cloudflare Pages + `/admin`).
- `git push` authenticates through Windows Credential Manager as GitHub user `yuhan795`, independent of the Claude account.

## Working folder

The owner keeps this repo at `D:\My Drive\HDC WEBSITE` (Google Drive for desktop). If `D:` is missing, Google Drive isn't running — ask the owner to open it rather than working elsewhere. Only edit it from one machine at a time (Drive can conflict on `.git`).

## Workflow the owner expects

1. `git pull` first.
2. Make the change.
3. Preview locally: `node tools/serve.mjs` → http://localhost:5190. Check light + dark mode, EN + 中文, desktop + phone width (~390px).
4. Show the owner, and **only commit and push after they confirm**.
5. After pushing, confirm the live site picked it up.

The owner writes in Chinese or English; reply in the language they used.

## Files

| Path | What |
|---|---|
| `index.html` | All copy and structure. Bilingual: English inside `lang-en` spans, Chinese inside `lang-zh` spans; CSS hides the inactive language via `body[data-lang]`. |
| `assets/css/style.css` | All styles. Colours are CSS variables on `body` (`--bg`, `--ink`, `--grey`, `--line`, `--panel`…) with a `body[data-theme="dark"]` override. |
| `assets/js/site.js` | Nav border on scroll, language and theme toggles (saved in `localStorage` as `hdc-lang` / `hdc-theme`). |
| `assets/js/projects.js` | Project list for the map: address, type `{en, zh}`, lat/lng; `inset: true` puts a project on the Upstate NY mini map. |
| `assets/js/map.js` | Projects map. |
| `assets/fonts/` | Neue Montreal (body) and Space Grotesk (HDC. logo). |
| `tools/serve.mjs` | Local preview server. |

## Page sections (top to bottom)

Nav · Hero · marquee · Studio (`#studio`, dark panel, two columns) · Practice (`#practice`, Space / Identity / Visual / Interface) · Projects (`#projects`, map) · Footer (`#contact`).

## Projects map

- MapLibre GL `4.7.1` loaded from unpkg, vector tiles + fonts from OpenFreeMap (free, no API key). Loaded lazily when the section nears the viewport.
- Custom greyscale style built in `makeStyle()`; `PALETTES.light` / `PALETTES.dark` follow the site theme. Map labels switch to `name:zh` in Chinese mode.
- Main map fits all non-inset projects, then tilts to pitch 35. Scroll zoom needs Ctrl (cooperative gestures).
- Dots are HTML markers (`.pdot`): black (white in dark mode), turn red `#E2231A` on hover/tap, with a tooltip of address + type. Tooltips flip side near the map edges (`tip-l` / `tip-r` / `tip-b`).
- Upstate NY inset (bottom-right) shows 6910 NY-28, East Meredith with an NYC reference marker.
- Gotcha: MapLibre's CSS sets `.maplibregl-map{position:relative}`, so the map containers are sized with width/height 100%, not absolute positioning.
- To add a project: geocode the address (OpenStreetMap Nominatim works), add a line to `projects.js`.

Current projects: 175 W 95th St, 211 W 84th St, 555 W 59th St (condo renovation); 45 Great Jones St (retail); 11-12 Main Ave, Astoria and 21 Greenway, Roslyn (new development); 6910 NY-28, East Meredith (master planning).

## Decisions already made

- The site was originally a Claude Design export (one bundled `index.html`); it was unpacked into these plain files. Edit them directly — a new Claude Design export would overwrite everything.
- Co-Founders section was removed and replaced by the projects map.
- Practice's right column is offset by half the Studio column gap so Identity/Interface align with the Studio body text.
- Footer legal lines: "© 2026 HANDSON STUDIO LLC. All rights reserved." / "HANZ Design Collective is a design studio operated by HANDSON STUDIO LLC." — the LLC is the legal entity and copyright holder. The year is hard-coded.
- Known, left as is: the sticky nav doesn't stick, because `.root{overflow-x:hidden}` breaks `position:sticky`. The owner hasn't asked for it to be fixed.
