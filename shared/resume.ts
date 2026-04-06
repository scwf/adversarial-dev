import { readdir } from "fs/promises";
import { join } from "path";
import type { EvalResult, HarnessProgress } from "./types.ts";
import { readFeedback } from "./files.ts";

export function getTotalSprintsFromSpec(spec: string, maxSprints: number): number {
  const sprintNumbers = Array.from(spec.matchAll(/sprint\s+(\d+)/gi))
    .map((m) => parseInt(m[1]!, 10))
    .filter((n) => n > 0 && n <= maxSprints);
  return sprintNumbers.length > 0 ? Math.min(Math.max(...sprintNumbers), maxSprints) : 3;
}

export function getResumeStartSprint(progress: HarnessProgress, totalSprintsFromSpec: number): number {
  if (progress.status === "complete") {
    throw new Error("Cannot resume: the last run already completed all sprints (progress status: complete).");
  }
  let start = progress.currentSprint;
  if (start < 1) start = 1;
  if (start > totalSprintsFromSpec) {
    throw new Error(
      `Cannot resume at sprint ${start}: the spec defines only ${totalSprintsFromSpec} sprint(s).`,
    );
  }
  return start;
}

export async function loadLastEvalFromFeedback(
  workDir: string,
  sprintNumber: number,
): Promise<EvalResult | undefined> {
  const dir = join(workDir, "feedback");
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return undefined;
  }
  const prefix = `sprint-${sprintNumber}-round-`;
  const suffix = ".json";
  let maxRound = -1;
  for (const f of entries) {
    if (!f.startsWith(prefix) || !f.endsWith(suffix)) continue;
    const mid = f.slice(prefix.length, -suffix.length);
    const r = parseInt(mid, 10);
    if (!Number.isNaN(r) && r > maxRound) maxRound = r;
  }
  if (maxRound < 0) return undefined;
  return readFeedback(workDir, sprintNumber, maxRound);
}
