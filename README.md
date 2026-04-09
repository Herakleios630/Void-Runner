# Void Runner

Seitwaerts scrollender Space-Arcade-Roguelike-Shooter mit Raumschiff, Traegheit, Maus-Zielen und Schiessen.

## Features
- 4-Pfeiltasten-Steuerung mit Traegheit (kein permanentes Herunterfallen)
- Zielcursor folgt der Maus
- Schiessen mit Leertaste oder linker Maustaste
- Waffen getrennt: Geschuetz (Kugeln) + optional freischaltbarer kurzer Laserstrahl
- Soundeffekte (Laser, Explosionen, Schild, Level-Up, Upgrades)
- Grosse Planeten-Segmente tauchen oben/unten auf und verdecken einen grossen Teil des Spielfelds
- Mehr Rand-Gefahren: Raumstationen und Schwarze Loecher
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

## Eigene Grafiken (Sprites)
- Das Spiel laedt optional Bilder ueber [assets.js](assets.js).
- Lege deine Dateien in den Ordner [assets/README.md](assets/README.md) nach den dort genannten Dateinamen.
- Fehlende Dateien sind kein Problem: dann nutzt das Spiel automatisch die bisherigen Canvas-Formen (Fallback).
- PNG/WebP sind fuer Einheiten/Hindernisse empfohlen (Transparenz), JPG eher fuer Hintergruende.

## Steuerung
- Pfeiltasten: Schub in 4 Richtungen
- WASD: alternative Schubsteuerung
- Maus bewegen: Zielcursor
- Leertaste oder linke Maustaste halten: feuern
- Rechte Maustaste: Rakete (nach Freischaltung)
- H: Hitbox-Debug ein/aus
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

## Idee fuer spaeter
- Soundeffekte
- Power-ups
- Schwierigkeit in Stufen
- Bessere Treffer-/Explosionseffekte
