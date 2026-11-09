# KING 253 — Deployment guide (DZSecurity cPanel)

Plan A: the Next.js app runs as one Node.js app under Passenger, with the account's local PostgreSQL 13.
Server: `oort-shared.dzsecurity.net` · cPanel user prefix `kingco32_` · domain `king253.com`.

## 1. Build the bundle (on the Mac)

```bash
npm run package:dzsecurity
```

Produces `dist/king253.zip` (~35 MB): Next standalone server, `public/`, `.next/static`, `app.js`,
`drizzle/` migrations, `scripts/migrate.mjs` + `scripts/create-admin.mjs`, Linux x64 `sharp`.
The public URL baked into the build is `https://king253.com` (override with `NEXT_PUBLIC_SITE_URL_PROD`).
No `.env` file is ever included.

## 2. One-time cPanel setup

1. **PostgreSQL** — database `kingco32_king253`, user `kingco32_kingapp` with all privileges (done 2026-11-08).
2. **Uploads folder** — File Manager → home → new folder `king253-uploads` (outside `public_html`,
   so a redeploy never deletes product images).
3. **Setup Node.js App → Create Application**
   - Node.js version: **22.x**
   - Application mode: **Production**
   - Application root: `king253`
   - Application URL: `king253.com`
   - Application startup file: `app.js`
   - Create, then **Stop** the app until the files are uploaded.
4. **Secrets file** — in `~/king253/` create `.env` (File Manager → + File), permissions **600**:

   ```
   DATABASE_URL=postgres://kingco32_kingapp:PASSWORD@localhost:5432/kingco32_king253
   UPLOAD_DIR=/home/kingco32/king253-uploads
   SMTP_HOST=
   SMTP_PORT=587
   SMTP_USER=
   SMTP_PASS=
   SMTP_FROM="KING 253 <orders@king253.com>"
   ```

   The owner types the password; it is never shared. If the password contains `@ : / ? #`, URL-encode it.
   Next.js reads this file at startup, and the terminal scripts read it with `--env-file`.
   (Check the exact home path in cPanel's sidebar; `kingco32` is the expected user name.)

## 3. Upload and start

1. File Manager → `~/king253` → Upload `dist/king253.zip` → right-click → **Extract** into `/home/kingco32`
   (the zip contains the `king253/` folder). Delete the zip afterwards. Keep the `.env` file.
2. Setup Node.js App → **Start** (or Restart). Open `https://king253.com`.
   `app.js` applies pending migrations on every start and appends the result to `~/king253/migrate.log`
   (`exit=0` + "Migrations applied." = OK). Never click "Run NPM Install": the bundle already
   contains its `node_modules`.
3. First admin: sign up on `https://king253.com/sign-up`, then promote that account in
   cPanel → phpPgAdmin → `kingco32_king253` → SQL:
   `update users set role = 'admin' where lower(email) = lower('owner@example.com');`
   (Alternative from the cPanel Terminal: `node --env-file=.env scripts/create-admin.mjs EMAIL "Name"`.)

## 4. HTTPS

AutoSSL (Let's Encrypt) is active for `king253.com`. HTTP → HTTPS and `www` → bare domain are forced by
a block at the top of `~/public_html/.htaccess` (`# BEGIN KING253 force HTTPS + bare domain`), placed
above the CloudLinux Passenger block. Do not remove the Passenger block.

## 5. Updating the site later

1. `npm run package:dzsecurity` on the Mac.
2. Stop the app, upload/extract the new zip over `~/king253` (the `.env` file and `~/king253-uploads` stay).
3. Restart the app (new migrations are applied automatically; check `migrate.log`).

## 6. Checks after each deploy

- Home, `/clothes`, a product page, `/admin/login` load.
- Admin → upload one image (proves `sharp` + `UPLOAD_DIR`).
- Place a test order, then delete it in admin.
- `https://king253.com/robots.txt` shows `Sitemap: https://king253.com/sitemap.xml`.

## 7. Notes and limits

- 1 GB RAM / 20 entry processes: keep Passenger at its default (1–2 processes).
- The rate limiter is in memory per process — approximate, acceptable at this traffic.
- All migrations applied cleanly on the server's PostgreSQL 13.23 (first deploy, 2026-11-09).
- The browser-based cPanel Terminal may not accept automated typing; the owner can type in it directly.
- Logs: `~/king253/stderr.log` (Passenger) and cPanel → Errors.
