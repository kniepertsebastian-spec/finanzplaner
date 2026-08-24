# LOG_DOKUMENTATION

---

### 📋 Schritt-Log: OCR-Belegscan & Fremdwährungs-Umrechner (Phase 11, zweite/dritte Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-25 02:00`

#### 1. Was wurde getan?
*   Nutzer priorisierte explizit OCR-Belegscan und Fremdwährungs-Umrechner vor dem CSV-Import (der noch eine Rückfrage zum tatsächlichen Bank-CSV-Format bräuchte). Beide in dieser Session umgesetzt, Fremdwährungs-Umrechner zuerst (kleinerer, unabhängiger Baustein), danach OCR.
*   **Fremdwährungs-Umrechner** (`frontend/src/lib/currency.ts`, reine Funktionen): `convertForeignToEuroCents()`, eine feste Liste gängiger Währungen (`COMMON_CURRENCIES`), sowie `getRememberedRate()`/`rememberRate()` (Kurs pro Währung im `localStorage` gemerkt, per-Browser, kein Sync). Bewusst **kein** Live-Wechselkurs über eine externe API — der Nutzer trägt den Kurs manuell ein (z. B. von der Kreditkartenabrechnung), passend zum bisherigen "kein Bank-Pull, keine externen Abhängigkeiten"-Prinzip der App. In `QuickAddPage.tsx` unter dem Betragsfeld einblendbar (🌍-Toggle), übernimmt den umgerechneten Betrag direkt ins Haupt-Betragsfeld.
*   **OCR-Belegscan:** neue Abhängigkeit `tesseract.js` (^7.0.0) im Frontend (`npm install`) — Client-seitige Texterkennung, kein neuer Backend-Code/Endpunkt nötig. `frontend/src/lib/ocr.ts`: dünner Wrapper um `Tesseract.recognize(file, 'deu', ...)` mit Fortschritts-Callback. `frontend/src/lib/receiptParse.ts` (reine Funktionen, gleiches Muster wie `voiceParse.ts`): `parseReceiptText()` extrahiert per Regex-Heuristik den Gesamtbetrag (bevorzugt die letzte Zeile mit "Summe/Gesamt/Total/Betrag/Zu zahlen", sonst größter gefundener Betrag im Text), ein Datum (`DD.MM.YYYY`-artige Muster) und den Händlernamen (erste Textzeile mit mindestens 3 Buchstaben).
*   **`QuickAddPage.tsx`:** neuer "📷 Beleg scannen"-Button neben dem bestehenden Mikrofon-Button, öffnet Kamera/Dateiauswahl (`<input type="file" accept="image/*" capture="environment">`), zeigt Scan-Fortschritt in Prozent, befüllt danach Betrag/Datum/Beschreibung (Händlername) sowie — über die bereits vorhandene `matchCategoryId()`-Funktion aus der Spracheingabe — einen Kategorie-Vorschlag. Genau wie bei der Spracheingabe **kein Auto-Submit**, der Nutzer prüft vor dem Speichern.
*   **Verifiziert:** kein Backend-Code betroffen (beide Features sind rein Frontend), daher keine Backend-Tests nötig. Frontend — `npx tsc --noEmit` und `npm run build` (`tsc && vite build`) beide fehlerfrei (weiterhin nur die unkritische Vite-Chunk-Size-Warnung). Kein Lint-Script im Projekt konfiguriert (`npm run lint` existiert nicht) — nichts zusätzlich zu prüfen. `tesseract.js` selbst trägt nur ~17 KB zum Bundle bei (WASM-Core/Sprachdaten werden erst zur Laufzeit vom CDN nachgeladen, nicht mitgebaut) — kein spürbarer Einfluss auf die reguläre App-Ladezeit.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag ("ocr receipt scan and currency converter are more important" — Priorisierung gegenüber CSV-Import).

#### 3. Auswirkungen / Nebenwirkungen
*   **Keine Migration nötig** — beide Features sind rein clientseitig, keine Schema-Änderung.
*   **OCR braucht eine Online-Verbindung des Endgeräts beim ersten Einsatz** (Tesseract lädt WASM-Core + deutsches Sprachmodell von einem CDN nach) — analog zur bereits bestehenden Einschränkung bei der Spracheingabe (Web Speech API braucht in Chrome ebenfalls eine Google-Serververbindung). In der `PWA`-Offline-Caching-Strategie nicht mit einbezogen (kein Precaching der Tesseract-Assets) — bewusst außerhalb des Scopes dieser Teilscheibe gelassen, da die App ohnehin für Offline-*Buchungserfassung* ausgelegt ist, nicht für Offline-Beleg-OCR.
*   **OCR-Ergebnis ist eine Heuristik, keine Garantie** — bei schlecht lesbaren/ungewöhnlich formatierten Belegen können Betrag/Datum/Händler falsch oder gar nicht erkannt werden; der Nutzer sieht das vorbefüllte Formular vor dem Speichern und kann korrigieren (gleiche Sicherheitsnetz-Logik wie bei der Spracheingabe). Bei komplett leerem Ergebnis erscheint ein Hinweistext statt eines stillen Fehlschlags.
*   Bewusst **kein** Zusammenspiel mit dem bestehenden Invoice-Upload (`backend/src/invoices/`, 30-Tage-Aufbewahrung) — das ist ein separates Anliegen (Belegarchivierung) von dem hier umgesetzten Ziel (schnellere manuelle Dateneingabe). Der Nutzer kann einen Beleg weiterhin zusätzlich getrennt unter *Rechnungen* hochladen, falls gewünscht.

#### 4. Status der Aufgabe
*   [x] Code abgeschlossen, committed & gepusht — [ ] Deployment auf den Mini-PC steht aus — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer, insbesondere OCR-Ergebnis mit einem echten Beleg-Foto testen)

---

### 📋 Schritt-Log: Split-Transaktionen (Phase 11, erste Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-25 01:15`

#### 1. Was wurde getan?
*   Nutzer bestätigte, dass Phase 10 vollständig auf dem Mini-PC deployed ist (Nutzer hat den Deploy selbst durchgeführt, während diese Session bereits mit Phase 11 begonnen hat). Erste Teilscheibe von Phase 11 (Smarte Datenerfassung & Import) gewählt: Split-Transaktionen — bewusst vor CSV-Import/OCR, da beide anderen Punkte entweder ein bankspezifisches CSV-Format (unbekannt, müsste vom Nutzer erfragt werden) oder eine OCR-Engine als neue Abhängigkeit brauchen; Split-Transaktionen sind dagegen vollständig aus der Roadmap-Beschreibung heraus umsetzbar, ohne Rückfragen oder neue npm-Pakete.
*   **Design-Entscheidung:** Ein Split wird **nicht** als eigenes Kindmodell (z. B. `TransactionSplit` mit Elternbezug) umgesetzt, sondern als mehrere gewöhnliche `Transaction`-Zeilen, die sich eine neue, gemeinsame `splitGroupId` (String?, nullable) teilen. Dadurch funktionieren alle bestehenden Berechnungen (`spentForCategory`, `monthlyTotals`, Budget-Auswertung, Saldo) unverändert weiter, ohne Sonderfall-Logik für Splits — jede Split-Zeile ist danach eine vollständig eigenständige, editier- und löschbare Transaktion wie jede andere auch.
*   **`Transaction`** um `splitGroupId String?` erweitert (+ Index). Migration `20260825010000_add_split_group_id` von Hand geschrieben (weiterhin kein Docker/Postgres in dieser Session verfügbar).
*   **Backend:** neue DTOs `CreateTransactionSplitDto`/`TransactionSplitItemDto` (verschachtelte Validierung via `class-transformer`s `@Type()` + `@ValidateNested`, `ArrayMinSize(2)`). `TransactionsService.createSplit()`: validiert, dass alle Split-Beträge ungleich 0 sind und dasselbe Vorzeichen haben (nur Ausgabe *oder* nur Einnahme, kein Mischen), prüft Kategorie-Eigentümerschaft je Zeile, erzeugt dann alle Zeilen atomar über `prisma.$transaction([...])` mit einer neu generierten `splitGroupId` (`randomUUID()`). Neuer Endpunkt `POST /transactions/split`.
*   **Frontend:** `transactionsApi.createSplit()`, `Transaction.splitGroupId`-Typ. Neuer Formularbereich auf `/transactions` ("Buchung aufteilen", umschaltbar per Button neben der Seitenüberschrift) mit Ausgabe/Einnahme-Umschalter (gilt für alle Zeilen), Beschreibung, optionalem Datum und beliebig vielen Betrag/Kategorie-Zeilen (mind. 2, per "Weitere Kategorie" erweiterbar, ab der dritten Zeile einzeln entfernbar) inkl. laufender Summenanzeige. In der Transaktionsliste markiert ein kleines Split-Icon neben der Beschreibung Zeilen mit `splitGroupId`, Tooltip listet die übrigen Teile (Kategorie + Betrag), rein clientseitig aus der bereits geladenen Liste gruppiert — kein zusätzlicher API-Call.
*   **Verifiziert:** Backend — `npm run build` fehlerfrei, `npm test` → 16 Suites / 52 Tests grün (4 neue Tests für `createSplit()`: Erfolgsfall inkl. gemeinsamer `splitGroupId`, gemischte Vorzeichen abgelehnt, Nullbetrag abgelehnt, fremde Kategorie abgelehnt). Frontend — `npx tsc --noEmit` und `npm run build` (`tsc && vite build`) beide fehlerfrei (nur eine unkritische Chunk-Size-Warnung von Vite, kein Fehler). Weiterhin kein Docker in dieser Session, Verifikation komplett über lokal installierte `node_modules`.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag ("currently building but you can start"), erster Punkt aus Roadmap-Phase 11.

#### 3. Auswirkungen / Nebenwirkungen
*   **Migration nötig** — eine neue, nullable/additive Spalte + Index auf `Transaction`. Keine bestehenden Daten betroffen.
*   Keine Sonderbehandlung an anderer Stelle nötig (siehe Design-Entscheidung oben) — Dashboard, Budgets, Kategorisierung etc. sehen Split-Zeilen einfach als normale Transaktionen.
*   **Nicht deployed** — kein Docker-Daemon, kein SSH-Zugriff in dieser Session. Deployment (Backend-Rebuild + `prisma migrate deploy`) steht aus.

#### 4. Status der Aufgabe
*   [x] Code abgeschlossen, committed & gepusht — [ ] Deployment auf den Mini-PC steht aus — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer nach Deployment)

---

### 📋 Schritt-Log: Preiserhöhungs-Erkennung (Phase 10, dritte/letzte Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-25 00:05`

#### 1. Was wurde getan?
*   Fortsetzung von Phase 10, nachdem der Nutzer den Mini-PC-Deploy der ersten beiden Teilscheiben (virtuelle Töpfe, Vertragsmetadaten) erfolgreich selbst durchgeführt hat (Docker-Gruppenmitgliedschaft repariert, root-`.env` aus den laufenden Containern wiederhergestellt, `git pull` + Backend-/Frontend-Rebuild + `prisma migrate deploy` für beide ausstehenden Migrationen). Da diese Session weiterhin keinen Docker-/SSH-Zugriff auf den Mini-PC hat, wurde auf Nutzerwunsch der Branch dieser Session per Fast-Forward direkt auf `main` gepusht, damit der Nutzer ohne Branch-Wechsel weiter `git pull` auf `main` nutzen kann (Abweichung vom reinen Feature-Branch-Workflow dieser Session, mit Nutzer abgestimmt).
*   **`RecurringTransaction`** um `previousAmount` (Int?, nullable) erweitert — Snapshot des `amount`-Werts unmittelbar vor der letzten Änderung. Migration `20260825000000_add_previous_amount` von Hand geschrieben (weiterhin kein Docker/Postgres in dieser Session verfügbar).
*   **`RecurringTransactionsService.update()`:** liest jetzt die bestehende Entity (statt sie nur für den Ownership-Check zu verwerfen) und setzt `previousAmount` auf den alten `amount`-Wert, sobald sich `amount` im Update tatsächlich ändert (Vergleich `dto.amount !== existing.amount`). Keine Änderung an `amount` (z. B. reines Pausieren/Umbenennen) lässt `previousAmount` unangetastet.
*   **Neuer Endpunkt `POST /recurring-transactions/:id/dismiss-price-increase`** (`dismissPriceIncrease()`) — setzt `previousAmount` gezielt auf `null` zurück, um den Hinweis zu bestätigen/auszublenden. Bewusst als eigener Endpunkt statt über den generischen `PATCH`-Update-Pfad gelöst, um nicht erneut in das bereits bekannte "leeres Feld = unverändert, nicht löschen"-Problem zu laufen (siehe vorherige Teilscheibe zu Vertragsdaten).
*   **`budgetCalc.ts`:** neue Funktion `priceIncreaseRules(recurring)` — findet aktive Ausgaben-Regeln (`amount < 0`), bei denen der Betrag dem Betrag nach höher ist als der gespeicherte `previousAmount`. Einnahme-Regeln bewusst ausgeschlossen (steigendes Einkommen ist keine Warnung).
*   **`DashboardPage.tsx`:** neuer lila Warn-Banner "📈 Preiserhöhungen erkannt" (unterhalb des Kündigungswecker-Banners), listet betroffene Regeln mit altem → neuem Betrag.
*   **`RecurringTransactionsPanel.tsx`:** Badge "erhöht" direkt in der Betrag-Spalte der Fixkosten-Tabelle bei betroffenen Zeilen (Tooltip mit altem → neuem Betrag), mit ×-Button zum Bestätigen/Ausblenden (ruft den neuen Dismiss-Endpunkt auf).
*   **Verifiziert:** Backend — `npm run build` fehlerfrei, `npm test` → 16 Suites / 48 Tests grün (3 bestehende `update()`-Tests an das neue `previousAmount: undefined`-Feld angepasst, 2 neue Tests für die Preiserhöhungs-Snapshot-Logik, 1 neuer Test für `dismissPriceIncrease()`). Frontend — `npx tsc --noEmit` und `npm run build` (`tsc && vite build`) beide fehlerfrei. Weiterhin kein Docker in dieser Session, Verifikation komplett über lokal installierte `node_modules`.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag ("continue"), letzter offener Punkt aus Roadmap-Phase 10. Damit ist Phase 10 (Virtuelle Töpfe, Vertragsmetadaten/Kündigungswecker, Preiserhöhungs-Erkennung) code-seitig vollständig abgeschlossen.

#### 3. Auswirkungen / Nebenwirkungen
*   **Migration nötig** — eine neue, nullable/additive Spalte auf `RecurringTransaction`. Keine bestehenden Daten betroffen.
*   **Bewusste Design-Entscheidung:** Preiserhöhungen werden nur bei *manuellen* Betragsänderungen durch den Nutzer erkannt, nicht automatisch aus Banking-Daten abgeleitet (die App hat keinen Bank-Zugriff, siehe Projektname "ohne Bank-Pull"). Der Nutzer muss den neuen Betrag also selbst in die Regel eintragen, damit die Erkennung greift — das ist der erwartete Workflow (Fixkosten-Regel wird ohnehin bei einer echten Preiserhöhung angepasst).
*   **Nicht deployed** — kein Docker-Daemon, kein SSH-Zugriff in dieser Session. Deployment (Backend-Rebuild + `prisma migrate deploy` für die neue Migration) steht aus.

#### 4. Status der Aufgabe
*   [x] Code abgeschlossen, committed — [ ] Push auf `main`/Branch noch zu bestätigen (siehe Git-Log) — [ ] Deployment auf den Mini-PC steht aus — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer nach Deployment)

---

### 📋 Schritt-Log: Vertragsmetadaten & Kündigungswecker (Phase 10, zweite Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-24 23:10`

#### 1. Was wurde getan?
*   Fortsetzung von Phase 10, während der Nutzer parallel den ausstehenden Mini-PC-Deploy vorbereitet hat (Docker-Berechtigungen/`.env`-Wiederherstellung, vom Nutzer selbst durchgeführt — dieser Session fehlt weiterhin sowohl Docker-Daemon- als auch SSH-Zugriff auf den Mini-PC).
*   **`RecurringTransaction`** (`schema.prisma`) um drei optionale Felder erweitert: `contractNumber` (String?), `contractEndDate` (DateTime?, Mindestlaufzeit-Ende), `cancellationPeriodDays` (Int?, Kündigungsfrist in Tagen). Migration `20260824230000_add_contract_metadata` von Hand geschrieben (weiterhin kein Docker/Postgres in dieser Session verfügbar).
*   **Backend:** `CreateRecurringTransactionDto` um die drei Felder ergänzt (alle optional, `contractEndDate` als `@IsDateString()`). `RecurringTransactionsService.create()`/`update()` konvertieren `contractEndDate` konsistent zu `nextDueDate` von String zu `Date`. Bestehende `update()`-Tests angepasst (zusätzliches `contractEndDate: undefined` im exakten `toHaveBeenCalledWith`-Objekt), neue Tests für `create()`- und `update()`-Pfade mit Vertragsdaten ergänzt.
*   **`budgetCalc.ts`:** neue Funktion `contractsNeedingCancellationNotice(recurring, windowDays = 30, referenceDate)` — findet aktive Regeln mit gesetztem `contractEndDate` **und** `cancellationPeriodDays`, deren Kündigungs-Deadline (`contractEndDate - cancellationPeriodDays`) innerhalb der nächsten `windowDays` liegt (oder bereits verstrichen ist — bewusst nicht herausgefiltert, der Nutzer soll das gerade dann sehen). Gleiche UTC-Datumslogik wie die übrigen Funktionen in der Datei.
*   **`DashboardPage.tsx`:** neuer gelber Warn-Banner "⏰ Kündigungsfrist läuft bald ab" ganz oben auf dem Dashboard (vor den Stat-Kacheln), nur sichtbar wenn mindestens eine Regel betroffen ist. Listet Beschreibung, optionale Vertragsnummer, Kündigungs-Deadline und Verlängerungsdatum.
*   **`RecurringTransactionsPanel.tsx`:** neuer optionaler Formularabschnitt "Vertragsdaten" (Vertragsnummer, Mindestlaufzeit-Ende, Kündigungsfrist in Tagen) unterhalb der bestehenden Felder, mit eigenem Trennstrich und erklärendem Hinweistext.
*   **Verifiziert:** Backend — `npm run build` fehlerfrei, `npm test` → 16 Suites / 45 Tests grün. Frontend — `npx tsc --noEmit` und `npm run build` (`tsc && vite build`) beide fehlerfrei. Weiterhin kein Docker in dieser Session, Verifikation komplett über lokal installierte `node_modules`.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag ("go ahead and continue with the next step"), nachdem der Mini-PC-Deploy-Support (Docker-Berechtigungen, `.env`-Wiederherstellung) an den Nutzer selbst delegiert wurde, da diese Session weder Docker- noch SSH-Zugriff auf den Mini-PC hat. Nächster ausführbarer Schritt aus der Roadmap: Phase 10, zweiter Punkt (Vertrags-Metadaten + Kündigungswecker; Preiserhöhungs-Erkennung bewusst als eigene, spätere Teilscheibe zurückgestellt — deutlich größerer Scope, braucht einen Vergleich historischer Beträge über Zyklen hinweg).

#### 3. Auswirkungen / Nebenwirkungen
*   **Migration nötig** — drei neue, alle nullable/additive Spalten auf `RecurringTransaction`. Keine bestehenden Daten betroffen.
*   **Bekannte Einschränkung, bewusst nicht behoben:** Einmal gesetzte `contractEndDate`/`cancellationPeriodDays` können über das UI aktuell nicht wieder auf "leer" zurückgesetzt werden (leeres Feld im Formular wird beim Speichern als `undefined` = "unverändert lassen" gesendet, nicht als "löschen"). Falls ein Vertrag storniert wurde, hilft ersatzweise das Pausieren der Regel (`active: false`) — dann verschwindet die Regel auch aus `contractsNeedingCancellationNotice()`. Eine echte Clear-Funktion wäre zusätzlicher Scope (nullable-Update-Semantik im DTO + UI-Button) und wurde für diese Teilscheibe zurückgestellt.
*   **Nicht deployed** — wie die letzten beiden Teilscheiben: kein Docker-Daemon, kein SSH-Zugriff in dieser Session. Deployment (inkl. Backend-Rebuild + `prisma migrate deploy` für **zwei** ausstehende Migrationen: `add_savings_pots` und `add_contract_metadata`) steht komplett aus.

#### 4. Status der Aufgabe
*   [x] Code abgeschlossen, committed & gepusht — [ ] Deployment auf den Mini-PC (inkl. Backend-Rebuild + beide ausstehenden Migrationen) steht aus — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer nach Deployment)

---

### 📋 Schritt-Log: Virtuelle Töpfe / Rücklagen (Phase 10, erste Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-24 22:20`

#### 1. Was wurde getan?
*   Nutzer bat um Fortsetzung mit Phase 10 (Virtuelle Töpfe & Vertragsmanagement), während parallel der ausstehende Mini-PC-Deploy der Cashflow-Projektion (Phase 9, letzte Teilscheibe) vom Nutzer selbst nachgeholt wurde.
*   **Neues Prisma-Modell `SavingsPot`** (`backend/prisma/schema.prisma`): `name`, `amountCents` (aktuell zurückgelegter Betrag, Default 0), `targetCents` (optionales Sparziel, nullable), `userId`-Relation mit `onDelete: Cascade`, Index auf `userId` — gleiches Muster wie `RecurringTransaction`/`Invoice`. Migration `20260824220000_add_savings_pots` von Hand geschrieben (nach dem Muster der `add_invoices`-Migration; kein lokaler Postgres/Docker-Daemon in dieser Session verfügbar, um `prisma migrate dev` live laufen zu lassen — Backend-Tests/Typecheck liefen stattdessen gegen ein lokal per `npm install` erzeugtes `node_modules`, nicht per Docker-Build).
*   **Neues Backend-Modul `savings-pots`** (`backend/src/savings-pots/`): Standard-CRUD (`create`/`findAll`/`findOne`/`update`/`remove`) nach exakt demselben Muster wie `budgets`/`recurring-transactions` (Ownership-Check per `findFirst({ id, userId })`, `NotFoundException` bei Fremdzugriff). Keine Kategorie-Kopplung nötig (Töpfe sind kategorielos). In `app.module.ts` registriert. Service- und Controller-Spec-Tests ergänzt (mirrored an `budgets`/`recurring-transactions`-Tests).
*   **Frontend:** `lib/api/savingsPots.ts` (CRUD-Client, Muster wie `recurringTransactions.ts`), `SavingsPot`-Typ in `lib/api/types.ts`. Neue Komponente `components/settings/SavingsPotsPanel.tsx` (Anlegen/Bearbeiten/Löschen, Formular mit Name/Betrag/optionalem Sparziel) unter *Einstellungen* eingehängt.
*   **`budgetCalc.ts`:** `availableIncome()` um einen dritten, jetzt verpflichtenden Parameter `lockedInPotsCents` erweitert (vorher: `balanceCents - outstandingFixedCostsCents`; jetzt zusätzlich `- lockedInPotsCents`) — der seit der letzten Teilscheibe im Kommentar dokumentierte Platzhalter "Rücklagen existieren erst ab Phase 10" ist damit eingelöst. Einziger Aufrufer (`DashboardPage.tsx`) entsprechend angepasst (Summe aller `amountCents` aus den geladenen Töpfen).
*   **`DashboardPage.tsx`:** lädt zusätzlich `savingsPotsApi.list()`. Neue Karte "Rücklagen" (nur sichtbar, wenn mindestens ein Topf existiert) zwischen der Fixkosten-Kachel und dem Einnahmen/Ausgaben-Chart, mit Fortschrittsbalken für Töpfe mit gesetztem Sparziel. Caption der "Frei verfügbar"-Kachel erwähnt jetzt den abgezogenen Rücklagen-Betrag, sofern > 0.
*   **Verifiziert:** Backend — `npm run build` (Nest-Build) fehlerfrei, `npm test` → 16 Suites / 42 Tests grün (inkl. der 8 neuen Savings-Pots-Tests). Frontend — `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei. Kein Docker verfügbar in dieser Session (weder Daemon noch laufender Dev-Stack) — Verifikation lief komplett über lokal installierte `node_modules`, nicht über den sonst üblichen `docker build`-Weg.
*   Committed und nach `origin/main`/den Arbeits-Branch gepusht (siehe Git-Log für Commit-Hashes).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: mit Phase 10 der Roadmap beginnen. Virtuelle Töpfe sind der erste, in sich abgeschlossene Punkt dieser Phase (Vertrags-Metadaten/Kündigungswecker/Preiserhöhungs-Erkennung sind unabhängige Folge-Teilscheiben).

#### 3. Auswirkungen / Nebenwirkungen
*   **Migration nötig** (anders als die letzten drei Phase-9-Teilscheiben) — neue Tabelle `SavingsPot`. Rein additiv, keine bestehenden Spalten/Tabellen verändert.
*   Der tatsächliche Gesamtsaldo (`User.startingBalance` + Transaktionssumme) bleibt von Töpfen unberührt — es wird kein Geld real verschoben, Töpfe sind eine rein rechnerische Sperre für die "Frei verfügbar"-Kennzahl. Absichtlich so gewählt, konsistent mit der Roadmap-Formel ($\text{Verfügbar} = \text{Gesamtsaldo} - \text{Fixkosten} - \text{Rücklagen}$).
*   **Nicht deployed:** Wie in der vorherigen Teilscheibe kein Docker-Daemon in dieser Session verfügbar (`docker build` schlägt fehl: kein `/var/run/docker.sock`) — dieses Mal zusätzlich auch kein SSH zum Mini-PC (weiterhin kein `ssh`-Binary vorhanden). Deployment inkl. `npx prisma migrate deploy` (Migration!) steht aus.

#### 4. Status der Aufgabe
*   [x] Code abgeschlossen, committed & gepusht — [ ] Deployment auf den Mini-PC (inkl. Backend-Rebuild + Migration) steht aus — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer nach Deployment)

---

### 📋 Schritt-Log: Cashflow-Projektion (Phase 9, vierte/letzte Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-24 19:20`

#### 1. Was wurde getan?
*   Nutzer wählte als nächsten Schritt die letzte offene Aufgabe aus Phase 9: die Cashflow-Projektion (tagesgenauer Liquiditätsverlauf mit optischer Warnung bei drohender Unterdeckung).
*   **`budgetCalc.ts`:** `cashflowProjection(startBalanceCents, recurring, horizonDays, referenceDate)` — projiziert den laufenden Kontostand Tag für Tag, indem jede aktive wiederkehrende Regel (Einnahmen *und* Fixkosten) an ihren Fälligkeitstagen angewendet wird. Wiederholungen über den Horizont hinweg werden über `intervalMonths` (ab `nextDueDate`) durchgerechnet, per neuem lokalem Helfer `addMonthsClamped()` (gleiche Monatsende-Clamping-Logik wie `financialPeriod.ts`, damit z. B. eine am 31. fällige Regel nicht in kürzere Monate hineindriftet). `firstShortfall()` findet den ersten Tag, an dem der Saldo unter 0 fällt (oder `null`).
*   Bewusst **nur** wiederkehrende Buchungen einbezogen, keine variablen Ausgaben (gleicher Scope wie `availableIncome()`/`dailyBurnRate()` aus der vorherigen Teilscheibe) — variable Tagesausgaben sind nicht im Voraus bekannt, eine Schätzung darüber wäre reine Spekulation.
*   **Horizont:** heute bis zum Ende des *nächsten* Finanzzeitraums (`getNextFinancialPeriod(...).end`, bereits vorhanden), nicht fest verdrahtet auf z. B. 30/60 Tage — passt sich automatisch an `monthStartDay` an und deckt zuverlässig mindestens einen vollen Gehaltszyklus ab, auch wenn spät im aktuellen Zyklus geprüft wird.
*   **Neue Komponente `frontend/src/components/charts/CashflowChart.tsx`:** Line-Chart nach dem Muster von `IncomeExpenseChart.tsx` (Chart.js/react-chartjs-2, keine neue Abhängigkeit). Unterschreitet die Linie 0, wird das jeweilige Segment per Chart.js' eingebautem `segment.borderColor`-Callback rot eingefärbt, zusätzlich rote Füllung unterhalb der Null-Linie via `fill.target = { value: 0 }` — beides native Chart.js-Features, kein Plugin nötig.
*   **`DashboardPage.tsx`:** Neue Karte "Liquiditätsverlauf" unterhalb des bestehenden Einnahmen/Ausgaben-Charts. Zeigt bei drohender Unterdeckung zusätzlich einen roten Warn-Banner mit Datum und prognostiziertem Minus-Betrag.
*   **Verifiziert:** `docker build ./frontend` (führt `tsc && vite build` aus) — ein Typfehler gefunden und behoben (`ScriptableLineSegmentContext`-Callback: `ctx.p0.parsed.y`/`ctx.p1.parsed.y` sind `number | null`, `?? 0`-Fallback ergänzt), danach fehlerfrei durchgebaut. Kein Docker-Dev-Stack berührt. Kein dedizierter Unit-Test (Frontend hat weiterhin keinen Testrunner, Phase 7 weiterhin offen) — wie bei den bisherigen `budgetCalc.ts`-Ergänzungen nur per Typecheck + Code-Review verifiziert.
*   Committed (`53b073a`) und nach `origin/main` gepusht.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: letzte offene Aufgabe aus Roadmap-Phase 9 (nach Rückfrage, ob Phase 9 fertiggestellt oder eine andere Phase begonnen werden soll).

#### 3. Auswirkungen / Nebenwirkungen
*   Keine Breaking Changes, keine Migration — rein additive Frontend-Logik plus eine neue Chart-Komponente, keine neuen API-Aufrufe (nutzt bereits geladene `recurring`/`balance`-Daten).
*   **Nicht deployed:** Diese Session lief in einer Umgebung ohne den vom Mini-PC-Deploy benötigten SSH-Zugang (kein `minipc`-Alias, kein passender Key vorhanden — direkter Verbindungsversuch zu `192.168.178.151` scheiterte an der Host-Key-Verifikation). Auf Rückfrage hat der Nutzer entschieden, das Deployment selbst durchzuführen, statt hier SSH-Zugang einzurichten.
*   Phase 9 ist damit inhaltlich **vollständig code-fertig** (alle vier Teilscheiben), aber diese letzte Teilscheibe steht noch aus: Mini-PC-Pull + Frontend-Rebuild (`docker compose -f docker-compose.prod.yml build frontend && ... up -d frontend`, kein Backend-/Migrations-Schritt nötig) sowie der übliche visuelle Check.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code, gepusht) — [ ] Deployment auf den Mini-PC steht noch aus (bewusst dem Nutzer überlassen) — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer nach Deployment)

---

### 📋 Schritt-Log: Frei verfügbares Einkommen & Tagesbudget auf dem Mini-PC deployed
**Zeitstempel:** `2026-08-24 04:35`

#### 1. Was wurde getan?
*   Fortsetzung des vorherigen Eintrags (04:20): Nutzer hat den Deploy freigegeben.
*   `docker compose -f docker-compose.prod.yml build frontend` (nur Frontend, keine Backend-/DB-Änderung nötig), dann `... up -d frontend`. `docker compose ps`-Ausgabe bestätigt: nur der Frontend-Container wurde neu erstellt (`Recreate`), Backend/Postgres/Redis liefen unverändert weiter.
*   **Verifiziert:** `docker ps` — alle vier Container laufen, Postgres weiterhin `healthy`. `curl https://finance.pwa-tree.de/` → HTTP 200.
*   `features.md` um die zwei neuen Dashboard-Kennzahlen ergänzt.

#### 2. Warum wurde es getan?
*   Direkte Nutzer-Freigabe nach Rückfrage.

#### 3. Auswirkungen / Nebenwirkungen
*   Kein visueller Browser-Check dieser konkreten Teilscheibe im Log vermerkt — sollte bei Gelegenheit vom Nutzer selbst bestätigt werden (Dashboard öffnen, "Frei verfügbar"/"Tagesbudget" prüfen).
*   Von Phase 9 ist jetzt nur noch die Cashflow-Projektion offen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code/Deployment) — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer)

---

### 📋 Schritt-Log: Frei verfügbares Einkommen & Tagesbudget (Phase 9, dritte Teilscheibe)
**Zeitstempel:** `2026-08-24 04:20`

#### 1. Was wurde getan?
*   Nutzer wählte als nächsten Schritt die Fortsetzung von Roadmap-Phase 9. Umgesetzt: "Frei verfügbares Einkommen" und "Tages-Burn-Rate" — zwei neue Dashboard-Kennzahlen.
*   **Erkenntnis vor der Umsetzung:** Der dritte Roadmap-Punkt "Zyklus-Helfer (`getBillingCycle`)" ist inhaltlich bereits durch `frontend/src/lib/financialPeriod.ts` abgedeckt (aus der ersten Teilscheibe) — Dashboard/Budgets filtern bereits auf das flexible Zeitfenster. Kein neuer Helfer nötig, kein Duplikat einer zweiten Zyklus-Logik im Backend angelegt.
*   **Architektur-Entscheidung:** Anders als der Startsaldo (der eine All-Time-Summe über alle Transaktionen brauchte, die das Dashboard nicht ohnehin lädt — daher Backend-Endpunkt `getBalance`) lassen sich diese beiden neuen Kennzahlen komplett aus bereits vom Dashboard geladenen Daten berechnen (`recurring`, plus der in der vorherigen Teilscheibe ergänzte `GET /users/me/balance`-Aufruf). Konsequent im bestehenden Frontend-Muster umgesetzt (`frontend/src/lib/budgetCalc.ts`, reine Funktionen, exakt wie `upcomingFixedCosts`/`monthlyTotals`/`projectRemainingBudget`) statt eines neuen Backend-Endpunkts — keine doppelte Zyklus-Logik in zwei Sprachen.
*   **`budgetCalc.ts`:** `availableIncome(balanceCents, outstandingFixedCostsCents)` = Gesamtsaldo − ausstehende Fixkosten (Rücklagen aus der Roadmap-Formel bewusst weggelassen — "virtuelle Töpfe" existieren erst ab Phase 10, kein Platzhalter-Feld dafür angelegt). `nextIncomeDueDate()` findet die früheste aktive, positive (Einnahme-)Fixkosten-Regel mit `nextDueDate >= heute`. `daysUntil()` (mindestens 1 Tag, verhindert Division durch 0). `dailyBurnRate()` = frei verfügbares Einkommen / Tage bis zur nächsten Einnahme — bewusst **ohne** Untergrenze bei 0, ein negativer Wert ist das eigentliche Warnsignal (droht überzogen zu werden, bevor Gehalt kommt).
*   **Zeitzone:** `nextIncomeDueDate`/`daysUntil` vergleichen ausschließlich über `.getTime()`, niemals über lokale `Date`-Getter auf einem bereits UTC-verankerten `nextDueDate`-Wert — exakt der in `context.md` dokumentierte Fallstrick aus der ersten Teilscheibe.
*   **`DashboardPage.tsx`:** Neue Zwei-Spalten-Zeile mit `StatTile`s "Frei verfügbar" und "Tagesbudget" (rot eingefärbt bei negativem Wert, gleiches Muster wie die bestehende Restbudget-Prognose-Kachel). Tagesbudget-Kachel zeigt als Untertext entweder das Datum der nächsten gefundenen Einnahme + Tage bis dahin, oder einen Hinweis, dass keine Einnahme-Regel gefunden wurde (Fallback-Horizont: Ende des aktuellen Zeitraums). Lädt jetzt zusätzlich `usersApi.getBalance()` parallel zu den bestehenden Dashboard-Daten.
*   **Verifiziert:** `docker build ./frontend` (führt `tsc && vite build` aus) — baut fehlerfrei durch, keine Typfehler. Kein Docker-Dev-Stack berührt (Lehre aus der vorherigen Teilscheibe befolgt). Keine Backend-Änderung, keine neue Migration — reine Frontend-Logik + ein bereits bestehender API-Aufruf. Kein dedizierter Unit-Test (Frontend hat weiterhin keinen Testrunner, Phase 7 weiterhin offen) — wie bei den bisherigen reinen `budgetCalc.ts`-Ergänzungen in früheren Schritten nur per Typecheck + Code-Review verifiziert, kein Live-Browser-Test möglich (Passkey-Login lässt sich nicht automatisieren).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: Fortsetzung von Roadmap-Phase 9 nach der Startsaldo/Reconciliation-Teilscheibe.

#### 3. Auswirkungen / Nebenwirkungen
*   Keine Breaking Changes, keine Migration — rein additive Frontend-Logik plus ein zusätzlicher (bereits bestehender) API-Aufruf beim Laden des Dashboards.
*   "Frei verfügbares Einkommen" berücksichtigt aktuell **keine** Rücklagen (virtuelle Töpfe existieren noch nicht) — sobald Phase 10 das umsetzt, muss die Formel um einen Abzugsterm erweitert werden.
*   Rest von Phase 9 danach nur noch: Cashflow-Projektion (tagesgenauer Liquiditätsverlauf mit optischer Warnung) — spürbar größerer Umfang (neue Chart-Komponente), bewusst als eigene, separate Teilscheibe zurückgestellt statt hier mit reingepackt.
*   Code committed, aber noch **nicht** auf dem Mini-PC deployed (kein Backend-Rebuild nötig, nur Frontend — steht als nächster Schritt aus, nach Nutzer-Freigabe).

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code) — [ ] Deployment auf den Mini-PC steht noch aus

---

### 📋 Schritt-Log: Startsaldo & Saldo-Abgleich auf dem Mini-PC deployed
**Zeitstempel:** `2026-08-24 03:45`

#### 1. Was wurde getan?
*   Fortsetzung des vorherigen Eintrags (02:45): Nutzer hat den Deploy explizit freigegeben.
*   `docker compose -f docker-compose.prod.yml build backend frontend` (neue Images, keine laufenden Container berührt), `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status` zur Kontrolle (bestätigt: 9 angewendet, genau `20260824010000_add_starting_balance_and_reconciliation` ausstehend — kein unerwarteter Drift), dann `... run --rm backend npx prisma migrate deploy` ("All migrations have been successfully applied"), dann `docker compose -f docker-compose.prod.yml up -d backend frontend`.
*   **Verifiziert:** `docker ps` — alle vier Container laufen (`finanzplaner-postgres-1` weiterhin `healthy`, durchgehend ungestört seit dem Zwischenfall). Backend-Logs zeigen die zwei neuen Routen sauber gemappt (`GET /users/me/balance`, `POST /users/me/reconcile`) sowie `PATCH /users/me`, keine Fehler/Fatals im Log. `curl https://finance.pwa-tree.de/` → HTTP 200.
*   `features.md` um den neuen Abschnitt "Startsaldo & Saldo-Abgleich" ergänzt (unter Budgets & Dashboard).

#### 2. Warum wurde es getan?
*   Direkte Nutzer-Freigabe nach Rückfrage, ob deployed werden soll (bewusst explizit gefragt statt automatisch deployed, wegen des Docker-Zwischenfalls weiter oben in dieser Session).

#### 3. Auswirkungen / Nebenwirkungen
*   Produktions-Account hat `startingBalance` aktuell auf dem Default `0` — der Nutzer hat noch keinen echten Startsaldo hinterlegt, kann das aber jederzeit selbst über `/settings` tun.
*   Kein visueller Browser-Check dieser konkreten Teilscheibe im Log vermerkt — sollte bei Gelegenheit vom Nutzer selbst bestätigt werden (Settings → Startsaldo setzen, "Saldo abgleichen" mit einem abweichenden Betrag testen, Ausgleichsbuchung in `/transactions` prüfen).
*   Rest von Phase 9 (`getBillingCycle` serverseitig, frei verfügbares Einkommen, Tages-Burn-Rate, Cashflow-Projektion) weiterhin offen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code/Migration/Deployment) — [ ] Überprüfung erforderlich (visueller Check durch den Nutzer, siehe oben)

---

### 📋 Schritt-Log: Startsaldo & Saldo-Abgleich (Phase 9, zweite Teilscheibe) — Code fertig, noch nicht deployed
**Zeitstempel:** `2026-08-24 02:45`

#### 1. Was wurde getan?
*   Nutzer wählte als nächsten Schritt den Rest von Roadmap-Phase 9 (nach der bereits deployten ersten Teilscheibe `monthStartDay`). Begonnen mit dem ersten Punkt: Startsaldo & Reconciliation ("Saldo abgleichen").
*   **Schema:** `User.startingBalance Int @default(0)` (Cent, Startsaldo vor der ersten erfassten Buchung) sowie `Transaction.isReconciliation Boolean @default(false)` (kennzeichnet system-generierte Ausgleichsbuchungen, gleiches Muster wie `avoidable`/`inefficient`/`tooExpensive`). Migration `20260824010000_add_starting_balance_and_reconciliation` von Hand geschrieben (rein additiv, kein Backfill) statt per `prisma migrate dev` generiert — siehe Punkt 3, Docker-Zwischenfall.
*   **Backend:** `TransactionsService.getBalance(userId)` (Prisma-`aggregate`-Summe aller Buchungen des Nutzers) neu, von `UsersModule` importiert (`TransactionsModule` exportiert `TransactionsService` bereits, gleiches Cross-Module-Muster wie `RecurringTransactionsService`→`TransactionsService`). `UsersService.getBalance()` = `startingBalance + getBalance()`. `UsersService.reconcile(userId, { actualBalance })`: berechnet Differenz zum kalkulierten Saldo, legt bei Differenz ≠ 0 eine Transaktion mit `isReconciliation: true` unter einer automatisch angelegten/wiederverwendeten Kategorie "Kontoabgleich" an (kein Aufruf über `TransactionsService.create()`, da `isReconciliation` bewusst **nicht** Teil des öffentlichen `CreateTransactionDto` ist — nur system-generiert, nicht über die normale API gefälscht anlegbar). Neue Endpunkte `GET /users/me/balance`, `POST /users/me/reconcile`. `UpdateUserDto`/`UsersService.update()` um optionales `startingBalance` erweitert; `monthStartDay` dabei nachträglich auf `@IsOptional()` umgestellt (echtes Partial-Update statt bisher immer beide Felder senden zu müssen). `AuthService.login()`/`me()` geben `startingBalance` jetzt mit zurück (Konsistenz mit `monthStartDay`).
*   **Frontend:** Neue `BalanceSettings.tsx` unter `/settings` — zeigt den berechneten Saldo, Formular zum Setzen des Startsaldos, Formular "Saldo abgleichen" (tatsächlicher Kontostand aus dem Banking-App → Ausgleichsbuchung oder Bestätigung "stimmt bereits überein"). `User`-Typ und `usersApi` um `startingBalance`/`getBalance`/`reconcile` ergänzt.
*   **Tests:** Neue Fälle in `users.service.spec.ts` (`getBalance` addiert Startsaldo + Buchungssumme; `reconcile` legt bei Differenz ≠ 0 korrekt eine Buchung an, erstellt die Kategorie "Kontoabgleich" nur bei Bedarf, tut bei Differenz = 0 nichts) sowie in `transactions.service.spec.ts` (`getBalance`, inkl. Nullwert-Fall wenn `_sum.amount` `null` ist). Backend: `docker build --target builder` (da `npm test`/Devdependencies nur im Builder-Stage des mehrstufigen Dockerfiles vorhanden sind, nicht im schlanken Runner-Image) + `npm test` im daraus gebauten Image — 14 Suiten/**35** Tests grün (vorher 29). Frontend: `docker build ./frontend` (führt `tsc && vite build` aus) — baut fehlerfrei durch, keine Typfehler. Kein Docker-Dev-Stack auf dem Mini-PC gestartet (siehe Punkt 3) — stattdessen gezielt die Builder-Stage der bestehenden Dockerfiles für die Verifikation benutzt, ohne die Prod-Container anzufassen.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: Fortsetzung von Roadmap-Phase 9, erster von vier verbleibenden Punkten (Startsaldo & Reconciliation; danach noch offen: `getBillingCycle` serverseitig, frei verfügbares Einkommen, Tages-Burn-Rate, Cashflow-Projektion).

#### 3. Auswirkungen / Nebenwirkungen
*   **Zwischenfall während dieser Session (inzwischen behoben, siehe unten):** Beim Versuch, für die Migrationserstellung eine lokale Dev-Datenbank hochzufahren, wurde versehentlich `docker compose -f docker-compose.yml up -d postgres redis` (die lokale Dev-Compose-Datei) im selben Verzeichnis wie `docker-compose.prod.yml` ausgeführt. Da beide Compose-Dateien denselben impliziten Projektnamen (`finanzplaner`, aus dem Verzeichnisnamen) **und** dieselben Volume-Namen (`pgdata`, `redisdata`) verwenden, hat Compose die laufenden **Produktions**-Container `finanzplaner-postgres-1`/`finanzplaner-redis-1` als "abweichend vom Dev-Spec" erkannt und **neu erstellt** (unter den Dev-Container-Namen `finance_postgres`/`finance_redis`, mit den falschen Dev-Zugangsdaten in der Container-Konfiguration). Die echten Daten waren nie in Gefahr, da beide Compose-Dateien dieselben benannten Volumes referenzieren (Postgres hat beim Start ein bereits initialisiertes Datenverzeichnis vorgefunden und die Dev-Env-Variablen ignoriert) — aber es kam zu einem kurzen echten Ausfall der Redis-Verbindung des laufenden Backends (`ECONNREFUSED`, betrifft Rate-Limiting), bis der Backend-Container neu gestartet wurde. Behoben durch: Backend-Neustart (Redis-Verbindung sauber wiederhergestellt), danach `docker compose -f docker-compose.prod.yml up -d postgres redis` (stellt anhand derselben Volumes die korrekten Container-Namen/Zugangsdaten/Healthchecks wieder her, kein Datenverlust), erneuter Backend-Neustart, verifiziert über `docker ps` (beide Container `healthy`/laufend unter den korrekten Namen), fehlerfreie Backend-Logs, `curl https://finance.pwa-tree.de/` → HTTP 200. **Lehre für künftige Sessions:** Auf dem Mini-PC niemals `docker-compose.yml` (Dev) direkt im Repo-Root ausführen, ohne explizit einen abweichenden Projektnamen zu setzen (`docker compose -p <anderer-name> -f docker-compose.yml ...`) oder besser: für reine Verifikationszwecke (Build/Test/Typecheck) ausschließlich einzelne Images bauen/`docker run`, nie `up` auf Dev-Services in diesem Verzeichnis.
*   **Migration wurde bewusst von Hand geschrieben** (nicht per `prisma migrate dev` gegen eine echte Dev-DB generiert) — direkte Folge des obigen Zwischenfalls, um kein weiteres Mal eine Dev-DB in diesem Verzeichnis hochfahren zu müssen. Rein additive `ALTER TABLE ... ADD COLUMN ... DEFAULT ...`, kein Risiko für Bestandsdaten, aber **noch nicht gegen die echte Prod-DB mit `prisma migrate deploy` angewendet** — reine Vorsichtsmaßnahme, sollte trotzdem vor dem produktiven Einsatz kurz gegengeprüft werden (z. B. `npx prisma migrate diff` gegen die Prod-DB, oder einfach `migrate deploy` selbst validiert vor dem Anwenden).
*   **Noch nicht deployed:** Committed, aber weder auf dem Mini-PC per `prisma migrate deploy` angewendet noch die Backend-/Frontend-Container neu gebaut/gestartet — steht als nächster Schritt aus, nach expliziter Nutzer-Freigabe (siehe Doku-Regel „vorsichtig bei produktionsnahen Aktionen", zusätzlich verschärft durch den obigen Zwischenfall).
*   Keine Breaking Changes am bestehenden Verhalten — beide neuen Felder sind additiv mit Defaults; `monthStartDay` bleibt beim PATCH weiterhin abwärtskompatibel nutzbar (jetzt zusätzlich auch einzeln, ohne `startingBalance` mitzusenden).

#### 4. Status der Aufgabe
*   [ ] In Bearbeitung (Deployment auf den Mini-PC steht noch aus) — [x] Code/Tests abgeschlossen

---

### 📋 Schritt-Log: Abrechnungszeitraum-Feature auf dem Mini-PC deployed und live verifiziert
**Zeitstempel:** `2026-08-23 23:40`

#### 1. Was wurde getan?
*   Fortsetzung des vorherigen Eintrags (Deployment lief dort noch im Hintergrund): Backend-Image-Build fertiggestellt, Migration `20260823145352_add_month_start_day` per `docker compose run --rm backend npx prisma migrate deploy` erfolgreich angewendet, Backend+Frontend-Container neu gestartet.
*   **Kurzer 502 direkt nach dem Neustart** (`curl` auf `/api/auth/me` unmittelbar nach `docker compose up -d`) — Backend-Logs zeigten aber einen sauberen, fehlerfreien Boot ("Nest application successfully started", alle Routen inkl. `PATCH /users/me` gemappt). Erneuter `curl` wenige Sekunden später lieferte korrekt `401` (statt 502) — reiner Neustart-Timing-Effekt (nginx kurz ohne erreichbaren Backend-Upstream), kein echter Fehler.
*   **Da der Nutzer 2FA/TOTP inzwischen entfernt hat, erstmals wieder ein vollständiger automatisierter Login-Test gegen die echte Produktions-URL** (`https://finance.pwa-tree.de`) mit den echten Zugangsdaten möglich: Login erfolgreich, Dashboard zeigt korrekt "Zeitraum: 01. Aug. – 31. Aug. 2026" (Default `monthStartDay=1` greift für Bestandsnutzer unverändert — bestätigt Abwärtskompatibilität mit echten Produktionsdaten: Einnahmen 3.000,00 €, Ausgaben 723,40 €, Fixkosten nächster Monat 1.818,00 €, alles korrekt berechnet), Einstellungen zeigen das neue "Abrechnungszeitraum"-Panel mit Vorschau "01. Aug. – 31. Aug. 2026".
*   Dabei nebenbei festgestellt (nicht Teil dieser Änderung, nur beobachtet): Der Nutzer hat inzwischen selbst einen echten Passkey ("Basti", zuletzt genutzt 23.08.2026) registriert.

#### 2. Warum wurde es getan?
*   Abschluss des in den vorherigen beiden Einträgen begonnenen Abrechnungszeitraum-Features — Migration und Verifikation waren beim Sessionende zuvor noch offen.

#### 3. Auswirkungen / Nebenwirkungen
*   Keine Datenverluste, keine unerwarteten Nebeneffekte — Migration rein additiv mit Default, bestehende Nutzerdaten (Transaktionen, Fixkosten, Kategorien) unangetastet und korrekt weiterhin funktionsfähig.
*   `monthStartDay` steht für den Produktions-Account aktuell auf `1` (unverändert) — der Nutzer kann den Starttag jederzeit selbst über `/settings` anpassen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code, Deployment und Live-Verifikation vollständig)

---

### 📋 Schritt-Log: Konfigurierbarer Abrechnungszeitraum (Phase 9, erste Teillieferung)
**Zeitstempel:** `2026-08-23 15:10`

#### 1. Was wurde getan?
*   **Sessionwechsel/-Neustart mittendrin:** Ein vorheriger Hintergrundbefehl (`tsc --noEmit`) wurde als "stopped" ohne Abschlussprotokoll gemeldet — der zugrunde liegende Claude-Code-Prozess war offenbar zwischenzeitlich neu gestartet worden. Beim Wiedereinstieg festgestellt: `backend/prisma/schema.prisma` hatte das bereits begonnene `monthStartDay`-Feld verloren (vermutlich beim Neustart nicht persistiert), obwohl der zugehörige Migrationsordner auf der Platte noch vorhanden war — erneut ergänzt und mit `npx prisma migrate status` verifiziert, dass die lokale Dev-DB die Migration bereits kannte, nur die zwischenzeitlich von einer anderen (Cloud-)Session hinzugekommene `add_too_expensive_flag`-Migration fehlte noch — beides sauber nachgezogen.
*   **Nutzeranfrage:** Gehalt kommt am 23. des Monats, nicht am 1. — der App-Monat soll vom 23. bis 22. des Folgemonats laufen, einstellbar (nicht hart codiert), falls sich das später ändert (Arbeitgeberwechsel).
*   **`backend`:** `User.monthStartDay Int @default(1)` (Migration `20260823145352_add_month_start_day`, rein additiv). `PATCH /users/me` (neues `UsersController`/`UsersService`, vorher leere Stubs aus Phase 1) zum Ändern; `AuthService.login()`/`me()` liefern das Feld jetzt mit aus, damit das Frontend es ohne Zusatzaufruf kennt.
*   **`frontend/src/lib/financialPeriod.ts`** (neu, ersetzt `dateRange.ts` vollständig — keine Restverwendung mehr, gelöscht): `getFinancialPeriod()` berechnet für ein `monthStartDay` und ein Referenzdatum den Zeitraum (inkl. Monatsende-Clamping, z. B. `monthStartDay=31` im Februar), plus `getNext-`/`getPreviousFinancialPeriod()`, `daysInFinancialPeriod()`, `dayOfFinancialPeriod()` (Ersatz für die alten `dayOfMonth`/`daysInMonth`), `financialPeriodLabel()`, `listFinancialPeriods()` (Fenster von Zeiträumen für die Budget-Auswahl).
*   **Bug während der Verifikation gefunden und behoben:** Die erste Implementierung von `getNext-`/`getPreviousFinancialPeriod` bildete den Nachbar-Zeitraum, indem 1ms vom Start/Ende abgezogen und das Ergebnis erneut über lokale `Date`-Getter (`getFullYear`/`getMonth`/`getDate`) eingelesen wurde — das bricht in jeder Zeitzone mit Offset ≠ 0 (in CEST/UTC+2 durch einen expliziten Test bestätigt: eine UTC-Mitternacht-Grenze landet lokal auf demselben Kalendertag, wodurch der "vorherige" Zeitraum fälschlich wieder den aktuellen lieferte). Behoben durch Umstellung auf reine Integer-Monatsarithmetik für das Weiterschalten — lokale Getter werden jetzt nur noch genau einmal gelesen, am äußeren Einstiegspunkt (echtes "heute" vom Browser), alles Verkettete rechnet ausschließlich mit selbst erzeugten UTC-Werten.
*   **`IncomeExpenseChart.tsx`:** weiterer, beim Umbau entdeckter Bug — das Chart ordnete Buchungen bisher über den reinen Kalendertag-im-Monat (`getDate()`) ein; bei einem Zeitraum, der zwei Kalendermonate überspannt (z. B. 23. Aug.–22. Sep.), wären September-Buchungen fälschlich auf Tag 1–22 statt 9–31 gelandet und hätten sich mit den echten frühen August-Tagen überlappt. Fix: neue Prop `periodStart`, Tage werden jetzt relativ zum Zeitraum-Start gezählt.
*   **`DashboardPage.tsx`/`BudgetsPage.tsx`:** auf die neuen Helfer umgestellt. Budgets: `<input type="month">` (kann keinen Zeitraum abbilden, der nicht am 1. beginnt) ersetzt durch ein `<select>` mit den konkreten Zeiträumen (2 zurück, 6 voraus) inkl. Klartext-Label; `Budget.month` speichert jetzt das tatsächliche Zeitraum-Startdatum statt immer des 1. — keine Backend-Änderung nötig, da `Budget.month` schon immer ein exakt abgeglichenes `DateTime`-Feld war (Produktions-DB hatte zum Zeitpunkt der Änderung ohnehin 0 Budget-Zeilen, kein Migrations-/Altlasten-Problem).
*   **`components/settings/MonthCycleSettings.tsx`** (neu, in Settings eingehängt): Zahlenfeld (1–31) mit Live-Vorschau des sich ergebenden Zeitraums, speichert über `PATCH /users/me`, ruft danach `AuthContext.refreshUser()` auf, damit Dashboard/Budgets sofort den neuen Zeitraum verwenden.
*   **Verifiziert:** Backend `npm run build` + `npm test` (14 Suiten/29 Tests grün), Frontend `tsc --noEmit` (0 Fehler). Zeitraum-Arithmetik gezielt mit mehreren Fällen durchgetestet (23er-Anker, klassischer 1.-Anker, Clamping-Fall, Jahresgrenze, Verkettung prev/next — inkl. des oben beschriebenen, dabei gefundenen Bugs). Echter Browser-Test: Einstellungen → Starttag auf 23 gesetzt → Dashboard zeigt korrekt "Zeitraum: 23. Aug. – 22. Sept. 2026" und "Fixkosten 23. Sept. – 22. Okt. 2026"; Budgets-Dropdown zeigt die erwartete Kette 23.-Zeiträume. Danach zurück auf 1 gesetzt (lokaler Test-User).
*   Committed (`85942db`), gepusht, auf dem Mini-PC gepullt; Backend+Frontend-Rebuild und `prisma migrate deploy` liefen zum Zeitpunkt dieses Log-Eintrags noch im Hintergrund (Produktions-Budget-Tabelle war zuvor als leer verifiziert — 0 Zeilen, keine Datenmigrationssorge).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag, exakt deckungsgleich mit dem inzwischen vom Nutzer selbst dokumentierten Phase-9-Punkt "Dynamischer Monatsstart" in `claude/roadmap.md` (`salaryDayOfMonth`) — als `monthStartDay` auf dem `User`-Modell umgesetzt statt als separates Feld, funktional identisch.

#### 3. Auswirkungen / Nebenwirkungen
*   `frontend/src/lib/dateRange.ts` vollständig entfernt (keine Restnutzung mehr im Code).
*   Bestehende (in Produktion aktuell nicht vorhandene) Budget-Zeilen aus der Zeit vor dieser Änderung würden bei einem `monthStartDay`-Wechsel weg von `1` nicht automatisch einem der neuen Zeiträume zugeordnet — betrifft aktuell niemanden (0 Zeilen in Produktion), wäre aber bei zukünftiger Nutzung mit vielen historischen Budgets ein Punkt für eine echte Datenmigration.
*   `claude/roadmap.md` wurde vom Nutzer selbst um die Phasen 9–15 erweitert (separat committed, `78617b4`) — dieser Schritt setzt den ersten (Kern-)Teil von Phase 9 um; Startsaldo/Reconciliation, freies verfügbares Einkommen, Tages-Burn-Rate und Cashflow-Projektion aus Phase 9 sind noch offen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code, lokal vollständig verifiziert) — [ ] Deployment auf dem Mini-PC lief zum Zeitpunkt dieses Eintrags noch (siehe nächster Log-Eintrag für Bestätigung)

---

### 📋 Schritt-Log: "Zu hoch"-Flag gemerged und auf dem Mini-PC deployed
**Zeitstempel:** `2026-08-23 19:55`

#### 1. Was wurde getan?
*   Fortsetzung der Session, die den vorherigen Eintrag (17:15) hinterlassen hat: der Feature-Branch `claude/session-continuation-x6322m` war seit dem "Zu hoch"-Flag-Schritt fertig entwickelt, aber weder in `main` gemerged noch auf dem Mini-PC deployed.
*   Mit dem Nutzer explizit abgestimmt (der Mini-PC-Klon trackt `main`, das noch 3 Commits zurücklag): Fast-Forward-Merge von `claude/session-continuation-x6322m` nach `main` (`git merge --ff-only`, keine Konflikte, da `main` ein reiner Vorfahre des Branches war), gepusht (`a3cd9b9..4113b83`).
*   Auf dem Mini-PC (`claude@192.168.178.151`, per SSH — Nutzer hat die SSH-Aktion explizit freigegeben): `git pull --ff-only` (main), `docker compose -f docker-compose.prod.yml build backend frontend`, `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy` (Migration `20260823171500_add_too_expensive_flag` erfolgreich angewendet, Prisma-Output bestätigt "All migrations have been successfully applied"), `docker compose -f docker-compose.prod.yml up -d backend frontend`.
*   **Stolperstein unterwegs:** Der erste Backend-Build-Versuch lief in ein Tool-seitiges Timeout, das den SSH-Prozess killte, bevor die finale Image-Export-Stage durchlief — das produzierte Image war dadurch de facto ein Cache-Rest vom vorherigen Build (nur 7 statt 8 Migrationsordner enthalten, per `docker run --entrypoint ls` im Image bestätigt). Erkannt durch Abgleich der Image-Erstellungszeit (`docker inspect --format '{{.Created}}'`) gegen die tatsächliche Bauzeit. Backend-Build per `nohup ssh ... &` erneut im Hintergrund gestartet, diesmal bis zum tatsächlichen Prozessende abgewartet (nicht nur bis der auslösende Shell-Befehl zurückkehrte) — danach bestätigt, dass das neue Image alle 8 Migrationsordner inkl. `add_too_expensive_flag` enthält.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: Fortsetzung der Session laut `context.md`/vorherigem Log-Eintrag, die den Deploy-Schritt als offen markiert hatten. Nutzer hat sowohl den SSH-Zugriff als auch den Merge nach `main` explizit auf Nachfrage freigegeben.

#### 3. Auswirkungen / Nebenwirkungen
*   `main` enthält jetzt den kompletten Stand von `claude/session-continuation-x6322m` (inkl. `context.md`, `features.md`). Der Feature-Branch selbst wurde nicht gelöscht.
*   Alle vier Prod-Container (`postgres`, `redis`, `backend`, `frontend`) laufen; Backend-Startup-Log zeigt alle Routen korrekt gemappt, keine Fehler.
*   **Kein visueller Browser-Check des neuen "Zu hoch"-Toggle-Buttons durch den Nutzer selbst** — das bleibt offen, da 2FA/TOTP auf dem Prod-Account einen automatisierten Login-Check verhindert (siehe frühere Einträge). Infrastruktur-seitig (Container-Status, Migration, Routen) ist alles verifiziert.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Merge + Deploy) — [ ] Überprüfung erforderlich (finaler visueller Check des Toggle-Buttons durch den Nutzer)

---

### 📋 Schritt-Log: "Zu hoch"-Flag auf Transaktionen und Fixkosten
**Zeitstempel:** `2026-08-23 17:15`

#### 1. Was wurde getan?
*   Nachgeholt: der vierte, beim Schritt "Monats-Fixkosten-Summe, Beleg-Upload, vermeidbar/ineffizient-Flags" bewusst zurückgestellte Punkt aus der ursprünglichen Anfrage — ein "zu hoch"-Flag, unabhängig von `avoidable`/`inefficient`.
*   **`backend/prisma/schema.prisma`:** Neues Feld `tooExpensive Boolean @default(false)` auf `Transaction` und `RecurringTransaction` (dritter unabhängiger Boolean neben `avoidable`/`inefficient`, gleiches Muster). Migration `20260823171500_add_too_expensive_flag` (rein additiv, Default `false`, kein Backfill nötig).
*   **Backend:** `CreateTransactionDto`/`CreateRecurringTransactionDto` um optionales `tooExpensive` ergänzt; `TransactionsService.create()`/`update()` sowie `RecurringTransactionsService.create()` reichen das Feld durch (`RecurringTransactionsService.update()` brauchte keine Änderung, da dort bereits das komplette DTO gespreadet wird).
*   **Frontend:** `Transaction`/`RecurringTransaction`-Typen sowie die `*Input`-Typen (`transactions.ts`, `recurringTransactions.ts`) um `tooExpensive` ergänzt. In `TransactionsPage.tsx` und `RecurringTransactionsPanel.tsx` je ein dritter Icon-Toggle-Button (`TrendingUp`, lila eingefärbt wenn aktiv) neben den bestehenden Vermeidbar-/Ineffizient-Buttons ergänzt, inkl. `handleToggleTooExpensive()`. Hinweistext auf `/transactions` um "oder zu hoch" erweitert.
*   **Verifiziert:** `npx prisma format` + `npx prisma validate` (Schema konsistent), Backend `npm run build` + `npm test` (14 Suiten/29 Tests grün), Frontend `tsc --noEmit` (0 Fehler).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: Fortsetzung der zuvor zurückgestellten Punkte aus der Feature-Anfrage vom 23.08. (Monats-Summe, Beleg-Upload und vermeidbar/ineffizient waren bereits umgesetzt, das "zu hoch"-Flag blieb offen).

#### 3. Auswirkungen / Nebenwirkungen
*   **Kein Docker/Browser-Test in dieser Session möglich:** Diese Session läuft in einer Cloud-Remote-Umgebung ohne laufenden Docker-Daemon (`docker ps` schlägt mit "no such file or directory" fehl) — anders als die vorherigen Schritte (lokaler WSL-Klon bzw. Mini-PC) konnte die Migration nicht gegen eine echte Postgres-Instanz angewendet und die neuen Buttons nicht im echten Browser durchgeklickt werden. Verifikation beschränkt sich auf Schema-Validierung sowie grüne Backend-Tests/Build und fehlerfreien Frontend-Typecheck.
*   **Nutzer-Aktion erforderlich:** Committed und gepusht, aber noch nicht auf dem Mini-PC gepullt/deployed. Vor dem produktiven Einsatz: `git pull`, Backend + Frontend neu bauen, `npx prisma migrate deploy` ausführen (neue Migration `20260823171500_add_too_expensive_flag`), danach den neuen Toggle-Button auf `/transactions` und in den Fixkosten-Einstellungen visuell bestätigen.
*   Keine Breaking Changes — neues Feld ist rein additiv mit Default `false`, bestehende Zeilen bleiben unverändert.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Code/Migration) — [ ] Überprüfung erforderlich (Migration deployen + visueller Check durch den Nutzer, da kein Docker in dieser Session verfügbar war)

---

### 📋 Schritt-Log: Transaktionen-Edit + Spracheingabe für Quick-Add
**Zeitstempel:** `2026-08-23 09:30`

#### 1. Was wurde getan?
*   **Nutzer-Report "Einnahmen ändert sich nicht auf dem Dashboard" analysiert** (kein Cache-/Refresh-Bug): Produktionsdaten geprüft — Nutzer hatte die Fixkosten-Regel "Gehalt" von 3000€ auf 5000€ geändert, aber die bereits heute (23.08., 1 Uhr Cron) gebuchte Transaktion behält naturgemäß den alten Betrag (3000€), da eine Regel-Änderung nur zukünftige Buchungen betrifft. Dashboard zeigte also korrekt den tatsächlich gebuchten Betrag — dem Nutzer fehlte lediglich eine Möglichkeit, die bereits gebuchte Transaktion selbst zu korrigieren.
*   **`TransactionsPage.tsx`:** Bearbeiten-Formular ergänzt (gleiches Muster wie `RecurringTransactionsPanel`/`BudgetsPage`: Stift-Button, Formular mit Betrag/Beschreibung/Kategorie/Datum, Speichern/Abbrechen). Backend-seitig war dafür nichts zu tun — `PATCH /transactions/:id` inkl. `date`-Konvertierung existierte bereits korrekt.
*   **Sprich-Anfrage geklärt:** Nutzer wünschte sich ein Weck-Wort ("Hey App, füge hinzu…"), das automatisch erkannt wird. Per Rückfrage geklärt, dass echtes Always-on-Wake-Word in einer PWA nicht realisierbar ist (Browser entziehen Mikrofonzugriff außerhalb des aktiven Tabs, kein Hintergrund-Listening möglich — das bräuchte eine native App mit OS-Berechtigungen). Als Alternative "Tippen-zum-Sprechen" vorgeschlagen und vom Nutzer bestätigt.
*   **`QuickAddPage.tsx`:** Mikrofon-Button (Web Speech API, `lang="de-DE"`) neu ergänzt — startet bei Klick eine einzelne Erkennung, füllt Betrag/Beschreibung/Kategorie automatisch aus dem Transkript, **kein Auto-Submit** (Nutzer prüft/korrigiert vor "Speichern", da Spracherkennung fehlerhaft transkribieren kann). `frontend/src/lib/voiceParse.ts` (neu, reine Funktionen): `parseVoiceTranscript()` extrahiert den Betrag per Regex (dt. Spracherkennung transkribiert gesprochene Zahlen bereits als Ziffern, z. B. "fünfzig Euro" → "50 Euro" im Transkript — kein Wort-Zahl-Parsing nötig), `matchCategoryId()` gleicht das Transkript gegen vorhandene Kategorienamen ab. `frontend/src/types/speech-recognition.d.ts` (neu) — minimale Ambient-Types, da die Web Speech API nicht Teil von TypeScripts Standard-DOM-Lib ist.
*   **Verifiziert:** Backend-Build+Tests unverändert grün (keine Backend-Änderung für Voice/Edit nötig). Parser-Logik gegen mehrere realistische Transkripte durchgetestet (inkl. Grenzfall gesprochener Zahlwörter — degradiert sauber auf manuelle Eingabe). Echter Browser-Test für Transaktionen-Edit (Betrag 30€→50€ korrekt übernommen). Für die Sprememingabe: Da diese Sandbox-Umgebung bereits eine **native** `window.SpeechRecognition`-Implementierung mitbringt (kein Mikrofon vorhanden, daher in echten Tests nutzlos), wurde für den Verifikationstest gezielt sowohl `SpeechRecognition` als auch `webkitSpeechRecognition` mit einer Fake-Klasse überschrieben, die ein synthetisches Transkript liefert — bestätigt, dass die komplette Kette (Klick → Erkennung → Parsing → Formular-Befüllung inkl. Kategorie-Automatch) korrekt verdrahtet ist. Test-Daten entfernt.
*   Committed, gepusht (`2e3c8bf` Transaktionen-Edit, `6a0f866` Spracheingabe), auf dem Mini-PC gepullt, Frontend neu gebaut und deployed (keine Migration nötig, reiner Frontend-Code).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag: Bug-Report zum Dashboard (führte zur Transaktionen-Edit-Funktion) sowie Wunsch nach Sprach-Erfassung für Quick-Add.

#### 3. Auswirkungen / Nebenwirkungen
*   Der Mikrofon-Button wird nur angezeigt, wenn der Browser die Web Speech API unterstützt (`SpeechRecognitionCtor`-Check) — auf nicht unterstützten Browsern bleibt Quick-Add unverändert nutzbar, kein Fehlerzustand.
*   Kein Wort-Zahl-Parsing ("fünfzig" statt "50") — falls die Spracherkennung eines Geräts tatsächlich Wortzahlen statt Ziffern transkribiert, bleibt das Betragsfeld leer und muss manuell ausgefüllt werden (kein Absturz, sauberer Fallback).
*   Frontend hat weiterhin keinen eigenen Testrunner (Vitest/Jest) — die neue Parser-Logik wurde nur manuell/per Playwright verifiziert, nicht mit einem festen Unit-Test abgesichert (Phase 7 der Roadmap steht dafür weiterhin aus).

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Monats-Fixkosten-Summe, Beleg-Upload, vermeidbar/ineffizient-Flags
**Zeitstempel:** `2026-08-23 07:15`

#### 1. Was wurde getan?
*   Nutzer priorisierte drei der zuvor besprochenen Punkte: Monats-Summe der Fixkosten, Beleg-Upload mit Auto-Löschung, vermeidbar/ineffizient-Flags (auf Transaktionen **und** Fixkosten-Regeln, siehe frühere Rückfrage-Antwort "Both").
*   **Dashboard:** Neue `StatTile` "Fixkosten [nächster Monat]" — Summe aller aktiven, negativen (Ausgaben-)Fixkosten-Regeln, deren `nextDueDate` in den nächsten Kalendermonat fällt (`upcomingFixedCosts()` in `budgetCalc.ts`, reine Funktion, per Unit-artigem Playwright-Test verifiziert statt Jest, da rein UI-getrieben).
*   **Neues `invoices`-Modul (Backend):** `Invoice`-Model (Prisma), Multer-Diskspeicher unter `UPLOADS_DIR` (per Zufalls-UUID-Dateiname, `fileFilter` auf PDF/JPEG/PNG/HEIC, 10-MB-Limit) — nach dem Vorbild von `fitnesstracker`s `progressPhoto.service.ts` (gleiches Muster: `UPLOADS_DIR`-Env-Var, `randomUUID()`-Dateiname, `unlink().catch()` beim Löschen). Endpunkte: `POST /invoices` (Upload), `GET /invoices` (Liste), `GET /invoices/:id/file` (Stream, authentifiziert), `PATCH /invoices/:id` (Wichtig-Flag), `DELETE /invoices/:id`. Täglicher Cron (`EVERY_DAY_AT_2AM`) löscht Zeilen+Dateien älter als 30 Tage, bei denen `important=false` ist.
*   **Neue `/invoices`-Seite (Frontend):** Upload per Datei-Input, Liste mit Dateiname (Link zum Ansehen/Download), Upload-Datum, Größe, "löscht in X Tagen" bzw. "Wichtig"-Badge, Stern-Toggle, Löschen.
*   **`avoidable`/`inefficient`** (zwei unabhängige Booleans, nicht ein einzelnes Enum) auf `Transaction` **und** `RecurringTransaction` ergänzt. Icon-Toggle-Buttons (Flag=vermeidbar, TrendingDown=ineffizient) in `RecurringTransactionsPanel.tsx` sowie in einer **neuen** `TransactionsPage.tsx` (`/transactions`, Nav-Eintrag "Transaktionen") — Letztere war zwingende Voraussetzung, da es zuvor **keine** Seite gab, um einzelne Transaktionen überhaupt zu durchsuchen (Dashboard aggregiert nur, QuickAdd kann nur anlegen). Bewusst minimal gehalten (Liste + Flag-Toggle + Löschen, kein volles Bearbeiten), da nur das Flaggen angefragt war.
*   **Nebenbei entdeckt und behoben:** `docker-compose.prod.yml` existierte bisher **nur** auf dem Mini-PC, war nie Teil des Git-Repos (keine Secrets darin, nur `${VAR:?}`-Referenzen — reines Versehen aus der ursprünglichen Ad-hoc-Erstellung). Jetzt erstmals committed, inkl. des neuen `uploads`-Named-Volumes für den Beleg-Upload-Pfad.
*   **Tests:** Neue `invoices.service.spec.ts` (Retention-Logik: Cutoff-Berechnung, löscht nur `important=false` + älter als 30 Tage, keine Löschung wenn nichts fällig) und `invoices.controller.spec.ts` (Boilerplate). `npm run build` + `npm test` (Backend, 14 Suiten/29 Tests grün). `tsc --noEmit` (Frontend, 0 Fehler).
*   **Verifiziert (echter Browser, lokal):** Alle drei Features per Playwright-Skript end-to-end durchgespielt — Fixkosten-Regel mit Fälligkeit nächsten Monat angelegt und als vermeidbar+ineffizient markiert (Icons korrekt eingefärbt), Dashboard zeigt korrekt "Fixkosten September 2026: 42,50 €", Transaktion über Quick-Add angelegt und auf `/transactions` geflaggt, Beleg hochgeladen/als wichtig markiert/gelöscht (Datei auf Platte korrekt angelegt und beim Löschen wieder entfernt, per `ls` bestätigt). Test-Daten restlos entfernt.
*   **Produktions-Deployment:** Committed, gepusht (`d559b82`), auf dem Mini-PC gepullt (dabei den dortigen, jetzt redundanten uncommitteten `docker-compose.prod.yml`-Stand verworfen, siehe oben), Backend+Frontend neu gebaut, beide neuen Migrationen (`add-invoices`, `add-avoidable-inefficient-flags`) — beide rein additiv mit Defaults, kein Backfill nötig — in einem Rutsch angewendet, `uploads`-Volume automatisch angelegt. Alle vier Container laufen, neuer Asset-Hash (`index-C9HQZBq0.js`) bestätigt.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag mit expliziter Priorisierung dieser drei Punkte gegenüber dem vierten (zu-hoch-Flag), der noch offen bleibt.

#### 3. Auswirkungen / Nebenwirkungen
*   **Vollständiger End-to-End-Test gegen die echte Produktions-URL war diesmal nicht möglich:** Der Login-Check schlug fehl, weil auf dem Produktions-Account inzwischen TOTP (2FA) aktiviert ist (`POST /auth/login` liefert korrekt `"TOTP code required"`) — das automatisierte Playwright-Skript hat naturgemäß keinen gültigen Code. Deployment wurde stattdessen auf Infrastruktur-Ebene verifiziert (Container-Status, neuer Asset-Hash, erfolgreiche Migrationen) sowie vollständig **lokal** im echten Browser getestet. Der Nutzer wurde bewusst gebeten, den finalen visuellen Check selbst durchzuführen.
*   `docker-compose.prod.yml` ist ab sofort Teil des Repos — künftige Änderungen daran (z. B. weitere Volumes) sollten wie jede andere Code-Änderung committed werden, nicht mehr direkt auf dem Mini-PC editiert.
*   Beleg-Dateien liegen ausschließlich auf dem Mini-PC-Dateisystem (kein Cloud-Storage, passend zum bestehenden `fitnesstracker`-Präzedenzfall) — kein automatisches Offsite-Backup dieser Dateien vorhanden.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Backend/Deployment) — [ ] Überprüfung erforderlich (finaler visueller Check durch den Nutzer, da 2FA den automatisierten Prod-Test blockiert)

---

### 📋 Schritt-Log: Fixkosten bearbeiten (Edit) + Bugfix in `update()`
**Zeitstempel:** `2026-08-22 22:35`

#### 1. Was wurde getan?
*   Nutzer bat um mehrere Erweiterungen (Budgets-Erklärung, Fixkosten bearbeiten, Monats-Summe, Beleg-Upload mit Auto-Löschung, "zu hoch"/"vermeidbar"-Flags) — per Rückfrage auf **Fixkosten bearbeiten** als ersten Umfang eingegrenzt; die übrigen Punkte (Flags auf Transaktionen *und* Fixkosten-Regeln, Beleg-Upload lokal auf dem Mini-PC) sind für spätere Schritte notiert, aber noch nicht umgesetzt.
*   **`RecurringTransactionsPanel.tsx`:** Bearbeiten-Flow nach dem `BudgetsPage.tsx`-Muster ergänzt — `editingId`-State, `startEdit()` befüllt das Formular aus der bestehenden Zeile (inkl. Vorzeichen-Erkennung aus `amount`), Formular-Titel/Submit-Button wechseln zwischen "Anlegen"/"Fixkosten bearbeiten"+"Speichern", neuer "Abbrechen"-Button, neuer Stift-Button in der Tabelle vor Pausieren/Löschen.
*   **Bug gefunden und behoben:** `RecurringTransactionsService.update()` reichte `dto.nextDueDate` (ein reiner Datums-String wie `"2026-09-01"`) unverändert an Prisma durch — anders als `create()`, das explizit in ein `Date`-Objekt konvertiert. Jede Bearbeitung, die `nextDueDate` änderte, schlug serverseitig mit `PrismaClientValidationError: premature end of input. Expected ISO-8601 DateTime` (HTTP 500) fehl. Beim ersten End-to-End-Test der neuen Edit-UI aufgefallen. Fix: `nextDueDate: dto.nextDueDate ? new Date(dto.nextDueDate) : undefined` in `update()`.
*   **Tests:** Zwei neue Fälle für `update()` (String→Date-Konvertierung; `nextDueDate` bleibt `undefined`/unangetastet bei einem reinen Pausieren-Update ohne das Feld). Mock-Setup um `recurringTransaction.findFirst` und `category.findFirst` erweitert (vorher nur für `runDueRecurringTransactions` ausgelegt). `npm test` (Backend, 12 Suiten/24 Tests grün).
*   **Verifiziert (echter Browser):** Testkategorie + Fixkosten-Eintrag angelegt, Stift-Button geklickt (Formular korrekt vorbefüllt inkl. Datum/Rhythmus), Beschreibung und Betrag geändert, "Speichern" — vor dem Fix: 500-Fehler, Formular blieb im Bearbeiten-Modus; nach dem Fix: Zeile aktualisiert (Beschreibung + neuer Betrag `-14,99 €` sichtbar), Formular zurückgesetzt. Test-Daten entfernt. Committed, gepusht (`c12771c`), auf dem Mini-PC gepullt, Backend+Frontend neu gebaut (keine Migration nötig, reine Code-Änderung), neuer Asset-Hash (`index-CWi56D03.js`) live bestätigt.

#### 2. Warum wurde es getan?
*   Direkter Nutzerwunsch: nach dem Anlegen ließ sich ein Fixkosten-Eintrag bisher nur pausieren oder löschen, nicht inhaltlich korrigieren (Betrag, Datum, Kategorie).

#### 3. Auswirkungen / Nebenwirkungen
*   Keine Schema-Änderung, kein Migrations-Schritt nötig — reiner Anwendungscode.
*   Offene Punkte aus der ursprünglichen Anfrage (Monats-Summe der Fixkosten, "zu hoch"/"vermeidbar"-Flags auf Transaktionen und Fixkosten-Regeln, Beleg-Upload mit 30-Tage-Auto-Löschung auf lokalem Speicher des Mini-PCs) bewusst noch nicht begonnen — warten auf den nächsten Arbeitsschritt.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Teilumfang "Fixkosten bearbeiten")

---

### 📋 Schritt-Log: Fixkosten mit echtem Fälligkeitsdatum statt reinem Tag-im-Monat
**Zeitstempel:** `2026-08-22 22:15`

#### 1. Was wurde getan?
*   **Problem:** Nutzer wies darauf hin, dass eine reine "Rhythmus"-Auswahl (Monatlich/Vierteljährlich/…) nicht ausreicht — sie legt zwar den *Abstand* fest, aber nicht den *Anker-Monat*. Konkrete Beispiele: Kfz-Steuer fällt jährlich im Oktober an, ADAC-Beitrag jährlich im August, GEZ alle 3 Monate. Mit der bisherigen `dayOfMonth` + `intervalMonths`-Logik (Fälligkeit = "X Monate seit `lastRunAt`") ließ sich der Startmonat nicht wählen — ein heute angelegter Jahres-Eintrag wäre einfach ab heute jährlich gelaufen, nicht zwingend im richtigen Monat.
*   **Modell-Umbau:** `dayOfMonth: Int` ersetzt durch `nextDueDate: DateTime` (echtes Kalenderdatum, vom Nutzer per `<input type="date">` gewählt — genau das vom Nutzer gewünschte "Kalender"-Element). `intervalMonths` bleibt bestehen für den Wiederholungsabstand. Fälligkeitsprüfung (`isDue`) jetzt: `nextDueDate <= heute` (datumsgenau, UTC-normalisiert) statt der alten Monatsdifferenz-Berechnung — holt zudem automatisch verpasste Buchungen nach, falls der Server mal einen Tag stillstand (vorher: stiller Ausfall, kein Nachholen). Nach jeder Buchung wird `nextDueDate` um `intervalMonths` weitergeschoben (`addMonths`-Helfer mit Monatsend-Clamping, z. B. 31. Januar + 1 Monat → 28. Februar statt 3. März).
*   **Zweistufige Migration** (da auf der Produktions-DB bereits 5 echte Einträge existierten — Gehalt, Miete, Kredit, Strom, Autokredit): 1) `nextDueDate` nullable ergänzt, 2) `backend/prisma/backfill-next-due-date.ts` (neu, per Raw-SQL statt typisiertem Client, damit es unabhängig vom generierten Prisma-Client-Stand läuft) berechnet für jede Zeile die nächste Wiederkehr von `dayOfMonth` ab heute, 3) `nextDueDate` NOT NULL gesetzt und `dayOfMonth` gedroppt.
*   **Frontend (`RecurringTransactionsPanel.tsx`):** "Tag im Monat"-Zahlenfeld ersetzt durch "Nächste Fälligkeit"-Datumsfeld; Tabellenspalte "Tag" → "Fälligkeit" (formatiert `de-DE`). Rhythmus-Auswahl (Monatlich…Jährlich) unverändert für den Abstand.
*   **Tests:** `recurring-transactions.service.spec.ts` komplett auf `nextDueDate` umgestellt, sieben Fälle (fällig heute + Vorschub, zukünftig noch nicht fällig, verspätetes Nachholen, Quartalsvorschub, Jahresregel im Oktober die im August nicht feuert, Jahresregel feuert im Oktober und springt auf Oktober nächsten Jahres, Monatsend-Clamping Jan→Feb). `npm run build` + `npm test` (Backend, 12 Suiten/22 Tests grün), `tsc --noEmit` (Frontend, 0 Fehler).
*   **Verifiziert (echter Browser, lokal):** Test-Kategorie "Auto" angelegt, Kfz-Steuer-Eintrag mit Fälligkeit `15.10.2026` und Rhythmus "Jährlich" über das neue Formular angelegt — per SQL bestätigt (`nextDueDate=2026-10-15`, `intervalMonths=12`), Tabelle zeigt korrekt "15.10.2026 | Jährlich | Kfz-Steuer". Test-Daten danach entfernt.
*   **Produktions-Deployment (sorgfältig sequenziert, da 5 reale Zeilen betroffen):** Migration 2 (`finalize-next-due-date`) temporär aus dem `prisma/migrations`-Ordner entfernt, Backend+Frontend gebaut, nur Migration 1 angewendet (`nextDueDate` nullable), Backfill-Skript gegen die echten Produktionsdaten ausgeführt (Gehalt→23.08., Miete/Kredit/Strom/Autokredit→01.09., alle korrekt berechnet), Migration 2 zurückgelegt, Backend **erneut** gebaut (damit das Image die finale Migration enthält), Migration 2 angewendet (lief fehlerfrei durch, da keine NULL-Werte mehr vorhanden) — alle 5 Einträge samt korrektem `nextDueDate` erhalten, kein Datenverlust. Live unter `https://finance.pwa-tree.de` verifiziert (neuer Asset-Hash `index-Dvcj01H_.js`).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag/Bug-Report: die feste 5-Optionen-Auswahl aus dem vorherigen Schritt konnte den Anker-Monat für jährliche/quartalsweise Zahlungen nicht abbilden.

#### 3. Auswirkungen / Nebenwirkungen
*   Die API akzeptiert jetzt `nextDueDate` (ISO-Datum) statt `dayOfMonth` beim Anlegen/Ändern — ein reiner Breaking Change auf API-Ebene, aber unkritisch, da es sich um eine Single-User-App ohne weitere Clients handelt.
*   `runDueRecurringTransactions` holt ab jetzt auch überfällige (verpasste) Buchungen nach, statt sie stillschweigend zu überspringen — bewusste Verhaltensänderung, siehe Punkt 1.
*   `backend/prisma/backfill-next-due-date.ts` bleibt als einmaliges Migrations-Skript im Repo (analog zu den SQL-Migrationsdateien selbst) — hat nach diesem Deployment keinen weiteren Verwendungszweck mehr.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Nicht-monatliche wiederkehrende Buchungen (z. B. GEZ vierteljährlich)
**Zeitstempel:** `2026-08-22 22:05`

#### 1. Was wurde getan?
*   **Problem:** Nutzer meldete, dass Fixkosten/wiederkehrende Buchungen nur monatlich abgebildet werden können — Beispiel GEZ, die vierteljährlich abgebucht wird.
*   **`backend/prisma/schema.prisma`:** `RecurringTransaction` um `intervalMonths Int @default(1)` erweitert (Default `1` erhält das bisherige monatliche Verhalten für alle Bestandsdaten). Migration `20260822192428_add_recurring_interval_months` erstellt.
*   **`recurring-transactions.service.ts` — `isDueToday()`:** Statt nur "anderer Kalendermonat als `lastRunAt`" wird jetzt geprüft, ob `(heute.Jahr*12+heute.Monat) - (lastRunAt.Jahr*12+lastRunAt.Monat) >= intervalMonths` — verallgemeinert die bisherige Logik exakt (bei `intervalMonths=1` identisches Verhalten) und deckt beliebige Vielfache ab (2, 3, 6, 12, …).
*   **`create-recurring-transaction.dto.ts`:** optionales `intervalMonths` (1–24) ergänzt, Default weiterhin `1` im Service.
*   **Frontend (`RecurringTransactionsPanel.tsx`):** Neues "Rhythmus"-Auswahlfeld beim Anlegen (Monatlich/Alle 2 Monate/Vierteljährlich/Halbjährlich/Jährlich) sowie neue Tabellenspalte "Rhythmus" in der Liste. `frontend/src/lib/api/types.ts`/`recurringTransactions.ts` um das Feld ergänzt.
*   **Tests:** Zwei neue Fälle in `recurring-transactions.service.spec.ts` (Vierteljährlich-Regel wird nach 2 Monaten übersprungen, nach 3 Monaten korrekt erneut gebucht), bestehende Mocks um `intervalMonths` ergänzt. `npm run build` + `npm test` (Backend, 12 Suiten/21 Tests grün).
*   **Verifiziert (echter Browser):** Lokal eingeloggt, Test-Kategorie "Rundfunk" angelegt, GEZ-Eintrag (55,25 €, Tag 15, Vierteljährlich) über das neue Formular angelegt — per SQL-Check bestätigt (`intervalMonths=3` korrekt persistiert), Tabelle zeigt "Vierteljährlich" korrekt an. Test-Daten danach aus der lokalen Dev-DB entfernt. Committed, gepusht (`976acee`), auf dem Mini-PC gepullt, Backend **und** Frontend neu gebaut, `prisma migrate deploy` in Produktion ausgeführt (Migration erfolgreich angewendet, Backend danach fehlerfrei neu gestartet), neuer Frontend-Asset-Hash (`index-DM6PZ6Yk.js`) auf `https://finance.pwa-tree.de` bestätigt.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag/Bug-Report nach dem Versuch, GEZ als Fixkosten-Eintrag anzulegen.

#### 3. Auswirkungen / Nebenwirkungen
*   Bestehende wiederkehrende Buchungen (aktuell keine in Produktion vorhanden) laufen durch den Migrations-Default (`intervalMonths=1`) unverändert monatlich weiter.
*   Kein Datenverlust, keine Downtime — Migration ist rein additiv (neue Spalte mit Default).

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Kategorien-Verwaltung im Frontend nachgerüstet
**Zeitstempel:** `2026-08-22 20:25`

#### 1. Was wurde getan?
*   **Problem:** Nutzer meldete, dass die Kategorie-Auswahl (z. B. beim Hinzufügen einer Transaktion) leer ist und sich keine Kategorien anlegen lassen. Analyse ergab: Das Backend hat seit Phase 3 volles CRUD unter `/categories`, aber es existierte **nie** eine Frontend-Seite oder -Komponente dafür — weder eine eigene Route noch ein Panel in den Einstellungen. Der Seed-Skript legt zudem bewusst nur den User an, keine Default-Kategorien (`backend/prisma/seed.ts` geprüft).
*   **`frontend/src/components/settings/CategoryManager.tsx`** (neu): Liste + Anlegen-Formular (Name) + Löschen, nach exakt demselben Muster wie `RecurringTransactionsPanel.tsx` (gleiche Lade-/Fehler-States, gleiches Karten-Layout). Löschen fängt Backend-Fehler ab (Kategorie hat `onDelete: Restrict` zu `Transaction`/`Budget` im Schema, kein `onDelete: Cascade` wie bei `CategoryRule`) und zeigt eine verständliche Meldung statt eines unbehandelten Fehlers, falls die Kategorie noch verwendet wird.
*   **`frontend/src/pages/SettingsPage.tsx`:** `CategoryManager` zwischen TOTP und `RecurringTransactionsPanel` eingehängt (Kategorien müssen vor Fixkosten existieren, daher diese Reihenfolge).
*   **Verifiziert (echter Browser):** Lokalen Dev-Stack erneut hochgefahren (Postgres/Redis liefen noch aus dem letzten Schritt, Backend/Frontend neu gestartet), per Playwright bei 375px eingeloggt, in den Einstellungen eine Test-Kategorie ("Lebensmittel") angelegt, deren sofortiges Erscheinen im Kategorie-Dropdown der Quick-Add-Seite (`/add`) bestätigt — belegt, dass keine separate Caching-Schicht dazwischenhängt. Test-Kategorie danach direkt per `psql` aus der lokalen Dev-DB entfernt. Danach committed, gepusht (`a65f693`), auf dem Mini-PC gepullt, `frontend`-Image neu gebaut (neuer Asset-Hash `index-B-oOhwuH.js`), und derselbe Check **gegen die echte Produktions-URL** mit dem echten Login wiederholt — Kategorien-Panel korrekt sichtbar, keine Konsolenfehler.

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag/Bug-Report: "kategorie is empty? i can't add them manually".

#### 3. Auswirkungen / Nebenwirkungen
*   Keine neue Backend-Änderung nötig — die API existierte bereits vollständig, es fehlte ausschließlich die UI.
*   Auf der Produktions-DB (Mini-PC) existiert weiterhin keine einzige Kategorie — der Nutzer muss nach diesem Deployment mindestens eine über `/settings` anlegen, bevor Quick-Add, Budgets oder wiederkehrende Buchungen nutzbar sind.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Mobile Navigation überarbeitet (Hamburger-Dropdown statt Zeile)
**Zeitstempel:** `2026-08-22 19:50`

#### 1. Was wurde getan?
*   **Problem:** Nutzer meldete, dass die vier horizontalen Nav-Links (Dashboard/Budgets/Hinzufügen/Einstellungen) zusammen mit Titel und dem rechten Icon-Cluster (Sync-Badge, Dark-Mode, Logout) auf schmalen Mobile-Breiten aus dem sichtbaren Bereich nach rechts herausgedrängt wurden. Zusätzlich überlappte der Header auf manchen Geräten mit der Status-Bar/Notch (Uhrzeit).
*   **`frontend/src/components/layout/AppShell.tsx`:** Horizontale `<nav>`-Leiste entfernt, ersetzt durch einen einzelnen Button oben links ("Finance Menü", umbenannt von reinem "Finanz-PWA"-Text, mit `Menu`-Icon aus `lucide-react`), der ein Dropdown mit den vier bisherigen `NavLink`s öffnet/schließt. Schließt automatisch bei Routenwechsel (`useLocation`), Klick außerhalb (`mousedown`-Listener + `ref`) und `Escape`. Rechter Icon-Cluster (Sync-Badge/Dark-Mode/Logout) unverändert, hat jetzt aber sichtbar mehr Platz.
*   **`frontend/index.html`:** `viewport-fit=cover` zum `viewport`-Meta-Tag ergänzt — Voraussetzung dafür, dass `env(safe-area-inset-top)` auf iOS/Android überhaupt einen Wert ungleich 0 liefert.
*   **`AppShell.tsx`-Header:** `style={{ paddingTop: 'env(safe-area-inset-top)' }}` ergänzt, damit der Header auf Geräten mit Notch/Statusleiste (v. a. als installierte PWA im Standalone-Modus) nicht mehr darunter verschwindet.
*   **Verifiziert (echter Browser, nicht nur Build):** Lokalen Dev-Stack aufgesetzt (Postgres/Redis via `docker compose up -d postgres redis`, Backend via `npm run start:dev`, Frontend via `npm run dev`, jeweils frisches `backend/.env`/`frontend/.env` für lokale Entwicklung angelegt, Migrationen + Seed liefen erstmals gegen diese lokale DB). Da `chromium-cli` und `playwright install --with-deps` in dieser Umgebung nicht verfügbar sind (kein passwortloses `sudo`), fehlende Shared Libraries (`libnspr4`, `libnss3`, `libatk*`, `libxkbcommon0`, `libasound2`, `libatspi2.0-0`) einzeln per `apt-get download` (kein Root nötig) geladen, in ein Scratch-Verzeichnis entpackt und per `LD_LIBRARY_PATH` verfügbar gemacht — danach lief `playwright`s Chromium headless ohne Root. Per Skript bei 375px-Viewport eingeloggt, Menü-Button geklickt, Dropdown-Inhalt (alle vier Links vorhanden) und Screenshot geprüft — Layout wie gewünscht, kein horizontaler Overflow. Danach identischer Test **gegen die echte Produktions-URL** (`https://finance.pwa-tree.de`) mit dem echten Seed-Login wiederholt — gleiches Ergebnis, keine unerwarteten Konsolenfehler (nur der normale 401 des anonymen `/auth/me`-Checks vor dem Login).
*   Nach dem Test: lokale Dev-Server (Backend/Frontend) gestoppt; lokale Postgres/Redis-Container laufen weiter (für zukünftige lokale Entwicklung).

#### 2. Warum wurde es getan?
*   Direkter Nutzerauftrag nach Sichtung der App auf dem eigenen Handy unter der neuen Produktions-URL.

#### 3. Auswirkungen / Nebenwirkungen
*   `backend/.env` und `frontend/.env` existieren jetzt erstmals auch im lokalen WSL-Klon (zuvor nur auf dem Mini-PC bzw. gar nicht) — beide `.gitignore`t, enthalten harmlose lokale Dev-Werte (kein Bezug zu den Produktions-Secrets auf dem Mini-PC).
*   Änderung committed und gepusht (`9c27e8c`), auf dem Mini-PC gepullt (dabei die dortigen, inhaltsgleichen uncommitteten Vorarbeiten aus dem letzten Schritt verworfen, siehe vorheriger Log-Eintrag) und die `frontend`-Produktions-Image neu gebaut/neu gestartet. Live unter `https://finance.pwa-tree.de` verifiziert (neuer Asset-Hash `index-s5elQrQH.js` bestätigt den frischen Build).
*   `navLinkClass` liefert jetzt `w-full`-Blockelemente statt Inline-Pills — nur innerhalb des Dropdowns verwendet, keine anderweitigen Verwendungsstellen betroffen.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen

---

### 📋 Schritt-Log: Produktions-Deployment auf Mini-PC (finance.pwa-tree.de) — Vorbereitung Phase 8
**Zeitstempel:** `2026-08-22 18:35`

#### 1. Was wurde getan?
*   **Mini-PC-Zugang eingerichtet:** Dediziertes SSH-Schlüsselpaar (`~/.ssh/mini-pc-claude` lokal, Alias `minipc`) für den vom Nutzer angelegten `claude`-User auf `192.168.178.151` (Hostname `pwa01`) generiert und autorisiert.
*   **Bestehende Infrastruktur analysiert:** Der Mini-PC hostet bereits `fitnesstracker` hinter einem gemeinsamen Cloudflare-Tunnel (`edge`-Docker-Netzwerk, Projekt `edge` mit einzelnem `cloudflared`-Container). Kein Host-Port wird je veröffentlicht — Routing erfolgt ausschließlich über Docker-Containernamen, die Cloudflare-Zuordnung `Hostname → Containername:Port` liegt im Cloudflare-Zero-Trust-Dashboard (nicht im Repo). Jede App bekommt einen eigenen, read-only GitHub-Deploy-Key (`~/.ssh/id_ed25519_github_<app>` + passender `Host`-Alias in `~/.ssh/config`).
*   **Gleiches Muster für `finanzplaner` repliziert:** Deploy-Key `id_ed25519_github_finanzplaner` erzeugt (vom Nutzer als Deploy-Key auf GitHub hinterlegt), Repo nach `~/finanzplaner` auf dem Mini-PC geklont.
*   **`backend/Dockerfile`-Bug gefunden und behoben** (in beiden Repos — lokaler WSL-Klon und Mini-PC-Klon): Die Runner-Stage kopierte bisher nur `dist/` und `node_modules/`, nicht aber `prisma/` (Schema + Migrations) und `prisma.config.ts`. Dadurch konnte `npx prisma migrate deploy` im laufenden Container nicht ausgeführt werden ("Could not find Prisma Schema"). Fix: `COPY --from=builder /app/prisma ./prisma` und `COPY --from=builder /app/prisma.config.ts ./prisma.config.ts` in der Runner-Stage ergänzt.
*   **`docker-compose.prod.yml`** (neu, Mini-PC only, nicht im lokalen Dev-Setup) nach dem `fitnesstracker`-Muster erstellt: `postgres` + `redis` + `backend` ohne veröffentlichte Host-Ports (nur intern erreichbar), `frontend` (bestehendes Nginx-Image, das bereits seit Phase 6 `/api/*` zu `backend:3000` proxied) als `finanzplaner-frontend` zusätzlich im `edge`-Netzwerk — kein separater Caddy-Container nötig, da Nginx die Aufgabe schon übernimmt.
*   **Produktions-Secrets generiert** (nicht mit lokalen Dev-Werten geteilt): `POSTGRES_PASSWORD`, `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`, `SEED_USER_PASSWORD` — alle per `openssl rand` direkt auf dem Mini-PC erzeugt, in `.env`/`backend/.env` (chmod 600) abgelegt, nie im Klartext committed.
*   **`WEBAUTHN_ORIGIN`/`WEBAUTHN_RP_ID`** (offener Punkt aus dem Phase-6-Log) jetzt korrekt auf `https://finance.pwa-tree.de` gesetzt, `COOKIE_SECURE=true`. `frontend/.env.production` mit `VITE_API_URL=/api` ergänzt (Build-Zeit-Konfiguration für den produktiven Vite-Build).
*   Stack gestartet (`docker compose -f docker-compose.prod.yml up -d`), Migrationen angewendet (`npx prisma migrate deploy` — beide bestehenden Migrationen erfolgreich angewendet), Seed-User über den kompilierten Seed (`node dist/prisma/seed.js`, da `ts-node` gegen die nicht mitkopierte Quell-`generated/prisma`-Directory fehlschlägt) angelegt.
*   Verifiziert: Alle vier Container laufen (`postgres` healthy, `redis`, `backend`, `frontend`). Backend-Boot-Log fehlerfrei, alle Routen gemappt. Von einem temporären Container im `edge`-Netzwerk aus (simuliert exakt den Zugriffsweg von `cloudflared`) `http://finanzplaner-frontend:80/` → `200`, `http://finanzplaner-frontend:80/api/auth/me` → echtes `401 Unauthorized` (JSON vom Backend, nicht die SPA-Fallback-HTML) mit korrektem `Access-Control-Allow-Origin: https://finance.pwa-tree.de`.

#### 2. Warum wurde es getan?
*   Nutzer wollte die Domain `finance.pwa-tree.de` (bestehende Domain `pwa-tree.de`, bestehender Cloudflare-Tunnel) für den produktiven Betrieb von finanzplaner in Betrieb nehmen, parallel zum bereits laufenden `fitnesstracker` auf demselben Mini-PC. Damit wird auch der in Phase 6 offen gelassene `WEBAUTHN_ORIGIN`-Platzhalter aufgelöst und ein Teil von Phase 8 ("Docker-Compose für Produktion optimieren") vorweggenommen.

#### 3. Auswirkungen / Nebenwirkungen
*   **Noch ausstehend (Nutzer-Aktion, kein Cloudflare-API-Zugriff vorhanden):** Im Cloudflare-Zero-Trust-Dashboard unter dem bestehenden Tunnel einen Public-Hostname-Eintrag `finance.pwa-tree.de → HTTP://finanzplaner-frontend:80` anlegen (erzeugt automatisch den DNS-Eintrag). Erst danach ist die App unter der echten Domain erreichbar.
*   Der `backend/Dockerfile`-Fix wurde bisher **nur lokal (WSL-Klon) und auf dem Mini-PC** angewendet, **nicht committed/gepusht** — das Repo auf GitHub hat den Bug weiterhin. Sollte bei Gelegenheit committed werden, sonst bricht das nächste `git pull` + Rebuild auf dem Mini-PC (oder ein Neuklon) die Migrationsfähigkeit erneut.
*   Seed-Passwort (`SEED_USER_PASSWORD`) wurde dem Nutzer im Chat mitgeteilt, nicht in einer Datei außerhalb von `backend/.env` (chmod 600, nicht im Git) gespeichert — sollte nach erstem Login geändert und durch einen Passkey ersetzt werden.
*   `frontend/.env.production` (`VITE_API_URL=/api`) existiert bisher nur auf dem Mini-PC, nicht im Repo — ohne diese Datei würde ein zukünftiger Rebuild auf einem frischen Klon wieder mit der lokalen Dev-URL bauen. Sollte ebenfalls ins Repo übernommen werden (oder als Doku ergänzt), analog zum offenen Dockerfile-Fix.

#### 4. Status der Aufgabe
*   [x] Abgeschlossen (Mini-PC-seitig) — [ ] Überprüfung erforderlich (Cloudflare Public Hostname durch Nutzer, Dockerfile-Fix + `frontend/.env.production` noch nicht ins Repo übernommen)

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
