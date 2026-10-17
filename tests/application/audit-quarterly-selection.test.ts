import { describe, expect, it } from "vitest";
import {
  AuditQuarterlySelection,
  type AuditQuarterlySelectionResult,
} from "../../src/application/audit-quarterly-selection.js";
import { RunQuarterlySelection } from "../../src/application/run-quarterly-selection.js";
import {
  InvalidQuarterError,
  InvalidTenantIdError,
  SelectionRunNotFoundError,
} from "../../src/domain/errors.js";
import type { SelectionRun } from "../../src/domain/selection-run.js";
import { InMemorySelectionRunRepository } from "../../src/infrastructure/in-memory-selection-run-repository.js";
import { vehicleIds } from "../support/fixtures.js";
import { CountingSeedGenerator, FakeClock } from "../support/fakes.js";

interface Setup {
  audit: AuditQuarterlySelection;
  draw: () => Promise<SelectionRun>;
  repository: InMemorySelectionRunRepository;
  clock: FakeClock;
}

function setup(): Setup {
  const repository = new InMemorySelectionRunRepository();
  const clock = new FakeClock("2026-10-17T09:00:00Z");
  const seeds = new CountingSeedGenerator();
  const runner = new RunQuarterlySelection({
    repository,
    seedGenerator: seeds.next,
    clock: clock.now,
  });
  const draw = async (): Promise<SelectionRun> => {
    const result = await runner.execute({
      tenantId: "tenant-a",
      year: 2026,
      quarter: 4,
      percentage: 25,
      activeVehicleIds: vehicleIds(20),
    });
    return result.run;
  };
  return {
    audit: new AuditQuarterlySelection({ repository, clock: clock.now }),
    draw,
    repository,
    clock,
  };
}

describe("AuditQuarterlySelection", () => {
  it("returns the stored run and confirms it verifies", async () => {
    const { audit, draw } = setup();
    const run: SelectionRun = await draw();

    const result: AuditQuarterlySelectionResult = await audit.execute({
      tenantId: "tenant-a",
      year: 2026,
      quarter: 4,
    });

    expect(result.run).toBe(run);
    expect(result.verified).toBe(true);
  });

  it("audits a past quarter after the clock has moved on", async () => {
    const { audit, draw, clock } = setup();
    await draw();
    clock.set("2027-02-01T00:00:00Z");

    const result: AuditQuarterlySelectionResult = await audit.execute({
      tenantId: "tenant-a",
      year: 2026,
      quarter: 4,
    });

    expect(result.verified).toBe(true);
  });

  it("reports verified false for a stored run whose picks were edited", async () => {
    const { audit, repository } = setup();
    // Draw in a separate store, then plant an edited copy here, as if someone changed the row.
    const honest: SelectionRun = await setup().draw();
    const edited: string[] = vehicleIds(20).filter((id) => !honest.pickedVehicleIds.includes(id));
    await repository.saveIfAbsent({ ...honest, pickedVehicleIds: edited.slice(0, 5) });

    const result: AuditQuarterlySelectionResult = await audit.execute({
      tenantId: "tenant-a",
      year: 2026,
      quarter: 4,
    });

    expect(result.verified).toBe(false);
  });

  it("throws when no run exists and never creates one", async () => {
    const { audit, repository } = setup();

    await expect(audit.execute({ tenantId: "tenant-a", year: 2025, quarter: 1 })).rejects.toThrow(
      SelectionRunNotFoundError,
    );
    expect(repository.size).toBe(0);
  });

  it("rejects a blank tenant and a future quarter before looking anything up", async () => {
    const { audit } = setup();

    await expect(audit.execute({ tenantId: "", year: 2026, quarter: 4 })).rejects.toThrow(
      InvalidTenantIdError,
    );
    await expect(audit.execute({ tenantId: "tenant-a", year: 2027, quarter: 1 })).rejects.toThrow(
      InvalidQuarterError,
    );
  });
});
