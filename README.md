# markdown-reader

> Local, read-only Markdown browser for large doc trees — fast tree navigation, ripgrep search, and faithful rendering. Point it at any directory and read.

The core problem it solves: large documentation trees — hundreds of Markdown files across many directories — cross-reference each other with relative links (often using `../`). Following those links in an editor or on GitHub loses your place. This app keeps you oriented with tabbed history, accurate link resolution, deep-link URLs, and search that scales.

**Read-only by construction.** The server never writes to any file it displays — safe to point at a live docs tree that agents are writing to.

---

## Features

- **Tree browser** — nested directory tree built from `rg --files`, dirs-first / files-second sorted, collapsible, filtered inline.
- **Tree filter** — subsequence match, debounced, highlights matches.
- **Content & filename search** — `rg --json` (smart-case, 5 hits/file, truncated flag), windowed ~500-char excerpts with range highlights; filename mode ranks by consecutive-run / basename / brevity.
- **Tabs with independent history** — each tab keeps its own back/forward stack; `root` travels with the entry so root-widening never invalidates history.
- **Link resolution** — classifies external / bare `#anchor` / internal `href` in order; `resolveInternal()` handles `../` escapes, trailing-slash directories, `index.md`/`README.md` candidates, `%`-decoding, and non-markdown `unsupported` vs `broken` states. Links rewrite to `?root=&path=&#anchor` so middle-click / copy-link produce deep-links.
- **Single-file open & root widening** — `root = dirname(file)` on open; a link that escapes the root triggers `POST /api/roots/widen { upLevels }` (≤6, never above the home directory or filesystem root) with an Undo toast.
- **Rendering** — `unified` → `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-slug` → `rehype-pretty-code` (shiki `github-light`/`github-dark`, 14 langs) → custom rehype plugins for callouts, code-block copy buttons, data-line stamping, table wrapping, internal links, headings extraction, mermaid placeholders → `rehype-stringify` → `DOMPurify` before `v-html`.
- **Mermaid** — lazy-loaded (`~154 KB gz`), per-block `mermaid.render()` with `data-src` preservation and theme re-render.
- **Frontmatter** — parsed server-side with `gray-matter`; offset math preserves search-to-scroll line numbers.
- **Paste preview** — ephemeral, client-only raw-markdown preview (no file, no server write). `Paste` button in sidebar/toolbar or `Ctrl+Shift+V` opens a dialog; content is rendered through the same `unified` pipeline (GFM, shiki, mermaid, callouts, `DOMPurify`) with a browser-safe frontmatter parser, banner `Edit / Copy source / Clear`, `1.5 MB` limit, TOC/wide-hint integration.
- **UX polish** — TOC rail (≥3 headings), breadcrumbs, zoom (`Ctrl +`/`-`/`0` or `Ctrl+wheel`), wide/narrow prose (`Ctrl+Shift+\`), reading callouts, shiki code tables, task-list icons, large-table capping (500 row cap → show first 200 + "show all N"), copy feedback, skeleton loaders, keyboard overlay (`?`).
- **History & recents** — recent files (pin / delete / pinned-only filter) pruned on tree refresh; known roots persisted to the platform config directory (max 10); tab session restore on reload.

---

## Requirements

| Dependency     | Version            | Notes                                                                |
| -------------- | ------------------ | -------------------------------------------------------------------- |
| Node.js        | `>= 22.6`          | Uses native `node --test` for `test/**/*.test.ts`                    |
| npm            | (bundled)          | Project uses `npm`, not `pnpm`/`bun`                                 |
| ripgrep (`rg`) | `14.1.0` on `PATH` | Hard requirement — tree scan and search spawn `rg`; `503` if missing |

Platform: Linux / macOS, Chrome is the reference browser.

---

## Quick Start

### Zero-install (npx) — recommended for most people

No clone needed, always the latest (scoped package — `markdown-reader` on npm is taken):

```bash
npx @jommar/markdown-reader@latest --root /path/to/docs        # open a directory
npx @jommar/markdown-reader@latest --open /path/to/file.md     # root = dirname(file)
npx @jommar/markdown-reader@latest --port 3000 --root ./docs   # custom port
npx @jommar/markdown-reader@latest --help                      # help & version
# after global install, short aliases work:
# markdown-reader --root .   and   mdr --root .
# (use @latest with npx on npm 11; bare `npx @jommar/markdown-reader` hits a scoped-bin npx bug)
```

### Global install

```bash
npm i -g @jommar/markdown-reader
markdown-reader --root /path/to/docs
mdr --open /path/to/file.md
mdr --help
```

> Requires `ripgrep (rg)` on `PATH` and Node `>=22.6`. The bin prints a friendly install hint if `rg` is missing.

### Docker (no Node needed)

```bash
docker pull ghcr.io/jommar/markdown-reader:latest
docker run --rm -p 127.0.0.1:5180:5180 -v /path/to/docs:/docs ghcr.io/jommar/markdown-reader --root /docs
docker run --rm -p 127.0.0.1:5180:5180 -v $(pwd):/docs ghcr.io/jommar/markdown-reader --open /docs/README.md
# custom port:
docker run --rm -p 127.0.0.1:3000:3000 -v /path/to/docs:/docs ghcr.io/jommar/markdown-reader --port 3000 --root /docs
```

Image is `node:22-slim` + `ripgrep`; keep `-p 127.0.0.1:5180:5180` (not `-p 5180:5180`) so the `Host` guard stays strict and the app stays local.

### From source

```bash
git clone https://github.com/jommar/markdown-reader.git
cd markdown-reader
npm install
npm run dev
# → http://127.0.0.1:5180  (bound to 127.0.0.1 only, HMR on same port)
```

Seed the initial root/file from the CLI:

```bash
npm run dev -- --root /path/to/docs        # open a directory
npm run dev -- --open /path/to/file.md     # root = dirname(file), initialPath = basename
PORT=3000 npm run dev                      # custom port
HOST=0.0.0.0 npm run dev                    # bind all interfaces (guard still requires 127.0.0.1 Host)
```

Production build (same server, serves `dist/`):

```bash
npm run build && npm start
# or: NODE_ENV=production PORT=5180 tsx server/index.ts
```

`http://127.0.0.1:5180/?root=%2Fpath%2Fto%2Fdocs&path=guide%2Fintro.md#section` deep-links directly to a file + anchor — every internal link rewrites to this form.

---

## Project Structure

```
markdown-reader/
├── index.html                 # data-theme="dark", __MDR_TOKEN__ placeholder
├── vite.config.ts             # vue + tailwindcss/vite
├── tsconfig.json / tsconfig.node.json  # verbatimModuleSyntax, bundler, skipLibCheck
├── bin/
│   └── markdown-reader.mjs    # npx/global bin (also `mdr` alias) — --help/--version/rg check → tsx + server/index.ts
├── Dockerfile                 # multi-stage build → ghcr.io/jommar/markdown-reader (node:22-slim + ripgrep)
├── server/
│   ├── index.ts               # http + express + vite middleware, CLI args, HOST/PORT bind (127.0.0.1 default, 0.0.0.0 in Docker)
│   ├── guard.ts               # Host/Origin/Sec-Fetch-Site + x-mdr-token gate (strict 127.0.0.1 even behind Docker)
│   ├── routes.ts              # /api/* handlers + error / 404
│   ├── scan.ts                # rg --files → nested TreeNode[] + flat files
│   ├── search.ts              # rg --json → windowed SearchResponse
│   ├── frontmatter.ts         # gray-matter, server-only
│   ├── safe-path.ts           # async realpath containment (symlink-safe)
│   ├── state.ts               # known roots persistence
│   └── types.ts               # shared API types (import type)
└── src/
    ├── main.ts / App.vue / boot.ts
    ├── stores/  {workspace,tabs,prefs,history,paste}.ts  (Pinia)
    ├── markdown/ {renderer,links,mermaid,sanitize,plugins,frontmatter.client}.ts
    ├── composables/ {useScroller,useShortcuts,useUrlSync}.ts
    ├── styles/  {tokens,prose,layout}.css
    └── components/  Sidebar, TreeNode, SearchPanel, Reader, MarkdownView,
                    Toc, TabBar, Breadcrumbs, Toolbar, OpenRootDialog, PasteDialog, …
```

---

## How It Works

### Server (`/api/*`)

All responses send `Cache-Control: no-cache`. Types in `server/types.ts`.

| Method & Path            | In                              | Out              | Notes                                                                                                                                                                                       |
| ------------------------ | ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/roots`         | —                               | `RootsResponse`  | MRU roots + optional `initial` from `--root`/`--open`                                                                                                                                       |
| `POST /api/roots`        | `{ path }`                      | `OpenResult`     | Dir → `root`; file → `root = dirname`, `initialPath = basename`; stores realpath                                                                                                            |
| `POST /api/roots/widen`  | `{ root, upLevels }`            | `OpenResult`     | Validates `1 ≤ upLevels ≤ 6`, never above the home directory or filesystem root                                                                                                             |
| `GET /api/tree`          | `root`                          | `TreeResponse`   | `{ tree, files, fileCount, builtAt }` — `builtAt` is client `fileSet` memo key                                                                                                              |
| `POST /api/tree/refresh` | `{ root }`                      | `{ ok: true }`   | Clears per-root cache (TTL 60 s); manual refresh button                                                                                                                                     |
| `GET /api/file`          | `root, path`                    | `FileResult`     | `.md`/`.markdown` only; `404` missing, `413` > 5 MB; frontmatter stripped from `content`                                                                                                    |
| `GET /api/search`        | `root, q, mode, regex?, limit?` | `SearchResponse` | `mode=content` (default 200 files) or `mode=files` (100); `regex` enables raw rg regex, else `--fixed-strings`; byte→char offsets corrected, lines windowed to ~500 chars, `truncated` flag |

**Scanning** (`server/scan.ts`): `rg --files --hidden --no-ignore-vcs -g '!.git' -g '!node_modules' -g '!**/node_modules/**' --glob '*.md' --glob '*.markdown'` with `cwd=root` — `--hidden` surfaces dot-dirs, `--no-ignore-vcs` surfaces `.research`/`.swarm` while `-g '!.git'` keeps git internals out. Results folded into `TreeNode` dirs (only when transitively containing matches) sorted dirs-first, `localeCompare(..., {sensitivity:'base'})`.

**Search** (`server/search.ts`): `rg --json --smart-case --max-count 5 --hidden --no-ignore-vcs … --fixed-strings -- <query>` (array spawn, query after `--`). stdout consumed line-delimited via `readline`; `try { JSON.parse }` guards truncated chunks after kill; windowed to 500 chars around first submatch; caps whole response at 2 MB → `truncated: true`. `mode=files` subsequence-matches the cached `files` list. Malformed regex returns `400 { error }`, never silent `0 results`.

**Path trust** (`server/safe-path.ts`): only place containment is granted — `path.resolve` lexical check + `fs.realpath` authoritative check (nearest-existing ancestor on `ENOENT`), `path.sep` boundary prevents prefix collisions (e.g., `/docs` vs `/docs-secrets`).

**Security gate** (`server/guard.ts`, mounted first): per-boot `SESSION_TOKEN` (`crypto.randomUUID()`) injected into `index.html` `<meta name="mdr-token" content="__MDR_TOKEN__">` and required as `x-mdr-token` on all non-GET `/api/*`; `Host` ∈ `127.0.0.1:<PORT>`/`localhost:<PORT>`/`[::1]:<PORT>` (DNS-rebinding), `Origin` check (CSRF), `Sec-Fetch-Site: same-origin`, `express.json({ limit:'64kb' })` default type only. `POST /api/roots` rejects the filesystem root, the home directory, and non-markdown files.

### Rendering (`src/markdown/`)

```
FileResult → renderDocument(file, { root, fileSet }) → RenderedDoc
  { html, headings, frontmatter, hasMermaid, highlightingSkipped }
raw string → renderRawMarkdown(raw)              → RenderedDoc  (paste preview, client-only)
```

- Frontmatter is server-only (`gray-matter` needs `Buffer`); `frontmatterLines` offsets `data-line` stamping (`md.core.ruler` on `state.env.frontmatterLines`). Paste preview uses a browser-safe parser in `src/markdown/frontmatter.client.ts` with the same offset logic.
- `rehype-pretty-code` with `github-light` / `github-dark`; per-render highlight toggle via `md.options.highlight = null` when `content.length > 200_000`.
- Mermaid fences become `<pre class="mermaid" data-src="…">`; `MarkdownView` lazy-imports `mermaid.ts` only when `hasMermaid`, calls `mermaid.initialize(CONFIG)` once and `run({ nodes: [el] })` per block.
- Large tables (>500 rows) render first 200 with a "Show all N rows" expander (paste preview shares the same cap, with its own `showAllTables` state in `src/stores/paste.ts`).
- Final HTML is `DOMPurify.sanitize(html, { ADD_TAGS:['details','summary'], ADD_ATTR:['data-line','data-internal-path',…] })` before `v-html`.

**Paste preview** (`src/stores/paste.ts` + `src/components/PasteDialog.vue` + `src/components/Reader.vue`): ephemeral, client-only, max `1.5 MB`, no `/api` call, no disk write. `Reader` shows the paste when `paste.doc` is set (banner `Pasted preview — Edit / Copy source / Clear`); `Sidebar`/`Toolbar` expose `Paste` buttons and a `Pasted preview active` chip; `Ctrl+Shift+V` opens the dialog.

---

## Keyboard Shortcuts

Press `?` to open the in-app overlay.

| Shortcut               | Action                        |
| ---------------------- | ----------------------------- |
| `Ctrl/Cmd + P`         | Focus tree filter             |
| `Ctrl/Cmd + Shift + F` | Focus search                  |
| `Ctrl/Cmd + T`         | New tab                       |
| `Ctrl/Cmd + W`         | Close tab                     |
| `Ctrl/Cmd + B`         | Toggle sidebar                |
| `Ctrl/Cmd + O`         | Open folder dialog            |
| `Ctrl/Cmd + Shift + H` | Open history                  |
| `Ctrl/Cmd + K`         | Toggle dark / light theme     |
| `Ctrl/Cmd + Shift + \` | Toggle wide prose             |
| `Ctrl/Cmd + Shift + V` | Paste markdown preview        |
| `Ctrl/Cmd + = / +`     | Zoom in                       |
| `Ctrl/Cmd + - / _`     | Zoom out                      |
| `Ctrl/Cmd + 0`         | Reset zoom                    |
| `Ctrl/Cmd + wheel`     | Zoom in / out                 |
| `Alt + ←` / `Alt + →`  | Back / forward in tab history |
| `/` (outside inputs)   | Focus filter                  |
| `Esc`                  | Clear filter                  |
| `?` (outside inputs)   | Toggle shortcut help          |

---

## Configuration & Persistence

- **Known roots** — persisted to the platform config directory (`state.json`, `{ roots: [{ root, lastOpened }] }`, max 10, most-recent first). This file is the allowlist for `safeJoin`.
- **Preferences** — `localStorage["markdown-reader:prefs:v2"]`: `theme` (`dark` default, `light` optional, applied via `document.documentElement[data-theme]` + early inline script in `index.html`), `fontScale`, `wideMode`, `sidebarWidth`/`sidebarCollapsed`, `searchMode`/`searchRegex`, `tocVisible`.
- **Tabs & history recent files** — `localStorage` tab session restored on reload (`boot.ts:decideBoot` — URL deep-link wins over CLI initial on refresh); per-root recent files with pin / delete / pinned-only filter, pruned when `workspace.builtAt` changes.

---

## Development

```bash
npm run typecheck        # vue-tsc --noEmit
npm test                 # node --test "test/**/*.test.ts"  (Node >=22.6, native TS)
npm run test:component   # vitest run --config vitest.config.ts  (happy-dom)
npm run lint             # eslint .
npm run format           # prettier --write .
npm run format:check     # prettier --check .
```

Run `typecheck` + both test suites before considering a change done:

```bash
npm run typecheck && npm test && npm run test:component
```

Notes:

- `verbatimModuleSyntax` is on — use `import type` for type-only imports, including from `server/types.ts`.
- Relative server imports use `.ts` extensions (`from './routes.ts'`); resolved by `tsx` + `moduleResolution: bundler`.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgments

- [ripgrep](https://github.com/BurntSushi/ripgrep) for fast recursive file enumeration and search.
- [unified / remark / rehype](https://unifiedjs.com/), [shiki](https://shiki.style/), [rehype-pretty-code](https://rehype-pretty.pages.dev/), [mermaid](https://mermaid.js.org/), [DOMPurify](https://github.com/cure53/DOMPurify).
- Built with Vite, Vue 3, Pinia, TypeScript, Tailwind CSS v4.
