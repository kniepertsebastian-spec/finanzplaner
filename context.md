# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Nutzer bat darum, Phase 12 (UI/UX Redesign) und Phase 13 (Auswertungen, Tags & PWA-Power-Features) der Roadmap fertigzustellen, bevor Phase 7 (Datenexport/DSGVO/Unit-Tests, explizit ans Ende verschoben) angegangen wird. Diese Session arbeitet die verbleibenden Punkte beider Phasen einzeln als Teilscheiben ab (gleiches Muster wie die gesamte bisherige Session: implementieren → verifizieren → dokumentieren → committen → pushen, pro Feature).

## Aktueller Stand

- **Erste Teilscheibe dieser Runde: Privacy-Mode (Blickschutz)** — vollständig implementiert, verifiziert, committed, gepusht.
  - Kein Backend-Code betroffen, keine Migration.
  - Frontend: `npx tsc --noEmit` und `npm run build` fehlerfrei, Blur-Effekt visuell per Playwright-Screenshot geprüft.
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session) — wie der gesamte Rest dieser Session.

## Offene TODOs — Reihenfolge für den Rest dieser Session

Verbleibend aus Phase 12:
1. **Moderne Chart-Ästhetik:** Bézier-Kurven (`tension: 0.4`), transparente Farbverläufe, Donut-Chart für Kategorie-Anteile, gestrichelte Prognoselinie. Betrifft `IncomeExpenseChart.tsx`/`CashflowChart.tsx`, evtl. neue Donut-Komponente.
2. **Pill-Progress-Bars & Category Badges:** abgerundete Budgetbalken mit Ampel-Farbübergängen (`BudgetProgressBar.tsx` hat schon abgerundete Balken — ggf. nur Feinschliff) und pastellfarbene Icon-Badges pro Kategorie (Kategorien haben aktuell kein Icon-/Farbfeld — würde eine Migration brauchen, falls dauerhaft gespeichert statt clientseitig aus dem Namen abgeleitet).
3. **Micro-Interactions:** Zähl-Animationen für Beträge, Skeleton-Loader mit Shimmer-Effekt, Transaktions-Gruppierung nach Datumsblöcken (Heute/Gestern). Reine Frontend-Aufgabe.

Verbleibend aus Phase 13:
4. **Sankey-Geldflussdiagramm** — größter Einzelposten, keine Chart.js-Sankey-Fähigkeit im Projekt, braucht eigenen Ansatz (SVG von Hand oder neue Bibliothek).
5. **Projektbezogene Tags** (`#Urlaub2026` etc.) — braucht neues Datenmodell (Migration).
6. **Steuer-Marker** — Flag + gefilterter Jahres-Export samt Belegen (Export-Teil ggf. mit Phase 7 überschneidend, aber laut Roadmap hier als eigener, engerer Scope gemeint — nur steuerrelevante Buchungen).
7. **Web Push Notifications** — braucht VAPID-Keys/Push-Subscription-Backend, größerer technischer Umfang.
8. **App Shortcuts** — kleinster Punkt, reine Web-Manifest-Erweiterung, kein neuer Code.
9. **Batch-Bearbeitung** in der Transaktionsliste — Mehrfachauswahl + Massenbearbeitung/-löschung.

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
