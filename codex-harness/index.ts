import { resolve } from "path";
import { readFile } from "fs/promises";
import { runHarness } from "./harness.ts";
import { DEFAULT_CONFIG } from "../shared/config.ts";
import { log, logError, logDivider } from "../shared/logger.ts";
import type { HarnessConfig } from "../shared/types.ts";

let userPrompt: string | undefined;
let skipSpecConfirmation = false;
let specPath: string | undefined;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (a === "--yes" || a === "-y") {
    skipSpecConfirmation = true;
    continue;
  }
  if (a === "--spec") {
    const pathArg = args[++i];
    if (!pathArg) {
      console.error("Error: --spec requires a path argument");
      process.exit(1);
    }
    specPath = resolve(pathArg);
    continue;
  }
  if (a === "--file" || a === "-f") {
    const filePath = args[++i];
    if (!filePath) {
      console.error("Error: --file requires a path argument");
      process.exit(1);
    }
    userPrompt = await readFile(resolve(filePath), "utf-8");
    continue;
  }
  if (userPrompt === undefined) {
    userPrompt = a;
  }
}

if (!userPrompt && !specPath) {
  console.error("Usage: bun run codex-harness/index.ts [options] <prompt>");
  console.error('       bun run codex-harness/index.ts --file <path-to-prompt.md> [options]');
  console.error('       bun run codex-harness/index.ts --spec <path-to-spec.md> [options]');
  console.error("Options:");
  console.error("  --yes, -y       Skip interactive spec review after planning (useful for scripts).");
  console.error("  --spec <path>   Skip the planner; load product spec from this file (any path).");
  console.error('Example: bun run codex-harness/index.ts "Build a task manager with REST API and dashboard"');
  process.exit(1);
}

const config: HarnessConfig = {
  ...DEFAULT_CONFIG,
  userPrompt: userPrompt ?? "",
  workDir: resolve("workspace/codex"),
  skipSpecConfirmation,
  ...(specPath !== undefined ? { specPath } : {}),
};

logDivider();
log("HARNESS", "ADVERSARIAL DEV - Codex SDK Harness");
if (specPath !== undefined) {
  log("HARNESS", `Spec file: ${specPath} (planner skipped)`);
} else {
  log("HARNESS", `Prompt: "${userPrompt}"`);
}
logDivider();

try {
  const result = await runHarness(config);

  logDivider();
  if (result.success) {
    log("HARNESS", "All sprints completed successfully!");
  } else {
    logError("HARNESS", "Harness completed with failures.");
  }

  log("HARNESS", `Total time: ${(result.totalDurationMs / 1000 / 60).toFixed(1)} minutes`);
  log("HARNESS", `Sprints passed: ${result.sprints.filter((s) => s.passed).length}/${result.sprints.length}`);

  for (const sprint of result.sprints) {
    const status = sprint.passed ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    log("HARNESS", `  Sprint ${sprint.sprintNumber}: [${status}] (${sprint.attempts} attempts)`);
  }

  process.exit(result.success ? 0 : 1);
} catch (error) {
  logError("HARNESS", `Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
