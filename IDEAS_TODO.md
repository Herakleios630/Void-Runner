# Ideas and TODO

## Daily Reminder
- [ ] At start of each work session: quickly review this file with user

## Core 4-Direction Migration
- [x] Camera follow with soft lag / rubber-band feel
- [x] Ship world-position as authoritative state
- [x] Objects, hazards, pickups with world coordinates
- [x] Projectile world-space foundation
- [x] Remove remaining screen-bound behavior (walls, edge ricochet assumptions)
- [x] Boss fully world-space (movement, spawn, attacks)
- [x] Convert remaining collision checks to world-space first
- [ ] Finalize camera/encounter culling and spawn pressure for free-flight
- [ ] Full QA pass for balancing and edge cases

## Future Features
- [ ] HIGH PRIORITY: Visual overhaul pass (planets, nebulae, overall scene quality)
- [ ] High-detail procedural planets (bands, craters, rim light, atmospheric scattering)
- [ ] Rich nebula rendering (layered noise, color palettes, wisps, depth fade)
- [ ] Improved starfield quality (twinkle variance, color temperature, density falloff)
- [ ] Cinematic background composition rules per chunk (avoid flat empty scenes)
- [ ] Larger playable area / viewport fill (use much more of browser window)
- [ ] Multiplayer co-op mode (online)
- [ ] Multiplayer PvP / versus arena mode
- [ ] Enemy fleets/formations per chunk (coordinated groups)
- [ ] Dynamic faction encounters and roaming patrol groups
- [ ] Black hole in parallax layer 2 with gravity pull zone
- [ ] Black hole event horizon that swallows entities crossing threshold
- [ ] Distortion VFX/accretion ring for black holes
- [ ] Optional: black hole influence on player ship (tunable)
- [x] Space stations orbiting planets
- [x] No free-floating station hazards (stations only as planet orbits)
- [x] Asteroid groups/fields as clustered encounters
- [x] Dense asteroid belts around planets
- [x] Enemy aggro + pursuit tuning pass (engage radius, follow persistence, speed)
- [x] Planet depth readability via atmosphere thickness by layer
- [x] Rear-layer suns (max 1 per chunk, varied stellar colors)
- [x] Early-game level-up pacing retune (avoid immediate level-up)

## Notes
- Add new ideas as checklist items here so they can be tracked and checked off.
- 2026-04-10: Added core perf safeguards (spawn-per-frame caps, background draw budgets) to keep headroom for future visual upgrades.
