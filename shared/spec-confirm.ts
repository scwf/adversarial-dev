import readline from "node:readline";
import { join } from "path";
import { log, logDivider } from "./logger.ts";

export async function waitForSpecConfirmation(workDir: string): Promise<void> {
  const specPath = join(workDir, "spec.md");
  logDivider();
  log("HARNESS", "SPEC REVIEW — Planner finished. Edit spec.md if you want, then continue here.");
  log("HARNESS", `  ${specPath}`);
  log("HARNESS", "Press Enter to load spec from disk and proceed to sprints (Ctrl+C to abort).");
  logDivider();

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}
