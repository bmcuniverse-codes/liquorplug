// Fetch public catalogue facts only. Never copies product marketing descriptions.
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const get = async (url) => {
  const { stdout } = await run(
    "curl",
    ["-fLsS", "--retry", "2", "--max-time", "75", url],
    { maxBuffer: 20e6 },
  );
  return stdout;
};
const decode = (s) =>
  String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([a-f\d]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
const title = (s) =>
  decode(s)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
const api = "https://naijaliquor.com/wp-json/wc/store/v1/products";
await fs.mkdir(path.join(root, "data"), { recursive: true });
const [pages, catsRaw, brandsHtml, brandRaw] = await Promise.all([
  Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      get(`${api}?per_page=100&page=${i + 1}`),
    ),
  ),
  get(`${api}/categories?per_page=100`),
  get("https://naijaliquor.com/brands/"),
  get("https://naijaliquor.com/wp-json/wp/v2/pwb-brand?per_page=100"),
]);
const all = pages.flatMap(JSON.parse);
const brands = JSON.parse(brandRaw).map((b) => ({
  name: decode(b.name).trim(),
  slug: b.slug,
}));
const extra = [
  "818",
  "8PM",
  "Absolut",
  "Action Bitters",
  "Agor",
  "Amabile di Rosa",
  "Amarula",
  "Andre",
  "Antares",
  "Antinori",
  "Aperol",
  "Aznauri",
  "Bacardi",
  "Baileys",
  "Ballantine’s",
  "Baron de Valls",
  "Baron Romero",
  "Belvedere",
  "Bottega",
  "Bumbu",
  "Campari",
  "Captain Morgan",
  "Carlo Rossi",
  "Chamdor",
  "Chateau Vartely",
  "Chivas Regal",
  "Ciroc",
  "Clase Azul",
  "Coca Cola",
  "Don Julio",
  "D’usse",
  "El Jimador",
  "Fanta",
  "Fayrouz",
  "Four Cousins",
  "Frontera",
  "Glenfiddich",
  "Glenlivet",
  "Glenmorangie",
  "Goldberg",
  "Gordon’s",
  "Guinness",
  "Heineken",
  "Hennessy",
  "Highland Park",
  "Jack Daniel’s",
  "Jameson",
  "Johnnie Walker",
  "Jose Cuervo",
  "Jules Larose",
  "La Fiole",
  "Lamothe Parrot",
  "Laurent Perrier",
  "Luc Belaire",
  "Malibu",
  "Martell",
  "Martini",
  "Moet",
  "Monster",
  "Nederburg",
  "Olmeca",
  "Orijin",
  "Patron",
  "Pepsi",
  "Red Bull",
  "Remy Martin",
  "Robertson",
  "Schweppes",
  "Smirnoff",
  "Sosa",
  "Suntory",
  "The Macallan",
  "Veuve Clicquot",
  "Wild Turkey",
  "Woodford Reserve",
];
const normal = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
function brandFor(p) {
  const name = normal(p.name);
  return (
    brands.find((b) =>
      name.includes(
        normal(b.name).replace(
          /irishwhiskey$|londondrygin$|cognac$|whisky$|wines$|vodka$|tequila$/,
          "",
        ),
      ),
    )?.name || "Other Brands"
  );
}
const blocked = (p) => false;
const products = all
  .filter((p) => !blocked(p))
  .map((p) => ({
    id: String(p.id),
    slug: p.slug,
    name: decode(p.name),
    category: title(
      (
        p.categories.find((c) => c.slug !== "promo-deals") ||
        p.categories[0] || { name: "Drinks" }
      ).name,
    ),
    brand: brandFor(p),
    size:
      decode(p.name).match(
        /\b\d+(?:\.\d+)?\s*(?:ml|cl|l|litres?|liters?)\b/i,
      )?.[0] || "",
    price: Number(p.prices.price) / 10 ** p.prices.currency_minor_unit,
    image: "/placeholder.svg",
    source_url: p.permalink,
    source_image: p.images?.[0]?.src || null,
    image_status: "Placeholder — upload your own product photograph",
    featured:
      /hennessy-vs-|jameson-original|johnnie-walker-black-label|moet-chandon-brut|don-julio-1942|baileys-original/i.test(
        p.slug,
      ),
  }));
const categories = JSON.parse(catsRaw).map((c) => ({
  name: title(c.name),
  slug: c.slug,
}));
if (products.some((p) => p.brand === "Other Brands"))
  brands.push({ name: "Other Brands", slug: "other-brands" });
brands.sort((a, b) => a.name.localeCompare(b.name));
await fs.writeFile(
  path.join(root, "data/catalogue.json"),
  JSON.stringify({ products, brands, categories }, null, 2),
);
await fs.writeFile(
  path.join(root, "data/catalogue-sources.json"),
  JSON.stringify(
    {
      fetched_at: new Date().toISOString(),
      sources: [
        "https://naijaliquor.com/shop/",
        "https://naijaliquor.com/brands/",
        "https://naijaliquor.com/categories/",
        api,
      ],
      source_product_count: all.length,
      imported_product_count: products.length,
      notes: [
        "Imported factual product names, sizes and reference retail prices only. No retailer marketing descriptions copied.",
        "Retail prices are reference values, not verified Liquor Plug selling prices.",
        "All stock and wholesale values must be set by the owner before sale.",
        "No images with Naija Liquor watermarks are included. Image sources and status recorded per product.",
      ],
      images: [],
    },
    null,
    2,
  ),
);
console.log(
  `Imported ${products.length} products, ${brands.length} brands, ${categories.length} categories.`,
);
// Brand-owned packshots, downloaded separately from catalogue facts. No retailer watermark assets.
const media = [
  {
    key: "johnnie-walker-black",
    match: "^johnnie-walker-black-label",
    url: "https://images.ctfassets.net/waruwpig3jxu/40mAmIwhfqUmm72FQCCyob/3724a811cf2735f06e46bd508884c6d7/black-750ml_producthero_halffront_desktop.webp?w=640&q=85",
    source:
      "https://www.johnniewalker.com/en/our-whisky/core-range/johnnie-walker-black-label",
  },
  {
    key: "johnnie-walker-blue",
    match: "^johnnie-walker-blue-label$",
    url: "https://images.ctfassets.net/waruwpig3jxu/3RFFcZIRhkQkbU4sHocZcd/322a4fee19430963fd1671ccbd14508e/JW_Blue_LabelBottle_HalfFront_1440x1440.webp?w=640&q=85",
    source:
      "https://www.johnniewalker.com/en/our-whisky/core-range/johnnie-walker-blue-label",
  },
  {
    key: "johnnie-walker-red",
    match: "^johnnie-walker-red-label",
    url: "https://images.ctfassets.net/waruwpig3jxu/7BAYWajVKS9kI3XREDkpfh/554b9597fb8d6376840740ae35980092/red-750ml_producthero_halffront_desktop.webp?w=640&q=85",
    source:
      "https://www.johnniewalker.com/en/our-whisky/core-range/johnnie-walker-red-label",
  },
  {
    key: "hennessy-vs",
    match: "^hennessy-vs-(75cl|cognac)$",
    url: "https://www.hennessy.com/sites/hennessy_us/files/styles/square_2000x2000/public/2020-01/VS_0.png",
    source: "https://www.hennessy.com/en-us/collection/hennessy-very-special",
  },
  {
    key: "hennessy-vsop",
    match: "^hennessy-vsop",
    url: "https://www.hennessy.com/sites/hennessy_us/files/2020-01/VSOP.png",
    source: "https://www.hennessy.com/en-us/collection/hennessy-vsop",
  },
  {
    key: "hennessy-xo",
    match: "^hennessy-xo",
    url: "https://www.hennessy.com/sites/hennessy_us/files/styles/square_2000x2000/public/2020-01/XO.png",
    source: "https://www.hennessy.com/en-us/collection/hennessy-xo",
  },
  {
    key: "baileys-original",
    match: "^baileys-original-irish-cream$",
    url: "https://images.ctfassets.net/p1wk6poseifr/7MqAH3TpYr58PUynz76hxU/dfe82ded5ee3757a0bc698ce5e9553c9/BaileysOriginalIrishCream.png?w=640",
    source:
      "https://www.baileys.com/en/our-products/baileys-original-irish-cream",
  },
  {
    key: "don-julio-1942",
    match: "^don-julio-1942-anejo$",
    url: "https://images.ctfassets.net/msj5difukazp/5La6QLdvPTMhHYBLY9Ml0A/fc3133daeb6e9c12ae2464d40d7f050e/1942-card.jpg?w=640&q=85",
    source: "https://www.donjulio.com/en/our-tequilas",
  },
  {
    key: "don-julio-blanco",
    match: "^don-julio-tequila-blanco$",
    url: "https://images.ctfassets.net/msj5difukazp/3NMOKg3vI74I2FOciCawDB/ffdf84c839ba75a29400d8db4865a86e/blanco-card.jpg?w=640&q=85",
    source: "https://www.donjulio.com/en/our-tequilas",
  },
  {
    key: "don-julio-reposado",
    match: "^don-julio-reposado-tequila$",
    url: "https://images.ctfassets.net/msj5difukazp/65AP46ceGWjovaqM5pUpUT/4dcab4d6941c8d676ae6ed67cf308adf/reposado-card.jpg?w=640&q=85",
    source: "https://www.donjulio.com/en/our-tequilas",
  },
  {
    key: "don-julio-anejo",
    match: "^don-julio-anejo-tequila$",
    url: "https://images.ctfassets.net/msj5difukazp/7B7J8BHKyrKBXl0nCGzJCL/e16f59e348e8829a9d5ff745b7c5cb39/anejo-card.jpg?w=640&q=85",
    source: "https://www.donjulio.com/en/our-tequilas",
  },
  {
    key: "jameson-black-barrel",
    match: "^jameson-black-barrel-70cl$",
    url: "https://ik.imagekit.io/cvygf2xse/jamesonwhiskey/wp-content/uploads/2024/08/Jameson_BB_Updated.png?tr=q-85,w-640",
    source:
      "https://www.jamesonwhiskey.com/en/our-whiskey/jameson-irish-whiskey",
  },
  {
    key: "jack-daniels-old-no7",
    match: "^jack-daniels-(old-no-7|20cl|37-5cl)$",
    url: "https://live-jd24-backend.pantheonsite.io/sites/default/files/2026-04/Old%20No.%207%20DOM.png",
    source: "https://www.jackdaniels.com/en-us/whiskey/old-no-7",
  },
  {
    key: "moet-imperial-brut",
    match: "^moet-chandon-imperial-brut$",
    url: "https://www.moet.com/sites/default/files/styles/portrait_bottle/public/2024-01/Moet-imperial-Bottle.png?itok=n64yqsc0",
    source: "https://www.moet.com/en-int/moet-imperial",
  },
  {
    key: "absolut-original",
    match: "^absolut-vodka(-20cl)?$",
    url: "https://www.absolut.com/wp-content/uploads/Absolut-Vodka-Original-Bottle-100ml.jpeg",
    source: "https://www.absolut.com/en/products/",
  },
  {
    key: "absolut-watermelon",
    match: "^absolut-watermelon-vodka$",
    url: "https://www.absolut.com/wp-content/uploads/ingredient_absolut-watermelon_1000ml_ROW_packshot.jpg",
    source: "https://www.absolut.com/en/products/",
  },
  {
    key: "absolut-citron",
    match: "^absolut-citron$",
    url: "https://www.absolut.com/wp-content/uploads/ingredient_absolut-Citron_1000ml_ROW_packshot.jpg",
    source: "https://www.absolut.com/en/products/",
  },
  {
    key: "absolut-vanilia",
    match: "^absolut-vodka-vanilia$",
    url: "https://www.absolut.com/wp-content/uploads/ingredient_absolut-Vanilia_1000ml_ROW_packshot.jpg",
    source: "https://www.absolut.com/en/products/",
  },
  {
    key: "absolut-raspberry",
    match: "^absolut-raspberry$",
    url: "https://www.absolut.com/wp-content/uploads/ingredient_absolut-raspberri_1000ml_ROW_packshot.jpg",
    source: "https://www.absolut.com/en/products/",
  },
];
const imgdir = path.join(root, "public/media/catalogue");
await fs.mkdir(imgdir, { recursive: true });
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "data/catalogue-sources.json"), "utf8"),
);
for (const m of media) {
  try {
    const ext = path.extname(new URL(m.url).pathname).slice(1);
    const filename = `${m.key}.${ext}`;
    try {
      await fs.access(path.join(imgdir, filename));
    } catch {
      await run("curl", [
        "-fLsS",
        "--retry",
        "1",
        "--max-time",
        "45",
        m.url,
        "-o",
        path.join(imgdir, filename),
      ]);
    }
    for (const p of products.filter((p) => new RegExp(m.match).test(p.slug))) {
      p.image = `/media/catalogue/${filename}`;
      p.image_status = "Brand-owned product image; size variant may differ.";
      p.featured = true;
    }
    manifest.images.push({ ...m, file: `/media/catalogue/${filename}` });
  } catch (e) {
    console.warn(`Could not fetch ${m.key}`);
  }
}
await fs.writeFile(
  path.join(root, "data/catalogue.json"),
  JSON.stringify({ products, brands, categories }, null, 2),
);
await fs.writeFile(
  path.join(root, "data/catalogue-sources.json"),
  JSON.stringify(manifest, null, 2),
);
console.log(
  `${products.filter((p) => p.image !== "/placeholder.svg").length} product entries now have manufacturer photos.`,
);
