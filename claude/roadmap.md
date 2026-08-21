# Project: Finanz-PWA (\"Finanzguru-Style\" ohne Bank-Pull)

## 📌 Tech-Stack & Architektur
* **Frontend:** React (Vite) als Progressive Web App (PWA)
* **Backend:** Node.js mit TypeScript & NestJS
* **Datenbank:** PostgreSQL (Wichtige Regel: Währungswerte intern *immer* als Cent-Integer speichern, um Rundungsfehler zu vermeiden!)
* **Caching / Rate-Limiting:** Redis
* **Infrastruktur:** Docker & Docker-Compose (Lokale Entwicklung & Deployment auf einer Single-VM sind identisch)
* **Sicherheit:** HTTPS, HttpOnly Cookies, WebAuthn (Passkeys) als primäre Auth + TOTP (Fallback)

---

## 🗺️ Phasen-Planung & Roadmap

### Phase 1: Fundament & Infrastruktur (Setup)
* **Ziel:** Lokal stabile Umgebung und stehende Datenbasis.
* **Tasks:**
  * Repository-Struktur und Docker-Compose-Setup (`docker-compose.yml` für PostgreSQL, Redis, Backend, Frontend) einrichten.
  * PostgreSQL-Datenbankschema anlegen (`users`, `transactions`, `categories`, `budgets`).
  * Migrations-Tool (z. B. Prisma oder TypeORM) konfigurieren.

### Phase 2: Authentifizierung & Security (Passkeys)
* **Ziel:** Sicherer, passwortloser Login-Flow.
* **Tasks:**
  * Backend-Endpunkte für WebAuthn (Passkeys) implementieren.
  * Fallback für klassischen Login + TOTP (Google Authenticator) einrichten.
  * JWT-Authentifizierung mit Speicherung in `HttpOnly` Cookies realisieren.
  * Rate-Limiting via Redis auf kritische Endpunkte (wie Login) legen.

### Phase 3: Kernfunktionen & Smart-Eingabe (Backend & UI)
* **Ziel:** Reibungslose Erfassung von variablen Kosten und Einnahmen.
* **Tasks:**
  * CRUD-Operationen für Transaktionen im NestJS-Backend erstellen.
  * Quick-Add-Flow im Frontend umsetzen (2-Klick-Regel für schnelle Betragseingabe).
  * Automatisierte Wiederholungen (Scheduled Jobs) für Gehalt und Fixkosten einrichten.
  * Intelligente, regelbasierte Kategorisierung (Lernfunktion bei wiederkehrenden Empfängern).

### Phase 4: Visualisierung & Dashboards
* **Ziel:** Perfekte Übersicht und Finanzanalyse.
* **Tasks:**
  * Integration von ECharts (oder Chart.js) für performante Finanz-Charts.
  * Dashboard-Timeline mit Einnahmen-Ausgaben-Vergleich und Restbudget-Prognosebauen.
  * Kategorie-Budgets mit visuellen Warnungen bei Grenzwertüberschreitung hinzufügen.
  * Dark-Mode-Unterstützung integrieren.

### Phase 5: PWA-Feinschliff & Offline-Modus
* **Ziel:** Nativ-ähnliches Verhalten auf mobilen Endgeräten.
* **Tasks:**
  * Service Worker für App-Shell-Caching einrichten.
  * Offline-First-Architektur mit `IndexedDB` im Frontend aufbauen.
  * Background-Sync für verzögerte Transaktionen bei Netzwerkausfall konfigurieren.
  * Web Manifest für die PWA-Installierbarkeit auf dem Homescreen anpassen.

---

## 📌 Status Quo (Rest-Roadmap bis zum Release)

Erledigt: Phase 1 bis Phase 5 (DB-Setup, Auth-Backend, Offline-First mit IndexedDB,
Background-Sync, Quick-Add, Dashboard mit Chart.js, Budget-CRUD, PWA-Manifest & Service Worker).
Fokus ab hier: Schließen der UI-Lücken, Fertigstellung von Phase 6 (Export/DSGVO), Bereinigung
der Konfigurationen und Vorbereitung für das Single-VM-Deployment. Die ursprüngliche Phase 6
("Datenschutz, Export & Feinschliff") wird dafür in die Phasen 6–8 unten aufgeteilt.

### Phase 6: Einstellungs- & Sicherheits-UI (Settings Page) ✅
* **Ziel:** Vollständige Verwaltung von Passkeys, 2FA und wiederkehrenden Buchungen über das Frontend.
* **Tasks:**
  * Route `/settings` in React mit responsivem Layout anlegen.
  * Passkey-Verwaltung: UI-Flow zur Registrierung neuer Passkeys via `@simplewebauthn/browser` (`startRegistration`) und Anzeige aktiver Authentikatoren.
  * TOTP-Enrollment: Dialog zur Generierung eines QR-Codes für Authenticator-Apps inkl. Verifizierungscode-Eingabe.
  * Fixkosten / Wiederkehrende Buchungen: UI-Verwaltung (Liste, Anlegen, Pausieren, Löschen) für `RecurringTransactions` (Gehalt, Miete, Abos) angebunden an die bestehenden Backend-Endpunkte.

### Phase 7: Datenexport, DSGVO & Unit-Tests (Abschluss Phase 6 der alten Roadmap)
* **Ziel:** Rechtssicherheit, Datenhoheit und mathematische Korrektheit.
* **Tasks:**
  * CSV- & JSON-Export: Endpunkte und UI-Buttons für den vollständigen Download aller Transaktionen, Budgets und Kategorien.
  * Account-Löschung: DSGVO-konformer Endpunkt zur vollständigen Löschung aller verknüpften Nutzerdaten (kaskadierendes Löschen in Postgres).
  * Frontend-Unit-Tests: Vitest/Jest-Tests für alle finanzrelevanten Berechnungen (`money.ts`, Cent-Rundungen, Saldo-Summen, Restbudget-Prognosen).
  * Fehler-Monitoring: Integration von Sentry (oder einer leichtgewichtigen Alternative) für ungefangene Frontend- und Backend-Fehler.

### Phase 8: Systembereinigung & Deployment-Vorbereitung
* **Ziel:** Einwandfreies Docker-Build-Verhalten und produktionsreife Konfiguration für den VPS.
* **Tasks:**
  * `prisma.config.ts` um `migrations.seed` erweitern, damit `npx prisma db seed` unter Prisma 7 fehlerfrei läuft.
  * `backend/.env.example` bereinigen (reale Secrets durch Platzhalter ersetzen).
  * Docker-Compose für Produktion optimieren: Backend-Image-Rebuild verifizieren (`docker compose up -d --build backend`).
  * Reverse-Proxy-Konfiguration (Caddyfile) für HTTPS-Subdomain-Routing (`fitnesstracker.*`, `finanzplaner.*`) anlegen.