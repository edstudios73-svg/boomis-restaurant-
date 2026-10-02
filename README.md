# BOOMiiS Restaurant

Mobile-first website for BOOMiiS Restaurant, No. 47 Adjiringano Road, East Legon, Accra.
Live: https://boomiisgh.com

Static site, no build step for hosting:

- `index.html`, `styles.css`, `main.js`: home page (hero slideshow, dishes, FAQ, reservations, map)
- `menu.html`, `menu.css`, `menu.js`: full menu with search and WhatsApp ordering
- `admin.html`, `admin.css`, `admin.js`: staff dashboard at `/admin` (orders, MoMo payment checks, bookings, menu editor)
- `store.js`: the shared data layer used by the site and the admin
- `menu-data.json`: generated copy of the menu used by the admin
- `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`, `404.html`

## Admin and database (Supabase, live)

- `/admin` signs staff in with Supabase Auth. Typing `boomiis` as the username signs in as the email set in
  `supabase-config.js` (`adminAliases`); any staff email also works.
- `store.js` reads and writes Supabase: customers' orders and table requests are inserted from the website,
  staff changes to the menu are stored in `menu_changes` and applied on the menu page.
- Security lives in the database (`supabase/setup.sql`): the public key can only place orders, request
  tables and read menu changes. Only users listed in `public.staff` can read or change orders and bookings.
- `supabase-config.js` holds only the project URL and the **publishable** key. Never put the secret or
  service_role key in any website file.

### Setting up a new Supabase project
1. SQL Editor → paste and run `supabase/setup.sql`.
2. Authentication → Users → Add user (email + strong password, auto-confirm).
3. Run the "STEP 2" insert at the bottom of `setup.sql` with that email.
