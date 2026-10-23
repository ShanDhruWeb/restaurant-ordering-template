# Passing Razorpay's website review

Razorpay will not give a restaurant live API keys until it has reviewed the restaurant's website. This template ships every page and detail the review looks for. This guide says which page answers which requirement, which config field drives it, and how to submit.

Sources, read on 23 Oct 2026:
[Business website details](https://razorpay.com/docs/payments/dashboard/account-settings/business-website-details/) and the [Dashboard FAQ](https://razorpay.com/docs/payments/dashboard/faqs.md). Razorpay changes these pages; re-read them before each submission. Differences we noticed are in [DECISIONS.md](DECISIONS.md).

> This is a checklist for a developer, not legal advice. The policy text is plain-English template text written from what the software actually does. **Have a lawyer or CA read it once** before the site goes live (see "Before you submit").

## Requirement, page and config field

| Razorpay asks for                                                                                                | Page in this template                                                              | Driven by (`restaurant.config.ts`)                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Website URL (live, working)                                                                                      | `/`                                                                                | `NEXT_PUBLIC_SITE_URL` (environment variable, not config)                                                                               |
| Pricing details                                                                                                  | `/pricing` (full menu, prices in ₹, no login or cart)                              | menu in the database, `ordering.taxNote`                                                                                                |
| About us                                                                                                         | `/about`                                                                           | `restaurant.description`, `restaurant.cuisines`, `legal.*`                                                                              |
| Contact us                                                                                                       | `/contact`                                                                         | `legal.phone`, `legal.email`, `legal.operatingAddress`, `legal.registeredAddress`, `legal.grievanceContact`, `restaurant.hours`         |
| Terms and conditions                                                                                             | `/terms`                                                                           | `legal.*`, `ordering.taxNote`, `ordering.orderExpiryMinutes`, `legal.jurisdictionCity`                                                  |
| Privacy policy                                                                                                   | `/privacy`                                                                         | `legal.*` (grievance contact), `legal.policiesEffectiveDate`                                                                            |
| Cancellation and Refunds policy (also called "Refunds policy" or "Cancellation/Refund policy")                   | `/refunds` (also reachable at `/cancellation-and-refunds` and `/refund-policy`)    | `policies.cancellationCutoff`, `policies.refundTimelineText`, `legal.phone`                                                             |
| Shipping policy                                                                                                  | `/shipping` (also `/delivery-policy`)                                              | `policies.preparationTimeMinutes`, `policies.collectionGraceMinutes`, `policies.deliveryEnabled`, `policies.delivery`, `ordering.types` |
| Sample invoice (PNG, JPG or PDF)                                                                                 | `npm run sample-invoice` writes `out/sample-invoice.pdf`                           | all of the above plus `legal.gstin`                                                                                                     |
| "Does your website require login to pay?"                                                                        | Answer **No**: nobody logs in to order or pay                                      | n/a                                                                                                                                     |
| Business name the same everywhere                                                                                | header, footer, titles, policies, receipt, JSON-LD, Open Graph, manifest, Checkout | `legal.businessLegalName`, `legal.tradeName`                                                                                            |
| Brand name on Razorpay Checkout and customer emails matches the registered name or domain (at least 80% similar) | Checkout `name` option                                                             | `payments.checkoutDisplayName` (defaults to `legal.tradeName`)                                                                          |

Every page is rendered on the server, so the text is in the raw HTML a crawler downloads, and every page has its own title (`Page name | Trade name`), meta description and canonical URL. The footer, with links to all seven pages, is on every public page including checkout, order tracking and the receipt.

## Filling in the `legal` block for a real restaurant

Use **exactly** the spelling on the Razorpay application: same capital letters, same "Pvt. Ltd." or "LLP", same punctuation. Razorpay compares the website with what it was given.

| Field                             | What to enter                                                                                                                         | Where to find the right value                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `legal.businessLegalName`         | The registered business name                                                                                                          | Razorpay application, KYC documents                                                                  |
| `legal.tradeName`                 | The public brand name                                                                                                                 | Razorpay application ("brand name"); often the same as `restaurant.name`                             |
| `legal.entityType`                | `proprietorship`, `partnership`, `llp`, `private_limited`, `public_limited`, `one_person_company`, `trust_or_society` or `individual` | Razorpay application, "business type"                                                                |
| `legal.registeredAddress`         | Address on the registration or KYC documents                                                                                          | KYC documents                                                                                        |
| `legal.operatingAddress`          | Where food is made and collected. Leave out if it is the same as `restaurant.address`                                                 |                                                                                                      |
| `legal.phone`, `legal.email`      | Public contact. Default to `restaurant.phone` and `restaurant.email`                                                                  | A number and mailbox someone actually answers                                                        |
| `legal.grievanceContact`          | Name, email and phone of the person who handles complaints                                                                            | The owner or manager                                                                                 |
| `legal.gstin`                     | 15-character GSTIN, only if registered                                                                                                | GST certificate                                                                                      |
| `legal.fssai`                     | 14-digit FSSAI licence number, only if held                                                                                           | FSSAI licence                                                                                        |
| `legal.jurisdictionCity`          | City whose courts the Terms name                                                                                                      | Usually the restaurant's city; ask the lawyer                                                        |
| `legal.policiesEffectiveDate`     | Date the policy text was last changed (`YYYY-MM-DD`)                                                                                  | Update whenever policy text or policy config values change                                           |
| `legal.policiesReviewed`          | `true` only after a lawyer or CA has read the policies                                                                                |                                                                                                      |
| `legal.isDemo`                    | `false`, or remove the line. `true` is only for the fictional demo                                                                    |                                                                                                      |
| `payments.checkoutDisplayName`    | Brand name shown in Razorpay Checkout. Leave out to use `legal.tradeName`                                                             | Must be at least 80% similar to the legal name or the domain; the app warns if not                   |
| `policies.refundTimelineText`     | How long a refund takes to reach the customer                                                                                         | Default: "5 to 7 business days, depending on your bank"                                              |
| `policies.cancellationCutoff`     | Until when an order can be cancelled                                                                                                  | Default: "before the kitchen starts preparing your order". Do not promise more than the kitchen does |
| `policies.preparationTimeMinutes` | Typical preparation time                                                                                                              | The kitchen's honest average                                                                         |
| `policies.deliveryEnabled`        | Leave `false`. The software has no delivery flow                                                                                      |                                                                                                      |

The app validates all of this at start-up and lists every problem. Phone numbers must be valid Indian numbers, pincodes 6 digits, GSTIN and FSSAI the right shape, and dates real dates.

The billing label on Razorpay's emails to customers is set in the Razorpay dashboard, not in this app. Razorpay says it must match the registered business name or the domain name. Set the dashboard brand name (Account & Settings, Checkout styling) to the same text as `payments.checkoutDisplayName`.

## Before you submit

1. `restaurant.config.ts`, `public/restaurant/` and `prisma/menu.json` hold the real restaurant's details. No "Demo Kitchen", no `.example` email, no zeros in the phone number.
2. The menu has every dish, real prices and, ideally, a photo for each dish. Razorpay asks that product images and information are complete.
3. A lawyer or CA has read `/terms`, `/privacy`, `/refunds` and `/shipping`. Fix any wording by changing the config values, or the builders in `src/content/policies.ts`, then update `legal.policiesEffectiveDate` and set `legal.policiesReviewed: true`. Until then the admin **Launch checklist** lists this as unfinished. Visitors never see a "template" notice.
4. The site runs on its real `https` domain with `NEXT_PUBLIC_SITE_URL` set to that final address.
5. The domain serves both `www.` and the bare domain, and one redirects to the other. This is a hosting (DNS and Vercel domain) setting, not code. The URL you give Razorpay must be the final address after that redirect, the same as `NEXT_PUBLIC_SITE_URL`; canonical links and the sitemap use it.
6. `npm run compliance -- https://your-site` shows no FAIL (see below).
7. `npm run sample-invoice` has produced `out/sample-invoice.pdf`.

## Submit your website to Razorpay

1. Log in to the Razorpay Dashboard.
2. Click **Account & Settings**, then **Business website detail** under **Website and app settings**.
3. First time: **Add website/app details**, then **Proceed to update website/app**. Later changes: **Edit** next to the website.
4. Choose **Website** and enter the website URL (the final canonical address).
5. Enter the page links. Razorpay names them slightly differently in different flows; give the same pages:

   | Razorpay label                                                                    | Link                      |
   | --------------------------------------------------------------------------------- | ------------------------- |
   | Pricing details                                                                   | `https://<site>/pricing`  |
   | About us                                                                          | `https://<site>/about`    |
   | Contact us                                                                        | `https://<site>/contact`  |
   | Terms and conditions                                                              | `https://<site>/terms`    |
   | Privacy policy                                                                    | `https://<site>/privacy`  |
   | Cancellation and Refunds policy, "Refunds policy" or "Cancellation/Refund policy" | `https://<site>/refunds`  |
   | Shipping policy (asked for on a new website)                                      | `https://<site>/shipping` |

6. Upload the sample invoice: `out/sample-invoice.pdf` (PNG, JPG or PDF are accepted).
7. For "Does your website require login from user to complete payment?" select **No**.
8. Click **Submit website for review**.

Additional websites (a second site on the same account) are only offered for the e-commerce business category, are reviewed by hand and need a written reason of at least 50 words.

## What happens next

- For a primary website Razorpay runs instant automated checks of the site and its policy pages. If they fail, the dashboard tells you which page; fix it, redeploy and re-enter the URL.
- A person then reviews it. Razorpay says approval takes about **24 to 48 hours** (automated checks 3 to 5 minutes, then an agent). The status shows on the dashboard.
- Razorpay may ask for clarification by email, WhatsApp, SMS or the dashboard. Answer under **Account & Settings** in the matching section. Typical questions: what the business sells, whether the name on the site matches the application, whether a policy page is missing.
- If the request is pending for a long time, contact Razorpay support with the merchant id, the website URL and the date submitted.
- When approved, generate the live keys and follow [ONBOARDING.md](ONBOARDING.md) step 10.

## Commands

```bash
# Crawl a running site (local production build or staging) and print a PASS/FAIL table.
# Exits 1 if anything fails. Compares the site with this checkout's restaurant.config.ts.
npm run compliance -- https://staging.yourrestaurant.in

# Same, without placing the throw-away order (order tracking and receipt pages are then skipped).
npm run compliance -- https://staging.yourrestaurant.in --no-order

# Write out/sample-invoice.pdf from the current config and an example order.
npm run sample-invoice
```

The checker downloads pages with plain HTTP (no JavaScript, like Razorpay's reviewer). It checks that all eight pages return 200 over HTTPS with the legal and trade name in the HTML; that every page, including checkout, order tracking and receipt, links all seven policy pages and that those links work; that the name is spelled the same everywhere; that phone, email and address are on `/contact` and in the footer with valid `tel:` and `mailto:` links; that `/pricing` shows ₹ prices; that no placeholder text (lorem, TODO, "coming soon", "example.com", "your restaurant", and "Demo Kitchen" unless `legal.isDemo`) is present; that `robots.txt` and `sitemap.xml` are right and nothing public is `noindex`; that canonical tags use the expected host; that each policy shows "Last updated"; that images have alt attributes; and that no public page needs a login. Menu items without a photo give a warning, not a failure.

Unless you pass `--no-order`, it places one **unpaid** throw-away order (customer name "Compliance Check") so it can reach `/order/<id>` and its receipt. That order never reaches the kitchen and expires by itself, but it does use one daily order number. Run it against staging; on the live site use `--no-order` or accept the one expired order.

`GET /api/health` returns `complianceReady`. It is `true` only when the config has no placeholder or demo values, the required legal fields are present and `legal.policiesReviewed` is `true`. It never includes secrets. The admin **Launch checklist** (a collapsible panel at the top of the Orders screen) lists what is left, with an instruction for each item, and disappears when nothing is left.

## The receipt is not a GST tax invoice

`/order/<id>/receipt` (linked from the tracking page once paid) and the sample invoice show: legal name, address, GSTIN (if set), order number, date and time in IST, items, quantities, unit prices, total in ₹ and "Paid via Razorpay". They say "Prices are inclusive of applicable taxes" and do **not** compute any GST breakup, show Razorpay ids or phone numbers. They are order and payment receipts, **not** GST tax invoices. What a restaurant must issue (for example, whether a tax invoice or bill with a GST breakup is required for each order) depends on its registration and turnover. **Ask the restaurant's CA** and, if a tax invoice is required, issue it from the restaurant's billing system.

The sample-invoice PDF prints amounts as "Rs." because PDF standard fonts cannot draw the ₹ sign; the on-screen receipt uses ₹.

## What the policies say, and where it comes from

Every statement in the policies describes what the software does. If you change the software, change the text.

| Statement                                                                                       | Why it is true                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cancellation is by phone; there is no cancel button                                             | There is no customer-facing cancel in the app. Staff cancel from the kitchen board                                                               |
| A cancelled paid order shows "refund being arranged" until refunded                             | Cancelling a paid order sets `refundStatus = needed`                                                                                             |
| Refunds go back to the original payment method through Razorpay; the timeline comes from config | Staff refund from the Razorpay dashboard; the `refund.processed` webhook marks the order Refunded                                                |
| A late or duplicate payment is flagged; staff will either prepare the order or refund           | Late payments are flagged on `/admin/payments` and need "Accept" or "Will refund". Duplicate captures are listed for refund. No hour is promised |
| Card and UPI details never reach us                                                             | They are entered in Razorpay's window; the database stores only payment ids, amount, status and method type                                      |
| Data collected: name, mobile number, table, items, note, time of consent, payment reference     | These are the columns of the `Order` and `Payment` tables                                                                                        |
| Cart and contact details live in the browser's session storage                                  | `sessionStorage` is used for both; no tracking cookies                                                                                           |
| Home delivery is not offered                                                                    | Unless `policies.deliveryEnabled`, which needs a delivery flow the template does not have                                                        |
| Unpaid orders are cancelled automatically after N minutes                                       | `ordering.orderExpiryMinutes` and the expiry sweep                                                                                               |

Not implemented, so not promised: automatic deletion of old data (the Privacy Policy says customers can ask for deletion; staff do it by hand), customer notifications by SMS or WhatsApp, in-app refunds.

## Applying the consent migration to existing databases

This work adds `Order.termsAcceptedAt` (migration `20261023120000_add_terms_accepted_at`). Apply it to **every existing database, staging included, before deploying the new code**, because the new code writes that column:

```bash
npm run db:migrate        # prisma migrate deploy, using DATABASE_URL_UNPOOLED
```

The migration only adds a nullable column, so it is safe to run while the old code is live. Orders created before it have no `termsAcceptedAt`.
