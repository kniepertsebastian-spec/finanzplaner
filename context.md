# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um eine Preiserhöhungs-Erkennung für Fixkosten erweitern — dritte und letzte Teilscheibe von Roadmap-Phase 10, nach virtuellen Töpfen (Teilscheibe 1) und Vertragsmetadaten/Kündigungswecker (Teilscheibe 2). **Phase 10 ist damit code-seitig vollständig.**

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Backend: `npm run build` fehlerfrei, `npm test` → 16 Suites / 48 Tests grün.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei.
- **Kein Docker in dieser Session verfügbar** (weiterhin weder Daemon noch SSH zum Mini-PC) — Verifikation lief wie in den beiden vorherigen Teilscheiben über lokal per `npm install` erzeugte `node_modules`. Migration `20260825000000_add_previous_amount` von Hand geschrieben.
- Die ersten beiden Teilscheiben (virtuelle Töpfe, Vertragsmetadaten) sind **bereits auf dem Mini-PC deployed und verifiziert** — der Nutzer hat das selbst durchgeführt (Docker-Gruppenmitgliedschaft repariert, root-`.env` aus laufenden Containern wiederhergestellt).
- **Diese dritte Teilscheibe ist NOCH NICHT deployed.**
- **Branch-Hinweis:** Auf Nutzerwunsch wurde der Branch dieser Session per Fast-Forward direkt auf `main` gepusht (nicht nur auf den eigentlichen Feature-Branch `claude/remote-control-finanzplaner-gbmdlb`), damit der Nutzer ohne Branch-Wechsel `git pull` auf `main` nutzen kann — passend zum Muster früherer Sessions. Diesen aktuellen Commit ebenso behandeln, falls noch nicht gepusht (siehe `git log`/`git status` beim Sitzungsstart prüfen).

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus:**
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. Visueller Check durch den Nutzer nach dem Deployment: unter *Einstellungen* → Fixkosten den Betrag einer aktiven Ausgaben-Regel erhöhen, speichern, dann prüfen: lila "erhöht"-Badge in der Tabelle (mit Tooltip alt→neu) und lila Dashboard-Banner "📈 Preiserhöhungen erkannt". Danach das ×-Symbol am Badge klicken → Hinweis muss verschwinden.
3. **Phase 10 ist damit vollständig.** Nächster Schritt mit dem Nutzer klären: Phase 11 (Smarte Datenerfassung & Import: CSV-Import, OCR-Belegscan, Split-Transaktionen, Währungsumrechner) oder etwas anderes aus der Roadmap.
4. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten drei Sessions durchgehend nicht der Fall; dieses Environment hat außerdem keinen `ssh`-Client installiert und keine Route ins private LAN des Nutzers (per `/dev/tcp`-Test bestätigt).

## Relevante Dateien/Pfade

- `backend/prisma/schema.prisma` — `RecurringTransaction` um `previousAmount` (Int?) erweitert.
- `backend/prisma/migrations/20260825000000_add_previous_amount/migration.sql` — von Hand geschrieben.
- `backend/src/recurring-transactions/recurring-transactions.service.ts` — `update()` snapshottet `previousAmount` bei Betragsänderung; neue Methode `dismissPriceIncrease()`.
- `backend/src/recurring-transactions/recurring-transactions.controller.ts` — neuer Endpunkt `POST :id/dismiss-price-increase`.
- `frontend/src/lib/api/types.ts` (`previousAmount` auf `RecurringTransaction`), `frontend/src/lib/api/recurringTransactions.ts` (`dismissPriceIncrease()`).
- `frontend/src/lib/budgetCalc.ts` — neu: `priceIncreaseRules()`, Typ `PriceIncrease`.
- `frontend/src/pages/DashboardPage.tsx` — neuer lila Warn-Banner unterhalb des Kündigungswecker-Banners.
- `frontend/src/components/settings/RecurringTransactionsPanel.tsx` — "erhöht"-Badge mit Dismiss-Button in der Fixkosten-Tabelle.

## Entscheidungen & Begründungen

- **Erkennung nur bei manueller Betragsänderung durch den Nutzer**, nicht automatisch aus Bank-/Transaktionsdaten abgeleitet — die App hat bewusst keinen Bank-Pull (siehe Projekttitel in `claude/roadmap.md`). Der erwartete Workflow: Anbieter kündigt Preiserhöhung an → Nutzer trägt den neuen Betrag in die Fixkosten-Regel ein → App merkt sich automatisch den alten Wert und zeigt den Hinweis.
- **Eigener Dismiss-Endpunkt (`POST :id/dismiss-price-increase`) statt Löschen über den generischen `PATCH`-Pfad** — vermeidet dieselbe "leeres Feld = unverändert, nicht löschen"-Falle wie bei den Vertragsdaten-Feldern der vorherigen Teilscheibe (dort bewusst nicht gelöst; hier von Anfang an sauber gelöst, weil ein einzelnes Feld mit klarer Zurücksetzen-Semantik).
- **Nur Ausgaben-Regeln (`amount < 0`)** — ein steigendes Einkommen ist kein Warnsignal, daher aus `priceIncreaseRules()` ausgeschlossen.
- **`previousAmount` wird bei jeder Betragsänderung überschrieben**, nicht nur einmalig gesetzt — jede neue Änderung nach einem Dismiss erzeugt wieder einen frischen Vergleichswert; es gibt keine tiefere Historie über mehr als einen Schritt zurück (bewusst einfach gehalten, entspricht dem Roadmap-Wortlaut "im Zyklusvergleich", nicht einer vollständigen Preis-Historie).

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang** (bestätigt: kein `ssh`-Binary, `/dev/tcp`-Verbindungsversuch zur privaten LAN-IP des Mini-PCs läuft in einen Timeout — keine Netzwerkroute aus dieser Cloud-Umgebung ins Heimnetz des Nutzers, unabhängig von Zugangsdaten). Verifikation lief über lokales `npm install` statt `docker build`.
- **Drei Migrationen liegen inzwischen additiv aufeinander** seit Beginn von Phase 10: `add_savings_pots`, `add_contract_metadata`, `add_previous_amount` — alle nullable/additiv, kein Datenverlust-Risiko, aber `prisma migrate deploy` muss nach jedem Pull erneut laufen, bis alle durch sind.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
