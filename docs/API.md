# WokiBrain API Reference

The interactive OpenAPI explorer is available at [`/docs`](http://localhost:3000/docs) when the NestJS service is running locally.

Base path: `/woki`

All endpoints are protected by the rate-limit guard (100 requests/minute per IP). Provide `Idempotency-Key` headers where noted to guarantee safe retries.

## Discovery

### `GET /woki/discover`

Query parameters:
- `restaurantId` (UUID)
- `sectorId` (UUID)
- `partySize` (number)
- `date` (ISO8601 day or timestamp)
- `durationMinutes` (optional)

Response:
```json
{
  "outcome": "success",
  "candidate": {
    "tableIds": ["table-2"],
    "start": "2025-06-01T12:00:00.000Z",
    "end": "2025-06-01T13:30:00.000Z",
    "capacity": { "min": 2, "max": 4 }
  }
}
```

`outcome` becomes `no_capacity` if no slots are available.

## Bookings

### `POST /woki/bookings`

Headers:
- `Idempotency-Key` (recommended)

Body:
```json
{
  "restaurantId": "resto-1",
  "sectorId": "sector-main",
  "partySize": 4,
  "start": "2025-06-01T12:00:00.000Z",
  "customerName": "Ada Lovelace",
  "durationMinutes": 90
}
```

Responses:
- `201`: booking created (status `CONFIRMED` or `PENDING` when large-party approval is required)
- `409`: conflicting booking or blackout
- `422`: outside service window

### `GET /woki/bookings/day`

Query parameters:
- `restaurantId`, `sectorId`, `date` (ISO8601)
- `includeCancelled` (optional boolean)

Returns an array of bookings for the given service day.

### `DELETE /woki/bookings/:id`

- Cancels a booking and triggers waitlist promotion.
- Returns `204` No Content.

### `PUT /woki/bookings/:id/approve`

Headers:
- `x-woki-approver`: approver identifier (required)

Body (optional):
```json
{ "approver": "Manager Jane" }
```

Transitions a large-party booking from `PENDING` to `CONFIRMED`. Returns the updated booking.

### `POST /woki/bookings/repack`

Body:
```json
{
  "restaurantId": "resto-1",
  "sectorId": "sector-main",
  "date": "2025-06-01"
}
```

Response:
```json
{ "moved": 3 }
```
Repacks bookings into tighter table assignments when beneficial.

## Waitlist

### `POST /woki/waitlist`

Body:
```json
{
  "restaurantId": "resto-1",
  "sectorId": "sector-main",
  "partySize": 4,
  "desiredTime": "2025-06-01T18:00:00.000Z",
  "customerName": "Grace Hopper"
}
```

Response contains the created waitlist entry with timestamps and priority.

### `GET /woki/waitlist`

Query parameters:
- `restaurantId`, `sectorId`

Returns waitlist entries sorted by priority then requested time.

## Metrics

### `GET /metrics`

Responds with Prometheus text format containing counters:
- `bookings_created_total`
- `bookings_cancelled_total`
- `conflicts_total`
- `lock_contention_total`
- `wokibrain_assignment_duration_ms` (summary with percentiles)

## Settings

### `GET /woki/settings/catalog`

Lists the current state of in-memory entities that can be manipulated through the admin UI.

```json
{
  "restaurants": [
    { "id": "resto-1", "name": "WokiBrain Bistro", "timezone": "UTC" }
  ],
  "sectors": [
    { "id": "sector-main", "name": "Main Dining", "restaurantId": "resto-1" }
  ],
  "tables": [
    {
      "id": "table-1",
      "label": "T1",
      "restaurantId": "resto-1",
      "sectorId": "sector-main",
      "minCapacity": 2,
      "maxCapacity": 2,
      "combinableWith": ["table-2"]
    }
  ]
}
```

### `POST /woki/settings/restaurants`

Registers a new restaurant. When `sectors` is omitted a default `*-sector-main` entry is created automatically.

Body:
```json
{
  "id": "resto-2",
  "name": "WokiBrain Downtown",
  "timezone": "America/Buenos_Aires",
  "defaultWindow": { "startTime": "10:00", "endTime": "23:00" },
  "sectors": [
    { "id": "resto-2-sector-main", "name": "Main Dining" }
  ],
  "serviceWindows": [
    { "day": 0, "windows": [{ "startTime": "09:00", "endTime": "21:00" }] },
    { "day": 5, "windows": [{ "startTime": "09:00", "endTime": "01:00" }] }
  ]
}
```

Response mirrors the catalog payload so clients can refresh their selectors.

If you prefer a single schedule for every day, pass `defaultWindow` only. `serviceWindows` entries override specific weekdays using `day` indexes (`0` = Sunday ... `6` = Saturday).

### `POST /woki/settings/tables`

Adds a table to an existing sector. `combinableWith` will also append the new table ID to the referenced seats.

Body:
```json
{
  "id": "table-10",
  "restaurantId": "resto-1",
  "sectorId": "sector-main",
  "label": "T10",
  "minCapacity": 2,
  "maxCapacity": 4,
  "combinableWith": ["table-2", "table-3"]
}
```

Response returns the refreshed catalog snapshot.

### `GET /woki/settings/strategy`

Returns the active capacity strategy and the list of available options.

```json
{
  "current": {
    "key": "simple",
    "label": "Simple Sum",
    "description": "Adds each table’s min/max seats and fits the party in the combined range."
  },
  "available": [
    { "key": "simple", "label": "Simple Sum", "description": "…" },
    { "key": "conservative", "label": "Conservative Merge", "description": "…" },
    { "key": "maxofmins", "label": "Max of Minimums", "description": "…" }
  ]
}
```

### `PUT /woki/settings/strategy`

Body:
```json
{ "key": "conservative" }
```

Immediately switches the heuristic used by discovery, booking creation, and repack operations. The response mirrors the `GET` payload so UIs can refresh their selectors.

### `POST /woki/settings/reset`

Resets the in-memory store (bookings, waitlist, blackouts, locks, idempotency cache) and reapplies the demo seed dataset.

Response:
```json
{
  "message": "In-memory caches cleared and demo dataset restored.",
  "seededRestaurants": 1,
  "seededSectors": 1,
  "seededTables": 3,
  "timestamp": "2025-06-01T12:00:00.000Z"
}
```

Use this during demos or testing sessions to guarantee a consistent baseline.

## Error Handling

- Validation errors emit `422` with message arrays.
- Rate limit exceeded returns `429` with `Retry-After`.
- Missing approvals result in `403`.
- Not-found resources return `404`.

Errors follow the JSON structure:
```json
{
  "statusCode": 409,
  "timestamp": "2025-10-28T12:00:00.000Z",
  "path": "/woki/bookings",
  "message": "No capacity available for requested slot"
}
```
