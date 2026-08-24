# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um eine Flag-Auswertung (Einsparpotenzial-Dashboard für Vermeidbar/Ineffizient/Zu hoch) erweitern — zweite Teilscheibe von Roadmap-Phase 13, nach Sparquote/50-30-20 (Teilscheibe 1).

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Kein Backend-Code betroffen — rein Frontend-Berechnung über bereits geladene Daten, keine neue Migration.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei (nur die bekannte, unkritische Vite-Chunk-Size-Warnung).
  - Visuell verifiziert per isoliertem HTML-Nachbau + Playwright-Screenshot.
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session). Mehrere additive Migrationen aus vorherigen Teilscheiben stehen ebenfalls noch aus (siehe Gotchas).

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus:**
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. Visueller Check durch den Nutzer nach dem Deployment: ein paar Transaktionen/Fixkosten-Regeln als Vermeidbar/Ineffizient/Zu hoch markieren (falls noch nicht vorhanden), dann Dashboard → neue Karte "Einsparpotenzial" prüfen (erscheint nur, wenn tatsächlich etwas markiert ist).
3. Rest von Phase 13 (noch nicht begonnen):
   - **Sankey-Geldflussdiagramm** — bewusst zurückgestellt, größerer Umfang (keine Chart.js-Sankey-Fähigkeit im Projekt).
   - **Projektbezogene Tags** (Hashtags für kategorieübergreifende Auswertungen — braucht vermutlich ein neues Datenmodell).
   - **Steuer-Marker** (Flag + gefilterter Jahres-Export samt Belegen).
   - **Web Push Notifications**, **App Shortcuts** (Web-Manifest-Erweiterung), **Batch-Bearbeitung** in der Transaktionsliste.
4. Weiterhin offen: Rest von Phase 12 (Privacy-Mode, moderne Chart-Ästhetik, Pill-Progress-Bars, Micro-Interactions).
5. **CSV-Transaktions-Import** (Phase 11) — bewusst als Allerletztes geplant, braucht Input vom Nutzer zum tatsächlichen Bank-CSV-Format.
6. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten acht Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `frontend/src/lib/budgetCalc.ts` — neu: `savingsPotential()`, Typen `FlagPotential`/`SavingsPotential`.
- `frontend/src/pages/DashboardPage.tsx` — neue Karte "Einsparpotenzial" (nach der 50/30/20-Karte, vor Rücklagen).

## Entscheidungen & Begründungen

- **Zwei getrennte Werte pro Flag statt eines Summenwerts** (`transactionCents` = im Zeitraum ausgegeben, `recurringMonthlyCents` = geschätzt laufend pro Monat aus Fixkosten) — beantworten unterschiedliche Fragen ("was habe ich schon ausgegeben" vs. "was kostet mich das laufend"), ein erzwungener Summenwert hätte eine Genauigkeit vorgetäuscht, die nicht da ist.
- **Fixkosten-Beträge auf einen Monatsdurchschnitt normalisiert** (`Math.round(Math.abs(amount) / intervalMonths)`) — eine markierte jährliche Kfz-Steuer soll nicht 12× so dringend wirken wie eine markierte monatliche Regel.
- **Farben/Icons pro Flag exakt wiederverwendet**, nicht neu erfunden (Vermeidbar = `Flag`/Amber, Ineffizient = `TrendingDown`/Rot, Zu hoch = `TrendingUp`/Lila) — konsistent mit der bereits etablierten Zuordnung in `RecurringTransactionsPanel.tsx`/`TransactionsPage.tsx` und der `dataviz`-Skill-Regel zu fester kategorialer Farbzuordnung.
- **Karte nur sichtbar, wenn tatsächlich etwas markiert ist** — vermeidet eine leere/nutzlose Karte für Nutzer, die die Flags (noch) nicht verwenden.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang, auch keinen laufenden Backend/DB-Stack** — Verifikation lief über `tsc`/`vite build` plus isolierten Playwright-Screenshots des neuen Markups.
- **Mehrere additive Migrationen liegen inzwischen aufeinander**, die noch nicht auf dem Mini-PC deployed sind (u. a. `add_split_group_id`, `add_category_budget_type`) — alle nullable/additiv, kein Datenverlust-Risiko, aber `prisma migrate deploy` muss beim nächsten Mini-PC-Deploy alle nachziehen. Im Zweifel auf dem Mini-PC `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status` prüfen.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
