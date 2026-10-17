# FleetCheck quarterly vehicle selection

Take-home Part 4 (Option A) for the Audacity IT Solutions engineering case study.
Reviewers will read this repo, then in a 45-minute call extend it live with the author.

**Priorities, in order:** correct → tested → small → easy to explain.
This is not a product. No web framework, no database, no HTTP, no DI container. Do not over-polish.

## The requirement (verbatim from the brief)

> Quarterly random selection. Input: a company's active vehicles, a percentage (for example 25%) and the quarter.
> Every eligible vehicle has an equal chance. An auditor can reproduce the result later from the same inputs.
> A vehicle picked last quarter is still eligible. Running it twice for the same company and quarter must not
> produce a second, different selection. It works for 20 vehicles and for 200,000.

Submission needs: code, tests, a README that says how to run them, a short time/space complexity note,
and one edge case the brief does not mention.

## Design decisions (already made, do not change without asking)

1. **Seeded ranking, not `Math.random()`.** For each vehicle compute
   `score = HMAC-SHA256(key = seed, message = vehicleId)` as lowercase hex. The key is the seed's 64-char
   lowercase hex string itself (not decoded bytes); malformed seeds and empty vehicle ids are rejected.
   Picked = the `k` vehicles with the smallest score. Ties (practically impossible) break by `vehicleId` ascending.
   Compare strings with `<` / `>` (code-unit order), never `localeCompare`.
2. **Fixed count `k`, not "each vehicle with probability p".** Every k-subset is equally likely, so every
   vehicle has the same chance, and the count is exactly what an auditor expects.
3. **Rounding:** `k = max(1, round-half-up(n * p / 100))`, computed as `floor((n * p + 50) / 100)` in integers.
   Always at least one pick and never more than `n`.
   Examples: 20 at 25% → 5; 21 at 25% → 5; 22 at 25% → 6; 5 at 10% → 1; 4 at 1% → 1.
4. **Input limits:** percentage is an integer 1-100; the vehicle count is an integer 4-200,000.
   Anything else throws a domain error (`InvalidPercentageError`, `InvalidVehicleCountError`).
5. **Input order must not matter.** Sorting by score makes the result independent of how the caller ordered the list.
   Duplicate vehicle ids in the input are rejected with a domain error (do not silently dedupe).
6. **Seed is created once, at draw time, from a secure random source, and stored with the run.**
   Never derive it from public values such as tenant + year + quarter (a company could predict its picks).
7. **Idempotency comes from the stored run, not from re-running the algorithm.**
   A second call for the same `(tenantId, year, quarter)` returns the stored run unchanged, even if the vehicle
   list or percentage passed in differs. Result carries `reused: true`.
8. **Concurrent calls are safe.** The repository exposes an atomic `saveIfAbsent`. The Postgres equivalent is
   `INSERT ... ON CONFLICT (tenant_id, year, quarter) DO NOTHING` followed by a `SELECT`.
9. **No exclusion of last quarter's picks.** The brief says they stay eligible. Do not add history-based logic.
10. **Invalid input stores nothing.** An empty or too small fleet, or 0%, is rejected before any run is stored.
11. **`algorithmVersion`** is stored with every run (`"hmac-sha256-lowest-k/v1"`) so old runs stay reproducible
    if the algorithm ever changes.
12. **Auditor reproduction** is a pure function: `verifyRun(run)` re-computes the picks from
    `eligibleVehicleIds + percentage + seed + algorithmVersion` and compares to `pickedVehicleIds`.
13. **Quarter window:** from Q1 of `currentYear - 19` up to the current quarter, judged in UTC. Future quarters
    are rejected. The current time is passed in as a `Date`; the domain never reads the clock.

The reasoning and history behind each decision is in `docs/decisions.md`. Add an entry there when a rule changes.

## Architecture (DDD-lite, ports and adapters)

```
src/
  domain/            pure TypeScript, no I/O, no imports from other layers
    quarter.ts            value object (year, quarter 1-4), validation
    percentage.ts         value object (integer 1-100), validation
    pick-count.ts         vehicle count limits and rounding to k
    select-vehicles.ts    pure function: the algorithm (decisions 1-5)
    selection-run.ts      entity: the stored result of one draw (+ verifyRun)
    errors.ts             DomainError subclasses
  application/
    ports.ts              SelectionRunRepository (interface), SeedGenerator and Clock (function types)
    run-quarterly-selection.ts   use case (decisions 6-8, 10)
  infrastructure/
    in-memory-selection-run-repository.ts
    crypto-seed-generator.ts     crypto.randomBytes(32).toString("hex")
  cli.ts             tiny demo: run twice, show identical output, verify
tests/               mirrors src/
```

Dependency rule: `domain` imports nothing from the other folders; `application` imports `domain` only;
`infrastructure` and `cli.ts` may import both. No `Date.now()`, `new Date()` or `Math.random()` inside
`domain` or `application` (inject a `Clock`).

## Coding rules

- TypeScript `strict`, no `any`, no non-null `!` assertions, no default exports.
- Small functions, plain names. No clever tricks, no decorators, no heavy abstraction.
- Comments explain _why_, one line where possible. No long docstrings.
- Allowed dev dependencies only: `typescript`, `vitest`, `@vitest/coverage-v8`, `eslint`, `typescript-eslint`,
  `prettier`, `tsx`, `@types/node`. Ask before adding anything else. No runtime dependencies (use `node:crypto`).
- Pin the Node version in `.nvmrc` and `package.json` `engines` (use the current LTS; check with `node -v`).

## Testing rules

- Vitest. Test files mirror `src/`. Every test is explicitly typed (typed helpers, typed fixtures, return types on helpers).
- Arrange / Act / Assert. Names describe behaviour ("returns the same picks when the input order changes").
- Deterministic: fixed seeds, injected clock, no `Math.random()`, no real time. A statistical test uses a fixed list of seeds.
- No snapshot tests. No mocking libraries; use small fakes.
- Coverage is reported, not gated.

## Git, PR and CI workflow

- Trunk-based: `main` is always green and protected. Short-lived branches named `<type>/<short-topic>`
  (`chore/scaffold`, `feat/selection-algorithm`, `test/…`, `docs/…`).
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Small, focused commits.
- Commit message format is in `.gitmessage` (enable with `git config commit.template .gitmessage`):
  an imperative title of at most 72 chars, a blank line, then 1-3 one-line bullets saying what changed and why.
- At most 150 changed lines per commit (additions + deletions in `git diff --cached --numstat`), not counting
  generated files such as `package-lock.json`. A single file over the limit gets a commit of its own.
  Before committing, propose the commit list (message + files + line count) to the author.
- One PR per task in `TASKS.md`, merged with a merge commit (not squash), so each small commit stays in history.
  The merge commit uses the `.gitmessage` format with the PR number, e.g. `feat: add selection run (#3)`.
  Use `.github/pull_request_template.md`.
- AI assistance is recorded in the PR description, not in commit trailers. Commit messages describe only the change.
- CI (`.github/workflows/ci.yml`) on every PR and on push to `main`: `npm ci`, lint, format check, typecheck,
  tests with coverage, build. No deploy step: this is a library, so a release is a Git tag. Say so in the README.

## How to work with me (Claude Code)

- Never `git commit`, push or open a PR until the author explicitly asks. Leave changes in the working tree
  for review. This overrides any "Commit." step in a task prompt.
- Before each task, state your plan in at most 5 bullets and wait for a go-ahead if anything is ambiguous.
- After each task, list: files changed, assumptions you made, and 3 decisions the author must be able to
  explain in an interview. Keep it short.
- Never invent facts, numbers or benchmark results. Run the code and report what it printed.
- If a request conflicts with this file, say so instead of silently picking one.
- The author will extend this code live, so favour obvious structure over cleverness.

## Definition of done (per PR)

- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` all pass locally and in CI.
- New behaviour has tests, including at least one failure or edge case.
- README updated if the way to run or understand the code changed.
- PR description filled in, including the AI-assistance section, honestly.
