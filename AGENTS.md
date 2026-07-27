# DogDex Backend Agent Rules

Read [docs/architecture/architecture-design.md](docs/architecture/architecture-design.md) before changing backend code.

- Keep controllers thin; business rules and database access belong in services.
- Validate every API boundary with DTOs and pipes; never accept untyped `any` bodies.
- Use global response/error conventions. Do not create endpoint-specific envelopes.
- Enforce identity and permission with guards, not controller `if` statements.
- Put reusable cross-cutting behavior in `common/`; do not copy it into features.
- Run `npm run build` and `npm test -- --runInBand` after changes. Report lint debt honestly.
- Never commit `.env.local` or `.env.prod`.
