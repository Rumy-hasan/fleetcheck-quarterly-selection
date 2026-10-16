import { describe, expect, it } from "vitest";

// Removed in T1 once real tests exist; keeps CI green on an empty scaffold.
describe("scaffold", () => {
  it("runs the test suite", () => {
    const sum: number = 1 + 1;

    expect(sum).toBe(2);
  });
});
