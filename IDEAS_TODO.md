# Ideas and TODO

## Daily Reminder
- [ ] At start of each work session: quickly review this file with user

## Current Priority Queue
- [ ] P1: Boss mechanics redesign pass (movement stability, arena behavior, attack readability)
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
- [x] HIGH PRIORITY: Mini-Map zeigt Chunk-Koordinaten mit Spawn-Ursprung (0,0)
- [x] Statusbalken unter Spieler/Gegnern (HP/Panzerung/Schild) mit V-Mode-Cycle (aus, Spieler, Gegner, beide)
- [x] Missionen-System (leichtgewichtig): aktive Mission + Fortschritt + Belohnung
- [x] Missionstyp: Zerstoere X bestimmte Gegnerklassen (z. B. miniAlien, alienShip)
- [x] Missionstyp: Zerstoere X Objektklassen (smallRock, mediumRock, boulder, debris)
- [x] Missionstyp: Lege Y Distanz in Weltkoordinaten zurueck
- [x] Missionstyp: Ueberlebe Z Sekunden ohne Tod
- [x] Missionstyp: Erreiche Zone/Orbit (annaehern an markierte Koordinate)
- [x] Missionstyp: Zerstoere Spezial-Ziel (einmaliger Elite-Gegner)
- [x] Spezial-Ziel auf Mini-Map markieren (Icon + Richtung + Distanz)
- [x] Missions-Generierung seed-stabil pro Run-Start (deterministische Angebote)
- [x] Belohnungen: Score, garantierte Drops, Upgrade-Reroll, seltene Buffs
- [x] Missions-Schwierigkeit skaliert mit Boss-Level/Distanz vom Spawn
- [x] Kettenmissionen: 2-3 Schritte mit steigender Belohnung
- [x] Tagesmissionen/Run-Challenges (optional, ohne Online-Zwang)
- [x] UI: kleines Missions-Widget (oben links), minimales Logging bei Fortschritt
- [x] Fail-Conditions je Missionstyp (optional): Zeitlimit, Trefferlimit, no-hit Bonus
- [x] Missionen nur ausserhalb von Level-Up/Boss-Choice Overlays aktualisieren
- [x] I-Bildschirm: erweiterte Run-Statistiken (erkundete Chunks, Kills pro Gegnertyp, Top-Speed, Distanz)
- [x] Comets: freie Kometenbahnen durch mehrere Chunks (elliptisch/hyperbolisch), mit Schweif-VFX
- [x] Comets: seltene Stern-Orbits mit sehr grossem Radius (deutlich langsamer fern der Sonne)
- [x] Rogue planet / brown dwarf (sehr selten): grosses, dunkles Objekt ohne lokales Planetensystem
- [x] Derelict stations / Wracks als erkundbare Background-Makroobjekte (optional mit Loot-Events)
- [x] Ion storms / plasma clouds als raeumliche Wetterzonen (Sicht + Projektilverhalten beeinflussen)
- [x] Debris streams / meteor showers als gerichtete, temporale Flow-Objekte
- [x] Mutterschiffe/Traegerschiffe: grosse Schiffe als seltene Elite-Begegnung
- [x] Mutterschiffe/Traegerschiffe: Eskorte aus 3-5 normalen Schiffen beim Spawn
- [x] Mutterschiffe/Traegerschiffe: spawnen neue Schiffe bis das Mutterschiff zerstoert ist
- [x] Spezial-Asteroiden: Gold-Asteroid (Bonus-Punkte)
- [x] Spezial-Asteroiden: Eisen-Asteroid (garantierter Panzerungs-Drop)
- [x] High-detail procedural planets (bands, craters, rim light, atmospheric scattering)
- [x] Rich nebula rendering (layered noise, color palettes, wisps, depth fade)
- [x] Improved starfield quality (twinkle variance, color temperature, density falloff)
- [x] Cinematic background composition rules per chunk (avoid flat empty scenes)
- [x] Larger playable area / viewport fill (use much more of browser window)
- [x] Enemy fleets/formations per chunk (coordinated groups)
- [x] Dynamic faction encounters and roaming patrol groups
- [x] Black hole in parallax layer 2 with gravity pull zone
- [x] Black hole event horizon that swallows entities crossing threshold
- [x] Distortion VFX/accretion ring for black holes
- [x] Optional: black hole influence on player ship (tunable)
- [x] Space stations orbiting planets
- [x] No free-floating station hazards (stations only as planet orbits)
- [x] Asteroid groups/fields as clustered encounters
- [x] Dense asteroid belts around planets
- [x] Enemy aggro + pursuit tuning pass (engage radius, follow persistence, speed)
- [x] Planet depth readability via atmosphere thickness by layer
- [x] Rear-layer suns (max 1 per chunk, varied stellar colors)
- [x] Early-game level-up pacing retune (avoid immediate level-up)
- [ ] Multiplayer co-op mode (online)
- [ ] Multiplayer PvP / versus arena mode
- [ ] Long-term ship silhouette pass by class archetype (e.g. carrier more rectangular)
- [ ] Long-term art pipeline: replace placeholder ship visuals with PNG sprite set

## Multiplayer Implementation Roadmap
- [x] Multiplayer MVP basis: WebSocket server + remote ship snapshots
- [x] Multiplayer helper script for local hosting with auto-port fallback
- [x] Start menu: Singleplayer/Multiplayer entry split
- [x] Multiplayer menu: pilot name + room name + server URL input
- [x] Multiplayer menu: Host/Join flow without URL query params
- [x] Lobby layer: ready state + player list before run start
- [x] Host-only run setup (difficulty/seed), clients wait for config
- [x] Client flow: only ship selection after host setup sync
- [ ] Server authority phase 1: player movement + reconciliation
- [ ] Server authority phase 2: enemy spawns/combat/projectiles authoritative
- [ ] Co-op run state sync: score, missions, progression, drops
- [ ] Reconnect handling and late-join behavior
- [ ] Public deployment: HTTPS + WSS reverse proxy + persistent process

## Multiplayer + Class Overhaul (Planning, no implementation yet)

### P0 - Planning Artifacts
- [ ] Define final target architecture: host-authoritative simulation + client input relay + shared world snapshots
- [ ] Define migration phases with rollback-safe checkpoints (no big-bang rewrite)
- [ ] Define data contracts for network events (`state`, `world_state`, `player_action`, role abilities)
- [ ] Define determinism constraints (seed behavior, chunk transitions, spawn/re-spawn rules)

### P0 - Combat Visibility/Readability Sync
- [x] Sync all combat VFX between players (shots, impacts, explosions, DoT visuals, buff/debuff visuals)
- [x] Ensure remote weapon orientation is shown independently from hull orientation
- [x] Add net-debug overlay toggle for snapshot age, packet loss hints, and authority source markers

### P0 - Test Sandbox Seed
- [ ] Seed `1` special mode: full world generation but enemies are passive (no movement, no shooting)
- [ ] Restrict passive mode strictly to seed `1` for deterministic debug/repro sessions
- [ ] Add clear HUD/debug label that passive test mode is active

### P1 - Territory/Conquest Core Loop
- [ ] Replace random ambient enemy spawn logic with territory state model (`hostile`/`friendly`) per chunk
- [ ] Default rule: chunks start hostile; entering/clearing converts chunk to friendly
- [ ] Define hostile chunk spawn trigger when entered and currently unspawned
- [ ] Define interstellar void rule: remains hostile baseline; supports Minecraft-like spawn/despawn window
- [ ] Define reactivation distance rule for void chunks (candidate: >5 chunks away)
- [ ] Add chunk state persistence policy for run/session (memory + optional future save)

### P1 - Planet Influence and Capture Rules
- [ ] Planet proximity pacification rule (candidate: friendly when player approaches within configurable range)
- [ ] Planet exception rule: if orbital defenses/stations exist, pacification requires defense clear
- [ ] Orbital station behavior: defender spawning (drones/bombers/interceptors)
- [ ] Add first conquest mission set (capture orbit, clear station defenses, hold zone)

### P1 - Shared Vision/Fog of War
- [ ] Add team-vision system: discovered/visible area shared via allied sensors
- [ ] Add scout role hooks for vision extension, marking, and intel utility
- [ ] Scout minimap rule (V1): no permanent enemy dots; enemy direction reveal only via active recon ping
- [ ] Recon ping visual language: enemy direction arrows flash in pink on minimap for short duration
- [ ] Define UI language for visible vs unknown vs previously discovered space

### P1 - Weapon Group Controls
- [ ] Add selectable weapon groups on keys `1-6`
- [ ] Support 1-3 active groups for most ships with per-group enable/disable state
- [ ] LMB fires only currently enabled groups
- [ ] Auto weapons rendered as disabled/greyed and excluded from manual group toggles
- [ ] Sync weapon-group state in multiplayer (authoritative owner, replicated to peers)

### P2 - Role Class Framework (WoW + EVE inspired)
- [ ] Finalize initial class roster: Dreadnought (Tank), Carrier (Summoner/Support), Engineer-Medic (Healer), Scout (Recon), Torpedo Boat (Burst), Brawler (Close DPS)
- [ ] Define class identity sheet per role (core passive, mobility profile, durability profile, team value)
- [ ] Define slot budget and tradeoff model per class (offense/defense/utility caps)
- [ ] Define role-specific progression paths compatible with roguelike runs

### P2 - Class Ability Packages
- [ ] Dreadnought package: aggro emitter, directional defense, siege mode
- [ ] Carrier package: drone wings as slot entities, launch/recall/rearm lifecycle
- [ ] Engineer-Medic package: repair beam, shield transfer, overclock, emergency field
- [ ] Scout package: mark target, ECM, cloak window, sensor boost
- [ ] Torpedo Boat package: lock-on, salvo, long-range torpedoes, mines
- [ ] Brawler package: short beam, flame cone, heat-risk overdrive, ram options

### P2 - Carrier Tactical Layer
- [ ] Carrier tactical map mode (inspired by WoWS style squadron control)
- [ ] Squadron model: up to 6 slots, each chosen drone type contributes 2 squadrons
- [ ] Squadron lifecycle: launch, payload use, return-to-carrier, reload, attrition/death recovery
- [ ] Multiplayer authority for squadron AI and target calls

### P2 - Aggro/Threat System Redesign
- [ ] Introduce explicit threat table per enemy (damage, taunt, proximity, support threat)
- [ ] Tank mechanics increase threat generation and control windows
- [ ] Healer/support actions generate controlled threat (tunable)
- [ ] Add threat debug tooling for balancing in co-op

### P3 - Weapon Catalog Evolution
- [ ] Tag-based weapon taxonomy (`Drone`, `Beam`, `Explosive`, `Support`, `Defensive`, etc.)
- [ ] Shared weapon pool for all classes (balanced by role modifiers and slot constraints)
- [ ] Exclusive class weapon pools (carrier drones, logistics tools, siege modules, recon systems)
- [ ] Tag-driven upgrade system (`+Drone HP`, `Beam chain`, etc.)

### P3 - Mission and Meta Expansion
- [ ] Conquest mission families (capture, defend, intercept, clear orbit)
- [ ] Role-synergy objectives (tank hold, healer sustain, scout intel, dps burst windows)
- [ ] Boss mechanics designed around multiplayer role interaction

### P4 - Long Horizon
- [ ] Buildable orbital defenses around captured planets (late feature)
- [ ] Enemy counter-offensives and re-capture logic for orbital territories
- [ ] Faction-level territory pressure simulation across long runs/campaign

## Locked Design Decisions (2026-04-11)

### Multiplayer Authority
- [x] Target architecture long-term: dedicated authoritative server (no host-required simulation)
- [x] Transitional architecture: host-authority remains until dedicated server rollout
- [x] Host migration required later for host-client mode fallback
- [x] Late join is required (join during ongoing run)
- [x] Priority: responsiveness over strict fairness for co-op feel

### Conquest / Chunk Rules (V1)
- [x] Default hostile world with safe-zone exception around origin
- [x] Safe zone fixed: 3x3 chunks around 0,0 (origin + adjacent 8)
- [x] Empty hostile chunk converts to friendly on first player entry
- [x] Spawned hostile chunk converts to friendly only after all spawned enemies are cleared
- [x] Add debug visualization for chunk state in hitbox/debug mode
- [x] Friendly chunks stay friendly for run duration (re-capture model postponed)
- [x] Void remains hostile baseline (no friendly conversion loop)
- [x] Void respawn/reactivation distance baseline: 5 chunks (outside minimap and scout sight envelope)

### Planet / Orbit Rules (V1)
- [x] Planet pacification proximity baseline: 800 world units (tune with playtests)
- [x] Planet with orbital defenses/station cannot pacify until defenses are destroyed
- [x] Orbital stations use squadron budget model (3-6 squads before long cooldown)
- [x] Fast relaunch allowed while squads survive; destroyed squads require rebuild timer
- [x] Visual squadron health concept: mini-ship members as visible HP units
- [x] Planet archetypes approved (civilian, military, pirate, etc.)

### Role-Class Scope (V1)
- [x] First class release limited to 3 roles for stability: Tank, Healer, Torpedo-DPS
- [x] Balance target is multiplayer-first; solo intentionally harder for role specialization
- [x] Shared + class-specific loadout split accepted as initial balancing direction (to be tuned)

### Aggro / Threat Rules (V1)
- [x] Tank taunt is forced target for X seconds and sets tank to top threat
- [x] Tank baseline has strong passive threat boost
- [x] Healer generates light threat; untapped enemies may prefer healer until tank tags them
- [x] Threat tracking preference: per-enemy if performance allows, fallback per-group
- [x] Bosses are not immune to taunt mechanics

### Weapon Groups / Controls (V1)
- [x] Weapon group behavior is class-dependent
- [x] Group activation count baseline: 3 active groups (class-specific overrides allowed)
- [x] Carrier exception: one squadron actively controlled, others run passive patrol logic
- [x] Healer tools are weapon-group items (same control framework)
- [x] Visual direction approved: strong support VFX (nano-bot streams, shield-transfer beams)

### Carrier Tactical Layer (Planned)
- [x] Tactical map mode confirmed
- [x] 6-slot cap confirmed (initially fixed)
- [x] Carrier remains vulnerable during tactical control
- [x] Team vision sharing from carrier assets confirmed
- [x] Carrier should rely heavily on ally-provided vision

### Seed-1 Testbox
- [x] Seed `1` = passive enemies (no movement/shooting) with normal world generation
- [x] Debug/H mode in seed `1` includes god mode for systems testing
- [x] Primary target mode is singleplayer debug
- [x] Optional friend/ally simulation hooks allowed later for vision/heal testing

### Next Design Questions (Before Coding Wave)
- [ ] Define exact late-join snapshot contract (what gets full sync vs incremental sync)
- [ ] Define dedicated server rollout phases and host-mode compatibility window
- [ ] Define orbit re-capture trigger set (boss event, mission event, faction pressure, timer)
- [ ] Define threat computation budget limits (entity caps + fallback strategy)
- [ ] Define squadron rebuild economy (time-only vs resource-based)

## V1 Design Spec (Implementation Target)

### A) Multiplayer Event Contract V1
- Authority model (transition): host-authoritative world simulation, clients send intent/input only.
- Mandatory client -> authority events:
	- player_state: world position, velocity, hull orientation, weapon aim orientation, hp/armor/shield.
	- player_action: fire-group requests, ability requests, target requests.
	- role_action: taunt, heal beam start/stop, torpedo lock/salvo requests.
- Mandatory authority -> clients events:
	- world_state: entities, projectiles, combat VFX, pickups, mission state, territory state deltas.
	- room_state: lobby/run phase, ready, host or authority identity.
	- progression_state: shared score and run progression; per-player hp and class resources.
	- territory_delta: chunk hostile/friendly transitions and orbit capture transitions.
- Late join sync flow:
	- step 1 full snapshot: world + players + missions + territory + role cooldowns.
	- step 2 delta stream: normal world_state cadence.
	- step 3 input unlock: joiner can act only after snapshot ack.

### B) Territory State Machine V1
- Chunk states:
	- safe: only for origin 3x3 zone around 0,0.
	- hostile_unspawned: hostile but spawn group not yet instantiated.
	- hostile_active: hostile with active enemy set.
	- friendly: cleared or pacified for current run.
	- void_hostile: interstellar baseline, always hostile logic.
- Transition rules:
	- hostile_unspawned -> friendly when entered and no spawn is instantiated.
	- hostile_unspawned -> hostile_active when spawn trigger fires.
	- hostile_active -> friendly when spawned enemy set reaches zero.
	- friendly persists for run (re-capture deferred to later phase).
	- void_hostile uses distance-based despawn/respawn (baseline 5 chunks).
- Debug requirements:
	- H/debug overlay colors each chunk by state.
	- overlay shows chunk coords, state, spawn-budget, alive enemy count.

### C) Threat Model V1
- Preferred mode: per-enemy threat table (fallback: per-group if perf budget exceeded).
- Threat sources:
	- direct damage: primary threat source.
	- tank taunt: instant top threat + forced target for X seconds.
	- tank taunt bonus window: reduced incoming damage from taunted targets for a short duration.
	- healer actions: low steady threat; untapped enemies may pick healer until tank tags.
	- proximity pulse (low weight) to prevent target idling.
- Boss behavior:
	- bosses are tauntable.
	- taunt applies forced target window but boss can resume threat table after expiry.
- Performance guardrails:
	- cap tracked threat entries per enemy.
	- decay threat periodically for inactive players.
	- degrade to per-group mode when active enemy count crosses threshold.

### C.1) Threat Readability V1
- Enemy health bars should visualize threat state directly.
- Role-aware frame color mapping:
	- Tank view: white frame = has aggro, orange frame = no aggro.
	- Healer/DPS view: orange frame = has aggro, white frame = no aggro.
- Team actions should appear as short debuff/status indicators (for example taunted, marked, shield-break).
- Indicator text/icons must stay readable in high-action moments (short labels, clear color coding).
- Snapshot age indicator (debug-only): shows how old the latest authority snapshot is (in ms) to diagnose desync/stutter.

### D) Roles V1 (2 active + 1 passive baseline)
- Tank (Dreadnought profile):
	- passive: fortified hull, high base threat multiplier.
	- active 1: taunt emitter (forced target window).
	- active 2: directional bulwark (front mitigation cone).
- Healer (Engineer-Medic profile):
	- passive: repair efficiency bonus.
	- active 1: nano-repair stream (hp or armor sustain beam).
	- active 2: shield transfer pulse (burst shield support).
- Torpedo DPS (Torpedo boat profile):
	- passive: long-range ordnance bonus.
	- active 1: target lock (improves torpedo tracking/hit chance).
	- active 2: salvo release (burst torpedo package).
- Shared constraints:
	- weapon groups remain class-aware.
	- max active groups baseline 3.
	- support tools are weapon-group controlled.
	- each class gets one class ability on dedicated key (default: F).

### D.1) Input Rebinding V1
- Options menu must support full key rebinding.
- Rebind scope V1:
	- movement
	- pause/menu
	- weapon groups
	- class ability key
	- debug toggle
- Add restore-defaults action.
- Persist keybinds locally per player profile.

### D.2) V1 Role Utility Extras
- Add short team ping wheel (quick tactical communication).
- Ping categories baseline:
	- focus target
	- need heal
	- taunt now
	- fall back
	- defend point
	- attack point
- Scout utility extension (recon ping):
	- Scout triggers sonar-style pulse (U-boot feel) to reveal nearby enemy headings briefly
	- Reveal uses heading arrows only (not exact enemy marker lock)
	- Minimap reveal color is pink to distinguish recon intel from normal markers

### E.1) Orbit Pressure and System Clear Loop
- Introduce per-system orbit pressure score (enemy control level).
- Clearing planets and orbital defenses reduces pressure.
- A system is considered clear when all planets in that system are liberated.
- Clear-state reward can include mission unlock, progression buff, or future system generation trigger.
- Post-V1 expansion path: generate or reveal new adjacent systems after full clear.
- Post-V1 conflict path: hostile neighboring systems can launch attack missions against liberated systems.

### E) First Technical Milestones (Code Order)
- [ ] Milestone 1: authoritative late-join snapshot pipeline (full snapshot + ack + unlock)
- [ ] Milestone 2: chunk state machine + debug overlay visualization
- [ ] Milestone 3: threat table core + taunt + healer low-threat hooks
- [ ] Milestone 4: three-role kits (Tank/Healer/Torpedo) using current combat pipeline
- [ ] Milestone 5: weapon-group controls refactor for role-aware activation

## V1 Control Spec

### 1) Default Keymap and Rebinding Matrix
- Movement: `W`, `A`, `S`, `D`
- Fire active weapon groups: `LMB`
- Weapon groups toggle/select: `1`-`6`
- Class ability: `F`
- Pause/menu: `Esc`
- Ping wheel: `Middle Mouse` (hold) or configurable alternate
- Debug toggle: `H`
- Rebinding rules:
	- single key cannot be bound to conflicting core action without warning
	- reserved safety actions (`Esc`) require explicit override confirm
	- full reset-to-default option always available

### 2) Threat Bar Legend (Enemy HP Bars)
- Bar frame states:
	- tank POV: white = you hold aggro, orange = target is on someone else
	- healer/DPS POV: orange = target is on you, white = target not on you
- Optional secondary marker: small arrow/diamond indicating current primary target player
- Debuff/status chips on bar (short duration):
	- TAUNT
	- MARK
	- SHIELD-BREAK
	- HEAL-BLOCK (future)

### 3) Minimal HUD by Role (V1)
- Tank HUD focus:
	- taunt cooldown
	- taunted-target count
	- mitigation window timer
- Healer HUD focus:
	- selected ally target
	- heal stream uptime/cooldown
	- emergency pulse cooldown
- Torpedo HUD focus:
	- lock status
	- salvo readiness
	- ammo/reload cadence
- Shared HUD additions:
	- weapon group active/inactive states
	- class ability cooldown ring
	- ping notifications with short directional hint

## V1 Numeric Baselines (Proposal)

### 1) Taunt + Threat Numbers
- Taunt forced-target duration: `3.5s`
- Tank defensive window vs taunted enemies (DR): `25%` for `2.5s`
- Taunt cooldown baseline: `14s` (candidate early-test variant: `8s`)
- Taunt threat injection: set tank threat to `current top + 30%`
- Passive tank threat multiplier: `1.45x`
- Healer threat from effective healing: `0.12` per healed point
- Healer overheal threat factor: `0.02` (2% of normal heal threat)
- Threat decay (inactive target): `12% per second`
- Performance fallback trigger: switch to group-threat mode when active enemies > `120`
- Threat warning readability: enemy bar frame should blink briefly when tank is close to losing aggro
- DPS aggro policy: DPS can pull aggro if tank threat uptime is weak
- Healer aggro policy: healer should pull aggro only in rare edge cases

### 2) Orbit Pressure + System Clear Numbers
- Pressure range per system: `0..100` (100 = fully hostile)
- Initial pressure for new hostile system: `100`
- Event pressure deltas:
	- clear hostile chunk group: `-4`
	- clear defended chunk group: `-8`
	- destroy orbital station: `-20`
	- liberate defended planet orbit: `-25`
	- lose a previously friendly orbit zone (future re-capture model): `+10`
- System clear condition (V1, locked):
	- all planets in system liberated
	- pressure <= `15` (forgiving baseline)
	- practical interpretation: remaining free-roaming enemies may exist, but most hostile presence must be cleared
- Post-clear neighboring attack mission roll (future hook):
	- evaluate every `6-9 min`
	- base chance `25%` if adjacent hostile system exists

### 3) Ping System Numbers
- Personal ping cooldown: `2.5s`
- High-priority ping cooldown (`need heal`, `taunt now`): `4.0s`
- World marker lifetime: `4.0s`
- Minimap marker lifetime: `6.0s`
- Max active team pings displayed simultaneously: `4`
- Duplicate suppression window (same sender/type): `1.0s`
- Scout recon ping (class ability) baseline:
	- cooldown: `12.0s`
	- reveal radius: `2000 WU`
	- reveal lifetime: `3.5s`
	- reveal payload: heading arrow + rough distance band (no exact position lock)
	- minimap color: `pink`

### 4) Snapshot Age Indicator (Debug-only) Thresholds
- Green: `< 90ms`
- Yellow: `90-180ms`
- Red: `> 180ms`
- Stale warning flash: `> 350ms`
- Display format: `NET AGE: <value>ms` in debug panel only

## Ongoing Idea Loop
- [x] Team preference: agent should proactively suggest mechanics and design improvements each planning session.
- [ ] Start each planning session with 3 high-impact mechanic proposals:
	- one combat proposal
	- one progression or mission proposal
	- one multiplayer readability or UX proposal
- [ ] Track accepted proposals under the relevant roadmap phase immediately after alignment.

## Naming Direction
- [x] Working title/acronym selected: THAUMOR
- [x] THAUMOR expansion selected: Threat, Hazard And Universe Mapping: Orbital Recon

## Accepted Proposal Notes (2026-04-11)
- [x] Conquest chain mission structure accepted as strong progression direction.
- [x] Threat readability via enemy health bar framing accepted.
- [x] Team action readability via brief debuff/status markers accepted.
- [x] Snapshot age indicator accepted as debug-only metric.
- [x] Tank taunt protection window accepted (short DR vs taunted enemies).
- [x] Orbit pressure + full system clear loop accepted.
- [x] Neighboring hostile system attack missions accepted as future mission layer.
- [x] Tactical ping system accepted for co-op communication.
- [x] Scout minimap intel should be active-only via pink sonar ping (no permanent enemy minimap reveal).
- [x] THAUMOR acronym accepted as current naming direction.
- [x] Easter egg concept accepted: optional late-endgame mega boss "Oma Ruth" (very high difficulty, near-unbeatable feel, no mandatory encounter).

## Easter Egg Concepts (No implementation yet)
- [ ] Optional late-endgame spawn path for "Oma Ruth" encounter (rare trigger, not required for run completion)
- [ ] Balance target: boss should feel almost unbeatable without perfect build/team execution
- [ ] Keep design details open for later (visual style, attacks, arena rules)

## Easter Egg Boss Spec V1 (Planning Only) - "Oma Ruth"

### 1) Role and Intent
- Encounter type: optional late-endgame raid-style boss event, never required to finish a run.
- Intended feeling: grotesque bio-horror + absurd drama energy, highly dangerous but readable.
- Design guardrail: boss is an original THAUMOR encounter (no direct lift from external IP).

### 2) Unlock and Spawn Rules
- Spawn is disabled before late-endgame pressure threshold is reached.
- Candidate unlock baseline (all must be true):
	- system pressure <= 10 in at least 3 different systems
	- at least one defended orbital station destroyed in current run
	- team run-time >= 35 minutes
- Spawn chance check after each additional cleared system once unlocked:
	- base chance: 8 percent
	- pity increase: +4 percent per failed roll
	- hard cap: guaranteed by 5th roll after unlock
- Encounter entry appears as optional anomaly marker "Domestic Distress Signal".
- If players ignore marker, run continues normally with no penalty.

### 3) Arena and Pacing
- Arena type: corrupted service-orbit around a decayed megastructure.
- Boundaries: shrinking hazard ring in phase transitions to prevent full-kite trivialization.
- Add pressure: ambient clutter + toxic sweep lanes, but capped entities per frame.
- Expected duration target:
	- coordinated team: 6-10 minutes
	- underprepared team: likely wipe within 2-4 minutes

### 4) Core Combat Identity
- Boss profile: extreme durability, oppressive area denial, periodic emotional burst windows.
- Threat profile: high anti-heal pressure, anti-kite mechanics, heavy punishment for stack play.
- Readability rule: every lethal pattern has a distinct telegraph color and audio cue.

### 5) Phase Kit
- Phase 1 "Inspection Sweep" (100-70 percent HP):
	- attack A: Caustic Cleanser Arc (wide cone acid sweep)
	- attack B: Scrubber Charge (slow wind-up line slam with knockback)
	- mechanic: grime stacks on players reduce handling until cleansed by movement objective
- Phase 2 "Public Meltdown" (70-35 percent HP):
	- attack A: Shame Wail pulse (short scanner distortion + aim jitter)
	- attack B: Laundry Cyclone drones (orbiting adds that apply drag fields)
	- mechanic: compression rings close in and reopen on timer
- Phase 3 "Hysteric Overdrive" (35-0 percent HP):
	- attack A: Toxic Overflow carpets (layered hazard tiles with delayed ignition)
	- attack B: Final Audit beam lattice (rotating beam pattern + safe wedges)
	- enrage timer: damage/speed ramp after 120 seconds in phase 3

### 6) Co-op Counterplay Expectations
- Tank:
	- keep forced-target uptime during Scrubber Charge and beam lattice setup
	- rotate mitigation into cone sweeps to protect revive windows
- Healer:
	- pre-shield before Shame Wail and Overflow ignition windows
	- maintain anti-DoT triage priority on highest grime stacks
- Torpedo DPS:
	- burst on exposed windows after charge misses and ring reset moments
	- reserve salvo for phase transitions to shorten dangerous overlap windows
- Scout:
	- recon ping highlights safe approach vectors during lattice and cyclone clutter
	- mark add priority targets when drone count spikes

### 7) Failure and Accessibility Rules
- Wipe condition: full team down or arena collapse timer reached.
- Accessibility fallback option (optional setting): keep same mechanics, reduce damage by 15 percent.
- No mandatory victory dependency in progression chain.

### 8) Reward Model (High Risk, Optional)
- Guaranteed reward on first kill per run: one unique relic-tier choice.
- Repeat kills in same run: high score bonus + rare crafting token only.
- No mandatory power progression locked behind this encounter.
- Cosmetic unlock candidate: "Household Hazard" ship trail/theme set.

### 9) Technical and Performance Guardrails
- Maintain deterministic spawn seed behavior once anomaly marker appears.
- Hard-cap add spawns and hazard tile generation per frame.
- Use pooled VFX for phase hazards to avoid frame spikes.
- Multiplayer authority source remains host or server authority only (clients receive state).

### 10) Open Design Questions (Later)
- Final visual language pass for silhouette/readability at high clutter.
- Exact lore framing and dialogue tone.
- Final numeric tuning for solo viability vs co-op expectation.
- Decide whether pity counter persists only run-local or across session.

## Notes
- Add new ideas as checklist items here so they can be tracked and checked off.
- 2026-04-10: Added core perf safeguards (spawn-per-frame caps, background draw budgets) to keep headroom for future visual upgrades.
