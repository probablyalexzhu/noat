---
description: Comprehensive codebase cleanup — fix bugs, reduce duplication, name magic numbers, add file headers, remove dead code, and update project docs
argument-hint: Optional focus area (e.g. "sync layer", "components", or leave blank for full project)
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task, TaskCreate, TaskUpdate, TaskList
---

# Codebase Cleanup

You are a strict senior software engineer performing a comprehensive codebase cleanup. You read every file, think critically, and leave the codebase measurably better than you found it. You do NOT add features or change behavior — only improve structure, clarity, and correctness.

## Scope

Focus area: $ARGUMENTS

If no focus area is given, clean up the entire project.

---

## Phase 1: Full Read

**Read the entire project before changing anything.**

1. Read `CLAUDE.md` (and any nested `CLAUDE.md` files) to understand architecture, conventions, and commands.
2. Read `README.md` if it exists.
3. Use Glob to discover all source files. Read every file in the codebase — do not skip files or skim.
4. As you read, build a mental map of:
   - What each file does (one-line summary)
   - Data flow and dependencies between files
   - Shared patterns and abstractions already in use

**Do not make any edits during this phase.**

---

## Phase 2: Audit

After reading everything, compile a structured audit. Identify every instance of:

### 2a. Bugs

- Unreachable code (dead branches after early returns)
- Logic errors (off-by-one, wrong operators like `>` vs `<`)
- Resource leaks (unsubscribed listeners, uncleared timers, unclosed connections)
- Race conditions or missing null checks

### 2b. Duplication

- Identical or near-identical code blocks across files
- Copy-pasted utility patterns (timestamp formatting, polling loops, upsert SQL, etc.)
- Repeated multi-line sequences that should be a single helper call

### 2c. Magic numbers and unnamed constants

- Hardcoded numeric literals (timeouts, sizes, limits, indices)
- Hardcoded string literals that represent configuration
- Threshold values without explanation

### 2d. Dead code

- Unused functions, variables, imports, types, or exports
- Commented-out code blocks (unless marked with a TODO or clear reason to keep)
- Unreachable branches
- Backend commands never called from frontend (and vice versa)

### 2e. Loose typing

- `any` types that could be narrowed
- Missing return types on exported functions
- Untyped destructuring where types exist

### 2f. Missing file-level documentation

- Files without a header comment explaining their purpose and public API

### 2g. Stale or missing project docs

- `CLAUDE.md` that doesn't reflect current file structure or conventions
- `README.md` that is outdated, incomplete, or missing

**Present the full audit to the user as a numbered list grouped by category, with file paths and line numbers. Ask for approval before proceeding to fixes.**

---

## Phase 3: Plan

Create a concrete implementation plan from the audit. Organize changes into ordered phases:

1. **Fix bugs first** — correctness before aesthetics
2. **Extract shared helpers** — create utilities, then update consumers
3. **Name constants** — replace magic numbers/strings with named constants
4. **Remove dead code** — delete unused functions, commented-out blocks, stale imports
5. **Fix types** — narrow `any`, add missing annotations
6. **Add file headers** — one block comment per file explaining purpose and public API
7. **Update project docs** — revise CLAUDE.md and README.md to match reality

Use TaskCreate to track each phase as a task. Present the plan and get approval before executing.

---

## Phase 4: Execute

Work through each task in order. For each change:

- **Preserve behavior exactly.** This is cleanup, not feature work.
- **Make minimal diffs.** Don't reformat lines you didn't change.
- **Follow existing project conventions** (check CLAUDE.md, prettier config, eslint config, tsconfig).
- **When extracting helpers:** create the shared function first, then update all call sites in one pass.
- **When naming constants:** place them at the top of the file, use UPPER_SNAKE_CASE, and give them descriptive names.
- **When adding file headers:** use a block comment at the very top of the file (below imports), structured as:

```
/**
 * <filename> — <one-line description of what this file does>
 *
 * <optional 1-3 sentences about the file's role, what it exports, or how it fits in the architecture>
 */
```

- **When updating CLAUDE.md:** keep it concise (one line per concept), update the directory layout and commands sections, add any new conventions discovered during cleanup.
- **When updating README.md:** ensure it has accurate setup instructions, project description, and tech stack. Don't over-document — keep it practical.

Mark each task complete as you finish it.

---

## Phase 5: Verify

Run all available verification commands:

1. **Type-check:** `npx tsc --noEmit` (TypeScript) or equivalent
2. **Lint:** `npm run lint` or project-specific lint command
3. **Format:** `npm run format` or `npx prettier --write <changed files>`
4. **Compile:** `cargo check` (Rust), `go build` (Go), or equivalent if applicable
5. **Confirm:** Re-read every file you changed to verify no behavior was altered

If any check fails, fix the issue and re-run. Do not mark verification complete until all checks pass.

---

## Phase 6: Summary

Present a final summary:

- **Bugs fixed** — what was broken and how it was fixed
- **Helpers extracted** — new shared utilities and where they replaced duplication
- **Constants named** — magic numbers that were given names
- **Dead code removed** — what was deleted and why it was safe to delete
- **Types improved** — `any` types narrowed, annotations added
- **Headers added** — files that received documentation
- **Docs updated** — changes to CLAUDE.md and README.md

---

## Rules

- **NEVER change behavior.** If a refactoring might change behavior, flag it and skip it.
- **NEVER delete code you aren't certain is dead.** If in doubt, flag it in the audit instead of deleting.
- **NEVER add features, libraries, or dependencies.** This is cleanup only.
- **NEVER skip the audit.** Always present findings and get approval before making changes.
- **Respect .gitignore and ignore patterns.** Don't touch generated files, node_modules, build output, etc.
- **Match existing code style.** Indentation, quotes, semicolons, naming — follow what's already there.
- **Keep CLAUDE.md concise.** It's part of the prompt. Every word costs tokens. One line per concept.
