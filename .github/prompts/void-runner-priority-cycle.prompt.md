---
mode: agent
model: GPT-5 (copilot)
description: "Use when: run a Void Runner roadmap cycle from IDEAS_TODO priority queue, implement one item end-to-end, validate, and update checklist status."
tools:
  - read
  - search
  - edit
  - execute
  - todo
---
Run one full Void Runner priority cycle with minimal scope and direct implementation.

Inputs you should infer from repo state:
- Current top unchecked item in IDEAS_TODO.md under Current Priority Queue
- Existing gameplay constraints in .github/copilot-instructions.md
- Active project conventions in relevant modules

Required flow:
1. Read IDEAS_TODO.md and restate only the next unchecked priority item.
2. Implement only that item with minimal, testable changes.
3. Keep determinism and hot-path performance constraints intact.
4. Validate changed files for errors and summarize gameplay impact.
5. Mark that specific TODO item as done only if implemented and validated.
6. Propose exactly one next follow-up item.

Guardrails:
- Do not start a second roadmap item in the same run.
- Avoid broad refactors unless needed to complete the selected item.
- Preserve menu/input/camera/timer and seed behavior unless task explicitly changes them.
