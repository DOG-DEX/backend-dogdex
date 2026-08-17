# Admin — Backend Module Progress

**Module version:** 1.0.0  
**Last reviewed:** 2026-08-17  
**Source:** `src/modules/admin/`

## Endpoints & Services

| Route | Controller Handler | Status | Tests | Docs | Notes |
|-------|-------------------|--------|-------|------|-------|
| `GET /api/admin/users` | `listUsers` | implemented | yes | yes | Admin user management |
| `PATCH /api/admin/users/:id/ban` | `toggleBan` | implemented | yes | yes | User status management |

## Related

- [Master progress](../../PROGRESS.md)
