# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um Vertragsmetadaten und einen Kündigungswecker erweitern — zweite Teilscheibe von Roadmap-Phase 10, direkt nach den virtuellen Töpfen (erste Teilscheibe).

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Backend: `npm run build` fehlerfrei, `npm test` → 16 Suites / 45 Tests grün.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei.
- **Kein Docker in dieser Session verfügbar** (weder Daemon noch `ssh` zum Mini-PC) — wie in der vorherigen Teilscheibe lief die Verifikation über lokal per `npm install` erzeugte `node_modules`. Migration `20260824230000_add_contract_metadata` von Hand geschrieben, nicht per `prisma migrate dev` gegen eine echte DB generiert.
- **Noch NICHT auf dem Mini-PC deployed.** Es stehen inzwischen **zwei** Migrationen aus (`add_savings_pots` aus der letzten Teilscheibe + `add_contract_metadata` aus dieser), zusätzlich ein Backend- und Frontend-Rebuild.
- Der Nutzer kümmert sich parallel selbst um die Mini-PC-Deploy-Voraussetzungen (Docker-Gruppenmitgliedschaft ohne `sudo`, Wiederherstellung der root-`.env` mit `POSTGRES_USER`/`PASSWORD`/`DB`/`DATABASE_URL` — diese Werte müssen aus den bereits laufenden Containern ausgelesen werden, nicht neu erfunden, sonst driftet Postgres von der bestehenden Datenvolume auseinander).
- Committed (siehe `git log`). **Push auf den Remote-Branch steht noch aus** — bitte vor Sitzungsende nachholen, falls noch nicht geschehen (Branch: `claude/remote-control-finanzplaner-gbmdlb`, kein Push auf `main` ohne Rückfrage — abweichend vom Muster früherer Sessions, die direkt auf `main` gepusht haben; siehe letzte Nutzer-Interaktion zu diesem Thema).

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus**, inkl. Backend + zwei Migrationen:
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. Visueller Check durch den Nutzer nach dem Deployment:
   - *Einstellungen* → Fixkosten-Formular → neuer Abschnitt "Vertragsdaten" (Vertragsnummer/Mindestlaufzeit-Ende/Kündigungsfrist).
   - Dashboard → bei mindestens einer betroffenen Regel: gelber Warn-Banner "⏰ Kündigungsfrist läuft bald ab" ganz oben.
   - Aus der vorherigen Teilscheibe weiterhin offen: *Einstellungen* → "Virtuelle Töpfe", Dashboard → "Rücklagen"-Karte.
3. **Bekannte UI-Lücke** (bewusst zurückgestellt, siehe `doku/LOG_DOKUMENTATION.md`): einmal gesetzte `contractEndDate`/`cancellationPeriodDays` lassen sich über das Formular nicht wieder löschen (leeres Feld = "unverändert", nicht "löschen"). Workaround: Regel pausieren (`active: false`). Falls das den Nutzer stört, wäre eine echte Clear-Funktion die nächste kleine Ergänzung.
4. Rest von Phase 10 (noch nicht begonnen): **Preiserhöhungs-Erkennung** (automatischer Indikator bei Erhöhungen wiederkehrender Beträge im Zyklusvergleich) — deutlich größerer Scope, braucht einen Vergleich historischer Beträge über mehrere Zyklen (z. B. Snapshot bei jedem `runDueRecurringTransactions`-Lauf oder Ableitung aus den gebuchten `Transaction`-Historien pro Regel).
5. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten drei Sessions nicht der Fall.

## Relevante Dateien/Pfade

- `backend/prisma/schema.prisma` — `RecurringTransaction` um `contractNumber`, `contractEndDate`, `cancellationPeriodDays` erweitert.
- `backend/prisma/migrations/20260824230000_add_contract_metadata/migration.sql` — von Hand geschrieben.
- `backend/src/recurring-transactions/dto/create-recurring-transaction.dto.ts`, `recurring-transactions.service.ts` — neue Felder, `contractEndDate`-Konvertierung in `create()` und `update()`.
- `frontend/src/lib/api/types.ts` (`RecurringTransaction`), `frontend/src/lib/api/recurringTransactions.ts` (`RecurringTransactionInput`) — neue Felder.
- `frontend/src/lib/budgetCalc.ts` — neu: `contractsNeedingCancellationNotice()`, Typ `CancellationNotice`.
- `frontend/src/pages/DashboardPage.tsx` — neuer Warn-Banner ganz oben.
- `frontend/src/components/settings/RecurringTransactionsPanel.tsx` — neuer optionaler Formularabschnitt "Vertragsdaten".

## Entscheidungen & Begründungen

- **Warnfenster fest auf 30 Tage** (`contractsNeedingCancellationNotice(recurring, windowDays = 30, ...)`) — kein UI zum Konfigurieren, um den Scope klein zu halten; als Parameter mit Default umgesetzt, falls später doch konfigurierbar gemacht werden soll.
- **Bereits verstrichene Kündigungs-Deadlines werden weiterhin angezeigt**, nicht herausgefiltert — wenn der Nutzer die Frist verpasst hat, soll die App das gerade dann noch deutlich zeigen, statt stillschweigend zu verschwinden.
- **Preiserhöhungs-Erkennung bewusst nicht in dieser Teilscheibe** — braucht eine Historie vergangener Beträge pro Regel (aktuell wird bei jedem Lauf nur der aktuelle `amount` überschrieben, es gibt keinen Snapshot-Verlauf). Das ist ein eigenständiges Datenmodell-Thema und wurde als eigene, spätere Teilscheibe zurückgestellt statt hier mit reingepackt.
- **Keine Clear-Funktion für die drei neuen Felder** (siehe TODO 3) — die Formular-Semantik "leeres Feld = unverändert" ist konsistent mit dem Rest des Formulars (z. B. wird auch `active` nie über ein leeres Feld zurückgesetzt), eine echte Lösch-Funktion hätte zusätzliche DTO-Semantik (`null` vs. `undefined` unterscheiden) gebraucht.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang** — Verifikation lief über lokales `npm install` statt `docker build`. Gleicher Hinweis wie in der vorherigen Teilscheibe: im Zweifel vor dem Mini-PC-Deploy zusätzlich `docker build` durchführen, wenn eine Umgebung es zulässt.
- **Root-`.env` auf dem Mini-PC** (`~/finanzplaner/.env`, neben `docker-compose.prod.yml`) muss `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`/`DATABASE_URL` enthalten — separat von `backend/.env` (das über `env_file:` eingebunden wird und JWT_SECRET etc. enthält). Falls diese root-`.env` fehlt: Werte aus den laufenden Containern auslesen (`docker exec <postgres_container> env | grep POSTGRES`), niemals neu erfinden — Postgres übernimmt `POSTGRES_USER`/`PASSWORD`/`DB` nur bei der Erstinitialisierung eines leeren Datenverzeichnisses, abweichende Werte brechen den Zugriff auf die bestehende Volume.
- **Zwei ausstehende Migrationen** vor dem nächsten `prisma migrate deploy`: `20260824220000_add_savings_pots` und `20260824230000_add_contract_metadata` — beide additiv/nullable, kein Datenverlust-Risiko, aber beide müssen durch sein, bevor die jeweiligen neuen Endpunkte/Felder produktiv genutzt werden.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
