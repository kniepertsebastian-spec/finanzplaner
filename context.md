# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Nutzer bat darum, Phase 12 (UI/UX Redesign) und Phase 13 (Auswertungen, Tags & PWA-Power-Features) der Roadmap fertigzustellen, bevor Phase 7 (Datenexport/DSGVO/Unit-Tests, explizit ans Ende verschoben) angegangen wird. Diese Session arbeitet die verbleibenden Punkte beider Phasen einzeln als Teilscheiben ab (gleiches Muster wie die gesamte bisherige Session: implementieren → verifizieren → dokumentieren → committen → pushen, pro Feature).

## Aktueller Stand

- **Phase 12 (UI/UX Redesign & Modernes Dashboard) ist vollständig abgeschlossen:** Privacy-Mode (Blickschutz), Moderne Chart-Ästhetik (Bézier-Kurven, Farbverläufe, Donut-Chart, gestrichelte Prognoselinie), Kategorie-Icon-Badges, Micro-Interactions (Zähl-Animationen, Skeleton-Loader mit Shimmer, Datumsgruppierung "Heute"/"Gestern") — alle fünf Teilscheiben implementiert, verifiziert, committed, gepusht.
  - Kein Backend-Code betroffen, keine Migration in allen fünf Teilscheiben.
  - Frontend: `npx tsc --noEmit` und `npm run build` jeweils fehlerfrei. Chart-Ästhetik, Privacy-Mode und Micro-Interactions zusätzlich visuell per Playwright-Screenshots geprüft (eigenständige HTML-Datei, da React-Komponenten nicht trivial isoliert testbar sind); Icon-Badges nur über Build/Typecheck verifiziert (triviale, rein deklarative Komponente — Span mit bereits im Projekt etablierten Tailwind-Pastellklassen).
- **Aus Phase 13 bereits erledigt:**
  - App Shortcuts (`vite.config.ts`, `shortcuts`-Array im PWA-Manifest — "Neue Buchung"/"Transaktionen"/"Budgets"). Keine Migration, kein Backend betroffen.
  - Batch-Bearbeitung in der Transaktionsliste (Mehrfachauswahl per Checkbox + Toolbar für Massen-Kategorieänderung/-Flags/-Löschung). Backend: neue `POST /transactions/bulk-delete`/`bulk-update`-Endpunkte, immer zusätzlich nach `userId` gefiltert. Keine Migration.
  - Projektbezogene Tags (`#Urlaub2026` etc.) — neues `tags String[]`-Feld direkt am `Transaction`-Modell (kein eigenes Tag-Modell), editierbar im Bearbeiten-Formular, Filter-Chip-Leiste über der Transaktionsliste mit Summenanzeige für den gefilterten Tag. Migration `20260825050000_add_transaction_tags`.
  - Steuer-Marker & Jahres-Export — viertes Flag `taxRelevant` (wie `avoidable`/`inefficient`/`tooExpensive`), auch per Batch-Bearbeitung setzbar. Neuer `GET /transactions/tax-export?year=`-Endpunkt streamt eine ZIP mit CSV der steuerrelevanten Buchungen + allen im selben Jahr hochgeladenen Belegen (neue Abhängigkeit `archiver@7`, bewusst nicht v8 — siehe Log, v8 ist ESM-only und passt nicht zum `module: commonjs`-Setup). Migration `20260825060000_add_tax_relevant`.
  - **⚠️ Zwei neue Migrationen ausstehend** (`add_transaction_tags`, `add_tax_relevant`) — müssen beim nächsten Deploy per `prisma migrate deploy` angewendet werden, sonst schlagen Buchungen mit Tags bzw. das Steuerrelevant-Flag fehl (Felder existieren dann im Prisma-Client, aber nicht in der DB-Tabelle).
  - Alle vier committed & gepusht. Backend-Testsuite komplett grün (68/68).
- **Nächster Schritt:** mit dem nächsten Phase-13-Punkt weitermachen (Web Push Notifications), siehe TODO-Liste unten.
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session) — wie der gesamte Rest dieser Session.

## Offene TODOs — Reihenfolge für den Rest dieser Session

Phase 12 ist komplett abgeschlossen. Aus Phase 13 bereits erledigt: App Shortcuts, Batch-Bearbeitung, Projektbezogene Tags, Steuer-Marker & Jahres-Export. Verbleibend aus Phase 13 (Reihenfolge: kleinster/einfachster Punkt zuerst):
1. **Web Push Notifications** — braucht VAPID-Keys/Push-Subscription-Backend, größerer technischer Umfang.
2. **Sankey-Geldflussdiagramm** — größter Einzelposten, keine Chart.js-Sankey-Fähigkeit im Projekt, braucht eigenen Ansatz (SVG von Hand oder neue Bibliothek).

Damit ist Phase 13 danach ebenfalls abgeschlossen — anschließend laut Nutzerauftrag: CSV-Import (Phase-11-Rest, wartet auf das echte Bank-CSV-Format des Nutzers) und zuletzt Phase 7.

Nach jedem einzelnen Punkt: Doku (`features.md`, `doku/LOG_DOKUMENTATION.md`, dieses `context.md`) aktualisieren, committen, auf `claude/remote-control-finanzplaner-gbmdlb` **und** `main` pushen (etabliertes Muster dieser Session — Nutzer nutzt `main` für den Mini-PC-Pull).

## Deployment (gilt für den gesamten noch ausstehenden Rückstand dieser Session)

```
git pull
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d backend frontend
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

Weiterhin ausstehend aus vorherigen Sessions (unverändert):
- Nutzer muss "Miete"/"Kredit" manuell auf "Ausgabe" korrigieren (früherer Vorzeichen-Bug).
- Nutzer muss danach den Gesamtsaldo per "Saldo abgleichen" korrigieren.
- Nach dem nächsten Deploy: erster Cron-Lauf bucht ggf. mehrere Fixkosten auf einmal (neues, gewolltes Verhalten aus der letzten Teilscheibe).

## Relevante Dateien/Pfade (Privacy-Mode)

- `frontend/src/context/PrivacyModeContext.tsx` — neu.
- `frontend/src/components/Amount.tsx` — neu, zentraler Wrapper um `formatCents()` mit Blur.
- `frontend/src/components/StatTile.tsx` — `sensitive?: boolean`-Prop (Default `true`), blurt intern.
- `frontend/src/components/layout/AppShell.tsx` — Header-Toggle (Eye/EyeOff-Icon).
- `frontend/src/main.tsx` — `PrivacyModeProvider` eingehängt.
- Umgestellt auf `<Amount>`: `HeroCard.tsx`, `BudgetProgressBar.tsx`, `BalanceSettings.tsx`, `TransactionsPage.tsx`, `BudgetsPage.tsx`, `SavingsPotsPanel.tsx`, `RecurringTransactionsPanel.tsx`, `DashboardPage.tsx`.
- **Bewusst nicht abgedeckt** (technische Grenzen): Chart.js-Tooltips/Achsen (Canvas), native `title`-Attribute, `HeroCard`s `availableIncomeCaption`-String-Prop.

## Entscheidungen & Begründungen (Privacy-Mode)

- **`StatTile` direkt privacy-fähig gemacht statt jeden Aufrufer umzustellen** — deckt die meisten Dashboard-Kacheln automatisch ab, ein einziger Opt-out (`sensitive={false}`) für die einzige Nicht-Geld-Kachel (Sparquote).
- **`filter: blur()` (Tailwind `blur-sm`), nicht `backdrop-blur`** — trotz Roadmap-Wortlaut "backdrop-blur" ist das technisch das falsche CSS-Feature (blurt nur, was hinter einem halbtransparenten Element liegt, nicht dessen eigenen Text) — als Terminologie-Ungenauigkeit im Roadmap-Text gewertet, korrekt mit `filter: blur()` umgesetzt.
- **Kein Versuch, Chart-Tooltips oder native `title`-Attribute zu verwischen** — technisch nicht mit CSS erreichbar (Canvas-Rendering bzw. Browser-natives UI-Element), als bewusste, dokumentierte Grenze akzeptiert statt unnötig komplexer Workarounds (z. B. eigene HTML-Tooltip-Implementierung nur für diesen Zweck).

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hat weiterhin weder Docker-Daemon noch SSH-Zugang** — Verifikation läuft über `tsc`/`vite build`/`npm test` plus isolierten Playwright-Screenshots, nicht über einen echten Login/Dashboard-Aufruf.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben.
