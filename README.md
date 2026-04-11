# Copilot Workflow Notes (Rate-Limit Friendly)

- Keep prompts scoped to one change-set (e.g. audio only, orbit rules only).
- Prefer sequential changes over very large "everything at once" requests.
- Avoid opening multiple Copilot-heavy VS Code windows on the same repo at the same time.
- This repo includes `.copilotignore` to exclude heavy non-code assets from indexing.

# THAUMOR

Seitwaerts scrollender Space-Arcade-Roguelike-Shooter mit Raumschiff, Traegheit, Maus-Zielen und Schiessen.

## Features
- 4-Pfeiltasten-Steuerung mit Traegheit (kein permanentes Herunterfallen)
- Zielcursor folgt der Maus
- Schiessen mit Leertaste oder linker Maustaste
- Waffen getrennt: Geschuetz (Kugeln) + optional freischaltbarer kurzer Laserstrahl
- Soundeffekte (Laser, Explosionen, Schild, Level-Up, Upgrades)
- Grosse Planeten-Segmente tauchen oben/unten auf und verdecken einen grossen Teil des Spielfelds
- Mehr Rand-Gefahren: Raumstationen und Schwarze Loecher
- Gegner- und Gefahren-Spawns kommen aus allen Richtungen (360 Grad)
- Gegner, Randgefahren und Pickups nutzen intern bereits Weltkoordinaten (mit Kamera-Projektion auf den Screen)
- Das Schiff nutzt ebenfalls Weltkoordinaten als Basis; Screen-Position wird ueber die Kamera projiziert
- Unzerstoerbare Hindernisse: Weltraumschrott, grosse Felsbrocken
- Zerstoerbare Ziele: kleine Felsen, mittelgrosse Asteroiden, Mini-Aliens
- Mittelgrosse Asteroiden zerbrechen beim Abschuss in 3-5 zerstoerbare Splitter
- Wenn Objekte Planeten/Rand-Hindernisse beruehren, explodieren sie
- Punkte, Kills und Ueberlebenszeit
- Rogue-Like Progression: Level-Up mit 3 Upgrade-Optionen und exponentiell steigenden Anforderungen
- Startscreen mit Schiffsauswahl (Tank, Normal, Glaskanone)
- Schiff-Stats: HP, Krit-Chance, Krit-Schaden, Geschwindigkeit, Nachladerate, XP-Bonus

## Start
1. Datei index.html im Browser oeffnen.
2. Auf Spiel starten klicken.
3. Optional im Schwierigkeitsmenue den Welt-Seed setzen (oder zufaellig generieren), um Welten reproduzierbar zu machen.

## Multiplayer (erste Version)
- Diese erste Version synchronisiert Spielerposition/-rotation zwischen Browsern ueber WebSocket.
- Gameplay ist noch lokal autoritativ (MVP), Gegner/Progression werden noch nicht serverseitig synchronisiert.
- Multiplayer-Flow ist jetzt im Startmenue integriert (kein URL-Query-Zwang mehr): Multiplayer -> Raum beitreten -> Lobby (Ready/Start).

### Server starten
1. In [server/package.json](server/package.json) Verzeichnis wechseln: `cd server`
2. Abhaengigkeiten installieren: `npm install`
3. Server starten: `npm start`

### Windows Helper-Skript (empfohlen)
- Aus dem Projekt-Root starten: `./start-mp-server.ps1`
- Optional anderer Port: `./start-mp-server.ps1 -Port 8090`
- Wenn 8080 belegt ist, waehlt das Skript automatisch den naechsten freien Port (z. B. 8081).
- Exakten Port erzwingen (sonst Fehler bei Belegung): `./start-mp-server.ps1 -Port 8080 -StrictPort`
- Das Skript findet Node automatisch und installiert Abhaengigkeiten bei Bedarf.

### Multiplayer-Client starten
- Spiel normal starten und im Hauptmenue auf `Multiplayer` klicken.
- Pilot-Name, Raumname und Server-URL eintragen, dann `Join / Host Raum`.
- In der Lobby `Bereit` setzen; Host startet den Run, wenn alle bereit sind.

### Hinweis zum Hosting
- GitHub/Git speichert nur den Code, hostet aber keinen dauerhaft laufenden Node-WebSocket-Server.
- Fuer echtes Online-Multiplayer muss der Serverprozess auf einem erreichbaren Rechner laufen (eigener PC, VPS oder Cloud-Host).

### Singleplayer
- Standard ohne `mp=1` bleibt unveraendert Singleplayer.

## Eigene Grafiken (Sprites)
- Das Spiel laedt optional Bilder ueber [assets.js](assets.js).
- Lege deine Dateien in den Ordner [assets/README.md](assets/README.md) nach den dort genannten Dateinamen.
- Fehlende Dateien sind kein Problem: dann nutzt das Spiel automatisch die bisherigen Canvas-Formen (Fallback).
- PNG/WebP sind fuer Einheiten/Hindernisse empfohlen (Transparenz), JPG eher fuer Hintergruende.

## Modulstruktur (ohne Build-Tool)
- [config.js](config.js): Schiff- und Schwierigkeits-Definitionen
- [utils.js](utils.js): Mathe-/Hilfsfunktionen fuer Gameplay-Hotpaths
- [audio.js](audio.js): Sound-Engine und SFX-Presets
- [world.js](world.js): Chunk-Cache und deterministische Welt-/Hintergrund-Generierung
- [camera.js](camera.js): Freie 2D-Kamera und World->Screen Projektion
- [render.js](render.js): Rendering-Pipeline (Schiff, Gegner, Boss, VFX, HUD)
- [encounters.js](encounters.js): Spawn-System fuer Gegner/Randgefahren und Boss-Verhalten
- [menus.js](menus.js): Menue-UI fuer Schwierigkeits- und Schiffsauswahl
- [input.js](input.js): Keyboard-, Maus-, Touch- und Overlay-Input-Handling
- [progression.js](progression.js): Level-Up, Mastery-Milestones und Boss-Loot-Flow
- [weapons.js](weapons.js): Waffenlogik, Schussmuster, Cooldowns, Explosionseffekte
- [assets.js](assets.js): Asset-Manifest + Bild-Preload/Fallback
- [game.js](game.js): Spielzustand, Game-Loop, Kampf und Modul-Orchestrierung

## Steuerung
- Pfeiltasten: Schub in 4 Richtungen
- WASD: alternative Schubsteuerung
- Maus bewegen: Zielcursor
- Leertaste oder linke Maustaste halten: feuern
- Rechte Maustaste: Rakete (nach Freischaltung)
- H: Hitbox-Debug ein/aus
- O: Debug-Boost (+5 Waffenlevel fuer alle aktuell ausgeruesteten Systeme)
- B: Balance-Debug Panel ein/aus
- [ / ]: Im Balance-Panel Waffentrack wechseln
- - / +: Im Balance-Panel Faktor verringern/erhoehen
- 0: Im Balance-Panel Faktor auf x1.00 zuruecksetzen
- M: Desktop-Feuermodus umschalten (manuell/automatisch)
- P oder ESC: Pause/Fortsetzen

## Android / Touch
- Virtueller Joystick links fuer Bewegung
- Rechts auf dem Spielfeld halten: zielen + automatisches Dauerfeuer
- Doppelt tippen (rechts auf dem Spielfeld): Rakete
- Hochformat zeigt einen Dreh-Hinweis, Querformat ist fuer Gameplay optimiert

## Deployment (GitHub Pages)
- Workflow ist enthalten in [.github/workflows/pages.yml](.github/workflows/pages.yml)
- Nach Push auf `main` oder `master` deployed die Seite automatisch auf GitHub Pages

## Kampf-Feedback
- Boss-Warnung mit visuellem Banner vor Boss-Start
- Raketen-Cooldown nutzt praezise Echtzeit-Anzeige
- Rakete ist visuell klar erkennbar (am Schiff wenn bereit + als Raketenform im Flug)
- Geschuetz und Laser sind getrennte Waffenpfade
- Sichtbare Geschuetztuerme/Laseremitter drehen auf den Maus-Cursor

## Waffen
- Geschuetz: verschiesst Kugeln (mit Upgrades)
- Laser: kurzer Lichtstrahl (eigenes Unlock + Upgrades fuer Schaden/Reichweite/Piercing)

## Level-System
- Start bei Level 1
- Erstes Level-Up bei 100 Punkten
- Danach werden die Kosten adaptiv berechnet (nicht streng linear), mit Zielkorridor ca. 30-60 Sekunden pro Level je nach Performance
- Bei Level-Up pausiert das Spiel kurz und du waehlst 1 von 3 Upgrades

## Neues Balancing
- Spawn-Dichte skaliert mit Level (mehr Druck in hohen Stufen)
- Beim Betreten neuer Chunks loesen zusaetzliche Spawn-Bursts aus (seed-basiert)
- Punkte skalieren mit Level und bleiben nach Objektklasse unterschiedlich
- Upgrade-Auswahl nutzt Gewichtung: starke Upgrades sind seltener frueh, spaeter etwas wahrscheinlicher

## Boss-System
- Alle 10 Level startet ein Bosskampf
- Beim Boss verschwinden die meisten normalen Objekte, neue spawnen nicht nach
- Boss-Varianten: Tentakel-Alien, Warship, Carrier
- Boss-HP skaliert mit Level
- Boss hat eigene Projektile und eine HP-Leiste
- Boss-Phasen sind zufaellig aktiv und werden bei HP-Schwellen scharfgeschaltet
- Boss-Minions sind zufaellig aktiv und variieren nach Boss-Typ
- Boss-Loot ist nicht garantiert bei jedem Boss, kann aber zusaetzliche Spezial-Upgrades bringen

## Upgrade-Beispiele
- Schild (1 Treffer absorbieren, automatische Aufladung)
- Schild-Stacheln / Schild-Nova / schnellere Schild-Aufladung
- Zusaetzliche Laser (bis 3 Kanonen insgesamt)
- Schnellere Laser / engerer Laserspread
- Raketenwerfer (rechte Maustaste)
- Zielsuchende Raketen / Cluster-Raketen / groessere Raketen-Explosion

## Geschuetz-Mastery (Ricochet)
- Lvl 5: Kugeln prallen 1x ab
- Danach als Upgrade: weitere Abpraller moeglich (mehrfach)
- Lvl 10: Bei passenden Abprallern splitten Kugeln in zwei Bahnen
- Lvl 15: Ricochet-Ramp (Abpraller werden schneller und staerker)
- Lvl 20: Ricochet-Nova mit Zusatzsplittern bei spaeteren Abprallern

## Waffenlevel-Farben (WoW-Style)
- Weiss: Level 1-4
- Gruen: Level 5-9
- Blau: Level 10-14
- Lila: Level 15-19
- Orange: Level 20

## Upgrade-Auswahl
- Waffen-Upgrades zeigen eine Level-Vorschau (z.B. L4 -> L5)
- Wenn ein Upgrade einen Milestone erreicht, wird der Milestone-Effekt direkt im Auswahlfeld eingeblendet
- Waffenkarten im Level-Up-Fenster sind farblich nach der Zielstufe markiert

## Gameplay-Balance-Profile
- Per Konstante in [game.js](game.js) umschaltbar: `BALANCE_PROFILE_ID = "safe" | "medium" | "chaos"`
- Profile steuern die Basis-Skalierung pro Waffenlevel
- Live-Feintuning ist im Debug-Panel moeglich und wirkt auf weitere Level-Ups

## Idee fuer spaeter
- Soundeffekte
- Power-ups
- Schwierigkeit in Stufen
- Bessere Treffer-/Explosionseffekte
