# BOOMiiS Restaurant

Mobile-first website for BOOMiiS Restaurant, No. 47 Adjiringano Road, East Legon, Accra.
Live: https://boomiis-restaurant.vercel.app

Static site, no build step for hosting:

- `index.html`, `styles.css`, `main.js`: home page (hero slideshow, dishes, FAQ, reservations, map)
- `menu.html`, `menu.css`, `menu.js`: full menu with search and WhatsApp ordering
- `robots.txt`, `sitemap.xml`, `llms.txt`, `site.webmanifest`, `404.html`

## Updating the menu

Prices and dishes live in `scripts/build_menu.py`. Edit them there, then regenerate the page:

    python3 scripts/build_menu.py

This rewrites `menu.html` (including its schema.org Menu data) from `scripts/menu.template.html`.

Designed by [Baiden Creatives](https://baiden-creatives.vercel.app).
