# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um Sparquote und eine 50/30/20-Regel-Auswertung erweitern — erste Teilscheibe von Roadmap-Phase 13 (Auswertungen, Tags & PWA-Power-Features). Auf Nutzerwunsch begonnen, bevor Phase 12 (UI/UX-Redesign) fortgesetzt oder der CSV-Import (letzter offener Punkt aus Phase 11) angegangen wird — CSV-Import ist explizit als Allerletztes geplant.

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Backend: `npm run build` fehlerfrei, `npm test` → 16 Suites / 55 Tests grün.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei (nur die bekannte, unkritische Vite-Chunk-Size-Warnung).
  - Visuell verifiziert per isoliertem HTML-Nachbau + Playwright-Screenshot (kein laufender Dashboard-Stack in dieser Session verfügbar) — Statusfarben-Schwellen der 50/30/20-Balken geprüft.
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session). Es sind inzwischen mehrere additive Migrationen aufgelaufen, die noch nicht auf dem Mini-PC angewendet wurden (siehe Gotchas unten).

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus:**
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. Visueller Check durch den Nutzer nach dem Deployment:
   - *Einstellungen* → Kategorien → neues Dropdown pro Kategorie (Bedarf/Wunsch/Sparen/Nicht zugeordnet) ausprobieren.
   - Dashboard → neue "Sparquote"-Kachel (4. Kachel neben Einnahmen/Ausgaben/Netto) sowie neue Karte "50/30/20-Regel" (nur sichtbar bei Einnahmen > 0 im Zeitraum) prüfen — insbesondere mit noch nicht eingeordneten Kategorien (Hinweistext zu "nicht zugeordnet" sollte erscheinen).
3. Rest von Phase 13 (noch nicht begonnen):
   - **Sankey-Geldflussdiagramm** — bewusst aus dieser Teilscheibe rausgehalten (deutlich größerer Umfang, Chart.js hat keine eingebaute Sankey-Fähigkeit, bräuchte eine neue Chart-Bibliothek/ein Plugin oder eine handgebaute SVG-Lösung).
   - **Flag-Auswertung** (aggregiertes Einsparpotenzial-Dashboard für Vermeidbar/Ineffizient/Zu hoch).
   - **Projektbezogene Tags** (Hashtags für kategorieübergreifende Auswertungen — braucht vermutlich ein neues Datenmodell).
   - **Steuer-Marker** (Flag + gefilterter Jahres-Export samt Belegen).
   - **Web Push Notifications**, **App Shortcuts** (Web-Manifest-Erweiterung), **Batch-Bearbeitung** in der Transaktionsliste.
4. Weiterhin offen: Rest von Phase 12 (Privacy-Mode, moderne Chart-Ästhetik, Pill-Progress-Bars, Micro-Interactions).
5. **CSV-Transaktions-Import** (Phase 11) — bewusst als Allerletztes geplant, braucht Input vom Nutzer zum tatsächlichen Bank-CSV-Format.
6. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten sieben Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `backend/prisma/schema.prisma` — neues Enum `BudgetType`, `Category.budgetType` (optional).
- `backend/prisma/migrations/20260825040000_add_category_budget_type/migration.sql` — von Hand geschrieben.
- `backend/src/categories/dto/create-category.dto.ts` — `budgetType?: BudgetType | null` (explizit nullable, siehe Entscheidungen unten).
- `backend/src/categories/categories.service.ts` — `create()` reicht `budgetType` durch.
- `frontend/src/lib/api/types.ts` (`BudgetType`-Typ, `Category.budgetType`), `frontend/src/lib/api/categories.ts` (`CategoryInput.budgetType`).
- `frontend/src/components/settings/CategoryManager.tsx` — neues Einordnungs-Dropdown pro Kategorie.
- `frontend/src/lib/budgetCalc.ts` — neu: `savingsRate()`, `budgetTypeBreakdown()`, Typ `BudgetTypeBreakdown`.
- `frontend/src/pages/DashboardPage.tsx` — neue "Sparquote"-Kachel, neue "50/30/20-Regel"-Karte mit `RULE_STATUS`-Konstante (Status-Icons/-Farben, gleiches Muster wie `BudgetProgressBar.tsx`).

## Entscheidungen & Begründungen

- **`Category.budgetType` ist explizit `BudgetType | null` typisiert** (nicht nur `| undefined`) — ermöglicht das echte Zurücksetzen auf "nicht zugeordnet" über den normalen Update-Pfad (ein explizites `null` im DTO wird von Prisma als "Spalte leeren" verstanden, `undefined` dagegen als "unverändert lassen"). Bewusst anders als bei den Vertragsdaten-Feldern in einer früheren Phase-10-Teilscheibe (dort blieb das Nicht-zurücksetzen-Können eine dokumentierte, akzeptierte Einschränkung) — hier war der saubere Weg trivial genug (ein einzelnes Enum-Feld ohne Datums-Sonderfall), um ihn gleich richtig zu machen.
- **"Sparen" in der 50/30/20-Auswertung zählt zwei Dinge zusammen:** explizit als `SAVINGS` eingeordnete Ausgaben (z. B. eine manuelle Sparüberweisungs-Buchung) UND schlicht nicht ausgegebenes Einkommen (`incomeCents - totalExpenseCents`). Deckt beide gängigen Lesarten der 50/30/20-Regel ab (aktive Sparbuchungen und einfaches Nicht-Ausgeben), ohne dass der Nutzer zwingend eine eigene "Sparen"-Kategorie anlegen muss, damit die Auswertung überhaupt etwas anzeigt.
- **Nicht eingeordnete Kategorien werden separat ausgewiesen** (`unassignedCents`), nicht automatisch einem der drei Töpfe zugerechnet — vermeidet eine stillschweigend falsche Auswertung, bevor der Nutzer seine Kategorien einmal klassifiziert hat.
- **Sankey-Diagramm bewusst nicht in dieser Teilscheibe** — deutlich größerer technischer Umfang (keine bestehende Chart.js-Sankey-Fähigkeit im Projekt), als eigene künftige Teilscheibe vorgesehen, konsistent mit dem bisherigen Muster, große/neuartige Chart-Typen separat zu behandeln.
- **`dataviz`-Skill während der Umsetzung angewendet:** Status-Icons (`CheckCircle2`/`AlertTriangle`/`AlertCircle`) zu den Statusfarben ergänzt, weil die Skill-Regel "Status-Farben nie allein, immer mit Icon + Label" das explizit verlangt — im ursprünglichen Entwurf zunächst vergessen, beim Abgleich mit der Skill nachgezogen.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang, auch keinen laufenden Backend/DB-Stack** — Verifikation lief über `tsc`/`vite build`/`npm test` plus isolierten Playwright-Screenshots des neuen Markups, nicht über einen echten Login/Dashboard-Aufruf.
- **Mehrere additive Migrationen liegen inzwischen aufeinander**, die noch nicht deployed sind (Stand dieser Session): u. a. `add_split_group_id` (Phase 11) und jetzt `add_category_budget_type` (diese Teilscheibe) — alle nullable/additiv, kein Datenverlust-Risiko, aber `prisma migrate deploy` muss beim nächsten Mini-PC-Deploy alle nachziehen. Im Zweifel auf dem Mini-PC `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status` prüfen, welche noch ausstehen.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
