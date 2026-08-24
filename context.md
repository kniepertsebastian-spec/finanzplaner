# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um Startsaldo & Saldo-Abgleich erweitern (`User.startingBalance`, `POST /users/me/reconcile`) — zweite Teilscheibe von Roadmap-Phase 9, nach der bereits deployten ersten Teilscheibe (`monthStartDay`).

## Aktueller Stand

- Feature vollständig implementiert, verifiziert (Backend-Tests grün: 14 Suiten/35 Tests, vorher 29; Frontend-Typecheck+Build grün) und **auf dem Mini-PC deployed** — Migration angewendet, Backend+Frontend neu gebaut/gestartet, neue Routen (`GET /users/me/balance`, `POST /users/me/reconcile`) bestätigt gemappt, keine Fehler im Log, `https://finance.pwa-tree.de/` → HTTP 200. Deployment-Log-Eintrag "Startsaldo & Saldo-Abgleich auf dem Mini-PC deployed" (03:45).
- Committed und gepusht auf `origin/main` (Commits `cf06e9d`, `94af613`).
- Während dieser Session gab es einen **Docker-Zwischenfall**: `docker compose -f docker-compose.yml up -d postgres redis` (Dev-Compose) wurde versehentlich im `~/finanzplaner`-Verzeichnis ausgeführt und hat dabei kurzzeitig die **Prod**-Container `finanzplaner-postgres-1`/`finanzplaner-redis-1` ersetzt (gleicher impliziter Compose-Projektname wie `docker-compose.prod.yml`, gleiche Volume-Namen). Kein Datenverlust (gleiche Volumes), aber kurzer Redis-Verbindungsausfall im Backend. Vollständig behoben (Details + Lehre daraus: `doku/LOG_DOKUMENTATION.md`, Eintrag "Startsaldo & Saldo-Abgleich … Docker-Zwischenfall"). **Deshalb wurde die Migration für dieses Feature von Hand geschrieben statt per `prisma migrate dev` generiert** — um keine Dev-DB in diesem Verzeichnis erneut hochfahren zu müssen.

## Offene TODOs

1. Diese Session ist inhaltlich abgeschlossen — kein unmittelbarer nächster Schritt aus dieser Arbeit offen.
2. Visueller Check durch den Nutzer selbst steht noch aus: `/settings` → Startsaldo setzen, "Saldo abgleichen" mit einem abweichenden Betrag testen, prüfen ob die Ausgleichsbuchung korrekt in `/transactions` auftaucht.
3. Falls fortgesetzt: Rest von Phase 9 (noch nicht begonnen) — `getBillingCycle`-Helfer serverseitig, "frei verfügbares Einkommen", Tages-Burn-Rate, Cashflow-Projektion.
4. Alternativ mit dem Nutzer klären, ob als Nächstes eine andere Roadmap-Phase (7/8 oder 10–15) angegangen werden soll.

## Relevante Dateien/Pfade

- `backend/prisma/schema.prisma` — `User.startingBalance Int @default(0)`, `Transaction.isReconciliation Boolean @default(false)`.
- `backend/prisma/migrations/20260824010000_add_starting_balance_and_reconciliation/` — von Hand geschrieben (siehe oben), die anzuwendende Migration.
- `backend/src/transactions/transactions.service.ts` — neues `getBalance(userId)` (Prisma-`aggregate`-Summe), exportiert über `TransactionsModule`.
- `backend/src/users/{users.controller.ts,users.service.ts,users.module.ts,dto/update-user.dto.ts,dto/reconcile-balance.dto.ts}` — `GET /users/me/balance`, `POST /users/me/reconcile`, `UsersModule` importiert jetzt `TransactionsModule`.
- `backend/src/auth/auth.service.ts` — `login()`/`me()` liefern jetzt zusätzlich `startingBalance`.
- `frontend/src/components/settings/BalanceSettings.tsx` — neues Settings-Panel (Startsaldo setzen + Saldo-Abgleich-Formular), in `SettingsPage.tsx` eingebunden.
- `frontend/src/lib/api/{types.ts,users.ts}` — `User.startingBalance`, `usersApi.getBalance()`/`reconcile()`.

## Entscheidungen & Begründungen

- `isReconciliation` ist bewusst **nicht** Teil des öffentlichen `CreateTransactionDto` — nur `UsersService.reconcile()` darf es setzen (direkter `prisma.transaction.create()`-Aufruf statt über `TransactionsService.create()`), damit niemand über die normale Transaktions-API eine gefälschte Ausgleichsbuchung anlegen kann.
- Ausgleichsbuchungen landen unter einer automatisch angelegten/wiederverwendeten Kategorie "Kontoabgleich" (find-or-create beim ersten Abgleich) — es gibt keine Standard-/Systemkategorien in dieser App (Nutzer legt alle Kategorien selbst an), daher kein bestehendes "Sonstiges" zum Wiederverwenden.
- `UpdateUserDto.monthStartDay` wurde nachträglich auf `@IsOptional()` umgestellt (war vorher required) — jetzt echtes Partial-Update, `startingBalance` kann unabhängig von `monthStartDay` gespeichert werden, ohne Breaking Change für den bestehenden `MonthCycleSettings`-Aufruf.
- `getBalance()` lebt in `TransactionsService` (nicht in `UsersService`), weil es reine Transaktions-Aggregation ist — `UsersService` addiert nur den `startingBalance`-Offset dazu. Gleiches Cross-Module-Muster wie `RecurringTransactionsService` → `TransactionsService`.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision (siehe oben):** `docker-compose.yml` (Dev) und `docker-compose.prod.yml` liegen im selben Verzeichnis und haben denselben impliziten Compose-Projektnamen (`finanzplaner`) sowie identische Volume-Namen (`pgdata`, `redisdata`). **Auf dem Mini-PC niemals `docker compose -f docker-compose.yml up` ausführen ohne explizit `-p <anderer-projektname>`** — sonst werden die laufenden Prod-Container erkannt und unter der Dev-Konfiguration neu erstellt. Für reine Verifikation (Build/Test/Typecheck) stattdessen gezielt einzelne Images bauen (`docker build --target builder -t <tag> ./backend` fürs Backend, da Tests nur in der Builder-Stage des mehrstufigen Dockerfiles verfügbar sind; `docker build -t <tag> ./frontend` fürs Frontend, `npm run build` = `tsc && vite build`) und mit `docker run --rm <tag> ...` bzw. `docker run --rm <tag> npm test` isoliert ausführen, ohne `up`/`run` gegen die Compose-Projekte.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy` (nicht `exec`, falls der Backend-Container gerade neu gebaut aber noch nicht gestartet wurde).
- Der GitHub-Deploy-Key auf dem Mini-PC (`~/.ssh/id_ed25519_github_finanzplaner`) war lange Zeit read-only — der Nutzer hat in dieser Session Schreibzugriff aktiviert (Repo-Settings → Deploy keys → "Allow write access" am bestehenden Key, nicht neu angelegt).

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–8-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
