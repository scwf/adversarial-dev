import { readFile } from "fs/promises";
import { resolve } from "path";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import {
  CONTRACT_NEGOTIATION_GENERATOR_PROMPT,
  CONTRACT_NEGOTIATION_EVALUATOR_PROMPT,
} from "../shared/prompts.ts";
import { CLAUDE_MODEL } from "../shared/config.ts";
import { log, logError, logDivider } from "../shared/logger.ts";
import { waitForSpecConfirmation } from "../shared/spec-confirm.ts";
import {
  initWorkspace,
  writeSpec,
  readSpec,
  readProgress,
  writeContract,
  readContract,
  writeFeedback,
  writeProgress,
} from "../shared/files.ts";
import { getResumeStartSprint, getTotalSprintsFromSpec, loadLastEvalFromFeedback } from "../shared/resume.ts";
import type {
  HarnessConfig,
  SprintContract,
  EvalResult,
  HarnessProgress,
  HarnessResult,
  SprintResult,
} from "../shared/types.ts";

import { runPlanner } from "./planner.ts";
import { runGenerator } from "./generator.ts";
import { runEvaluator } from "./evaluator.ts";

export async function runHarness(config: HarnessConfig): Promise<HarnessResult> {
  const startTime = Date.now();

  log("HARNESS", "Initializing Claude Agent SDK harness");
  log("HARNESS", `Work directory: ${config.workDir}`);
  log("HARNESS", `Max sprints: ${config.maxSprints} | Max retries: ${config.maxRetriesPerSprint} | Threshold: ${config.passThreshold}/10`);

  let spec: string;
  let progress: HarnessProgress;
  const seededResults: SprintResult[] = [];
  let startSprint = 1;
  let totalSprints: number;

  if (config.resume) {
    if (config.specPath) {
      log("HARNESS", "--spec is ignored when using --resume (using workspace spec.md).");
    }
    logDivider();
    log("HARNESS", "RESUME — continuing from progress.json");
    logDivider();

    await initWorkspace(config.workDir, { resume: true });

    let saved: HarnessProgress;
    try {
      saved = await readProgress(config.workDir);
    } catch {
      throw new Error("Cannot resume: progress.json is missing or unreadable in the work directory.");
    }

    try {
      spec = await readSpec(config.workDir);
    } catch {
      throw new Error("Cannot resume: spec.md is missing in the work directory.");
    }

    totalSprints = getTotalSprintsFromSpec(spec, config.maxSprints);
    startSprint = getResumeStartSprint(saved, totalSprints);

    for (let i = 1; i < startSprint; i++) {
      seededResults.push({ sprintNumber: i, passed: true, attempts: 0 });
    }

    progress = {
      ...saved,
      totalSprints,
      status: "negotiating",
      retryCount: 0,
    };

    log(
      "HARNESS",
      `Resuming at sprint ${startSprint}/${totalSprints} (${saved.completedSprints} sprint(s) already completed).`,
    );
  } else {
    await initWorkspace(config.workDir);

    progress = {
      status: "planning",
      currentSprint: 0,
      totalSprints: 0,
      completedSprints: 0,
      retryCount: 0,
    };
    await writeProgress(config.workDir, progress);

    if (config.specPath) {
      logDivider();
      log("HARNESS", "PHASE 1: SKIPPED — using existing spec file");
      logDivider();
      const specFile = resolve(config.specPath);
      spec = await readFile(specFile, "utf-8");
      await writeSpec(config.workDir, spec);
      log("HARNESS", `Loaded spec from ${specFile}`);
    } else {
      logDivider();
      log("HARNESS", "PHASE 1: PLANNING");
      logDivider();

      const plannerResponse = await runPlanner(config.userPrompt, config.workDir);

      // Planner may have written spec.md via Write tool, or returned it as text
      try {
        spec = await readSpec(config.workDir);
      } catch {
        log("HARNESS", "Planner returned spec as text, writing to spec.md");
        await writeSpec(config.workDir, plannerResponse);
        spec = plannerResponse;
      }
    }

    const skipSpecConfirm =
      config.skipSpecConfirmation === true ||
      process.env.ADVERSARIAL_SKIP_SPEC_CONFIRM === "1";
    if (!skipSpecConfirm) {
      await waitForSpecConfirmation(config.workDir);
      spec = await readSpec(config.workDir);
    }

    totalSprints = getTotalSprintsFromSpec(spec, config.maxSprints);
    progress.totalSprints = totalSprints;
    log(
      "HARNESS",
      config.specPath ? `Spec defines ${totalSprints} sprint(s)` : `Planner produced ${totalSprints} sprints`,
    );
  }

  const results: SprintResult[] = [...seededResults];

  // Phase 2-4: Sprint Loop
  for (let sprint = startSprint; sprint <= totalSprints; sprint++) {
    logDivider();
    log("HARNESS", `SPRINT ${sprint}/${totalSprints}`);
    logDivider();

    // Phase 2: Contract Negotiation
    progress.status = "negotiating";
    progress.currentSprint = sprint;
    progress.retryCount = 0;
    await writeProgress(config.workDir, progress);

    let contract: SprintContract;
    try {
      contract = await readContract(config.workDir, sprint);
      log("HARNESS", `Using saved contract contracts/sprint-${sprint}.json`);
    } catch {
      log("HARNESS", "Negotiating sprint contract...");
      contract = await negotiateContract(config.workDir, spec, sprint);
      await writeContract(config.workDir, contract);
      log("HARNESS", `Contract agreed: ${contract.criteria.length} criteria for ${contract.features.length} features`);
    }

    // Phase 3-4: Build-Evaluate Loop
    let passed = false;
    let lastEval: EvalResult | undefined = await loadLastEvalFromFeedback(config.workDir, sprint);
    let attempts = 0;

    for (let retry = 0; retry <= config.maxRetriesPerSprint; retry++) {
      attempts = retry + 1;

      // Build
      progress.status = "building";
      progress.retryCount = retry;
      await writeProgress(config.workDir, progress);

      await runGenerator(config.workDir, spec, contract, lastEval);

      // Evaluate
      progress.status = "evaluating";
      await writeProgress(config.workDir, progress);

      lastEval = await runEvaluator(config.workDir, contract, config.passThreshold);
      await writeFeedback(config.workDir, sprint, retry, lastEval);

      if (lastEval.passed) {
        passed = true;
        log("HARNESS", `Sprint ${sprint} PASSED on attempt ${attempts}`);
        break;
      }

      if (retry < config.maxRetriesPerSprint) {
        log("HARNESS", `Sprint ${sprint} failed attempt ${attempts}, retrying...`);
      } else {
        logError("HARNESS", `Sprint ${sprint} FAILED after ${attempts} attempts`);
      }
    }

    results.push({
      sprintNumber: sprint,
      passed,
      attempts,
      evalResult: lastEval,
    });

    if (passed) {
      progress.completedSprints++;
    } else {
      progress.status = "failed";
      await writeProgress(config.workDir, progress);
      logError("HARNESS", `Harness stopped: sprint ${sprint} could not pass evaluation`);
      break;
    }
  }

  // Final status
  const allPassed = results.every((r) => r.passed);
  progress.status = allPassed ? "complete" : "failed";
  await writeProgress(config.workDir, progress);

  const totalDuration = Date.now() - startTime;
  logDivider();
  log("HARNESS", `Harness ${allPassed ? "COMPLETED" : "FAILED"} in ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  log("HARNESS", `Sprints: ${results.filter((r) => r.passed).length}/${results.length} passed`);

  return { success: allPassed, sprints: results, totalDurationMs: totalDuration };
}

async function negotiateContract(
  workDir: string,
  spec: string,
  sprintNumber: number,
): Promise<SprintContract> {
  // Generator proposes contract
  const proposalPrompt = `## Product Spec\n\n${spec}\n\n## Sprint Number: ${sprintNumber}\n\nPropose a sprint contract for this sprint.`;

  const proposalOptions: Options = {
    cwd: workDir,
    systemPrompt: CONTRACT_NEGOTIATION_GENERATOR_PROMPT,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools: ["Read"],
    model: CLAUDE_MODEL,
    maxTurns: 10,
    persistSession: false,
  };

  let proposalText = "";
  for await (const msg of query({ prompt: proposalPrompt, options: proposalOptions })) {
    if (msg.type === "assistant") {
      const message = msg as { message: { content: Array<{ type: string; text?: string }> } };
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          proposalText += block.text;
        }
      }
    }
  }

  // Evaluator reviews contract
  const reviewPrompt = `## Proposed Sprint Contract\n\n${proposalText}\n\nReview this contract.`;

  const reviewOptions: Options = {
    cwd: workDir,
    systemPrompt: CONTRACT_NEGOTIATION_EVALUATOR_PROMPT,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools: ["Read"],
    model: CLAUDE_MODEL,
    maxTurns: 10,
    persistSession: false,
  };

  let reviewText = "";
  for await (const msg of query({ prompt: reviewPrompt, options: reviewOptions })) {
    if (msg.type === "assistant") {
      const message = msg as { message: { content: Array<{ type: string; text?: string }> } };
      for (const block of message.message.content) {
        if (block.type === "text" && block.text) {
          reviewText += block.text;
        }
      }
    }
  }

  // Parse the final contract (either the proposal if approved, or the revised version)
  const contractSource = reviewText.trim() === "APPROVED" ? proposalText : reviewText;
  return parseContract(contractSource, sprintNumber);
}

function parseContract(text: string, sprintNumber: number): SprintContract {
  // Try multiple extraction strategies
  const candidates: string[] = [];
  const codeBlocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  for (const match of codeBlocks.reverse()) {
    if (match[1]) candidates.push(match[1].trim());
  }
  const braceMatch = text.match(/\{[\s\S]*"criteria"[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);
  candidates.push(text.trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as SprintContract;
      if (parsed.criteria && Array.isArray(parsed.criteria)) {
        parsed.sprintNumber = sprintNumber;
        return parsed;
      }
    } catch {
      // Try next candidate
    }
  }

  {
    logError("HARNESS", "Failed to parse contract JSON, creating default");
    return {
      sprintNumber,
      features: [`Sprint ${sprintNumber} features`],
      criteria: [
        {
          name: "basic_functionality",
          description: "Core features for this sprint are implemented and working",
          threshold: 7,
        },
        {
          name: "code_quality",
          description: "Code is clean, well-structured, and follows best practices",
          threshold: 7,
        },
        {
          name: "error_handling",
          description: "Errors are handled gracefully with appropriate user feedback",
          threshold: 7,
        },
      ],
    };
  }
}
