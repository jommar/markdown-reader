# AGENTS.md

## Server start/restart is user-owned

- Never start, stop, or restart the dev/prod server yourself.
- If a server needs to be started or restarted, ask the user to do it and provide the exact command to run.
- Dev: `npm run dev`
- Prod: `npm run build && npm start`

## Repo state

- **Not a git repo.** Don't `git init` without asking. `.orchestrator/` holds session-scoped orchestration artifacts (one dir per session, never reused) and must stay out of any future repo.
- **`docs/PLAN.md` is the authoritative spec** — architecture, API contracts, per-step verification, and a 27-item trap list (§11) of verified failure modes. Read the relevant § before touching renderer, search, or path code. The app is fully built — PLAN.md is the spec, not a to-do list.
- `.orchestrator/<session>/plans/plan.md` is the tickable checklist for in-flight work.

## Commands

- `npm run typecheck` — `vue-tsc --noEmit`
- `npm test` — `node --test "test/**/*.test.ts"` (Node ≥22.6 native TS; no tsx needed)
- `npm run test:component` — `vitest run` (`test/components/**/*.spec.ts`, happy-dom)
- Two non-overlapping runners: `*.test.ts` = node --test (pure logic + Pinia stores), `*.spec.ts` = vitest (components). Run **typecheck + both suites** before calling a change done.

## Architecture gotchas

- Server spawns the **`rg` (ripgrep) binary** for tree scan and content search — it must be installed.
- All non-GET `/api/*` requests need the `x-mdr-token` header, whose value is the `mdr-token` meta content from the served HTML (random UUID per process). The guard's Host/Origin/Sec-Fetch-Site checks are all required (DNS-rebinding protection) — don't weaken them.
- `server/safe-path.ts` is the only place path trust is granted (realpath containment incl. symlinks). Keep it that way.
- Frontmatter is parsed **server-side only** — gray-matter cannot run in the browser.
- The markdown renderer is a singleton: thread per-document state through `env`, never closures; no render rule may throw (one throw blanks the whole document).
- `index.html` must keep `data-theme="dark"` and the `__MDR_TOKEN__` placeholder (the server injects the token).
- Known roots persist to `~/.config/markdown-reader/state.json` (or `$XDG_CONFIG_HOME`), max 10 roots.
- TS: `verbatimModuleSyntax` is on (use `import type`) and relative imports carry `.ts` extensions.
