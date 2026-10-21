# Verification and final acceptance

The production frontend compiles successfully. **38 automated tests pass.** Tests run against a temporary SQLite database with the same API routes used by the application. They do not contact live payment/email services.

## Automated checks

`npm test` verifies catalogue counts, 20 default-disabled LGAs, wholesale-price privacy, anonymous/staff permissions, CSRF/origin protection, authoritative pricing, delivery eligibility/minimums, adult/quantity validation, persisted WhatsApp orders, simultaneous stock requests, duplicate checkout keys, private guest-order access, wholesale approvals/minimums, reservation expiry, payment-before-dispatch, manual payment/fulfilment/refund records, cancellation idempotency, coupons, unconfigured payments, webhook signatures, provider verification mocks, duplicate webhook handling, amount mismatches, draft/publish/restore, invalid URLs, CSV preview/commit, malicious upload rejection, spreadsheet formula escaping and sitemap/robots output.

Additional tests cover SEO rendering/escaping, late-payment stock review/reallocation and duplicate-success payment recording. See the current test output for the final count.

`npm audit --omit=dev` completed with zero reported production dependency advisories at packaging time. A dependency lockfile is included. Run the audit again when installing or updating later.

## Not exercised against your accounts

- Actual Paystack test/live transactions and provider callback delivery.
- SMTP connectivity and inbox delivery.
- A hosted PostgreSQL database, storage bucket, Vercel deployment or production domain.
- An offsite backup job or real restore.
- Visual browser/device testing. The workspace did not expose the supported browser QA capability; a browser was not installed or substituted. Responsive styles were reviewed, but this is not a claim that rendered phone screenshots were inspected.

## Phone/desktop visual acceptance

Open the app on a phone and in browser responsive mode at **320, 360, 390, 414, 768 and 1280 CSS pixels**:

1. Confirm `document.documentElement.scrollWidth <= window.innerWidth` on the homepage, shop, product, cart, checkout and admin screens. Admin tables may scroll inside their own container, while the page must remain within the viewport.
2. Open/close the mobile menu, search, filter, sort and change catalogue pages.
3. Check long product names, large prices, images, empty states and error messages.
4. Add a stocked product, adjust quantities, choose an enabled location and review the order total.
5. Complete a WhatsApp checkout, open the prefilled message, refresh the confirmation and check the same reference in admin.
6. In Paystack test mode, complete one successful and one abandoned payment. Check that browser callbacks alone cannot mark orders paid and repeated webhooks do not reduce inventory twice.
7. Approve a wholesale account. Confirm retail accounts cannot see wholesale prices and minimum quantities are enforced.
8. Upload a desktop/mobile banner, save a draft, preview it, publish and refresh another browser to confirm it is live.
9. Test admin product and stock edits, CSV preview/import, order updates and staff permission restrictions.
10. Check keyboard focus, form labels, touch targets, carousel pause controls and reduced-motion settings. Confirm your product photos, policies, fees and contact details are ready for customers.

For serverless hosting, confirm the external maintenance schedule runs while the site is idle. For persistent Node hosting, keep the process running and retain the database/uploads across restarts.
