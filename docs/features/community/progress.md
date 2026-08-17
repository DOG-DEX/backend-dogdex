# Community — Backend Module Progress

**Module version:** 1.0.0  
**Last reviewed:** 2026-08-17  
**Source:** `src/modules/community/`

## Endpoints & Services

| Route | Controller Handler | Status | Tests | Docs | Notes |
|-------|-------------------|--------|-------|------|-------|
| `GET /api/community/posts` | `getFeed` | implemented | yes | yes | Community post feed |
| `POST /api/community/posts` | `createPost` | implemented | yes | yes | Create post with breed tag & image |
| `POST /api/community/posts/:id/like` | `toggleLike` | implemented | yes | yes | Like/unlike post |

## Key Components

| File | Purpose | Status |
|------|---------|--------|
| `community.controller.ts` | Feed & post interaction handlers | implemented |
| `community.service.ts` | Community feed logic & ownership verification | implemented |

## Next Steps

- [ ] Nested comment replies

## Related

- [Master progress](../../PROGRESS.md)
