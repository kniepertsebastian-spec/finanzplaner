# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Fixkosten-Regeln sollen bereits zu Beginn des Abrechnungszeitraums (z. B. am 23. bei `monthStartDay = 23`) vollständig als Transaktion gebucht sein, statt tröpfchenweise am jeweiligen Kalendertag der Fälligkeit über den Monat verteilt zu erscheinen — direkter Nutzerauftrag nach mehreren Runden Live-Test-Feedback zum bestehenden Fixkosten-System.

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Backend: `npm run build` fehlerfrei, `npm test` → 16 Suites / 58 Tests grün (55 vorher + 3 neue für die geänderte `isDue()`-Logik).
  - Kein Frontend-Code betroffen, keine Migration nötig — reine Verhaltensänderung des bestehenden täglichen Cron-Jobs (`RecurringTransactionsService.handleDailyCron()` / `runDueRecurringTransactions()`).
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session).
- **Diese Session hat außerdem mehrere kleinere Bugfixes/Anpassungen aus einer Live-Test-Runde des Nutzers gemacht** (siehe `doku/LOG_DOKUMENTATION.md` für Details, jeweils eigene Einträge): Vorzeichen-Doppelnegation bei manuell eingegebenem Minus, neue "Fixkosten (aktueller Zeitraum)"-Kachel, Beleg-Upload statt nur Kamera bei OCR, "Netto (Zeitraum)"-Kachel entfernt. Alle bereits gepusht, alle noch nicht deployed.

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus** (deckt jetzt auch diese und die vorherigen ungedeployten Änderungen ab):
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. **Wichtig — nach diesem Deploy erwartungsgemäß ungewohntes Verhalten:** Beim ersten Cron-Lauf (täglich 1 Uhr) werden voraussichtlich mehrere, bisher noch nicht gebuchte Fixkosten-Regeln auf einmal als Transaktionen erscheinen — alle, deren Fälligkeit im *laufenden* Zeitraum liegt, unabhängig vom exakten Tag. Das ist erwünschtes, neues Verhalten, kein Fehler — dem Nutzer proaktiv mitteilen, falls die Transaktionsliste nach dem Deploy plötzlich "voller" aussieht.
3. Weiterhin ausstehend aus vorherigen Sessions (unverändert, siehe frühere `LOG_DOKUMENTATION.md`-Einträge):
   - Nutzer muss "Miete"/"Kredit" manuell auf "Ausgabe" korrigieren (waren durch den früheren Vorzeichen-Bug fälschlich positiv gespeichert).
   - Nutzer muss danach den Gesamtsaldo per "Saldo abgleichen" (Einstellungen → Kontostand) korrigieren.
4. Rest von Phase 13, Phase 12, CSV-Import (Phase 11) weiterhin offen — siehe `claude/roadmap.md`.
5. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten neun Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `backend/src/recurring-transactions/financial-period.ts` — neu: minimaler Backend-Port von `frontend/src/lib/financialPeriod.ts` (nur `currentPeriodEndUTC()`).
- `backend/src/recurring-transactions/recurring-transactions.service.ts` — `isDue()` vergleicht jetzt gegen das Ende des aktuellen Abrechnungszeitraums des Nutzers statt gegen "heute"; `runDueRecurringTransactions()` lädt dafür `user.monthStartDay` per Prisma-`include` mit.
- `backend/src/recurring-transactions/recurring-transactions.service.spec.ts` — Mocks um `user: { monthStartDay }` ergänzt, Tests für die neue "Vorziehen innerhalb des Zeitraums"-Semantik.

## Entscheidungen & Begründungen

- **Backend-Port von `financial-period.ts` statt Code-Sharing** — Frontend und Backend sind getrennte npm-Projekte ohne gemeinsames Package; ein Shared-Package wäre für eine einzelne, kleine Funktion unverhältnismäßiger Infrastruktur-Aufwand gewesen. Nur `currentPeriodEndUTC()` portiert (das Einzige, was `isDue()` braucht), nicht die volle `FinancialPeriod`-API des Frontends.
- **UTC-Kalendertage für "heute" im Backend, nicht lokale Zeit** — anders als das Frontend (das die lokale Browserzeit des Nutzers für "heute" nutzt), hat der Backend-Cron kein Konzept einer "Nutzer-Ortszeit". Konsistent mit dem bereits bestehenden `dateOnly()`-Muster in derselben Datei, das ebenfalls durchgehend UTC-Kalendertage vergleicht.
- **Keine Sonderbehandlung für Multi-User** — die Änderung wirkt sich auf ALLE aktiven Fixkosten-Regeln aus (nicht nur solche mit einem vom Standard abweichenden `monthStartDay`), da die App laut Projektbeschreibung Single-User ist. Für den jetzigen Zweck ausreichend.
- **Kein Daten-Backfill/Sonderlauf für bereits überfällige Regeln nötig** — das bestehende "Nachholen verpasster Buchungen"-Verhalten (Regeln mit `nextDueDate` in der Vergangenheit feuern beim nächsten Cron-Lauf sofort) deckt den Übergang ab; keine zusätzliche Logik nötig.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang, auch keinen laufenden Backend/DB-Stack** — Verifikation lief ausschließlich über `npm run build`/`npm test` (Backend) bzw. `tsc`/`vite build` (Frontend), kein echter Login/Dashboard-Aufruf möglich.
- **Beim ersten Cron-Lauf nach diesem Deploy können mehrere Fixkosten-Regeln gleichzeitig feuern** (siehe TODO 2 oben) — kein Fehler, aber unbedingt dem Nutzer proaktiv ankündigen, sonst wirkt es wie ein Bug.
- Migrations-Deploy-Befehl auf dem Mini-PC (falls in einer künftigen Teilscheibe wieder nötig — für diese Änderung selbst nicht erforderlich): `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
