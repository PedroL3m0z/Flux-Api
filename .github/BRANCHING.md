# Branching strategy

This repository uses a **simplified trunk-based flow** (also called
[GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow))
combined with **release-please** for versioning. It is **not** classical
[GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) (no long-lived
`develop` branch).

For a solo maintainer or a small team shipping an open-source gateway, this keeps
history linear, releases predictable, and CI always runs against the same target:
`main`.

---

## Comparison with GitFlow

| Aspect | Classical GitFlow | Flux API (this repo) |
| ------ | ----------------- | -------------------- |
| Production branch | `main` / `master` | `main` (protected) |
| Integration branch | `develop` (long-lived) | **none** — integrate via PRs into `main` |
| Feature branches | from `develop` | **always from latest `main`** |
| Release branches | `release/*` manual | **release-please PR** (`chore(main): release X.Y.Z`) |
| Hotfix branches | from `main` | `fix/*` from `main` (same as features) |
| Version bump | manual | **automated** by release-please on merge of release PR |
| Merge style | varies | **squash merge** into `main` |

We intentionally skip `develop`: every merged PR is production-ready, CI-gated,
and release-please turns accumulated `feat`/`fix` commits into semver tags.

---

## Long-lived branches

| Branch | Purpose |
| ------ | ------- |
| `main` | Default branch. Always deployable. Protected (no direct push, no force-push). |
| `release-please--branches--main--components--flux-api` | **Bot-managed.** Opened/updated by release-please. Merge to cut a release; do not commit here manually. |

There should be **no other permanent branches**. Delete feature branches after merge.

---

## Short-lived branch naming

Use Conventional Commits prefixes as branch names:

```
feat/<short-description>     new functionality
fix/<short-description>      bug fix
chore/<short-description>    tooling, deps, CI
docs/<short-description>     documentation only
refactor/<short-description> internal refactor, no behaviour change
```

Examples from this repo:

- `feat/zero-config`
- `fix/auth-register-api-key`
- `chore/dependabot-bump-prisma`

**Avoid** reusing a branch name after its PR merged (e.g. do not keep pushing to
`feat/telegram-events-webhooks` for unrelated follow-ups — create a new branch).

---

## Standard workflow

```
main ─────────────────────────────────────────────► (protected)
  │
  ├── feat/my-change ── PR ── squash merge ──► main
  │
  └── fix/bug-xyz ──── PR ── squash merge ──► main
```

### Step by step

```bash
git checkout main && git pull origin main
git checkout -b feat/my-change

# ... edit, commit (Conventional Commits) ...
yarn lint && yarn build && yarn test

git push -u origin feat/my-change
gh pr create --base main --fill
gh pr checks <PR#> --watch
gh pr merge <PR#> --squash --delete-branch
```

### Rules

1. **Base every PR on `main`**, not on another feature branch.
2. **One concern per branch / PR** — small, reviewable diffs.
3. **Rebase (or merge `main`) before opening / updating a PR** so CI runs on a
   clean diff:
   ```bash
   git fetch origin
   git rebase origin/main
   git push --force-with-lease
   ```
4. **Squash merge** into `main` (default for this repo).
5. **Delete the branch** after merge (`--delete-branch` or GitHub UI).
6. **Close superseded PRs** — if you opened a new PR for the same work, close
   the old conflicting one. Never merge two PRs for the same change.

---

## Release workflow (release-please)

```
main ──► push ──► release-please opens PR "chore(main): release X.Y.Z"
                      │
                      └── merge (often --admin) ──► tag vX.Y.Z + GitHub Release
```

1. Land features/fixes on `main` via normal PRs (`feat:`, `fix:`).
2. release-please opens/updates a release PR bumping `package.json` + `CHANGELOG.md`.
3. Merge **only one** release PR per version. See [MAINTAINING.md](../docs/MAINTAINING.md)
   for the `GITHUB_TOKEN` / CI caveat (`gh pr merge <#> --squash --admin`).

Do **not** hand-edit version numbers for routine releases. Exception: force a
version with `Release-As: X.Y.Z` in a commit footer when cutting a major
milestone (used for v1.0.0).

---

## Hotfix workflow

Hotfixes use the **same flow** as features — there is no separate GitFlow
`hotfix/*` ceremony:

```bash
git checkout main && git pull
git checkout -b fix/critical-bug
# fix, test, push, PR → main, squash merge
# release-please will include the fix in the next patch release
```

For an urgent tagged release, merge the fix PR first, then merge the release-please
PR it opens.

---

## Dependabot & bot branches

| Source | Base | Action |
| ------ | ---- | ------ |
| Dependabot | `main` | CI green → squash merge → delete branch |
| release-please | `main` | Merge when ready to release (see above) |

Never stack Dependabot or feature work on top of an unmerged feature branch.

---

## Anti-patterns (learned the hard way)

### ❌ Stacked feature PRs (PR base ≠ `main`)

```
main ── feat/A ── feat/B ── PR(B → A)   ← wrong for this repo
```

PR **#37** targeted `feat/chat-media-apikey-gate` instead of `main`. That
leaves work off `main` until the entire stack merges, complicates rebases, and
confuses release-please.

**Do instead:** merge `feat/A` to `main` first, rebase `feat/B` on `main`, open
PR(B → `main`).

### ❌ Duplicate PRs for the same work

PR **#41** (clean branch from `main`) and PR **#40** (stale `feat/telegram-events-webhooks`
with conflicts) both landed. #40 merged **after** v1.0.0 and made release-please
open a spurious v1.1.0.

**Do instead:** when a PR is superseded, **close the old one**. Only one open PR
per change set.

### ❌ Long-lived stale branches

Many remote `feat/*` branches remain after merge. They clutter the repo and invite
accidental reuse.

**Do instead:** delete after merge; periodically prune:

```bash
git fetch --prune
gh api repos/PedroL3m0z/Flux-Api/branches --paginate --jq '.[].name' | findstr feat
# delete merged branches in GitHub → Branches UI or:
gh api -X DELETE repos/PedroL3m0z/Flux-Api/git/refs/heads/feat/old-branch
```

### ❌ Manual `CHANGELOG.md` + release-please

Hand-editing `[Unreleased]` while release-please also manages `CHANGELOG.md`
creates duplicate entries and wrong semver bumps.

**Do instead:** let release-please own the changelog for releases; put user-facing
notes in the PR description or README when needed.

---

## Branch protection summary

Configured on `main`:

- Required status check: `build-test`
- Strict: branch must be up to date before merge
- No force-push, no deletion
- Reviews: 0 required (solo maintainer), CI is the gate

Details and admin commands: [MAINTAINING.md](../docs/MAINTAINING.md).

---

## Quick reference

| I want to… | Branch from | PR target | Merge |
| ---------- | ----------- | --------- | ----- |
| Add a feature | `main` | `main` | squash + delete branch |
| Fix a bug | `main` | `main` | squash + delete branch |
| Ship a release | — | merge release-please PR | squash (+ `--admin` if CI blocked) |
| Update a dependency | Dependabot branch | `main` | squash + delete branch |

Related docs: [CONTRIBUTING.md](./CONTRIBUTING.md) · [MAINTAINING.md](../docs/MAINTAINING.md) ·
[.gitmessage.txt](./.gitmessage.txt)
