# Users — Backend Module Progress

**Module version:** 1.0.0  
**Last reviewed:** 2026-08-17  
**Source:** `src/modules/users/`

## Endpoints & Services

| Route | Controller Handler | Status | Tests | Docs | Notes |
|-------|-------------------|--------|-------|------|-------|
| `GET /api/users/me` | `getProfile` | implemented | yes | yes | Authenticated user profile |
| `PATCH /api/users/profile` | `updateProfile` | implemented | yes | yes | Updates name, bio, location |
| `POST /api/users/avatar` | `uploadAvatar` | implemented | yes | yes | Sharp WebP optimization & Cloudinary upload |

## Key Components

| File | Purpose | Status |
|------|---------|--------|
| `users.controller.ts` | User profile endpoints | implemented |
| `users.service.ts` | MongoDB persistence & authorization check | implemented |

## Next Steps

- [ ] User notification preference settings

## Related

- [Master progress](../../PROGRESS.md)
