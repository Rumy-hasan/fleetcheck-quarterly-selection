import { AuditQuarterlySelection } from "./application/audit-quarterly-selection.js";
import { RunQuarterlySelection } from "./application/run-quarterly-selection.js";
import { parseArgs, USAGE, UsageError } from "./cli-args.js";
import { DomainError } from "./domain/errors.js";
import { Percentage } from "./domain/percentage.js";
import { pickCount } from "./domain/pick-count.js";
import { Quarter } from "./domain/quarter.js";
import { cryptoSeedGenerator } from "./infrastructure/crypto-seed-generator.js";
import { InMemorySelectionRunRepository } from "./infrastructure/in-memory-selection-run-repository.js";

async function timed<T>(work: () => Promise<T>): Promise<{ result: T; ms: string }> {
  const start = performance.now();
  const result = await work();
  return { result, ms: (performance.now() - start).toFixed(1) };
}

async function main(): Promise<void> {
  const { vehicles, percentage, tenant } = parseArgs(process.argv.slice(2));
  // Validate first, so e.g. --vehicles 1e9 fails fast instead of building a huge list.
  pickCount(vehicles, Percentage.of(percentage));

  const clock = (): Date => new Date();
  const repository = new InMemorySelectionRunRepository();
  const draw = new RunQuarterlySelection({ repository, seedGenerator: cryptoSeedGenerator, clock });
  const audit = new AuditQuarterlySelection({ repository, clock });
  const quarter = Quarter.current(clock());
  const ids = Array.from({ length: vehicles }, (_, i) => `V${String(i + 1).padStart(6, "0")}`);
  const key = { tenantId: tenant, year: quarter.year, quarter: quarter.quarter };
  const input = { ...key, percentage, activeVehicleIds: ids };

  const first = await timed(() => draw.execute(input));
  const second = await timed(() => draw.execute(input));
  const { verified } = await audit.execute(key);
  const picks = first.result.run.pickedVehicleIds;
  const shown = ids.length <= 50 ? picks.join(", ") : `${picks.slice(0, 5).join(", ")}, …`;

  console.info(
    `${tenant}, ${quarter.toString()}: ${String(ids.length)} vehicles at ${String(percentage)}%`,
  );
  console.info(`call 1: reused=${String(first.result.reused)}, ${first.ms} ms`);
  console.info(`call 2: reused=${String(second.result.reused)}, ${second.ms} ms`);
  console.info(`picked ${String(picks.length)}: ${shown}`);
  console.info(
    `identical picks: ${String(picks.join() === second.result.run.pickedVehicleIds.join())}`,
  );
  console.info(`seed (stored for auditors): ${first.result.run.seed}`);
  console.info(`audit verified: ${String(verified)}`);
}

try {
  await main();
} catch (error: unknown) {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n${USAGE}`);
    process.exitCode = 2;
  } else if (error instanceof DomainError) {
    console.error(`${error.name}: ${error.message}`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
