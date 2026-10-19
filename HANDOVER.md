# BOOMiiS website: handover guide

Website: **https://boomiisgh.com** · Admin: **https://boomiisgh.com/admin** · Tracking: **https://boomiisgh.com/track**

## What the owner is getting

- **Public website:** home page, full menu, table bookings, FAQ, map, and SEO/Google setup.
- **Online ordering:**
  - Orders are paid in advance by MoMo: MTN 024 216 5783 or Telecel 050 638 7636, account name BOOMIIS LIMITED.
  - The customer chooses pickup or delivery. The delivery fee is paid to the rider.
- **Order tracking:**
  - After checkout the customer gets an order number and a **Track my order** button.
  - On `/track` they see live progress: received → payment confirmed → ready → on the way → delivered.
- **Admin dashboard (`/admin`):**
  - New orders arrive instantly, with a sound.
  - Staff can verify or reject MoMo payments, move orders along, confirm bookings, and edit the menu (prices, sold out, add or remove dishes).
- **WhatsApp updates:**
  - Every order card has a **Message** button.
  - After each status change the admin offers a ready-made WhatsApp message (with the tracking link) for that customer. One tap opens WhatsApp with the text filled in.
- **Flyers:** in `marketing/`.

## Daily use (for the staff)

1. Open **boomiisgh.com/admin** on the restaurant phone and sign in. Username `boomiis`, plus the password you set. Add it to the home screen.
2. A new order chimes. Check the MoMo app or SMS for that **amount and transaction ID**.
3. Tap **Verify payment**. WhatsApp opens with "your payment is confirmed…". Tap send.
   - If no money arrived, tap **Reject**. The "payment issue" message is offered instead.
4. As the food moves along, tap **Mark ready**, then **Out for delivery** or **Collected**, then **Delivered**. Each step offers the matching WhatsApp message.
5. **Bookings:** confirm or decline, then message the guest.
6. **Menu:** change prices, mark dishes sold out, add new dishes. The public menu updates within seconds.

## Handing over the accounts

Do these with the owner present. Each one is a transfer inside the service, so nothing has to be rebuilt.

### 1. Supabase (database and admin logins)

- **Simplest option:** make the owner's email the owner of the Supabase organisation.
  1. Go to supabase.com → Organization → **Team**.
  2. Invite the owner as **Owner**.
  3. Once they accept, remove yourself or downgrade yourself to Developer.
- **Alternative:** transfer the project.
  1. The owner creates their own organisation.
  2. Go to Project **Settings → General → Transfer project** and choose their organisation.
- **Then rotate the keys**, because the secret keys were shared in chat during development:
  1. Go to Settings → API Keys.
  2. Revoke and recreate the **secret** key.
  3. Roll the legacy **JWT secret** if it's enabled.
  4. The website only uses the **publishable** key. If you create a new one, update `supabase-config.js` and redeploy.
- **Admin password:** go to Authentication → Users → `boomiisgh@gmail.com` → **Send password recovery**, so that only the owner knows it.
- **More staff:**
  1. Go to Authentication → Users → **Add user**, using their email and a password.
  2. In the SQL Editor run:
     `insert into public.staff (user_id, name) select id, 'Name' from auth.users where email = 'their@email.com' on conflict do nothing;`
  3. To remove someone: `delete from public.staff where user_id = (select id from auth.users where email = 'their@email.com');`
- **Free-plan note:** free projects pause after about a week with **no activity**. Daily orders keep it awake. The **Pro plan ($25/month)** avoids pausing and adds daily backups.

### 2. GitHub (the code)

1. Merge the branch `claude/professional-brand-website-dc0fpc` into `main`, using a pull request.
2. Go to the repo's **Settings → General → Transfer ownership** and enter the owner's GitHub username. Alternatively, add the owner as a collaborator with Admin rights.

### 3. Vercel (hosting)

1. The owner creates a Vercel account (Hobby is free; Pro is needed for commercial use by a team).
2. Go to Project `boomiis-restaurant` → **Settings → General → Transfer project** and pick the owner's team.
3. Domains, settings and history move with it.
4. After a GitHub transfer, reconnect the repo under **Settings → Git**.
5. Set the **Production Branch** to `main`. From then on, every push to `main` goes live.

### 4. Domain (boomiisgh.com on Cloudflare)

- **Option A (easiest):** go to Cloudflare → **Manage Account → Members**, invite the owner as **Super Administrator**, then remove yourself.
- **Option B:** move the domain into the owner's own Cloudflare account. Cloudflare registrations move between accounts by contacting Cloudflare support, or by transferring the domain out to another registrar and back in. Any copy of the DNS must keep these records:
  - `A @ 76.76.21.21`, DNS only (grey cloud)
  - `CNAME www cname.vercel-dns.com`, DNS only (grey cloud)
- Turn on **auto-renew** and put the owner's card on file. If the domain expires, the site goes offline.
- **Email:** `boomiisgh@gmail.com` is the admin login and the Supabase contact. Make sure the owner controls that Gmail account.

### 5. Payments and phone numbers

The website only shows the MoMo numbers. Money goes straight to BOOMIIS LIMITED, and the website never touches it. If a number changes:
- edit `PAY` in `menu.js` and `MOMO` in `admin.js`
- update the numbers in `index.html` (FAQ), `llms.txt` and `scripts/menu.template.html`
- run `python3 scripts/build_menu.py`, then commit

## Automatic WhatsApp messages (optional upgrade)

Today the staff send each update with one tap from the admin. That costs nothing and works on any phone.

To have messages sent **automatically**, with nobody tapping, Meta requires its **WhatsApp Business Platform (Cloud API)**:

1. Create a **Meta Business** account (business.facebook.com) and verify the business.
2. In developers.facebook.com, create an app, add **WhatsApp**, and register a **phone number**.
   - It must be a number **not** already used in the WhatsApp app. A new SIM is easiest.
   - Note the **Phone number ID**.
   - Create a **System User** permanent access token.
3. Create a message **template** called `order_update` (category **Utility**, language English) with this body:
   `Hello {{1}}, here's an update on your BOOMiiS order #{{2}}: {{3}} Track it at boomiisgh.com/track`
   Wait for Meta's approval (usually minutes to hours).
4. In Supabase, go to **Edge Functions → Secrets** and add:
   - `WA_TOKEN`
   - `WA_PHONE_ID`
   - `HOOK_SECRET` (any long random text)
   - optionally `WA_TEMPLATE` and `WA_LANG`
5. Deploy the function: `supabase functions deploy order-whatsapp --no-verify-jwt`. The code is in `supabase/functions/order-whatsapp/`.
6. In the SQL Editor:
   1. Run the two `vault.create_secret(...)` lines at the top of `supabase/whatsapp-auto.sql`, using the same HOOK_SECRET.
   2. Run the rest of that file.
7. Place a test order. The customer gets "Your order is being processed" right away, then an update at every status change.
   - To switch it off, run `drop trigger if exists orders_whatsapp on public.orders;`.

Meta charges per conversation (Ghana utility messages are a few US cents each). Billing is set up in Meta Business.

## Checklist on handover day

- [ ] Owner controls boomiisgh@gmail.com
- [ ] Supabase: owner is Owner; admin password reset; secret keys rotated
- [ ] GitHub repo transferred or owner added; branch merged to `main`
- [ ] Vercel project transferred; production branch `main`; boomiisgh.com shows "Valid configuration"
- [ ] Cloudflare: owner is Super Administrator; auto-renew on
- [ ] Test order placed and tracked, then deleted (see "Clearing test data" below)
- [ ] Staff shown how to verify a payment and send the WhatsApp update

## Clearing test data

Run this in the Supabase SQL Editor:

```sql
delete from public.orders       where regexp_replace(customer_phone, '\D', '', 'g') like '%558362423' or customer_name ilike 'Daniel Baiden%';
delete from public.reservations where regexp_replace(phone, '\D', '', 'g')          like '%558362423' or name          ilike 'Daniel Baiden%';
```

Designed by Baiden Creatives · https://baiden-creatives.vercel.app

## Opening hours and pre-orders

- Online orders run **10:00 am–10:00 pm Monday to Friday** and **10:00 am–11:00 pm Saturday and Sunday** (Accra time).
- After closing, the site shows "We've closed for tonight" and customers can **pre-order** a time slot in the next 3 opening days.
- Pre-orders appear in the admin with a moon badge showing the time they're needed. Verify the payment as usual, then cook for that time.
- **To change the hours, edit two places:**
  1. The numbers at the top of `hours.js`.
  2. `boomiis_open_at` in `supabase/setup.sql`. Then re-run it in the SQL Editor.
- Also update the hours text on the home page (Find Us + FAQ) and in the closed popup in `scripts/menu.template.html`. Then run `python3 scripts/build_menu.py`.
