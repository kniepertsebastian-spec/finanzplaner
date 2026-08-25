# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Nutzer bat darum, Phase 12 (UI/UX Redesign) und Phase 13 (Auswertungen, Tags & PWA-Power-Features) der Roadmap fertigzustellen, bevor Phase 7 (Datenexport/DSGVO/Unit-Tests, explizit ans Ende verschoben) angegangen wird. Diese Session arbeitete die verbleibenden Punkte beider Phasen einzeln als Teilscheiben ab (implementieren → verifizieren → dokumentieren → committen → pushen, pro Feature).

## Aktueller Stand

**Phase 12 (UI/UX Redesign & Modernes Dashboard) und Phase 13 (Auswertungen, Tags & PWA-Power-Features) sind beide vollständig abgeschlossen.**

Phase 12 (fünf Teilscheiben): Privacy-Mode (Blickschutz), Moderne Chart-Ästhetik (Bézier-Kurven, Farbverläufe, Donut-Chart, gestrichelte Prognoselinie), Kategorie-Icon-Badges, Micro-Interactions (Zähl-Animationen, Skeleton-Loader mit Shimmer, Datumsgruppierung "Heute"/"Gestern").

Phase 13 (sechs Teilscheiben): App Shortcuts, Batch-Bearbeitung in der Transaktionsliste, Projektbezogene Tags (`#Urlaub2026` etc.), Steuer-Marker & Jahres-Export (ZIP mit CSV + Belegen), Web Push Notifications (Budgetüberschreitung/Großbuchungen), Sankey-Geldflussdiagramm (handgebaute SVG-Komponente, siehe unten).

Alle elf Teilscheiben committed & gepusht auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main`. Backend-Testsuite komplett grün (80/80 nach der letzten Backend-relevanten Teilscheibe).

**⚠️ Drei neue Migrationen aus Phase 13 stehen noch aus** (`20260825050000_add_transaction_tags`, `20260825060000_add_tax_relevant`, `20260825070000_add_push_subscriptions`) — beim nächsten Deploy per `prisma migrate deploy` anwenden (Teil der Standard-Deploy-Befehle unten).

**⚠️ Web Push Notifications brauchen zusätzlich vom Nutzer gesetzte `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` in `backend/.env`** (Anleitung in `.env.example`: `npx web-push generate-vapid-keys`) — ohne das bleibt die Funktion inaktiv, aber nichts bricht.

**Sankey-Geldflussdiagramm — technischer Hinweis:** ursprünglich mit dem Plugin `chartjs-chart-sankey` versucht, aber dessen Layout-Algorithmus rendert die hier benötigte "1 Quelle → viele Ziele"-Topologie fehlerhaft (verifiziert per isoliertem Test-Render). Plugin wieder deinstalliert, stattdessen eine handgebaute SVG-Komponente (`frontend/src/components/charts/SankeyChart.tsx`) gebaut — Details siehe `doku/LOG_DOKUMENTATION.md`.

**Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session) — der komplette oben beschriebene Rückstand.

## Offene TODOs — Reihenfolge für den Rest dieser Session

Phase 12 und 13 sind vollständig abgeschlossen. Als Nächstes, laut Nutzerpriorisierung ("lets do the .csv at last", "we do phase 7 at the end"):

1. **CSV-Import** (Rest aus Phase 11) — wartet auf das echte Bank-CSV-Format des Nutzers, das noch nicht vorliegt. Ohne ein Beispiel-Export lässt sich kein sinnvoller Spalten-Mapper bauen — beim Fortsetzen zuerst beim Nutzer nachfragen bzw. auf eine bereits gelieferte Beispieldatei prüfen.
2. **Phase 7** (Datenexport/DSGVO, Kontolöschung, Frontend-Unit-Tests, Sentry/Error-Monitoring) — zuletzt, wie vom Nutzer explizit gewünscht.

Nach jedem einzelnen Punkt: Doku (`features.md`, `doku/LOG_DOKUMENTATION.md`, dieses `context.md`) aktualisieren, committen, auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main` pushen (etabliertes Muster dieser Session — Nutzer nutzt `main` für den Mini-PC-Pull).

## Deployment (gilt für den gesamten noch ausstehenden Rückstand dieser Session)

```
git pull
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d backend frontend
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

Weiterhin ausstehend aus vorherigen Sessions (unverändert):
- Nutzer muss "Miete"/"Kredit" manuell auf "Ausgabe" korrigieren (früherer Vorzeichen-Bug).
- Nutzer muss danach den Gesamtsaldo per "Saldo abgleichen" korrigieren.
- Nach dem nächsten Deploy: erster Cron-Lauf bucht ggf. mehrere Fixkosten auf einmal (gewolltes Verhalten aus einer früheren Teilscheibe).
- Für Web Push: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` in `backend/.env` setzen (siehe oben).

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hat weiterhin weder Docker-Daemon noch SSH-Zugang** — Verifikation läuft über `tsc`/`vite build`/`npm test` plus isolierten Playwright-Screenshots (teils echte Komponenten-Renders via esbuild-Bundle), nicht über einen echten Login/Dashboard-Aufruf.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.
- **`archiver`-Paket bewusst auf Major-Version 7 gepinnt** (nicht 8) — v8 ist ESM-only und passt nicht zum Backend-Setup (`module: commonjs`, kein `esModuleInterop`). Bei künftigen Dependency-Updates nicht versehentlich auf v8 hochziehen.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben.
