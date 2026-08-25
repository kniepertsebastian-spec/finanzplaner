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
- **OCR-Belegscan:** "Beleg scannen"-Button in Quick Add öffnet die native Auswahl (Kamera *oder* ein bereits vorhandenes Bild aus der Fotomediathek/anderen Apps), erkennt den Text auf dem Foto vollständig im Browser (Tesseract.js, deutsches Sprachmodell, kein Upload an das eigene Backend für diesen Schritt) und befüllt Betrag, Datum und (aus der obersten Textzeile) den Händlernamen als Beschreibung automatisch vor — inkl. Kategorie-Vorschlag über dieselbe Zuordnungslogik wie bei der Spracheingabe. Genau wie bei der Spracheingabe kein Auto-Submit, der Nutzer prüft/korrigiert vor dem Speichern. Benötigt eine Online-Verbindung des Geräts beim ersten Scan (Tesseract lädt Kernmodule/Sprachdaten von einem CDN nach).
- **Fremdwährungs-Umrechner:** in Quick Add unter dem Betragsfeld einblendbar — Währung wählen, Betrag in der Fremdwährung sowie einen manuell eingegebenen Wechselkurs eintragen (keine Live-Kurs-Anbindung, bewusst ohne externe API), Ergebnis in Euro wird direkt ins Betragsfeld übernommen. Der zuletzt verwendete Kurs pro Währung wird lokal im Browser gemerkt.
- **Intelligente Kategorisierung:** lernt sich merkende Zuordnungsregeln pro Beschreibungstext; beim nächsten Mal wird die Kategorie automatisch vorgeschlagen.
- **Transaktionsliste** (`/transactions`) mit Datum, Beschreibung, Kategorie, Betrag — gruppiert nach Datumsblöcken ("Heute", "Gestern", danach das volle Datum je Tag) statt einer flachen Liste.
- **Bearbeiten & Löschen** einzelner Buchungen.
- **Flags pro Buchung** (unabhängige Marker, nicht nur ein einzelnes Label):
  - 🚩 **Vermeidbar** — diese Buchung hätte vermieden werden können.
  - 📉 **Ineffizient** — schlechtes Geschäft (z. B. schlechte Bankgebühren).
  - 📈 **Zu hoch** — Betrag ist überteuert/zu hoch.
- **Einsparpotenzial-Auswertung:** Dashboard-Karte, die die drei Flags aggregiert — je Flag getrennt die Summe der markierten Buchungen im laufenden Zeitraum und der monatliche Durchschnittsbetrag markierter aktiver Fixkosten (Jahres-/Quartalsregeln auf Monatsbasis umgerechnet, damit eine jährliche Kfz-Steuer nicht 12× so dringend wirkt wie eine monatliche Regel). Nur sichtbar, wenn tatsächlich etwas markiert ist.
- **Offline-Fähigkeit:** Neue Buchungen werden bei fehlender Verbindung lokal in IndexedDB zwischengespeichert und automatisch synchronisiert, sobald die App wieder online ist (Background Sync).
- **Split-Transaktionen:** eine einzelne Buchung (z. B. ein Supermarkt-Einkauf) auf mehrere Kategorien aufteilen — unter *Transaktionen* per "Buchung aufteilen" mit beliebig vielen Betrag/Kategorie-Zeilen (mindestens 2) plus laufender Summenanzeige. Alle entstehenden Buchungen teilen sich Beschreibung und Datum, bleiben danach aber unabhängig voneinander bearbeitbar; ein kleines Symbol markiert Zeilen aus einer Aufteilung in der Liste (Tooltip zeigt die übrigen Teile).
- **Batch-Bearbeitung:** Checkboxen je Buchung (plus "Alle auswählen" in der Kopfzeile) blenden bei mindestens einer Auswahl eine Toolbar ein — Kategorie für alle Ausgewählten auf einmal ändern, alle als vermeidbar/ineffizient/zu hoch markieren, oder alle löschen (mit Sicherheitsabfrage). Serverseitig strikt auf den eigenen Nutzer beschränkt (`deleteMany`/`updateMany` immer zusätzlich nach `userId` gefiltert).

## 🔁 Fixkosten & wiederkehrende Buchungen

- **Verwaltung** (Anlegen, Bearbeiten, Pausieren/Fortsetzen, Löschen) unter *Einstellungen*.
- **Echtes Fälligkeitsdatum** (`nextDueDate`) statt reinem Tag-im-Monat — erlaubt korrekte Anker-Monate für jährliche/quartalsweise Zahlungen (z. B. Kfz-Steuer im Oktober, GEZ vierteljährlich).
- **Frei wählbarer Rhythmus:** monatlich, alle 2 Monate, vierteljährlich, halbjährlich, jährlich (`intervalMonths`).
- **Automatisches Buchen, vorgezogen auf Zeitraum-Beginn:** täglicher Cron-Job bucht eine Fixkosten-Regel automatisch als Transaktion, sobald ihre Fälligkeit irgendwo im *aktuellen* Abrechnungszeitraum des Nutzers liegt — nicht erst am exakten Kalendertag. So sind zu Beginn eines jeden Zyklus (z. B. am 23. bei `monthStartDay = 23`) direkt alle für diesen Zyklus erwarteten Fixkosten als Buchungen vorhanden, statt tröpfchenweise über den Monat verteilt zu erscheinen. Ändert sich eine Buchung nachträglich (Betrag falsch, Rechnung entfällt), kann sie wie jede andere Transaktion manuell bearbeitet oder gelöscht werden. Schiebt die nächste Fälligkeit wie gehabt weiter (inkl. Nachholen verpasster Buchungen und Monatsende-Clamping, z. B. 31. Jan. + 1 Monat → 28./29. Feb.).
- **Gleiche Flags** wie bei Transaktionen: Vermeidbar, Ineffizient, Zu hoch — direkt auf der Regel.
- **Dashboard-Kennzahlen:** Summe aller aktiven Fixkosten-Ausgaben mit Fälligkeit im laufenden Zeitraum sowie separat im kommenden Zeitraum (richtet sich nach dem konfigurierbaren Monatsstart, nicht zwingend nach dem Kalendermonat).
- **Vertragsmetadaten (optional):** Vertragsnummer, Mindestlaufzeit-Ende und benötigte Kündigungsfrist (in Tagen) pro Regel hinterlegbar — für Verträge mit fester Laufzeit (Internet, Versicherungen, Mobilfunk).
- **Kündigungswecker:** Warn-Banner auf dem Dashboard, sobald die Kündigungsfrist einer aktiven Regel mit hinterlegten Vertragsdaten innerhalb der nächsten 30 Tage abläuft (Formel: Mindestlaufzeit-Ende − Kündigungsfrist), inkl. Datum der spätestmöglichen Kündigung und des Verlängerungsdatums bei Nichtstun.
- **Preiserhöhungs-Erkennung:** Sobald der Betrag einer aktiven Fixkosten-Ausgabe manuell erhöht wird (z. B. nach einer Preiserhöhungs-Ankündigung des Anbieters), merkt sich die Regel den vorherigen Betrag automatisch. Lila Warn-Banner auf dem Dashboard ("📈 Preiserhöhungen erkannt") sowie ein Badge direkt in der Fixkosten-Liste unter *Einstellungen* zeigen alt → neu; ein Klick auf das ×-Symbol am Badge bestätigt die Erhöhung und blendet den Hinweis wieder aus.

## 🗂️ Kategorien

- **Vollständige Verwaltung** (Anlegen, Auflisten, Löschen) unter *Einstellungen*.
- Schutz vor Lösch-Fehlern: Kategorien, die noch von Transaktionen/Budgets verwendet werden, können nicht gelöscht werden (verständliche Fehlermeldung statt Absturz).
- **50/30/20-Einordnung (optional):** jede Kategorie kann als Bedarf, Wunsch oder Sparen klassifiziert werden — speist die 50/30/20-Auswertung auf dem Dashboard. Kategorien ohne Einordnung fließen dort nicht mit ein (kein erzwungenes Raten).
- **Icon-Badges:** überall wo eine Kategorie angezeigt wird (Einstellungen, Transaktionen, Budgets, wiederkehrende Buchungen, Budget-Fortschrittsbalken) erscheint sie als pastellfarbene Pille mit passendem Icon statt reinem Text — Icon per Stichwort-Erkennung im Namen (z. B. "Miete" → Haus, "Lebensmittel" → Einkaufswagen, unbekannte Namen → generisches Tag-Icon), Farbe deterministisch aus der Kategorie-ID abgeleitet (bleibt über Reloads stabil, ohne dass dafür ein Farbfeld gespeichert werden muss).

## 📊 Budgets & Dashboard

- **Hero-Card:** Kachel ganz oben auf dem Dashboard mit einem festen (theme-unabhängigen) Mesh-Gradient-Hintergrund aus den bestehenden App-Farben (Einnahme-Blau, Ausgabe-Orange, ein Lila-Akzent). Zeigt den Gesamtsaldo als große Hero-Zahl sowie "Frei verfügbar" und "Tagesbudget" als Unterwerte — ersetzt die bisherigen einzelnen Kacheln für diese beiden Kennzahlen.
- **Konfigurierbarer Abrechnungszeitraum:** der "Finanzmonat" muss nicht am 1. beginnen — ein frei wählbarer Starttag (1–31, z. B. der Gehaltseingangstag) unter *Einstellungen* bestimmt den Zeitraum, den Dashboard, Budgets und die Fixkosten-Summe verwenden (Standard: 1 = klassischer Kalendermonat, unverändertes Verhalten). Änderbar jederzeit, mit Live-Vorschau des sich ergebenden Zeitraums.
- **Budgets pro Kategorie und Zeitraum:** Anlegen, Bearbeiten, Löschen — Zeitraum-Auswahl per Dropdown (statt eines reinen Kalendermonat-Pickers), zeigt die konkreten Start-/Enddaten.
- **Budget-Fortschrittsbalken** je Kategorie (Ist-Ausgaben vs. Budget), inklusive Icon-Badge (siehe Kategorien-Abschnitt).
- **Dashboard-Kennzahlen:** Einnahmen, Ausgaben und Sparquote (Anteil der Einnahmen, der im Zeitraum nicht ausgegeben wurde) des laufenden Zeitraums.
- **50/30/20-Regel-Auswertung:** vergleicht die tatsächlichen Anteile für Notwendiges/Wünsche/Sparen (auf Basis der Kategorie-Einordnung, siehe oben) gegen die klassischen 50/30/20-Zielwerte, je mit Fortschrittsbalken und Status (Im Ziel/Knapp am Ziel/Deutliche Abweichung, farb- und icon-codiert). "Sparen" zählt sowohl explizit als Sparen eingeordnete Ausgaben als auch schlicht nicht ausgegebenes Einkommen. Kategorien ohne Einordnung werden separat ausgewiesen, nicht stillschweigend zugerechnet.
- **Restbudget-Prognose:** lineare Hochrechnung des Restbudgets auf Basis der bisherigen Ausgaben im laufenden Zeitraum.
- **Zeitverlaufs-Chart** (Chart.js) für Einnahmen/Ausgaben über den Zeitraum (auch wenn er zwei Kalendermonate überspannt), hell-/dunkelmodus-fähig — glatte Bézier-Kurven mit transparentem Farbverlauf-Flächenfüll unter jeder Linie.
- **Ausgaben-nach-Kategorie-Donut:** Ringdiagramm der Ausgabenanteile je Kategorie im laufenden Zeitraum (feste kategoriale Farbpalette, mehr als 8 Kategorien fallen in "Sonstige"), Gesamtsumme in der Mitte des Rings.
- Währungswerte werden intern durchgängig als Cent-Integer geführt (keine Rundungsfehler).
- **Startsaldo & Saldo-Abgleich:** unter *Einstellungen* ein Startsaldo hinterlegbar (Kontostand vor der ersten erfassten Buchung); der berechnete Gesamtsaldo (Startsaldo + Summe aller Buchungen) wird dort angezeigt. "Saldo abgleichen": tatsächlichen Kontostand aus dem Online-Banking eintragen — bei einer Differenz wird automatisch eine Ausgleichsbuchung angelegt (Kategorie "Kontoabgleich"), bei Übereinstimmung passiert nichts.
- **Frei verfügbares Einkommen:** Gesamtsaldo abzüglich der im laufenden Zeitraum noch ausstehenden Fixkosten und abzüglich aller in Rücklagen (virtuellen Töpfen) zurückgelegten Beträge, als Unterwert der Hero-Card.
- **Tagesbudget (Tages-Burn-Rate):** frei verfügbares Einkommen geteilt durch die Tage bis zur nächsten geplanten Einnahme (rötlich dargestellt, falls negativ — Warnsignal für drohende Überziehung vor dem nächsten Gehaltseingang), ebenfalls in der Hero-Card.
- **Cashflow-Projektion:** Tagesgenaue Kontostand-Prognose vom heutigen Tag bis zum Ende des aktuellen Abrechnungszeitraums, auf Basis aller aktiven wiederkehrenden Buchungen (Einnahmen und Fixkosten, inkl. mehrfacher Wiederholungen über den Horizont hinweg). Als gestrichelte Liniendiagramm-Prognose (durchgehend gestrichelt, da die gesamte Linie eine Vorhersage ist) mit transparentem Farbverlauf-Flächenfüll oberhalb der Null-Linie; sobald die Prognose unter 0 fällt, wird das betroffene Kurvensegment rot eingefärbt und die Fläche darunter rot hinterlegt, zusätzlich erscheint ein Warn-Banner mit Datum und Höhe der drohenden Unterdeckung. Variable (nicht wiederkehrende) Ausgaben fließen bewusst nicht ein, da sie nicht im Voraus bekannt sind.
- **Virtuelle Töpfe (Rücklagen/Sinking Funds):** Beliebig viele benannte Töpfe (z. B. Notgroschen, Kfz-Steuer, Urlaub) unter *Einstellungen* anlegbar, mit zurückgelegtem Betrag und optionalem Sparziel. Der Gesamtsaldo selbst ändert sich dadurch nicht (kein echter Geldtransfer) — die Töpfe sperren den hinterlegten Betrag lediglich rechnerisch: er wird vom "Frei verfügbar" auf dem Dashboard abgezogen. Auf dem Dashboard erscheint zusätzlich eine "Rücklagen"-Karte mit allen Töpfen und Fortschrittsbalken für Töpfe mit Sparziel.

## 🧾 Rechnungen / Belege

- **Beleg-Upload** (PDF, JPEG, PNG, HEIC, max. 10 MB) direkt aus der App.
- **Ansicht/Download** hochgeladener Belege, Dateigröße und Upload-Datum in der Liste.
- **Automatische Löschung** nach 30 Tagen (täglicher Cron-Job), außer eine Datei ist als „Wichtig“ markiert (Stern-Toggle) — inklusive verbleibender Tage bis zur Löschung als Hinweis.

## 📱 PWA & Offline-Verhalten

- **Installierbar** auf dem Homescreen (Web-App-Manifest, Standalone-Modus, App-Icons inkl. maskable Icon).
- **App Shortcuts:** langes Drücken/Rechtsklick auf das installierte App-Icon bietet direkte Sprünge zu "Neue Buchung", "Transaktionen" und "Budgets", ohne erst über das Dashboard navigieren zu müssen.
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
- **Privacy-Mode (Blickschutz):** Augen-Symbol im Header verwischt alle Cent-Beträge in der App (Hero-Card, Dashboard-Kacheln, Transaktions-/Fixkosten-/Budget-/Rücklagen-Listen, Kontostand-Anzeige) per `filter: blur()`, ohne Layout zu verschieben — praktisch für die Nutzung in der Öffentlichkeit. Zustand wird lokal gespeichert und bleibt über Sitzungen hinweg erhalten. Chart-Tooltips/-Achsenbeschriftungen (Canvas-gerendert) und native Browser-Tooltips (`title`-Attribute) sind aus technischen Gründen ausgenommen.
- **Animierte Beträge:** Euro-Werte zählen beim ersten Anzeigen bzw. bei einer Änderung sanft zum Zielwert hoch/runter statt abrupt zu springen (respektiert `prefers-reduced-motion`).
- **Skeleton-Loader mit Shimmer-Effekt:** Ladezustände zeigen einen durchlaufenden Farbverlauf in der Form des kommenden Inhalts (Hero-Card, Kachel-Raster, Tabellenzeilen) statt eines reinen "Lädt…"-Texts.

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
