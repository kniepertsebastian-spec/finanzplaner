# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Finanz-PWA (Single-User React/NestJS/Postgres-App, produktiv auf `https://finance.pwa-tree.de`) um eine Hero-Card mit Mesh-Gradient auf dem Dashboard erweitern — erste Teilscheibe von Roadmap-Phase 12 (UI/UX Redesign & Modernes Dashboard). Auf Nutzerwunsch vor der Fortsetzung von Phase 11 (CSV-Import, braucht noch Nutzer-Input zum Bank-CSV-Format) begonnen.

## Aktueller Stand

- Feature vollständig implementiert und lokal verifiziert:
  - Kein Backend-Code betroffen — rein visuelle Frontend-Änderung, keine neue Migration.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei (nur die bekannte, unkritische Vite-Chunk-Size-Warnung).
  - Visuell verifiziert per isoliertem HTML-Nachbau + Playwright-Screenshot (kein laufender Dashboard-Stack in dieser Session verfügbar, siehe unten) — Kontrast und Farbverlauf in Hell- und Dunkelmodus geprüft.
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session). Zusätzlich stehen noch die Migrationen aus den vorherigen Teilscheiben (Split-Transaktionen etc.) aus, falls der letzte Deploy-Zyklus des Nutzers das noch nicht abgedeckt hat — im Zweifel `git log`/`prisma migrate status` auf dem Mini-PC prüfen.

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus:**
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. **Echter visueller Check durch den Nutzer ist hier besonders wichtig** — diese Session konnte die Hero-Card nur isoliert (exaktes CSS-Markup nachgebaut, nicht im echten Dashboard-Kontext mit echtem Login) per Playwright-Screenshot prüfen, nicht im tatsächlich laufenden Dashboard mit echten Daten und dem restlichen Seiten-Layout drumherum.
3. Rest von Phase 12 (noch nicht begonnen):
   - **Privacy-Mode (Blickschutz):** globaler Toggle im Header zum Verwischen (`backdrop-blur`) sensibler Beträge — betrifft `AppShell.tsx` (Header) + vermutlich einen neuen Context nach dem Muster von `DarkModeContext.tsx`, dazu eine CSS-Klasse, die auf alle Betrags-Anzeigen angewendet wird (Hero-Card, StatTiles, Transaktionsliste, Budgets, …) — vermutlich der aufwändigste Punkt, da er quer durch viele Komponenten gezogen werden muss.
   - **Moderne Chart-Ästhetik:** Bézier-Kurven (`tension: 0.4`), transparente Farbverläufe, Donut-Chart für Kategorie-Anteile, gestrichelte Prognoselinie — betrifft `IncomeExpenseChart.tsx`/`CashflowChart.tsx`, evtl. eine neue Donut-Komponente.
   - **Pill-Progress-Bars & Category Badges:** betrifft `BudgetProgressBar.tsx` (abgerundete Balken existieren schon teilweise, ggf. nur Feinschliff) und neue pastellfarbene Icon-Badges pro Kategorie (Kategorien haben aktuell kein Icon/Farbfeld im Datenmodell — ggf. `Category` um ein Icon-/Farbfeld erweitern, das wäre dann eine Migration).
   - **Micro-Interactions:** Zähl-Animationen für Beträge, Skeleton-Loader mit Shimmer-Effekt, Transaktions-Gruppierung nach Datumsblöcken (Heute/Gestern) — reine Frontend-Aufgabe, kein Schema-Change.
4. Weiterhin offen aus Phase 11: **CSV-Transaktions-Import** — braucht Input vom Nutzer zum tatsächlichen Bank-CSV-Format, bevor sinnvoll umsetzbar.
5. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten sechs Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `frontend/src/components/HeroCard.tsx` — neu: Mesh-Gradient-Hero-Card-Komponente.
- `frontend/src/pages/DashboardPage.tsx` — Hero-Card ganz oben eingefügt, alte "Frei verfügbar"/"Tagesbudget"-`StatTile`-Kacheln entfernt (jetzt in der Hero-Card enthalten).

## Entscheidungen & Begründungen

- **`dataviz`-Skill vor der Umsetzung geladen** (Trigger: Stat-Tile/KPI/Dashboard-Bau) — angewendete Erkenntnisse: Hero-Zahl ≥48px, proportionale (nicht tabellarische) Ziffern für die große Zahl, genau eine Hero-Zahl pro Ansicht, keine neuen/willkürlichen Markenfarben.
- **Mesh-Gradient nutzt ausschließlich bereits im Projekt etablierte Farben** (`#2a78d6`, `#eb6834`, ein bereits verwendeter Lila-Ton) statt neuer Farbwerte — konsistent mit dem bestehenden Farbsystem der App statt eines Fremdkörpers.
- **Fester, theme-unabhängiger dunkler Hintergrund** (nicht an Light-/Dark-Mode gekoppelt) — bewusste Design-Entscheidung für Hero-Cards in diesem Stil (der Kartenhintergrund bleibt immer farbig/dunkel, unabhängig vom Seiten-Theme), analog zu vielen Finance-App-Hero-Cards. Per Screenshot in beiden Seiten-Hintergründen (hell/dunkel) geprüft, dass die Karte sich in beiden Fällen klar abhebt.
- **Alte "Frei verfügbar"/"Tagesbudget"-Kacheln entfernt statt behalten** — die Hero-Card zeigt dieselben Werte, ein Duplikat wäre redundant und hätte den Dashboard-Einstieg unnötig aufgebläht.
- **Visuelle Verifikation ohne laufenden Stack:** kein Docker/Postgres in dieser Session verfügbar, daher kein echter Login/Dashboard-Aufruf möglich. Stattdessen das exakte Karten-Markup in einer isolierten HTML-Datei nachgebaut und per Playwright (systemweit unter `/opt/node22/lib/node_modules/playwright` vorhanden, nicht als Projekt-Abhängigkeit) gegen den vorinstallierten Chromium (`/opt/pw-browsers/chromium`) screenshotet. Ersetzt keinen echten Browser-Test im laufenden Dashboard, war aber die einzig mögliche Annäherung in dieser Umgebung.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang, auch keinen laufenden Backend/DB-Stack** — Verifikation lief über `tsc`/`vite build` plus einer isolierten Playwright-Screenshot-Prüfung des neuen Markups, nicht über einen echten Login/Dashboard-Aufruf.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
