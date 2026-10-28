# Liquor Plug

Mobile-first retail and wholesale drinks store, with an Express API, React storefront, admin dashboard, Paystack integration and WhatsApp order handoff. Black and #4E0707 branding. This is the application source, not a static-only landing page.

For an existing store, start with **docs/UPDATE-GUIDE.md**. The update adds social placement controls, campaign carousels, progressive shopping, editorial content, portrait/landscape footer banners, reasons to shop, and PWA installation.

## Start locally

1. Install Node.js **24 LTS** (22.13+ also supported).
2. Open a terminal in this folder and run `npm ci`.
3. Copy `.env.example` to `.env`.
4. Set `OWNER_EMAIL` to your email and `OWNER_PASSWORD` to a unique password of at least 12 characters. Keep `PUBLIC_URL=http://localhost:3000` for local use. Leave `DATABASE_URL` blank to use local SQLite.
5. Run `npm run db:setup`.
6. Run `npm run dev` and open **http://localhost:3000**.
7. Sign in at **/account**, then open **/admin**.

No default admin account or shared password is shipped. `db:setup` creates your owner account; later runs preserve existing products and content. Existing owner passwords are not overwritten by changing environment variables.

## First setup in the dashboard

- Website editor → Branding: upload your logo.
- Products: review imported retail prices, set your wholesale prices, descriptions and images.
- Inventory: add the stock you actually hold. New catalogue installations start at **10 units**. Existing active products receive a one-time minimum of 10; later deployments do not refill inventory.
- Delivery areas: set fees/minimum orders and enable only areas you can serve. All **20 LGAs** are present but start disabled.
- Website editor → Business: review **2348062833017**, add your email/address/hours, configure wholesale minimums and optional pickup.
- Website editor → Banners: each page has its own image carousel, including optional mobile images, full-artwork layout, timing and scheduling. The promotions group inserts a banner after each 20 shop products.
- Website editor → Social media: add profile links (including TikTok), enable platforms and select top/bottom placement.
- Website editor → Footer banners: edit portrait/landscape artwork and the reasons to buy. Discovery & recipes and Advertising control the new homepage content.
- Website editor: save draft, preview, publish. These edits use the database and do not require a new deployment.
- Configure Paystack and SMTP in the server environment; see **docs/DEPLOYMENT.md**.

## Catalogue included

- **532** factual product listings from the Naija Liquor public catalogue.
- **42** named source brands plus **Other Brands**; **25** categories.
- **48** manufacturer image files used by **52** product entries; **480** entries use the labelled image placeholder.
- Imported retail prices are **reference prices**, not confirmed Liquor Plug selling prices. No wholesale prices or competitor promotional promises are activated.
- Product marketing descriptions and competitor watermarked photographs were not copied.
- Some manufacturer packshots depict another bottle-size variant; check the image against the product size before publishing it as your final store inventory.
- Sources, download URLs and retrieval details: **data/catalogue-sources.json**. Original factual product data: **data/catalogue.json**. Added image attribution and supplied banner details: **data/asset-updates.json**.

## How orders work

Retail customers can check out as guests. Accounts store order history. Wholesale requires an approved account and a wholesale price on each ordered product. Minimum quantities and/or order value are configurable.

The server calculates prices and delivery, validates stock and reserves units for 30 minutes. A WhatsApp order is saved first, then a prefilled message opens for the customer to send. Opening WhatsApp is not proof of message delivery or payment. Staff see these orders in the dashboard; a manager can confirm an independently verified payment.

Paystack payments are initialized and verified on the server. Webhooks require a SHA-512 signature. Duplicate callbacks cannot deduct stock twice. Payments received after stock release are reallocated if stock remains available; otherwise the order is marked **payment_review**. Check these orders before fulfilment. Additional successful transactions are flagged for duplicate-payment review.

Refunds in this MVP are **records of refunds**. Transfer the money through Paystack or your bank and record the completed refund; the refund form does not move funds automatically. Stock returns/cancellations are separate, recorded inventory events.

Guest order access uses a private token saved in the checkout browser. Customers can view/copy it from the confirmation page to use another device. The reference alone does not expose private order details.

## Hosting

- Persistent Node hosting/VPS: SQLite or PostgreSQL. Run `npm run build`, then `npm start`. Keep the database and uploads on persistent storage.
- Vercel: use **PostgreSQL**, **S3-compatible image storage**, SMTP, and a scheduler for email/maintenance. SQLite and local uploads cannot persist across serverless invocations. A Vercel configuration is included; deployment itself has not been performed.
- Uploading this ZIP into cPanel `public_html` will not run the application. It needs a Node runtime or the documented Vercel setup.
- Production hosting needs HTTPS because login cookies are secure.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Compile the storefront |
| `npm start` | Serve the production build |
| `npm run db:setup` | Migrate, seed catalogue, create initial owner |
| `npm test` | SQLite functional/security and configuration tests |
| `npm run test:postgres` | PostgreSQL engine integration tests with PGlite |
| `npm run backup` | Consistent SQLite or PostgreSQL database backup |
| `node --env-file-if-exists=.env scripts/maintenance.mjs` | Release expired reservations, process queued email, clean expired auth data |


## Project map

`src/` storefront/admin; `server/` API and business rules; `server/schema.sql` portable database schema; `api/` Vercel handler; `public/` local images and CSV template; `tests/` automated checks; `docs/` setup/operations/verification.

Read **docs/VERIFICATION.md** for the exact checks performed and the live integrations still requiring your credentials.
