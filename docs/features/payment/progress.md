# Payment — Backend Module Progress

**Module version:** 1.0.0  
**Last reviewed:** 2026-08-17  
**Source:** `src/modules/payment/`

## Endpoints & Services

| Route | Controller Handler | Status | Tests | Docs | Notes |
|-------|-------------------|--------|-------|------|-------|
| `POST /api/payment/momo/create` | `createTransaction` | implemented | yes | yes | MoMo payment signature generation |
| `POST /api/payment/momo/callback` | `handleCallback` | implemented | yes | yes | IPN signature verification & transaction completion |

## Related

- [Master progress](../../PROGRESS.md)
