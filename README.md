# Tech Day 2026 — Registration (Azure Static Web Apps)

Public branded registration form + in-tenant data capture + CSV export.
Everything runs inside your own Azure subscription.

## Structure
```
/index.html                  → the branded registration form (front door, public)
/staticwebapp.config.json    → routing + auth rules
/api/register/               → saves each submission to Azure Table Storage (public POST)
/api/export/                 → returns all registrations as CSV (admin only)
/api/package.json            → API dependencies
```

## How it works
- The form POSTs to `/api/register` (same origin → no CORS).
- Submissions are stored in an Azure Storage **Table** named `registrations`.
- `/api/export` reads the table and returns a UTF-8 CSV (opens cleanly in Excel).
- `/api/export` is locked to the **admin** role via Entra ID sign-in.

## App settings you must add (Static Web App → Environment variables)
```
REG_STORAGE_CONNECTION = <your Azure Storage account connection string>
TURNSTILE_SECRET        = <your Cloudflare Turnstile SECRET key>
```

## Data minimization
Citizenship / Green Card answers are evaluated in the browser only. They are NOT
transmitted or stored. The record keeps just a `plant_tour_eligible` Yes/No flag
alongside name, company, email, phone, and role.

## Bot protection (Cloudflare Turnstile)
- Front end: the widget is in `index.html`. Replace the test sitekey
  `1x00000000000000000000AA` with your real **sitekey**.
- Back end: `/api/register` verifies every token against Cloudflare's Siteverify
  API using `TURNSTILE_SECRET`. Submissions without a valid token are rejected.
- Get both keys free at https://dash.cloudflare.com → Turnstile → Add widget.

## Getting the CSV
Browse to:  https://<your-app>.azurestaticapps.net/api/export
(You'll be asked to sign in; only users you invited as "admin" can download.)

The public form link to share / put in the QR code is just:
https://<your-app>.azurestaticapps.net/
```
