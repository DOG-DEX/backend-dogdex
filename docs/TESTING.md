# DogDex Backend Testing Strategy & Execution Guide

This document outlines the testing methodology, unit testing standards, end-to-end (E2E) testing procedures, and CI execution commands for **backend-dogdex**.

---

## 1. Testing Philosophy

1. **Zero Silent Swallowing:** Never wrap test assertions in generic try/catch blocks that pass silently.
2. **Deterministic Mocks:** External AI vision providers (Gemini API, FastAPI PyTorch server) and Cloudinary uploads must be mocked in test suites.
3. **In-Memory State:** Backend service unit tests use mocked Mongoose models or in-memory MongoDB servers (`mongodb-memory-server`).

---

## 2. Unit Testing (`*.spec.ts`)

Unit tests target isolated NestJS controllers, services, guards, and interceptors.

```bash
cd backend-dogdex

# Run unit tests across all modules
npm test

# Run unit tests in watch mode during active development
npm run test:watch

# Generate code coverage report
npm run test:cov
```

---

## 3. End-to-End Testing (`test/*.e2e-spec.ts`)

E2E tests spin up an ephemeral NestJS application instance with `supertest` to validate full HTTP request/response pipelines, authentication guards, DTO validation pipes, and error filters.

```bash
cd backend-dogdex
npm run test:e2e
```
