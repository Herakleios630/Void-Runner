# Ideas and TODO

## Daily Reminder
- [ ] At start of each work session: quickly review this file with user

## Current Priority Queue
- [x] P0: Finalize camera/encounter culling and spawn pressure for free-flight
- [x] P0: Full QA pass for balancing and edge cases
- [x] P1: Alien spawn quality pass (system-interior behavior, pacing, edge-density)
- [x] P1: Discovery pacing baseline (clear system gaps, no long dead zones)
- [x] P2: Visual polish pass after spawn/pacing lock (planets, nebulae, starfield)

## Core 4-Direction Migration
- [x] Camera follow with soft lag / rubber-band feel
- [x] Ship world-position as authoritative state
- [x] Objects, hazards, pickups with world coordinates
- [x] Projectile world-space foundation
- [x] Remove remaining screen-bound behavior (walls, edge ricochet assumptions)
- [x] Boss fully world-space (movement, spawn, attacks)
- [x] Convert remaining collision checks to world-space first
- [x] Finalize camera/encounter culling and spawn pressure for free-flight
- [x] Full QA pass for balancing and edge cases

## Architecture Cleanup Backlog (Core-Adjacent)
- [x] Extract status-effects module (burn, acid, shield-break side effects)
- [x] Extract enemy AI steering module (aggro acquire, chase, disengage memory)
- [x] Extract ship damage + mitigation module (armor/shield/type scaling)
- [x] Extract projectile-vs-target resolver (bullet/missile/plasma/boss projectile)
- [x] Extract hazard interaction module (planet/black-hole/station/hazard collision outcomes)
- [x] Extract object lifecycle module (destroy reasons, fragment spawn, pickup drops)
- [x] Extract world-space sync helpers into separate movement-utils file
- [x] Extract entity culling filters into dedicated culling module
- [x] Extract pickup simulation + collection module
- [x] Extract boss combat loop (DoT ticks, body collision, death transition)
- [x] Extract input-to-ship thrust integration into flight-control module
- [x] Extract debug toggles and debug-data formatting module
- [x] Move gameplay constants (distances, timers, damping) into tuned config file
- [x] Replace string-based destroy reasons with enum-like constants map
- [x] Add lightweight perf counters per update phase (movement/combat/cleanup)

## Future Features
- [x] HIGH PRIORITY: Visual overhaul pass (planets, nebulae, overall scene quality)
- [x] Discovery pacing: Sonnensysteme klar getrennt platzieren (spuerbare Reise zwischen Systemen)
- [x] Discovery pacing: trotzdem keine langen Leerlaeufe (maximale Suchdistanz bis naechstes System begrenzen)
- [x] Discovery pacing: Systemabstand adaptiv je Region (Core dichter, aussen weiter auseinander)
- [x] Interstellar Space: Zwischenraeume mit random Asteroidenfeldern, Truemmerclustern und Alien-Patrouillen beleben
- [x] Interstellar Space: dynamische Ereignisse zwischen Systemen (Ambush, Drift-Feld, Schrottspur)
- [x] Giftige Nebelwolken: raeumliche Gefahrenzonen mit DoT/Scanner-Sichtreduktion
- [x] Giftige Nebelwolken: klare Telegraphs/Farbcode und Gegenmassnahmen als spaetere Upgrades
- [x] Wurmloecher: Sprung zu weit entfernten Weltkoordinaten (stabile Ein-/Austrittspaare, seed-deterministisch)
- [ ] Missionen-System (leichtgewichtig): aktive Mission + Fortschritt + Belohnung
- [ ] Missionstyp: Zerstoere X bestimmte Gegnerklassen (z. B. miniAlien, alienShip)
- [ ] Missionstyp: Zerstoere X Objektklassen (smallRock, mediumRock, boulder, debris)
- [ ] Missionstyp: Lege Y Distanz in Weltkoordinaten zurueck
- [ ] Missionstyp: Ueberlebe Z Sekunden ohne Tod
- [ ] Missionstyp: Erreiche Zone/Orbit (annaehern an markierte Koordinate)
- [ ] Missionstyp: Zerstoere Spezial-Ziel (einmaliger Elite-Gegner)
- [ ] Spezial-Ziel auf Mini-Map markieren (Icon + Richtung + Distanz)
- [ ] Missions-Generierung seed-stabil pro Run-Start (deterministische Angebote)
- [ ] Belohnungen: Score, garantierte Drops, Upgrade-Reroll, seltene Buffs
- [ ] Missions-Schwierigkeit skaliert mit Boss-Level/Distanz vom Spawn
- [ ] Kettenmissionen: 2-3 Schritte mit steigender Belohnung
- [ ] Tagesmissionen/Run-Challenges (optional, ohne Online-Zwang)
- [ ] UI: kleines Missions-Widget (oben links), minimales Logging bei Fortschritt
- [ ] Fail-Conditions je Missionstyp (optional): Zeitlimit, Trefferlimit, no-hit Bonus
- [ ] Missionen nur ausserhalb von Level-Up/Boss-Choice Overlays aktualisieren
- [ ] I-Bildschirm: erweiterte Run-Statistiken (erkundete Chunks, Kills pro Gegnertyp, Top-Speed, Distanz)
- [ ] Comets: freie Kometenbahnen durch mehrere Chunks (elliptisch/hyperbolisch), mit Schweif-VFX
- [ ] Comets: seltene Stern-Orbits mit sehr grossem Radius (deutlich langsamer fern der Sonne)
- [ ] Rogue planet / brown dwarf (sehr selten): grosses, dunkles Objekt ohne lokales Planetensystem
- [ ] Derelict stations / Wracks als erkundbare Background-Makroobjekte (optional mit Loot-Events)
- [ ] Ion storms / plasma clouds als raeumliche Wetterzonen (Sicht + Projektilverhalten beeinflussen)
- [ ] Debris streams / meteor showers als gerichtete, temporale Flow-Objekte
- [ ] Mutterschiffe/Traegerschiffe: grosse Schiffe als seltene Elite-Begegnung
- [ ] Mutterschiffe/Traegerschiffe: Eskorte aus 3-5 normalen Schiffen beim Spawn
- [ ] Mutterschiffe/Traegerschiffe: spawnen neue Schiffe bis das Mutterschiff zerstoert ist
- [ ] Spezial-Asteroiden: Gold-Asteroid (Bonus-Punkte)
- [ ] Spezial-Asteroiden: Eisen-Asteroid (garantierter Panzerungs-Drop)
- [x] High-detail procedural planets (bands, craters, rim light, atmospheric scattering)
- [x] Rich nebula rendering (layered noise, color palettes, wisps, depth fade)
- [x] Improved starfield quality (twinkle variance, color temperature, density falloff)
- [x] Cinematic background composition rules per chunk (avoid flat empty scenes)
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
