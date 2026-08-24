# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um OCR-Belegscan und einen Fremdwährungs-Umrechner erweitern — zweite und dritte Teilscheibe von Roadmap-Phase 11, nach Split-Transaktionen (Teilscheibe 1). Auf ausdrücklichen Nutzerwunsch vor dem CSV-Import priorisiert.

## Aktueller Stand

- **Split-Transaktionen (vorherige Teilscheibe) sind noch nicht deployed** — siehe unten, gilt weiterhin.
- Diese Teilscheibe (OCR + Umrechner) vollständig implementiert und lokal verifiziert:
  - Kein Backend-Code betroffen — beide Features sind rein Frontend, keine neue Migration.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei (nur die bekannte, unkritische Vite-Chunk-Size-Warnung).
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session).
- Neue Abhängigkeit: `tesseract.js` (^7.0.0) im Frontend (`package.json`/`package-lock.json` aktualisiert) — rein clientseitig, kein Backend-Package.

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus** — jetzt inkl. der Split-Transaktionen-Migration von der vorherigen Teilscheibe:
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. Visueller Check durch den Nutzer nach dem Deployment, **besonders wichtig bei OCR** (in dieser Session nicht mit einem echten Beleg-Foto testbar, nur durch Code-Review verifiziert):
   - Quick Add → "🌍 Fremdwährung" → Währung wählen, Betrag + Kurs eintragen → "In Betrag (€) übernehmen" prüft die Umrechnung, gemerkter Kurs bei erneutem Öffnen derselben Währung.
   - Quick Add → "📷 Beleg scannen" → echtes Kassenbon-Foto auswählen → Fortschrittsanzeige, danach Betrag/Datum/Beschreibung/Kategorie-Vorschlag prüfen. Erwartung: nicht perfekt, aber brauchbarer Ausgangspunkt zum manuellen Nachbessern — bei Bedarf die Heuristiken in `frontend/src/lib/receiptParse.ts` anhand echter Belege nachschärfen.
3. Rest von Phase 11: **CSV-Transaktions-Import** — braucht vermutlich Input vom Nutzer (welches Bank-CSV-Format liegt tatsächlich vor: Spalten, Datumsformat, Dezimaltrennzeichen), bevor ein sinnvoller Spalten-Mapper gebaut werden kann. Duplikaterkennung via Content-Hash braucht vermutlich ein neues Feld auf `Transaction` (z. B. `importHash`). Mit dem Nutzer klären, sobald er möchte.
4. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten fünf Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `frontend/src/lib/currency.ts` — neu: `COMMON_CURRENCIES`, `convertForeignToEuroCents()`, `getRememberedRate()`/`rememberRate()` (localStorage).
- `frontend/src/lib/ocr.ts` — neu: `recognizeReceiptText()`, dünner `tesseract.js`-Wrapper (deutsches Sprachmodell).
- `frontend/src/lib/receiptParse.ts` — neu: `parseReceiptText()`, Regex-Heuristiken für Betrag/Datum/Händler (gleiches Muster wie `voiceParse.ts`).
- `frontend/src/pages/QuickAddPage.tsx` — neuer Fremdwährungs-Umrechner-Bereich unter dem Betragsfeld, neuer "Beleg scannen"-Button neben dem Mikrofon-Button.
- `frontend/package.json`/`package-lock.json` — `tesseract.js` als neue Abhängigkeit.

## Entscheidungen & Begründungen

- **Kein Live-Wechselkurs über eine externe API** — der Nutzer trägt den Kurs manuell ein. Passend zum bisherigen "kein Bank-Pull/keine externen Live-Abhängigkeiten"-Prinzip der App und vermeidet API-Key-Verwaltung/Rate-Limits/Ausfallrisiko einer dritten Partei für ein Feature, das nur bei Reisen gelegentlich gebraucht wird.
- **OCR läuft vollständig clientseitig** (`tesseract.js` im Browser), nicht serverseitig — kein neuer Backend-Endpunkt, keine neue Backend-Abhängigkeit, das Belegfoto verlässt für diesen Schritt nie das Gerät des Nutzers. Passend zur Roadmap-Formulierung "Client- oder Worker-basierte Texterkennung".
- **OCR-Belegscan bewusst NICHT an den bestehenden Invoice-Upload gekoppelt** (`backend/src/invoices/`) — das ist Belegarchivierung (30-Tage-Aufbewahrung), OCR-Belegscan hier ist reine Vorbefüllung für die manuelle Erfassung in Quick Add. Beide Features bleiben unabhängig nutzbar; der Nutzer kann denselben Beleg bei Bedarf zusätzlich separat unter *Rechnungen* hochladen.
- **Kein Auto-Submit nach OCR** — exakt dieselbe Sicherheitsnetz-Logik wie bei der bestehenden Spracheingabe: Vorbefüllen, aber der Nutzer prüft/korrigiert immer vor dem Speichern, da die Erkennung nur eine Heuristik ist.
- **Reihenfolge:** Fremdwährungs-Umrechner zuerst umgesetzt (kleinerer, unabhängiger Baustein, kein neues Package), danach OCR (größerer Umfang, neue Abhängigkeit).

## Bekannte Fallstricke / Gotchas

- **OCR braucht eine Online-Verbindung des Endgeräts beim ersten Einsatz** — `tesseract.js` lädt WASM-Core + deutsches Sprachmodell von einem CDN nach, nicht im PWA-Service-Worker vorgecacht (bewusst außerhalb des Scopes gelassen, siehe `doku/LOG_DOKUMENTATION.md`). Kein Blocker für den Normalbetrieb (App ist für Offline-*Buchungserfassung* ausgelegt, nicht Offline-OCR), aber beim Testen relevant.
- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang** — Verifikation lief über lokales `npm install` statt `docker build`.
- **Vier additive Migrationen liegen inzwischen aufeinander** seit Beginn von Phase 10 (noch keine davon auf dem Mini-PC seit der Split-Transaktionen-Teilscheibe deployed): `add_savings_pots`, `add_contract_metadata`, `add_previous_amount`, `add_split_group_id` — alle nullable/additiv, kein Datenverlust-Risiko, aber `prisma migrate deploy` muss nach dem nächsten Pull erneut laufen.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
