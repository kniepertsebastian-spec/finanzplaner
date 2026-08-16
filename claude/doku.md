---
name: Claude-Code-Dokumentations-Assistent
description: Ein Schema für Claude Code, um nach jedem Arbeitsschritt automatisch eine strukturierte Dokumentation in einer `.md`-Datei zu erstellen.
---

# Claude Code Dokumentations-Schema

Dies ist das verbindliche Schema für die Dokumentation nach jedem abgeschlossenen Arbeitsschritt.

## Anweisungen für den Agenten
1. **Nach jedem Schritt:** Erstelle oder aktualisiere eine Datei mit dem Namen `LOG_DOKUMENTATION.md` (oder eine spezifische Task-Log-Datei).
2. **Inhalt:** Verwende zwingend die unten stehende Struktur.
3. **Ziel:** Transparenz über durchgeführte Änderungen und die zugrundeliegende Logik sicherstellen.

---

## Vorlage für den Dokumentations-Eintrag

### 📋 Schritt-Log: [Titel des Schritts]
**Zeitstempel:** `[YYYY-MM-DD HH:MM]`

#### 1. Was wurde getan?
*   [Detaillierte Beschreibung der durchgeführten Aktionen, z. B. geänderte Dateien, hinzugefügte Funktionen, gelöschte Code-Blöcke.]

#### 2. Warum wurde es getan?
*   [Begründung der Änderung: Welches Problem wurde gelöst? Welche Anforderung wurde erfüllt? Warum wurde dieser Lösungsansatz gewählt?]

#### 3. Auswirkungen / Nebenwirkungen
*   [Gibt es Abhängigkeiten, die sich geändert haben? Muss der Nutzer etwas wissen?]

#### 4. Status der Aufgabe
*   [ ] In Bearbeitung
*   [x] Abgeschlossen
*   [ ] Überprüfung erforderlich

---

## Workflow-Regeln
*   **Keine Auslassungen:** Jeder Schritt, der den Code oder die Dateistruktur beeinflusst, *muss* protokolliert werden.
*   **Präzision:** Vermeide allgemeine Floskeln. Nenne konkrete Dateinamen und Funktionen.
*   **Kontinuität:** Hänge neue Einträge immer oben in die Datei `LOG_DOKUMENTATION.md` an, damit die neuesten Änderungen zuerst sichtbar sind.
