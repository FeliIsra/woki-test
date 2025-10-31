# WokiBrain Algorithm

## Gap Discovery

1. **Normalize Intervals**
   - Collect confirmed and pending bookings for each table in the target sector/day.
   - Treat blackouts as bookings, scoped to table and sector levels.
   - Trim intervals to service window boundaries.
   - Merge overlapping ranges after sorting by start time.
2. **Compute Table Gaps**
   - Insert sentinel intervals at the start and end of the service window.
   - Iterate adjacent pairs of occupied slots to produce open gaps `[previousEnd, nextStart)`.
3. **Intersect Combinations**
   - For each valid table combination (respecting `combinableWith` constraints), intersect the gap sets across the participating tables.
   - Retain only gaps whose duration ≥ requested party duration.

### Pseudocode

```
function findAvailableSlots(tableIds, date, duration, window):
  windowStart = combine(date, window.start)
  windowEnd = combine(date, window.end)
  targetMs = duration * 60_000

  gapsByTable = []
  for tableId in tableIds:
    bookings = listTableBookings(tableId, date).filter(CONFIRMED or PENDING)
    blackouts = listTableBlackouts(tableId, date)
    intervals = normalize(bookings + blackouts, windowStart, windowEnd)
    gapsByTable.push(gapsFromIntervals(intervals, windowStart, windowEnd))

  intersections = reduceIntersect(gapsByTable)
  return intersections.filter(gap => gap.length >= targetMs)
```

## Combination Strategy

- Tables are sorted lexicographically to ensure deterministic combo generation.
- Backtracking enumerates single tables up to the configured `maxTablesPerCombo`.
- Combinations only include tables that mutually list each other in `combinableWith`.

## Selection Heuristic

1. Generate all candidate combinations.
2. For each, compute min/max capacity via the configured strategy.
3. Filter by party size range.
4. Discover available gaps (see above).
5. Emit candidates with `start`, `end`, and capacity data.
6. Sort by `start`, then `capacity.max`, then canonical table-id string.
7. Return the first entry or `no_capacity`.

This ordering guarantees deterministic responses even under identical inputs.

## Collision Handling

- `LockingService` issues per-combination locks: `restaurant|sector|tables|start`.
- Booking creation acquires the lock, rechecks overlaps, and records the reservation.
- Lock contention is tracked for metrics and fairness is enforced with FIFO queues.

## Repack Optimization

- Iterate confirmed bookings ordered by start time.
- For each booking, evaluate smaller compatible tables free of conflicts.
- If waste (assigned capacity − party size) decreases, atomically reassign the booking.
- Repeat until no improvements remain, recording the number of moves.
