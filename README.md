# Restaurant Ordering Template

A mobile-first menu and ordering website for **one restaurant per deployment**. Customers scan a table QR code (or open the link), order, and pay with UPI, card or netbanking through **the restaurant's own Razorpay account**. The kitchen sees paid orders on a tablet within seconds. The template never holds anyone's money.

The shipped demo is **Demo Kitchen**, a fictional restaurant in Pune.

## Quick start (no keys needed)

You need Node.js 20.9 or later and a PostgreSQL database (a free [Neon](https://neon.tech) project is fine).

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, DIRECT_URL, SESSION_SECRET, CRON_SECRET
                              # leave RAZORPAY_MOCK="true" for local work
npm run db:migrate            # create the tables
npm run db:seed               # load the demo menu from prisma/menu.json
npm run create-admin          # create your staff login (asks for email + password)
npm run dev                   # http://localhost:3000
```

- Menu: http://localhost:3000 (try http://localhost:3000/?t=5 for table 5)
- Kitchen board: http://localhost:3000/admin

In mock mode a "Mock payment" sheet replaces Razorpay Checkout. It can simulate a normal payment, a customer who closes the tab, a lost browser callback **and** lost webhook (recovered by reconcile), and a failure.

## Scripts

| Command                  | What it does                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Local development server                                                                                        |
| `npm run check`          | Typecheck, lint, format check, tests, production build. Must pass before every merge.                           |
| `npm test`               | Tests only. Integration tests need `DATABASE_URL_TEST` (a separate, disposable database).                       |
| `npm run db:migrate`     | Apply database migrations (`prisma migrate deploy`)                                                             |
| `npm run db:migrate:dev` | Create a new migration after editing `prisma/schema.prisma` (developers only)                                   |
| `npm run db:seed`        | Add missing menu items from `prisma/menu.json`. Never overwrites prices staff changed. `-- --force` overwrites. |
| `npm run create-admin`   | Create a staff login, or reset a password (logs that account out everywhere)                                    |
| `npm run reconcile`      | Check unpaid orders against Razorpay and expire stale ones (same as the cron job)                               |

## Folder map

```
restaurant.config.ts    EVERYTHING restaurant-specific: name, address, hours, theme, tables, legal
public/restaurant/      logo, social image, menu photos
prisma/menu.json        the starting menu (seed data)
prisma/schema.prisma    database tables (all money is Int paise)
scripts/                create-admin, seed, reconcile
src/app/                pages and API routes
  (shop)/               customer pages: menu, checkout, order tracking, policies
  admin/                staff pages: login, orders board, menu, history, payments, QR, settings
  api/                  JSON API (orders, payments, webhook, cron, admin)
src/components/         shared UI pieces
src/config/             config validation (zod) and the 3 theme presets
src/content/            every piece of UI text (strings.ts, adminStrings.ts) and policy text
src/lib/                small helpers: money, IST time, env, db, logging, HTTP
src/server/             business logic: orders, payments, gateway (Razorpay + mock), admin
tests/                  unit and integration tests
docs/                   onboarding, testing, runbook, env, decisions, known gaps
```

## How payments stay safe

- Prices are always computed on the server from the database, in integer paise.
- Each order has exactly **one** Razorpay order; retries reuse it.
- One function, `markOrderPaid`, marks orders paid. It is called by the browser callback, the webhook and the reconcile check, and is idempotent (tested with 10 concurrent calls).
- The paid amount must equal the order total, otherwise the order is not marked paid and shows up on `/admin/payments`.
- A payment that arrives after the order expired is recorded and flagged ("late payment"), never lost.
- Webhooks are verified on the raw body, deduplicated, and processed **before** replying; failures return 5xx so Razorpay retries.

More detail: [docs/DECISIONS.md](docs/DECISIONS.md).

## Documentation

- [docs/ONBOARDING.md](docs/ONBOARDING.md): launching a new restaurant, step by step
- [docs/TESTING.md](docs/TESTING.md): pre-launch payment checklist
- [docs/RUNBOOK.md](docs/RUNBOOK.md): what to do when something breaks
- [docs/ENV.md](docs/ENV.md): every environment variable
- [docs/TEMPLATE_UPDATES.md](docs/TEMPLATE_UPDATES.md): pulling template improvements into a restaurant's repo
- [docs/DECISIONS.md](docs/DECISIONS.md) and [docs/KNOWN_GAPS.md](docs/KNOWN_GAPS.md)
- [CHANGELOG.md](CHANGELOG.md): template versions
