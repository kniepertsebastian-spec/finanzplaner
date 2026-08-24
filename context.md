# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um eine tagesgenaue Cashflow-Projektion auf dem Dashboard erweitern — vierte und letzte Teilscheibe von Roadmap-Phase 9, nach `monthStartDay` (Teilscheibe 1), Startsaldo/Reconciliation (Teilscheibe 2) und Frei verfügbares Einkommen/Tagesbudget (Teilscheibe 3).

## Aktueller Stand

- Feature vollständig implementiert und verifiziert (`docker build ./frontend` → `tsc && vite build` fehlerfrei).
- Committed und gepusht auf `origin/main` (Commit `53b073a`).
- **Noch NICHT auf dem Mini-PC deployed.** Diese Session lief in einer Umgebung ohne SSH-Zugang zum Mini-PC (kein `minipc`-Alias, kein passender Key, direkter Verbindungsversuch zu `192.168.178.151` scheiterte an der Host-Key-Verifikation). Der Nutzer hat auf Rückfrage entschieden, das Deployment selbst durchzuführen.
- Kein Backend-/Migrations-Schritt nötig — reiner Frontend-Change, nutzt bereits geladene Dashboard-Daten (`recurring`, `balance`).

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus** (vom Nutzer selbst durchzuführen, oder in einer künftigen Session mit funktionierendem SSH-Zugang): `git pull` auf dem Mini-PC, dann `docker compose -f docker-compose.prod.yml build frontend && docker compose -f docker-compose.prod.yml up -d frontend`. Kein `prisma migrate deploy` nötig.
2. Visueller Check durch den Nutzer nach dem Deployment: Dashboard öffnen, neue Karte "Liquiditätsverlauf" prüfen — insbesondere den Warn-Banner, falls eine der aktiven Fixkosten-Regeln eine Unterdeckung in den kommenden Wochen auslöst.
3. **Roadmap-Phase 9 ist damit code-seitig vollständig** (alle vier Teilscheiben). Nächster Schritt mit dem Nutzer klären: Phase 10 (virtuelle Töpfe & Vertragsmanagement) oder etwas anderes.
4. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: prüfen, ob diese Session Zugriff auf `~/.ssh/mini-pc-claude` (oder einen äquivalenten Key + `minipc`-Host-Alias in `~/.ssh/config`) hat, bevor man einfach `git push` als "fertig" betrachtet — nicht jede Umgebung hat diesen Zugang.

## Relevante Dateien/Pfade

- `frontend/src/lib/budgetCalc.ts` — neu: `cashflowProjection()` (plus lokaler Helfer `addMonthsClamped()`), `firstShortfall()`, Typ `CashflowPoint`.
- `frontend/src/components/charts/CashflowChart.tsx` — neu: Line-Chart, Chart.js-Segment-Coloring + Füllung unterhalb der Null-Linie für Unterdeckungs-Warnung, kein neues npm-Package.
- `frontend/src/pages/DashboardPage.tsx` — neue Karte "Liquiditätsverlauf" unterhalb des Einnahmen/Ausgaben-Charts, inkl. rotem Warn-Banner bei drohender Unterdeckung.
- Keine Backend-Dateien in dieser Teilscheibe berührt.

## Entscheidungen & Begründungen

- **Nur wiederkehrende Buchungen in der Projektion** (keine variablen Ausgaben) — gleicher Scope wie `availableIncome()`/`dailyBurnRate()` aus der vorherigen Teilscheibe. Eine Schätzung künftiger variabler Ausgaben wäre reine Spekulation ohne belastbare Datengrundlage; die App kennt nur, was tatsächlich als wiederkehrende Regel hinterlegt ist.
- **Horizont = heute bis Ende des nächsten Finanzzeitraums** (`getNextFinancialPeriod(...).end`), nicht fest verdrahtet (z. B. 30/60 Tage) — nutzt die bereits vorhandene `financialPeriod.ts`-Logik weiter und passt sich automatisch an `monthStartDay` an, deckt zuverlässig mindestens einen vollen Gehaltszyklus ab.
- **Kein neues npm-Package für die Null-Linie/rote Warnfarbe** — Chart.js 4 unterstützt `segment.borderColor` (per-Segment-Styling) und `fill.target = { value: 0 }` (Füllung relativ zu einem festen Wert statt zur X-Achse) nativ, seit v3. Eine Annotation-Plugin-Abhängigkeit wäre unnötig gewesen.
- **`addMonthsClamped()` lokal in `budgetCalc.ts` dupliziert statt aus `financialPeriod.ts` exportiert** — dort ist die äquivalente Funktion (`clampDay`/`periodStartDate`) nicht exportiert und an das `FinancialPeriod`-Konzept gekoppelt; eine schlanke, eigenständige "addiere N Monate mit Clamping"-Funktion war hier die einfachere Wahl als den bestehenden Code umzubauen.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): `docker-compose.yml` (Dev) und `docker-compose.prod.yml` liegen im selben Verzeichnis, gleicher impliziter Compose-Projektname + gleiche Volume-Namen. **Niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ausführen** ohne explizit `-p <anderer-projektname>`. Für Verifikation: gezielt `docker build ./frontend` bzw. `docker build --target builder ./backend`, nie `up`/`run` gegen die Compose-Projekte für reine Verifikationszwecke.
- **SSH-Zugang zum Mini-PC ist umgebungsabhängig** (neu dokumentiert in dieser Session): Nicht jede Session/Umgebung hat automatisch den `minipc`-Alias bzw. den passenden Key. Vor der Annahme "Deploy ist der nächste Schritt" kurz `ssh -o BatchMode=yes minipc echo ok` prüfen.
- **Zeitzone bei Datumsvergleichen:** Alle neuen Funktionen in `budgetCalc.ts`/`CashflowChart.tsx` vergleichen/rechnen ausschließlich über `Date.UTC(...)`/`.getTime()`, niemals über lokale `Date`-Getter auf einem bereits UTC-verankerten Datum — der bekannte CEST-Bug aus `financialPeriod.ts`.
- Migrations-Deploy-Befehl auf dem Mini-PC (falls in einer künftigen Teilscheibe wieder nötig): `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–8-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
