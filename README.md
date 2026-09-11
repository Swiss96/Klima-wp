# KLIMA-WP Fullstack V1

Dieses Projekt kombiniert:
- die bestehende KLIMA-WP-Website unter /public
- die drei Formularseiten
- einen Cloudflare Worker unter /src/index.js
- Cloudflare Email Service via EMAIL Binding

## Was V1 bereits macht
Formulare senden ihre Daten an POST /api/form.
Der Worker versendet daraus eine strukturierte E-Mail an info@klima-wp.ch.
Absender: auftraege@mail.klima-wp.ch

Uploads werden in V1 noch NICHT als Anhang übertragen; nur die Dateinamen werden im Mail aufgeführt.
PDF-Erzeugung kommt im nächsten Schritt, sobald der Grundversand erfolgreich getestet ist.

## Cloudflare
Wrangler-Konfiguration ist wrangler.jsonc.
Der Worker-Name ist aktuell "klima-wp".

Email Binding:
send_email -> EMAIL

Statische Assets:
public/ -> ASSETS
Worker-Code wird nur für /api/* zuerst ausgeführt.

## Deployment
Empfohlen: GitHub Repository mit Cloudflare Workers Builds verbinden.
Deploy command: npx wrangler deploy
Deployment-Test 07.09.2026
