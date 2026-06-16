# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2](https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.1...v0.1.2) (2026-06-16)


### Bug Fixes

* **auth:** return 409 on duplicate username in register ([1de3be6](https://github.com/PedroL3m0z/Flux-Api/commit/1de3be69928eef2f1f7081b5600223f1d52bc523))

## [0.1.1](https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.0...v0.1.1) (2026-06-16)


### Features

* **docker:** source postgres credentials from .env ([4d36cc4](https://github.com/PedroL3m0z/Flux-Api/commit/4d36cc4f1f76ad48e161b93f9e8e028c4f626e51))


### Bug Fixes

* **docker:** configurable host ports and clean image build ([97db40c](https://github.com/PedroL3m0z/Flux-Api/commit/97db40c9ea3405c1a12be69c68d9d74ff3ec40e2))
* **docker:** make image build on node 26-alpine ([9c06c85](https://github.com/PedroL3m0z/Flux-Api/commit/9c06c85fda5d991286b01e0eedca891d9e21d531))
* **docs:** allow Scalar/Swagger UIs under helmet CSP ([42dd7a0](https://github.com/PedroL3m0z/Flux-Api/commit/42dd7a00dab92e7c094bbd0798fd030e2bd014ce))
* **lint:** resolve eslint errors blocking CI ([0224a53](https://github.com/PedroL3m0z/Flux-Api/commit/0224a535cab4cd3512d95cb69283dad003b3cb09))
* **test:** make jest resolve Prisma 7 client and run e2e ([56b7150](https://github.com/PedroL3m0z/Flux-Api/commit/56b71504a84a5b7a13915f1c44a5b36d465831a6))

### Miscellaneous

* Relicensed from MIT to Apache-2.0; added a `NOTICE` file.

## [0.1.0](https://github.com/PedroL3m0z/Flux-Api/releases/tag/v0.1.0) (2026-06-16)

Initial release.

### Features

* NestJS 11 HTTP gateway with Prisma 7 (PostgreSQL) and Redis (ioredis).
* Auth: local (username/email + password, Argon2id), JWT, and API key strategies.
* Security hardening: Helmet, CORS, and rate limiting (`@nestjs/throttler`).
* Healthchecks for postgres, redis, and memory via `@nestjs/terminus`.
* OpenAPI documentation served through Scalar at `/docs`.
* Docker Compose stack (postgres, redis, api) and CI (lint, build, unit, e2e).
