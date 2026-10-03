# Jhotta

A local-first workout PWA. You log sets on the device; charts, totals, streaks and calories are
computed only from IndexedDB (Dexie). AWS is login + backup, not the app database.

- **Guest:** data stays on the device and is never uploaded.
- **Google account:** each write goes to IndexedDB first, then is pushed to DynamoDB when online
  (outbox sync). Logging in pulls the account's data. Logging out clears the device.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Host the app
The production site is the static `dist/` directory created by `npm run build`. Configure the host to
serve `index.html` for unknown paths so direct visits to routes such as `/goals` and
`/auth/callback` work. The included `public/_redirects` and `public/_headers` files provide this
configuration on Netlify and Cloudflare Pages. The AWS S3 + CloudFront setup is in
[`backend/DEPLOY.md`](backend/DEPLOY.md).

The app runs in guest mode without cloud configuration. Google sign-in and account backup are
optional: deploy the backend, copy `.env.example` to `.env`, and set `VITE_API_URL`,
`VITE_COGNITO_DOMAIN`, and `VITE_COGNITO_CLIENT_ID` before building. These values are public client
configuration; never put the Google client secret in the frontend `.env`.

Run `npm run lint` before release. The production build splits pages and chart code into separate
chunks, and the service worker precaches the app shell for offline use.

## Layout
- `src/db` Dexie schema, seed data, wipe/reset
- `src/lib` stats (buckets, streak), calories, local mutations
- `src/sync` Cognito PKCE login, API client, outbox push / pull
- `src/pages` Today, Progress, Goals, Weight, Settings, auth callback
- `backend/` Lambda handlers, SAM template (Cognito, API Gateway, DynamoDB, S3, CloudFront), tests
