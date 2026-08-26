# Project: Finanz-PWA ("Finanzguru-Style" ohne Bank-Pull)

## 📌 Tech-Stack & Architektur
* **Frontend:** React (Vite) als Progressive Web App (PWA)
* **Backend:** Node.js mit TypeScript & NestJS
* **Datenbank:** PostgreSQL (Wichtige Regel: Währungswerte intern *immer* als Cent-Integer speichern, um Rundungsfehler zu vermeiden!)
* **Caching / Rate-Limiting:** Redis
* **Infrastruktur:** Docker & Docker-Compose (Lokale Entwicklung & Deployment auf einer Single-VM sind identisch)
* **Sicherheit:** HTTPS, HttpOnly Cookies, WebAuthn (Passkeys) als primäre Auth + TOTP (Fallback)

---

## 🗺️ Phasen-Planung & Roadmap

### Phase 1: Fundament & Infrastruktur (Setup) ✅
* **Ziel:** Lokal stabile Umgebung und stehende Datenbasis.
* **Tasks:**
  * Repository-Struktur und Docker-Compose-Setup (`docker-compose.yml` für PostgreSQL, Redis, Backend, Frontend) einrichten.
  * PostgreSQL-Datenbankschema anlegen (`users`, `transactions`, `categories`, `budgets`).
  * Migrations-Tool (z. B. Prisma oder TypeORM) konfigurieren.

### Phase 2: Authentifizierung & Security (Passkeys) ✅
* **Ziel:** Sicherer, passwortloser Login-Flow.
* **Tasks:**
  * Backend-Endpunkte für WebAuthn (Passkeys) implementieren.
  * Fallback für klassischen Login + TOTP (Google Authenticator) einrichten.
  * JWT-Authentifizierung mit Speicherung in `HttpOnly` Cookies realisieren.
  * Rate-Limiting via Redis auf kritische Endpunkte (wie Login) legen.

### Phase 3: Kernfunktionen & Smart-Eingabe (Backend & UI) ✅
* **Ziel:** Reibungslose Erfassung von variablen Kosten und Einnahmen.
* **Tasks:**
  * CRUD-Operationen für Transaktionen im NestJS-Backend erstellen.
  * Quick-Add-Flow im Frontend umsetzen (2-Klick-Regel für schnelle Betragseingabe).
  * Automatisierte Wiederholungen (Scheduled Jobs) für Gehalt und Fixkosten einrichten.
  * Intelligente, regelbasierte Kategorisierung (Lernfunktion bei wiederkehrenden Empfängern).

### Phase 4: Visualisierung & Dashboards ✅
* **Ziel:** Perfekte Übersicht und Finanzanalyse.
* **Tasks:**
  * Integration von ECharts (oder Chart.js) für performante Finanz-Charts.
  * Dashboard-Timeline mit Einnahmen-Ausgaben-Vergleich und Restbudget-Prognose bauen.
  * Kategorie-Budgets mit visuellen Warnungen bei Grenzwertüberschreitung hinzufügen.
  * Dark-Mode-Unterstützung integrieren.

### Phase 5: PWA-Feinschliff & Offline-Modus ✅
* **Ziel:** Nativ-ähnliches Verhalten auf mobilen Endgeräten.
* **Tasks:**
  * Service Worker für App-Shell-Caching einrichten.
  * Offline-First-Architektur mit `IndexedDB` im Frontend aufbauen.
  * Background-Sync für verzögerte Transaktionen bei Netzwerkausfall konfigurieren.
  * Web Manifest für die PWA-Installierbarkeit auf dem Homescreen anpassen.

---

### Phase 6: Einstellungs- & Sicherheits-UI (Settings Page) ✅
* **Ziel:** Vollständige Verwaltung von Passkeys, 2FA und wiederkehrenden Buchungen über das Frontend.
* **Tasks:**
  * Route `/settings` in React mit responsivem Layout anlegen.
  * Passkey-Verwaltung: UI-Flow zur Registrierung neuer Passkeys via `@simplewebauthn/browser` (`startRegistration`) und Anzeige aktiver Authentikatoren.
  * TOTP-Enrollment: Dialog zur Generierung eines QR-Codes für Authenticator-Apps inkl. Verifizierungscode-Eingabe.
  * Fixkosten / Wiederkehrende Buchungen: UI-Verwaltung (Liste, Anlegen, Pausieren, Löschen) für `RecurringTransactions` (Gehalt, Miete, Abos) angebunden an die bestehenden Backend-Endpunkte.

### Phase 7: Datenexport, DSGVO & Unit-Tests
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

---

### Phase 9: Salden-Engine & Flexibler Gehaltszyklus
* **Ziel:** Realistische Finanzübersicht ohne starr an Kalendermonaten zu hängen.
* **Tasks:**
  * **Startsaldo & Reconciliation:** Initialer Basis-Kontostand sowie Ein-Klick-Funktion *„Saldo abgleichen“* (erzeugt automatische Ausgleichsbuchung bei Cent-Differenzen).
  * **Dynamischer Monatsstart:** Konfigurierbares Feld `salaryDayOfMonth` in `users` (z. B. 23. des Monats).
  * **Zyklus-Helfer (`getBillingCycle`):** Filterung aller Budgets und Dashboard-Transaktionen auf das flexible Fenster (`cycleStart` bis `cycleEnd`) inklusive Monatsende-Clamping.
  * **Frei verfügbares Einkommen:** Dashboard-Berechnung: $\text{Verfügbar} = \text{Gesamtsaldo} - \sum \text{ausstehende Fixkosten} - \sum \text{Rücklagen}$.
  * **Tages-Burn-Rate:** Dynamische Berechnung des verbleibenden Tagesbudgets bis zum nächsten Gehaltseingang.
  * **Cashflow-Projektion:** Tagesgenauer Liquiditätsverlauf im Dashboard mit optischer Warnung bei drohendem Saldo-Unterdeckungsrisiko.

### Phase 10: Virtuelle Töpfe & Vertragsmanagement
* **Ziel:** Sparziele verwalten und Fixkosten-Verträge im Blick behalten.
* **Tasks:**
  * **Virtuelle Töpfe (Sinking Funds):** Erstellung von Rücklagen (z. B. Notgroschen, Kfz-Steuer, Urlaub), die Teile des Gesamtsaldos sperren und vom frei verfügbaren Einkommen abziehen.
  * **Vertrags-Metadaten:** Erweiterung von `RecurringTransactions` um `cancellationPeriodDays` (Kündigungsfrist), `contractEndDate` (Mindestlaufzeit) und Vertragsnummer.
  * **Kündigungswecker:** Dashboard-Hinweise und Benachrichtigungen vor automatischer Vertragsverlängerung.
  * **Preiserhöhungs-Erkennung:** Automatischer Indikator bei Erhöhungen wiederkehrender Buchungsbeträge im Zyklusvergleich.

### Phase 11: Smarte Datenerfassung & Import
* **Ziel:** Manuellen Erfassungsaufwand minimieren.
* **Tasks:**
  * **CSV-Transaktions-Import:** Generischer Uploader mit interaktivem Spalten-Mapper (Datum, Betrag, Empfänger/Beschreibung) und Duplikaterkennung via Content-Hash.
  * **OCR-Belegscan:** Client- oder Worker-basierte Texterkennung (OCR) für hochgeladene Kassenbons zur automatischen Vorbefüllung von Betrag, Datum und Händler.
  * **Split-Transaktionen:** Aufteilung einer einzelnen Buchung auf mehrere Kategorien (z. B. 60 € Supermarkt $\rightarrow$ 45 € Lebensmittel, 15 € Drogerie).
  * **Währungsumrechner:** Schnelleingabe von Fremdwährungen bei Reisen mit direkter Umrechnung in den Cent-Basiswert.

### Phase 12: UI/UX Redesign & Modernes Dashboard
* **Ziel:** Hochwertige, übersichtliche und responsive Darstellung im Finanzguru-Stil.
* **Tasks:**
  * **Hero-Card mit Mesh-Gradient:** Zentrale Darstellung von Gesamtsaldo, frei verfügbarem Einkommen und Tagesbudget.
  * **Privacy-Mode (Blickschutz):** Globaler Toggle im Header zum Verwischen (`backdrop-blur`) sensibler Cent-Beträge.
  * **Moderne Chart-Ästhetik:** Glatte Bézier-Kurven (`tension: 0.4`) mit transparenten Farbverläufen, Donut-Chart für Kategorie-Anteile und gestrichelter Prognoselinie.
  * **Pill-Progress-Bars & Category Badges:** Abgerundete Budgetbalken mit Ampel-Farbübergängen und pastellfarbenen Icon-Badges.
  * **Micro-Interactions:** Zähl-Animationen für Beträge (Animated Counters), Skeleton-Loader mit Shimmer-Effekt und Transaktions-Gruppierung nach Datumsblöcken (*Heute*, *Gestern*).

### Phase 13: Auswertungen, Tags & PWA-Power-Features
* **Ziel:** Tiefe Einblicke in Ausgabengewohnheiten und volle PWA-Plattformintegration.
* **Tasks:**
  * **Erweiterte Analytics:** Automatische Berechnung der Sparquote, Sankey-Geldflussdiagramm und 50/30/20-Regel-Auswertung.
  * **Flag-Auswertung:** Aggregiertes Einsparpotenzial-Dashboard für die Flags *Vermeidbar*, *Ineffizient* und *Zu hoch*.
  * **Projektbezogene Tags:** Beliebige Hashtags (`#Urlaub2026`, `#Renovierung`) für kategorieübergreifende Auswertungen.
  * **Steuer-Marker:** Flag für steuerrelevante Buchungen inklusive gefiltertem Jahres-Export samt Belegen.
  * **Web Push Notifications:** Service-Worker-Benachrichtigungen bei Budgetüberschreitungen und anstehenden Großbuchungen.
  * **App Shortcuts:** Direkter Absprung aus dem Homescreen-Icon zur Schnellerfassung und Spracheingabe via Web Manifest.
  * **Batch-Bearbeitung:** Massenbearbeitung/-löschung in der Transaktionsliste.

---

### Phase 14: Vertrags-Benchmark & Sparpotenzial-Engine (Automatischer Vertrags-Check)
* **Ziel:** Automatische Erkennung überteuerter Verträge und ineffizienter Gebühren per Marktreferenz.
* **Tasks:**
  * **Typisierte Vertragsmetadaten (`contractDetails` JSONB in `RecurringTransactions`):**
    * *Strom / Gas:* Netto ct/kWh (Arbeitspreis), Grundpreis (€/Mo), geschätzter Jahresverbrauch.
    * *Internet (DSL/Glasfaser/Kabel):* Bandbreite (Mbit/s), Anschlusstyp, Monatspreis.
    * *Mobilfunk:* Datenvolumen (GB/Unlimited), Netz, Monatspreis.
    * *Versicherungen:* Typ (Haftpflicht, Hausrat, BU, Kfz, etc.), Tarifart (Single/Familie), Jahresbeitrag.
  * **Benchmark-Datensatz im Backend:** Strukturierte Referenztabelle mit Marktdurchschnitten und Schwellenwerten (Günstig / Fair / Teuer).
  * **Automatisches Flag-System:**
    * Verträge über Marktschnitt erhalten automatisch das Flag `Zu hoch`.
    * Automatische Erkennung von Bank- und Kontoführungsgebühren $\rightarrow$ direktes Vorschlagen von `Ineffizient / Vermeidbar`.
  * **Sparpotenzial-Widget:** Dashboard-Card mit aggregiertem monatlichem & jährlichem Einsparpotenzial sowie horizontalen Benchmark-Vergleichsskalen.

### Phase 15: Dynamischer Experten-Ratgeber & Smart-Finance-Feed
* **Ziel:** Zeitaktuelle Tipps zum Sparen, Investieren und für zusätzliches Einkommen direkt in der App bereitstellen.
* **Tasks:**
  * **Datenbankschema & Interaktions-Tracking:**
    * `AdviceTip`-Tabelle: Attribute wie `slug`, `title`, `content`, `category` (`SAVINGS`, `INCOME`, `TAX`, `SEASONAL`), `actionUrl`, `triggerRule` (JSON), `validFrom`/`validUntil` und `priority`.
    * `UserAdviceInteraction`-Tabelle: Speicherung des Nutzerstatus pro Tipp (`PINNED`, `DISMISSED`, `COMPLETED`).
  * **Regel- & Filter-Engine (`AdviceService`):**
    * *Saisonale Filter:* Abgleich mit aktuellem Datum (z. B. Kfz-Wechselsaison im Nov, Steuer-Deadlines).
    * *Verhaltens-Trigger (Behavioral Rules):* Hoher ruhender Saldo $\rightarrow$ Tagesgeld-/Zins-Tipp; Überproportionale Ausgaben in Kategorien (z. B. Gastro) $\rightarrow$ Cashback/Budgeting-Hinweise; Verträge mit Flag `Zu hoch` $\rightarrow$ Wechsel-Checklisten.
    * *Redis-Caching:* Caching aktiver globaler Tipps (TTL 1h) zur Entlastung von PostgreSQL.
  * **Content-Pipeline & Sync:**
    * Basis-Seed via `tips.json` für Entwicklungs- und Offline-Betrieb.
    * Optionaler Cron-Job zum periodischen Abgleich mit einem Remote-JSON-Feed (z. B. für Zinsanpassungen oder neue Steuerfreibeträge ohne App-Deployment).
  * **UI-Widget (`AdviceFeed`):**
    * Swipeable / dismissable Karten im Dashboard unterhalb des Hero-Bereichs.
    * Ein-Klick-Aktionen (`📌 Merken`, `✕ Ausblenden`, `✓ Erledigt`).
    * Offline-Fallback: Gecachte Tipps in `IndexedDB` speichern für unterbrechungsfreie Nutzung ohne Netz.

# Roadmap & Refactoring: Finanzplaner - security patch

### 16. Security & Authentifizierung ✅
- [x] **WebAuthn Multi-User-Fix für Passkey-Logins**
  - **Problem:** In `webauthn.service.ts` (`generateLoginOptions`) wird starr `prisma.user.findFirst()` aufgerufen[cite: 3]. Bei mehreren registrierten Nutzern schlägt der passwortlose Passkey-Login fehl.
  - **Lösung:** Bei Discoverable Credentials (Resident Keys) `allowCredentials` in `generateAuthenticationOptions` leer bzw. `undefined` übergeben, damit der Browser die Account-Auswahl anhand der Domain selbst übernimmt.
- [x] **Serverseitige JWT-Invalidierung via Redis beim Logout**
  - **Problem:** In `auth.service.ts` (`logout`) wird lediglich das Cookie im Browser gelöscht[cite: 3]. Ein abgefangenes Token bleibt bis zum Ablauf (`7d`) kryptografisch valide.
  - **Lösung:** Beim Logout das Token (oder dessen Hash/JTI) mit der verbleibenden Rest-TTL als Blacklist-Eintrag in Redis schreiben (`redis.set(token, 'revoked', 'EX', ttl)`) und im `JwtAuthGuard` gegenprüfen.

### 17. Datenkonsistenz & Fehlerbehandlung
- [ ] **DB-Transaktion für Saldo-Abstimmung (`reconcile`)**
  - **Problem:** In `users.service.ts` (`reconcile`) laufen die Kategorie-Suche/-Erstellung und das Erstellen der Buchung als separate Queries[cite: 3]. Bei Verbindungsabbrüchen entstehen inkonsistente Zustände.
  - **Lösung:** Beide Operationen wie bei `createSplit` in ein `prisma.$transaction([...])` kapseln.
- [ ] **Dateileichen-Rollback bei Rechnungs-Uploads**
  - **Problem:** In `invoices.controller.ts` speichert Multer die Datei auf der Festplatte[cite: 3]. Schlägt der DB-Insert in `InvoicesService.create()` fehl, verbleibt die Datei dauerhaft als verwaiste Leiche im Storage.
  - **Lösung:** In `invoices.controller.ts` oder `invoices.service.ts` einen `try/catch`-Block einbauen, der im Fehlerfall `node:fs/promises.unlink(filePath)` ausführt.

### 18. Monitoring & Wartung
- [ ] **Prometheus Metrics Endpunkt**
  - **Ziel:** `@willsoto/nestjs-prometheus` registrieren, um HTTP-Latenzen, Request-Counts und aktive DB-Pool-Verbindungen für Grafana bereitzustellen.
- [ ] **Cronjob-Heartbeats**
  - **Ziel:** In `recurring-transactions.service.ts` und `push.service.ts` bei erfolgreichem Durchlauf der täglichen Cronjobs einen Ping an Uptime Kuma oder Healthchecks.io absetzen[cite: 3].
