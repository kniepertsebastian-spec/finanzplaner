Finanzplaner – TODO vor Hardening

🚨 P0 – Kritisch

☐ Secrets/Credentials bereinigen – Keine echten Zugangsdaten oder Secrets im Repository; kompromittierte Werte rotieren.
☐ Finanzmodell final definieren – Transaktionen, Konten, Transfers, Einnahmen/Ausgaben und Status eindeutig.
☐ Finanzmonat definieren – Starttag, Monats-/Jahreswechsel und 28/29/30/31-Tage-Fälle.
☐ Recurring Transactions finalisieren – Wiederholungen, Fälligkeit, Aussetzen und Enddatum.
☐ Cashflow-Berechnung festziehen – Verfügbarer Betrag und Prognosen mathematisch eindeutig.
☐ Budgetlogik finalisieren – Budgets, Restbetrag, Überschreitungen und Überträge.
☐ Offline-Sync absichern – Keine Doppelbuchungen oder Datenverluste.
☐ Datenkonflikte definieren – Verhalten bei parallelen und Offline-Änderungen.

🟠 P1 – Wichtig

☐ Rücklagen/Savings Pots fertigstellen – Ziel, Termin, automatische Rücklage und verfügbarer Betrag.
☐ Split Transactions finalisieren – Teilbeträge müssen exakt dem Originalbetrag entsprechen.
☐ Beleg-Workflow abschließen – Upload → OCR → Bearbeitung → Transaktion → Verknüpfung.
☐ Backup/Export fertigstellen – Vollständiger Datenexport muss zuverlässig funktionieren.
☐ Import/Restore prüfen – Backups kontrolliert wiederherstellbar.
☐ Dashboard finalisieren – Verfügbarer Betrag, kommende Zahlungen, Budget und Cashflow.
☐ Transaktionshistorie fertigstellen – Suche, Filter, Zeitraum, Kategorie, Betrag und Belege.
☐ Kategorien finalisieren – Eigene Kategorien, Bearbeiten, Archivieren und Migration.
☐ Auth-Flows vollständig machen – Passwort, Passkey, TOTP, Session, Logout und Recovery.
☐ Privacy Mode abrunden – Sensible Beträge und Kontostände zuverlässig ausblenden.

🟡 P2 – Abrunden

☐ OCR UX verbessern – Ergebnisse vollständig editierbar und Unsicherheiten sichtbar.
☐ Belegverwaltung abrunden – Zuordnen, ersetzen, löschen und anzeigen.
☐ Statistiken konsolidieren – Gleiche Finanzregeln wie Dashboard/Budgets.
☐ Benachrichtigungen finalisieren – Zahlungen, Budgets und Ereignisse konfigurierbar.
☐ Empty/Error/Loading States – Zentrale Finanzansichten sauber behandeln.
☐ Mobile UX finalisieren – Buchungen schnell und fehlerarm erfassen.
☐ Datenlöschung/Account-Lifecycle – Löschung und Umgang mit Benutzerdaten definieren.

🟢 P3 – Optional

☐ AI-Kategorisierung – Erst nach stabiler Basis.
☐ AI-Finanzanalyse – Komfortfeature.
☐ Open Banking / PSD2 – Eigenständiges späteres Projekt.
☐ Mehrbenutzer-/Familienkonten – Nach stabiler Single-User-Version.
☐ Komplexe Forecasts – Erst nach stabiler Basisberechnung.

🏁 Feature Freeze

☐ Keine neuen großen Features – Danach nur Fehlerbehebung/Stabilisierung.
☐ Kompletten Finanzflow testen – Login → Buchung → Kategorie → Budget → Cashflow → Monatswechsel.
☐ Offline-Finanzflow testen – Offline buchen → online gehen → Sync kontrollieren.
☐ Datenexport testen – Export erstellen und Vollständigkeit prüfen.
