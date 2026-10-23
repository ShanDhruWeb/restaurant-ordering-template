# Decisions

One line per decision, with the reason. Newest at the bottom of each section.

## Stack and versions

- **Next.js 16 (App Router), React 19, TypeScript 5.9 strict.** TypeScript 7 exists, but `typescript-eslint` only supports `<6.1`, so we stay on the latest 5.x.
- **ESLint 9 (flat config) with `eslint-config-next`.** ESLint 10 is out, but some plugins bundled by `eslint-config-next` (`eslint-plugin-react`) only declare support up to 9.
- **Prisma 7.10 (latest stable).** npm's `latest` tag currently points at `8.0.0-rc`, a release candidate; we do not ship a release candidate to restaurants.
- **Prisma 7 connection setup (from Prisma docs, "Manage database connections"):** `prisma.config.ts` points the CLI (migrations) at `DATABASE_URL_UNPOOLED`; at runtime Prisma Client uses the `@prisma/adapter-pg` driver adapter with the pooled `DATABASE_URL`. Prisma 7 has no `url`/`directUrl` in `schema.prisma` and no connection-URL pool parameters; the pool is configured on the adapter. We keep the pool small (`max: 5`) because each serverless instance has its own pool.
- **Function region is `sin1` (Singapore)**, set in `vercel.json` `regions`, matching the Neon database. Vercel only reads that field statically, so changing the region means editing `vercel.json` and redeploying; there is no runtime setting.
- **Prisma client is generated into `src/generated/prisma`** (the Prisma 7 `prisma-client` generator requires an output path). It is git-ignored and generated on `postinstall`.
- **Tailwind CSS 4** with CSS-variable design tokens. No component library.
- **Vitest** for tests. Integration tests use `DATABASE_URL_TEST` and are skipped with a visible message when it is not set.
- **No Razorpay Node SDK.** We call the four REST endpoints we need (`POST /v1/orders`, `GET /v1/orders/:id/payments`, `GET /v1/payments`, `GET /v1/payments/:id`) with `fetch` and Basic auth. This means one less dependency, full typing, and an easy mock.
- **`tsx`** runs the scripts in `scripts/` (create-admin, seed, reconcile).

## Razorpay facts we rely on (checked against razorpay.com/docs, October 2026)

- Amounts are in paise (smallest currency unit), currency `INR`.
- Order `receipt` is at most **40 characters**. Our order ids are cuids (about 25 characters), so we use the order id as the receipt.
- `notes` allows up to 15 keys of up to 256 characters each. We send `notes.order_id`.
- Checkout signature = `HMAC_SHA256(order_id + "|" + razorpay_payment_id, key_secret)` as hex.
- Webhook signature = `HMAC_SHA256(raw_body, webhook_secret)` as hex, sent in the `X-Razorpay-Signature` header. The raw body must be used, not re-serialised JSON.
- The webhook event id is in the **`x-razorpay-event-id`** header (unique per event). We dedupe on it. If it is ever missing we fall back to `event type + entity id`.
- Webhooks are delivered **at least once**, possibly out of order. Any non-2xx response (or no reply within **5 seconds**) is retried with exponential backoff for **24 hours**, after which the webhook is disabled and the account owner is emailed. Our handler therefore processes first and replies 200 only after success, and does little work so it stays well under 5 seconds.
- Events used: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`. The payment entity is at `payload.payment.entity` (`id`, `amount`, `currency`, `status`, `order_id`, `method`, `error_description`); `order.paid` also carries `payload.order.entity`; `refund.processed` carries `payload.refund.entity` (`id`, `payment_id`, `amount`) and `payload.payment.entity`.
- **Webhook payment entities contain no checkout signature.** The verified webhook signature is the proof of authenticity; we match by `payment.entity.order_id`.
- Razorpay notes a `payment.failed` can be followed by a `payment.captured` for the same order (late authorisation, UPI retries). We therefore never let a failure overwrite a captured payment or block a later capture.
- Fetch payments for an order: `GET /v1/orders/:id/payments`. List payments: `GET /v1/payments?from&to&count&skip`, where `from`/`to` are UNIX seconds and `count` is at most 100.
- Standard web checkout uses the **handler function** (not `callback_url`) plus webhooks for server-side confirmation. `modal.ondismiss` fires when the user closes the popup; `rzp.on('payment.failed')` fires on failure.
- Test mode: UPI `success@razorpay` / `failure@razorpay`; cards such as Visa `4100 2800 0000 1007` and Mastercard `5555 5100 0008 1006` with any CVV and future expiry. In test mode a cancelled UPI payment ends up successful. See `docs/TESTING.md`.
- Some in-app browsers (Instagram, Facebook Messenger, Opera Mini, UC) do not support the checkout iframe; Razorpay suggests `callback_url` for those. Recorded in KNOWN_GAPS; the tracking page plus reconcile still resolves those payments.

## Product and design decisions

- **Order ids are cuids** (not guessable). The tracking URL `/order/<id>` is the customer's "receipt"; anyone holding it sees only the safe projection.
- **Phone numbers** are stored as 10 digits (no +91). Validation: 10 digits starting with 6-9, after stripping spaces, dashes and a leading `+91`/`91`/`0`.
- **Rate limiter** is a fixed-window counter in Postgres (`RateLimit` table, upsert + increment). Simple, works on serverless, no Redis.
- **Session** is a JWT (HS256, `jose`) in an httpOnly cookie, 12-hour lifetime. The JWT carries the admin id and a `sessionVersion`; changing the password via `create-admin` bumps the version and logs out old sessions.
- **The "new order" signal for the kitchen** is the order becoming `paid` (the board polls for PAID orders). `markOrderPaid` changes status exactly once, so the kitchen sees each order exactly once. No separate event table is needed.
- **Reconcile from the tracking endpoint** is throttled per order to once per 10 seconds using the DB rate limiter, so polling clients cannot hammer Razorpay.
- **The expiry sweep** marks `pending_payment` orders past `expiresAt` as `expired`, but only after a final reconcile check against Razorpay, so a payment made at minute 14 that lands at minute 16 is still found. A payment that arrives after expiry is recorded as a **late payment** and flagged on `/admin/payments`.
- **Cancelling a paid order** sets `refundStatus = needed`. Staff refund from the Razorpay dashboard; the `refund.processed` webhook sets `refundStatus = refunded` (or `partial` if less than the paid amount).
- **The order total equals the subtotal** (prices include tax by default). When `pricesIncludeTax` is false we still charge the menu price and show the config `taxNote` (e.g. "GST extra as applicable" is NOT charged automatically). Automatic tax calculation is out of scope (see KNOWN_GAPS).
- **Opening hours**: the config gives the days plus one open/close window. A close time earlier than the open time means the window crosses midnight.
- **Order numbers**: `DailyCounter` keyed by the IST date string (`YYYY-MM-DD`), incremented with an atomic upsert inside the order-creation transaction. Numbers are assigned when the order is created (not when it is paid), so a few numbers are skipped when orders expire. That is acceptable and simpler.
- **No Socket.io.** The board polls every 4 seconds; menus revalidate within 15 seconds (the menu API is uncached and the client refetches every 15 seconds while the tab is visible).
- **Polling stops while the tab is hidden** and resumes on focus, to save mobile data and serverless invocations.
- **Fonts**: `next/font/google` requires literal font names at build time, so each preset's fonts are declared in `src/app/fonts.ts` from a fixed list of supported families. `restaurant.config.ts` picks fonts by name from that list (validated by zod).
- **CSP**: Razorpay does not publish the hosts Checkout needs, so script, frame, connect, image and form sources allow `https://*.razorpay.com` (plus `checkout.razorpay.com` and `api.razorpay.com` explicitly). Inline styles are allowed for next/font and Razorpay. Scripts use `'unsafe-inline'` because Next.js inline bootstrap scripts otherwise need a nonce, and nonce-based CSP forces every page to be dynamic. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. Not yet verified against live Checkout (see KNOWN_GAPS and TESTING.md E).
- **Mock gateway**: with `RAZORPAY_MOCK=true` the server creates fake `order_mock…` ids and checkout shows a built-in "Mock payment" sheet (pay / pay then close the tab / pay with every callback lost / fail / close). `/api/dev/mock-pay` records the payment in a `MockGatewayPayment` table (playing the part of Razorpay's servers), returns a real HMAC checkout signature and posts a real signed webhook to our own webhook URL, so the production verify, webhook and reconcile code runs unchanged. Mock mode is refused when `NODE_ENV=production`.

## Added during the build

- **Order numbers are allocated at creation** (not at payment), so expired orders leave gaps in the day's sequence. Simpler and race-free.
- **Reconcile runs in three places**: the tracking page (per unpaid order, at most every 10 s), the admin orders board (a full sweep, at most once a minute while a board is open) and the cron job. Vercel Hobby allows only daily crons, so `vercel.json` schedules a daily run; with the other two paths an open restaurant is effectively checked every minute.
- **Expiry never happens while Razorpay is unreachable**: a sweep skips expiring orders that have a Razorpay order if any Razorpay call failed in that run; the tracking page does the same per order.
- **A late payment is never auto-cooked**: it stays expired and flagged until staff choose "Accept and cook" (expired -> paid, the one extra transition beyond the spec) or "Will refund".
- **A second captured payment on an already paid order** is recorded as a duplicate and listed on /admin/payments for refund.
- **The browser verify call asks Razorpay for the payment** (`GET /v1/payments/:id`) to learn the real amount and currency before calling `markOrderPaid`, because the checkout response contains only ids and a signature. If that call fails, verify answers "pending" and webhook/reconcile finish the job.
- **Policies show a "template text" notice** until `legal.policiesReviewed: true` is set in the config, so no code edit is needed per restaurant.
- **The cart lives in sessionStorage** (per tab), as specified. A second tab starts with an empty cart; this is intended.
- **Staff login rate limits**: 10 attempts per IP and 5 per email per 15 minutes. Unknown emails are compared against a throwaway bcrypt hash so timing does not reveal which emails exist.
- **`npm run typecheck` uses `tsconfig.check.json`**: Next.js rewrites `tsconfig.json` to include `.next/dev/types`, which breaks the check while a dev server is running.
- **Sentry without the SDK**: when `SENTRY_DSN` is set, server errors are posted to Sentry's envelope endpoint with `fetch`. Keeps dependencies small; only server-side errors are reported.
- **`pricesIncludeTax: false`** still charges exactly the menu price and only shows `taxNote`; automatic GST calculation is a known gap.
- **Phone numbers in the database are 10 digits**; Razorpay prefill gets `+91` added.
- **Admin pages use soft deletes** for categories and items, so old orders keep their links. Order lines also snapshot name, price and veg flag.
- **Kitchen tickets print through the browser** (`window.print()` with a print-only block); no printer integration.

## Razorpay website verification (23 Oct 2026)

Checked against [Business website details](https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/), the [Dashboard FAQ](https://razorpay.com/docs/payments/dashboard/faqs.md) and the [Standard Checkout options](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration.md).

- **The brief and the docs agree on the page list.** New website: Shipping, Contact us, Pricing, Terms, Privacy, Cancellation and Refunds, plus a sample invoice (PNG, JPG, PDF). Updates and additional websites: About us, Contact us, Pricing, Terms, Privacy, Refunds (no shipping policy). We ship all seven pages either way.
- **What the docs add to the brief:** additional websites are only offered for the e-commerce category (up to five), need a written reason of at least 50 words, and are reviewed by hand. The FAQ splits approval into automated checks (3 to 5 minutes) and an agent review (24 to 48 hours). The brand name must be at least 80% similar to the company name or domain. The page we fetched was Razorpay's US-region rendering (it lists India among its regions), so India's flow may be worded slightly differently.
- **Checkout `name`** is documented as "Your Business/Enterprise name shown on the Checkout form" and is mandatory. We set it from `payments.checkoutDisplayName`. That is the only payment-code change.
- **The billing label** on Razorpay's emails to customers is a dashboard setting (brand name), not an API option, so the app cannot set it. COMPLIANCE.md tells the owner to set it to the same text.
- **Name similarity** is a stand-in (Levenshtein ratio on lower-cased letters and digits, against the legal name, the legal name without "Pvt Ltd" and similar, and the domain label). Razorpay does not publish its algorithm, so the check only warns.

### Product decisions for this work

- **One reader of business details: `src/lib/identity.ts`.** `tests/unit/identityGuard.test.ts` fails if anything else under `src` reads `config.restaurant/legal/payments/policies`, imports the config file, or hard-codes the demo values.
- **Defaults are resolved once, in the zod schema.** `legal.tradeName` defaults to `restaurant.name`; `legal.phone`, `legal.email` and `legal.operatingAddress` default to the restaurant's; `payments.checkoutDisplayName` defaults to the trade name. The rest of the code never sees `undefined`.
- **Required legal fields in the schema** (`entityType`, `registeredAddress`, `grievanceContact`, `jurisdictionCity`, `policiesEffectiveDate`): a restaurant that forgets one fails at start-up with a path-by-path message instead of shipping empty policy text. Forks of the template must add them (see TEMPLATE_UPDATES.md).
- **The public "template text" banner is gone.** The reminder lives in the admin Launch checklist until `legal.policiesReviewed` is true. `complianceReady` is false until then.
- **Policy text is built by pure functions of the identity** (`buildTerms` and friends in `src/content/policies.ts`), so a test can build a completely different restaurant and prove that no demo value leaks and every config value is used.
- **`/refunds` stays the canonical refund URL** (it already existed). `/cancellation-and-refunds` and `/refund-policy` redirect to it with 308, and `/delivery-policy` redirects to `/shipping`. The eight public pages and the footer list come from one array, `PUBLIC_PAGES` in `src/lib/seo.ts`.
- **`/checkout` and `/order/...` keep `noindex` and stay disallowed in `robots.txt`.** They are customer-specific pages, not part of the public site Razorpay reviews. All eight public pages carry no `noindex`.
- **Per-page `openGraph` must repeat the shared fields.** Next.js replaces the layout's `openGraph` object instead of merging it. The compliance crawler found `og:site_name` missing on its first run, so `pageMetadata` repeats `siteName`, `images` and `locale`.
- **Consent is enforced in `createOrder`, not only in the form.** `termsAccepted` must be exactly `true`, otherwise the API answers `400 consent_required` and creates no order. `termsAcceptedAt` is the server's clock. The column is nullable so existing rows stay valid, and the migration only adds a column.
- **The receipt is a plain data object (`src/lib/receipt.ts`)** drawn by both the page and the PDF builder, so the sample invoice cannot drift from the real receipt. It is built from the public order projection, which has no phone number or Razorpay ids.
- **The sample invoice uses `pdf-lib`** (pure JavaScript, no browser). Standard PDF fonts cannot draw the rupee sign, so the PDF prints "Rs.".
- **The compliance crawler places one unpaid order by default** to reach `/order/[id]` and the receipt (the brief requires footer checks on both). It is documented, expires by itself, and `--no-order` skips it. `complianceReady: false` is a WARN, not a FAIL, so the demo build can pass; placeholder text on live pages is a FAIL.
- **Prices are shown inclusive of tax and no GST breakup is calculated** (unchanged). The receipt says so and is not a tax invoice.
