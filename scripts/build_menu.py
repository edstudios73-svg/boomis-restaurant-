"""Builds menu.html from the MENU data below.

Edit a price or add a dish here, then run:  python3 scripts/build_menu.py
Prices are in Ghana cedis, from the current BOOMiiS food menu.
A price of None shows "Ask for price" with a WhatsApp link instead of an add button.
"""
import json
import re
from urllib.parse import quote
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# item = (name, description, price)  or  (name, description, [(option, price), ...])
# optional 4th value: photo in assets/
MENU = [
    {
        "id": "combos", "title": "Omo Naija Sizzling Combos", "short": "Combos",
        "blurb": "Our signature Nigerian plates, generous and complete.",
        "img": "ofada.jpg",
        "items": [
            ("Mission's Delight", "Ofada rice with ayamase sauce", 138, "ofada.jpg"),
            ("Buka Style", "Amala, ewedu, gbegiri and stew", 126),
            ("Many Nations Naija", "Jollof and fried rice, beef, plantain and chicken", 109),
            ("Ewa Agonyin", "Mashed beans with chilli pepper sauce and fried fish", 98),
            ("Spaghetti Surprise", "Jollof spaghetti with meat chunks and vegetables", 98),
            ("Mixit", "Rice and beans with assorted stew", 92),
            ("Yam Porridge", "Mashed yam cooked in palm oil with vegetables", 86),
            ("Famous B", "Beans porridge, plantain and fried beef", 86),
        ],
    },
    {
        "id": "rice", "title": "Rice Meals", "short": "Rice",
        "blurb": "Jollof, fried rice and plain rice, Ghanaian or Nigerian style.",
        "img": "jollof-chicken.jpg",
        "items": [
            ("Jollof Rice", "Ghanaian or Nigerian style, with your choice of protein",
             [("Chicken", 109), ("Peppered fish", 104), ("Peppered beef", 138), ("Peppered goat", 150), ("Peppered turkey", 150)], "jollof-plate.jpg"),
            ("Fried Rice", "Ghanaian or Nigerian style, with your choice of protein",
             [("Chicken", 109), ("Peppered fish", 104), ("Peppered beef", 138), ("Peppered goat", 150), ("Peppered turkey", 150)]),
            ("All Weather", "Assorted fried rice with veggies and chicken", 105),
            ("All Seasons", "Assorted jollof rice with chunks of beef, veggies and chicken", 105),
            ("Many Nations GH", "Jollof, fried rice, plantain, beef, chicken and coleslaw", 98, "jollof-chicken.jpg"),
            ("Simply Good", "Plain rice (Ghanaian or Nigerian) with assorted tomato stew", 138, "rice-beef.jpg"),
        ],
    },
    {
        "id": "ghana", "title": "Proudly Ghanaian", "short": "Ghanaian",
        "blurb": "Accra favourites, made with the same care.",
        "img": None,
        "items": [
            ("Palava Sauce", "Beef or goat, wele, salmon and egg", 120),
            ("Groundnut Soup", "Chicken drumstick, beef or goat and tuna", 117),
            ("Palmnut Soup", "Beef, goat and tuna", 117),
            ("Okro Stew", "Salmon, crab, wele and tilapia", 110),
            ("Fish Light Soup", "Tilapia, red fish or salmon", 109),
            ("Light Soup", "Chicken drumstick, goat or beef and fried red fish", 106),
            ("Waakye & Stew", "Beef, sausage, wele, red fish and egg", None),
        ],
    },
    {
        "id": "soups", "title": "Soups", "short": "Soups",
        "blurb": "Rich Nigerian soups. Pair with a swallow.",
        "img": "eba-egusi.jpg",
        "items": [
            ("Egusi", "", 132, "eba-egusi.jpg"),
            ("Assorted Okro", "", 132),
            ("Efo Riro", "Vegetable soup", 144, "yam-soup.jpg"),
            ("Edikaikong", "", 150),
            ("Oha", "", 150),
            ("Afang", "", 150),
            ("Ogbono", "", 120),
            ("Assorted Pepper Soup", "", 120),
            ("Goat Meat Pepper Soup", "", 140),
            ("Plain Ewedu", "", 23),
            ("Gbegiri", "", 23),
            ("Plain Okro", "", 23),
        ],
    },
    {
        "id": "swallow", "title": "Swallows", "short": "Swallows",
        "blurb": "Choose your swallow to go with any soup.",
        "img": "yam-egusi.jpg",
        "items": [
            ("Pounded Yam", "", 35, "yam-soup.jpg"),
            ("Fufu (Ghanaian)", "", 35),
            ("Fufu (Nigerian)", "", 30),
            ("Poundo Yam", "", 30),
            ("Omo Tuo", "Rice balls", 30),
            ("Semo", "", 25),
            ("Amala", "", 25),
            ("Konkonte", "", 20),
            ("Banku", "", 10),
            ("Eba", "", 8),
        ],
    },
    {
        "id": "stew", "title": "Stew", "short": "Stew",
        "blurb": "Four pieces slow-cooked in our tomato stew.",
        "img": "jollof-plate.jpg",
        "items": [
            ("Chicken in Stew", "4 pieces", 126),
            ("Fish in Stew", "4 pieces", 126),
            ("Beef in Stew", "4 pieces", 155),
            ("Goat in Stew", "4 pieces", 160),
            ("Turkey in Stew", "4 pieces", 160),
        ],
    },
    {
        "id": "pepper", "title": "Pepper Dem Gang", "short": "Pepper",
        "blurb": "For those who like it hot.",
        "img": "rice-beef.jpg",
        "items": [
            ("Hottie Turkey", "", 150),
            ("Chilli Goat Meat", "", 150),
            ("Peppered Beef", "", 138, "rice-beef.jpg"),
            ("Spicy Chicken Wings", "", 109),
            ("Gizzy", "Peppered gizzard", 75),
            ("Dodo Gizzard", "", 69),
        ],
    },
    {
        "id": "sides", "title": "Side Meals", "short": "Sides",
        "blurb": "Add a little extra to your plate.",
        "img": None,
        "items": [
            ("Plain Rice (Nigerian)", "", 45),
            ("Plain Rice (Ghanaian)", "", 40),
            ("Fried Yam", "", 35),
            ("Fried Plantain", "", 35),
            ("Boiled Yam", "", 35),
            ("Boiled Unripe Plantain", "", 35),
            ("Plain Beans", "", 30),
        ],
    },
    {
        "id": "extras", "title": "Extras", "short": "Extras",
        "blurb": "Extra protein for any dish.",
        "img": None,
        "items": [
            ("Turkey", "", 50),
            ("Goat", "", 45),
            ("Beef", "", 40),
            ("Tilapia", "", 40),
            ("Chicken", "", 35),
            ("Red Fish", "", 35),
            ("Salmon", "", 30),
            ("Ponmo / Wele", "", 20),
            ("Intestines", "", 20),
            ("Sausage", "", 5),
            ("Egg", "", 5),
        ],
    },
]

ARROW = '<svg aria-hidden="true"><use href="#i-plus"/></svg>'  # symbol defined once in menu.template.html


def cedi(n):
    return f"GH₵{n}"


def add_btn(name, price, label=None):
    full = f"{name} ({label})" if label else name
    text = f"{escape(label)} <b>{cedi(price)}</b>" if label else ARROW
    cls = "opt" if label else "add"
    aria = f"Add {full} to your order"
    return (f'<button type="button" class="{cls}" data-name="{escape(full, quote=True)}" '
            f'data-price="{price}" aria-label="{escape(aria, quote=True)}">{text}</button>')


def item_id(cat_id, name):
    return cat_id + "-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def render_item(item, cat_id):
    name, desc, price = item[0], item[1], item[2]
    photo = item[3] if len(item) > 3 else None
    search = f"{name} {desc}".lower()
    out = [f'<li class="dish{" has-photo" if photo else ""}" data-id="{item_id(cat_id, name)}" data-search="{escape(search, quote=True)}">']
    if photo:
        out.append(f'<img class="dish__img" src="assets/{photo}" alt="" loading="lazy">')
    out.append('<div class="dish__main"><div class="dish__row">')
    out.append(f'<h3>{escape(name)}</h3>')
    if isinstance(price, list):
        out.append(f'<span class="dots"></span><span class="from">from {cedi(min(p for _, p in price))}</span>')
        out.append('</div>')
        if desc:
            out.append(f'<p>{escape(desc)}</p>')
        out.append('<div class="opts">' + "".join(add_btn(name, p, lbl) for lbl, p in price) + '</div>')
    else:
        label = cedi(price) if price is not None else "Ask for price"
        out.append(f'<span class="dots"></span><span class="price">{label}</span>')
        out.append('</div>')
        if desc:
            out.append(f'<p>{escape(desc)}</p>')
    out.append('</div>')
    if price is None:
        ask = quote(f"Hello BOOMiiS, how much is the {name} today?")
        out.append(f'<a class="add ask" href="https://wa.me/233506387636?text={ask}" target="_blank" rel="noopener" '
                   f'aria-label="Ask the price of {escape(name, quote=True)} on WhatsApp">?</a>')
    elif not isinstance(price, list):
        out.append(add_btn(name, price))
    out.append('</li>')
    return "".join(out)


def render():
    tabs = "".join(f'<a href="#{c["id"]}">{escape(c["short"])}</a>' for c in MENU)
    sections = []
    for c in MENU:
        count = len(c["items"])
        if c["img"]:
            banner = (f'<div class="cat__banner"><img src="assets/{c["img"]}" alt="" loading="lazy">'
                      f'<div><span class="eyebrow">{count} dishes</span><h2>{escape(c["title"])}</h2>'
                      f'<p>{escape(c["blurb"])}</p></div></div>')
        else:
            banner = (f'<div class="cat__banner cat__banner--plain"><div><span class="eyebrow">{count} '
                      f'{"dish" if count == 1 else "dishes"}</span><h2>{escape(c["title"])}</h2>'
                      f'<p>{escape(c["blurb"])}</p></div></div>')
        items = "".join(render_item(i, c["id"]) for i in c["items"])
        sections.append(f'<section class="cat" id="{c["id"]}">{banner}<ul class="dishes">{items}</ul></section>')
    total = sum(len(c["items"]) for c in MENU)
    base = "https://boomiisgh.com"

    def offers(price):
        if isinstance(price, list):
            return [{"@type": "Offer", "name": lbl, "price": str(p), "priceCurrency": "GHS"} for lbl, p in price]
        if price is None:
            return {"@type": "Offer", "priceCurrency": "GHS"}
        return {"@type": "Offer", "price": str(price), "priceCurrency": "GHS"}

    schema = {"@context": "https://schema.org", "@graph": [
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": base + "/"},
            {"@type": "ListItem", "position": 2, "name": "Menu", "item": base + "/menu"}]},
        {"@type": "Menu", "@id": base + "/menu#menu", "name": "BOOMiiS Restaurant Menu", "url": base + "/menu",
         "inLanguage": "en-GH", "offers": {"@type": "Offer", "priceCurrency": "GHS"},
         "isPartOf": {"@id": base + "/#restaurant"},
         "hasMenuSection": [{
             "@type": "MenuSection", "name": c["title"], "description": c["blurb"],
             **({"image": f"{base}/assets/{c['img']}"} if c["img"] else {}),
             "hasMenuItem": [{
                 "@type": "MenuItem", "name": i[0],
                 **({"description": i[1]} if i[1] else {}),
                 **({"image": f"{base}/assets/{i[3]}"} if len(i) > 3 else {}),
                 "offers": offers(i[2])} for i in c["items"]]} for c in MENU]}]}
    tpl = (ROOT / "scripts" / "menu.template.html").read_text()
    html = (tpl.replace("{{TABS}}", tabs)
               .replace("{{SECTIONS}}", "\n".join(sections))
               .replace("{{TOTAL}}", str(total))
               .replace("{{SCHEMA}}", json.dumps(schema, ensure_ascii=False)))
    (ROOT / "menu.html").write_text(html)

    # Plain data copy of the menu for the admin dashboard (and for seeding a database later)
    data = [{"id": c["id"], "title": c["title"], "short": c["short"], "items": [
        {"id": item_id(c["id"], i[0]), "name": i[0], "desc": i[1],
         **({"options": [{"label": l, "price": p} for l, p in i[2]]} if isinstance(i[2], list) else {"price": i[2]}),
         **({"photo": i[3]} if len(i) > 3 else {})} for i in c["items"]]} for c in MENU]
    (ROOT / "menu-data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"menu.html written: {len(MENU)} sections, {total} dishes")


if __name__ == "__main__":
    render()
