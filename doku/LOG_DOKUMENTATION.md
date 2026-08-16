# LOG_DOKUMENTATION

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
