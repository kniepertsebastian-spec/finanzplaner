# LOG_DOKUMENTATION

---

### 📋 Schritt-Log: Phase 6 (Einstellungs- & Sicherheits-UI) implementiert
**Zeitstempel:** `2026-08-21 03:42`

#### 1. Was wurde getan?
*   **Backend-Lücke zuerst geschlossen:** Die Roadmap verlangte "Anzeige aktiver Authentikatoren" und implizit eine Möglichkeit, Passkeys/TOTP wieder zu entfernen — dafür gab es aus Phase 2 noch keine Endpunkte (nur `register-*`/`login-*` bei WebAuthn, nur `enroll`/`verify-enable` bei TOTP). Neu ergänzt: `GET /auth/webauthn/authenticators` (Liste ohne `publicKey`/`credentialId`, nur `id`/`deviceName`/`credentialDeviceType`/`transports`/`createdAt`/`lastUsedAt`), `DELETE /auth/webauthn/authenticators/:id` (Eigentümer-Check via `findFirst({id, userId})`), `POST /auth/totp/disable` (verlangt einen aktuell gültigen TOTP-Code, nicht nur die Session-Cookie — siehe Punkt 2). `WebauthnRegistrationVerifyDto` um ein optionales `deviceName`-Feld erweitert (bleibt ein Typalias statt einer Klasse, damit `ValidationPipe`s `whitelist` es weiterhin durchreicht). `GET /auth/me` und `POST /auth/login` liefern jetzt zusätzlich `totpEnabled`, damit das Frontend ohne Zusatzaufruf weiß, ob TOTP schon aktiv ist.
*   **Frontend – `/settings`-Route** (`SettingsPage.tsx`, neu, im Nav als "Einstellungen"): komponiert drei neue Unterkomponenten unter `components/settings/`: `PasskeyManager.tsx` (Registrierung via `startRegistration()` inkl. optionalem Gerätenamen-Feld, Liste mit Lösch-Button), `TotpEnrollment.tsx` (drei Zustände: deaktiviert → QR-Code+Code-Eingabe → aktiviert mit Deaktivieren-Formular), `RecurringTransactionsPanel.tsx` (Formular + Tabelle für `RecurringTransaction`, Ausgabe/Einnahme-Umschalter im exakten visuellen Stil von `QuickAddPage.tsx`, Pausieren via `PATCH {active}`, kein eigener Toggle-Endpunkt nötig, da das Backend das schon konnte). Neue API-Module `lib/api/recurringTransactions.ts` (nach dem `budgets.ts`-Muster) sowie Ergänzungen in `lib/api/auth.ts`/`lib/api/types.ts`. `AuthContext` um `refreshUser()` erweitert, damit die Settings-Seite `user.totpEnabled` nach Enroll/Disable ohne vollen Reload aktualisieren kann.
*   **Bug beim End-to-End-Test gefunden und behoben, unabhängig von dieser Phase:** `frontend/nginx.conf` hatte **keine** `/api`-Proxy-Regel zum Backend-Container — jeder API-Call (nicht nur die neuen) lief ins Leere und bekam von nginx' SPA-Fallback (`try_files … /index.html`) ein `200 text/html` statt einer echten Antwort zurück, was `AuthContext` fälschlich als "eingeloggt" interpretierte (jede Fetch-Antwort mit Status 200 wurde als Erfolg gewertet, unabhängig vom Inhalt). Vermutlich entstanden, als `frontend/.env`s `VITE_API_URL` irgendwann von `http://localhost:3000` (siehe Phase-4-Log) auf `/api` umgestellt wurde, ohne die nginx-Seite der Docker-Prod-Config nachzuziehen. Behoben durch einen neuen `location /api/ { proxy_pass http://backend:3000/; … }`-Block.
*   Verifiziert: `npx tsc --noEmit` (Backend + Frontend, je 0 Fehler). `docker compose up -d --build backend frontend` (mit Nutzerzustimmung, da laufende Prod-artige Container betroffen). End-to-end via Playwright gegen die echten Container (Login mit Seed-Nutzer): `RecurringTransactionsPanel` komplett (Anlegen mit negativem Betrag bei "Ausgabe", Pausieren, Löschen, Tabelle aktualisiert sich), TOTP komplett über die UI (Enroll → echten TOTP-Code aus dem zurückgegebenen Secret berechnet, per Hand nachgebautem RFC-6238 in Node, da kein `pyotp`/npm-TOTP-Paket zur Hand — Bestätigen → "aktiviert"-Zustand → Deaktivieren mit frischem Code → zurück zu "deaktivieren"-Zustand), Passkey-Liste/Löschen (Zeile direkt per SQL eingefügt statt einer echten Registrierungs-Zeremonie, siehe Punkt 3). Kein horizontaler Overflow, keine unerwarteten Konsolenfehler.

#### 2. Warum wurde es getan?
*   Nutzer bestätigte den neuen Roadmap-Text (Phasen 6–8) und bat direkt im Anschluss um Fortsetzung mit Schritt 6.
*   `POST /auth/totp/disable` verlangt bewusst einen frischen Code statt nur der Session-Cookie zu vertrauen — Deaktivieren von 2FA ist sicherheitsrelevanter als das Hinzufügen eines weiteren Passkeys (dafür reicht die Session, da Passwort-Login als Fallback ohnehin immer bestehen bleibt und daher kein Lockout-Risiko besteht).

#### 3. Auswirkungen / Nebenwirkungen
*   **`WEBAUTHN_ORIGIN` in `backend/.env` zeigt noch auf eine alte Cloudflare-Tunnel-URL** (`https://unknown-headset-knows-contributed.trycloudflare.com`), nicht auf die aktuell für Tests genutzte `http://localhost`. `@simplewebauthn/server` lehnt jede Registrierungs-Antwort mit abweichendem Origin aus Sicherheitsgründen zu Recht ab — das ist kein Code-Bug, sondern ein veralteter Konfigurationswert. **Absichtlich nicht selbst geändert**, da unklar ist, über welche URL die App aktuell tatsächlich erreicht wird (Tunnel? LAN? künftige Domain aus Phase 8?) — das ist eine Entscheidung für den Nutzer. Deshalb wurde die vollständige Registrierungs-Zeremonie nur soweit möglich getestet (Optionen abrufen, dann Abbruch mit dem erwarteten Origin-Fehler); Listen-/Lösch-UI wurde stattdessen gegen eine direkt per SQL eingefügte Test-Zeile verifiziert.
*   Backend- und Frontend-Container wurden neu gebaut und neu gestartet (`docker compose up -d --build backend frontend`), da beide ohne Bind-Mount laufen. Datenbank-Inhalt (Nutzer, Kategorien) blieb unangetastet; alle während des Tests angelegten Datensätze (Recurring-Transaction, TOTP-Status, Test-Authenticator-Zeile) wurden am Ende wieder entfernt.
*   `AuthenticationResponseJSON`/`RegistrationResponseJSON`-Typen kommen jetzt zusätzlich aus `@simplewebauthn/browser` in `lib/api/auth.ts` — keine neue Dependency, das Paket war bereits vorhanden.
*   Keine neue Prisma-Migration nötig — `Authenticator.deviceName` existierte im Schema bereits (wurde in Phase 2 angelegt, aber nie beschrieben).

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Phase 5 (PWA-Feinschliff & Offline-Modus) implementiert
**Zeitstempel:** `2026-08-17 18:00`

#### 1. Was wurde getan?
*   Vorab per Rückfrage geklärt: Offline-Background-Sync für Transaktionen braucht eine Erfassungs-UI, die es noch nicht gab (Quick-Add wurde in Phase 3 und Phase 4 zurückgestellt) — Nutzer entschied sich für eine minimale Quick-Add-Seite als Teil dieses Schritts.
*   **Icons/Manifest:** `frontend/public/icons/` existierte komplett nicht — vier PNGs (192/512/512-maskable/apple-touch-icon) generiert (schlichtes Münz-Icon in Markenblau `#2a78d6`, per Font-freiem SVG, da keine SVG→PNG-Tools im System installiert waren; `sharp` dafür nur temporär in einem Scratch-Verzeichnis installiert, nicht als Projekt-Dependency). `vite-plugin-pwa` (`VitePWA`, Strategie `injectManifest`) in `vite.config.ts` ergänzt, erzeugt `manifest.webmanifest` und baut `src/sw.ts`. `index.html` um `apple-touch-icon`/`theme-color`/`apple-mobile-web-app-capable` ergänzt (von vite-plugin-pwa nicht automatisch abgedeckt).
*   **Service Worker** (`src/sw.ts`, neu): `precacheAndRoute()` für App-Shell-Caching, **plus** eine `NavigationRoute`, die jede Navigation auf das gecachte `index.html` umleitet (`workbox-routing` neu als Dependency) — ohne diese Route schlägt ein Reload auf einer Client-seitigen Route wie `/add` offline fehl, da dafür kein eigener Precache-Eintrag existiert (per Playwright-Test entdeckt, siehe Punkt 3). `sync`-Event-Listener für Tag `sync-transactions`, der die Offline-Warteschlange abarbeitet.
*   **IndexedDB-Offline-Layer** (`src/lib/offlineDb.ts`, neu, via `idb`): Stores `categories`/`transactions`/`budgets` (Read-Through-Cache) und `pendingTransactions` (Offline-Warteschlange). `listWithCache()` als einzige gemeinsame Fallback-Funktion für alle drei Listen-Seiten. Bewusst **kein** Workbox-Runtime-Caching für API-GETs zusätzlich eingerichtet — nur eine Offline-Datenquelle statt zwei sich potenziell widersprechenden Caches.
*   **Sync-Logik** (`src/lib/syncTransactions.ts`, neu): `replayPendingTransactions()` nutzt bewusst rohes `fetch()` statt des axios-`apiClient`, da axios im Service-Worker-Kontext (keine `XMLHttpRequest`) nicht funktioniert. Wird sowohl vom `sync`-Event in `sw.ts` als auch von einem `online`-Event-Handler in `src/pwa.ts` aufgerufen — Background Sync wird per `'sync' in registration` feature-detected, bei fehlender Unterstützung (v. a. Safari/iOS) greift der manuelle `online`-Fallback.
*   **Quick-Add-Seite** (`src/pages/QuickAddPage.tsx`, neu, Route `/add`): Betrag + Ausgabe/Einnahme-Umschalter, Beschreibung, Kategorie (offline-fähig via `listWithCache`), Datum (explizit auf "heute" vorbelegt, bleibt so auch bei späterer Synchronisierung korrekt). Bei einem echten Netzwerkfehler (kein `err.response`, nicht bloß ein 4xx/5xx) wird die Transaktion in `pendingTransactions` geschrieben statt einen Fehler zu zeigen. `AppShell` um Nav-Link "Hinzufügen" und ein Pending-Sync-Badge ergänzt.
*   **TypeScript-Setup für `sw.ts`:** eigene `tsconfig.sw.json` (Lib `WebWorker` statt `DOM` — beide sind inkompatibel im selben Programm). Erster Versuch, sie per `references` in die Haupt-`tsconfig.json` einzuhängen, scheiterte an TS6305 (dieselbe Datei kann nicht gleichzeitig direkt von der Root-`tsconfig.json` erfasst *und* Teil eines composite-referenzierten Projekts sein) — gelöst, indem `tsconfig.sw.json` als eigenständige, nicht referenzierte Konfiguration für manuelles/IDE-Typechecking steht (`npx tsc -p tsconfig.sw.json`), während `src/sw.ts` aus der Haupt-`tsconfig.json` per `exclude` herausgehalten wird.
*   Zwei echte Bugs beim End-to-End-Test entdeckt und behoben (siehe Punkt 3): fehlende SPA-Navigation-Fallback-Route und `AuthContext`, das Offline-Netzwerkfehler fälschlich wie "nicht eingeloggt" behandelte.
*   Verifiziert: `npm run build` (Frontend, 0 Fehler) + `npx tsc -p tsconfig.sw.json` (0 Fehler); `npm run build`/`npm test` (Backend, unverändert, 19/19 grün). Vollständiger End-to-End-Test via Playwright (temporär installiert, s. u.) gegen einen echten Produktions-Build (`vite build` + `vite preview` — der `npm run dev`-Modus precacht die App-Shell nicht wirklich, da Vite dort Module on-demand ausliefert): Login → `/add` → Offline schalten → Formular absenden → "Offline gespeichert"-Banner statt Fehler → Pending-Badge zeigt 1 → Seite währenddessen neu geladen → App bleibt eingeloggt und auf `/add`, Badge weiterhin 1 (belegt IndexedDB-Persistenz, nicht nur React-State) → wieder online + `online`-Event ausgelöst → Badge verschwindet, Transaktion serverseitig verifiziert vorhanden.

#### 2. Warum wurde es getan?
*   Nutzer bestätigte Phase 4 als funktionierend und wollte laut Roadmap mit Phase 5 weitermachen. Da "Background-Sync für verzögerte Transaktionen" ohne eine Erfassungs-UI nicht sinnvoll testbar/nutzbar wäre, wurde die Quick-Add-Seite auf Nutzerwunsch mit eingeschlossen statt Offline-Infrastruktur ohne echten Anwendungsfall zu bauen.

#### 3. Auswirkungen / Nebenwirkungen
*   **Zwei Bugs, die ausschließlich der echte Offline-Test aufgedeckt hat** (rein statische Prüfung/Build hätte sie nicht gefunden): (a) Ohne `NavigationRoute`-Fallback in `sw.ts` schlug ein Seiten-Reload auf jeder Route außer `/` offline fehl (`net::ERR_INTERNET_DISCONNECTED`), weil `precacheAndRoute()` allein Client-seitige Routen nicht auf die gecachte `index.html` abbildet. (b) `AuthContext.refresh()` (aus Phase 4) behandelte jeden fehlgeschlagenen `/auth/me`-Aufruf als "nicht eingeloggt" — offline wurde der Nutzer dadurch bei jedem Reload zur Login-Seite zurückgeworfen, obwohl die Session eigentlich noch gültig war. Behoben durch einen zusätzlichen `localStorage`-Eintrag (`finanz-pwa:lastUser`), der bei einem reinen Netzwerkfehler (kein `err.response`) als optimistische Offline-Session-Annahme dient; ein echtes 401 (Server erreichbar, Session ungültig) loggt weiterhin korrekt aus.
*   Die `transactions`/`budgets`-IndexedDB-Caches halten jeweils nur das Ergebnis der zuletzt erfolgreichen Abfrage (z. B. nur der aktuelle Monat) — bewusst kein vollständiger Offline-Verlauf, siehe Kommentar in `offlineDb.ts`.
*   Echtes Background-Sync-`sync`-Event (nicht der `online`-Fallback) ist Browser-/OS-getaktet und in headless Chromium nicht deterministisch auslösbar — daher nur manuell in einem echten Chrome verifiziert, nicht automatisiert getestet.
*   Playwright wurde erneut nur temporär in einem Scratch-Verzeichnis installiert (nicht Teil von `package.json`), Chromium-Binary aus Phase-4-Cache wiederverwendet.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Phase 4 (Visualisierung & Dashboards) implementiert — inkl. Frontend-Fundament
**Zeitstempel:** `2026-08-17 14:30`

#### 1. Was wurde getan?
*   Vor Beginn geprüft: Frontend besaß noch **kein** `src/`, kein `tsconfig.json`, kein Tailwind-Setup — nur `package.json`/`vite.config.ts`/`index.html` als Rohgerüst; `BudgetsController`/`BudgetsService` waren leere Stubs. Nutzer entschied sich (per Rückfrage) für die volle Variante: Frontend-Fundament + Budgets-Backend zuerst, danach das Dashboard obendrauf — statt zuerst die aus Phase 3 zurückgestellte Quick-Add-UI zu bauen.
*   **Backend – Budgets-CRUD:** `src/budgets/dto/{create,update,find-budgets-query}-budget.dto.ts`, `budgets.service.ts`, `budgets.controller.ts` nach dem exakten Muster von `CategoriesService`/`CategoriesController` implementiert (`assertCategoryOwnership`, `NotFoundException`/`ForbiddenException`, optionaler `month`-Query-Filter). Bestehende Default-Boilerplate-Specs auf gemockten `PrismaService` umgestellt.
*   **Backend – `GET /auth/me`:** `AuthService.me()` + `AuthController`-Route ergänzt (nicht `@Public()` — der globale `JwtAuthGuard` liefert das 401-Signal "nicht eingeloggt" kostenlos mit). Notwendig, weil es zuvor keinen Weg gab, nach einem Seitenreload zu prüfen, ob die Session noch gültig ist.
*   **Frontend-Fundament:** `tsconfig.json`/`tsconfig.node.json`, `vite.config.ts` (+ `@tailwindcss/vite`-Plugin), `src/index.css` (Tailwind-v4-Import + `@custom-variant dark` für klassenbasierten statt rein OS-basierten Dark Mode), `src/main.tsx`, `src/App.tsx` (Routing via `react-router-dom` v7), `frontend/.gitignore` (fehlte komplett), `frontend/.env.example`. Neue Dependencies: `@tailwindcss/vite`, `chart.js`, `react-chartjs-2`, `@simplewebauthn/browser`.
*   **API-Client-Layer** (`src/lib/api/`): dünne Axios-Wrapper (`client.ts` mit `withCredentials: true`, `auth.ts`, `categories.ts`, `transactions.ts`, `budgets.ts`) plus `src/lib/money.ts` (Cent↔EUR), `src/lib/dateRange.ts`, `src/lib/budgetCalc.ts` (u. a. `projectRemainingBudget` für die Restbudget-Prognose).
*   **Auth-Flow:** `AuthContext` (Status `loading`/`authenticated`/`anonymous`, prüft per `GET /auth/me` beim Mount), `DarkModeContext` (localStorage → OS-Präferenz-Fallback), `ProtectedRoute`, `LoginPage` (Passwort+optionales TOTP-Feld, das erst bei Backend-Antwort `"TOTP code required"` eingeblendet wird, plus Passkey-Login via `startAuthentication()` aus `@simplewebauthn/browser`). Passkey-**Registrierung** und TOTP-**Enrollment**-UI bewusst zurückgestellt (Seed-Nutzer hat bereits ein funktionierendes Passwort).
*   **Layout & Dashboard:** `AppShell` (Nav, Dark-Mode-Toggle, Logout), `IncomeExpenseChart` (Chart.js Liniendiagramm, Einnahmen/Ausgaben pro Tag), `BudgetProgressBar` (Status-Meter gut/warnung/kritisch mit Icon+Label), `StatTile`, `DashboardPage` (Monatssummen, Zeitverlauf-Chart, Restbudget-Prognose, Budget-Fortschrittsbalken je Kategorie), `BudgetsPage` (Liste + Anlegen/Bearbeiten/Löschen).
*   Vor dem Bau der Charts wurde die `dataviz`-Skill geladen und die verwendete Kategorial-Palette (Blau `#2a78d6`/`#3987e5` für Einnahmen, Orange `#eb6834`/`#d95926` für Ausgaben) per `scripts/validate_palette.js` in beiden Modi validiert (alle Checks bestanden); Rot ist bewusst für den kritischen Budget-Status reserviert und wird nicht als Serienfarbe wiederverwendet.
*   Verifiziert: `npm run build` (Backend, 0 Fehler) + `npm test` (19/19 grün); `npm run build` (Frontend, `tsc` + `vite build`, 0 Fehler). Echter Browser-Test via Playwright (temporär in den Scratchpad installiert, nicht Teil des Projekts): Login mit Seed-Nutzer → Dashboard mit echten Transaktionsdaten → Budget anlegen (`/budgets`) → zurück zum Dashboard, Fortschrittsbalken zeigt korrekt "Budget überschritten (154%)" in Rot mit Icon → Dark-Mode-Toggle färbt Seite und Chart korrekt um → Logout leitet korrekt auf `/login` um. Keine unerwarteten Konsolenfehler (nur die erwarteten 401 der `/auth/me`-Prüfung im anonymen Zustand).
*   Dabei aufgefallen: Die lokale Postgres-Instanz (`finance_postgres`) enthielt noch **keinen** Nutzer — Migrationen waren angewendet, aber `prisma db seed` war nie gelaufen (Prisma 7 liest den Seed-Befehl nicht mehr aus `package.json`, sondern erwartet ihn in `prisma.config.ts`; `npx prisma db seed` bricht daher mit "No seed command configured" ab). Für den Test direkt `npx ts-node prisma/seed.ts` ausgeführt — dadurch existiert jetzt der Seed-Nutzer inkl. einer Test-Kategorie ("Lebensmittel") und einigen Testbuchungen/einem Testbudget im lokalen Dev-System.

#### 2. Warum wurde es getan?
*   Nutzer wollte laut Roadmap mit Phase 4 ("Visualisierung & Dashboards") weitermachen. Da das Frontend bei null anfing, wurde per Rückfrage geklärt, dass das komplette Fundament (Routing, Auth, Layout) inklusive Budgets-Backend jetzt mitgebaut werden soll, nicht nur die Chart-Komponenten.

#### 3. Auswirkungen / Nebenwirkungen
*   `prisma.config.ts` müsste um einen `migrations.seed`-Eintrag ergänzt werden, damit `npx prisma db seed` (statt des Workarounds `npx ts-node prisma/seed.ts`) wieder funktioniert — wurde in diesem Schritt nicht angefasst, da außerhalb des Auftrags.
*   Der laufende `finance_backend`-Docker-Container läuft noch auf dem **alten** Image ohne die neuen Budgets-/`/auth/me`-Endpunkte. Für produktiven Gebrauch (nicht nur `npm run dev`) muss der Nutzer `docker compose up -d --build backend` selbst ausführen — wurde nicht automatisch gemacht, da das Neubauen/Neustarten eines laufenden Containers eine Bestätigung durch den Nutzer erfordert.
*   Passkey-Registrierung und TOTP-Enrollment sind weiterhin nur über die REST-Endpunkte erreichbar, nicht über die UI — folgt als eigener Schritt (Settings-Seite).
*   `frontend/.env` wurde lokal angelegt (`VITE_API_URL="http://localhost:3000"`, passend zum Docker-Compose-Setup) und ist über `frontend/.gitignore` von der Versionskontrolle ausgeschlossen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen — [ ] Docker-Image-Rebuild durch Nutzer erforderlich, um die neuen Endpunkte auch im Container-Betrieb verfügbar zu machen

---

### 📋 Schritt-Log: Phase 3 (Kernfunktionen, Backend-Teil) implementiert
**Zeitstempel:** `2026-08-17 12:15`

#### 1. Was wurde getan?
*   `backend/prisma/schema.prisma`: zwei neue Modelle ergänzt — `CategoryRule` (`userId`, `matchText` normalisiert, `categoryId`, `useCount`, `@@unique([userId, matchText])`) und `RecurringTransaction` (`userId`, `amount`, `description`, `categoryId`, `dayOfMonth`, `active`, `lastRunAt`); Rückrelationen auf `User` und `Category` ergänzt. Migration `20260817090244_add_recurring_and_category_rules` erstellt und gegen die laufende `finance_postgres`-Instanz angewendet (per `DATABASE_URL` auf `localhost:5432` umgebogen, da lokal ohne Docker-Volume-Mount ausgeführt).
*   `@nestjs/mapped-types` und `@nestjs/schedule` als Dependencies ergänzt (`PartialType` für Update-DTOs bzw. `ScheduleModule`/`@Cron` für den täglichen Job); `ScheduleModule.forRoot()` in `src/app.module.ts` registriert.
*   `src/categories/`: `CategoriesService`/`CategoriesController` mit vollem CRUD implementiert (Create/List/FindOne/Update/Delete, jeweils auf `userId` gescoped, `NotFoundException` bei fremden/fehlenden IDs) — war Voraussetzung, da `Transaction.categoryId` pflicht ist und es zuvor keinen Weg gab, Kategorien überhaupt anzulegen.
*   `src/transactions/`: `TransactionsService`/`TransactionsController` mit vollem CRUD implementiert (inkl. Query-Filter `categoryId`/`startDate`/`endDate`, Eigentümerprüfung der `categoryId` gegen fremde Kategorien via `ForbiddenException`).
*   `src/transactions/categorization.service.ts` (`CategorizationService`) neu angelegt — Lernfunktion für wiederkehrende Zahlungsempfänger: `normalize()` (trim+lowercase), `suggestCategoryId()` (Lookup per `CategoryRule`), `learn()` (Upsert, `useCount` inkrementiert). In `TransactionsService.create/update` verdrahtet: wird `categoryId` explizit mitgegeben, wird sie übernommen und die Regel gelernt/verstärkt; wird sie weggelassen, greift die zuletzt gelernte Regel für die (normalisierte) Beschreibung, sonst `BadRequestException`.
*   Neues Modul `src/recurring-transactions/` (Controller/Service/DTOs) für automatisierte Wiederholungen (Gehalt/Fixkosten): CRUD unter `/recurring-transactions`, plus `runDueRecurringTransactions()` (findet aktive Einträge, deren `dayOfMonth` auf heute fällt und die diesen Monat noch nicht gelaufen sind, postet je eine `Transaction` über den bestehenden `TransactionsService.create()` — dadurch lernt/verstärkt ein Recurring-Lauf ebenfalls die Kategorisierungs-Regel — und aktualisiert `lastRunAt`). Ein dünner `@Cron(CronExpression.EVERY_DAY_AT_1AM)`-Handler ruft dieselbe Methode täglich auf.
*   `src/app.module.ts`: `RecurringTransactionsModule` ergänzt.
*   Bestehende Default-Boilerplate-Specs (`transactions.*.spec.ts`, `categories.*.spec.ts`) so angepasst, dass sie gegen die jetzt echten Konstruktoren kompilieren (gemockter `PrismaService`/Service); neue fokussierte Unit-Tests für `CategorizationService` (normalize/suggest/learn) und `RecurringTransactionsService.runDueRecurringTransactions` (fällig heute / falscher Tag / bereits diesen Monat gelaufen / erneut im Folgemonat fällig) ergänzt.
*   Verifiziert: `npx prisma generate` + `npx prisma migrate dev` (inkl. der zuvor noch ausstehenden `init`-Migration) erfolgreich gegen die laufende Postgres-Instanz; `npm run build` (0 Fehler); `npm test` (19/19 grün); manueller End-to-End-Test über einen temporären Testnutzer (angelegt und danach wieder vollständig gelöscht, echter Seed-Nutzer nicht angetastet) gegen den echten, laufenden Server: Kategorie anlegen, Transaktion mit `categoryId` anlegen (lernt Regel), zweite Transaktion mit gleicher Beschreibung ohne `categoryId` (wird korrekt automatisch kategorisiert), unbekannte Beschreibung ohne `categoryId` (korrekt 400), Recurring-Transaction für heutigen `dayOfMonth` anlegen und den echten (kompilierten, verdrahteten) Cron-Handler einmal manuell ausgeführt — korrekt eine neue `Transaction` gepostet und `lastRunAt` gesetzt.

#### 2. Warum wurde es getan?
*   Nutzer bestätigte, dass Phase 2 (Backend) getestet funktioniert, und wollte mit Phase 3 der Roadmap ("Kernfunktionen & Smart-Eingabe") weitermachen. Da das Frontend noch kein `src/` besitzt, wurde der Umfang gemeinsam mit dem Nutzer auf den Backend-Teil eingegrenzt (CRUD, automatisierte Wiederholungen, regelbasierte Kategorisierung); Quick-Add-UI im Frontend folgt als separater Schritt.

#### 3. Auswirkungen / Nebenwirkungen
*   `Transaction.categoryId` bleibt in der DTO optional, wird aber serverseitig entweder aus dem Request oder aus einer gelernten `CategoryRule` aufgelöst — ohne Treffer schlägt das Erstellen mit 400 fehl. Das zukünftige Frontend kann `categoryId` beim Quick-Add einfach weglassen, um von der Auto-Kategorisierung zu profitieren.
*   Der tägliche Cron-Job läuft ab sofort automatisch um 1 Uhr nachts (`EVERY_DAY_AT_1AM`) für alle aktiven `RecurringTransaction`-Einträge aller Nutzer — aktuell gibt es noch keine UI, um solche Einträge anzulegen, nur die REST-Endpunkte unter `/recurring-transactions`.
*   `backend/.env.example` enthält im Arbeitsverzeichnis unabhängig von dieser Änderung bereits reale Secrets (`JWT_SECRET`, `SEED_USER_PASSWORD`) statt Platzhaltern — dem Nutzer separat gemeldet, aber im Rahmen dieses Schritts nicht angefasst.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Backend-Teil von Phase 3)

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
