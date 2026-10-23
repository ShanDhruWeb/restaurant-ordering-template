# Known gaps

Things that are not done, not verified, or deliberately left out. Keep this honest; remove an item only when it is truly fixed.

## Not verified (needs real Razorpay test keys and a public URL)

- **Live Razorpay test mode end to end.** The whole flow was built and tested against the mock gateway, which signs checkout responses and webhooks exactly as documented by Razorpay. The real API calls (`POST /v1/orders`, `GET /v1/payments/:id`, `GET /v1/orders/:id/payments`, `GET /v1/payments`) are implemented from the docs but have not been run against Razorpay. Follow docs/TESTING.md with test keys before the first launch.
- **Real webhooks.** Webhook handling is tested with locally signed payloads in Razorpay's documented shape. Real delivery needs a deployed site.
- **CSP with the real Checkout popup.** The policy allows `*.razorpay.com`, but has not been checked against the live popup (TESTING.md E). If Razorpay needs another domain (e.g. for a specific bank's 3-D Secure page inside the iframe), add it in `next.config.ts`.
- **Lighthouse** was run locally on a production build (mobile preset): menu performance 92, accessibility 100, best practices 100, SEO 100; checkout performance 94, accessibility 100 (its SEO score of 63 is because checkout is deliberately `noindex`). Not measured on Vercel or a real mid-range phone.
- **Wake Lock and Web Audio** were exercised in desktop Chrome only, not on a real Android tablet.
- **Printing** (kitchen tickets and the A4 QR sheet) was checked on screen and in the print CSS, not on a physical printer.
- **`npm run create-admin`** was tested with piped input (create, reset, short password, mismatch). The hidden-password prompt in a real terminal was not exercised.
- **Neon specifically.** Migrations, tests and the end-to-end flow ran against a local PostgreSQL 18. The pooled/direct connection split follows Prisma 7's documentation but was not run against Neon's pooler.

## Razorpay website review (this work)

- **Razorpay's real review was not run.** The pages are built from Razorpay's published requirements and checked with our own crawler (`npm run compliance`). Only Razorpay can confirm approval, and its automated checks or agents may want something the docs do not mention.
- **The policy text has not been read by a lawyer or CA.** It is plain-English template text written from what the software does. `legal.policiesReviewed` stays `false` in the shipped config.
- **Not a GST tax invoice.** Receipts and the sample invoice do not compute GST or carry invoice numbers in a GST sequence. Each restaurant's CA must say what it needs to issue.
- **No automatic data deletion.** The Privacy Policy says customers can ask for their data to be deleted or anonymised. Staff must do that by hand in the database; there is no retention job.
- **The sample-invoice PDF prints "Rs."** instead of the rupee sign (standard PDF fonts have none).
- **The checkout consent checkbox has no automated browser test** (the project has no browser test runner). The server rule is tested; see the final report for how the button was checked.
- **The brand-name similarity check is an approximation** of Razorpay's undocumented 80% rule.
- **Menu photos in the ordering view use `alt=""`** because the dish name is printed next to them. The `/pricing` page uses the dish name as alt text.
- **The `www` and bare-domain redirect** is a hosting setting and cannot be verified by the app.

## Deliberately out of scope

- **Automatic GST calculation.** Prices are charged exactly as listed. Restaurants that list prices before tax must include tax in the menu price or handle invoicing outside the app.
- **Refunds from the app.** Staff refund in the Razorpay dashboard; the app only reflects `refund.processed`. (Spec decision.)
- **In-app browsers** (Instagram, Facebook Messenger, UC Browser, Opera Mini): Razorpay says its iframe Checkout may not work there and recommends `callback_url` redirects. Not implemented. Customers who pay anyway are still recovered by the tracking page and reconcile; customers who cannot open the popup should open the link in Chrome.
- **Hindi/Marathi translations.** All text is in `src/content/strings.ts` and `adminStrings.ts`, ready to translate, but only English ships.
- **Image upload in the admin.** Photos are added to `public/restaurant/menu/` and referenced by path (needs a redeploy). Uploading would need object storage.
- **Customer notifications** (SMS/WhatsApp when the order is ready). The tracking page polls instead.
- **Multiple opening windows per day** (e.g. lunch and dinner with a break). The config supports one window per day set.

## Dependencies

- `npm audit` reports **5 high-severity** findings, all in **development-only** tooling: `braces` via `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next` 16.4.2 (GHSA-vfj7-8cjw-p6xm, a denial of service on crafted glob patterns). `braces` 3.0.3 is already the newest release, and npm's suggested fix downgrades `eslint-config-next` to 14, which is not compatible with Next.js 16. It never runs in production (`npm audit --omit=dev` reports 0). Re-check when a new `eslint-config-next` is released.
- Prisma's npm `latest` tag points to `8.0.0-rc`; we pin the latest stable, 7.10.1.
