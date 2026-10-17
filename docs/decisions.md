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

## D6. The HMAC key is the seed's hex string

- **Date:** 2026-10-17
- **Decision:** `score = createHmac("sha256", seed).update(vehicleId).digest("hex")`, where `seed` is the
  64-character hex string as stored, used as UTF-8 key bytes. The vehicle id is hashed as UTF-8.
- **Why:** An auditor can reproduce any score with one `node -e` line, copying the stored seed as is.
  Security is the same: the key still carries the 256 random bits.
- **Rejected:** Decoding the hex to 32 raw bytes (`Buffer.from(seed, "hex")`): one more step an auditor can
  get wrong, with no security gain.

## D7. Reject malformed seeds and empty vehicle ids

- **Date:** 2026-10-17
- **Decision:** The seed must be exactly 64 lowercase hex characters (`InvalidSeedError`). A vehicle id must
  not be empty or whitespace only (`InvalidVehicleIdError`).
- **Why:** An empty or short seed makes the picks predictable. One canonical seed form avoids an auditor
  using `"ABC…"` where `"abc…"` was stored, which would give different picks. An empty id is a data error.
- **Rejected:** Non-empty seed only (accepts weak seeds such as `"a"`).

## D8. Full sort instead of a heap or quickselect

- **Date:** 2026-10-17
- **Decision:** Hash every vehicle once, sort all scores, take the first `k`: O(n log n) time, O(n) space.
- **Why:** Any fair selection must look at every vehicle, so Ω(n) is the floor. Hashing dominates: on an
  Apple M2 with 200,000 vehicles, hashing took about 250-310 ms and sorting about 90-120 ms (throwaway
  benchmark, 3 runs). A full sort is short, obviously correct and easy to change live.
- **Rejected:** Bounded max-heap, O(n log k): no real gain, because `k` can be as large as `n`. Quickselect,
  O(n) on average: saves at most about 0.1 s, but in-place partitioning is easy to get subtly wrong.

## D9. verifyRun answers yes or no

- **Date:** 2026-10-17
- **Decision:** `verifyRun(run)` recomputes the picks from the stored eligible ids, percentage and seed and
  returns `true` only if they equal the stored picks. Stored data that breaks a rule (for example an edited
  seed) returns `false`. An unknown `algorithmVersion` throws `UnsupportedAlgorithmVersionError`.
- **Why:** An auditor needs a plain answer. Only an unknown version is a real "cannot judge" case.
  `verifyRun` does not re-check the quarter window, so a run stays verifiable after it ages out.
- **Rejected:** Letting validation errors propagate (the auditor would handle errors and `false`).
- **Note:** `verifyRun` re-applies today's rules (fleet limits, rounding). If any of them change, bump
  `ALGORITHM_VERSION`, or old runs would stop verifying.
- **Known limit:** `verifyRun` proves the picks follow from the stored inputs, not that the stored inputs are
  the originals. Removing a vehicle that was not picked can leave the picks unchanged, so the run still
  verifies. Detecting edits to a stored run is an integrity concern (append-only audit log, a hash or signature
  kept elsewhere, no-update database permissions) and belongs to the production design, not this exercise.
- **Rejected for now:** Storing a digest of the eligible ids inside the run. Anyone who can edit the row can
  recompute the digest, so it only catches accidental changes.

## D10. Reject an empty tenant id

- **Date:** 2026-10-17
- **Decision:** `createSelectionRun` rejects an empty or whitespace-only tenant id (`InvalidTenantIdError`).
- **Why:** `(tenantId, year, quarter)` is the idempotency key; a blank tenant would make it meaningless.
  Same rule as vehicle ids (D7).
- **Rejected:** Accepting any string.
