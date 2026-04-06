# Testing Checklist for PR #1

Before merging, manually validate these scenarios to ensure the new features work correctly.

## ✅ Pre-Merge Testing Checklist

### 1. Resume from Interruption ⏸️

- [ ] **Test:** Start a harness run with multiple sprints
  ```bash
  bun run claude-harness/index.ts "Build a simple todo app with REST API"
  ```
  
- [ ] **Action:** Interrupt the process (Ctrl+C) during sprint 2 build phase
  
- [ ] **Test:** Resume the run
  ```bash
  bun run claude-harness/index.ts --resume
  ```
  
- [ ] **Verify:**
  - [ ] Logs show "RESUME — continuing from progress.json"
  - [ ] Sprint 1 is marked complete (not re-run)
  - [ ] Sprint 2 starts immediately
  - [ ] Contract for sprint 2 is reused (log says "Using saved contract")
  - [ ] Build completes successfully

---

### 2. Resume from Failed Sprint 🔴

- [ ] **Setup:** Let a sprint fail all retries (or manually set retryCount in progress.json)
  
- [ ] **Test:** Resume after failure
  ```bash
  bun run claude-harness/index.ts --resume
  ```
  
- [ ] **Verify:**
  - [ ] Failed sprint is retried with fresh attempt counter
  - [ ] Last evaluator feedback is loaded
  - [ ] Generator receives feedback context

---

### 3. Resume Edge Case: Completed Run 🏁

- [ ] **Setup:** Let a run complete all sprints successfully
  
- [ ] **Test:** Try to resume
  ```bash
  bun run claude-harness/index.ts --resume
  ```
  
- [ ] **Verify:**
  - [ ] Error message: "Cannot resume: the last run already completed all sprints"
  - [ ] Process exits gracefully

---

### 4. External Spec Loading 📄

- [ ] **Setup:** Create a custom spec file
  ```bash
  cat > test-spec.md << 'EOF'
  # Product Spec: Simple Calculator
  
  ## Tech Stack
  - Language: JavaScript
  - Framework: Node.js + Express
  - Testing: Jest
  
  ## Features
  
  ### Sprint 1: Basic Operations
  - Addition endpoint: POST /calculate/add
  - Subtraction endpoint: POST /calculate/subtract
  - Input validation
  - Error handling
  
  ### Sprint 2: Advanced Operations  
  - Multiplication endpoint: POST /calculate/multiply
  - Division endpoint: POST /calculate/divide
  - Division by zero handling
  - Result history storage
  EOF
  ```
  
- [ ] **Test:** Run with external spec
  ```bash
  bun run claude-harness/index.ts --spec test-spec.md
  ```
  
- [ ] **Verify:**
  - [ ] Log shows "PHASE 1: SKIPPED — using existing spec file"
  - [ ] Log shows "Loaded spec from /absolute/path/to/test-spec.md"
  - [ ] Log shows "Spec defines 2 sprint(s)"
  - [ ] Planner phase is completely skipped
  - [ ] Negotiation starts immediately
  - [ ] 2 sprints run as specified

---

### 5. External Spec with Absolute Path 🗂️

- [ ] **Test:** Use absolute path
  ```bash
  bun run claude-harness/index.ts --spec /tmp/my-spec.md
  ```
  
- [ ] **Verify:**
  - [ ] Spec loads correctly from absolute path
  - [ ] Process continues normally

---

### 6. External Spec with Relative Path 📁

- [ ] **Test:** Use relative path
  ```bash
  cd /tmp
  bun run /path/to/adversarial-dev/claude-harness/index.ts --spec ./my-spec.md
  ```
  
- [ ] **Verify:**
  - [ ] Spec resolves relative to current working directory
  - [ ] Loads successfully

---

### 7. External Spec Error: File Not Found ❌

- [ ] **Test:** Point to non-existent file
  ```bash
  bun run claude-harness/index.ts --spec /nonexistent/spec.md
  ```
  
- [ ] **Verify:**
  - [ ] Error occurs (currently: ENOENT when reading file)
  - [ ] Error message is reasonably clear
  
  **Note:** Reviewer suggested adding early validation for better error message.

---

### 8. Interactive Spec Review (Default Behavior) ⏸️✏️

- [ ] **Test:** Normal run without --yes flag
  ```bash
  bun run claude-harness/index.ts "Build a note-taking app"
  ```
  
- [ ] **Verify:**
  - [ ] Planner runs and creates spec.md
  - [ ] Process pauses with message:
    ```
    SPEC REVIEW — Planner finished. Edit spec.md if you want, then continue here.
      /path/to/workspace/claude/spec.md
    Press Enter to load spec from disk and proceed to sprints (Ctrl+C to abort).
    ```
  - [ ] You can open spec.md in editor while paused
  
- [ ] **Action:** Edit spec.md (add a comment or feature)
  
- [ ] **Action:** Press Enter to continue
  
- [ ] **Verify:**
  - [ ] Harness reloads spec.md from disk
  - [ ] Your edits are reflected in the sprint execution
  - [ ] Sprints proceed normally

---

### 9. Skip Interactive Review with --yes Flag 🚀

- [ ] **Test:** Run with --yes
  ```bash
  bun run claude-harness/index.ts "Build a note-taking app" --yes
  ```
  
- [ ] **Verify:**
  - [ ] Planner runs
  - [ ] NO pause after planning
  - [ ] Sprints start immediately
  - [ ] Runs completely unattended

---

### 10. Skip Interactive Review with Environment Variable 🌍

- [ ] **Test:** Set environment variable
  ```bash
  export ADVERSARIAL_SKIP_SPEC_CONFIRM=1
  bun run claude-harness/index.ts "Build a note-taking app"
  ```
  
- [ ] **Verify:**
  - [ ] NO pause after planning
  - [ ] Behaves like --yes flag

---

### 11. Flag Combination: --spec + --yes 🎯

- [ ] **Test:** Combine flags
  ```bash
  bun run claude-harness/index.ts --spec test-spec.md --yes
  ```
  
- [ ] **Verify:**
  - [ ] Planner skipped
  - [ ] Spec loaded from file
  - [ ] No interactive pause
  - [ ] Fully automated run

---

### 12. Flag Combination: --resume + --spec ⚠️

- [ ] **Test:** Try both flags together
  ```bash
  bun run claude-harness/index.ts --resume --spec test-spec.md
  ```
  
- [ ] **Verify:**
  - [ ] Log shows warning: "--spec is ignored when using --resume"
  - [ ] Resume uses workspace spec.md (not test-spec.md)
  - [ ] Process continues from saved progress

---

### 13. CLI Parsing: Multiple Flag Orders 🔀

- [ ] **Test:** Flags before prompt
  ```bash
  bun run claude-harness/index.ts --yes "Build an app"
  ```
  
- [ ] **Test:** Flags after prompt
  ```bash
  bun run claude-harness/index.ts "Build an app" --yes
  ```
  
- [ ] **Test:** Mixed order
  ```bash
  bun run claude-harness/index.ts --file prompt.txt --yes
  ```
  
- [ ] **Verify:**
  - [ ] All orders work correctly
  - [ ] Flags are parsed regardless of position

---

### 14. CLI Error: Missing --spec Argument ❌

- [ ] **Test:** --spec without path
  ```bash
  bun run claude-harness/index.ts --spec
  ```
  
- [ ] **Verify:**
  - [ ] Error message: "Error: --spec requires a path argument"
  - [ ] Process exits with code 1

---

### 15. CLI Error: Missing --file Argument ❌

- [ ] **Test:** --file without path
  ```bash
  bun run claude-harness/index.ts --file
  ```
  
- [ ] **Verify:**
  - [ ] Error message: "Error: --file requires a path argument"
  - [ ] Process exits with code 1

---

### 16. CLI Error: No Prompt/Spec/Resume ❌

- [ ] **Test:** Run with no arguments
  ```bash
  bun run claude-harness/index.ts
  ```
  
- [ ] **Verify:**
  - [ ] Usage help is displayed
  - [ ] Shows all available flags
  - [ ] Process exits with code 1

---

### 17. Codex Harness Parity ⚖️

- [ ] **Test:** Run same tests with codex-harness
  ```bash
  # Replace claude-harness with codex-harness in tests
  bun run codex-harness/index.ts --resume
  bun run codex-harness/index.ts --spec test-spec.md
  bun run codex-harness/index.ts "Build an app" --yes
  ```
  
- [ ] **Verify:**
  - [ ] All features work identically
  - [ ] Same log messages
  - [ ] Same behavior

---

### 18. Backward Compatibility ↩️

- [ ] **Test:** Old-style commands still work
  ```bash
  bun run claude-harness/index.ts "Build a simple app"
  ```
  
- [ ] **Verify:**
  - [ ] Works exactly as before
  - [ ] No breaking changes
  - [ ] Default behavior unchanged

---

### 19. Progress.json Structure Validation 📋

- [ ] **Action:** After a partial run, inspect progress.json
  ```bash
  cat workspace/claude/progress.json
  ```
  
- [ ] **Verify Structure:**
  ```json
  {
    "status": "building",
    "currentSprint": 2,
    "totalSprints": 5,
    "completedSprints": 1,
    "retryCount": 0
  }
  ```
  
- [ ] **Verify Fields:**
  - [ ] `status` is one of: planning, negotiating, building, evaluating, complete, failed
  - [ ] `currentSprint` matches where you interrupted
  - [ ] `totalSprints` matches spec sprint count
  - [ ] `completedSprints` tracks finished sprints

---

### 20. Contract Reuse Validation 📜

- [ ] **Action:** After resuming, check logs
  
- [ ] **Verify:**
  - [ ] Log says "Using saved contract contracts/sprint-N.json"
  - [ ] Contract file exists: `workspace/claude/contracts/sprint-N.json`
  
- [ ] **Action:** Inspect contract file
  ```bash
  cat workspace/claude/contracts/sprint-2.json
  ```
  
- [ ] **Verify Structure:**
  ```json
  {
    "sprintNumber": 2,
    "features": ["Feature A", "Feature B"],
    "criteria": [
      {
        "name": "Criterion 1",
        "description": "Detailed requirement",
        "threshold": 7
      }
    ]
  }
  ```

---

### 21. Feedback Loading Validation 💬

- [ ] **Setup:** Let a sprint fail evaluation once
  
- [ ] **Action:** Check feedback file created
  ```bash
  ls workspace/claude/feedback/
  # Should see: sprint-N-round-0.json
  ```
  
- [ ] **Action:** Resume or let retry happen
  
- [ ] **Verify:**
  - [ ] Generator receives feedback in prompt
  - [ ] Feedback includes scores and detailed issues

---

### 22. Git Boundary Validation 🔀

- [ ] **Action:** After a successful sprint, check Git repos
  
- [ ] **Verify outer repo (harness framework):**
  ```bash
  git status
  # Should be clean (no app/ files staged)
  ```
  
- [ ] **Verify inner repo (generated app):**
  ```bash
  cd workspace/claude/app
  git log --oneline
  # Should show commits from generator
  ```
  
- [ ] **Verify:**
  - [ ] App commits stay in app/.git
  - [ ] Framework repo stays clean

---

## Summary Metrics

**Total Test Cases:** 22  
**Estimated Testing Time:** 2-3 hours for comprehensive coverage  
**Critical Tests (must pass):** 1, 2, 4, 8, 9, 12, 17, 18  
**Nice-to-Have Tests:** Rest

---

## Quick Smoke Test (15 minutes)

If you're short on time, run these 5 critical tests:

1. ✅ **Resume from interruption** (Test #1)
2. ✅ **External spec loading** (Test #4)
3. ✅ **Interactive review** (Test #8)
4. ✅ **Skip review with --yes** (Test #9)
5. ✅ **Backward compatibility** (Test #18)

---

## Automated Testing Note

Currently, the project has **no automated tests**. All testing is manual.

**Recommendation from review:** Consider adding unit tests for:
- `shared/resume.ts` functions (edge cases)
- CLI argument parsing logic
- Progress validation logic

But for an orchestration tool like this, manual end-to-end testing is more valuable than unit tests.

---

## Testing Environment

**Requirements:**
- Bun runtime installed
- Claude CLI authenticated (`claude auth login`)
- Codex CLI authenticated (`codex auth login`)
- ~2GB free disk space (for workspace directories)
- Network connection (for AI agent API calls)

**Workspace Cleanup Between Tests:**
```bash
rm -rf workspace/claude workspace/codex
```

---

## Reporting Issues

If any test fails, document:
1. Which test number failed
2. Command used
3. Expected behavior
4. Actual behavior
5. Error messages
6. Contents of progress.json (if relevant)

---

**Last Updated:** April 6, 2026  
**For PR:** #1 (scwf branch)  
**Review Status:** Approved pending testing
