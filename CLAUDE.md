# HANZ Design Collective website — notes for Claude

Live site: https://hanzdesigncollective.com — a single static page, no build step.

## Hosting and deploy

- GitHub repo `yuhan795/hdc-website`, branch `main`. GitHub Pages serves the repo root; pushing to `main` redeploys in about 1 minute.
- Domain bought at Squarespace; DNS stays on Squarespace nameservers: apex A records → GitHub Pages IPs (185.199.108–111.153), `www` CNAME → `yuhan795.github.io`. `CNAME` file in the repo holds the domain — never delete it.
- No Cloudflare or admin panel here (unlike the owner's other site, BAD STUDIO, which uses Cloudflare Pages + `/admin`).
- `git push` authenticates through Windows Credential Manager as GitHub user `yuhan795`, independent of the Claude account.

## Working folder

The owner keeps this repo at `D:\My Drive\Websites\HDC WEBSITE` (Google Drive for desktop; moved there from `D:\My Drive\HDC WEBSITE` in Nov 2026). It is its own repo, not part of the `manus-websites` monorepo in the same folder. If `D:` is missing, Google Drive isn't running — ask the owner to open it rather than working elsewhere. Only edit it from one machine at a time (Drive can conflict on `.git`).

## Workflow the owner expects

1. `git pull` first.
2. Make the change.
3. Preview locally: `node tools/dev-server.mjs` → http://localhost:5190 (admin at `/admin/`, login from `.dev.vars`). Check light + dark mode, EN + 中文, desktop + phone width (~390px).
4. Show the owner, and **only commit and push after they confirm**.
5. After pushing, confirm the live site picked it up.

The owner writes in Chinese or English; reply in the language they used.

## Files

| Path | What |
|---|---|
| `index.html` | All copy and structure. Bilingual: English inside `lang-en` spans, Chinese inside `lang-zh` spans; CSS hides the inactive language via `body[data-lang]`. |
| `assets/css/style.css` | All styles. Colours are CSS variables on `body` (`--bg`, `--ink`, `--grey`, `--line`, `--panel`…) with a `body[data-theme="dark"]` override. |
| `assets/js/site.js` | Nav border on scroll, language and theme toggles (saved in `localStorage` as `hdc-lang` / `hdc-theme`). |
| `content/projects.json` | All project content, edited through the admin: `{ items: [{ slug, address (the project name, English), address_zh (optional Chinese name; the owner wants English names in both languages, so it is left empty), year, type/location/services {en, zh}, credit/award {en, zh} (optional), photos (photographer, optional), lat, lng, inset, images: [{ image, kind, caption {en, zh} }] }] }`. `kind` is render / drawing / board / site / construction / built / photo. `inset: true` → the “Beyond NYC” mini map (CT, Long Island, PA, upstate); no lat/lng → listed but not on the map. Order = order of the list. |
| `project.html` + `assets/js/project.js` | One project page for all projects: `project.html?p=<slug>`. Images float as draggable cards at random places (like BAD STUDIO's Works board); clicking one opens a large view with ←/→. The page is exactly one screen (no scrolling): a low bar at the bottom left with only Location / Services / Team (the project name is visually hidden, kept for screen readers), cards sized (`CARD_FILL`) and placed only in the space above it. Cards have depth (smaller/softer when far, mouse parallax); the one under the pointer floats to the front. Each card has a white BAD-style frame with Project / Image / Year (parts joined with ·, no em-dashes). `?preview` shows a draft sent by the admin (postMessage, list order). |
| `assets/projects/<slug>/` | Images added before the admin existed. New uploads from the admin go to `assets/uploads/` (WebP, max 2000 px). |
| `admin/` | Content admin (adapted from BAD STUDIO's): project list, then per project a live preview on the left and fields on the right. PUBLISH saves `content/projects.json` + uploads. |
| `lib/auth.mjs`, `lib/save-rules.mjs` | Login (signed `hdc_session` cookie) and what the admin may save. Copied from BAD STUDIO. |
| `tools/dev-server.mjs` | Local server with the admin API; saves to disk. Credentials in `.dev.vars` (gitignored, never commit). |
| `functions/api/*.js`, `lib/github.mjs`, `_routes.json`, `_headers` | The online admin's Cloudflare Pages functions, plus routing and cache rules. |
| `assets/js/map.js` | Projects map. |
| `assets/fonts/` | Neue Montreal (body) and Space Grotesk (HDC. logo). |

## Page sections (top to bottom)

Nav · Hero · Studio (`#studio`, dark panel that unfolds from a card on scroll, two columns) · Practice (`#practice`, Space / Identity / Video / Interface) · Projects (`#projects`, map) · Footer (`#contact`).

## Projects map

- MapLibre GL `4.7.1` loaded from unpkg, vector tiles + fonts from OpenFreeMap (free, no API key). Loaded lazily when the section nears the viewport.
- Custom greyscale style built in `makeStyle()`; `PALETTES.light` / `PALETTES.dark` follow the site theme. Map labels switch to `name:zh` in Chinese mode.
- Layout: the map (`.pmap`, left) sits beside the project list (`#plist`, right) in `.pwrap`; stacked on phones. Flat plan only, north up, no tilt or rotation (3D versions were tried on 2026-11-18 and rejected). Scroll zoom needs Ctrl (cooperative gestures).
- Opens on an overview fitted to every project with a "11 projects · New York region" count; resting the mouse ~0.25 s on a list row zooms (flyTo) to that project, leaving the list zooms back out. On touch, the first tap on a dot zooms in, a second opens the project, tapping elsewhere zooms out. Building footprints show from zoom 14.
- Dots are HTML markers (`.pdot`): black (white in dark mode), turn red `#E2231A` on hover/tap, with a tooltip of address + type. Tooltips flip side near the map edges (`tip-l` / `tip-r` / `tip-b`).
- The old "Beyond NYC" inset map was removed; `inset: true` in the content is now only used to pick a wider zoom for far projects.
- Gotcha: MapLibre's CSS sets `.maplibregl-map{position:relative}`, so the map containers are sized with width/height 100%, not absolute positioning.
- Dots are links to the project page; the tooltip has a red "View project →" line. On touch screens the first tap shows the tooltip, the second opens the page.
- `#plist` (built in `map.js`) shows number, name, services and location; hovering a row lights its dot red.
- To add a project: use the admin (NEW PROJECT; FIND FROM ADDRESS geocodes with OpenStreetMap Nominatim). By hand: add a block to `content/projects.json`.
- Source material lives in `H:\My Drive\Projects` (one folder per job). Only publish the studio's own renderings, drawings and photos — not listing photos, reference images, or contracts/invoices/fees.

Current projects (Nov 2026), in list order (most images first; names were changed from street addresses on 2026-11-18, slugs kept): UWS Townhouse (118 W 76th St, Yuhan Zhang at SCDA Architects, added 2026-11-18; images from E:\Portfolio 20255 Job	8 w 76th st, floor plans combined into one strip; largest hero card on the home page), Jerkinhead House, Gray House, Not-A-Cabin (6910 NY-28), Dalongyi LIC (42-22 Crescent St, with Liyang Wang, 2022), Sharon House, Art Storage Building, Fifth Avenue Apartment, CPW Apartment, The Henry Residence (211 W 84th St), The Elements Residence (555 W 59th St), Oncept Soho Store (45 Great Jones St). Gray/Sharon/Jerkinhead/Art Storage/Fifth Avenue/CPW are Gong Chen's work at Ted Porter Architecture (credited on each page; first name Gong, last name Chen, so always "Gong Chen"). Removed: 175 W 95th St, Le Bon Vivant, 11-12 Main Ave, 21 Greenway.

## Admin

- Locally: `node tools/dev-server.mjs`, open http://localhost:5190/admin/, log in with `.dev.vars`. PUBLISH writes the files on disk; then commit and push as usual.
- Status 2026-11-18: Cloudflare Pages project `hdc-website` (in Yuhan's own Cloudflare account, not Han Xiao's) is live at https://hdc-website-eu5.pages.dev with all six settings; admin works at https://hdc-website-eu5.pages.dev/admin/ (username `yuhan`). The zone hanzdesigncollective.com is added to Cloudflare (Free plan, nameservers alexa/micah.ns.cloudflare.com, all records copied incl. Google Workspace MX/SPF/DKIM/DMARC, website records DNS-only for now). DNSSEC was turned off at Squarespace on 2026-11-18 (DS gone from .com the same day). Next (agreed for 2026-11-19): switch nameservers at Squarespace, add hanzdesigncollective.com + www as Pages custom domains, check site/admin/email records, switch off GitHub Pages, optionally re-enable DNSSEC in Cloudflare.
- Online (target): the whole site moves from GitHub Pages to Cloudflare Pages (Yuhan's own Cloudflare account, free plan, commercial use allowed), so the admin is at https://hanzdesigncollective.com/admin/. Same setup as BAD STUDIO: build command empty, output directory = repo root, functions in `functions/api/` (`login`, `logout`, `me`, `upload`, `save`; shared code in `lib/`), `_routes.json` limits functions to `/api/*`, `_headers` sets caching. PUBLISH commits to `main` through the GitHub API; Cloudflare redeploys in under a minute. DNS: nameservers moved from Squarespace to Cloudflare (domain still registered at Squarespace). Vercel was considered but dropped: its free Hobby plan is non-commercial only.
- Cloudflare environment variables (Production, encrypted): `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `GITHUB_TOKEN` (fine-grained, Contents read/write on this repo only), `GITHUB_REPO=yuhan795/hdc-website`, `GITHUB_BRANCH=main`. Never write their values into the repo, chat or commits.
- Pull before working: the admin commits straight to `main`.
- Code changes never edit `content/projects.json` or `assets/uploads/` without saying so — those belong to the admin.

## Decisions already made

- The site was originally a Claude Design export (one bundled `index.html`); it was unpacked into these plain files. Edit them directly — a new Claude Design export would overwrite everything.
- Co-Founders section was removed and replaced by the projects map.
- Practice's right column is offset by half the Studio column gap so Identity/Interface align with the Studio body text.
- Footer legal lines: "© 2026 HANDSON STUDIO LLC. All rights reserved." / "HANZ Design Collective is a design studio operated by HANDSON STUDIO LLC." — the LLC is the legal entity and copyright holder. The year is hard-coded.
- Known, left as is: the sticky nav doesn't stick, because `.root{overflow-x:hidden}` breaks `position:sticky`. The owner hasn't asked for it to be fixed.
