import { InvalidQuarterError } from "./errors.js";

// Selection runs are kept for 20 calendar years, including the current one.
export const RETENTION_YEARS = 20;

export class Quarter {
  // Private so every Quarter in the system has passed validation in of().
  private constructor(
    readonly year: number,
    readonly quarter: number,
  ) {}

  // The quarter that contains `now` (UTC), e.g. for a draw that should happen "this quarter".
  static current(now: Date): Quarter {
    const { currentYear, currentQuarter } = currentOf(now);
    return Quarter.of(currentYear, currentQuarter, now);
  }

  // `now` is passed in because the domain must not read the clock. UTC keeps it timezone-independent.
  static of(year: number, quarter: number, now: Date): Quarter {
    if (!Number.isInteger(year)) {
      throw new InvalidQuarterError(`year must be an integer, got ${String(year)}`);
    }
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new InvalidQuarterError(
        `quarter must be an integer from 1 to 4, got ${String(quarter)}`,
      );
    }

    const { currentYear, currentQuarter } = currentOf(now);
    const firstYear = Math.max(1, currentYear - RETENTION_YEARS + 1);

    if (year < firstYear) {
      throw new InvalidQuarterError(
        `year must be ${String(firstYear)} or later, got ${String(year)}`,
      );
    }
    // One number per quarter makes "is it in the future?" a single comparison.
    if (year * 4 + quarter > currentYear * 4 + currentQuarter) {
      throw new InvalidQuarterError(
        `${label(year, quarter)} is in the future; current quarter is ${label(currentYear, currentQuarter)}`,
      );
    }
    return new Quarter(year, quarter);
  }

  // Only the current quarter may be drawn; past quarters are read-only (docs/decisions.md D12).
  isCurrent(now: Date): boolean {
    const { currentYear, currentQuarter } = currentOf(now);
    return this.year === currentYear && this.quarter === currentQuarter;
  }

  toString(): string {
    return label(this.year, this.quarter);
  }
}

function currentOf(now: Date): { currentYear: number; currentQuarter: number } {
  return {
    currentYear: now.getUTCFullYear(),
    currentQuarter: Math.floor(now.getUTCMonth() / 3) + 1,
  };
}

function label(year: number, quarter: number): string {
  return `${String(year)}-Q${String(quarter)}`;
}
