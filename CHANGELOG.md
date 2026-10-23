# Changelog

All notable changes to the template. Versions follow `package.json`. Each entry says whether restaurants need to change config, environment variables or run migrations.

## Unreleased

Makes the public website pass Razorpay's "Business website details" review.

- Pages: new `/pricing`, `/about`, `/shipping`; rewritten `/contact`, `/terms`, `/privacy`, `/refunds` ("Cancellation and Refund Policy"). Redirects from `/cancellation-and-refunds`, `/refund-policy` and `/delivery-policy`. All server-rendered with unique titles, descriptions and canonical URLs.
- Home page: server-rendered top section (description, address, today's hours, Order now, How it works, payment line).
- Footer on every public page, including checkout, tracking and receipt: all seven policy links, legal and trade name, tel and mailto links, GSTIN and FSSAI, server-computed copyright year.
- Config: new required `legal` fields and new `payments` and `policies` blocks. `src/lib/identity.ts` is the only reader of business details (enforced by a test).
- Policy text is built from config. The public "template text" banner was removed; the admin Launch checklist carries the reminder.
- Checkout: required consent checkbox, `Order.termsAcceptedAt`, seller block, order type in the summary. Razorpay Checkout `name` now comes from `payments.checkoutDisplayName` (the only payment-code change).
- New `/order/[id]/receipt` and `npm run sample-invoice` (`pdf-lib`).
- `robots.txt`, `sitemap.xml` (eight pages), Restaurant JSON-LD with `legalName` and `taxID`, per-page canonical and Open Graph tags.
- `npm run compliance -- <url>`, `complianceReady` in `/api/health`, admin Launch checklist.
- The tracking page's refund text uses `policies.refundTimelineText` instead of a typed "5 to 7 working days".

Config: **required changes** for existing restaurants. Add `legal.entityType`, `legal.registeredAddress`, `legal.grievanceContact`, `legal.jurisdictionCity`, `legal.policiesEffectiveDate`, and review `legal.isDemo`, `payments` and `policies` (see docs/COMPLIANCE.md). Env: none. **Migrations: `20261023120000_add_terms_accepted_at`. Apply it to every existing database (staging included) with `npm run db:migrate` before deploying the new code.**

## 1.0.0 (2026-10-23)

First release.

- Customer: menu with search, categories, veg filter and live availability; table QR (`/?t=5`); cart saved per browser tab; checkout with Razorpay Checkout; order tracking with automatic payment recovery; policy, contact, 404 and error pages; Restaurant JSON-LD, Open Graph, web manifest.
- Staff: login, orders board with sound alerts and wake lock, menu editor with audit log, history with CSV export, printable QR sheets, settings (accepting orders, banner), payment health page.
- Payments: one Razorpay order per order, idempotent `markOrderPaid` from verify, webhook and reconcile; amount checks; late-payment flagging; refund tracking via `refund.processed`.
- Ops: `/api/health`, structured logs with request ids, daily cron reconcile, `npm run reconcile`, CI workflow.

Config: new. Env: see docs/ENV.md. Migrations: `20261023000000_init`.
