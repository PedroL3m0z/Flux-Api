# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

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
