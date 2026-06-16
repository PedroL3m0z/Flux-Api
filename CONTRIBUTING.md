# Contributing to Flux API

Thanks for your interest in contributing! 🎉

## Getting started

```bash
git clone https://github.com/PedroL3m0z/Flux-Api.git
cd Flux-Api
cp .env.example .env
yarn install
yarn prisma:generate
docker compose up -d postgres redis
yarn start:dev
```

## Workflow

1. Fork the repo and create a branch from `main`:
   `git checkout -b feat/my-feature`
2. Make your changes. Keep PRs focused and small.
3. Ensure the project builds, lints, and tests pass (see below).
4. Open a Pull Request using the template. Link related issues.

## Quality gates

```bash
yarn lint        # ESLint (--fix)
yarn build       # tsc / nest build
yarn test        # unit tests
yarn test:e2e    # e2e tests
```

All of the above also run in CI on every PR.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
feat(auth): add API key authentication strategy
fix(prisma): close pool on shutdown
docs(readme): document /health endpoint
```

Enable the shared commit template locally:

```bash
git config commit.template .github/.gitmessage.txt
```

## Database changes

Schema lives in `src/core/prisma/schema.prisma`. After editing it:

```bash
yarn prisma:migrate     # creates a migration + regenerates client
```

Commit the generated migration files. Do **not** commit `src/core/prisma/generated`.

## Reporting bugs / requesting features

Use the GitHub issue templates. For security issues, see [SECURITY.md](./SECURITY.md)
— do not open a public issue.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
