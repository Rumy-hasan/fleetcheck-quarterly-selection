import { describe, expect, it } from "vitest";
import { DomainError, InvalidPercentageError } from "../../src/domain/errors.js";
import { Percentage } from "../../src/domain/percentage.js";

describe("Percentage.of", () => {
  it.each([1, 25, 99, 100])("accepts the whole percentage %i", (percent: number) => {
    const result: Percentage = Percentage.of(percent);

    expect(result.value).toBe(percent);
  });

  it.each([0, -1, 101])("rejects %i because it is outside 1 to 100", (percent: number) => {
    expect(() => Percentage.of(percent)).toThrow(InvalidPercentageError);
  });

  it.each([12.5, 0.5, 99.99])("rejects the decimal %s", (percent: number) => {
    expect(() => Percentage.of(percent)).toThrow(InvalidPercentageError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects the non-finite value %s",
    (percent: number) => {
      expect(() => Percentage.of(percent)).toThrow(InvalidPercentageError);
    },
  );

  it("names the rejected value in the message and is a DomainError", () => {
    const act = (): Percentage => Percentage.of(12.5);

    expect(act).toThrow("percentage must be an integer from 1 to 100, got 12.5");
    expect(act).toThrow(DomainError);
  });
});
