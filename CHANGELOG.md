# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0](https://github.com/PedroL3m0z/Flux-Api/compare/v1.1.0...v1.2.0) (2026-06-19)


### Features

* reconnect existing instances via QR or phone ([#48](https://github.com/PedroL3m0z/Flux-Api/issues/48)) ([4281287](https://github.com/PedroL3m0z/Flux-Api/commit/42812871226f3d1e964dd1d70f14acefee336f9d))

## [1.1.0](https://github.com/PedroL3m0z/Flux-Api/compare/v1.0.0...v1.1.0) (2026-06-19)


### Features

* **config:** near zero-config boot ([#40](https://github.com/PedroL3m0z/Flux-Api/issues/40)) ([f001b80](https://github.com/PedroL3m0z/Flux-Api/commit/f001b804f60335fc378f84883d0d00d906e67ea4))
* global roles, phone login and admin user management ([#47](https://github.com/PedroL3m0z/Flux-Api/issues/47)) ([14fda85](https://github.com/PedroL3m0z/Flux-Api/commit/14fda853d78722870b14b4effb5994e10748c985))


### Bug Fixes

* **release:** revert duplicate PR [#40](https://github.com/PedroL3m0z/Flux-Api/issues/40) merge ([#43](https://github.com/PedroL3m0z/Flux-Api/issues/43)) ([356f6af](https://github.com/PedroL3m0z/Flux-Api/commit/356f6aff3be9488024492fbab07c6e49a0b86978))

## [1.0.0](https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.5...v1.0.0) (2026-06-19)


### Features

* chat media, events, webhooks and RBAC ([#38](https://github.com/PedroL3m0z/Flux-Api/issues/38)) ([e02a439](https://github.com/PedroL3m0z/Flux-Api/commit/e02a439f8d7761ab6e5ad9f0b2fc137cdbade2a2))
* **config:** near zero-config boot with auto-generated secrets ([#41](https://github.com/PedroL3m0z/Flux-Api/issues/41)) ([fed9649](https://github.com/PedroL3m0z/Flux-Api/commit/fed9649845a613179c9e7d0df370b9e4e3db3beb))

## [0.1.4](https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.3...v0.1.4) (2026-06-17)


### Features

* **auth:** httpOnly cookie session + Vue auth UI & dashboard ([#20](https://github.com/PedroL3m0z/Flux-Api/issues/20)) ([405cec9](https://github.com/PedroL3m0z/Flux-Api/commit/405cec9fc33145a90885fb310eeb70fac07c667f))
* **client:** add 404 page with catch-all route ([577b086](https://github.com/PedroL3m0z/Flux-Api/commit/577b0860821ec553d57b76dbacc960d7965b38d4))
* **client:** align sidebar/header and add collapse toggle ([af26e17](https://github.com/PedroL3m0z/Flux-Api/commit/af26e1790fdcc44f8c67f166f1ff71cdfeda2ac0))
* **client:** dark mode and i18n (pt-BR/en) ([7f29e1a](https://github.com/PedroL3m0z/Flux-Api/commit/7f29e1ae402300a12ff2f7a6524fdaf1b8c6ea8c))
* **client:** dashboard sidebar with section pages ([0415182](https://github.com/PedroL3m0z/Flux-Api/commit/04151821792d5b4e984d3d91a2d23aedc4e2bba1))
* **client:** health badge in sidebar; add blank Instances section ([612d09a](https://github.com/PedroL3m0z/Flux-Api/commit/612d09a03a526750182fc7f3dd54df0051648a8f))
* **users:** list all users + create via modal ([44507ae](https://github.com/PedroL3m0z/Flux-Api/commit/44507ae44b68a90e9e8d56a3564811d90c97b8e5))


### Bug Fixes

* **client:** square icon for favicon + sidebar ([#28](https://github.com/PedroL3m0z/Flux-Api/issues/28)) ([e07b017](https://github.com/PedroL3m0z/Flux-Api/commit/e07b0171f478115da880a0544345982b28a9a553))

## [0.1.3](https://github.com/PedroL3m0z/Flux-Api/compare/v0.1.2...v0.1.3) (2026-06-16)


### Features

* **client:** serve Vue dashboard via serve-static at /dashboard ([#17](https://github.com/PedroL3m0z/Flux-Api/issues/17)) ([7310b73](https://github.com/PedroL3m0z/Flux-Api/commit/7310b73698b2acc6981005e99a4f599f1ac2353c))
* **config:** validate environment variables at startup ([3fa4dca](https://github.com/PedroL3m0z/Flux-Api/commit/3fa4dca5af811e3aaaa50b7c85e7768dbca5e061))

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
