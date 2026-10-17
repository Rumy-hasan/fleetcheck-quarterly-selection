import { describe, expect, it } from "vitest";
import { Percentage } from "../../src/domain/percentage.js";
import { Quarter } from "../../src/domain/quarter.js";
import { createSelectionRun, type SelectionRun } from "../../src/domain/selection-run.js";
import { InMemorySelectionRunRepository } from "../../src/infrastructure/in-memory-selection-run-repository.js";
import { testSeed, vehicleIds } from "../support/fixtures.js";

const NOW: Date = new Date("2026-10-17T09:00:00Z");

function run(tenantId: string, quarter: number, seedLabel: string): SelectionRun {
  return createSelectionRun({
    tenantId,
    quarter: Quarter.of(2026, quarter, NOW),
    percentage: Percentage.of(25),
    seed: testSeed(seedLabel),
    eligibleVehicleIds: vehicleIds(8),
    createdAt: NOW,
  });
}

describe("InMemorySelectionRunRepository", () => {
  it("finds nothing for a tenant and quarter that were never saved", async () => {
    const repository = new InMemorySelectionRunRepository();

    expect(await repository.find("tenant-a", Quarter.of(2026, 4, NOW))).toBeUndefined();
  });

  it("stores the first run and reports it as created", async () => {
    const repository = new InMemorySelectionRunRepository();
    const first: SelectionRun = run("tenant-a", 4, "first");

    const saved = await repository.saveIfAbsent(first);

    expect(saved).toEqual({ run: first, created: true });
    expect(await repository.find("tenant-a", Quarter.of(2026, 4, NOW))).toBe(first);
  });

  it("keeps the first run when a second one arrives for the same tenant and quarter", async () => {
    const repository = new InMemorySelectionRunRepository();
    const first: SelectionRun = run("tenant-a", 4, "first");
    await repository.saveIfAbsent(first);

    const saved = await repository.saveIfAbsent(run("tenant-a", 4, "second"));

    expect(saved).toEqual({ run: first, created: false });
    expect(repository.size).toBe(1);
  });

  it("keeps different tenants and quarters apart", async () => {
    const repository = new InMemorySelectionRunRepository();
    const runs: SelectionRun[] = [run("a", 4, "1"), run("a|b", 4, "2"), run("a", 3, "3")];

    for (const r of runs) await repository.saveIfAbsent(r);

    expect(repository.size).toBe(3);
    for (const r of runs) expect(await repository.find(r.tenantId, r.quarter)).toBe(r);
  });
});
