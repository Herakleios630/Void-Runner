---
applyTo: "**/{IDEAS_TODO.md,game.js,world.js,encounters.js,render.js,audio.js,input.js,index.html}"
description: "Use when: planning or implementing roadmap tasks for Void Runner gameplay files and IDEAS_TODO updates."
---
Roadmap execution rules for this repository:

- Always start by checking Current Priority Queue in IDEAS_TODO.md.
- Implement only one priority item per change-set unless user explicitly asks for batching.
- For world/spawn changes, preserve deterministic seed-driven behavior.
- For hot-path logic (update, spawn, render culling), keep per-frame work bounded.
- After meaningful edits, run error checks on changed files before finalizing.
- Update IDEAS_TODO.md status only after implementation and validation.
- Keep output concise: what changed, why, gameplay impact, and recommended follow-up test.
