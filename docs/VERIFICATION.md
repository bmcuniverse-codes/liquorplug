# Verification and remaining live checks

Verified on 28 October 2026 using Node 24.22.1.

## Completed

- `npm run build`: successful production build.
- `npm test`: **51 passed**, zero failures. Uses a temporary SQLite database for API checks, plus configuration/content/PWA checks.
- `npm run test:postgres`: **42 passed**, zero failures, one expected skip (the SQLite-only backup test). Uses the PGlite PostgreSQL engine through the application's query/transaction adapter. This validates PostgreSQL SQL and application logic; it does not establish a TCP/TLS connection to your hosted Supabase project.
- `npm audit --omit=dev`: zero reported advisories after updating the affected request-parser and upload packages. Audit results can change after this date.
- Public storefront rendered in the supported browser preview: desktop homepage; narrow 320/390-pixel frames for homepage/shop; portrait/landscape footer banners; reasons-to-shop content; install instructions. Measured document widths stayed within the available viewport on the checked pages.
- Shop began with 20 products and added further batches with promotional breaks. A manual Load more action and subsequent automatic loading were observed; the list then remained at 60 rather than loading all 532 products.

## Automated coverage

The tests cover catalogue/default LGAs, role permissions, CSRF/origin checks, wholesale privacy and eligibility, authoritative prices, delivery eligibility/fees, age/quantity validation, persisted WhatsApp orders, stock reservations and simultaneous checkout, duplicate submissions, private guest-order access, expiry/cancellation, payment-before-dispatch, payment/refund records, coupons, signed webhooks and mocked provider verification, duplicate/late payments, CSV/XLSX import/export safety, upload rejection, drafts/publish/restore and SEO escaping.

New checks cover stable 20-product pages, invalid pagination, social/footer/editorial publishing and unsafe links, manager-only stock floor operations and movement history, migration preservation/idempotency, private system status, safe error messages, strict certificate handling, correct S3 client options, scheduled banners, product deduplication, manifest icons and service-worker avoidance of sensitive routes.

## Not verified against your accounts/devices

- The original deployed error cannot be reproduced from its generic message alone. Configuration and upload issues were corrected, and errors now provide actionable messages/references. A remaining deployment error must be matched to the new reference in Vercel runtime logs.
- Live Supabase networking, TLS certificate chain, table ownership, storage credentials and public bucket access.
- A real Paystack test/live transaction, webhook delivery, SMTP connection or email inbox delivery. Provider behaviour was mocked in automated payment tests.
- Native browser installation prompts on a real Android, iPhone or desktop device. The internal preview uses HTTP; installation must be checked on your HTTPS production domain.
- Every admin screen on a physical phone, external backups/restoration or production load capacity. CMS save/publish and admin permissions were verified through the real API.

## Deployment acceptance

Follow UPDATE-GUIDE.md. Confirm login on the exact configured PUBLIC_URL, open Admin → System status, upload one image, publish a banner/social change, set serviceable delivery fees, and create a test order. Verify the same WhatsApp order reference in the dashboard without treating a prefilled message as proof it was sent or paid. Complete a Paystack test-mode transaction and email delivery check before taking live payments. Check PWA installation and mobile scrolling on your customers' actual devices.
