# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Report privately via [GitHub Security Advisories](https://github.com/PedroL3m0z/flux-api/security/advisories/new),
or email the maintainer at pedroantonio5735@gmail.com.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce (proof of concept if possible)
- Affected version / commit

You can expect an initial response within 72 hours. We will keep you informed
as we work on a fix and coordinate a disclosure timeline with you.

## Supported Versions

Until a stable `1.0.0` release, only the latest `main` branch receives security
fixes.

## Hardening notes

This template ships with sensible security defaults. Before deploying:

- Change `JWT_SECRET` and `API_KEY` from their `.env.example` placeholders.
- Restrict `CORS_ORIGIN` to your real frontend origins (never `*` in prod).
- Run behind TLS; keep `helmet` enabled.
- Review the rate-limit (`THROTTLE_TTL` / `THROTTLE_LIMIT`) for your traffic.
- Never commit `.env` or real credentials.
