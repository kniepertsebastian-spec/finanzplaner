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

### Phase 6: Datenschutz, Export & Feinschliff
* **Ziel:** Rechtssicherheit, Datenhoheit und Code-Qualität.
* **Tasks:**
  * DSGVO-konforme Funktionen für Daten-Export (CSV/JSON) und Account-Löschung bereitstellen.
  * Error Tracking (z. B. Sentry) einbinden.
  * Unit-Tests für kritische Finanzberechnungen (Saldo-Logik und Cent-Rundungen) schreiben.