# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1](https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.0...v0.1.1) (2026-06-16)


### Features

* **docker:** source postgres credentials from .env ([4d36cc4](https://github.com/PedroL3m0z/Flux-Api/commit/4d36cc4f1f76ad48e161b93f9e8e028c4f626e51))


### Bug Fixes

* **docker:** configurable host ports and clean image build ([97db40c](https://github.com/PedroL3m0z/Flux-Api/commit/97db40c9ea3405c1a12be69c68d9d74ff3ec40e2))
* **docker:** make image build on node 26-alpine ([9c06c85](https://github.com/PedroL3m0z/Flux-Api/commit/9c06c85fda5d991286b01e0eedca891d9e21d531))
* **docs:** allow Scalar/Swagger UIs under helmet CSP ([42dd7a0](https://github.com/PedroL3m0z/Flux-Api/commit/42dd7a00dab92e7c094bbd0798fd030e2bd014ce))
* **lint:** resolve eslint errors blocking CI ([0224a53](https://github.com/PedroL3m0z/Flux-Api/commit/0224a535cab4cd3512d95cb69283dad003b3cb09))
* **test:** make jest resolve Prisma 7 client and run e2e ([56b7150](https://github.com/PedroL3m0z/Flux-Api/commit/56b71504a84a5b7a13915f1c44a5b36d465831a6))

## [Unreleased]

### Changed

- License changed from MIT to Apache License 2.0; added a `NOTICE` file.

- Dropped the classic Swagger UI; Scalar API Reference is now the only docs UI,
  served at `/docs`.
- Docker image builds on `node:26-alpine`; Postgres credentials and host ports
  are configurable via `.env`.
- Relaxed Helmet CSP so the Scalar docs UI loads correctly.

## [0.1.0] - 2026-06-16

### Added

- Initial public release.
- NestJS 11 HTTP gateway with Prisma 7 (PostgreSQL) and Redis (ioredis).
- Auth: local (user/password, Argon2id), JWT, and API key strategies.
- Security: Helmet, CORS, rate limiting (`@nestjs/throttler`).
- Healthchecks via `@nestjs/terminus` (postgres, redis, memory).
- OpenAPI docs served through Scalar at `/docs`.
- Docker Compose stack (postgres, redis, api).
- CI pipeline: lint, build, unit and e2e tests.

[Unreleased]: https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/PedroL3m0z/Flux-Api/releases/tag/v0.1.0
