import { describe, expect, it } from "vitest";
import {
  RunQuarterlySelection,
  type RunQuarterlySelectionInput,
  type RunQuarterlySelectionResult,
} from "../../src/application/run-quarterly-selection.js";
import { DomainError, QuarterNotOpenForDrawError } from "../../src/domain/errors.js";
import { verifyRun } from "../../src/domain/selection-run.js";
import { InMemorySelectionRunRepository } from "../../src/infrastructure/in-memory-selection-run-repository.js";
import { testSeed, vehicleIds } from "../support/fixtures.js";
import { CountingSeedGenerator, FakeClock, SlowFindRepository } from "../support/fakes.js";

const Q4_2026 = "2026-10-17T09:00:00Z";
const Q1_2027 = "2027-01-15T09:00:00Z";

interface Setup {
  useCase: RunQuarterlySelection;
  repository: InMemorySelectionRunRepository;
  clock: FakeClock;
  seeds: CountingSeedGenerator;
}

function setup(): Setup {
  const repository = new InMemorySelectionRunRepository();
  const clock = new FakeClock(Q4_2026);
  const seeds = new CountingSeedGenerator();
  const useCase = new RunQuarterlySelection({
    repository,
    seedGenerator: seeds.next,
    clock: clock.now,
  });
  return { useCase, repository, clock, seeds };
}

function request(overrides: Partial<RunQuarterlySelectionInput> = {}): RunQuarterlySelectionInput {
  return {
    tenantId: "tenant-a",
    year: 2026,
    quarter: 4,
    percentage: 25,
    activeVehicleIds: vehicleIds(20),
    ...overrides,
  };
}

describe("RunQuarterlySelection", () => {
  it("draws and stores a run on the first call", async () => {
    const { useCase, repository, seeds } = setup();

    const result: RunQuarterlySelectionResult = await useCase.execute(request());

    expect(result.reused).toBe(false);
    expect(result.run.tenantId).toBe("tenant-a");
    expect(result.run.quarter.toString()).toBe("2026-Q4");
    expect(result.run.percentage).toBe(25);
    expect(result.run.seed).toBe(testSeed("seed-1"));
    expect(result.run.createdAt).toEqual(new Date(Q4_2026));
    expect(result.run.pickedVehicleIds).toHaveLength(5);
    expect(verifyRun(result.run)).toBe(true);
    expect(repository.size).toBe(1);
    expect(seeds.calls).toBe(1);
  });

  it("returns the stored run on a rerun without drawing again", async () => {
    const { useCase, repository, seeds } = setup();
    const first: RunQuarterlySelectionResult = await useCase.execute(request());

    const second: RunQuarterlySelectionResult = await useCase.execute(request());

    expect(second.reused).toBe(true);
    expect(second.run).toBe(first.run);
    expect(repository.size).toBe(1);
    expect(seeds.calls).toBe(1);
  });

  it("returns the original run when the vehicle list and percentage change before a rerun", async () => {
    const { useCase } = setup();
    const first: RunQuarterlySelectionResult = await useCase.execute(request());
    const changedFleet: string[] = [...vehicleIds(30)].slice(5);

    const second: RunQuarterlySelectionResult = await useCase.execute(
      request({ activeVehicleIds: changedFleet, percentage: 50 }),
    );

    expect(second.reused).toBe(true);
    expect(second.run).toBe(first.run);
    expect(second.run.pickedVehicleIds).toEqual(first.run.pickedVehicleIds);
  });

  it("draws a new quarter with a new seed and keeps last quarter's picks eligible", async () => {
    const { useCase, repository, clock } = setup();
    const q4: RunQuarterlySelectionResult = await useCase.execute(request());
    clock.set(Q1_2027);

    const q1: RunQuarterlySelectionResult = await useCase.execute(
      request({ year: 2027, quarter: 1, percentage: 100 }),
    );

    expect(q1.reused).toBe(false);
    expect(q1.run.seed).not.toBe(q4.run.seed);
    expect(q1.run.pickedVehicleIds).toEqual(expect.arrayContaining([...q4.run.pickedVehicleIds]));
    expect(repository.size).toBe(2);
  });

  it("keeps tenants apart in the same quarter", async () => {
    const { useCase, repository } = setup();

    const a: RunQuarterlySelectionResult = await useCase.execute(request({ tenantId: "tenant-a" }));
    const b: RunQuarterlySelectionResult = await useCase.execute(request({ tenantId: "tenant-b" }));

    expect(b.reused).toBe(false);
    expect(b.run.seed).not.toBe(a.run.seed);
    expect((await repository.find("tenant-b", b.run.quarter))?.tenantId).toBe("tenant-b");
    expect(repository.size).toBe(2);
  });

  it("gives concurrent calls for the same quarter one shared run", async () => {
    const repository = new SlowFindRepository();
    const seeds = new CountingSeedGenerator();
    const clock = new FakeClock(Q4_2026);
    const useCase = new RunQuarterlySelection({
      repository,
      seedGenerator: seeds.next,
      clock: clock.now,
    });

    const [a, b] = await Promise.all([useCase.execute(request()), useCase.execute(request())]);

    // Both calls passed find() before either saved, so both drew; saveIfAbsent kept only the first.
    expect(seeds.calls).toBe(2);
    expect(b.run).toBe(a.run);
    expect([a.reused, b.reused].sort()).toEqual([false, true]);
    expect(repository.inner.size).toBe(1);
  });

  it("returns a past quarter's stored run, even with an empty vehicle list", async () => {
    const { useCase, clock } = setup();
    const q4: RunQuarterlySelectionResult = await useCase.execute(request());
    clock.set(Q1_2027);

    const rerun: RunQuarterlySelectionResult = await useCase.execute(
      request({ activeVehicleIds: [] }),
    );

    expect(rerun.reused).toBe(true);
    expect(rerun.run).toBe(q4.run);
  });

  it("refuses to draw a past quarter that has no run", async () => {
    const { useCase, repository, seeds } = setup();

    await expect(useCase.execute(request({ quarter: 3 }))).rejects.toThrow(
      QuarterNotOpenForDrawError,
    );
    expect(repository.size).toBe(0);
    expect(seeds.calls).toBe(0);
  });

  it.each<[string, Partial<RunQuarterlySelectionInput>]>([
    ["a blank tenant", { tenantId: " " }],
    ["a future quarter", { year: 2027 }],
    ["quarter 5", { quarter: 5 }],
    ["0 percent", { percentage: 0 }],
    ["12.5 percent", { percentage: 12.5 }],
    ["3 vehicles", { activeVehicleIds: vehicleIds(3) }],
    ["no vehicles", { activeVehicleIds: [] }],
    ["a duplicate vehicle", { activeVehicleIds: [...vehicleIds(10), "V0001"] }],
  ])(
    "rejects %s and stores nothing",
    async (_case: string, overrides: Partial<RunQuarterlySelectionInput>) => {
      const { useCase, repository } = setup();

      await expect(useCase.execute(request(overrides))).rejects.toThrow(DomainError);
      expect(repository.size).toBe(0);
    },
  );

  it("still rejects an invalid percentage on a rerun", async () => {
    const { useCase } = setup();
    await useCase.execute(request());

    await expect(useCase.execute(request({ percentage: 0 }))).rejects.toThrow(DomainError);
  });
});
