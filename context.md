# context.md — Handoff für die Fortsetzung dieser Session

## Ziel

Bugfixes aus einer Live-Test-Session des Nutzers nach dem letzten Deployment: (1) Vorzeichen-Doppelnegation bei manuell eingegebenem Minus in Betragsfeldern mit Ausgabe/Einnahme-Umschalter, (2) fehlende "Fixkosten (aktueller Zeitraum)"-Kachel auf dem Dashboard, (3) OCR-Belegscan sollte auch ein bereits vorhandenes Bild statt zwingend eine Live-Kamera-Aufnahme erlauben.

## Aktueller Stand

- Alle drei Fixes vollständig implementiert und lokal verifiziert:
  - Kein Backend-Code betroffen — rein Frontend-Fixes, keine neue Migration.
  - Frontend: `npx tsc --noEmit` fehlerfrei, `npm run build` (`tsc && vite build`) fehlerfrei (nur die bekannte, unkritische Vite-Chunk-Size-Warnung).
- **Noch NICHT deployed** (weiterhin kein Docker/SSH in dieser Session). Mehrere additive Migrationen aus vorherigen Teilscheiben stehen ebenfalls noch aus.

## Offene TODOs

1. **Deployment auf dem Mini-PC steht aus:**
   ```
   git pull
   docker compose -f docker-compose.prod.yml build backend frontend
   docker compose -f docker-compose.prod.yml up -d backend frontend
   docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
   ```
2. **WICHTIG — Nutzer muss nach dem Deployment Bestandsdaten manuell korrigieren:** Die Regeln "Miete" (-840€) und "Kredit" (-240€) wurden vor diesem Fix fälschlich mit positivem Betrag gespeichert (Vorzeichen-Doppelnegation-Bug, siehe unten). Unter *Einstellungen* → Fixkosten & wiederkehrende Buchungen beide bearbeiten, Ausgabe/Einnahme-Umschalter explizit auf "Ausgabe" stellen (das Formular übernimmt beim Öffnen zunächst das aktuell falsche, gespeicherte Vorzeichen und zeigt "Einnahme" vorausgewählt) und speichern.
3. **Danach den Gesamtsaldo mit "Saldo abgleichen" korrigieren** (unter *Einstellungen* → Kontostand, existiert bereits) — der Nutzer hatte nach den fehlerhaften Einträgen einen falschen Gesamtsaldo; dort den tatsächlichen Kontostand aus dem Online-Banking eintragen, die App legt automatisch eine Ausgleichsbuchung an.
4. Rest von Phase 13, Phase 12, CSV-Import (Phase 11) weiterhin offen — siehe `claude/roadmap.md`.
5. Falls in einer künftigen Session wieder ein Mini-PC-Deploy ansteht: vorab prüfen, ob `docker`-Daemon bzw. SSH-Zugang in der jeweiligen Umgebung überhaupt verfügbar sind — war in den letzten acht Sessions durchgehend nicht der Fall.

## Relevante Dateien/Pfade

- `frontend/src/components/settings/RecurringTransactionsPanel.tsx`, `frontend/src/pages/QuickAddPage.tsx`, `frontend/src/pages/TransactionsPage.tsx` (Bearbeiten- **und** Split-Formular) — Vorzeichen-Fix: `Math.abs(eurosToCents(amount))` statt `eurosToCents(amount)`, bevor der Ausgabe/Einnahme-Umschalter das Vorzeichen anwendet.
- `frontend/src/lib/money.ts` (`eurosToCents`) — **bewusst unverändert gelassen**, siehe Entscheidungen unten.
- `frontend/src/pages/DashboardPage.tsx` — neue Kachel "Fixkosten `{periodLabel}`" (aktueller Zeitraum, `outstandingFixedCostsCents`) direkt neben der bestehenden "Fixkosten `{nextPeriodLabel}`"-Kachel (kommender Zeitraum, `upcomingFixedCostsCents`), jetzt beide in einem 2-Spalten-Grid.
- `frontend/src/pages/QuickAddPage.tsx` — `capture="environment"` vom Beleg-Datei-Input entfernt, damit die native Auswahl (Kamera *oder* vorhandenes Bild) statt zwingend der Kamera erscheint.

## Entscheidungen & Begründungen

- **Vorzeichen-Fix an den vier Aufrufstellen mit Ausgabe/Einnahme-Umschalter, nicht zentral in `eurosToCents()`** — die Funktion wird auch für Felder ohne Umschalter verwendet, bei denen ein negativer Wert legitim und vom Nutzer direkt gemeint ist (`BalanceSettings.tsx`: Startsaldo, Saldo-Abgleich — beides kann berechtigterweise negativ sein, z. B. bei einem Dispo/Überzogenen Konto). Eine zentrale `Math.abs()` in `eurosToCents()` hätte diese Fälle kaputt gemacht.
- **Root Cause des Vorzeichen-Bugs:** `amount: sign === 'income' ? cents : -cents` — tippt der Nutzer selbst ein Minus bei bereits ausgewähltem "Ausgabe", wird der bereits negative geparste Wert ein zweites Mal negiert und landet fälschlich positiv (wird dadurch überall, wo nach `amount < 0` gefiltert wird — Fixkosten-Summen, Ausgaben-Summen —, unsichtbar, ohne Fehlermeldung).
- **Kein automatisches Daten-Reparaturskript für die betroffenen Bestandsdaten** — bei nur zwei dem Nutzer bekannten betroffenen Einträgen (Miete, Kredit) wäre das unnötiger Aufwand; der Nutzer korrigiert sie manuell über die bestehende Bearbeiten-Funktion (siehe TODO 2), anschließend Saldo-Abgleich zur Gesamtsaldo-Korrektur (TODO 3).
- **Neue "Fixkosten (aktueller Zeitraum)"-Kachel ergänzt, nicht die bestehende "kommender Zeitraum"-Kachel ersetzt** — beide Zahlen sind sinnvoll (aktueller Zeitraum = "was ich diesen Zyklus insgesamt an Fixkosten habe", kommender Zeitraum = Vorschau für den nächsten Zyklus); die zugrundeliegende Berechnung (`outstandingFixedCostsCents`) existierte bereits (fließt in die "Frei verfügbar"-Berechnung der Hero-Card ein), war aber nirgends als eigene sichtbare Zahl ausgewiesen.
- **`capture`-Attribut komplett entfernt statt durch einen zweiten Button ("Foto" vs. "Datei") ersetzt** — die native Dateiauswahl auf iOS/Android zeigt ohne `capture`-Hint bereits beide Optionen (Kamera *und* Fotomediathek/Dateien) in einem einzigen nativen Dialog; ein zweiter Button wäre unnötige UI-Komplexität für denselben Effekt.
- **"Netto"-Verwirrung des Nutzers als Missverständnis eingeordnet, nicht als Bug behandelt** — die App führt keinerlei Brutto/Netto-Umrechnung durch (keine Steuerlogik im gesamten Projekt); auf die bereits existierende "Saldo abgleichen"-Funktion verwiesen, die genau die vom Nutzer gewünschte "korrigiere diesen Wert"-Funktionalität bereits bietet, statt eine neue, redundante Funktion zu bauen.

## Bekannte Fallstricke / Gotchas

- **Docker-Projektname-Kollision** (weiterhin gültig, siehe frühere Einträge): niemals `docker compose -f docker-compose.yml up` auf dem Mini-PC ohne `-p <anderer-projektname>`.
- **Diese Session hatte weder Docker-Daemon noch SSH-Zugang, auch keinen laufenden Backend/DB-Stack** — Verifikation lief ausschließlich über `tsc`/`vite build`, kein echter Login/Dashboard-Aufruf möglich.
- **Der Vorzeichen-Bug betraf potenziell auch andere, vom Nutzer nicht gemeldete Einträge** — falls nach dem Deployment weitere falsch vorzeichenbehaftete Buchungen auffallen (z. B. eine als "Einnahme" gelistete Ausgabe), gilt derselbe Fix-Workflow: bearbeiten, Umschalter korrigieren, speichern.
- **Mehrere additive Migrationen liegen inzwischen aufeinander**, die noch nicht auf dem Mini-PC deployed sind (u. a. `add_split_group_id`, `add_category_budget_type`) — alle nullable/additiv, kein Datenverlust-Risiko. Im Zweifel auf dem Mini-PC `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate status` prüfen.
- Migrations-Deploy-Befehl auf dem Mini-PC: `docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy`.

## NICHT relevant

- Alte Inhalte dieser Datei zur allgemeinen Projektübersicht (Tech-Stack, vollständige Repo-Struktur, Phasen 1–9-Historie) sind in `features.md` (Ist-Zustand) bzw. `claude/roadmap.md` (Planung) und `doku/LOG_DOKUMENTATION.md` (Verlauf) besser aufgehoben — bei Bedarf dort nachschlagen statt hier zu duplizieren.
