---
mode: agent
model: GPT-5 (copilot)
description: "Use when: plan the next Void Runner roadmap step without editing code, based on IDEAS_TODO priority queue and project constraints."
tools:
  - read
  - search
  - todo
---
Create a compact implementation plan for exactly one next roadmap item without making any file edits.

Required flow:
1. Read IDEAS_TODO.md and identify the top unchecked item in Current Priority Queue.
2. Translate it into a practical implementation slice for one coding session.
3. Provide acceptance criteria and quick validation checks.
4. Call out performance and determinism risks for this specific item.
5. End with a short "ready to implement" checklist.

Guardrails:
- Do not edit files.
- Do not include speculative long-term redesigns.
- Keep to one item and one session scope.
