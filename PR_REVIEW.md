# Pull Request Review: "enhance the mian branch"

**PR:** #1  
**Branch:** `scwf` → `main`  
**Reviewer:** AI Code Review  
**Date:** April 6, 2026

---

## Executive Summary

This PR introduces significant enhancements to the adversarial development harness, adding crucial workflow flexibility features. The changes are well-architected and follow consistent patterns across both the Claude and Codex harness implementations.

**Overall Assessment: ✅ APPROVED with minor suggestions**

The implementation is production-ready with:
- **7 new features** added across 12 files (617 insertions)
- Consistent patterns across both harness implementations
- Good separation of concerns with new utility modules
- Comprehensive documentation updates

---

## Summary of Changes

### Major Features Added

1. **Resume Capability (`--resume` flag)**
   - Allows continuing interrupted harness runs from `progress.json`
   - Preserves workspace artifacts (spec, contracts, feedback)
   - Smart sprint resumption logic
   - Reuses existing contracts and evaluator feedback

2. **External Spec Loading (`--spec <path>` flag)**
   - Skip planner phase and load pre-written specs
   - Supports any absolute or relative path
   - Validates spec format and sprint count

3. **Interactive Spec Review Workflow**
   - Pause after planning for human review/editing
   - Can be bypassed with `--yes/-y` flag or env var
   - Better for iterative spec refinement

4. **Enhanced CLI Argument Parsing**
   - Support for multiple flags in any order
   - Better help messages and error handling
   - Flexible flag combinations

5. **Configuration Updates**
   - `maxSprints` increased from 10 → 100 (safety valve)
   - Better planner sprint guidance
   - Improved generator Git boundary documentation

6. **New Utility Modules**
   - `shared/resume.ts`: Resume logic helpers
   - `shared/spec-confirm.ts`: Interactive confirmation
   - Better code organization

7. **Documentation Improvements**
   - Comprehensive README updates with CLI flag table
   - Clearer workspace initialization behavior
   - Better architecture diagrams

---

## Detailed Code Review

### ✅ Strengths

#### 1. **Consistent Dual Implementation**
Both `claude-harness/` and `codex-harness/` receive identical changes, maintaining feature parity:

```typescript:118:285:claude-harness/harness.ts
  if (config.resume) {
    if (config.specPath) {
      log("HARNESS", "--spec is ignored when using --resume (using workspace spec.md).");
    }
    // ... resume logic
  } else {
    // ... normal flow
  }
```

This pattern is mirrored exactly in `codex-harness/harness.ts`, ensuring both SDKs work identically.

#### 2. **Smart Resume Logic**
The resume functionality intelligently handles edge cases:

```typescript:13:24:shared/resume.ts
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
```

**Good practices:**
- Validates against completed runs
- Bounds checking against spec
- Clear error messages

#### 3. **Graceful Degradation**
The code handles missing files gracefully:

```typescript:27:49:shared/resume.ts
export async function loadLastEvalFromFeedback(
  workDir: string,
  sprintNumber: number,
): Promise<EvalResult | undefined> {
  const dir = join(workDir, "feedback");
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return undefined;  // No feedback dir? No problem.
  }
  // ... find latest feedback round
}
```

Returns `undefined` instead of throwing when feedback doesn't exist, allowing fresh sprint attempts.

#### 4. **Type Safety**
New configuration fields are properly typed:

```typescript:8:17:shared/types.ts
  /** If true, skip the interactive pause after planning (CI / non-interactive runs). */
  skipSpecConfirmation?: boolean;
  /**
   * Absolute path or path relative to the process cwd. When set, the planner phase is skipped;
   * this file is read as the product spec (and copied to `spec.md` in the work directory).
   */
  specPath?: string;
  /**
   * When true, skip a fresh init wipe and planning; continue from progress.json and workspace spec.md.
   */
  resume?: boolean;
```

Clear JSDoc comments explain each option.

#### 5. **Improved Git Isolation**
Enhanced documentation in prompts about Git boundaries:

```typescript:799:806:shared/prompts.ts
## Git repository boundary (critical)

The harness places you in a **per-run workspace** (often named like \`workspace/<sdk>/\`) that contains \`app/\`, \`contracts/\`, \`feedback/\`, etc. A separate **outer** Git repository may exist one or more levels above you—it tracks only the harness framework, not the product you are building.

- **Application history:** Every \`git add\`, \`git commit\`, and \`git push\` for the product MUST run **only inside** \`app/\`, using the Git repository initialized there (\`app/.git\`).
- **Never** stage or commit files from \`app/\` (or any sibling paths under this workspace) into the outer / parent repository, and **never** aim Git commands at the framework repo root. That misroutes sprint work into the wrong project and breaks the intended isolation.
```

This prevents a common failure mode where agents commit to the wrong repository.

#### 6. **Better Planner Guidance**
The updated planner prompt provides much clearer sprint organization guidance:

```typescript:776:788:shared/prompts.ts
### Sprint Plan
Organize features into sprints—how many is secondary; what matters is each sprint is **one focused, verifiable theme**, not a mixed grab-bag or a monster milestone. Split only where it genuinely clarifies scope; don't pad the count or stuff unrelated work together.

**Multi-subsystem products** (e.g. native/desktop: global shortcuts, tray or IME surfaces, audio capture, local + cloud STT, settings UI, history): these need **vertical splits**—one integration boundary, one major surface, or one clear user-visible slice per sprint so **each could be demoed and tested on its own**. **Bundling "the MVP loop + full management shell + engine framework" into a handful of giant phases is too coarse**; that pattern favors breadth over verifiability. Still, **do not chase a high sprint count for its own sake**—only split where it makes validation clearer.
```

This addresses real-world issues with sprint planning quality.

---

### 🟡 Minor Issues & Suggestions

#### 1. **Typo in PR Title**
The PR title has a typo: "enhance the **mian** branch" should be "enhance the **main** branch"

**Recommendation:** Update the PR title.

#### 2. **Missing Validation: specPath Existence**
When `--spec <path>` is provided, the code doesn't validate the file exists until it tries to read it:

```typescript:248:252:claude-harness/harness.ts
      const specFile = resolve(config.specPath);
      spec = await readFile(specFile, "utf-8");
      await writeSpec(config.workDir, spec);
      log("HARNESS", `Loaded spec from ${specFile}`);
```

**Suggestion:** Add early validation with a better error message:

```typescript
if (config.specPath) {
  const specFile = resolve(config.specPath);
  try {
    await access(specFile);
  } catch {
    throw new Error(`Cannot load spec: file not found at ${specFile}`);
  }
  spec = await readFile(specFile, "utf-8");
  // ...
}
```

This would fail faster with a clearer message.

#### 3. **Contract Reuse Logging Could Be Clearer**
When reusing a saved contract, the log message is terse:

```typescript:156:158:claude-harness/harness.ts
      contract = await readContract(config.workDir, sprint);
      log("HARNESS", `Using saved contract contracts/sprint-${sprint}.json`);
```

**Suggestion:** Add more context:

```typescript
log("HARNESS", `Reusing saved contract (${contract.criteria.length} criteria, ${contract.features.length} features)`);
```

This helps users understand that progress is being preserved.

#### 4. **Seeded Results Array Could Be More Explicit**
The pattern for marking completed sprints works but is a bit subtle:

```typescript:216:218:claude-harness/harness.ts
    for (let i = 1; i < startSprint; i++) {
      seededResults.push({ sprintNumber: i, passed: true, attempts: 0 });
    }
```

**Suggestion:** Add a comment:

```typescript
// Mark previously completed sprints as passed (from earlier run)
for (let i = 1; i < startSprint; i++) {
  seededResults.push({ sprintNumber: i, passed: true, attempts: 0 });
}
```

#### 5. **Package-lock.json Ignore Explanation**
The gitignore addition is good but could use more context:

```diff:.gitignore
+# npm lockfile — this repo standardizes on bun.lock; ignore accidental npm install output
+package-lock.json
```

**Perfect!** This is actually well done. No changes needed.

#### 6. **Default Sprint Count Fallback**
The fallback to 3 sprints when no sprint numbers are found might be too low for complex products:

```typescript:6:11:shared/resume.ts
export function getTotalSprintsFromSpec(spec: string, maxSprints: number): number {
  const sprintNumbers = Array.from(spec.matchAll(/sprint\s+(\d+)/gi))
    .map((m) => parseInt(m[1]!, 10))
    .filter((n) => n > 0 && n <= maxSprints);
  return sprintNumbers.length > 0 ? Math.min(Math.max(...sprintNumbers), maxSprints) : 3;
}
```

**Consideration:** Could log a warning when falling back to the default:

```typescript
if (sprintNumbers.length === 0) {
  console.warn("Warning: No sprint numbers found in spec, defaulting to 3 sprints");
  return 3;
}
```

But this might be noisy. Current behavior is acceptable.

---

### 🟢 Testing Considerations

#### What to Test

1. **Happy Path - Resume**
   ```bash
   # Start a run, interrupt it mid-sprint
   bun run claude-harness/index.ts "Build a simple todo app"
   # Press Ctrl+C during sprint 2
   
   # Resume should continue from sprint 2
   bun run claude-harness/index.ts --resume
   ```

2. **Happy Path - Spec Loading**
   ```bash
   # Create a spec file
   echo "# Product Spec\n\n## Sprint 1\n- Feature A" > my-spec.md
   
   # Should skip planner
   bun run claude-harness/index.ts --spec my-spec.md
   ```

3. **Error Cases**
   - Resume on a completed run (should error)
   - Resume with no progress.json (should error)
   - Spec path to non-existent file (should error clearly)
   - Resume with corrupted progress.json

4. **CLI Flag Combinations**
   ```bash
   # Should work
   bun run claude-harness/index.ts --spec spec.md --yes
   
   # Should ignore --spec (and log about it)
   bun run claude-harness/index.ts --resume --spec spec.md
   ```

5. **Interactive Spec Review**
   - Normal run should pause after planning
   - `--yes` should skip pause
   - `ADVERSARIAL_SKIP_SPEC_CONFIRM=1` should skip pause

#### Current Testing Gap

**No automated tests exist.** The project has no `.test.ts` or `.spec.ts` files.

**Recommendation:** While manual testing is important for this type of orchestration tool, consider adding:

1. **Unit tests for resume logic:**
   ```typescript
   // shared/resume.test.ts
   test("getResumeStartSprint throws on completed runs", () => {
     expect(() => getResumeStartSprint(
       { status: "complete", currentSprint: 5, /* ... */ },
       5
     )).toThrow("Cannot resume");
   });
   ```

2. **Integration smoke tests:**
   ```typescript
   // Test that CLI parsing works
   test("CLI handles --resume flag", () => {
     // Mock process.argv and verify config
   });
   ```

This could prevent regressions in the resume logic, which has several edge cases.

---

### 📊 Code Quality Metrics

| Metric | Score | Notes |
|--------|-------|-------|
| **TypeScript Strictness** | ✅ Excellent | Full strict mode enabled |
| **Type Safety** | ✅ Excellent | All new code is properly typed |
| **Error Handling** | ✅ Good | Try-catch blocks used appropriately |
| **Code Duplication** | ✅ Good | Shared logic extracted to `shared/` |
| **Documentation** | ✅ Excellent | README comprehensive, JSDoc present |
| **Naming** | ✅ Excellent | Clear, descriptive names throughout |
| **Comments** | ✅ Good | Comments where needed, not excessive |
| **Test Coverage** | ⚠️ None | No automated tests (acceptable for this tool type) |

---

### 🔍 Security Considerations

1. **Path Traversal (Spec Loading)**
   The `--spec` flag uses `resolve()` which normalizes paths:
   
   ```typescript:249:claude-harness/index.ts
   const specFile = resolve(config.specPath);
   ```
   
   **Assessment:** ✅ Safe. `resolve()` prevents `../` attacks.

2. **Git Command Injection**
   The git init command uses `execSync` with static strings:
   
   ```typescript:32:35:shared/files.ts
   execSync("git init && git commit --allow-empty -m \"Initial commit\"", {
     cwd: appDir,
     stdio: "ignore",
   });
   ```
   
   **Assessment:** ✅ Safe. No user input in the command.

3. **Workspace Isolation**
   The harness properly isolates agent work in `workspace/*/app/`:
   
   **Assessment:** ✅ Good. The new Git boundary documentation strengthens this.

---

### 📝 Documentation Review

#### README.md Changes

**Excellent updates:**

1. **CLI Options Table**
   
   ```markdown:76:84:README.md
   | Flag | Meaning |
   |------|---------|
   | *(positional)* | Short user prompt (planning phase). |
   | `--file`, `-f` `<path>` | Read the planning prompt from a file. |
   | `--spec` `<path>` | Skip planning; load the product spec from this file and copy it into the workspace `spec.md`. You can run with **only** `--spec` (no positional prompt). |
   | `--resume` | Skip planning and **do not** reset the workspace artifacts: read `spec.md` and `progress.json`, infer the next sprint from `currentSprint`, reuse `contracts/sprint-{n}.json` when present, and pass the latest evaluator feedback into the generator when retrying that sprint. You can run with **only** `--resume` (no prompt). `--spec` is ignored if combined with `--resume` (the workspace `spec.md` is always used). |
   | `--yes`, `-y` | Skip the interactive step after the spec is ready: no pause to edit `spec.md` before sprints begin (useful for scripts and CI). |
   ```

   Clear, comprehensive, with important caveats noted.

2. **Workspace Behavior Documentation**
   
   ```markdown:86:88:README.md
   On a **normal** run, `initWorkspace` removes the previous `spec.md`, `progress.json`, and all files under `contracts/` and `feedback/` in that workspace. It does **not** delete the whole workspace folder or wipe `app/`. If you use `--spec`, the file is read **after** that cleanup, so do not point `--spec` at the workspace's own `spec.md` path (that file may have just been deleted).
   ```

   **Important warning** that prevents a common mistake.

3. **Updated Architecture Diagram**
   The diagram now shows the `--spec` option as an alternative to user prompts.

**Minor suggestion:** The README could include a troubleshooting section for common issues:
- "Resume failed: progress.json missing" → "You need to run a normal session first"
- "Spec file not found" → "Use absolute paths or paths relative to current directory"

But this is optional. Current docs are very good.

---

### 🎯 Testing Recommendations

Since this is an orchestration harness that interacts with AI agents, traditional unit testing has limited value. However:

#### Recommended Manual Test Plan

1. **Feature: Resume from Interruption**
   - [ ] Start a multi-sprint run
   - [ ] Kill process during sprint 2 build phase
   - [ ] Run with `--resume`
   - [ ] Verify: Sprint 1 skipped, sprint 2 reuses contract
   - [ ] Verify: Last evaluator feedback is passed to generator

2. **Feature: Resume from Failure**
   - [ ] Let a sprint fail all retry attempts
   - [ ] Run with `--resume`
   - [ ] Verify: Failed sprint is retried with fresh attempts

3. **Feature: External Spec Loading**
   - [ ] Create a custom `my-spec.md` with 2 sprints
   - [ ] Run with `--spec my-spec.md`
   - [ ] Verify: Planner phase skipped
   - [ ] Verify: 2 sprints run as specified

4. **Feature: Interactive Spec Review**
   - [ ] Run normal flow without `--yes`
   - [ ] Verify: Pause after planning with clear instructions
   - [ ] Edit spec.md while paused
   - [ ] Press Enter
   - [ ] Verify: Edited spec is loaded

5. **Feature: Skip Spec Review (CI Mode)**
   - [ ] Run with `--yes` flag
   - [ ] Verify: No pause after planning
   - [ ] Run with `ADVERSARIAL_SKIP_SPEC_CONFIRM=1`
   - [ ] Verify: No pause after planning

6. **Error Handling**
   - [ ] Run `--resume` with no prior run → Clear error
   - [ ] Run `--resume` after complete run → Error about completion
   - [ ] Run `--spec nonexistent.md` → File not found error
   - [ ] Run `--spec` with corrupted spec → Parse error

7. **Flag Combinations**
   - [ ] `--resume --spec` → Warning that --spec is ignored
   - [ ] `--file prompt.txt --yes` → Works
   - [ ] `--spec spec.md --yes` → Works
   - [ ] `--resume --yes` → Works (though --yes is redundant here)

#### Optional: Add Smoke Tests

Create a simple test harness:

```typescript
// test/smoke.test.ts
import { getTotalSprintsFromSpec, getResumeStartSprint } from "../shared/resume";

describe("Resume Logic", () => {
  test("parses sprint count from spec", () => {
    const spec = "# Spec\n\n## Sprint 1\nFoo\n\n## Sprint 2\nBar";
    expect(getTotalSprintsFromSpec(spec, 100)).toBe(2);
  });

  test("throws on completed runs", () => {
    expect(() => 
      getResumeStartSprint({ status: "complete", currentSprint: 3 }, 3)
    ).toThrow("already completed");
  });
});
```

---

## Final Verdict

### ✅ APPROVED

This PR delivers significant value with well-designed features:

**Strengths:**
- **Resume capability** is a game-changer for long-running harnesses
- **External spec loading** enables better workflows (write specs in your editor)
- **Interactive review** prevents wasted runs on bad specs
- Consistent implementation across both SDKs
- Excellent documentation
- Good error handling and edge case coverage

**Minor Issues:**
- PR title typo ("mian" → "main")
- Could add early validation for `--spec` file existence
- No automated tests (acceptable but could be improved)

**Impact:**
- Makes the harness much more practical for real-world use
- Reduces frustration from interruptions
- Enables better spec iteration workflows
- Production-ready code quality

### Merge Recommendation: **YES, after fixing PR title**

---

## Suggested Next Steps (Post-Merge)

1. **Fix PR title typo** before merging
2. Consider adding basic smoke tests for resume logic
3. Monitor for user feedback on the new flags
4. Possible future enhancement: `--continue-sprint N` to jump to a specific sprint
5. Possible future enhancement: `--edit-spec` flag to auto-open spec in $EDITOR

---

## Review Checklist

- [x] Code follows project conventions
- [x] TypeScript types are correct
- [x] Error handling is appropriate
- [x] Documentation is comprehensive
- [x] No security issues identified
- [x] Changes are backward compatible
- [x] Both harness implementations updated consistently
- [ ] PR title is correct (needs fix)
- [ ] Manual testing completed (recommended before merge)

---

**Reviewed by:** AI Code Review System  
**Confidence Level:** High  
**Recommendation:** Approve with minor title fix
