# DogDex Backend Architecture and Coding Contract

This is the backend source of truth for developers and coding agents. Follow it for every new feature unless a task explicitly says otherwise.

## Request lifecycle

```text
Request -> Middleware -> Guard -> Interceptor (before) -> Pipe/DTO
        -> Controller -> Service -> Interceptor (after) -> Response

Any error at any stage -> Exception Filter -> standard error response
```

Controllers map HTTP to a use case. Services own business rules and persistence. Services must not know Express response objects.

## Source layout

```text
src/
  config/                       # environment schema and infrastructure config
  common/
    config/                     # reusable technical config (e.g. upload policy)
    decorators/                 # request metadata / parameter extraction
    exceptions/                 # reusable domain exception classes only
    filters/                    # standard HTTP error serialization
    guards/                     # authentication and authorization
    interceptors/               # response, logging, cache, timing
    middlewares/                # early request context/logging
  modules/<feature>/
    controllers/ dto/ schemas/ services/ <feature>.module.ts
  clients/                      # low-level external provider adapters
  shared/                       # reusable provider modules
  database/                     # connection setup
  main.ts                       # bootstrap only
```

Create a new feature module only for an independent business boundary. Do not create a module for one helper.

## Decision table: which NestJS construct to use

| Need | Use | Avoid |
|---|---|---|
| Validate or transform request data | DTO + `ValidationPipe` / parameter pipe | Manual validation in controllers |
| Read user ID, role, or locale | Parameter decorator | Repeated `req.user as any` |
| Decide whether a request may execute | Guard | Inline role checks |
| Add correlation ID / request logging before routing | Middleware | Controller copy-paste |
| Wrap execution before and after a handler | Interceptor | Manual response/log wrapping |
| Standardize technical errors | Exception filter | Arbitrary `try/catch` responses |
| Reusable named business failure | Custom exception | Generic `Error` |
| One ordinary HTTP failure | Nest built-in exception | A custom class for one endpoint |
| MongoDB / use-case rules | Service | Controller/model direct access |
| External API call | Client/shared provider | `axios` inside controllers |

## API contract rules

### Controller

- Accept DTOs, typed params/query DTOs, and decorators; never `@Body() body: any`.
- Never use a Mongoose model directly.
- Return a service result; the global `TransformInterceptor` makes success responses `{ data: ... }`.

```ts
@Patch('profile')
updateProfile(
  @CurrentUser('userId') userId: string,
  @Body() dto: UpdateProfileDto,
) {
  return this.userService.updateProfile(userId, dto);
}
```

### DTO and pipe

Create a DTO for every body and every non-trivial query. A DTO is an API contract, not a Mongo schema.

```ts
export class CreateDogDto {
  @IsString()
  @MaxLength(80)
  name: string;
}
```

Use a built-in pipe (`ParseIntPipe`, `ParseUUIDPipe`) for one primitive. Create a custom pipe only when a validation/transformation is reused across endpoints.

### Service

- Owns one use case: authorization ownership checks, persistence, transactions, and provider orchestration.
- Throws built-in HTTP exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`) for ordinary failures.
- Never calls `res.status()`, returns HTTP response objects, or reads the request directly.

### Response and errors

Success is always:

```json
{ "data": { "id": "..." } }
```

Errors come from filters:

```json
{ "statusCode": 400, "timestamp": "...", "path": "/api/...", "message": "..." }
```

For pagination return `{ items, pagination }` inside `data`. Never invent an endpoint-specific response envelope.

## When to add a framework class

### Guard

Use when the question is: **may this request execute?** Examples: JWT, role, or policy/ownership access. A guard returns true/false or throws; it does not implement an unrelated use case.

### Middleware

Use for handler-independent work that happens before routing: request ID, raw request logging, trusted proxy context. Do not use it for authorization or response formatting.

### Interceptor

Use for cross-cutting behavior around execution: response envelope, timing, audit log, cache. Never put feature-specific business rules here.

### Filter

Use only to serialize errors consistently or map a technical error family such as Mongo duplicate keys. Filters never decide a business rule.

### Custom exception

Prefer built-in Nest exceptions. Add a custom exception only if it has a stable name/error code, clients must distinguish it, and at least two use cases reuse it. Example: `InsufficientPredictionCreditsException`; not `UpdateProfileFailedException`.

## Security baseline

- Validate configuration in `config/env.config.ts`; never use fallback production secrets.
- Public routes require explicit `@Public()` and abuseable routes are throttled.
- DTO whitelisting prevents mass assignment of `role`, `plan`, `verify`, and token counters.
- Every user-owned resource query includes the authenticated owner ID.
- Uploads use `common/config/upload.config.ts`; never add an unchecked `FileInterceptor`.
- External callbacks verify signature and idempotency before state changes.

## Definition of done

- [ ] DTO validates every external body/query input.
- [ ] Authorization and resource ownership are enforced.
- [ ] Controller is thin; service owns the use case.
- [ ] Response/error follows global format.
- [ ] Config is added to `.env.example`, never a real env file.
- [ ] Tests cover changed success and failure paths.
- [ ] `npm run build`, `npm test -- --runInBand`, and `npm audit` pass.
