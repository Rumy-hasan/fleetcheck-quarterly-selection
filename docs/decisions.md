# Decision log

Business rules for the quarterly selection, why we chose them, and what we rejected.
Add a new entry when a rule changes; mark the old one as superseded instead of deleting it.

## D1. Quarter window: last 20 calendar years, no future quarters

- **Date:** 2026-10-16
- **Decision:** A quarter is valid from Q1 of `currentYear - 19` up to and including the current quarter.
  In Q2 2026 that is 2007-Q1 to 2026-Q2. Years are always 1 or later.
- **Why:** Selection runs are kept for 20 years, so older quarters cannot be drawn or audited.
  A future quarter must not be drawn early, because the fleet can still change before it starts.
- **Rejected:** A year-only check (allowed drawing Q4 in March). No range at all (accepted typos such as 2062).

## D2. Current quarter is judged in UTC and passed in

- **Date:** 2026-10-16
- **Decision:** `Quarter.of(year, quarter, now)` takes the current time as a `Date` and reads it in UTC.
- **Why:** The same input gives the same answer on any server, which an auditor needs. The domain never reads
  the clock, so tests can pin exact moments such as 31 March 23:59:59.999Z.
- **Rejected:** The client's local time zone (server-dependent results). `new Date()` inside the domain
  (untestable).

## D3. Percentage is an integer from 1 to 100

- **Date:** 2026-10-16
- **Decision:** Reject 0, negatives, decimals, `NaN` and `Infinity` with `InvalidPercentageError`.
- **Why:** Simple to explain and validate, and no floating-point edge cases (such as `0.29 * 100`).
  0% is rejected so every run inspects at least one vehicle.
- **Rejected:** Up to 2 decimals stored as basis points (more complex for no client need). 0% allowed as a
  zero-pick audit run.
- **Supersedes:** CLAUDE.md decision 4 (0-100 with 2 decimals) and decision 10 (0% stores a zero-pick run).

## D4. A company has 4 to 200,000 active vehicles

- **Date:** 2026-10-16
- **Decision:** The vehicle count must be an integer from 4 to 200,000, otherwise `InvalidVehicleCountError`.
- **Why:** The minimum of 4 is a product rule set by the author (business reason to be confirmed with the
  client). 200,000 is the largest fleet named in the brief ("works for 20 vehicles and for 200,000").
- **Rejected:** A cap below 10,000 (would reject the brief's own 200,000 example). No limits (an empty fleet
  would store a meaningless run).
- **Supersedes:** CLAUDE.md decision 10 (an empty vehicle list stores a zero-pick run).

## D5. Pick count rounds half up, with a minimum of 1

- **Date:** 2026-10-16
- **Decision:** `k = max(1, floor((n * p + 50) / 100))`, which is round-half-up of `n * p / 100`.
  Examples: 21 at 25% (5.25) → 5; 22 at 25% (5.5) → 6; 5 at 10% (0.5) → 1; 4 at 1% (0.04) → 1.
- **Why:** Closest whole number to the requested share, and every run still inspects at least one vehicle.
  Integer arithmetic only: the largest intermediate value is 200,000 × 100 = 2×10⁷, far below 2⁵³.
- **Rejected:** Ceil (always at least the share, but inspects more vehicles than asked, e.g. 21 at 25% → 6).
  Round down (can inspect fewer than the share).
- **Supersedes:** CLAUDE.md decision 3 (ceil on basis points).
