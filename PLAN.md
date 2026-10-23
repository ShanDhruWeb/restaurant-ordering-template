# Build plan

Short plan for building the restaurant ordering template. The full spec lives in the master prompt; decisions are in `docs/DECISIONS.md`.

| Phase           | Output                                                                                                                                                                                    | Gate            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 0. Recon        | `PLAN.md`, `docs/DECISIONS.md` after reading QueClaw and the Razorpay / Prisma docs                                                                                                       | none            |
| 1. Foundation   | Next.js + TS strict + Tailwind + ESLint + Prettier + Vitest, env and config validation, Prisma schema and first migration, theme tokens and 3 presets, demo menu seed, `/api/health`, CI  | `npm run check` |
| 2. Domain core  | money, pricing, state machine, IST time, hours, rate limiter, `PaymentGateway` (Razorpay + mock), order creation, `markOrderPaid`, verify, webhook, reconcile, unit and integration tests | `npm run check` |
| 3. Customer UI  | menu, cart, checkout, payment, tracking, policy pages, 404 and error pages, SEO                                                                                                           | `npm run check` |
| 4. Admin UI     | login, orders board, menu editor, history and CSV, QR sheets, settings, payment health                                                                                                    | `npm run check` |
| 5. Hardening    | security checklist walk-through, edge cases, a11y and perf pass                                                                                                                           | `npm run check` |
| 6. Docs and ops | README, ONBOARDING, TESTING, RUNBOOK, TEMPLATE_UPDATES, ENV, KNOWN_GAPS, CHANGELOG                                                                                                        | `npm run check` |
| 7. Verification | clean install, migrate, seed, check, end-to-end mock flow, requirement tick list                                                                                                          | all green       |

## Folder map (target)

```
restaurant.config.ts        everything restaurant-specific (validated by zod)
prisma/schema.prisma        data model; prisma/menu.json is the seed menu
public/restaurant/          logo, og image, menu photos
scripts/                    create-admin, seed, reconcile (run with tsx)
src/app/                    pages and API route handlers
src/components/             UI components (read design tokens via CSS variables)
src/content/strings.ts      every customer- and staff-facing string
src/lib/                    small helpers: money, time, env, db, logging, http
src/server/                 domain logic: orders, payments, gateway, auth, rate limit
tests/                      unit and integration tests (Vitest)
```
