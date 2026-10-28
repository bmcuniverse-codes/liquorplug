# Deployment and operations

See **UPDATE-GUIDE.md** for applying this version to an existing store, footer/social editing and app installation.

## Environment

Use `.env.example` locally. In hosting dashboards, set environment variables directly. Never put Paystack secret keys, database URLs or SMTP passwords into frontend code, Git or product content.

Required live configuration:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PUBLIC_URL` | Exact HTTPS origin, e.g. `https://your-domain.com`, no trailing slash |
| `DATABASE_URL` | PostgreSQL URI for Vercel; optional on persistent Node hosting |
| `DATABASE_SSL` | `true` for Supabase; certificate verification remains enabled |
| `DATABASE_CA_CERT` | Complete PEM root certificate from Supabase Database SSL settings, with BEGIN and END lines; see UPDATE-GUIDE.md |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | Initial owner credentials; create the owner before opening the store |
| `PAYSTACK_SECRET_KEY` | Your Paystack test key first, then the approved live key |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Mail service settings; port 465 uses TLS, 587 uses STARTTLS |
| `ADMIN_NOTIFICATION_EMAIL` | Recipient for order/wholesale/stock notifications |
| `CRON_SECRET` | Unique random 32+ character value for scheduled HTTP maintenance |

Object storage variables for Vercel: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`. Use a public-read image domain/bucket and credentials restricted to that bucket. Uploaded images are validated by file signature and limited to PNG/JPEG/WebP, 5 MB each. SVG uploads are not accepted. Deleting a product archives its record and preserves order history.

## Vercel

1. Create a private repository from this folder; commit source and `package-lock.json`, not `.env`, `node_modules` or local databases.
2. Create a managed PostgreSQL database. A Supabase PostgreSQL database works through its server connection string; Supabase browser Auth/Storage is not required by this implementation. Follow the provider's pooling/SSL connection instructions.
3. In your local `.env`, use that PostgreSQL URL and your owner credentials, then run `npm run db:setup` once. This generates tables from `server/schema.sql`, seeds catalogue/areas, and creates the owner. Keep a backup before applying future migrations.
4. Import the repository in Vercel. Select Node 24 and use **Other** as framework preset. The included `vercel.json` sets the build and routing. It sends API routes to the serverless handler and dynamic page requests to the metadata renderer; built assets are served from `dist`.
5. Set all production environment variables. Configure S3-compatible storage before image uploads.
6. Deploy and test sign-in, an enabled delivery area, a stocked product and one Paystack test payment. No live Vercel/PostgreSQL account was available during generation, so this is a supplied deployment configuration, not a verified deployment.
7. Add your domain in Vercel's project → Settings → Domains. Follow the exact DNS values displayed there. Preserve existing email MX/SPF/DKIM/DMARC records if the domain also has email hosting.
8. Schedule `GET https://your-domain.com/api/maintenance` every minute or at an interval supported by your hosting plan, with `Authorization: Bearer YOUR_CRON_SECRET`. Do not expose the secret in a query string. This processes pending email and releases expired reservations even while no one is browsing. Check your plan's scheduling frequency limits.

Product inventory, content and sessions live in PostgreSQL; uploaded images live in object storage. All SQL access occurs on the server. `server/postgres-security.sql` is applied during setup: it enables row-level security and revokes table access from PUBLIC and any Supabase anon/authenticated roles for this application's named tables. Connect as the role that owns these tables, so server queries retain access. Do not expose an owner connection string to browsers. Use a dedicated application database and keep the connection role scoped to it.

## Persistent Node hosting / Docker

Run `npm ci`, configure `.env`, `npm run db:setup`, `npm run build`, then `npm start`. The process uses `PORT` (default 3000). Put HTTPS in front of it. For SQLite run only one application instance; use PostgreSQL for multiple instances. Persist `data/` and `uploads/` across deployments. The Node process runs maintenance every minute.

The included Dockerfile builds the app. Mount persistent volumes at `/app/data` and `/app/uploads`; provide secrets through environment variables. Set `PUBLIC_URL` to the actual HTTPS origin and `NODE_ENV=production`. The runtime auto-seeds only a new, empty database, so run the setup command deliberately for owner creation if the database already exists.

## Paystack

- Server initialization: `/api/orders/:ref/pay`.
- Server verification: `/api/orders/:ref/verify`.
- Webhook URL: **`https://your-domain.com/api/payments/webhook`**.
- Callback: **`https://your-domain.com/track?ref=ORDER_REFERENCE`**, generated per order.
- Currency: NGN; all stored monetary values are integer kobo. Admin inputs and CSV import/export use naira.
- Start with a test key and configure the webhook under the matching Paystack environment.
- The server checks the webhook signature, then independently verifies the transaction against Paystack. Success must match the saved reference, amount and currency.
- Use test mode to test failure, abandonment, retries, duplicate callbacks and expired reservations before switching to live mode. No real payment was collected during development.
- Initialization URLs are reused to reduce accidental multiple transactions. Any additional successful payment is kept for store review; check the provider for refunds if a customer paid twice.

Official references: https://paystack.com/docs/payments/accept-payments/ ; https://paystack.com/docs/payments/webhooks/ ; https://paystack.com/docs/payments/verify-payments/

## Email

Order confirmations, payment confirmations, fulfilment changes and administrative notifications queue in `email_outbox`. The worker processes up to 15 pending messages per run and retries failed deliveries up to five times. Configure SMTP and the recurring maintenance job before relying on email. Inspect Notifications → Email delivery in admin. Provider delivery/spam placement is not guaranteed by enqueueing a message.

## Wholesale and delivery

- Product wholesale prices default to null (unavailable); they are never guessed from a retail discount.
- Each product defaults to a six-unit wholesale minimum; change it per product.
- Product minimum quantities are enabled initially; global minimum order value is optional and editable.
- All 20 Lagos LGAs are disabled initially. Set your own fees, minimums and ETAs, then enable supported areas. Add neighbourhoods for more specific fees. Names/coverage alone are not evidence that every address is serviceable.
- Pickup is disabled until you add an address and enable it.

## Backups and recovery

1. Run `npm run backup`. SQLite uses `VACUUM INTO` for a consistent copy. PostgreSQL uses the locally installed `pg_dump` client (same or newer major version as the server). Provider-managed backups are also recommended.
2. Back up the uploads directory or object bucket separately. Store secrets securely outside source archives.
3. Keep encrypted backup copies in a separate location. Retention should match your business/privacy policy; a practical starting schedule is daily backups with multiple generations.
4. Test recovery on a separate database. For SQLite, stop the app, preserve the current database and WAL files, restore the backup to the configured `SQLITE_PATH`, then restart. For PostgreSQL, restore the custom dump using `pg_restore` to a new database, verify it, then switch `DATABASE_URL`.
5. Check catalogue counts, users, recent orders, stock, login and image URLs before accepting new orders after recovery.

No external backup destination, retention job or restore drill has been run against your accounts.

## Operational limits

The admin order list displays up to the latest 5,000 matching records; exports query all records. Inventory history shows the most recent 1,000 movements. This first version stores simple product records with one size per SKU and one wholesale price; it has no multi-warehouse or external courier integration. Refund transfers, delivery dispatch and payment-review exceptions remain staff operations.
