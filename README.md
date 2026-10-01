# BOOMiiS Restaurant

Mobile-first website for BOOMiiS Restaurant, No. 47 Adjiringano Road, East Legon, Accra.
Live: https://boomiis-restaurant.vercel.app

Static site, no build step for hosting:

- `index.html`, `styles.css`, `main.js`: home page (hero slideshow, dishes, FAQ, reservations, map)
- `menu.html`, `menu.css`, `menu.js`: full menu with search and WhatsApp ordering
- `admin.html`, `admin.css`, `admin.js`: staff dashboard at `/admin` (orders, MoMo payment checks, bookings, menu editor)
- `store.js`: the shared data layer used by the site and the admin
- `menu-data.json`: generated copy of the menu used by the admin
- `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`, `404.html`

## Admin (demo mode)

Sign in at `/admin` with username `boomiis` and password `admin`.

Demo mode keeps orders, bookings and menu changes in the browser (localStorage), so the website and
the admin share data only on the same device, and the sign-in check runs in the browser. This is for
showing the workflow, not for real use. Connecting Supabase replaces the inside of `store.js` with
database calls and moves sign-in to Supabase Auth with row-level security.

## Updating the menu

Prices and dishes live in `scripts/build_menu.py`. Edit them there, then regenerate the page:

    python3 scripts/build_menu.py

This rewrites `menu.html` (including its schema.org Menu data) from `scripts/menu.template.html`.

Designed by [Baiden Creatives](https://baiden-creatives.vercel.app).
