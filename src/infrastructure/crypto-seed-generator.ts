import { randomBytes } from "node:crypto";
import type { SeedGenerator } from "../application/ports.js";

// 32 bytes from the OS CSPRNG: unpredictable, so no company can foresee its picks (CLAUDE.md decision 6).
export const cryptoSeedGenerator: SeedGenerator = () => randomBytes(32).toString("hex");
