---
id: 'WI-0017'
title: Stop hook that keeps the agent working while make check is red
status: done
track: 'WT-0005'
owner: Diogo
acceptance:
  - AC1: when the working tree has no changes, the Stop hook lets the agent stop without running the check
  - AC2: when there are changes and the check passes, the Stop hook lets the agent stop
  - AC3: when there are changes and the check fails, the Stop hook blocks the stop (exit code 2) and sends the end of the check's output back to the agent
  - AC4: after 5 consecutive blocks in one session, the Stop hook lets the agent stop and warns the user that the check is still red
  - AC5: '`.claude/settings.json` registers the hook for the Stop event, and the hook runs on Node without shell syntax (the WI-0004 direction)'
---

# WI-0017 — Stop hook that keeps the agent working while make check is red

## Problem

The self-healing loop of the SDD methodology (rule fails → agent reads the
error → agent fixes → repeat until green) is enforced at commit time
(lefthook) and in CI. Inside an agent session it depends only on AGENTS.md
saying "run `make check` until green". An agent that forgets can finish a
turn with red code. With several sessions in parallel, each one only finds
out at commit time.

## Proposal

A Claude Code Stop hook in the project settings runs `make check` whenever
the agent tries to finish with uncommitted changes. While the check is red,
the hook blocks the stop and feeds the failure back, so the agent keeps
fixing. A cap of consecutive blocks per session stops an endless loop when
the fix needs a human. In that case the user is warned. A clean tree skips
the check, because every commit already passed it in the pre-commit hook.

## Out of scope

- Hooks for other agents (Codex, Cursor): only Claude Code reads
  `.claude/settings.json`
- A faster partial check after each edit (a PostToolUse hook)
- Reacting to CI failures on a PR (the app's Auto-fix)
- Removing the stale `.claude/worktrees/` copy from git

## Missing before coding

Nothing. The owner asked for this hook directly on 2026-10-24, which
approved the scope, so there is no separate work-spec.
