# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Phase 12 (UI/UX Redesign) und Phase 13 (Auswertungen, Tags & PWA-Power-Features) der Roadmap wurden vollständig fertiggestellt. Der Nutzer hat danach explizit angewiesen, Phase 11 (CSV-Import) und Phase 7 (Datenexport/DSGVO/Unit-Tests) zu **ignorieren** — nicht von selbst wieder angehen, außer explizit erneut angefordert.

Danach hat der Nutzer `claude/roadmap.md` um einen neuen Abschnitt **"security patch"** (Punkte 16–18) erweitert und angewiesen, bei Punkt 16 zu beginnen. **Dieser komplette Abschnitt ist jetzt fertig.**

## Aktueller Stand

**Phase 12 und Phase 13 sind vollständig abgeschlossen** (elf Teilscheiben, alle committed & gepusht) — Details in `doku/LOG_DOKUMENTATION.md`, nicht mehr aktiv relevant.

**Der komplette "security patch"-Abschnitt (Punkte 16–18) ist abgeschlossen:**

- **16 — Security & Authentifizierung:** WebAuthn-Multi-User-Fix (Discoverable-Credential-Login statt `prisma.user.findFirst()`), serverseitige JWT-Invalidierung via Redis-Blacklist beim Logout (`JwtAuthGuard` prüft jetzt zusätzlich zur Signatur). Neue Datei `backend/src/auth/token-blacklist.util.ts`.
- **17 — Datenkonsistenz & Fehlerbehandlung:** `UsersService.reconcile()` läuft jetzt in einem `prisma.$transaction(async (tx) => ...)`. `InvoicesService.create()` löscht die von Multer bereits geschriebene Datei, wenn der DB-Insert fehlschlägt.
- **18 — Monitoring & Wartung:** neues Modul `backend/src/metrics/` (`@willsoto/nestjs-prometheus`) — `GET /metrics`-Endpunkt (öffentlich, via `@Public()`), globaler `HttpMetricsInterceptor` (Request-Latenz/-Count je Route+Methode+Status), `DbPoolMetricsService` (pollt `pg.Pool`-Zähler alle 5s in drei Gauges — dafür konstruiert `PrismaService` den `pg.Pool` jetzt selbst statt `PrismaPg` intern). Neue gemeinsame `backend/src/common/heartbeat.util.ts` — pingt eine optionale Monitoring-URL (Uptime Kuma/healthchecks.io) nach jedem erfolgreichen Cron-Lauf in `RecurringTransactionsService` und `PushService`, no-opt ohne konfigurierte URL.

Alle drei Punkte committed & gepusht auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main`. **Keine Migration nötig.** Neue npm-Abhängigkeiten: `@willsoto/nestjs-prometheus`, `prom-client` (beide nur für Punkt 18). Backend-Testsuite komplett grün (106/106).

**Test-Infra-Hinweis (bleibt relevant für künftige Auth-Specs):** `otplib` importiert transitiv ein ESM-only-Paket (`@scure/base`), das Jests Standard-Transform nicht parsen kann. In allen betroffenen Specs mit `jest.mock('otplib', () => ({...}))` umgangen statt die globale Jest-Config anzufassen. Betrifft jede Spec, die `AuthService` oder `WebauthnService` (importiert `AuthService`) einbindet — auch ein Versuch, den kompletten `AppModule`-DI-Graphen in einem Testlauf aufzulösen, brauchte diesen Mock zusätzlich. Ein solcher voller DI-Smoke-Test blieb aus einem anderen Grund trotzdem hängen: `RedisModule`/`PrismaService` versuchen beim Bootstrap eine echte Verbindung aufzubauen, die in dieser Remote-Session (kein Docker/DB/Redis) nicht erreichbar ist — daher nicht versucht, nur `tsc`/`nest build`/gezielte Unit-Tests als Verifikation.

**Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session).

## Offene TODOs — Reihenfolge für den Rest dieser Session

**Keine offenen Punkte aus dem "security patch"-Abschnitt mehr** — 16, 17 und 18 sind alle fertig.

Falls der Nutzer keine neuen Anweisungen gibt: nichts von selbst aus initiieren. Insbesondere **nicht** von selbst wieder aufgreifen: CSV-Import (Phase 11) und Phase 7 (Datenexport/DSGVO/Unit-Tests/Sentry) — Nutzer hat das ausdrücklich gesagt.

Falls der Nutzer die Roadmap weiter ergänzt (wie schon einmal geschehen): `claude/roadmap.md` gezielt nach neuen/offenen Punkten durchsuchen (nicht komplett lesen, siehe Nutzerhinweis aus der letzten Runde), dann nach demselben Muster abarbeiten: implementieren → verifizieren (`tsc`, `npm test`, `npm run build`) → dokumentieren (`features.md` nur bei echtem Nutzer-sichtbarem Effekt, `doku/LOG_DOKUMENTATION.md` immer, `claude/roadmap.md`-Checkbox abhaken, dieses `context.md`) → committen → auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main` pushen.

## Deployment (gilt für den gesamten noch ausstehenden Rückstand dieser Session)

```
git pull
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d backend frontend
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

Weiterhin ausstehend aus vorherigen Sessions (unverändert):
- Nutzer muss "Miete"/"Kredit" manuell auf "Ausgabe" korrigieren (früherer Vorzeichen-Bug).
- Nutzer muss danach den Gesamtsaldo per "Saldo abgleichen" korrigieren.
- Für Web Push (aus Phase 13): `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` in `backend/.env` setzen, falls noch nicht geschehen.
- Drei Migrationen aus Phase 13 (`add_transaction_tags`, `add_tax_relevant`, `add_push_subscriptions`) — laufen automatisch mit, sobald einmal `prisma migrate deploy` ausgeführt wird.
- **Optional, neu:** `RECURRING_TRANSACTIONS_HEARTBEAT_URL`/`PUSH_CRON_HEARTBEAT_URL` in `backend/.env` setzen, falls der Nutzer Uptime Kuma/healthchecks.io nutzen möchte — ohne das bleibt alles wie bisher, keine Pflicht.
- **Neu, optional zu prüfen:** `GET https://finance.pwa-tree.de/metrics` (o. Ä.) liefert jetzt Prometheus-Metriken — bei Bedarf in Grafana/Prometheus einbinden.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hat weiterhin weder Docker-Daemon noch SSH-Zugang** — Verifikation läuft über `tsc`/`vite build`/`npm test` plus isolierten Playwright-Screenshots (teils echte Komponenten-Renders via esbuild-Bundle), nicht über einen echten Login/Dashboard-Aufruf oder einen vollen Nest-Bootstrap.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.
- **`archiver`-Paket bewusst auf Major-Version 7 gepinnt** (nicht 8) — v8 ist ESM-only und passt nicht zum Backend-Setup (`module: commonjs`, kein `esModuleInterop`). Bei künftigen Dependency-Updates nicht versehentlich auf v8 hochziehen.
- **`otplib` ist ESM-transitiv-inkompatibel mit der Jest-Konfig** dieses Projekts (siehe oben) — beim Schreiben neuer Specs, die `AuthService`/`TotpService`/`WebauthnService` berühren, `jest.mock('otplib', () => ({...}))` verwenden.
- **`PrismaService` besitzt jetzt selbst den `pg.Pool`** (für die DB-Pool-Metrics) statt ihn `PrismaPg` intern erstellen zu lassen — `disposeExternalPool: true` sorgt dafür, dass er beim `$disconnect()` trotzdem sauber geschlossen wird. Bei künftigen Prisma-Adapter-Updates darauf achten, dass dieses Verhalten erhalten bleibt.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben.
