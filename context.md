# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Phase 12 (UI/UX Redesign) und Phase 13 (Auswertungen, Tags & PWA-Power-Features) der Roadmap wurden vollständig fertiggestellt. Der Nutzer hat danach explizit angewiesen, Phase 11 (CSV-Import) und Phase 7 (Datenexport/DSGVO/Unit-Tests) zu **ignorieren** — nicht mehr angehen, außer explizit erneut angefordert.

Stattdessen hat der Nutzer `claude/roadmap.md` um einen neuen Abschnitt **"security patch"** (Punkte 16–18) erweitert und angewiesen, bei Punkt 16 zu beginnen. Diese Session arbeitet jetzt diesen Abschnitt Punkt für Punkt ab (gleiches Muster: implementieren → verifizieren → dokumentieren → committen → pushen).

## Aktueller Stand

**Phase 12 und Phase 13 sind vollständig abgeschlossen** (elf Teilscheiben insgesamt, alle committed & gepusht) — Details dazu in `doku/LOG_DOKUMENTATION.md`, nicht mehr aktiv relevant für die Fortsetzung.

**Security-Patch, Punkt 16 (Security & Authentifizierung) ist abgeschlossen:**
- **WebAuthn-Multi-User-Fix:** `webauthn.service.ts`s `generateLoginOptions()` nutzte `prisma.user.findFirst()` und schränkte `allowCredentials` auf dessen Passkeys ein — brach den Login für jeden Nutzer außer dem ersten. Umgestellt auf Discoverable-Credential-Flow (kein `allowCredentials`), Login-Challenge jetzt pro Challenge-Wert statt pro `userId` in Redis abgelegt, `verifyLogin()` liest die Challenge aus `clientDataJSON` der Antwort.
- **Serverseitige JWT-Invalidierung beim Logout:** `AuthService.logout()` trägt das Token jetzt zusätzlich zum Cookie-Löschen (Hash, mit Rest-TTL) in eine Redis-Blacklist ein; `JwtAuthGuard.canActivate()` (jetzt async) prüft diese Blacklist zusätzlich zur Signaturprüfung.
- Neue Datei `backend/src/auth/token-blacklist.util.ts` (gemeinsame Hash-Key-Funktion).
- **12 neue Unit-Tests** (`auth.service.spec.ts`, `guards/jwt-auth.guard.spec.ts`, `webauthn.service.spec.ts` — Letztere war zuvor komplett ungetestet).
- **Test-Infra-Hinweis:** `otplib` importiert transitiv ein ESM-only-Paket (`@scure/base`), das Jests Standard-Transform nicht parsen kann — in beiden neuen Specs mit `jest.mock('otplib', () => ({...}))` umgangen statt die globale Jest-Config anzufassen. Bei künftigen Specs, die `auth.service.ts` oder `webauthn.service.ts` (importiert `AuthService`) einbinden, denselben Trick anwenden.

**Security-Patch, Punkt 17 (Datenkonsistenz & Fehlerbehandlung) ist abgeschlossen:**
- **Transaktionale Saldo-Abstimmung:** `UsersService.reconcile()` kapselt Kategorie-Suche/-Erstellung und das Anlegen der Ausgleichsbuchung jetzt in `prisma.$transaction(async (tx) => {...})` (interactive transaction, da der zweite Schritt von der ID des ersten abhängt).
- **Dateileichen-Rollback:** `InvoicesService.create()` löscht die von Multer bereits geschriebene Datei per `unlink()`, wenn der anschließende DB-Insert fehlschlägt, und wirft den Originalfehler weiter.
- Neue Tests in `users.service.spec.ts` (`$transaction`-Nutzung geprüft) und `invoices.service.spec.ts` (Rollback-Verhalten bei DB-Fehler).

Beide Punkte committed & gepusht auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main`. **Keine Migration nötig, kein neues npm-Package.** Backend-Testsuite komplett grün (94/94).

**Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session).

## Offene TODOs — Reihenfolge für den Rest dieser Session

Aus dem neuen "security patch"-Abschnitt in `claude/roadmap.md` — Punkte 16 und 17 sind erledigt, weiter mit 18:

1. **Punkt 18 — Monitoring & Wartung:**
   - Prometheus-Metrics-Endpunkt (`@willsoto/nestjs-prometheus`) für HTTP-Latenzen/Request-Counts/DB-Pool.
   - Cronjob-Heartbeats (`recurring-transactions.service.ts`, `push.service.ts`) — Ping an Uptime Kuma/Healthchecks.io bei erfolgreichem täglichem Cron-Lauf.

Nach Punkt 18 ist der komplette "security patch"-Abschnitt abgeschlossen.

**Explizit ignoriert, nicht von selbst wieder aufgreifen:** CSV-Import (Phase 11) und Phase 7 (Datenexport/DSGVO/Unit-Tests/Sentry) — Nutzer hat das ausdrücklich gesagt.

Nach jedem einzelnen Punkt: Doku (`features.md`, `doku/LOG_DOKUMENTATION.md`, dieses `context.md`) aktualisieren, `claude/roadmap.md`-Checkbox abhaken, committen, auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main` pushen.

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

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hat weiterhin weder Docker-Daemon noch SSH-Zugang** — Verifikation läuft über `tsc`/`vite build`/`npm test` plus isolierten Playwright-Screenshots (teils echte Komponenten-Renders via esbuild-Bundle), nicht über einen echten Login/Dashboard-Aufruf.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.
- **`archiver`-Paket bewusst auf Major-Version 7 gepinnt** (nicht 8) — v8 ist ESM-only und passt nicht zum Backend-Setup (`module: commonjs`, kein `esModuleInterop`). Bei künftigen Dependency-Updates nicht versehentlich auf v8 hochziehen.
- **`otplib` ist ESM-transitiv-inkompatibel mit der Jest-Konfig** dieses Projekts (siehe oben) — beim Schreiben neuer Specs, die `AuthService`/`TotpService`/`WebauthnService` (importiert `AuthService`) berühren, `jest.mock('otplib', () => ({...}))` verwenden.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben.
