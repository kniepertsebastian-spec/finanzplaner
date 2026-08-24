# Feature-Übersicht: Finanz-PWA

Vollständige Liste aller aktuell implementierten Features, gruppiert nach Bereich. Diese Datei bildet den Ist-Zustand ab (Stand: siehe `doku/LOG_DOKUMENTATION.md` für den Verlauf) — für geplante, noch offene Punkte siehe `claude/roadmap.md`.

---

## 🔐 Authentifizierung & Sicherheit

- **Passwort-Login** (E-Mail + Passwort, Argon2-Hashing).
- **Passkeys (WebAuthn):** Registrierung neuer Passkeys direkt im Browser (`@simplewebauthn/browser`), Login ganz ohne Passwort, Verwaltung (Liste, benannte Geräte, Löschen) unter *Einstellungen*.
- **TOTP (Zwei-Faktor / Authenticator-App):** Aktivierung per QR-Code, Pflicht-Verifizierungscode beim Enrollment, TOTP-Code als zweiter Faktor beim Passwort-Login, Deaktivierung möglich.
- **JWT-Session** in einem `HttpOnly`-Cookie (kein Zugriff per JavaScript), `Secure` + `SameSite=Lax` in Produktion.
- **Rate-Limiting** über Redis (global 30 Anfragen/Minute, Login zusätzlich auf 5 Versuche/Minute begrenzt).
- **Security-Header** via Helmet, striktes CORS auf die konfigurierte Origin.

## 💸 Transaktionen (variable Buchungen)

- **Schnellerfassung ("Quick Add"):** Betrag, Beschreibung, Kategorie, Datum, Ausgabe/Einnahme-Umschalter.
- **Spracheingabe ("Tippen-zum-Sprechen"):** Mikrofon-Button füllt Betrag/Beschreibung/Kategorie automatisch aus einer gesprochenen Eingabe (Web Speech API, Deutsch), ohne Auto-Submit — der Nutzer prüft vor dem Speichern.
- **Intelligente Kategorisierung:** lernt sich merkende Zuordnungsregeln pro Beschreibungstext; beim nächsten Mal wird die Kategorie automatisch vorgeschlagen.
- **Transaktionsliste** (`/transactions`) mit Datum, Beschreibung, Kategorie, Betrag.
- **Bearbeiten & Löschen** einzelner Buchungen.
- **Flags pro Buchung** (unabhängige Marker, nicht nur ein einzelnes Label):
  - 🚩 **Vermeidbar** — diese Buchung hätte vermieden werden können.
  - 📉 **Ineffizient** — schlechtes Geschäft (z. B. schlechte Bankgebühren).
  - 📈 **Zu hoch** — Betrag ist überteuert/zu hoch.
- **Offline-Fähigkeit:** Neue Buchungen werden bei fehlender Verbindung lokal in IndexedDB zwischengespeichert und automatisch synchronisiert, sobald die App wieder online ist (Background Sync).

## 🔁 Fixkosten & wiederkehrende Buchungen

- **Verwaltung** (Anlegen, Bearbeiten, Pausieren/Fortsetzen, Löschen) unter *Einstellungen*.
- **Echtes Fälligkeitsdatum** (`nextDueDate`) statt reinem Tag-im-Monat — erlaubt korrekte Anker-Monate für jährliche/quartalsweise Zahlungen (z. B. Kfz-Steuer im Oktober, GEZ vierteljährlich).
- **Frei wählbarer Rhythmus:** monatlich, alle 2 Monate, vierteljährlich, halbjährlich, jährlich (`intervalMonths`).
- **Automatisches Buchen:** täglicher Cron-Job bucht fällige Fixkosten automatisch als Transaktion und schiebt die nächste Fälligkeit weiter (inkl. Nachholen verpasster Buchungen und Monatsende-Clamping, z. B. 31. Jan. + 1 Monat → 28./29. Feb.).
- **Gleiche Flags** wie bei Transaktionen: Vermeidbar, Ineffizient, Zu hoch — direkt auf der Regel.
- **Dashboard-Kennzahl:** Summe aller aktiven Fixkosten-Ausgaben, die im nächsten Abrechnungszeitraum fällig werden (siehe unten — richtet sich nach dem konfigurierbaren Monatsstart, nicht zwingend nach dem Kalendermonat).

## 🗂️ Kategorien

- **Vollständige Verwaltung** (Anlegen, Auflisten, Löschen) unter *Einstellungen*.
- Schutz vor Lösch-Fehlern: Kategorien, die noch von Transaktionen/Budgets verwendet werden, können nicht gelöscht werden (verständliche Fehlermeldung statt Absturz).

## 📊 Budgets & Dashboard

- **Konfigurierbarer Abrechnungszeitraum:** der "Finanzmonat" muss nicht am 1. beginnen — ein frei wählbarer Starttag (1–31, z. B. der Gehaltseingangstag) unter *Einstellungen* bestimmt den Zeitraum, den Dashboard, Budgets und die Fixkosten-Summe verwenden (Standard: 1 = klassischer Kalendermonat, unverändertes Verhalten). Änderbar jederzeit, mit Live-Vorschau des sich ergebenden Zeitraums.
- **Budgets pro Kategorie und Zeitraum:** Anlegen, Bearbeiten, Löschen — Zeitraum-Auswahl per Dropdown (statt eines reinen Kalendermonat-Pickers), zeigt die konkreten Start-/Enddaten.
- **Budget-Fortschrittsbalken** je Kategorie (Ist-Ausgaben vs. Budget).
- **Dashboard-Kennzahlen:** Einnahmen, Ausgaben und Netto des laufenden Zeitraums.
- **Restbudget-Prognose:** lineare Hochrechnung des Restbudgets auf Basis der bisherigen Ausgaben im laufenden Zeitraum.
- **Zeitverlaufs-Chart** (Chart.js) für Einnahmen/Ausgaben über den Zeitraum (auch wenn er zwei Kalendermonate überspannt), hell-/dunkelmodus-fähig.
- Währungswerte werden intern durchgängig als Cent-Integer geführt (keine Rundungsfehler).
- **Startsaldo & Saldo-Abgleich:** unter *Einstellungen* ein Startsaldo hinterlegbar (Kontostand vor der ersten erfassten Buchung); der berechnete Gesamtsaldo (Startsaldo + Summe aller Buchungen) wird dort angezeigt. "Saldo abgleichen": tatsächlichen Kontostand aus dem Online-Banking eintragen — bei einer Differenz wird automatisch eine Ausgleichsbuchung angelegt (Kategorie "Kontoabgleich"), bei Übereinstimmung passiert nichts.

## 🧾 Rechnungen / Belege

- **Beleg-Upload** (PDF, JPEG, PNG, HEIC, max. 10 MB) direkt aus der App.
- **Ansicht/Download** hochgeladener Belege, Dateigröße und Upload-Datum in der Liste.
- **Automatische Löschung** nach 30 Tagen (täglicher Cron-Job), außer eine Datei ist als „Wichtig“ markiert (Stern-Toggle) — inklusive verbleibender Tage bis zur Löschung als Hinweis.

## 📱 PWA & Offline-Verhalten

- **Installierbar** auf dem Homescreen (Web-App-Manifest, Standalone-Modus, App-Icons inkl. maskable Icon).
- **App-Shell-Caching** über einen Service Worker (Workbox) — die App lädt auch offline.
- **SPA-Offline-Fallback:** ein Reload auf einer Unterseite (z. B. `/budgets`) funktioniert auch offline dank gecachtem `index.html`.
- **Lokaler Datencache (IndexedDB):** Kategorien, Transaktionen und Budgets werden gecacht und bei fehlender Verbindung aus dem Cache angezeigt.
- **Offline-Warteschlange + Background Sync** für neu angelegte Transaktionen (siehe oben).
- **Dark Mode:** manuell umschaltbar, respektiert System-Einstellung als Startwert, Wahl wird lokal gespeichert.
- **Safe-Area-Unterstützung** (Notch/Statusleiste) für die installierte App auf Mobilgeräten.

## 🖥️ Navigation & UI

- Kompaktes Dropdown-Menü (statt Zeilennavigation) für mobile Bildschirme, schließt automatisch bei Routenwechsel, Klick außerhalb oder Escape.
- Anzeige der Anzahl noch nicht synchronisierter Offline-Buchungen im Header.
- Konsistentes, responsives Layout (Tailwind CSS) über alle Seiten.

## ⚙️ Backend-Infrastruktur

- **NestJS-API** mit PostgreSQL (Prisma ORM) und Redis (Caching/Rate-Limiting).
- **Docker-Compose-Setup** für lokale Entwicklung und Produktion (identischer Stack).
- Saubere Migrationshistorie (additive, rückwärtskompatible Schema-Änderungen).

---

## Noch nicht umgesetzt (siehe `claude/roadmap.md`)

- CSV-/JSON-Export aller Daten, DSGVO-konforme Account-Löschung.
- Dedizierte Frontend-Unit-Tests (Vitest/Jest) für Finanzberechnungen.
- Fehler-Monitoring (z. B. Sentry).
- Weitere Deployment-/Konfigurationsbereinigung für den produktiven Single-VM-Betrieb.
