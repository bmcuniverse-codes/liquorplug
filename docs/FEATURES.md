# Implemented features

## Storefront

- Responsive black/burgundy storefront; mobile search/navigation, two-column product cards on phones, single-column checkout and contained scrolling admin tables.
- Editable per-page banner carousels, desktop/mobile images, slide schedules, pause/previous/next controls and reduced-motion support.
- Predefined homepage sections with editable headings, visibility and ordering.
- Product catalogue: search, category, brand, size, price range, availability, featured/price/newest/name/bestseller sorting and pagination.
- Product pages, image galleries, related products, retail/scheduled-sale prices and stock indicators.
- Shopping bag, guest retail checkout, customer registration/login, password reset through configured email, account order history.
- Editable contact information, store policies, footer/header links, social links, colour/typography/logo settings and page copy.
- Age confirmation plus explicit adult confirmation at checkout.

## Wholesale

- Account applications and manager approval/rejection.
- One wholesale price per product, visible through the public product API only to an approved account.
- Minimum quantities by product and optional global minimum order value.
- Server-side account/price/minimum checks; no customer-supplied total is trusted.

## Checkout and orders

- Customer/contact/address/notes capture; enabled delivery-area selection; delivery fees and minimum spends.
- All 20 Lagos LGAs seeded; add neighbourhoods, disable areas and set ETAs.
- Optional pickup with store address/instructions.
- Paystack hosted checkout, server verification, signed webhook validation and transaction idempotency.
- Database-first WhatsApp checkout to **2348062833017**, including product lines, delivery/contact details and order reference.
- Private token access for guest orders; account ownership checks for account orders.
- Order/payment/stock statuses, timelines, internal notes, search, export and printable details.
- Manual confirmation of independently verified payments for active WhatsApp orders.
- Refund records; transfers are performed separately in Paystack/bank tools.
- Expired stock reservations, late-payment review and manager stock allocation when inventory becomes available.

## Inventory and promotions

- Product create/edit/hide/archive; one size per SKU, one wholesale price.
- Product image upload/gallery; CSV/XLSX import preview, validation and transactional commit; CSV exports.
- Inventory adjustments with a movement ledger; checkout stock reservations and oversell protection.
- Low-stock notifications.
- Scheduled sale prices; fixed/percentage coupons with dates, minimum spend and usage limits.
- Coupon/wholesale/sale stacking restrictions.

## Admin and operations

- Owner/manager/staff permissions enforced in API and interface.
- Sales/order summaries, product/category revenue, channel/pricing breakdowns, delivery/discount/refund totals and date selection.
- Customer contact details and wholesale status management.
- Staff account creation and role changes; session revocation on role changes.
- Website drafts, preview, publish and previous published versions restored to draft.
- Email outbox for order/payment/status/admin notifications, with configured SMTP worker.
- Activity log, persistent rate-limit buckets, CSRF protection, secure cookies, password hashing and protected uploads.
- Schema/migration runner, PostgreSQL support, local SQLite operation, backups and documented recovery.
- SEO metadata, product structured data, sharing image setting, sitemap and robots controls.
- Node/Docker deployment and supplied Vercel configuration.

## Supplied versus requiring configuration

| Included | Needs your input before live selling |
| --- | --- |
| Catalogue and reference prices | Verify your actual retail prices, stock and product data |
| Manufacturer photos for 23 entries | Upload remaining images and check bottle-size variants |
| Wholesale workflow | Set wholesale prices/minimums and approve applicants |
| Lagos delivery configuration | Set fees/ETAs and enable serviceable areas |
| Paystack integration code | Add your keys, configure webhook and complete a test payment |
| Email queue/worker | Add SMTP credentials and a scheduler where required |
| Local SQLite database support | Create production database for Vercel/multiple instances |
| Logo placeholder and policy drafts | Upload branding and publish final business policies |
| Backup script/recovery guide | Choose backup destination/retention and test recovery |

The website editor operates on predefined sections. It is not an unrestricted drag-and-drop builder. Native apps, loyalty, courier APIs, multi-warehouse operations and automated WhatsApp marketing are outside this version.
