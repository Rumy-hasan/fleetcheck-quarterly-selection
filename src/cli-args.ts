export interface CliOptions {
  vehicles: number;
  percentage: number;
  tenant: string;
}

export const USAGE = "usage: npm run demo -- [--vehicles <n>] [--percentage <p>] [--tenant <id>]";

// Thrown for malformed command lines; business rules (e.g. 3 vehicles) are left to the domain.
export class UsageError extends Error {}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { vehicles: 20, percentage: 25, tenant: "tenant-a" };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new UsageError(`missing value for ${flag}`);
    }
    switch (flag) {
      case "--vehicles":
        options.vehicles = toNumber(flag, value);
        break;
      case "--percentage":
        options.percentage = toNumber(flag, value);
        break;
      case "--tenant":
        options.tenant = value;
        break;
      default:
        throw new UsageError(`unknown option ${flag}`);
    }
  }
  return options;
}

function toNumber(flag: string, value: string): number {
  const parsed = Number(value);
  if (value.trim() === "" || Number.isNaN(parsed)) {
    throw new UsageError(`${flag} must be a number, got ${value}`);
  }
  return parsed;
}
