# Deployment Checklist

## Required Server

This project needs Node.js hosting because Cashfree order creation and verification must run on the server. Do not deploy it as only static HTML.

The live app uses its own MongoDB database named `i-ars` by default.

## Upload Files

Upload the deployment zip contents to your server.

Required runtime files:
- `dist/`
- `Logo/`
- `attachments/DV Admission and Consent Form.pdf`
- `server.mjs`
- `package.json`
- `.env`

## Server `.env`

Create `.env` on the server:

```env
CASHFREE_ENV=production
VITE_CASHFREE_MODE=production
CASHFREE_CLIENT_ID=your_cashfree_app_id
CASHFREE_CLIENT_SECRET=your_cashfree_secret_key
APP_BASE_URL=https://ars.dvanalyticsmds.in
PORT=3600
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=i-ars
MICROSOFT_TENANT_ID=your_azure_tenant_id
MICROSOFT_CLIENT_ID=your_azure_application_client_id
MICROSOFT_CLIENT_SECRET=your_azure_client_secret_value
MICROSOFT_SENDER_EMAIL=pushkar.rai@dvdataanalytics.com
MICROSOFT_FROM_NAME=DV Data Analytics
ONBOARDING_CC=md.sajid@dvdataanalytics.com
```

Use your real HTTPS domain for `APP_BASE_URL`. For onboarding emails, create a Microsoft Entra app registration with delegated `Mail.Send`, add `${APP_BASE_URL}/api/microsoft/callback` as a Web redirect URI, set the Microsoft values above, then open `${APP_BASE_URL}/api/microsoft/auth` once and sign in with the sender mailbox.

## Start App

```bash
npm run start
```

The app starts on the configured `PORT`.

## Domain

Point your domain to the server, enable HTTPS, and proxy web traffic to the Node app port. Also whitelist the same HTTPS domain in Cashfree.
