"""Builds menu.html from the MENU data below.

Edit a price or add a dish here, then run:  python3 scripts/build_menu.py
Prices are in Ghana cedis and were transcribed from the printed BOOMiiS menu.
"""
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
            ("Mission's Delight", "Ofada rice and ayamase sauce", 80, "ofada.jpg"),
            ("Buka Style", "Amala, ewedu, gbegiri, stew, goat meat, beef, ponmo and inu eran (tripe)", 75),
            ("Yam Porridge", "Mashed yam cooked in palm oil with fats and vegetables", 55),
            ("Ewa Agonyin", "Mashed beans with chilli pepper sauce and fried fish", 62),
            ("Famous 'B'", "Beans porridge, plantain and fried beef", 52),
            ("Mixit", "Rice and beans with assorted stew (ponmo, goat, beef and fish)", 57),
            ("Spaghetti Surprise", "Jollof spaghetti with meat chunks and vegetables, served with cold zobo", 58),
            ("Many Nations Naija", "Nigerian jollof rice, fried rice, beef, plantain and chicken", 62),
            ("PH Style", "2 boles (roasted plantain) with fish and palm oil pepper sauce",
             [("Salmon", 55), ("Redfish", 70), ("Croaker", 95)]),
        ],
    },
    {
        "id": "rice", "title": "Rice Meals", "short": "Rice",
        "blurb": "Jollof, fried rice and plain rice, done properly.",
        "img": "jollof-chicken.jpg",
        "items": [
            ("All Weather", "Assorted fried rice with chopped carrots, bell pepper, sweet corn, green peas, gizzard and choice of protein", 70),
            ("All Seasons", "Assorted jollof rice with chunks of beef and chicken, vegetables and salad", 65),
            ("All Springs", "Plain rice, spring onions and carrots with prawn 'n' sauce", 85),
            ("Many Nations GH", "Jollof, fried rice, plantain, fried beef, chicken and coleslaw", 50, "jollof-chicken.jpg"),
            ("Simply Good", "Plain rice with tomato stew. Options: chicken, beef, goat meat or fish", 72, "rice-beef.jpg"),
            ("Jollof Rice", "Smoky jollof with your choice of protein",
             [("Chicken", 62), ("Peppered beef", 65), ("Peppered goat", 70), ("Peppered turkey", 75)], "jollof-plate.jpg"),
        ],
    },
    {
        "id": "soups", "title": "Soupy", "short": "Soups",
        "blurb": "Rich Nigerian soups. Pair with a swallow from Food Balls.",
        "img": "eba-egusi.jpg",
        "items": [
            ("Egusi Soup", "", 70, "eba-egusi.jpg"),
            ("Assorted Okra", "", 68),
            ("Edikaikong", "", 80),
            ("Oha Soup", "", 80),
            ("Ogbono", "", 75),
            ("Afang Soup", "", 75),
            ("Efo Riro", "Vegetable soup", 78, "yam-soup.jpg"),
            ("Assorted Pepper Soup", "", 75),
            ("Goat Meat Pepper Soup", "", 80),
            ("Catfish Pepper Soup", "", 90),
            ("Plain Ewedu", "", 15),
            ("Gbegiri", "Beans stew", 15),
            ("Plain Okro", "", 15),
        ],
    },
    {
        "id": "swallow", "title": "Omo Naija Food Balls", "short": "Swallows",
        "blurb": "Choose your swallow to go with any soup.",
        "img": "yam-egusi.jpg",
        "items": [
            ("Pounded Yam", "", 25, "yam-soup.jpg"),
            ("Poundo Yam", "", 17),
            ("Semo", "", 15),
            ("Amala", "", 15),
            ("Fufu", "", 10),
            ("Eba", "", 6),
        ],
    },
    {
        "id": "stew", "title": "Stew", "short": "Stew",
        "blurb": "Proteins slow-cooked in our tomato stew. Pick your portion.",
        "img": "jollof-plate.jpg",
        "items": [
            ("Chicken in Stew", "", [("4 pieces", 58), ("6 pieces", 75), ("8 pieces", 88)]),
            ("Beef in Stew", "", [("4 pieces", 70), ("6 pieces", 85), ("8 pieces", 96)]),
            ("Goat Meat in Stew", "", [("4 pieces", 75), ("6 pieces", 97), ("8 pieces", 120)]),
            ("Turkey in Stew", "", [("4 pieces", 78), ("6 pieces", 105), ("8 pieces", 130)]),
            ("Fish in Stew", "", [("4 pieces", 55), ("6 pieces", 70), ("8 pieces", 85)]),
        ],
    },
    {
        "id": "pepper", "title": "Pepper Dem Gang", "short": "Pepper",
        "blurb": "For those who like it hot.",
        "img": "rice-beef.jpg",
        "items": [
            ("Hottie", "Beef cubes in hot pepper sauce", 60, "rice-beef.jpg"),
            ("Chilli", "Grilled goat meat in chilli sauce", 64),
            ("Spicy Wings", "Chicken wings with hot barbecue sauce", 55),
            ("Fishful", "Fried fish dipped in green pepper sauce. Options: redfish, tilapia or salmon", 80),
            ("Gizzy", "Fried gizzard in green pepper sauce", 40),
            ("Dodo Gizzard", "", 35),
        ],
    },
    {
        "id": "grills", "title": "Grills & Roasts", "short": "Grills",
        "blurb": "Kebabs, suya and roasts off the grill.",
        "img": None,
        "items": [
            ("Suya Special", "", 50),
            ("Turkey Kebab", "", 45),
            ("Goat Meat Kebab", "", 35),
            ("Chicken Wings Kebab", "", 30),
            ("Sausage Kebab", "", 20),
            ("Grilled Tilapia", "", 70),
            ("Grilled Catfish", "", 120),
            ("Roasted Fish Mayo", "", 80),
            ("Chicken Steak", "", 120),
            ("Beef Steak", "", 150),
            ("Roasted Turkey", "With cranberry sauce", 125),
        ],
    },
    {
        "id": "ghana", "title": "Proudly Ghanaian", "short": "Ghanaian",
        "blurb": "Accra favourites, made with the same care.",
        "img": "swallow-soup.jpg",
        "items": [
            ("Banku & Tilapia", "", 55),
            ("Banku & Seafood Okro", "", 60),
            ("Banku & Light Soup", "", 45),
            ("Banku & Groundnut Soup", "", 45),
            ("Fufu & Light Soup", "", 55),
            ("Fufu & Fisherman Soup", "", 65),
            ("Boiled Yam & Palava Sauce", "", 50),
            ("Boiled Plantain & Palava Sauce", "", 65),
            ("Omo Tuo & Groundnut Soup", "Rice balls", 50),
        ],
    },
    {
        "id": "sides", "title": "Side Meals", "short": "Sides",
        "blurb": "Add a little extra.",
        "img": None,
        "items": [
            ("Fried Potato Chips", "", 25),
            ("Fried Yam Chips", "", 20),
            ("Fried Plantain", "", 20),
            ("Plain Rice", "", 30),
            ("Plain Beans", "", 20),
            ("Dodo Gizzard", "", 35),
        ],
    },
    {
        "id": "special", "title": "Special Order", "short": "Special",
        "blurb": "Ask us in advance.",
        "img": None,
        "items": [
            ("Bestie (Moin Moin)", "Steamed bean pudding", 40),
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


def render_item(item):
    name, desc, price = item[0], item[1], item[2]
    photo = item[3] if len(item) > 3 else None
    search = f"{name} {desc}".lower()
    out = [f'<li class="dish{" has-photo" if photo else ""}" data-search="{escape(search, quote=True)}">']
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
        out.append(f'<span class="dots"></span><span class="price">{cedi(price)}</span>')
        out.append('</div>')
        if desc:
            out.append(f'<p>{escape(desc)}</p>')
    out.append('</div>')
    if not isinstance(price, list):
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
        items = "".join(render_item(i) for i in c["items"])
        sections.append(f'<section class="cat" id="{c["id"]}">{banner}<ul class="dishes">{items}</ul></section>')
    total = sum(len(c["items"]) for c in MENU)
    tpl = (ROOT / "scripts" / "menu.template.html").read_text()
    html = (tpl.replace("{{TABS}}", tabs)
               .replace("{{SECTIONS}}", "\n".join(sections))
               .replace("{{TOTAL}}", str(total)))
    (ROOT / "menu.html").write_text(html)
    print(f"menu.html written: {len(MENU)} sections, {total} dishes")


if __name__ == "__main__":
    render()
