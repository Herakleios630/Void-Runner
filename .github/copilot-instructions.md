# Void Runner Copilot Instructions

## Goals
- Prioritize core gameplay stability and performance before future/experimental features.
- Keep the game responsive on low and mid-range hardware.
- Favor deterministic systems where possible (seed/chunk behavior should remain reproducible).

## Engineering Principles
- Treat runtime crashes and frozen game loops as highest priority.
- Optimize hot paths first (update loop, spawn logic, render culling, collision checks).
- Avoid work that increases per-frame cost unless it is capped, culled, or amortized.
- Preserve backward compatibility of existing save/seed/menu flows unless explicitly asked to change them.

## Code Organization
- Keep files focused by domain:
  - world generation in world-related modules
  - encounter/spawn behavior in encounters
  - rendering-only logic in render modules
  - input-only logic in input modules
- Prefer adding small helper functions over adding long monolithic blocks.
- If a module grows too large, split by concern (for example, background rendering vs entity rendering) without changing external behavior.

## Implementation Defaults
- Use world-space authority for gameplay state, then project to screen-space for rendering.
- Add lightweight guards around new procedural content to prevent NaN/undefined propagation.
- Keep object creation and spawning bounded per frame.
- Add concise comments only when logic is non-obvious.

## Validation Checklist (for each meaningful change)
- Verify no new JavaScript errors in browser console.
- Verify no new VS Code Problems errors in changed files.
- Confirm game starts from menu and ship/timer/input all function.
- If changing spawn/render systems, test at least one full run for regressions.

## Collaboration Preferences
- Continue maintaining IDEAS_TODO.md as roadmap tracking.
- Respect Core-first planning unless explicitly overridden by user.
- Prefer direct implementation and concrete fixes over long speculative plans.
