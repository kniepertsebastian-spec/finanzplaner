# LOG_DOKUMENTATION

---

### 📋 Schritt-Log: Phase 2 (Authentifizierung & Security) implementiert
**Zeitstempel:** `2026-08-17 02:15`

#### 1. Was wurde getan?
*   Vor Beginn geprüft, ob Phase 2 wirklich "fertig" war (wie zuvor angenommen) — Ergebnis: nur Prisma-Schema (`User`, `Authenticator`) und npm-Pakete waren vorhanden, es existierte kein `AuthModule`, kein Login-Endpunkt, `main.ts` war ein leeres Bootstrap, und die Datenbank war nie migriert worden.
*   `backend/generated/prisma` war veraltet (vor den `passwordHash`/TOTP/`Authenticator`-Feldern generiert) — neu generiert via `npx prisma generate`.
*   Neues `src/auth/`-Modul erstellt: `auth.module.ts`, `auth.controller.ts`/`auth.service.ts` (Passwort+TOTP-Login unter `POST /auth/login`, Logout unter `POST /auth/logout`), `webauthn.controller.ts`/`webauthn.service.ts` (Passkey-Registrierung und -Login unter `/auth/webauthn/*`, Challenges liegen kurzlebig in Redis), `totp.controller.ts`/`totp.service.ts` (TOTP-Enrollment mit QR-Code unter `/auth/totp/*`, Secret AES-256-GCM-verschlüsselt via `crypto.util.ts`), `guards/jwt-auth.guard.ts` (handgeschriebener Guard gegen `JwtService`, da kein `passport` installiert ist), `decorators/current-user.decorator.ts`, DTOs unter `dto/`.
*   `src/common/decorators/public.decorator.ts` (`@Public()`) und `src/common/redis/redis.module.ts` (globaler `ioredis`-Client) neu angelegt.
*   `src/main.ts`: `cookie-parser`, `helmet`, globale `ValidationPipe`, `enableCors({ credentials: true })`, Port aus `process.env.PORT`, `dotenv/config` ergänzt (das `.env`-File wurde vorher nur von der Prisma-CLI geladen, nicht von der laufenden App selbst — betraf bisher auch `DATABASE_URL`).
*   `src/app.module.ts`: `AuthModule`, `RedisModule`, `ThrottlerModule.forRoot(...)` (Redis-Storage via `@nest-lab/throttler-storage-redis`) sowie `APP_GUARD` für `ThrottlerGuard` (in `AppModule`) und `JwtAuthGuard` (in `AuthModule`) ergänzt — dadurch sind alle Feature-Module (`users`, `transactions`, `categories`, `budgets`) jetzt standardmäßig auth-geschützt.
*   `src/app.controller.ts`: Health-Check-Route mit `@Public()` markiert, da sie sonst durch den globalen Guard blockiert würde.
*   `backend/prisma/seed.ts` neu angelegt (Argon2-Hash + `prisma.user.upsert`, liest `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` aus `.env`), `package.json` um `"prisma": {"seed": ...}` sowie `ts-node` und `dotenv` als Dependencies ergänzt.
*   `.env` um `JWT_SECRET`, `JWT_EXPIRES_IN`, `TOTP_ENCRYPTION_KEY`, `REDIS_URL`, `COOKIE_SECURE`, `WEBAUTHN_RP_ID`/`RP_NAME`/`ORIGIN`, `SEED_USER_EMAIL`/`PASSWORD` ergänzt (Werte für lokale Entwicklung generiert); `.env.example` neu angelegt.
*   Root-`docker-compose.yml`: `backend`-Service um `env_file: ./backend/.env` ergänzt, damit die neuen Variablen auch im Container ankommen (vorher wurden nur `DATABASE_URL`/`REDIS_URL`/`PORT` explizit gesetzt).
*   Verifiziert: `npm run build` (0 Fehler), `npm test` (weiterhin 9/9 grün), `node dist/src/main.js` bootet sauber durch — alle Module inkl. `AuthModule` initialisieren ohne DI-Fehler, alle erwarteten Routen werden gemappt (bricht danach nur ab, weil keine echte Postgres/Redis-Verbindung besteht — Migration/Seed stehen noch aus).

#### 2. Warum wurde es getan?
*   Nutzer wollte mit Phase 3 (Kernfunktionen) weitermachen; Prüfung ergab, dass die als "fertig" geglaubte Phase 2 nur Scaffolding war. Um zu vermeiden, dass Transaktions-/Kategorie-/Budget-CRUD in Phase 3 nachträglich auf Nutzer-Scoping umgebaut werden muss, wurde erst die echte Authentifizierung gebaut. Entschieden (mit Nutzer abgestimmt): Single-User-App ohne öffentliche Registrierung, Passkey primär mit Passwort+TOTP als Fallback, ein einzelnes zustandsloses JWT ohne Refresh-Token.

#### 3. Auswirkungen / Nebenwirkungen
*   **Migration steht noch aus** — `prisma/migrations/` existiert weiterhin nicht. Der Nutzer muss (Docker braucht hier `sudo`, kann vom Agenten nicht ausgeführt werden): 1) `docker compose up -d postgres redis`, 2) `cd backend && npx prisma migrate dev --name init`, 3) `npx prisma db seed`.
*   Nach dem Seed ist der Login mit `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` aus `.env` möglich; das generierte Passwort sollte danach geändert und ein Passkey registriert werden.
*   Alle bisherigen Endpunkte (`/users`, `/transactions`, `/categories`, `/budgets`) sind jetzt ohne gültigen `auth_token`-Cookie nicht mehr erreichbar (401) — betrifft auch künftige Phase-3-Arbeit.
*   WebAuthn kann nicht per `curl` getestet werden, sondern nur im Browser (`navigator.credentials.create/get`).

#### 4. Status der Aufgabe
*   [ ] Überprüfung erforderlich (Migration, Seed und End-to-End-Test durch den Nutzer stehen noch aus)

---

### 📋 Schritt-Log: BookStack zur Docker-Compose hinzugefügt
**Zeitstempel:** `2026-08-17 00:00`

#### 1. Was wurde getan?
*   In `docker-compose.yml` zwei neue Services ergänzt: `bookstack_db` (`lscr.io/linuxserver/mariadb`, eigene DB `bookstackapp`, Volume `bookstack_dbdata`) und `bookstack` (`lscr.io/linuxserver/bookstack`, Port `6875:80`, Volume `bookstack_data`, `depends_on: bookstack_db`).
*   Neue Volumes `bookstack_dbdata` und `bookstack_data` im `volumes:`-Block ergänzt.

#### 2. Warum wurde es getan?
*   Nutzerwunsch, Projekt-Dokumentation zusätzlich in BookStack (Wiki) verfügbar zu machen. Da BookStack MySQL/MariaDB benötigt (nicht das vorhandene Postgres), läuft es mit eigener DB-Instanz getrennt von `postgres`/`redis`.

#### 3. Auswirkungen / Nebenwirkungen
*   Zusätzlicher Ressourcenverbrauch und Wartungsaufwand (eigene DB, Updates, Backups) durch zwei neue Container.
*   Erreichbar unter `http://localhost:6875` nach `docker compose up -d bookstack`. Enthält aktuell nur die BookStack-Standardinstallation, noch keine importierten Inhalte aus `doku/` oder `claude/roadmap.md`.
*   Standard-Zugangsdaten (`admin@admin.com` / `password`) und die in `docker-compose.yml` hinterlegten DB-Passwörter sind Platzhalter und sollten vor produktivem Einsatz geändert werden.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Deploy-Entrypoint-Pfad korrigiert
**Zeitstempel:** `2026-08-15 17:05`

#### 1. Was wurde getan?
*   In `backend/package.json` das Skript `start:prod` von `node dist/main.js` auf `node dist/src/main.js` geändert.
*   In `backend/Dockerfile` das `CMD` von `["node", "dist/main.js"]` auf `["node", "dist/src/main.js"]` geändert.
*   Verifiziert durch Ausführen von `node dist/src/main.js`: App startet, alle Module/Routen werden geladen, `GET /` liefert `{"status":"online",...}`.

#### 2. Warum wurde es getan?
*   Da `prisma.config.ts` und der generierte Prisma-Client (`generated/prisma`) außerhalb von `src/` liegen, leitet TypeScript `rootDir` automatisch als `backend/` her. Dadurch landet der kompilierte Einstiegspunkt unter `dist/src/main.js`, nicht `dist/main.js`. Die alten Pfade hätten in Produktion (und im Docker-Image) zu `MODULE_NOT_FOUND` geführt.

#### 3. Auswirkungen / Nebenwirkungen
*   Ohne diese Korrektur wäre der Docker-Container beim Start sofort abgestürzt.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Build- und Test-Infrastruktur vervollständigt
**Zeitstempel:** `2026-08-15 17:00`

#### 1. Was wurde getan?
*   `backend/nest-cli.json` und `backend/tsconfig.build.json` neu angelegt (letztere schließt `**/*spec.ts`, `test`, `dist` vom Produktions-Build aus).
*   In `backend/package.json`: `rimraf`, `jest`, `ts-jest`, `@types/jest`, `@types/node`, `@nestjs/testing` als devDependencies ergänzt, Jest-Konfiguration und `test`-Skript hinzugefügt.
*   `npm install` ausgeführt, danach `npm run build` (0 Fehler) und `npm test` (9/9 Tests grün) verifiziert.

#### 2. Warum wurde es getan?
*   `npm run build` schlug vorher mit 48 TypeScript-Fehlern fehl, weil `tsc` auch die `*.spec.ts`-Dateien kompilieren wollte (fehlende `nest-cli.json`/`tsconfig.build.json`). Zusätzlich existierten zwar 9 Testdateien, aber kein Test-Runner war installiert — `npm test` war nicht lauffähig. `rimraf` wurde im `prebuild`-Skript referenziert, war aber nie als Dependency deklariert.

#### 3. Auswirkungen / Nebenwirkungen
*   `npm run build` und `npm test` sind jetzt beide grundsätzlich lauffähig und Teil eines funktionierenden Dev-Workflows.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Prisma-Schema und -Client auf Prisma 7 migriert
**Zeitstempel:** `2026-08-15 16:55`

#### 1. Was wurde getan?
*   `backend/prisma/schema.prisma`: Generator-Block von `prisma-client-js` auf `prisma-client` mit explizitem `output = "../generated/prisma"` umgestellt; `url = env("DATABASE_URL")` aus dem `datasource`-Block entfernt (liegt bereits korrekt in `prisma.config.ts`).
*   `@prisma/adapter-pg` und `pg` (+ `@types/pg`) installiert.
*   `backend/src/prisma/prisma.service.ts`: Import von `PrismaClient` auf den generierten Pfad (`../../generated/prisma/client`) umgestellt, `PrismaPg`-Adapter im Konstruktor übergeben, `onModuleDestroy` mit `$disconnect()` ergänzt.
*   `npx prisma generate` erfolgreich ausgeführt und verifiziert.

#### 2. Warum wurde es getan?
*   Das Backend war auf `prisma@7.9.1` gepinnt, das Schema und der Client-Code folgten aber noch dem alten Prisma-6-Muster (`url` im `datasource`-Block, direkter `PrismaClient`-Import ohne Adapter). Dadurch schlug `npx prisma generate` mit einem Schema-Validierungsfehler fehl — der Prisma-Client konnte nie generiert werden.

#### 3. Auswirkungen / Nebenwirkungen
*   Der generierte Client liegt unter `backend/generated/prisma` (bereits in `.gitignore`) und muss nach jedem Schema-Update neu generiert werden (`npx prisma generate`).
*   Für SQL-Verbindungen ist ab Prisma 7 zwingend ein Driver-Adapter nötig — das gilt auch für künftige Schema-Änderungen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Feature-Module in AppModule verdrahtet
**Zeitstempel:** `2026-08-15 16:50`

#### 1. Was wurde getan?
*   `backend/src/app.module.ts` neu angelegt: importiert `PrismaModule`, `UsersModule`, `TransactionsModule`, `CategoriesModule`, `BudgetsModule`.
*   `backend/src/prisma/prisma.module.ts` neu angelegt, `@Global()` markiert, exportiert `PrismaService`.
*   `backend/src/app.controller.ts` neu angelegt (Health-Check-Route `GET /`), vorher lag dieser Code inline in `main.ts`.
*   `backend/src/main.ts` vereinfacht: bootstrapped jetzt `AppModule` statt eines improvisierten Inline-Moduls.

#### 2. Warum wurde es getan?
*   `main.ts` registrierte bisher nur einen provisorischen `AppController` direkt inline und importierte keines der vorhandenen Feature-Module. Dadurch waren `UsersController`, `TransactionsController`, `CategoriesController` und `BudgetsController` über HTTP nicht erreichbar, obwohl die Modul-Dateien bereits existierten.

#### 3. Auswirkungen / Nebenwirkungen
*   Alle vier Feature-Controller sind jetzt unter `/users`, `/transactions`, `/categories`, `/budgets` gemappt (aktuell noch ohne CRUD-Logik, siehe Roadmap Phase 3).
*   Jedes neue Modul muss künftig manuell in `app.module.ts` importiert werden.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: `.env` korrigiert und `dist/` aus Git entfernt
**Zeitstempel:** `2026-08-15 16:45`

#### 1. Was wurde getan?
*   `backend/.env`: `DATABASE_URL` von einer verwaisten lokalen Prisma-Dev-Proxy-URL auf die tatsächliche Postgres-Verbindung aus `docker-compose.yml` umgestellt (inkl. auskommentierter `localhost`-Variante für Ausführung außerhalb von Docker).
*   `backend/.gitignore`: `dist` ergänzt.
*   `backend/dist/` per `git rm -r --cached` aus der Versionskontrolle entfernt.

#### 2. Warum wurde es getan?
*   Die vorherige `DATABASE_URL` passte nicht zu den Zugangsdaten aus `docker-compose.yml` — der Backend-Container hätte sich nicht mit der dockerisierten Datenbank verbinden können. `dist/` ist ein Build-Artefakt und gehört nicht ins Repository.

#### 3. Auswirkungen / Nebenwirkungen
*   Lokale Entwickler, die außerhalb von Docker arbeiten, müssen die auskommentierte `localhost`-Variante der `DATABASE_URL` aktivieren.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen
