# Maintainer Guide

Operational runbook for maintainers of Flux API. For contributor workflow
(branches, commit style, quality gates) see [CONTRIBUTING.md](../.github/CONTRIBUTING.md)
and the branching model in [BRANCHING.md](../.github/BRANCHING.md).

All commands assume the [GitHub CLI](https://cli.github.com/) (`gh`) is
installed and authenticated (`gh auth status`).

---

## 1. Branch protection (already enabled)

`main` is protected. What it means day to day:

- **No direct pushes to `main`.** Always work on a branch and open a PR.
- A PR can only merge when the **`build-test`** CI check is green.
- The branch must be **up to date with `main`** before merging (strict mode).
- **No force-push and no deletion** of `main`.
- Reviews are **not** required (`0` approvals) so a solo maintainer is not
  blocked, but the CI gate still applies.

### Standard change flow

See **[BRANCHING.md](../.github/BRANCHING.md)** for the full model (GitHub Flow +
release-please, not classical GitFlow).

```bash
git checkout main && git pull origin main
git checkout -b feat/my-change
# ...edit, commit (Conventional Commits)...
git push -u origin feat/my-change
gh pr create --base main --fill
gh pr checks <PR#> --watch          # wait for build-test
gh pr merge <PR#> --squash --delete-branch
```

**Never** target another feature branch with a PR — always `main`. After merging
a superseding PR, close older/conflicting PRs for the same work (see anti-patterns
in BRANCHING.md).

If `main` moved while your PR was open (e.g. Dependabot landed), rebase:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

---

## 2. Cutting a release (release-please)

Releases are automated by **release-please**
(`.github/workflows/release-please.yml`). You never bump the version or edit
`CHANGELOG.md` by hand.

### How it works

1. On every push to `main`, release-please reads the Conventional Commits.
2. It opens / updates a **release PR** titled `chore(main): release X.Y.Z`
   that bumps the version in `package.json` and updates `CHANGELOG.md`.
3. **Merging that release PR** creates the git tag `vX.Y.Z` and publishes a
   GitHub Release.

Only `feat:` and `fix:` commits trigger a release. Post-1.0 bumping follows
semver via release-please defaults (`feat:` → minor, `fix:` → patch, breaking
→ major). Pre-1.0 behaviour was configured in `release-please-config.json`
(`bump-minor-pre-major`).

### Merging the release PR — the GITHUB_TOKEN caveat

The release PR is opened by the `github-actions` bot using `GITHUB_TOKEN`.
GitHub **does not trigger workflows for PRs created by `GITHUB_TOKEN`**, so the
required `build-test` check never runs on the release PR and branch protection
shows it as **BLOCKED**.

Pick one of the two options below.

#### Option A — merge as admin (no extra setup)

You are the repo owner and admin enforcement is off, so you can bypass the
missing check:

```bash
gh pr merge <release-PR#> --squash --admin
```

This tags `vX.Y.Z` and creates the GitHub Release. Repeat for each release.

#### Option B — PAT so the release PR runs CI by itself

Set this up once and you never need `--admin` again.

1. Create a **fine-grained PAT** (or classic with `repo` scope):
   GitHub → Settings → Developer settings → Personal access tokens.
   Grant it **Contents: read/write** and **Pull requests: read/write** on this
   repo.
2. Add it as a repo secret named `RELEASE_PLEASE_TOKEN`:
   ```bash
   gh secret set RELEASE_PLEASE_TOKEN
   # paste the token when prompted
   ```
3. Point the workflow at it — in `.github/workflows/release-please.yml`:
   ```yaml
   - uses: googleapis/release-please-action@v4
     with:
       token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
   ```

Because the PR is now created by a real user token, CI runs on it and you can
merge it normally (`gh pr merge <release-PR#> --squash`).

---

## 3. Making the repository public

The repo is currently **private**. Going public is effectively irreversible
(the code gets cached, indexed, and may be forked). Before flipping it:

- [ ] No secrets in the working tree or git history (`.env` is gitignored).
- [ ] `LICENSE`, `README.md`, `SECURITY.md` are current.
- [ ] CI is green on `main`.

Then:

```bash
gh repo edit PedroL3m0z/Flux-Api --visibility public --accept-visibility-change-consequences
```

> On the GitHub Free plan, branch protection rules keep working on public
> repos. Double-check protection is still active afterwards:
> `gh api repos/PedroL3m0z/Flux-Api/branches/main/protection`

---

## 4. Dependabot updates

`.github/dependabot.yml` opens dependency PRs automatically. For each one:

```bash
gh pr checks <PR#> --watch     # let CI verify the bump
gh pr merge <PR#> --squash --delete-branch
```

If the PR is behind `main`, comment `@dependabot rebase` on it, or rebase
locally as in section 1.

---

## 6. Stale branch cleanup

After merges, delete remote feature branches. A large pile of old `feat/*`
branches makes it easy to reopen a stale PR (see PR #40 duplicate merge incident
in [BRANCHING.md](../.github/BRANCHING.md)).

List remote branches:

```bash
git fetch --prune
gh api repos/PedroL3m0z/Flux-Api/branches --paginate --jq '.[].name'
```

Delete a merged branch (example):

```bash
gh api -X DELETE repos/PedroL3m0z/Flux-Api/git/refs/heads/feat/old-branch
```

Or use GitHub → **Branches** → delete merged branches in bulk.

---

## 7. Reference — current repo settings

| Setting              | Value                                            |
| -------------------- | ------------------------------------------------ |
| Default branch       | `main` (protected)                               |
| Branching model      | GitHub Flow — see [BRANCHING.md](../.github/BRANCHING.md) |
| Required CI check    | `build-test`                                     |
| Required reviews     | 0 (CI gate only)                                 |
| License              | Apache-2.0                                        |
| Release automation   | release-please (`release-type: node`)            |
| Actions → create PRs | enabled (needed by release-please)               |

Re-inspect any time:

```bash
gh api repos/PedroL3m0z/Flux-Api --jq '{visibility, license: .license.spdx_id, default_branch}'
gh api repos/PedroL3m0z/Flux-Api/branches/main/protection
```
