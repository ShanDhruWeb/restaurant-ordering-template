# Changelog

All notable changes to the template. Versions follow `package.json`. Each entry says whether restaurants need to change config, environment variables or run migrations.

## 1.0.0 (2026-10-23)

First release.

- Customer: menu with search, categories, veg filter and live availability; table QR (`/?t=5`); cart saved per browser tab; checkout with Razorpay Checkout; order tracking with automatic payment recovery; policy, contact, 404 and error pages; Restaurant JSON-LD, Open Graph, web manifest.
- Staff: login, orders board with sound alerts and wake lock, menu editor with audit log, history with CSV export, printable QR sheets, settings (accepting orders, banner), payment health page.
- Payments: one Razorpay order per order, idempotent `markOrderPaid` from verify, webhook and reconcile; amount checks; late-payment flagging; refund tracking via `refund.processed`.
- Ops: `/api/health`, structured logs with request ids, daily cron reconcile, `npm run reconcile`, CI workflow.

Config: new. Env: see docs/ENV.md. Migrations: `20261023000000_init`.
