# DogDex Backend Architectural Decision Records (ADRs)

This document logs key architectural decisions, rationale, trade-offs, and design choices made across the **backend-dogdex** codebase.

---

## ADR-001: NestJS Modular Architecture over Standard Express

### Status
Accepted

### Context
The backend requires complex cross-cutting concerns (authentication guards, rate-limiting throttlers, background task scheduling, OpenAPI documentation, and DTO validation). Express by itself lacks structured dependency injection and uniform conventions for enterprise APIs.

### Decision
Use NestJS with modular architecture (`modules/`, `common/`, `clients/`, `shared/`). Enforce Controller-Service separation, global interceptors (`TransformInterceptor`), and global exception filters (`HttpExceptionFilter`).

### Consequences
- **Pros:** Strong TypeScript typing, decorator-driven routing and validation, built-in dependency injection, and standardized error responses `{ statusCode, message, path }`.
- **Cons:** Slightly higher initial setup boilerplate compared to micro-frameworks like Express.

---

## ADR-002: Asynchronous AI Vision Pipeline via BullMQ & Redis

### Status
Accepted

### Context
Analyzing high-resolution dog photos via Multimodal AI (Gemini 3.6 Flash / PyTorch FastAPI server) can take 2-5 seconds per image. Executing inference synchronously within an HTTP request risks client timeouts, poor user experience, and server worker starvation during high traffic.

### Decision
Implement asynchronous task queueing using **BullMQ** backed by **Redis**. HTTP `POST /api/predictions` validates input, creates a `Prediction` document with status `'queued'`, enqueues the job into BullMQ, and immediately returns HTTP `202 Accepted`. Clients track job completion in real-time via WebSockets (`ws://`) or status polling.

### Consequences
- **Pros:** Non-blocking HTTP endpoints, resilient retry capabilities, rate-limit protection via Redis locks, and live user feedback.
- **Cons:** Requires a running Redis instance in development and production environments.

---

## ADR-003: Hybrid AI Vision Strategy (Google Gemini API + PyTorch FastAPI Fallback)

### Status
Accepted

### Context
Third-party AI vision APIs (like Google Gemini) offer exceptional accuracy and rich breed trait extraction, but can encounter quota rate limits (`429 Too Many Requests`) or service outages.

### Decision
Implement a multi-tiered AI client provider (`shared/gemini` and `clients/ai-client`):
1. **Primary**: Google Gemini API (`gemini-3.6-flash` for vision classification).
2. **Fallback**: Self-hosted PyTorch FastAPI inference microservice (`DogBreedID_v2` model) for offline/quota failover.

### Consequences
- **Pros:** 99.9% uptime for AI predictions, resilient quota management, zero loss of scan requests.

---

## ADR-004: Redis Concurrency Locks & Client-Side SWR Caching

### Status
Accepted

### Context
Map tile queries, user location radar, and Dex collection stats can cause server load spikes if fetched continuously. However, tile caching on Redis wastes server RAM.

### Decision
1. **Server Redis Locks**: Use Redis `SET NX` locks with a 60s TTL (`lock:project:<id>:step:<n>`) strictly for atomic operations and API rate limiting.
2. **Client-Side SWR Caching**: Offload map tile storage, GPS position caching, and Dex collection filters to the client browser (`localStorage`, IndexedDB, browser RAM tile ring buffers).

### Consequences
- **Pros:** 0ms map tile rendering, zero Node.js server overhead for tile caching, resilient offline support for clients.

---

## ADR-005: Incremental Image Persistence & UserCollection MongoDB Aggregation

### Status
Accepted

### Context
When a user scans a new dog breed via AI vision, the encounter photo needs to be associated with the user's DogDex Pokedex collection without data loss or duplicate records.

### Decision
1. Store uploaded images in date-structured paths (`uploads/images/YYYY/MM/<projectId>_<filename>`) served via `/api/media/files/...` with JWT query auth (`?token=...`).
2. Maintain a single `UserCollection` MongoDB document per user containing an array of `collectedBreeds` (`{ breed_id, collection_count, first_collected_at, first_photo_url }`).
3. Automatically increment `collection_count` and set `first_photo_url` on the first encounter when AI predicts a match.

### Consequences
- **Pros:** Guarantees first-encountered photo persistence, provides real-time collection stats (`collectedBreeds`, `totalBreeds`, `progress`), powers Pokedex 2x4 grid UI.

---

## ADR-006: Dual-Token Authentication & HttpOnly Cookie Security

### Status
Accepted

### Context
Storing JWT access tokens in local storage exposes applications to Cross-Site Scripting (XSS) token theft.

### Decision
Issue a 15-minute Access Token + 7-day Refresh Token stored in HttpOnly cookies with `sameSite=lax`. Support automatic silent token refresh on HTTP `401 TOKEN_EXPIRED`.

### Consequences
- **Pros:** High security against XSS token theft, seamless user session persistence.
