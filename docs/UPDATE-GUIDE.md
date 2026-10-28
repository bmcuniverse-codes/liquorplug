# Install this update

## Existing Vercel + Supabase store

1. Back up the existing database. Replace your project source with this ZIP's files; keep your existing Vercel environment variables and your private local `.env`.
2. Use Node 24. In Vercel, choose **Other**. The included `vercel.json` uses `npm ci --include=dev`, `npm run build` and `dist`.
3. Check `NODE_ENV=production`, `PUBLIC_URL=https://your-actual-store-domain` (the exact domain you open, including `www` if used), `DATABASE_URL`, `DATABASE_SSL=true`, and `DATABASE_CA_CERT` in Vercel. A Supabase project URL is not a database connection string.
4. In Supabase, open **Database → Settings → SSL configuration** and download the server root certificate. Supabase dashboard labels can vary. Copy the entire PEM file, including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`, into `DATABASE_CA_CERT`. In Vercel paste the multiline value directly, without surrounding quotes. In a local `.env`, surround the complete multiline certificate with double quotes. Certificate verification stays enabled.
5. Run `npm ci`, then `npm run db:setup` locally with the same database configuration, then redeploy Vercel. Setup preserves accounts, orders, prices and merchant images. Existing passwords do not change. Migrations also run on the server's first startup, but running setup beforehand makes configuration errors easier to see.
6. Open **Admin → System status**. Check the database and configuration flags. These flags confirm presence of settings, not a successful external provider transaction. If an error remains, use its reference to find the matching Vercel runtime log entry. Do not post secret environment values.

The supplied Supabase certificate must match the certificate chain used by your connection endpoint. Use the provider's current certificate and connection instructions. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` or disable certificate verification.

## What the update changes

- Four supplied campaign images become homepage slides with automatic rightward transitions, pause controls and editable Shop now links. Slides wait for their images before moving. Existing custom homepage campaigns are retained after these slides.
- **Website editor → Banners → promotions** controls the banners shown between every 20 shop products. Page carousels remain independently editable. Full artwork mode displays the entire banner; an optional mobile image can use a different composition.
- **Website editor → Social media**: TikTok, Instagram, Facebook, YouTube, X, Threads, Snapchat, LinkedIn, Pinterest and Telegram. Add an HTTPS profile link, enable it and choose top, bottom or both. Blank profiles stay hidden. Save and publish.
- **Website editor → Discovery & recipes**: predefined drink and mixing cards. **Sections** controls visibility and order. **Advertising** configures the enquiry section; an empty enquiry URL uses your store WhatsApp number.
- **Website editor → Footer banners**: separate editable portrait and landscape images, buttons and links; plus editable “Why buy from Liquor Plug NG?” cards. They appear above the footer on browsing pages. Form/order pages stay focused on the transaction.
- Products load progressively in groups of 20. Filters/sorting reset the list. A Load more button and retry control are available if automatic loading is unsupported or fails. Customers can pause automatic loading to explore the footer.

## Opening inventory

As requested, migration 2 sets available stock to a minimum of 10 for existing active products **once**, recording each increase. Higher quantities are preserved. New catalogue installs start with 10 units per product. Subsequent restarts, deployments and sales do not refill stock. New products manually created or imported still use their explicit/default stock value so the store does not assume unconfirmed inventory.

**Admin → Inventory → Set minimum stock to 10** is an explicit, confirmed manual operation for a future restock. It affects all active products below 10 and records movements. Do not click it for a normal refresh.

## Install as an app

This update includes a web app manifest, app icons, a service worker and an install section above the footer. Deploy over HTTPS first.

- Android / desktop Chrome or Edge: use **Install app** when offered, or the browser's Install menu.
- iPhone: open the store in Safari → Share → **Add to Home Screen** → Add. Installation wording can vary by browser/OS.
- The install prompt is controlled by the browser; it cannot be forced on unsupported devices. This is a PWA, not an App Store/Play Store native application.
- Offline browsing shows a reconnect page. Shopping, prices, order tracking and checkout require an internet connection. API, account, cart, checkout, admin and tracking responses are never cached by the service worker. The existing device-local bag remains available.
- Replace `public/icons/` and update the manifest if you want your final logo used as the app icon. The editable website logo is separate from these packaged app icons.

## Image uploads on Supabase

Keep `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PUBLIC_URL` configured in Vercel. The bucket used for public product pictures must allow public reads. The upload client now uses path-style addressing at the correct client level and compatible request checksum behaviour. The AWS/S3 secret belongs only in server environment variables.

## Before accepting real orders

Set your delivery fees and enable serviceable locations, check reference prices, set wholesale prices and publish your contact/policy edits. Keep the existing persisted WhatsApp-order workflow. Complete one real Paystack test-mode payment, image upload and email delivery check using your own accounts before switching payments live.

No credentials, user database, preview fixtures or `node_modules` are included in this ZIP.
