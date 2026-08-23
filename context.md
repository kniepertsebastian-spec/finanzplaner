# context.md — Handoff für neue Claude-Sessions

**Zweck dieser Datei:** Ein neuer Claude Code Session-Start (v. a. eine frische Cloud-Session ohne Erinnerung an vorherige Chats) soll diese Datei lesen und **ohne Rückfragen** wissen: was ist das Projekt, was ist fertig, was ist offen, welche Umgebungs-Einschränkungen gelten. Bei Widerspruch zwischen dieser Datei und dem tatsächlichen Repo-Zustand (Code/Git) gilt der Repo-Zustand — dann diese Datei korrigieren.

**Lesereihenfolge beim Einstieg in einen neuen Schritt:**
1. Diese Datei (`context.md`) — Überblick + Umgebungsfakten.
2. `doku/LOG_DOKUMENTATION.md` — **nur den obersten (neuesten) Eintrag**, für den exakten letzten Schritt.
3. `claude/roadmap.md` — Phasenplan, falls der nächste Schritt unklar ist.
4. `features.md` — vollständige Feature-Liste als Ist-Zustand.
5. `git log --oneline -5` und `git status` — Ground Truth, immer aktueller als jede Doku.

---

## 1. Was ist das Projekt

**Finanz-PWA** ("Finanzguru-Style ohne Bank-Pull"): persönliche Finanzverwaltungs-App für **einen einzigen Nutzer** (keine öffentliche Registrierung), manuelle Buchungserfassung statt Bank-Anbindung.

- **Frontend:** React + Vite, PWA (installierbar, offline-fähig), Tailwind CSS, `react-router-dom` v7.
- **Backend:** NestJS (TypeScript), REST-API.
- **DB:** PostgreSQL via Prisma ORM 7 (Geldbeträge **immer** als Cent-Integer, nie Float).
- **Cache/Rate-Limiting:** Redis.
- **Auth:** Passkeys (WebAuthn) primär, Passwort+TOTP als Fallback, JWT in `HttpOnly`-Cookie.
- **Deployment:** Docker Compose, produktiv auf einem privaten Mini-PC des Nutzers (siehe Abschnitt 3).
- **Doku-Pflicht:** Nach jedem abgeschlossenen Arbeitsschritt einen neuen Eintrag **oben** in `doku/LOG_DOKUMENTATION.md` anlegen, Schema/Vorlage steht in `claude/doku.md`. Das ist eine verbindliche Workflow-Regel dieses Projekts, keine Empfehlung.

---

## 2. Repo-Struktur (wo liegt was)

```
/
├── backend/                    NestJS-API
│   ├── prisma/schema.prisma    DB-Schema (Quelle der Wahrheit für Datenmodell)
│   ├── prisma/migrations/      chronologische SQL-Migrationen
│   ├── src/<feature>/          je ein Modul: auth, transactions, categories,
│   │                           budgets, recurring-transactions, invoices, users
│   └── .env.example            Vorlage — ⚠️ enthält noch echt aussehende Werte, siehe TODO
├── frontend/
│   ├── src/pages/               eine Datei pro Route
│   ├── src/components/          + components/settings/ für die Settings-Unterseiten
│   ├── src/lib/api/             dünne Axios-Wrapper, ein Modul pro Backend-Ressource
│   ├── src/lib/offlineDb.ts     IndexedDB-Cache + Offline-Warteschlange
│   ├── src/sw.ts                Service Worker (Workbox)
│   └── .env.example
├── docker-compose.yml           LOKALE Entwicklung (Postgres/Redis/Backend/Frontend + Bookstack)
├── docker-compose.prod.yml      NUR für den Mini-PC — anderer Aufbau, kein Host-Port, `edge`-Netzwerk
├── doku/LOG_DOKUMENTATION.md    Chronologischer Änderungslog, NEUESTER Eintrag OBEN
├── claude/roadmap.md            Phasenplan (Phase 1–8), Status Quo oben im Dokument
├── claude/doku.md               Vorlage/Regeln für den Log-Eintrag
└── features.md                 Ist-Zustand aller Features, kein Verlauf
```

---

## 3. Umgebungs-/Zugriffsfakten — UNBEDINGT BEACHTEN, nicht neu herausfinden müssen

Es gibt zwei grundverschiedene Session-Umgebungen, die an diesem Projekt arbeiten. **Vor Docker-/SSH-Aktionen immer prüfen, in welcher man sich befindet** (`docker ps` testen, `command -v ssh` testen) — nicht raten.

### a) Cloud-Remote-Session (z. B. diese hier, `claude.ai/code`)
- Läuft in einem isolierten Container **ohne Docker-Daemon** (`docker ps` schlägt fehl: *"failed to connect to the docker API"*).
- **Kein Netzwerkpfad ins private LAN des Nutzers** (`192.168.178.0/24`) — ein TCP-Connect zu `192.168.178.151:22` läuft in einen Timeout, unabhängig von SSH-Keys/Credentials. Es gibt keinen Tunnel/keine Route dorthin.
- Kann also **nicht**: gegen eine echte Postgres/Redis-Instanz testen, `docker compose` ausführen, den Mini-PC per SSH erreichen, Live-Browser-Checks gegen `https://finance.pwa-tree.de` machen (dort ist TOTP/2FA aktiv, ein automatisierter Login schlägt ohnehin fehl).
- Verifikation ist hier beschränkt auf: `npx prisma validate`/`format`, Backend `npm run build` + `npm test` (Jest mit gemocktem Prisma, braucht keine echte DB), Frontend `npx tsc --noEmit`. Das ist ausreichend und muss vor jedem Commit laufen — aber **ehrlich als "nicht live getestet" kennzeichnen**, nicht als vollständige Verifikation ausgeben.
- Deployment auf den Mini-PC kann von hier aus **nicht** durchgeführt werden. Stattdessen: Schritte dokumentieren (siehe Abschnitt 5) und dem Nutzer für eine lokale/Mini-PC-Session übergeben.

### b) Lokale Session (Nutzer-WSL-Klon oder direkt auf dem Mini-PC)
- Hat Docker, kann `docker compose up -d --build` etc. ausführen.
- SSH-Zugriff auf den Mini-PC: Host `pwa01`, IP `192.168.178.151`, User `claude`, lokaler Alias `minipc` (Key `~/.ssh/mini-pc-claude`, existiert nur auf der Maschine des Nutzers, **nicht** in einer Cloud-Session).
- Produktions-Klon liegt auf dem Mini-PC unter `~/finanzplaner`.

### Produktion
- Live unter **`https://finance.pwa-tree.de`** (Cloudflare-Tunnel, Containername `finanzplaner-frontend` im `edge`-Docker-Netzwerk, kein Host-Port veröffentlicht).
- 2FA/TOTP ist auf dem Prod-Account aktiv.
- Compose-Datei dort: `docker-compose.prod.yml` (im Repo, Root-Verzeichnis) — **nicht** identisch mit dem lokalen `docker-compose.yml`.
- Migration deployen (auf dem Mini-PC, nach `git pull` + Rebuild): 
  ```
  docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
  ```
- Secrets liegen ausschließlich in `.env`/`backend/.env` auf dem Mini-PC (chmod 600), nie im Git committed.

---

## 4. Was ist fertig (✅ implementiert, Code committed)

Details siehe `features.md`. Kurzfassung nach Roadmap-Phasen:

- [x] Phase 1 — Infrastruktur, DB-Schema, Migrations-Setup
- [x] Phase 2 — Auth: Passkeys, TOTP-Fallback, JWT-Cookie, Redis-Rate-Limiting
- [x] Phase 3 — Transaktions-CRUD, Quick-Add, automatisierte Fixkosten-Buchungen, lernende Kategorisierung
- [x] Phase 4 — Dashboard/Charts, Budget-CRUD, Restbudget-Prognose
- [x] Phase 5 — PWA-Manifest, Service Worker, IndexedDB-Offline-Cache, Background-Sync
- [x] Phase 6 — Settings-UI: Passkey-Verwaltung, TOTP-Enrollment, Fixkosten-Verwaltung, Kategorie-Verwaltung
- [x] Zusatzfeatures (nach Phase 6, vor Phase 7 der ursprünglichen Roadmap):
  - [x] Fixkosten mit echtem Fälligkeitsdatum (`nextDueDate`) statt Tag-im-Monat, frei wählbarer Rhythmus (`intervalMonths`)
  - [x] Fixkosten bearbeiten (Edit-UI + Bugfix in `update()`)
  - [x] Monats-Fixkosten-Summe auf dem Dashboard
  - [x] Beleg-Upload (Invoices-Modul) mit 30-Tage-Auto-Löschung
  - [x] `avoidable`/`inefficient`-Flags auf Transaktionen und Fixkosten-Regeln
  - [x] `tooExpensive` ("zu hoch")-Flag auf Transaktionen und Fixkosten-Regeln — **Code fertig, siehe Abschnitt 5 für Deploy-Status**
  - [x] Transaktionen-Edit-UI (`/transactions` mit Bearbeiten-Formular)
  - [x] Spracheingabe ("Tippen-zum-Sprechen") für Quick-Add
  - [x] Mobile Navigation als Dropdown-Menü statt Zeile, Safe-Area-Support
  - [x] Produktions-Deployment auf dem Mini-PC unter `finance.pwa-tree.de` eingerichtet

---

## 5. Was im Code fertig ist, aber NOCH NICHT deployed

- [ ] **`tooExpensive`-Flag (Migration `20260823171500_add_too_expensive_flag`).** Committed und gepusht auf Branch `claude/session-continuation-x6322m` (Commits `9b6c7ee`, `935cdae`), aber:
  - [ ] noch nicht in `main` gemerged (kein PR bisher eröffnet — Nutzer hat nicht danach gefragt)
  - [ ] noch nicht auf dem Mini-PC gepullt/gebaut/migriert
  - [ ] noch kein visueller Check im echten Browser (dritter Icon-Toggle "Zu hoch" auf `/transactions` und im Fixkosten-Panel)
  - Exakte Deploy-Schritte für den Mini-PC: siehe `doku/LOG_DOKUMENTATION.md`-Eintrag "Zu hoch-Flag" (2026-08-23 17:15) bzw. die dort verlinkte Anleitung. Kurzfassung: `git pull` → `docker compose -f docker-compose.prod.yml build backend frontend` → `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy` → `docker compose -f docker-compose.prod.yml up -d backend frontend`.

**Prüfe bei Sessionstart immer per `git log --oneline -5` und `git status`, ob sich das seither geändert hat** (z. B. Nutzer hat inzwischen selbst gemerged/deployed) — diese Datei wird nicht automatisch synchron gehalten.

---

## 6. Was noch offen ist (Roadmap Phase 7 + 8, aus `claude/roadmap.md`)

### Phase 7 — Datenexport, DSGVO & Unit-Tests
- [ ] CSV-Export aller Transaktionen/Budgets/Kategorien (Endpunkt + UI-Button)
- [ ] JSON-Export (dito)
- [ ] DSGVO-Account-Löschung (kaskadierendes Löschen aller Nutzerdaten in Postgres)
- [ ] Frontend-Unit-Tests (Vitest/Jest) für Geldberechnungen (`money.ts`, `budgetCalc.ts`, Cent-Rundungen, Restbudget-Prognose) — **aktuell existiert kein Frontend-Testrunner überhaupt**, neue Frontend-Logik wird bisher nur manuell/per Playwright verifiziert
- [ ] Fehler-Monitoring (Sentry o. ä.) für Frontend + Backend

### Phase 8 — Systembereinigung & Deployment-Vorbereitung
- [ ] `prisma.config.ts` um `migrations.seed` ergänzen, damit `npx prisma db seed` unter Prisma 7 nativ läuft (aktuell Workaround: `node dist/prisma/seed.js` bzw. `npx ts-node prisma/seed.ts`)
- [ ] **`backend/.env.example` bereinigen** — enthält aktuell noch einen real aussehenden `JWT_SECRET`-Wert sowie `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` mit der echten Nutzer-E-Mail und einem konkreten Passwort statt Platzhaltern. Sollte durch generische Platzhalter ersetzt werden.
- [ ] Docker-Compose für Produktion weiter optimieren / Rebuild-Verhalten verifizieren
- [ ] Caddyfile/Reverse-Proxy-Doku für HTTPS-Subdomain-Routing (aktuell läuft das über Cloudflare Tunnel + bestehendes Nginx im Frontend-Image, kein separater Caddy — evtl. nur noch Doku-Nacharbeit nötig, kein neuer Container)

Keine anderen offenen Punkte aus dem Log bekannt — alle früher als "Nutzer-Aktion ausstehend" markierten Punkte (Cloudflare Public Hostname, Dockerfile-Fix committen, `frontend/.env.production` ins Repo) sind laut späteren Log-Einträgen erledigt.

---

## 7. Architektur-Entscheidungen, die als getroffen gelten (nicht neu diskutieren)

- Single-User-App, keine öffentliche Registrierung, kein Multi-Tenant-Konzept nötig.
- Geldbeträge **immer** Cent-Integer, nie Float/Decimal.
- Passkey ist der primäre Login-Weg, Passwort+TOTP ist der Fallback (kein Passkey-only-Zwang).
- Ein einzelnes zustandsloses JWT in einem `HttpOnly`-Cookie, kein Refresh-Token-Konzept.
- `avoidable` / `inefficient` / `tooExpensive` sind **drei unabhängige Booleans** auf `Transaction` und `RecurringTransaction` — bewusst kein gemeinsames Enum, da eine Buchung mehrere dieser Eigenschaften gleichzeitig haben kann.
- Wiederkehrende Buchungen laufen über ein echtes `nextDueDate` (Kalenderdatum) + `intervalMonths` (Abstand) — nicht über einen reinen "Tag im Monat".
- Belege (Invoices) liegen ausschließlich auf dem lokalen Dateisystem des Mini-PCs (kein Cloud-Storage), analog zum bestehenden Schwesterprojekt `fitnesstracker` auf derselben Maschine.
- Kategorisierung lernt pro (normalisiertem) Beschreibungstext eine Regel (`CategoryRule`) — kein ML, reines Exact-Match-Lookup.

---

## 8. Checkliste für den Start eines neuen Arbeitsschritts

1. [ ] `git status` + `git log --oneline -5` — Ground Truth vor allem anderen.
2. [ ] Neuesten Eintrag in `doku/LOG_DOKUMENTATION.md` lesen (ganz oben).
3. [ ] Falls unklar, was als Nächstes ansteht: Abschnitt 5/6 dieser Datei bzw. `claude/roadmap.md` prüfen, sonst den Nutzer fragen statt zu raten.
4. [ ] Feststellen, in welcher Umgebung man läuft (Cloud ohne Docker/LAN-Zugriff vs. lokal/Mini-PC) — siehe Abschnitt 3 — und die Erwartungen an Verifikation entsprechend ehrlich kommunizieren.
5. [ ] Änderung umsetzen, dabei bestehende Muster wiederverwenden (z. B. neue Flags/CRUD-Felder exakt wie `avoidable`/`inefficient`/`tooExpensive` durchziehen: Schema → Migration → DTO → Service → Frontend-Typen → API-Modul → UI).
6. [ ] Verifizieren, was in der jeweiligen Umgebung möglich ist (mindestens: Backend-Build+Tests, Frontend-Typecheck).
7. [ ] Neuen Eintrag **oben** in `doku/LOG_DOKUMENTATION.md` gemäß Schema in `claude/doku.md`.
8. [ ] Diese Datei (`context.md`) aktualisieren, falls sich Abschnitt 4/5/6 (Status) geändert hat.
9. [ ] Committen + pushen auf den aktuellen Feature-Branch (nicht ungefragt auf `main`, nicht ungefragt einen PR eröffnen).
