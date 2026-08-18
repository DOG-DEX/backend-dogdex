# Moderation — Backend Module Progress

**Module version:** 1.0.0  
**Last reviewed:** 2026-08-17  
**Source:** `src/modules/moderation/`

## Endpoints & Services

| Route | Controller Handler | Status | Tests | Docs | Notes |
|-------|-------------------|--------|-------|------|-------|
| `GET /api/moderation/queue` | `getFlaggedContent` | implemented | yes | yes | Protected by `@Roles('ADMIN', 'MODERATOR')` |

## Related

- [Master progress](../../PROGRESS.md)
