# Dog Dex Backend — Documentation Hub

> **New here?** Read **[START_HERE.md](./START_HERE.md)** first (Vietnamese guide).

Central documentation hub for **backend-dogdex**: NestJS architecture, module progress, and agent rules.

## Quick links

| Document | Who | Purpose |
|----------|-----|---------|
| **[START_HERE.md](./START_HERE.md)** | **Humans** | How to read & manage docs (Vietnamese) |
| [AGENT_GUIDE.md](./AGENT_GUIDE.md) | AI agents | Update rules & templates |
| [PROGRESS.md](./PROGRESS.md) | Everyone | Master backend progress dashboard |
| [CHANGELOG.md](./CHANGELOG.md) | Maintainers | Doc version history |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Everyone | Backend NestJS architecture & contract rules |
| [features/README.md](./features/README.md) | Everyone | Per-module feature index |

## Folder layout

```
docs/
├── START_HERE.md          ⭐ Read first (Vietnamese)
├── README.md              ← You are here
├── AGENT_GUIDE.md
├── PROGRESS.md
├── CHANGELOG.md
├── ARCHITECTURE.md
├── DECISIONS.md
├── PLAN.md
├── TESTING.md
├── versioning/conventions.md
└── features/
    ├── README.md
    └── */progress.md      (one per module: auth, predictions, dogs, pets, etc.)
```

## Project snapshot

| Property | Value |
|----------|-------|
| Project | `backend-dogdex` |
| Doc version | `1.0.0` |
| Last updated | 2026-08-17 |

## For AI agents

1. Read [START_HERE.md](./START_HERE.md) and [AGENT_GUIDE.md](./AGENT_GUIDE.md).
2. After code changes → update `features/<module>/progress.md` + [PROGRESS.md](./PROGRESS.md).
3. Keep technical docs in **English**; only START_HERE stays Vietnamese.
