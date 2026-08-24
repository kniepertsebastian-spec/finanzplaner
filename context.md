# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um virtuelle Töpfe (Rücklagen/Sinking Funds) erweitern — erste Teilscheibe von Roadmap-Phase 10, direkt nach dem code-seitigen Abschluss von Phase 9 (Cashflow-Projektion).

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Backend: `npm run build` fehlerfrei, `npm test` → 16 Suites / 42 Tests grün.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei.
- **Kein Docker in dieser Session verfügbar** (weder Daemon noch `ssh` zum Mini-PC) — Verifikation lief über lokal per `npm install` erzeugte `node_modules`, nicht über den sonst üblichen `docker build`-Weg. Migration `20260824220000_add_savings_pots` wurde von Hand geschrieben (nach dem Muster bestehender Migrationen), nicht per `prisma migrate dev` gegen eine echte DB generiert — sollte vor dem Live-Einsatz einmal gegen eine echte Postgres-Instanz laufen (z. B. beim Mini-PC-Deploy via `prisma migrate deploy`).
- **Noch NICHT auf dem Mini-PC deployed.** Diesmal ist zusätzlich zum Frontend-Rebuild auch ein **Backend-Rebuild + Migration** nötig (neue Tabelle `SavingsPot`) — anders als die letzten drei Phase-9-Teilscheiben, die rein frontend-seitig waren.
- Committed und gepusht (siehe `git log` für Commit-Hashes).

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus**, inkl. Backend:
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
   (Reihenfolge beachten: Migration kann vor oder nach `up -d backend` laufen, da rein additiv — aber vor dem ersten produktiven Aufruf von `/savings-pots` muss sie durch sein.)
2. Visueller Check durch den Nutzer nach dem Deployment: *Einstellungen* → neuen Abschnitt "Virtuelle Töpfe (Rücklagen)" prüfen (Anlegen/Bearbeiten/Löschen), danach Dashboard → neue Karte "Rücklagen" sowie die aktualisierte Caption der "Frei verfügbar"-Kachel.
3. Rest von Phase 10 (noch nicht begonnen): Vertrags-Metadaten (`cancellationPeriodDays`, `contractEndDate`, Vertragsnummer an `RecurringTransactions`), Kündigungswecker, Preiserhöhungs-Erkennung.
4. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind (war in den letzten beiden Sessions nicht der Fall) — nicht direkt als "nächster Schritt" annehmen.

## Relevante Dateien/Pfade

- `backend/prisma/schema.prisma` — neues Modell `SavingsPot` (+ Relation auf `User`).
- `backend/prisma/migrations/20260824220000_add_savings_pots/migration.sql` — von Hand geschrieben, nicht live generiert (siehe oben).
- `backend/src/savings-pots/` — neues Modul: `savings-pots.service.ts`, `savings-pots.controller.ts`, `savings-pots.module.ts`, DTOs, Spec-Tests. In `backend/src/app.module.ts` registriert.
- `frontend/src/lib/api/savingsPots.ts`, `frontend/src/lib/api/types.ts` (`SavingsPot`-Typ) — neuer API-Client.
- `frontend/src/components/settings/SavingsPotsPanel.tsx` — neu, in `frontend/src/pages/SettingsPage.tsx` eingehängt.
- `frontend/src/lib/budgetCalc.ts` — `availableIncome()` um dritten Parameter `lockedInPotsCents` erweitert (Breaking Change der Funktionssignatur, aber einziger Aufrufer `DashboardPage.tsx` mit angepasst).
- `frontend/src/pages/DashboardPage.tsx` — lädt zusätzlich `savingsPotsApi.list()`, neue "Rücklagen"-Karte, angepasste Caption.

## Entscheidungen & Begründungen

- **Töpfe verschieben kein echtes Geld** — `User.startingBalance`/`getBalance()` (Backend) bleiben unverändert. `amountCents` eines Topfs ist rein informativ/rechnerisch und wird nur clientseitig vom "Frei verfügbar" abgezogen (`availableIncome()`). Konsistent mit der Roadmap-Formel und einfacher als ein echtes Transfer-/Booking-System zwischen Konto und Topf.
- **Kein `RecurringTransaction`-artiger Cron/Automatik für Töpfe** — der Nutzer trägt den zurückgelegten Betrag manuell ein (PATCH auf `amountCents`), es gibt (noch) keine automatische monatliche Einzahlung. Das wäre eine Erweiterung, aber nicht Teil der Roadmap-Beschreibung für Phase 10 und hätte den Scope unnötig vergrößert.
- **`targetCents` ist rein optional und informativ** (Sparziel für die Fortschrittsanzeige) — beeinflusst `availableIncome()` nicht, nur `amountCents` sperrt Geld.
- **Migration von Hand geschrieben statt per `prisma migrate dev` generiert** — kein Docker-Daemon und keine lokale Postgres-Instanz in dieser Session verfügbar. Nach dem exakten Muster der `add_invoices`-Migration (eigene Tabelle, FK auf `User` mit `ON DELETE CASCADE`, Index auf `userId`) — strukturell niedriges Risiko, sollte aber beim ersten `prisma migrate deploy` gegen die echte Prod-DB beobachtet werden.
- **Kein neues npm-Package** — Fortschrittsbalken auf dem Dashboard ist handgeschriebenes Tailwind-Markup (kein Wiederverwenden von `BudgetProgressBar`, da dessen Ampel-Farblogik für Budgets — rot bei Überschreitung — semantisch falsch für ein Sparziel wäre, wo mehr = besser ist).

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): `docker-compose.yml` (Dev) und `docker-compose.prod.yml` liegen im selben Verzeichnis, gleicher impliziter Compose-Projektname + gleiche Volume-Namen. **Niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ausführen** ohne explizit `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang** — Verifikation lief über lokales `npm install` in `backend/` und `frontend/` statt `docker build`. Falls eine künftige Session denselben Mangel hat: derselbe Fallback funktioniert (Node/npm sind vorhanden), liefert aber keine 1:1-Garantie mit der tatsächlichen Docker-Build-Umgebung (z. B. Alpine/Node-Version-Unterschiede) — im Zweifel vor dem Mini-PC-Deploy zusätzlich `docker build` durchführen, wenn die Umgebung es zulässt.
- **`availableIncome()`-Signatur hat sich geändert** (jetzt 3 Pflichtparameter statt 2) — falls in einer künftigen Teilscheibe ein weiterer Aufrufer hinzukommt, `lockedInPotsCents` nicht vergessen.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
