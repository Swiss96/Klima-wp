KLIMA-WP – Migration 15 (28.10.2026)

Basis: Klima-wp-main 14.zip

1. Neuer WhatsApp-Button auf allen aktiven HTML-Seiten (nicht auf Legacy-Weiterleitungen).
   Nach erstem Scrollen >40 px: 2 s mittig vergrössert, danach am rechten Rand.
   Sprechblase „Lieber direkt? Schreib uns per WhatsApp!“ bis 10 s gesamt.
   Nur einmal pro Browser-Tab; reduzierte Bewegung wird respektiert.
2. Startseite: sachlicher Vertrauensbereich ohne erfundene Referenzen oder GmbH-Angaben.
3. SEO: Vorhandene 301-Weiterleitungen von /wartung, /stoerung, /inbetriebnahme auf die spezifischen WP-Seiten bleiben erhalten. Keine riskanten URL-Löschungen.
4. Schweizweite Ausrichtung unverändert. Keine neuen regionalen Keywords.
5. Kontakt-Tracking und Nulite-SEO unverändert.

Deploy: gesamtes Projekt oder geänderte Dateien hochladen, Cloudflare Worker beibehalten.
Prüfen: Startseite, Klima- und WP-Unterseiten, Nulite; mobil/desktop; WhatsApp-Ziel; Formularsendung; 301-Routen; Cache.
Hinweis: Es wurden keine Live-Browsertests oder Formular-Backendtests durchgeführt.
