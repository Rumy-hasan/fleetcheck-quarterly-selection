import { describe, expect, it } from "vitest";
import { parseArgs, UsageError, type CliOptions } from "../src/cli-args.js";

describe("parseArgs", () => {
  it("uses the defaults when no options are given", () => {
    const options: CliOptions = parseArgs([]);

    expect(options).toEqual({ vehicles: 20, percentage: 25, tenant: "tenant-a" });
  });

  it("reads every option in any order", () => {
    const options: CliOptions = parseArgs([
      "--tenant",
      "acme",
      "--vehicles",
      "200000",
      "--percentage",
      "10",
    ]);

    expect(options).toEqual({ vehicles: 200_000, percentage: 10, tenant: "acme" });
  });

  it("passes numbers through unchecked so the domain reports business-rule errors", () => {
    const options: CliOptions = parseArgs(["--vehicles", "3", "--percentage", "12.5"]);

    expect(options).toMatchObject({ vehicles: 3, percentage: 12.5 });
  });

  it.each<[string, string[]]>([
    ["an unknown option", ["--colour", "red"]],
    ["a missing value", ["--vehicles"]],
    ["a flag where a value belongs", ["--vehicles", "--percentage", "10"]],
    ["a value that is not a number", ["--vehicles", "abc"]],
    ["an empty number", ["--percentage", " "]],
  ])("rejects %s with a usage error", (_case: string, argv: string[]) => {
    expect(() => parseArgs(argv)).toThrow(UsageError);
  });
});
