# Agent Navigation and Documentation Maintenance Guide - Backend (DogDex)

Comprehensive workflow guide for AI Agents maintaining, updating, and navigating the DogDex backend codebase and documentation.

---

## 1. Core Documentation Architecture

The documentation in `docs/` is organized hierarchically. Always maintain link integrity and append updates without deleting past historical context.

| Document | Path | Purpose | When to Update |
| :--- | :--- | :--- | :--- |
| **Start Here** | `docs/START_HERE.md` | Developer onboarding and backend setup | Initial setup or environment changes |
| **Agent Guide** | `docs/AGENT_GUIDE.md` | Navigation rules, commit standards, and update triggers | Whenever documentation workflows evolve |
| **Master Plan** | `docs/PLAN.md` | Master backend roadmap, NestJS module deliverables, and task lists | When new API endpoints, queues, or modules are planned |
| **Master Progress** | `docs/PROGRESS.md` | Master status dashboard tracking NestJS controllers and services | After completing module tasks or adding endpoints |
| **Decisions Log (ADRs)** | `docs/DECISIONS.md` | Architectural Decision Records (ADRs) logging backend trade-offs | Whenever architectural or technical decisions are made |
| **System Architecture** | `docs/ARCHITECTURE.md` | Microservice topology, NestJS module layout, and database schemas | When structural architecture or data flows change |
| **Feature Plans** | `docs/features/<module>/progress.md` | Granular module task list, DTO validation, and service logic | During active development of specific backend modules |
| **Changelog** | `docs/CHANGELOG.md` | Chronological log of major version updates and breaking API changes | Upon completing major milestones or version releases |

---

## 2. Conventional Commit Standards & Scope Rules

Format: `<type>(<scope>): <subject>`

### Commit Types
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
3. **Atomic Commits**: Create small, atomic commits per component/function using Conventional Commit standards.

---

## 4. Hard Documentation Rules for AI Agents

1. **No Emojis or Icons in Markdown**:
   Do NOT use unicode emojis or icons in any `.md` documentation file. Keep all markdown documentation clean, professional, structured, and versioning-friendly.

2. **Append-Only and Historical Preservation**:
   NEVER delete previous entries, historical ADR decisions, or past plan phases. Proactively summarize existing context and append new updates under new section headers (`ADR-XXX`).

3. **Controller vs Service Layer Separation**:
   Keep controllers thin. Business rules, database access, and data transformations belong strictly in Services. Controllers are responsible only for request routing, DTO validation, guard checks, and boundary media URL transformations.
