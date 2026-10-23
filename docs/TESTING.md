# Pre-launch test checklist

Do every check on the **deployed** site (not localhost), first with Razorpay **test** keys, then the final live check. Use a real phone on **mobile data** (Wi-Fi off) for the customer side and the kitchen tablet for the board. Write the date and your name next to each tick.

## Razorpay test values

Published by Razorpay (checked October 2026: razorpay.com/docs/payments/payments/test-card-details and …/test-upi-details). They work only with `rzp_test_` keys.

| Method            | Value                     | Result                                                                |
| ----------------- | ------------------------- | --------------------------------------------------------------------- |
| UPI ID            | `success@razorpay`        | Payment succeeds                                                      |
| UPI ID            | `failure@razorpay`        | Payment fails                                                         |
| Visa debit        | `4100 2800 0000 1007`     | Succeeds (any future expiry, any CVV; enter an OTP of 4 to 10 digits) |
| Mastercard credit | `5555 5100 0008 1006`     | Succeeds                                                              |
| RuPay credit      | `6527 6589 0000 1005`     | Succeeds                                                              |
| Visa              | `4100 2800 0006 0003`     | Fails: card declined                                                  |
| Visa              | `4100 2800 0008 0001`     | Fails: insufficient funds                                             |
| Any card          | OTP shorter than 4 digits | Fails                                                                 |

Note from Razorpay: in **test** mode, cancelling a UPI payment ends up as a _successful_ payment. Test UPI cancellation only in live mode.

## A. Basic checks

- [ ] `https://<site>/api/health` shows `"ok":true,"db":true` and `"razorpayMode":"test"`.
- [ ] The TEST MODE banner shows on the menu and on `/admin`.
- [ ] `/admin` without logging in goes to the login page. A wrong password is refused. After 5 wrong tries the login is blocked for a while.
- [ ] Menu loads on the phone over mobile data in under about 3 seconds. Search, category pills and the veg-only filter work.
- [ ] Scan a table QR: the page shows "Table N" and checkout does not ask for a table.

## B. Payments (most important)

- [ ] **Successful payment**: order with `success@razorpay`. The tracking page shows Paid, the order appears on the board with a beep within 5 seconds, and the Razorpay dashboard shows the payment as _captured_ for the same amount.
- [ ] **Failed payment**: order with `failure@razorpay`. You see "Payment failed" with a Pay button. Nothing appears on the board. Tap Pay again, use `success@razorpay`: the **same order number** becomes Paid. In the Razorpay dashboard both attempts belong to the same Razorpay order.
- [ ] **Close the popup**: start paying, close the Razorpay window. A "Payment was not completed" message appears; paying again works.
- [ ] **Pay then close the tab**: start paying with UPI, approve, and close the browser tab immediately. Within a minute the order is on the board (the webhook does this). Reopen the order link: it shows Paid.
- [ ] **Webhook really works**: Razorpay Dashboard → Webhooks → your webhook → recent deliveries show `200` responses.
- [ ] **Double tap**: tap "Pay" twice quickly. Only one order is created.
- [ ] **Refund**: cancel a paid order on the board (✕). It shows "refund needed" on `/admin/payments` and the customer's page says a refund is being arranged. Refund it in the Razorpay dashboard. Within a minute the order shows "Refunded" on the customer page and disappears from `/admin/payments`.
- [ ] **Expired order**: create an order, do not pay, wait 16 minutes. The order page says expired and Pay is gone.

## C. Menu and settings

- [ ] Mark an item **Sold out** in `/admin/menu`. Within 15 seconds the phone shows it as sold out and it cannot be added.
- [ ] Add an item to the cart, then mark it sold out, then press Pay: you get "Some items are no longer available" and the cart updates.
- [ ] Change a price while it is in a cart, press Pay: you get "Prices have changed" with the new total, and must confirm again.
- [ ] Turn **Accepting orders** OFF: the menu shows a closed message and Add buttons are disabled; turn it back ON.
- [ ] Banner message appears on the menu.
- [ ] `/admin/history` shows today's orders; CSV download opens correctly in Excel (names with Hindi/Marathi text display correctly).
- [ ] `/admin/qr` prints on A4 with every table; two printed codes scanned with a phone open the right table.

## D. Kitchen tablet

- [ ] Tap **Enable sound alerts**. A new order beeps repeatedly until you tap it.
- [ ] Turn Wi-Fi off on the tablet: "Offline, retrying" appears; turn it on: "Live" returns and missed orders appear.
- [ ] Print a kitchen ticket (🖨) from an order card.
- [ ] Leave the board open 10 minutes: the screen stays on (Chrome on Android supports this).

## E. Security spot checks

- [ ] Open `https://<site>/api/orders/<an order id>` in a browser: the response has **no** phone number, no `pay_`/`order_` Razorpay ids, no signature.
- [ ] The browser console on the checkout page shows **no** "Content Security Policy" errors while the Razorpay popup is open (desktop Chrome → F12 → Console). If you see one for a Razorpay domain, add that domain in `next.config.ts` and record it in `docs/DECISIONS.md`.

## F. Go-live check (live keys)

- [ ] Switch to live keys, remove `ALLOW_TEST_KEYS`, redeploy. `/api/health` shows `"razorpayMode":"live"`; the TEST MODE banner is gone.
- [ ] One real ₹20 order paid with your own UPI reaches the board.
- [ ] Refund it from the live dashboard; the order shows Refunded.

## Automated tests

`npm run check` runs about 240 unit and integration tests. Integration tests need `DATABASE_URL_TEST` (a separate, disposable database; they wipe it). They cover: price tampering, bad quantities, sold-out items, closed restaurant, 10 simultaneous payment confirmations, amount mismatch, late payments, webhook signature/dedupe/5xx-on-database-error, payment without any browser callback, no data leaks on the public order endpoint, Razorpay order reuse on retry, staff login, CSRF, audit log, and more. They do **not** talk to the real Razorpay; the checklist above is how that is verified.
