# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um Split-Transaktionen erweitern — erste Teilscheibe von Roadmap-Phase 11 (Smarte Datenerfassung & Import), direkt nach dem vollständigen Abschluss von Phase 10 (Salden-Engine & Flexibler Gehaltszyklus).

## Aktueller Stand

- **Phase 10 ist vollständig auf dem Mini-PC deployed und vom Nutzer verifiziert** (virtuelle Töpfe, Vertragsmetadaten/Kündigungswecker, Preiserhöhungs-Erkennung — alle drei Teilscheiben).
- Diese Session hat parallel, während der Nutzer den Phase-10-Deploy durchgeführt hat, mit Phase 11 begonnen (Split-Transaktionen).
- Feature vollständig implementiert und lokal verifiziert:
  - Backend: `npm run build` fehlerfrei, `npm test` → 16 Suites / 52 Tests grün.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei (nur eine unkritische Vite-Chunk-Size-Warnung, kein Fehler).
- **Kein Docker in dieser Session verfügbar** (weiterhin weder Daemon noch SSH zum Mini-PC) — Verifikation lief wie in den Phase-10-Teilscheiben über lokal per `npm install` erzeugte `node_modules`. Migration `20260825010000_add_split_group_id` von Hand geschrieben.
- **Diese Teilscheibe ist NOCH NICHT deployed.**

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus:**
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. Visueller Check durch den Nutzer nach dem Deployment: unter *Transaktionen* → Button "Buchung aufteilen" → Beschreibung + 2 Zeilen (Betrag/Kategorie) ausfüllen → Aufteilen. Danach in der Liste: zwei neue Zeilen mit demselben Datum/derselben Beschreibung, je mit kleinem Split-Icon (Tooltip zeigt beide Teile). Beide Zeilen sollten unabhängig voneinander normal bearbeit-/löschbar sein.
3. Rest von Phase 11 (noch nicht begonnen, größerer Scope, ggf. mit dem Nutzer abstimmen bevor losgelegt wird):
   - **CSV-Transaktions-Import** — braucht wahrscheinlich Input vom Nutzer, welches Bank-CSV-Format tatsächlich vorliegt (Spaltenreihenfolge/-namen, Datumsformat, Dezimaltrennzeichen), bevor ein sinnvoller Spalten-Mapper gebaut werden kann. Duplikaterkennung via Content-Hash braucht vermutlich ein neues Feld auf `Transaction` (z. B. `importHash`).
   - **OCR-Belegscan** — größter Einzelposten der Phase, braucht eine OCR-Engine (z. B. `tesseract.js` client-seitig, neue Abhängigkeit) und Extraktions-Heuristiken für Betrag/Datum/Händler aus dem Bild. Baut vermutlich auf dem bestehenden Invoice-Upload (`backend/src/invoices/`) auf.
   - **Währungsumrechner** — kleinster/einfachster verbleibender Punkt (reine Frontend-Rechenfunktion in Quick Add, kein Schema-Change nötig, evtl. mit statischer/manuell einstellbarer Kursliste statt Live-API, um keine neue externe Abhängigkeit einzuführen).
4. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten vier Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `backend/prisma/schema.prisma` — `Transaction` um `splitGroupId` (String?) + Index erweitert.
- `backend/prisma/migrations/20260825010000_add_split_group_id/migration.sql` — von Hand geschrieben.
- `backend/src/transactions/dto/create-transaction-split.dto.ts` — neu, verschachtelte DTO-Validierung.
- `backend/src/transactions/transactions.service.ts` — neue Methode `createSplit()`.
- `backend/src/transactions/transactions.controller.ts` — neuer Endpunkt `POST /transactions/split`.
- `frontend/src/lib/api/types.ts` (`Transaction.splitGroupId`), `frontend/src/lib/api/transactions.ts` (`createSplit()`).
- `frontend/src/pages/TransactionsPage.tsx` — neuer "Buchung aufteilen"-Formularbereich + Split-Icon/Tooltip in der Tabelle.

## Entscheidungen & Begründungen

- **Kein eigenes Kindmodell für Splits** — mehrere gewöhnliche `Transaction`-Zeilen mit gemeinsamer `splitGroupId` statt einer verschachtelten Struktur. Dadurch bleiben alle bestehenden Berechnungen (Budgets, Dashboard, Kategorisierung, Saldo) komplett unverändert; jede Split-Zeile ist danach eine ganz normale, unabhängig editierbare Transaktion. Der Tradeoff: es gibt keine "Gruppen-Edit"-UI (z. B. "diese Aufteilung insgesamt bearbeiten") — bewusst nicht gebaut, da nicht in der Roadmap-Beschreibung gefordert und zusätzlicher Scope.
- **Alle Splits müssen dasselbe Vorzeichen haben** (nur Ausgabe oder nur Einnahme, serverseitig validiert) — vereinfacht die UI (ein einziger Ausgabe/Einnahme-Umschalter für die ganze Aufteilung statt pro Zeile) und deckt den in der Roadmap beschriebenen Anwendungsfall (ein Einkauf auf mehrere Kategorien) vollständig ab; ein gemischter Split wäre ohnehin ein ungewöhnlicher Fall.
- **Reihenfolge innerhalb von Phase 11:** Split-Transaktionen zuerst, weil einzige der vier Phase-11-Aufgaben ohne offene Rückfrage an den Nutzer (CSV-Format) oder neue Abhängigkeit (OCR) umsetzbar war.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang** — Verifikation lief über lokales `npm install` statt `docker build`.
- **Vier additive Migrationen liegen inzwischen aufeinander** seit Beginn von Phase 10: `add_savings_pots`, `add_contract_metadata`, `add_previous_amount`, `add_split_group_id` — alle nullable/additiv, kein Datenverlust-Risiko, aber `prisma migrate deploy` muss nach jedem Pull erneut laufen, bis alle durch sind.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
