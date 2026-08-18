# DogDex Backend Agent Rules & Hard Constraints

This document is the workspace customization root (`AGENTS.md`) for AI agent assistance across the DogDex backend workspace.
Read [docs/START_HERE.md](docs/START_HERE.md), [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md), and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before making backend code changes.

---

## 1. Core Project Hard Constraints

1. **Controller vs Service Layer Separation**: Keep controllers thin. Business rules, database access, and data transformations belong strictly in Services. Controllers are responsible only for request routing, DTO validation, guard checks, and boundary media URL transformations.
2. **DTO Schema Validation**: Validate every API boundary with Zod or NestJS validation pipes; never accept untyped `any` request bodies.
3. **Concurrency Locks**: Enforce Redis `SET NX` locks with 60s TTL (`lock:project:<id>:step:<n>`) for atomic step operations to prevent duplicate in-flight processing.
4. **Resumable Step State**: Persist pipeline step outputs and statuses (`pending | running | done | failed`) in MongoDB to survive server restarts.
5. **No Emojis or Icons in Markdown**: Do NOT use unicode emojis or icons in any markdown (.md) documentation file. Keep markdown clean, structured, and versioning-friendly.
6. **Append-Only Documentation Preservation**: Never delete previous .md documentation files or historical ADR decisions. Proactively summarize existing context and append updates.
7. **Dual-Token JWT Auth**: Issue 15-minute Access Token + 7-day Refresh Token stored in HttpOnly cookies (`sameSite=lax`), supporting automatic silent refresh on 401 `TOKEN_EXPIRED`.
8. **Incremental Media Persistence**: Store uploaded images in date-structured paths (`uploads/images/YYYY/MM/<projectId>_<filename>`) served via `/api/media/files/...` with JWT query auth (`?token=...`).

---

## 2. Conventional Commit Standards & Scope Rules

Format: `<type>(<scope>): <subject>`

### Types
- `feat`: New backend capability or endpoint handler.
- `fix`: Bug fix.
- `refactor`: Service or utility refactoring without changing API contract.
- `docs`: Documentation updates only.
- `test`: Unit or integration test additions.
- `chore`: Configuration, build scripts, or dependency updates.

### Scope Rules & Function-Level Examples
- **Rule**: The `<scope>` MUST represent the specific service function, utility, controller, or schema being modified. Do NOT use broad macro module names (like `dogs` or `users`) as scope.
- **Backend Examples**:
  - `feat(lost-search): add lost dog geographic radius search service`
  - `feat(gemini-client): add multimodal AI classification engine and fallback client`
  - `feat(admin-fulfillment): add custom engraving queue and order status update service`
  - `feat(user-collection): add user pokedex collection mongodb aggregation pipeline`
  - `feat(momo-gateway): add payment initiation and callback handling service`
  - `feat(auth-tokens): add dual-token jwt issuance and silent cookie refresh`
  - `docs(adr): update backend architectural decision records ADR-001 to ADR-006`
  - `chore(media-util): add cloudinary duplicate URL cleaner and path normalizer`
  - `chore(env-config): add environment validation schema`

---

## 3. Git Branching & Integration Strategy

1. **Feature Branches**: Develop each feature on an isolated feature branch named `feat/<feature-name>` (or `docs/<topic>`, `chore/<topic>`).
2. **Master Integration Branch (`duong`)**: Merge all completed feature branches into the master integration branch `duong`.
3. **Commit Granularity**: Commit atomically per component/function change using the Conventional Commit standards above.

---

## 4. Key Documentation Deliverables

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): System topology, NestJS module layout, and database schemas.
- [docs/DECISIONS.md](docs/DECISIONS.md): Architectural decision records (ADRs) and trade-offs.
- [docs/PLAN.md](docs/PLAN.md): Master implementation plan and backend task deliverables.
- [docs/PROGRESS.md](docs/PROGRESS.md): Master progress dashboard tracking NestJS controllers and services.
- [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md): Documentation update triggers and maintenance rules.
