# fleetcheck-quarterly-selection

Part 4, Option A of the Audacity engineering case study: a quarterly random vehicle selection that is fair,
reproducible by an auditor, and never drawn twice. TypeScript, no runtime dependencies.

> Input: a company's active vehicles, a percentage (for example 25%) and the quarter. Every eligible vehicle
> has an equal chance. An auditor can reproduce the result later from the same inputs. A vehicle picked last
> quarter is still eligible. Running it twice for the same company and quarter must not produce a second,
> different selection. It works for 20 vehicles and for 200,000.

Every business rule, with its reasoning and rejected alternatives, is in [docs/decisions.md](docs/decisions.md).

## How to run

Requires Node **24.22.0** (pinned in `.nvmrc`).

```sh
nvm use
npm ci
npm test                              # 134 tests
npm run test:coverage                 # same, with a coverage report
npm run lint && npm run format:check && npm run typecheck && npm run build
npm run demo                          # 20 vehicles at 25%
npm run demo -- --vehicles 200000     # options: --vehicles <n> --percentage <p> --tenant <id>
```

`npm run demo` draws the current quarter twice, then audits the stored run:

```
tenant-a, 2026-Q4: 20 vehicles at 25%
call 1: reused=false, 0.5 ms
call 2: reused=true, 0.3 ms
picked 5: V000003, V000004, V000007, V000013, V000020
identical picks: true
seed (stored for auditors): e904f938dc3c62c81bc753512aa7519bb9c3ce028a26115f15587fdb869d678f
audit verified: true
```

Invalid input prints one line and exits non-zero, e.g. `--vehicles 3` →
`InvalidVehicleCountError: vehicle count must be an integer from 4 to 200000, got 3`.

## How it works

1. **Score every vehicle.** `score = HMAC-SHA256(key = seed, message = vehicleId)`, as hex. The seed is 32
   random bytes, written as 64 hex characters, created once at draw time and stored with the run.
2. **Pick the k lowest scores.** `k = max(1, round-half-up(n × p / 100))`. Ties (practically impossible)
   break by vehicle id. The picks are returned sorted by id.
3. **Store the run:** tenant, quarter, percentage, seed, algorithm version, the full eligible list and the
   picks.

Example: 5 vehicles at 40% gives k = 2, with seed `75185924…efd6a4`:

| Vehicle  | Score (first 12 hex) | Picked |
| -------- | -------------------- | ------ |
| VAN-02   | `362dbf097918`       | yes    |
| VAN-01   | `492ca74dfad4`       | yes    |
| BUS-01   | `6c7f4f5d600e`       |        |
| TRUCK-02 | `e86bffe5c46c`       |        |
| TRUCK-01 | `ffd594ae74c4`       |        |

**Why it is fair.** With a secret random key, each score behaves like an independent uniform random number,
so every set of k vehicles is equally likely. A fixed count k (not "each vehicle with probability p") also
gives the auditor an exact number to expect. A fairness test over 2,000 fixed seeds picks each of 10
vehicles 577 to 631 times against 600 expected.

**Why the seed is random and stored.** A seed derived from public values (tenant + quarter) would let a
company predict its own picks. A stored seed makes the draw reproducible later.

**Why reruns never change the result.** A second call for the same company and quarter returns the stored
run (`reused: true`) instead of drawing again. Concurrent calls are safe because the repository saves with
an atomic `saveIfAbsent`. Only the current quarter can be drawn; a past quarter is read-only.

**How an auditor reproduces a result.** `AuditQuarterlySelection` loads the stored run and calls
`verifyRun`, which recomputes the picks and answers true or false. Without this code, the stored seed,
percentage and eligible ids are enough:

```sh
node -e 'const{createHmac}=require("node:crypto");const[seed,p,...ids]=process.argv.slice(1);const k=Math.max(1,Math.floor((ids.length*p+50)/100));const score=id=>createHmac("sha256",seed).update(id).digest("hex");console.log(ids.map(id=>[score(id),id]).sort().slice(0,k).map(([,id])=>id).sort())' \
  75185924a753a7e2a4fc6db49c2d946fb940ad380a1456272773210642efd6a4 40 TRUCK-01 TRUCK-02 VAN-01 VAN-02 BUS-01
# [ 'VAN-01', 'VAN-02' ]
```

## Time and space complexity

- **Time: O(n log n).** One HMAC per vehicle is O(n); one sort of n scores is O(n log n); sorting the k picks
  is O(k log k). Any fair selection must look at every vehicle, so Ω(n) is the floor.
- **Space: O(n)** for the scores. The stored run also keeps the n eligible ids, which the audit trail needs.
- A bounded heap (O(n log k)) or quickselect (O(n) average) was not used: hashing is most of the cost, and
  the full sort is shorter and easier to verify ([D8](docs/decisions.md#d8-full-sort-instead-of-a-heap-or-quickselect)).

Measured on an Apple M2 (24 GB), Node 24.22.0, 200,000 vehicles at 25%:

| Run                                   | Time                   |
| ------------------------------------- | ---------------------- |
| `selectVehicles` (scale test, 3 runs) | 483 ms, 479 ms, 469 ms |
| `npm run demo -- --vehicles 200000`   | 421.8 ms; rerun 0.0 ms |

The scale test fails above 5,000 ms, so a performance regression breaks CI
([D14](docs/decisions.md#d14-the-scale-test-asserts-a-generous-time-bound)).

## Edge case the brief does not mention

**The fleet changes between the first run and a rerun.** A vehicle is added or deactivated after the draw.
Re-running the algorithm on the new list would give a different selection, which is exactly what the brief
forbids. So idempotency comes from the stored run, not from re-running the algorithm: the second call returns
the original picks, whatever list or percentage it is given. Covered by
`returns the original run when the vehicle list and percentage change before a rerun` in
[tests/application/run-quarterly-selection.test.ts](tests/application/run-quarterly-selection.test.ts).

Also considered:

- **Concurrent runs.** Two calls at the same moment both see "no run yet". `saveIfAbsent` keeps the first,
  and both callers get the same run. A test forces the race, and it fails if `saveIfAbsent` is replaced by a
  plain save.
- **A missed quarter.** Only the current quarter can be drawn, so a quarter without a run stays visible as
  missed instead of being drawn late ([D12](docs/decisions.md#d12-only-the-current-quarter-can-be-drawn)).
- **Rounding.** Round half up with a minimum of 1: 4 vehicles at 1% still picks one
  ([D5](docs/decisions.md#d5-pick-count-rounds-half-up-with-a-minimum-of-1)).
- **Input limits.** Whole percentages 1-100 and fleets of 4-200,000; empty or duplicate vehicle ids and
  malformed seeds are rejected before anything is stored.

## Design and limits

```
src/
  domain/          pure rules: Quarter, Percentage, pickCount, selectVehicles, SelectionRun, verifyRun
  application/     use cases (draw or reuse; read-only audit) and ports (repository, seed generator, clock)
  infrastructure/  in-memory repository, crypto seed generator
  cli.ts           demo: the composition root that wires real adapters into the use cases
```

The domain imports nothing else and never reads the clock or randomness; both are injected. ESLint enforces
these rules.

- **Storage.** Only an in-memory repository is included. In PostgreSQL this maps to the Part 2 tables
  `selection_runs` (unique on `tenant_id, year, quarter`) and `selection_run_vehicles` (the frozen list with
  a `picked` flag). See [docs/schema.sql](docs/schema.sql), documentation only. There, `saveIfAbsent` is
  `INSERT … ON CONFLICT (tenant_id, year, quarter) DO NOTHING` followed by a `SELECT`.
- **Fleet size.** The Part 1 assumption is up to 10,000 vehicles per company at launch; the selection is
  built and tested for the brief's 200,000.
- **Auditing proves consistency, not authenticity.** `verifyRun` checks that the stored picks follow from the
  stored inputs. It cannot tell whether those inputs were edited afterwards: removing a vehicle that was not
  picked can leave the picks unchanged. Protection against edits (append-only permissions as in
  `schema.sql`, an audit log, a hash kept elsewhere) is production work
  ([D9](docs/decisions.md#d9-verifyrun-answers-yes-or-no)).
- **CI.** GitHub Actions runs `npm ci`, lint, format check, typecheck, tests with coverage and build on every
  pull request and on `main`, which requires it to pass. There is no deploy step: this is a library, so a
  release is a Git tag. Coverage is reported, not gated; `src/cli.ts` is excluded because it is checked by
  running the demo.

## AI assistance

Built with Claude Code (Claude Opus 5.5) in small, reviewed steps: the AI proposed each plan and wrote code
and tests, and I reviewed every change before it was committed. I made the business decisions recorded in
`docs/decisions.md`, for example whole percentages, round half up, the 20-year window and drawing only in the
current quarter. Every number in this README comes from a real run, and the known-answer test was checked
against an independent `node -e` script.
