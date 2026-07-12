// Fail loudly and early on misconfiguration (DATABASE_SETUP.md).
// Wired as `prestart` and into `build:postgres`.
import { loadEnvConfig } from "@next/env";
import { requireRuntimeConfig } from "../lib/runtimeConfig";

loadEnvConfig(process.cwd());
requireRuntimeConfig();
console.log("Runtime configuration is safe for this environment.");
