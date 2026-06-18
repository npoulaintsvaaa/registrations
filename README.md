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

## One app setting you must add (in the Static Web App → Environment variables)
```
REG_STORAGE_CONNECTION = <your Azure Storage account connection string>
```

## Getting the CSV
Browse to:  https://<your-app>.azurestaticapps.net/api/export
(You'll be asked to sign in; only users you invited as "admin" can download.)

The public form link to share / put in the QR code is just:
https://<your-app>.azurestaticapps.net/
```
