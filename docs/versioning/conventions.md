# Backend Documentation Versioning Conventions

This document specifies the rules for versioning backend documentation files within `backend-dogdex`.

---

## 1. Version Format

Backend documentation follows **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

- **MAJOR** (`X.0.0`): Breaking structural shifts, architectural re-specifications (e.g. migrating backend framework, breaking API response envelopes, altering database ORM/ODM model contracts).
- **MINOR** (`1.X.0`): Adding new feature modules to `src/modules/`, adding new API endpoints, or introducing new global guards/interceptors.
- **PATCH** (`1.0.X`): Status label updates in `features/<module>/progress.md`, typo corrections, or minor documentation clarifications.

---

## 2. Maintenance Rules

1. Update the `Doc version` snapshot in `docs/README.md` and `docs/PROGRESS.md` whenever bumping MINOR or MAJOR versions.
2. Log all significant updates in `docs/CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) standards.
3. Every feature module in `src/modules/` must maintain a matching progress tracker at `docs/features/<module>/progress.md`.
