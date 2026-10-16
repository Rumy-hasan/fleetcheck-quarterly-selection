import { InvalidPercentageError } from "./errors.js";

export class Percentage {
  // Private so every Percentage in the system has passed validation in of().
  private constructor(readonly value: number) {}

  // Whole numbers only keep validation simple and avoid floating-point surprises (docs/decisions.md D3).
  static of(percent: number): Percentage {
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      throw new InvalidPercentageError(
        `percentage must be an integer from 1 to 100, got ${String(percent)}`,
      );
    }
    return new Percentage(percent);
  }
}
