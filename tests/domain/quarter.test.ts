import { describe, expect, it } from "vitest";
import { DomainError, InvalidQuarterError } from "../../src/domain/errors.js";
import { Quarter } from "../../src/domain/quarter.js";

// 15 May 2026 is in Q2 2026; the 20-year window therefore starts at 2007-Q1.
const NOW: Date = new Date("2026-05-15T12:00:00Z");

function attempt(year: number, quarter: number): unknown {
  try {
    Quarter.of(year, quarter, NOW);
    return undefined;
  } catch (error: unknown) {
    return error;
  }
}

describe("Quarter.of", () => {
  it.each([
    [2026, 1],
    [2026, 2],
    [2025, 4],
    [2007, 1],
  ])("accepts %i-Q%i", (year: number, quarter: number) => {
    const result: Quarter = Quarter.of(year, quarter, NOW);

    expect(result.year).toBe(year);
    expect(result.quarter).toBe(quarter);
  });

  it.each([0, 5, 1.5, Number.NaN])("rejects quarter %s", (quarter: number) => {
    expect(() => Quarter.of(2026, quarter, NOW)).toThrow(InvalidQuarterError);
  });

  it.each([2026.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-integer year %s",
    (year: number) => {
      expect(() => Quarter.of(year, 1, NOW)).toThrow(InvalidQuarterError);
    },
  );

  it("rejects a year older than the 20-year window", () => {
    expect(() => Quarter.of(2006, 4, NOW)).toThrow("year must be 2007 or later, got 2006");
  });

  it.each([
    [2026, 3],
    [2026, 4],
    [2027, 1],
  ])("rejects future quarter %i-Q%i", (year: number, quarter: number) => {
    expect(() => Quarter.of(year, quarter, NOW)).toThrow("is in the future");
  });

  it("uses UTC to decide the current quarter", () => {
    const lastMomentOfQ1: Date = new Date("2026-03-31T23:59:59.999Z");
    const firstMomentOfQ2: Date = new Date("2026-04-01T00:00:00.000Z");

    expect(() => Quarter.of(2026, 2, lastMomentOfQ1)).toThrow(InvalidQuarterError);
    expect(Quarter.of(2026, 2, firstMomentOfQ2).quarter).toBe(2);
  });

  it("never accepts a year below 1, even when the window would reach it", () => {
    const yearTen: Date = new Date("0010-05-15T00:00:00Z");

    expect(Quarter.of(1, 1, yearTen).year).toBe(1);
    expect(() => Quarter.of(0, 1, yearTen)).toThrow("year must be 1 or later");
  });

  it("throws errors that callers can catch as DomainError", () => {
    const error: unknown = attempt(2026, 5);

    expect(error).toBeInstanceOf(InvalidQuarterError);
    expect(error).toBeInstanceOf(DomainError);
  });
});
