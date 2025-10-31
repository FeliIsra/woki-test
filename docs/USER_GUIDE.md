# WokiBrain User Guide

This document explains the restaurant booking flow in plain language so anyone can try the system without technical knowledge.

> All the examples refer to the sample restaurant that ships with the project:
>
> * Restaurant: `resto-1`
> * Sector: `sector-main`
> * Example date: `2025-06-01`

## 1. Finding a Table (Availability)

1. Open `http://localhost:4000/docs`.
2. Go to **GET /woki/discover**.
3. Fill these values:
   - `restaurantId`: `resto-1`
   - `sectorId`: `sector-main`
   - `partySize`: `4`
   - `date`: `2025-06-01`
4. Press **Execute**.  
   → The system suggests the earliest start/end time and lists the tables that fit.

## 2. Creating a Booking

1. Move to **POST /woki/bookings**.
2. Use this JSON in the body (update the `start` value if you want to match the discovery step):
   ```json
   {
     "restaurantId": "resto-1",
     "sectorId": "sector-main",
     "partySize": 4,
     "start": "2025-06-01T12:00:00.000Z",
     "customerName": "Alex Johnson",
     "notes": "Window table if possible"
   }
   ```
3. Press **Execute**.  
   → You’ll receive the booking information (ID, tables, status).

> **Tip:** set a header `Idempotency-Key` (any unique string) if you might submit the form twice; the server will return the same booking instead of duplicating it.

## 3. Listing All Bookings for the Day

1. Open **GET /woki/bookings/day**.
2. Fill:
   - `restaurantId`: `resto-1`
   - `sectorId`: `sector-main`
   - `date`: `2025-06-01`
3. Execute to view the schedule for that day. Set `includeCancelled=true` if you want to see cancellations as well.

## 4. Handling Large Parties (Approval Flow)

Any booking with party size ≥ 8 enters a “pending approval” status.

1. Create a booking with `"partySize": 8`.
2. The response status will be `PENDING`.
3. To approve it, go to **PUT /woki/bookings/{id}/approve** with:
   ```json
   {
     "approver": "Floor manager"
   }
   ```
4. After approval, the booking status becomes `CONFIRMED`.

## 5. Cancelling a Booking

1. Use **DELETE /woki/bookings/{id}** (replace `{id}` with the booking ID from the creation step).
2. HTTP status 204 means it worked and the slot is freed.

## 6. Waitlist Management

When there’s no space, guests can join a waitlist.

### Add Someone to the Waitlist

- **POST /woki/waitlist** body:
  ```json
  {
    "restaurantId": "resto-1",
    "sectorId": "sector-main",
    "partySize": 2,
    "customerName": "Jamie Doe",
    "desiredTime": "2025-06-01T12:30:00.000Z"
  }
  ```

### View Current Waitlist

- **GET /woki/waitlist**
  - `restaurantId`: `resto-1`
  - `sectorId`: `sector-main`

Whenever a booking is cancelled or the repack operation frees a better slot, the waitlist service automatically tries to promote waiting guests to confirmed reservations.

## 7. Repacking Bookings

This rearranges confirmed bookings to use smaller tables when possible (reducing empty seats).

- **POST /woki/bookings/repack** body:
  ```json
  {
    "restaurantId": "resto-1",
    "sectorId": "sector-main",
    "date": "2025-06-01"
  }
  ```
- The response indicates how many bookings were moved.

## 8. Metrics Dashboard

Visit **GET /metrics** to see Prometheus-formatted counters:

- Total bookings created/cancelled.
- Number of conflicts (when two guests requested the same slot).
- Lock contention (how often the system waited for a table to free up).
- Assignment time percentiles (how fast it finds a table).

You can monitor these values in dashboards or simply inspect them as text.

## 9. Complete Demo Script (Optional)

If you prefer to run everything automatically, there is a helper script:

```bash
bash scripts/demo-flow.sh
```

It sequentially:

1. Discovers availability.
2. Creates bookings (including a large party).
3. Approves pending reservations.
4. Manages the waitlist.
5. Cancels and repacks.
6. Prints metrics at the end.

Make sure the server is running on `http://localhost:4000` before executing the script.

---

**Enjoy experimenting with WokiBrain!** You can tweak party sizes, desired times, or add extra notes without worrying about breaking anything—the in-memory store resets whenever the app restarts. If you need to clear data manually, restart the server or run the `resetSeedData` helper in tests. 
