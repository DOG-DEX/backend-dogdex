# Predictions — Backend Module Progress

**Module version:** 1.0.0  
**Last reviewed:** 2026-08-17  
**Source:** `src/modules/predictions/`

## Endpoints & Services

| Route | Controller Handler | Status | Tests | Docs | Notes |
|-------|-------------------|--------|-------|------|-------|
| `POST /api/predictions` | `createPrediction` | implemented | yes | yes | Accepts image upload, enqueues BullMQ task |
| `GET /api/predictions/:id` | `getPrediction` | implemented | yes | yes | Status polling endpoint (`queued`, `processing`, `completed`, `failed`) |

## Key Components

| File | Purpose | Status |
|------|---------|--------|
| `predictions.controller.ts` | Image classification entrypoints | implemented |
| `predictions.processor.ts` | BullMQ queue worker executing Gemini / PyTorch inference | implemented |
| `predictions.gateway.ts` | WebSockets gateway broadcasting real-time progress | implemented |

## Next Steps

- [ ] Multi-dog detection in single photo frame

## Related

- [Master progress](../../PROGRESS.md)
