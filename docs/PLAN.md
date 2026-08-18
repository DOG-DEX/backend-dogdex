# Backend Implementation Plan & Deliverables — DogDex

Detailed task list and architecture roadmap for **backend-dogdex**.

---

## 🎯 Phase 1: Core Modular Backend Infrastructure
- [x] NestJS Feature-Module Architecture (`auth/`, `users/`, `dogs/`, `predictions/`, `media/`, `payment/`, `community/`, `admin/`).
- [x] MongoDB Schemas via Mongoose (`User`, `UserCollection`, `DogBreedWiki`, `Pet`, `Product`, `Order`, `PredictionHistory`).
- [x] Dual-Token Auth System (15-min Access Token + 7-day Refresh Token in HttpOnly cookie).
- [x] Redis Concurrency Locks (`SET NX` with 60s TTL) for atomic operations.

---

## 🐶 Phase 2: Dog Breed Wiki & Collection Management
- [x] `GET /api/public/dogs`: List all dog breed wikis with pagination and search.
- [x] `GET /api/public/dogs/search/lost`: Search lost dog records for Radar Map.
- [x] `GET /api/bff/collection/dogdex`: Get user's DogDex Pokedex collection (`collectedBreeds`, `progress`).
- [x] `POST /api/bff/collection/add/:slug`: Add breed to user's collection manually or via AI scan.
- [x] `POST /api/public/dogs/report-found-verified`: Send verified lost dog notification to pet owner.

---

## 📷 Phase 3: AI Vision Pipeline & Media Storage
- [x] `POST /api/predictions/predict`: Multimodal AI dog breed identification via Google Gemini API & PyTorch fallback.
- [x] `POST /api/medias/upload`: Date-structured media persistence (`uploads/images/YYYY/MM/...`).
- [x] Real-time prediction state updates via BullMQ & Redis queues.

---

## 🛒 Phase 4: E-Commerce & Smart QR Collar Fulfillment
- [x] `POST /api/payment/momo`: MoMo payment gateway initiation for physical smart QR collars.
- [x] `GET /api/admin/orders`: Order tracking and QR tag code fulfillment for admins.
- [x] `GET /api/public/pets/:tagId`: Emergency landing page for scanned physical collar tags.
