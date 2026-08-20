---
name: release
description: Ship a versioned release to npm (@jommar/markdown-reader) and GHCR (ghcr.io/jommar/markdown-reader) via tag-gated release.yml. Dry-run by default, ask bump + ask to ship.
---

You ship `markdown-reader` via the zero-host pipeline: `npm version` bump → `git tag v*` → `git push --follow-tags` → `.github/workflows/release.yml` → `GHCR + npm --provenance`. Tag-gated only — `push` to `main` runs `ci.yml` but does NOT publish.

## Pre-flight (always, read-only)

1. `git status --porcelain` must be clean (no untracked `M` except expected). `git log --oneline -3` + `git tag --list "v*" | tail` + `package.json:version` must agree.
2. `git diff HEAD~1 --stat` / `git log --name-only -1` — confirm the fix is on `main` (e.g. `src/markdown/mermaid.ts`).
3. Run gates before bumping — matches `AGENTS.md: Commands`:
   `npm run typecheck && npm test && npm run test:component && npm run build`
   Fail = stop, fix, don't bump.
4. `rg --version` + `gh auth status` — release needs `rg` and `NPM_TOKEN` (granular bypass 2FA, `gh secret list --repo jommar/markdown-reader`) or OIDC. `release.yml:56-60` uses `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.

## Step 1 — Ask bump (required, no default)

Use `question` tool:
- `patch` — bugfix (e.g. mermaid `getAttribute` null race `3e76808`)
- `minor` — new feature
- `major` — breaking

Do NOT assume. Wait for pick. Show current `package.json:version` and last tag.

## Step 2 — Dry-run (default)

Do NOT push/tag live. Run preview only:

```bash
npm version <pick> --no-git-tag-version -m "chore: bump to %s ..."
git diff package.json package-lock.json  # preview
echo "Would commit + tag vX.Y.Z + git push origin main --follow-tags"
npm run build  # ensure dist/ still builds
```

Print what WOULD happen:
- next version `X.Y.Z` + tag `vX.Y.Z`
- `git push origin main --follow-tags` triggers `release.yml:4 tags: ["v*"]` → `2m21s` build-and-publish (last `32413777273`), `gh run watch` shape, log grep for `+ @jommar/markdown-reader@X.Y.Z` and `Your package is being processed and may take a few minutes to become available.` + `Provenance statement published to transparency log: https://search.sigstore.dev/?logIndex=…`
- GHCR verify: `docker pull ghcr.io/jommar/markdown-reader:X.Y.Z && docker run --rm … --version`
- npm verify: `npm view @jommar/markdown-reader version` lag 1-6m (1.0.1: 16:06→16:12, 1.0.2: 20:25→~20:31), `curl https://registry.npmjs.org/@jommar%2Fmarkdown-reader` `dist-tags.latest`
- npx note: share as `@latest` — `npx @jommar/markdown-reader@latest --root …` (bare `npx @jommar/markdown-reader` hits npm 11 scoped-bin bug, `README.md:48`)

## Step 3 — Ask to ship (required)

After dry-run summary, use `question` tool:
- `Ship now` — run live release
- `Not yet` — stop, leave preview changes unpushed

Do NOT proceed without explicit `Ship now`. If `Not yet`: `git checkout -- package.json package-lock.json` to discard preview bump, exit.

## Step 4 — Live (only on Ship now)

```bash
npm version <pick> -m "chore: bump to %s for <reason>"
git push origin main --follow-tags
gh run list --limit 5  # find release vX.Y.Z + ci main
# poll until completed — release 32413777273: in_progress → success 2m21s, ci 32413776689 similar
gh run view <release-id> --json status,conclusion
gh run view <release-id> --log | grep -E "publish|provenance|error"
# verify GHCR
docker pull ghcr.io/jommar/markdown-reader:X.Y.Z
docker pull ghcr.io/jommar/markdown-reader:latest
# verify npm (poll, expect lag)
npm view @jommar/markdown-reader version
npm view @jommar/markdown-reader dist-tags
curl -s https://registry.npmjs.org/@jommar%2Fmarkdown-reader | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['dist-tags'])"
```

Report share lines:

```bash
npx @jommar/markdown-reader@latest --root /path/to/docs
npm i -g @jommar/markdown-reader && mdr --root /path/to/docs
docker run --rm -p 127.0.0.1:5180:5180 -v /path/to/docs:/docs ghcr.io/jommar/markdown-reader --root /docs
```

## Notes

- `release.yml:1-60` is `push.tags v*` + `workflow_dispatch` only; don’t change to `push.branches` without asking.
- `AGENTS.md` gate is `npm run typecheck && npm test && npm run test:component` — match it.
- Keep `README.md: Quantitative` note about `@latest` for npm 11.
- If dry-run fails at typecheck/tests, fix before asking to ship.
