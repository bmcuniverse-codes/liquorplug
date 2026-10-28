import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const escape = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function renderPage(db, path = "/") {
  let template;
  try { template=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'); }
  catch(error){
    if(error.code!=='ENOENT'||process.env.NODE_ENV==='production')throw error;
    template=await readFile(new URL('../index.html',import.meta.url),'utf8');
  }
  const s = JSON.parse(
    (await db.one("SELECT data FROM content WHERE id='published'")).data,
  );
  let title = s.seoTitle,
    description = s.seoDescription,
    image = s.socialImage || "/social-card.svg",
    structured = "";
  const route = path.split("?")[0];
  if (route.startsWith("/product/")) {
    const p = await db.one(
      "SELECT * FROM products WHERE slug=? AND visible=1 AND archived=0",
      [decodeURIComponent(route.slice(9))],
    );
    if (p) {
      title = p.name + " · " + s.brand;
      description =
        p.description ||
        `${p.name}, ${p.size}. Explore the ${s.brand} collection.`;
      image = p.image;
      structured =
        '<script type="application/ld+json">' +
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          image: new URL(
            image,
            process.env.PUBLIC_URL || "http://localhost:3000",
          ).href,
          sku: p.sku,
          brand: { "@type": "Brand", name: p.brand },
          offers: {
            "@type": "Offer",
            priceCurrency: "NGN",
            price: p.price / 100,
            availability:
              p.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          },
        }).replace(/</g, "\\u003c") +
        "</script>";
    }
  }
  const base = process.env.PUBLIC_URL || "http://localhost:3000";
  const url = new URL(route, base).href;
  const extra = `<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(new URL(image, base).href)}"><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escape(url)}">${["/account", "/admin", "/checkout", "/track", "/cart"].some((p) => route.startsWith(p)) ? '<meta name="robots" content="noindex,nofollow">' : ""}${structured}`;
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/,
      (_, a, b) => a + escape(description) + b,
    )
    .replace("</head>", extra + "</head>");
}
