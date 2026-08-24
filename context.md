# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um "Frei verfügbares Einkommen" und "Tagesbudget" (Tages-Burn-Rate) auf dem Dashboard erweitern — dritte Teilscheibe von Roadmap-Phase 9, nach `monthStartDay` (Teilscheibe 1) und Startsaldo/Reconciliation (Teilscheibe 2).

## Aktueller Stand

- Feature vollständig implementiert, verifiziert (`docker build ./frontend` → `tsc && vite build` fehlerfrei) und **auf dem Mini-PC deployed** — nur der Frontend-Container wurde neu gebaut/gestartet (reiner Frontend-Change, kein Backend-Rebuild, keine Migration), Backend/Postgres/Redis liefen unverändert weiter. `curl https://finance.pwa-tree.de/` → HTTP 200. Deployment-Log-Eintrag "Frei verfügbares Einkommen & Tagesbudget auf dem Mini-PC deployed" (04:35).
- Committed und gepusht auf `origin/main` (Commits `d3bd7c1`, `0aa4bed`).
- Kein Docker-Zwischenfall in dieser Teilscheibe (Lehre aus der vorherigen Session befolgt: nur `docker build`/`docker compose ... build+up` auf einzelne Services der Prod-Compose-Datei, nie die Dev-Compose-Datei berührt).

## Offene TODOs

1. Diese Session ist inhaltlich abgeschlossen — kein unmittelbarer nächster Schritt aus dieser Arbeit offen.
2. Visueller Check durch den Nutzer selbst steht noch aus: Dashboard öffnen, "Frei verfügbar"- und "Tagesbudget"-Kacheln prüfen (insbesondere den Fallback-Text, falls (noch) keine Einnahme-Fixkostenregel existiert).
3. Rest von Phase 9: **nur noch Cashflow-Projektion** offen (tagesgenauer Liquiditätsverlauf im Dashboard mit optischer Warnung bei drohender Unterdeckung) — spürbar größerer Umfang (neue Chart-Komponente), als eigene Teilscheibe eingeplant, noch nicht begonnen.
4. Alternativ mit dem Nutzer klären, ob als Nächstes eine andere Roadmap-Phase angegangen werden soll.

## Relevante Dateien/Pfade

- `frontend/src/lib/budgetCalc.ts` — neu: `availableIncome()`, `nextIncomeDueDate()`, `daysUntil()`, `dailyBurnRate()` (reine Funktionen, gleiches Muster wie `upcomingFixedCosts`/`monthlyTotals`).
- `frontend/src/pages/DashboardPage.tsx` — lädt jetzt zusätzlich `usersApi.getBalance()`, neue Stat-Tiles "Frei verfügbar"/"Tagesbudget".
- Keine Backend-Dateien in dieser Teilscheibe berührt.

## Entscheidungen & Begründungen

- **Kein neuer Backend-`getBillingCycle`-Helfer gebaut** (obwohl in der Roadmap als eigener Punkt gelistet) — die Zyklus-/Zeitraum-Logik existiert bereits als `frontend/src/lib/financialPeriod.ts` (aus Teilscheibe 1) und wird von Dashboard/Budgets bereits dafür verwendet. Ein zweiter, backend-seitiger Helfer wäre eine Duplizierung derselben Logik in einer zweiten Sprache gewesen, ohne dass ein neuer Endpunkt sie gebraucht hätte (siehe nächster Punkt).
- **Kein neuer Backend-Endpunkt für diese Kennzahlen** — anders als der Startsaldo (brauchte eine All-Time-Summe, die das Dashboard nicht ohnehin lädt) sind "frei verfügbares Einkommen" und "Tagesbudget" vollständig aus bereits geladenen Dashboard-Daten (`recurring`, `balance`) berechenbar. Konsequent im bestehenden Frontend-Pattern (`budgetCalc.ts`, reine Funktionen) umgesetzt statt eines unnötigen neuen Endpunkts.
- **Rücklagen (Roadmap-Formel "− Rücklagen") bewusst weggelassen** — virtuelle Töpfe/Sinking Funds existieren erst ab Phase 10. Kein Platzhalter-Feld/keine Fake-0 im Code, einfach nicht Teil der Formel bis es das Konzept gibt.
- **`dailyBurnRate()` hat keine Untergrenze bei 0** — ein negativer Wert ist absichtlich sichtbar (Signal: "wird vor dem nächsten Gehalt ins Minus rutschen"), nicht auf 0 geclampt.
- **Fallback-Horizont, falls keine Einnahme-Regel existiert:** Ende des aktuellen Finanzzeitraums (`period.end`) statt eines Fehlers/leeren Werts — Kachel bleibt immer aussagekräftig, mit klarem Hinweistext, dass keine Einnahme gefunden wurde.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (aus der vorherigen Teilscheibe, weiterhin gültig): `docker-compose.yml` (Dev) und `docker-compose.prod.yml` liegen im selben Verzeichnis, gleicher impliziter Compose-Projektname + gleiche Volume-Namen. **Niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ausführen** ohne explizit `-p <anderer-projektname>` — sonst werden die laufenden Prod-Container unter der Dev-Konfiguration neu erstellt. Für Verifikation: gezielt `docker build --target builder -t <tag> ./backend` (Backend-Tests, nur in der Builder-Stage verfügbar) bzw. `docker build -t <tag> ./frontend` (Frontend-Typecheck via `tsc && vite build`), dann `docker run --rm <tag> ...` — nie `up`/`run` gegen die Compose-Projekte für reine Verifikationszwecke.
- **Zeitzone bei `nextDueDate`-Vergleichen:** `nextIncomeDueDate()`/`daysUntil()` in `budgetCalc.ts` vergleichen ausschließlich über `.getTime()` auf bereits geparsten Dates, niemals über lokale `Date`-Getter (`getFullYear()`/`getMonth()`/`getDate()`) auf einem UTC-verankerten `nextDueDate`-Wert — sonst droht der gleiche CEST-Bug wie in `financialPeriod.ts` (siehe dortige Kommentare).
- Migrations-Deploy-Befehl auf dem Mini-PC (falls in einer künftigen Teilscheibe wieder nötig): `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–8-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
