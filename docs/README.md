# WokiBrain Booking Engine

## Overview

WokiBrain is a NestJS booking engine designed for restaurant capacity orchestration. It discovers optimal table combinations, enforces concurrency rules, and exposes a fully guarded API for reservations, waitlist management, and operational metrics. Bonus features such as variable seating durations, large-party approvals, repacking, rate limiting, and property-based verification are built in.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Run the development server**
   ```bash
   npm run start:dev
   ```
3. **Explore the API docs**
   ```bash
   open http://localhost:3000/docs
   ```
4. **Execute tests and view coverage**
   ```bash
   npm test
   npm run test:cov
   ```
5. **Start with compiled build**
   ```bash
   npm run build
   npm start
   ```

### Environment

Copy `.env.example` to `.env` and adjust configuration (strategy selection, rate limits, approval thresholds) before starting the server.

## Architecture Highlights

- **App Module (`src/app.module.ts`)** wires configuration, scheduling, bookings, waitlist, and metrics modules.
- **Domain Layer (`src/domain`)**
  - Models define Restaurants, Sectors, Tables, Bookings, Blackouts, and Waitlist entries (timestamped).
  - `GapsService` computes available windows across table combinations.
  - `WokiBrainService` implements deterministic candidate selection with pluggable capacity strategies.
  - `RepackService` optimizes existing assignments (Bonus B2).
- **Store Layer (`src/store`)**
  - `InMemoryStore` indexes entities per sector/table/day.
  - `LockingService` provides a semaphore map for atomic booking windows (Bonus B6).
  - `IdempotencyService` caches responses with a 60s volatile window and 24h persistent map (Bonus B9).
- **Booking Module (`src/booking`)**
  - Controller exposes discovery, creation, listing, cancellation, approval, and repack endpoints.
  - Guarded by rate limiting and approval guard for large-party workflows (Bonus B3 + B9).
- **Waitlist Module (`src/waitlist`)**
  - Service + Cron auto-promote waitlisted guests when availability appears (Bonus B5).
- **Metrics Module (`src/metrics`)**
  - Prometheus-compatible counters and summaries (Bonus B8).
- **Common Utilities**
  - Global exception filter, logging interceptor, and rate limit guard.
- **Seed (`src/seed`)**
  - Injects a deterministic restaurant layout for local development.
- **Testing (`test/`)**
  - Unit, integration, and property-based suites with fast-check (Bonus B7). Jest coverage exceeds 80%.

## Feature Matrix

| Feature                                   | Location/Notes                                             |
|-------------------------------------------|------------------------------------------------------------|
| Gap discovery & combos                    | `src/domain/gaps.service.ts`                               |
| Deterministic WokiBrain selection         | `src/domain/wokibrain.service.ts`                          |
| Capacity strategies (simple/conservative/max-min) | `src/domain/capacity-strategies/`                    |
| Variable duration rules (B1)              | `src/config/configuration.ts`                              |
| Repack optimization (B2)                  | `src/domain/repack.service.ts`                             |
| Large-group approval workflow (B3)        | `src/booking/guards/approval.guard.ts`, cron + service     |
| Blackouts as first-class entities (B4)    | `src/domain/models/blackout.model.ts`, store integration   |
| Waitlist auto-promotion (B5)              | `src/waitlist/waitlist.service.ts` & `src/waitlist/waitlist.cron.ts` |
| Performance + semaphore locking (B6)      | `src/store/locking.service.ts`, indexed store              |
| Property-based tests (B7)                 | `test/unit/property-based.spec.ts`                         |
| Metrics endpoint (B8)                     | `src/metrics/metrics.controller.ts` & `metrics.service.ts` |
| Rate limiting & persistent idempotency (B9)| `src/common/guards/rate-limit.guard.ts`, `src/store/idempotency.service.ts` |

## Logging & Observability

- Pino HTTP logging is registered globally in `src/main.ts`.
- Prometheus metrics are exposed through `GET /metrics`.
- Structured errors propagate via `HttpExceptionFilter`.

## Next Steps

- Integrate with a persistent database or cache layer (Redis/Postgres).
- Extend the metrics service with histograms for end-to-end latency.
- Add notification integrations to replace MVP log messages when promoting waitlist entries.
