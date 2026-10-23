# Launching a new restaurant

About 2 to 3 hours for the first one, under an hour once you have done it before. Work through the steps in order and tick them off.

## 0. Before you start

- [ ] The restaurant has its **own** Razorpay account, fully activated (KYC done) in **its** name. The money goes straight to them; we never touch it.
- [ ] You have: logo (SVG or square PNG), a photo for social sharing (1200×630, optional), the menu with prices, address, phone, email, opening hours, number of tables, FSSAI number and GSTIN if they have them.
- [ ] Decide the domain, e.g. `order.<restaurant>.in`.

## 1. Create the repository

1. On GitHub, open the template repo and click **Use this template → Create a new repository** (private). Name it after the restaurant, e.g. `order-demo-kitchen`.
2. Clone it and add the template as a second remote, so you can pull improvements later (see [TEMPLATE_UPDATES.md](TEMPLATE_UPDATES.md)):
   ```bash
   git remote add template https://github.com/<org>/<template-repo>.git
   ```

## 2. Edit the config (the only code file you change)

Open `restaurant.config.ts` and fill in every field. The app checks the file at startup and lists anything wrong.

- `restaurant`: name, shortName (for the home-screen icon), slug, tagline, description, phone, whatsapp, email, address, mapsUrl, hours, cuisines, logo, ogImage, socials.
  - Hours: `days` such as `["mon","tue",…]`, `open` and `close` as 24-hour `"HH:MM"`. A close time earlier than the open time means after midnight (e.g. `"18:00"` to `"01:00"`).
- `theme.preset`: `"warm"` (terracotta and cream), `"fresh"` (green and white) or `"midnight"` (dark navy and amber). Override single colours in `theme.colours` (hex like `"#B4441F"`), the corner `radius` (`none`/`small`/`medium`/`large`) and `fonts` (any name from `src/config/fonts.ts`). **Check contrast**: run `npm test`; if you add colour overrides, check them at https://webaim.org/resources/contrastchecker/ (text needs 4.5:1).
- `ordering`: `types` (`dine_in`, `takeaway`), `tables` (a number, or labels like `["A1","A2","Patio 1"]`), `requirePhone`, `notesEnabled`, item limits, `orderExpiryMinutes` (default 15), `pricesIncludeTax` and `taxNote`, `enforceHours`.
- `legal`: business legal name, `gstin` and `fssai` if available (shown in the footer).
- `agency`: our name and link for the "Website by" credit; set `showCredit: false` to hide it.

## 3. Branding files

- Put the logo at `public/restaurant/logo.svg` (or `.png`, and update `restaurant.logo`).
- Optional social image: `public/restaurant/og.jpg` (1200×630) and set `ogImage: "/restaurant/og.jpg"`. If you leave `ogImage: "/og"`, one is generated from the name and theme.
- Optional menu photos: `public/restaurant/menu/<dish>.jpg`, about 600×450, under 150 KB each (compress at https://squoosh.app). Reference them as `"image": "/restaurant/menu/<dish>.jpg"` in `menu.json`. Dishes without a photo show a coloured block with the first letter.

## 4. Menu

Edit `prisma/menu.json`. Every category and item needs a unique `key` (lowercase, dashes), which is how re-seeding knows what already exists. Prices are strings in rupees: `"120"` or `"120.50"`. `"veg": true/false`. `"available": false` to start an item as sold out.

After launch, staff edit the menu in `/admin/menu`. Re-running the seed never overwrites their changes (unless you pass `--force`).

## 5. Database

1. Create a Neon project for **this restaurant only** (region: **AWS Asia Pacific (Mumbai)** if offered, otherwise Singapore).
2. Copy the **pooled** connection string (`-pooler` in the host) as `DATABASE_URL` and the **direct** one as `DIRECT_URL`.
3. Locally, with those in `.env`:
   ```bash
   npm run db:migrate
   npm run db:seed
   npm run create-admin     # one login per staff member who needs one; use strong passwords
   ```

## 6. Deploy on Vercel

1. Vercel → **Add New → Project** → import the repo.
2. Set every variable from [ENV.md](ENV.md) (Production environment). Start with the restaurant's **test** keys and `ALLOW_TEST_KEYS=true` while you test.
3. Function region: `vercel.json` already sets **Mumbai (bom1)**. Keep it near the database.
4. Deploy. Open `https://<project>.vercel.app/api/health`. It must show `"ok": true, "db": true`.
5. Cron: `vercel.json` schedules `/api/cron/reconcile` once a day (the Hobby plan limit). On a Pro plan, change the schedule to every 5 minutes (`*/5 * * * *`). The orders board also runs the same check every minute while it is open, and the tracking page checks each unpaid order, so a daily cron is only a safety net.

## 7. Domain

Vercel → Project → **Settings → Domains** → add `order.<restaurant>.in`, then add the DNS record Vercel shows at the restaurant's domain provider. Update `NEXT_PUBLIC_SITE_URL` to the final URL and **redeploy**.

## 8. Razorpay settings (in the restaurant's dashboard)

1. **Payment capture**: Account & Settings → Payment Capture → **Automatic** (immediately). The app expects captured payments.
2. **Webhook**: Account & Settings → Webhooks → **Add New Webhook**
   - URL: `https://order.<restaurant>.in/api/webhooks/razorpay`
   - Secret: a new random string. Put the same value in `RAZORPAY_WEBHOOK_SECRET` on Vercel and redeploy.
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`.
   - Alert email: our support address, so we hear if the webhook gets disabled.
3. Do this in **Test** mode first, then again in **Live** mode (they are separate).

## 9. Test (with test keys)

Work through **every** item in [TESTING.md](TESTING.md). Do not skip the "pay then close the tab" and "refund" tests.

## 10. Go live

1. In Vercel, replace the keys with the **live** keys (`rzp_live_…`), set the live webhook secret, and **remove** `ALLOW_TEST_KEYS`. Redeploy. The TEST MODE banner disappears.
2. Make one real small order (e.g. a ₹20 chai) with your own UPI, check it reaches the board, then refund it from the Razorpay dashboard and check the order shows "Refunded".
3. Print the QR sheet from `/admin/qr` (A4, colour or black and white) and stick one on each table. Scan two of them with a phone to check.

## 11. Hand-over to the restaurant

- [ ] Staff logins created; owner has changed their password (re-run `npm run create-admin` with their email).
- [ ] Kitchen tablet: open `/admin`, log in, tap **Enable sound alerts**, add the page to the home screen, set the tablet to never sleep while charging, volume up.
- [ ] Show staff: tapping a new order stops the beep; one tap moves it along; ✕ cancels (and that a cancelled paid order must be refunded in Razorpay); the **Accepting orders** switch; the banner message; sold-out toggles in Menu.
- [ ] Show the owner `/admin/payments` and `/admin/history` (CSV export for accounts).
- [ ] The restaurant has reviewed and edited the Terms, Privacy and Refund pages (they show a "Template text" notice until you set `legal.policiesReviewed: true` in the config; if the wording must change, edit `src/content/policies.ts`).
- [ ] Add the site to our uptime monitor: `https://order.<restaurant>.in/api/health`.
- [ ] Record the template version (`package.json` → `version`) and the go-live date in our client list.
