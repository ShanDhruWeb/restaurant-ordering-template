# Runbook

What to do when something goes wrong. Stay calm, follow the steps, and tell the restaurant early (template at the end). Every API response has an `x-request-id` header; logs in Vercel → Project → **Logs** can be searched by it, by order id, or by Razorpay payment id.

## Site down

**Symptom**: menu does not load; uptime monitor alert.

1. Open `https://<site>/api/health`.
   - No response or a Vercel error page: check https://www.vercel-status.com. If Vercel is fine, check the latest deployment in Vercel; if it failed or the site broke right after a deploy, see **Bad deploy**.
   - `"db": false`: check the Neon console (project suspended? out of quota? outage at https://neonstatus.com). Check that `DATABASE_URL` in Vercel is the **pooled** string.
   - `"razorpayMode": "misconfigured"`: an environment variable is missing or wrong. Vercel → Logs shows "Environment variables are invalid" with the exact name.
2. While it is down, the restaurant can take orders at the counter as usual.

## Bad deploy (do this FIRST if trouble started after a deploy)

1. Vercel → Project → **Deployments** → the last good one → **⋯ → Promote to Production** (instant rollback).
2. Then investigate the broken commit at leisure. Database migrations are additive, so rolling back the code is safe; never delete a migration that has run.

## Payment failing for customers

1. `/api/health` must show the right `razorpayMode` (`live` in production).
2. Razorpay status: https://status.razorpay.com.
3. Try paying yourself for the cheapest item. If the Razorpay window does not open: browser console, look for CSP errors (see TESTING.md E).
4. Check the Razorpay account is active (KYC issues pause live payments) and that the keys in Vercel are the current ones (keys regenerated in the dashboard invalidate old ones).

## Customer says "I paid but there is no order"

1. Get the order number or the phone number, and ideally the UPI reference.
2. `/admin/payments` → press **Check payments now**. This asks Razorpay about every unpaid order from the last 24 hours. If the payment is found, the order appears on the board.
3. Look under **Late payments** (paid after the 15-minute expiry): staff choose **Accept and cook** or **Will refund**.
4. Look under **Paid in Razorpay but no paid order here**: find it in the Razorpay dashboard by payment id; refund it or serve the customer.
5. Search `/admin/history` by phone number.
6. Razorpay dashboard → Webhooks: if deliveries show errors or the webhook is **disabled**, fix the cause (usually a wrong `RAZORPAY_WEBHOOK_SECRET` or the site was down), then re-enable it. Reconcile covers the gap.
7. Still nothing and the customer has a bank debit: the payment may be "authorized" but not captured. Check the payment in the Razorpay dashboard; if not captured, make sure Payment Capture is set to **Automatic**. Razorpay auto-refunds uncaptured payments.

## Kitchen not alerted / orders not appearing on the tablet

1. Is the board showing **Live**? If "Offline, retrying": tablet Wi-Fi.
2. Did someone tap **Enable sound alerts** after the page was last opened? Browsers require it every time the page loads. Tablet volume up, not in Do Not Disturb.
3. Is the order actually paid? Only PAID orders appear. Check `/admin/history`.
4. Is **Accepting orders** on? (A red banner shows when it is off.)
5. Reload the page. If the login expired, log in again (sessions last 12 hours).

## Wrong menu / wrong price

1. Fix it in `/admin/menu`. Customers see it within 15 seconds.
2. Orders already placed keep the price they were placed at (by design). Refund the difference in Razorpay if needed.
3. If a whole menu needs replacing, edit `prisma/menu.json` and run `npm run db:seed -- --force` against the production database (this overwrites staff edits for the listed items).

## Locked out

- **Staff forgot password**: run `npm run create-admin` with their email and a new password (with the production `DATABASE_URL` in your local `.env`). This also logs them out everywhere.
- **"Too many attempts"**: wait 15 minutes, or ask a developer to delete rows from the `RateLimit` table.
- **Lost access to Vercel/Neon/GitHub**: account owner recovers via their email; this is why the agency, not a single student, owns these accounts.
- **Razorpay**: only the restaurant can recover their own Razorpay login.

## Suspected leaked secret

Rotate immediately: Razorpay key (dashboard → regenerate), webhook secret (edit webhook + Vercel variable), `SESSION_SECRET` (logs everyone out), database password (Neon → reset). Redeploy after each change.

## Message template for the restaurant

> Hi <name>, this is <your name> from <agency>. Since <time> customers <short description, e.g. "could not complete online payments">. Payments already made are safe in your Razorpay account. We are working on it and will update you by <time>. Meanwhile, please <take orders at the counter / turn off "Accepting orders" in the admin>. Sorry for the trouble.

When fixed:

> Fixed at <time>. Cause: <one line>. <Any orders/refunds they must check, with order numbers>. We have <what you changed so it does not repeat>.
