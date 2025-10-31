# Capacity Strategies

WokiBrain supports pluggable capacity heuristics via `CAPACITY_STRATEGY` environment variable. Strategies are resolved in `BookingModule` and injected into `WokiBrainService`.

## Simple Sum (`simple`)

- **Formula:** `min = Σ table.minCapacity`, `max = Σ table.maxCapacity`
- **Use Case:** Uniform table sizes, low variance in seating comfort.
- **Trade-offs:** Maximizes fill rate but may overcommit when tables have high max capacity buffers.

## Conservative Merge (`conservative`)

- **Formula:** `min = Σ table.minCapacity`, `max = floor(Σ table.maxCapacity × 0.9)`
- **Use Case:** Venues prone to no-shows or pacing concerns where leaving buffer is desirable.
- **Trade-offs:** Slightly reduces theoretical capacity but improves service reliability.

## Max of Mins (`maxofmins`)

- **Formula:** `min = max(table.minCapacity)`, `max = Σ table.maxCapacity`
- **Use Case:** Mixed table configurations where the tightest minimum dictates comfort.
- **Trade-offs:** Can disqualify combinations with small tables but avoids mismatches for larger parties.

## Configuration

- Set `CAPACITY_STRATEGY` to `simple`, `conservative`, or `maxofmins`.
- Default is `simple` when the variable is absent.
- Strategies are resolved once at application bootstrap; changes require a restart.

## Custom Strategies

To add a new strategy:

1. Implement `CapacityStrategy` in `src/domain/capacity-strategies/`.
2. Register it in `BookingModule` and extend the factory switch.
3. Document the new option in this file and the `.env.example`.

Ensure unit tests cover the new heuristics before enabling in production.
