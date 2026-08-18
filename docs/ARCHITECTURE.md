# DogDex Backend Architecture and Coding Contract

This is the backend source of truth for developers and coding agents. It uses NestJS modular architecture.

---

## 1. System Topology Overview

```text
+-------------------+        HTTP/JSON (JWT Cookie)       +-------------------+
|    Next.js FE     | ----------------------------------> |    NestJS API     |
|   (App Router)    | <---------------------------------- | (Feature Modules) |
+-------------------+                                     +-------------------+
                                                            |         |
                                                   +--------+         +--------+
                                                   v                           v
                                        +-------------------+       +-------------------+
                                        | MongoDB (Mongoose)|       | Redis + BullMQ    |
                                        | (Durable State)   |       | (Step Locks/Queue)|
                                        +-------------------+       +-------------------+
                                                                               |
                                                                               v
                                                                    +-------------------+
                                                                    | Gemini 3.6 Flash  |
                                                                    | AI Vision Engine  |
                                                                    +-------------------+
```

---

## 2. Module Layout

```text
src/
  modules/
    admin/                      # Admin order fulfillment, QR inventory, scan activity logs
    auth/                       # JwtAuthGuard, RefreshToken, AuthController, AuthService
    community/                  # Feedback, post social feeds
    dogs/                       # Dog breed wiki, search lost dogs, DogController, DogService
    media/                      # Local media storage, date-structured image serving
    payment/                    # MoMo payment gateway integration
    pets/                       # Pet profiles & emergency QR tag pairing
    predictions/                # AI Vision classification pipeline, BullMQ queue
    users/                      # User Profile, UserCollection Pokedex aggregation
  common/                       # Cross-cutting interceptors, filters, guards, pipes, utils
  clients/                      # Third-party API clients (Gemini AI, FastAPI PyTorch)
  config/                       # Environment schema and ConfigModule integration
  shared/                       # Shared modules and interfaces
```

---

## 3. Dependency Direction & Layering Rules

```text
Controller -> Service -> Model / Client / Queue
```

1. **Controllers**: Responsible only for route handling, DTO validation, Guard application, and boundary media URL transformations. Must NOT contain business logic.
2. **Services**: Encapsulate 100% of business logic, database queries, Redis locks, and domain operations.
3. **Guards & Interceptors**: Handle identity verification, authorization checks, and standard response envelopes (`TransformInterceptor`).

---

## 4. Coding Conventions

- **No Emojis or Icons**: Do NOT use unicode emojis or icons in any markdown (.md) documentation file.
- **Append-Only Preservation**: Never delete previous .md documentation files or historical ADR decisions. Proactively summarize existing context and append updates.
- **Concurrency Locks**: Enforce Redis `SET NX` locks with 60s TTL (`lock:project:<id>:step:<n>`) for atomic step operations.
- **Dual-Token Auth**: Issue 15-minute Access Token + 7-day Refresh Token in HttpOnly cookie (`sameSite=lax`).
