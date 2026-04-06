import type { HarnessConfig } from "./types.ts";

export const DEFAULT_CONFIG: Omit<HarnessConfig, "userPrompt" | "workDir"> = {
  /** Hard cap per harness run (safety valve). Not a target for the planner—see planner prompt Sprint Plan. */
  maxSprints: 100,
  maxRetriesPerSprint: 3,
  passThreshold: 7,
  skipSpecConfirmation: false,
};

export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const CODEX_MODEL = "gpt-5.4";

export const CLAUDE_MAX_TURNS = 50;
export const CODEX_NETWORK_ACCESS = true;
