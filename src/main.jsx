import React, { useState, useEffect, useContext, createContext } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  ShoppingBag,
  UserRound,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Truck,
  ShieldCheck,
  Wine,
  MessageCircle,
  Check,
  Package,
  SlidersHorizontal,
  MapPin,
  LogOut,
} from "lucide-react";
import { api, setCsrf, money, date } from "./api";
import Admin from "./Admin";
import "./styles.css";
const Context = createContext();
export const useStore = () => useContext(Context);
function Copy({ name, children }) {
  const { settings } = useStore();
  return settings.copy?.[name] ?? children;
}
export function Busy({ text = "Loading…" }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}
export function ErrorBox({ children }) {
  return children ? (
    <div className="error" role="alert">
      {children}
    </div>
  ) : null;
}
export function Field({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Button({ children, ...props }) {
  return (
    <button className="button" {...props}>
      {children}
    </button>
  );
}
const fallback = (e) => {
  if (!e.currentTarget.src.endsWith("placeholder.svg"))
    e.currentTarget.src = "/placeholder.svg";
};
function App() {
  const [boot, setBoot] = useState(null),
    [error, setError] = useState(""),
    [cart, setCart] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("lp_cart")) || [];
      } catch {
        return [];
      }
    }),
    [toast, setToast] = useState(""),
    [preview, setPreview] = useState(null);
  const refresh = async () => {
    const b = await api("/bootstrap");
    setCsrf(b.csrf);
    setBoot(b);
    return b;
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(
    () => localStorage.setItem("lp_cart", JSON.stringify(cart)),
    [cart],
  );
  const notify = (s) => {
    setToast(s);
    setTimeout(() => setToast(""), 3500);
  };
  const add = (p, qty = 1) => {
    setCart((old) => {
      const found = old.find((x) => x.id === p.id);
      const quantity = (found?.qty || 0) + qty;
      if (quantity > p.stock) {
        notify("That quantity is not available.");
        return old;
      }
      notify("Added to your bag");
      return found
        ? old.map((x) => (x.id === p.id ? { ...x, qty: quantity } : x))
        : [
            ...old,
            {
              id: p.id,
              slug: p.slug,
              name: p.name,
              image: p.image,
              size: p.size,
              price: p.price,
              stock: p.stock,
              qty,
            },
          ];
    });
  };
  if (error)
    return (
      <main className="container">
        <h1>Liquor Plug</h1>
        <ErrorBox>{error}</ErrorBox>
        <p>Check the database setup and restart the server.</p>
        <Button onClick={() => location.reload()}>Try again</Button>
      </main>
    );
  if (!boot) return <Busy text="Pouring something good…" />;
  return (
    <Context.Provider
      value={{
        ...boot,
        settings: preview || boot.settings,
        cart,
        setCart,
        add,
        refresh,
        notify,
        preview,
        setPreview,
      }}
    >
      <div
        style={{
          "--wine": (preview || boot.settings).primary,
          "--ink": (preview || boot.settings).background,
          fontFamily:
            (preview || boot.settings).font === "serif"
              ? "Georgia,serif"
              : undefined,
        }}
      >
        <Shell />
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            {toast}
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
function Shell() {
  const { settings, preview, setPreview } = useStore();
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = settings.seoTitle;
    const m = document.querySelector('meta[name="description"]');
    if (m) m.content = settings.seoDescription;
  }, [loc.pathname, settings.seoTitle, settings.seoDescription]);
  return (
    <>
      {preview && (
        <div className="preview-bar">
          Draft preview · Only visible in this browser{" "}
          <button onClick={() => setPreview(null)}>Exit preview</button>
        </div>
      )}
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/deals" element={<Shop deals />} />
        <Route path="/categories" element={<Collections kind="categories" />} />
        <Route path="/brands" element={<Collections kind="brands" />} />
        <Route path="/product/:slug" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/account" element={<Account />} />
        <Route path="/wholesale" element={<Wholesale />} />
        <Route path="/track" element={<Track />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/policy/:type" element={<Policy />} />
        <Route path="/admin/*" element={<Admin />} />
        <Route
          path="*"
          element={
            <main className="container">
              <Banner page="shop" />
              <h1>Page not found</h1>
              <Link to="/shop">Back to the collection</Link>
            </main>
          }
        />
      </Routes>
      <Footer />
      <AgeGate />
    </>
  );
}
function Brand() {
  const { settings } = useStore();
  return (
    <Link className="brand" to="/">
      {settings.logo ? (
        <img src={settings.logo} alt={settings.brand} />
      ) : (
        <>
          <span className="brand-icon">
            <Wine size={24} />
          </span>
          <span>
            LIQUOR
            <span className="brand-bottom">
              PLUG<span className="brand-dot">®</span>
            </span>
          </span>
        </>
      )}
    </Link>
  );
}
function Header() {
  const { settings, cart, user, refresh } = useStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  const search = (e) => {
    e.preventDefault();
    nav(
      "/shop?q=" + encodeURIComponent(new FormData(e.currentTarget).get("q")),
    );
  };
  return (
    <>
      <div className="announcement">
        <span>
          <Copy name="announcement">Good company deserves a great pour.</Copy>
        </span>
        <Link to="/wholesale">
          Wholesale? Let’s talk <ArrowUpRight size={13} />
        </Link>
      </div>
      <header className="header">
        <div className="header-inner">
          <button
            className="icon mobile-only"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <Brand />
          <nav className="desktop-nav">
            {settings.navigation.map((l, i) => (
              <Link key={i} to={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link className="icon search-icon" to="/shop" aria-label="Search">
              <Search />
            </Link>
            <Link className="icon" to="/account" aria-label="Account">
              <UserRound />
            </Link>
            <Link
              className="icon bag-icon"
              to="/cart"
              aria-label={`Bag with ${cart.reduce((a, p) => a + p.qty, 0)} items`}
            >
              <ShoppingBag />
              <span>{cart.reduce((a, p) => a + p.qty, 0)}</span>
            </Link>
          </div>
        </div>
        <form className="mobile-search" onSubmit={search}>
          <Search size={17} />
          <input
            name="q"
            placeholder="Find your drink, brand or occasion"
            aria-label="Search products"
          />
          <button type="submit" aria-label="Search">
            <ArrowRight size={18} />
          </button>
        </form>
      </header>
      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <nav className="drawer" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X />
            </button>
            <Brand />
            {settings.navigation.map((l, i) => (
              <Link key={i} to={l.href}>
                {l.label}
                <ArrowUpRight size={18} />
              </Link>
            ))}
            <Link to="/deals">Promotions</Link>
            <Link to="/track">Track an order</Link>
            <Link to="/contact">Contact</Link>
            {["owner", "manager", "staff"].includes(user?.role) && (
              <Link to="/admin">Store dashboard</Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
export function Banner({ page = "home", compact = false }) {
  const { settings } = useStore();
  const [i, setI] = useState(0),
    [paused, setPaused] = useState(false);
  const slides = (settings.banners[page] || settings.banners.shop || []).filter(
    (x) =>
      (!x.startsAt || Date.now() >= x.startsAt) &&
      (!x.endsAt || Date.now() <= x.endsAt),
  );
  const location = useLocation();
  useEffect(() => setI(0), [location.pathname]);
  useEffect(() => {
    if (
      paused ||
      slides.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6500);
    return () => clearInterval(t);
  }, [slides.length, paused]);
  if (!slides.length) return null;
  const s = slides[i % slides.length];
  return (
    <section
      className={
        "hero " +
        (page === "home" ? "hero-main" : "hero-small") +
        (compact ? " compact" : "")
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="hero-grain" />
      {s.image ? (
        <picture>
          <source
            media="(max-width: 600px)"
            srcSet={s.mobileImage || s.image}
          />
          <img className="hero-bg" src={s.image} alt="" onError={fallback} />
        </picture>
      ) : (
        <div className="hero-art" aria-hidden="true">
          <div className="glow" />
          <img
            className="hero-packshot packshot-one"
            src="/media/catalogue/hennessy-vs.png"
            alt=""
          />
          <img
            className="hero-packshot packshot-two"
            src="/media/catalogue/moet-imperial-brut.png"
            alt=""
          />
          <img
            className="hero-packshot packshot-three"
            src="/media/catalogue/jack-daniels-old-no7.png"
            alt=""
          />
          <span className="hero-circle">
            A BETTER
            <br />
            POUR.
          </span>
        </div>
      )}
      <div className="hero-content">
        <p className="eyebrow">THE LIQUOR PLUG COLLECTION</p>
        <h1>{s.title}</h1>
        <p className="hero-description">{s.subtitle}</p>
        {s.button && (
          <Link className="button cream" to={s.href || "/shop"}>
            {s.button}
            <ArrowUpRight size={18} />
          </Link>
        )}
      </div>
      {slides.length > 1 && (
        <div className="carousel-controls">
          <button
            aria-label="Previous banner"
            onClick={() => setI((i + slides.length - 1) % slides.length)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {(i % slides.length) + 1} / {slides.length}
          </span>
          <button
            aria-label="Next banner"
            onClick={() => setI((i + 1) % slides.length)}
          >
            <ChevronRight size={17} />
          </button>
          <button onClick={() => setPaused(!paused)}>
            {paused ? "Play" : "Pause"}
          </button>
        </div>
      )}
    </section>
  );
}
function Perks() {
  return (
    <div className="perks">
      <span>
        <Wine />
        <b>Find your favourites</b>
        <small>Spirits, wines & more</small>
      </span>
      <span>
        <Truck />
        <b>Lagos delivery</b>
        <small>Check your area at checkout</small>
      </span>
      <span>
        <ShieldCheck />
        <b>Secure checkout</b>
        <small>Powered by Paystack</small>
      </span>
      <span>
        <MessageCircle />
        <b>Order your way</b>
        <small>Online or on WhatsApp</small>
      </span>
    </div>
  );
}
function SectionTitle({ title, subtitle, to }) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">CURATED BY LIQUOR PLUG</p>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {to && (
        <Link className="text-link" to={to}>
          View all <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
function Home() {
  const { settings, categories, brands } = useStore();
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/products?limit=8").then(setData);
  }, []);
  return (
    <main>
      <Banner />
      <Perks />
      <div className="container">
        {settings.sections
          .filter((s) => s.visible)
          .map((s, i) =>
            s.type === "categories" ? (
              <section className="section" key={i}>
                <SectionTitle {...s} to="/categories" />
                <div className="category-row">
                  {categories.slice(0, 8).map((c, i) => (
                    <Link
                      to={"/shop?category=" + encodeURIComponent(c.name)}
                      className="category-card"
                      key={c.id}
                    >
                      <div className={"category-art tone-" + (i % 4)}>
                        {c.image && c.image !== "/placeholder.svg" ? (
                          <img src={c.image} alt="" onError={fallback} />
                        ) : (
                          <Wine size={42} />
                        )}
                      </div>
                      <span>{c.name}</span>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : s.type === "featured" ? (
              <section className="section" key={i}>
                <SectionTitle {...s} to="/shop" />
                {data ? (
                  <div className="product-grid">
                    {data.products.map((p) => (
                      <ProductCard key={p.id} p={p} />
                    ))}
                  </div>
                ) : (
                  <Busy />
                )}
              </section>
            ) : s.type === "wholesale" ? (
              <section className="wholesale-strip" key={i}>
                <div>
                  <p className="eyebrow">FOR THE BIGGER OCCASIONS</p>
                  <h2>{s.title}</h2>
                  <p>{s.subtitle}</p>
                  <Link className="button cream" to="/wholesale">
                    Become a wholesale partner <ArrowUpRight size={16} />
                  </Link>
                </div>
                <span className="big-amp">&</span>
              </section>
            ) : (
              <section className="section" key={i}>
                <SectionTitle {...s} to="/brands" />
                <div className="brand-row">
                  {brands.slice(0, 12).map((b) => (
                    <Link
                      key={b.id}
                      to={"/shop?brand=" + encodeURIComponent(b.name)}
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>
              </section>
            ),
          )}
      </div>
    </main>
  );
}
export function ProductCard({ p }) {
  const { add, user } = useStore();
  const sale =
    p.sale_price !== null &&
    (!p.sale_start || Date.now() >= Number(p.sale_start)) &&
    (!p.sale_end || Date.now() <= Number(p.sale_end));
  return (
    <article className="product-card">
      <Link to={"/product/" + p.slug} className="product-image">
        {sale && <span className="badge">Special price</span>}
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          width="320"
          height="360"
          onError={fallback}
        />
        {p.stock <= 0 && (
          <span className="stock-tag">Stock confirmation needed</span>
        )}
      </Link>
      <div className="product-info">
        <p className="product-category">{p.category}</p>
        <Link to={"/product/" + p.slug}>
          <h3>{p.name}</h3>
        </Link>
        <span className="product-size">{p.size || "See product details"}</span>
        <div className="price-line">
          <b>{money(sale ? p.sale_price : p.price)}</b>
          {sale && <del>{money(p.price)}</del>}
        </div>
        {user?.wholesale_status === "approved" &&
          p.wholesale_price !== null && (
            <small className="wholesale-price">
              Wholesale {money(p.wholesale_price)} / unit
            </small>
          )}
        <button
          className="add-button"
          disabled={p.stock <= 0}
          onClick={() => add(p)}
        >
          {p.stock > 0 ? "Add to bag" : "View availability"}
          <Plus size={16} />
        </button>
      </div>
    </article>
  );
}
function Shop({ deals = false }) {
  const { categories, brands } = useStore();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [filters, setFilters] = useState(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    api("/products?" + params.toString() + (deals ? "&deals=true" : ""))
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e.message));
    return () => (live = false);
  }, [params.toString(), deals]);
  const change = (key, v) => {
    const p = new URLSearchParams(params);
    v ? p.set(key, v) : p.delete(key);
    if (key !== "page") p.delete("page");
    setParams(p);
  };
  return (
    <main>
      <Banner page={deals ? "deals" : "shop"} />
      <div className="container section">
        <div className="shop-heading">
          <div>
            <p className="eyebrow">THE COLLECTION</p>
            <h2>
              <Copy name={deals ? "dealsTitle" : "shopTitle"}>
                {deals
                  ? "A little more to celebrate."
                  : "Find your next favourite."}
              </Copy>
            </h2>
            <p>
              {data
                ? `${data.total} drinks to discover`
                : "Discover our selection"}
            </p>
          </div>
          <button
            className="button outline filter-toggle"
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} /> Filters
          </button>
        </div>
        <div className="shop-layout">
          <aside className={"filters " + (filters ? "filters-open" : "")}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                change("q", new FormData(e.currentTarget).get("q"));
              }}
            >
              <Field label="Search">
                <div className="search-field">
                  <input
                    name="q"
                    defaultValue={params.get("q") || ""}
                    placeholder="Search drinks"
                  />
                  <button aria-label="Search">
                    <Search size={18} />
                  </button>
                </div>
              </Field>
            </form>
            <Field label="Category">
              <select
                value={params.get("category") || ""}
                onChange={(e) => change("category", e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Brand">
              <select
                value={params.get("brand") || ""}
                onChange={(e) => change("brand", e.target.value)}
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Bottle size">
              <input
                placeholder="e.g. 70cl"
                value={params.get("size") || ""}
                onChange={(e) => change("size", e.target.value)}
              />
            </Field>
            <div className="form-row">
              <Field
                label="Min ₦"
                type="number"
                min="0"
                value={(params.get("min") || 0) / 100 || ""}
                onChange={(e) =>
                  change(
                    "min",
                    e.target.value ? Number(e.target.value) * 100 : "",
                  )
                }
              />
              <Field
                label="Max ₦"
                type="number"
                min="0"
                value={(params.get("max") || 0) / 100 || ""}
                onChange={(e) =>
                  change(
                    "max",
                    e.target.value ? Number(e.target.value) * 100 : "",
                  )
                }
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={params.get("inStock") === "true"}
                onChange={(e) =>
                  change("inStock", e.target.checked ? "true" : "")
                }
              />{" "}
              In stock only
            </label>
            <button className="text-link" onClick={() => setParams({})}>
              Clear filters
            </button>
          </aside>
          <div className="shop-results">
            <div className="sort-bar">
              <span>
                {params.get("q")
                  ? `Results for “${params.get("q")}”`
                  : deals
                    ? "Current offers"
                    : "Made for good company"}
              </span>
              <select
                aria-label="Sort products"
                value={params.get("sort") || "featured"}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="bestsellers">Bestsellers</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name">Name A–Z</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <ErrorBox>{error}</ErrorBox>
            {!data && !error ? (
              <Busy />
            ) : data?.products.length ? (
              <>
                <div className="product-grid shop-grid">
                  {data.products.map((p) => (
                    <ProductCard p={p} key={p.id} />
                  ))}
                </div>
                <div className="pagination">
                  <button
                    disabled={data.page <= 1}
                    onClick={() => change("page", data.page - 1)}
                  >
                    <ChevronLeft size={18} /> Previous
                  </button>
                  <span>
                    {data.page} / {data.pages}
                  </span>
                  <button
                    disabled={data.page >= data.pages}
                    onClick={() => change("page", data.page + 1)}
                  >
                    Next <ChevronRight size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="empty">
                <Wine size={38} />
                <h3>No matching drinks</h3>
                <p>Try another filter or search term.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
function Collections({ kind }) {
  const store = useStore();
  return (
    <main>
      <Banner page={kind} />
      <section className="container section">
        <SectionTitle
          title={
            <Copy name={kind === "brands" ? "brandsTitle" : "categoriesTitle"}>
              {kind === "brands"
                ? "Find your favourite label."
                : "Choose your kind of occasion."}
            </Copy>
          }
        />
        <div className="collection-grid">
          {store[kind].map((c, i) => (
            <Link
              to={
                "/shop?" +
                (kind === "brands" ? "brand" : "category") +
                "=" +
                encodeURIComponent(c.name)
              }
              key={c.id}
            >
              <div className={"collection-art tone-" + (i % 4)}>
                {c.image && c.image !== "/placeholder.svg" ? (
                  <img src={c.image} alt="" loading="lazy" onError={fallback} />
                ) : kind === "brands" ? (
                  <span>{c.name.slice(0, 2).toUpperCase()}</span>
                ) : (
                  <Wine size={52} />
                )}
              </div>
              <span>
                {c.name}
                <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
function Product() {
  const location = useLocation(),
    { add, user } = useStore();
  const [p, setP] = useState(null),
    [error, setError] = useState(""),
    [qty, setQty] = useState(1),
    [image, setImage] = useState(""),
    [related, setRelated] = useState([]);
  useEffect(() => {
    setP(null);
    setError("");
    api("/products/" + location.pathname.split("/").pop())
      .then((p) => {
        setP(p);
        setImage(p.image);
        setQty(1);
        document.title = p.name + " · Liquor Plug";
        api(
          "/products?category=" + encodeURIComponent(p.category) + "&limit=5",
        ).then((d) =>
          setRelated(d.products.filter((x) => x.id !== p.id).slice(0, 4)),
        );
      })
      .catch((e) => setError(e.message));
  }, [location.pathname]);
  if (error)
    return (
      <main className="container section">
        <ErrorBox>{error}</ErrorBox>
      </main>
    );
  if (!p) return <Busy />;
  const sale =
    p.sale_price !== null &&
    (!p.sale_start || Date.now() >= Number(p.sale_start)) &&
    (!p.sale_end || Date.now() <= Number(p.sale_end));
  return (
    <main>
      <Banner page="product" compact />
      <div className="container section">
        <p className="breadcrumb">
          <Link to="/shop">Shop</Link> / {p.category} / {p.name}
        </p>
        <div className="product-detail">
          <div>
            <img
              className="detail-image"
              src={image}
              alt={p.name}
              onError={fallback}
            />
            <div className="gallery-thumbs">
              {[p.image, ...p.gallery].map((im, i) => (
                <button
                  key={i}
                  onClick={() => setImage(im)}
                  aria-label={"View image " + (i + 1)}
                >
                  <img src={im} alt="" onError={fallback} />
                </button>
              ))}
            </div>
          </div>
          <div className="detail-copy">
            <p className="eyebrow">{p.brand || p.category}</p>
            <h1>{p.name}</h1>
            <p>
              {p.size} · {p.category}
            </p>
            <div className="detail-price">
              {money(sale ? p.sale_price : p.price)}
              {sale && <del>{money(p.price)}</del>}
            </div>
            {user?.wholesale_status === "approved" &&
              p.wholesale_price !== null && (
                <p className="wholesale-price">
                  Wholesale {money(p.wholesale_price)} per unit · Minimum{" "}
                  {p.wholesale_min}
                </p>
              )}
            <p className="description">
              {p.description ||
                "Explore this selection from the Liquor Plug collection. Contact us for product specifications and current availability."}
            </p>
            <p>
              {p.stock > 0 ? (
                <>
                  <span className="dot" /> {p.stock} units available
                </>
              ) : (
                "Stock confirmation needed — contact us for availability."
              )}
            </p>
            <div className="purchase-row">
              <Quantity value={qty} max={p.stock || 1} onChange={setQty} />
              <Button disabled={!p.stock} onClick={() => add(p, qty)}>
                Add to bag <ShoppingBag size={17} />
              </Button>
            </div>
            <div className="detail-perks">
              <p>
                <Truck size={17} /> Delivery fees calculated at checkout.
              </p>
              <p>
                <ShieldCheck size={17} /> Secure payments. Adult recipients
                only.
              </p>
              <p>SKU: {p.sku}</p>
            </div>
          </div>
        </div>
        <section className="section">
          <SectionTitle
            title="Keep good company."
            subtitle="Something else you might enjoy."
          />
          <div className="product-grid">
            {related.map((x) => (
              <ProductCard p={x} key={x.id} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
function Quantity({ value, onChange, max = 10000 }) {
  return (
    <div className="quantity">
      <button
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        aria-label="Quantity"
        value={value}
        min="1"
        max={max}
        onChange={(e) =>
          onChange(Math.max(1, Math.min(max, Number(e.target.value) || 1)))
        }
      />
      <button
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
function Cart() {
  const { cart, setCart } = useStore();
  const total = cart.reduce((a, x) => a + x.qty * x.price, 0);
  return (
    <main>
      <Banner page="cart" compact />
      <section className="container section">
        <h1>
          <Copy name="cartTitle">Your bag</Copy>{" "}
          <span className="muted">({cart.length})</span>
        </h1>
        {!cart.length ? (
          <div className="empty">
            <ShoppingBag size={42} />
            <h2>Something good belongs here.</h2>
            <Link className="button" to="/shop">
              Explore the collection <ArrowUpRight size={17} />
            </Link>
          </div>
        ) : (
          <div className="checkout-layout">
            <div>
              {cart.map((p) => (
                <article className="cart-item" key={p.id}>
                  <img src={p.image} alt="" onError={fallback} />
                  <div>
                    <Link to={"/product/" + p.slug}>
                      <h3>{p.name}</h3>
                    </Link>
                    <p>
                      {p.size} · {money(p.price)}
                    </p>
                    <Quantity
                      value={p.qty}
                      max={Math.max(p.stock, p.qty)}
                      onChange={(qty) =>
                        setCart(
                          cart.map((x) => (x.id === p.id ? { ...x, qty } : x)),
                        )
                      }
                    />
                  </div>
                  <div>
                    <strong>{money(p.price * p.qty)}</strong>
                    <button
                      className="remove"
                      onClick={() => setCart(cart.filter((x) => x.id !== p.id))}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <aside className="summary">
              <p className="eyebrow">YOUR ORDER</p>
              <h2>The good stuff, together.</h2>
              <div className="summary-line">
                <span>Estimated item total</span>
                <b>{money(total)}</b>
              </div>
              <p>
                Current prices, discounts and delivery are confirmed securely at
                checkout.
              </p>
              <Link className="button" to="/checkout">
                Continue to checkout <ArrowRight size={18} />
              </Link>
              <Link className="text-link" to="/shop">
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
function Checkout() {
  const { cart, setCart, zones, settings, user, paymentsConfigured, notify } =
    useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: "",
      zoneId: "",
      note: "",
      coupon: "",
      ageConfirmed: false,
      pricing: "retail",
      channel: "whatsapp",
    }),
    [lga, setLga] = useState(""),
    [quote, setQuote] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(() => crypto.randomUUID());
  const body = () => ({
    ...form,
    items: cart.map(({ id, qty }) => ({ id, qty })),
    idempotencyKey: key,
  });
  const field = (k, v) => {
    setQuote(null);
    setForm({ ...form, [k]: v });
  };
  const review = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      setQuote(await api("/orders/quote", { method: "POST", body: body() }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const place = async () => {
    setBusy(true);
    setError("");
    try {
      const o = await api("/orders", { method: "POST", body: body() });
      localStorage.setItem("lp_order_" + o.ref, o.token);
      sessionStorage.setItem("lp_last_order", o.ref);
      setCart([]);
      if (form.channel === "paystack") {
        try {
          const p = await api("/orders/" + o.ref + "/pay", {
            method: "POST",
            orderToken: o.token,
          });
          location.assign(p.url);
          return;
        } catch (e) {
          notify(e.message);
        }
      }
      navigate("/track?ref=" + o.ref, {
        state: {
          whatsappUrl: form.channel === "whatsapp" ? o.whatsappUrl : null,
        },
      });
    } catch (e) {
      setError(e.message);
      setKey(crypto.randomUUID());
    } finally {
      setBusy(false);
    }
  };
  return (
    <main>
      <Banner page="checkout" compact />
      <section className="container section">
        <h1>
          <Copy name="checkoutTitle">A great choice.</Copy>
        </h1>
        <p>
          <Copy name="checkoutIntro">Let’s get your order ready.</Copy>
        </p>
        {!cart.length ? (
          <Link className="button" to="/shop">
            Your bag is empty. Browse drinks.
          </Link>
        ) : (
          <form className="checkout-layout" onSubmit={review}>
            <div className="form-panel">
              <h2>Contact & delivery</h2>
              <div className="form-row">
                <Field
                  label="Full name"
                  value={form.name}
                  required
                  autoComplete="name"
                  onChange={(e) => field("name", e.target.value)}
                />
                <Field
                  label="Email address"
                  type="email"
                  value={form.email}
                  required
                  autoComplete="email"
                  onChange={(e) => field("email", e.target.value)}
                />
              </div>
              <Field
                label="Phone number"
                type="tel"
                value={form.phone}
                required
                autoComplete="tel"
                onChange={(e) => field("phone", e.target.value)}
              />
              <Field label="Delivery LGA">
                <select
                  required={!settings.pickupEnabled}
                  value={lga}
                  onChange={(e) => {
                    setLga(e.target.value);
                    field(
                      "zoneId",
                      e.target.value === "pickup" ? "pickup" : "",
                    );
                  }}
                >
                  <option value="">Choose your location</option>
                  {[...new Set(zones.map((z) => z.lga))].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                  {settings.pickupEnabled && (
                    <option value="pickup">Collect from store</option>
                  )}
                </select>
              </Field>
              {lga && lga !== "pickup" && (
                <Field label="Delivery area">
                  <select
                    required
                    value={form.zoneId}
                    onChange={(e) => field("zoneId", e.target.value)}
                  >
                    <option value="">Select an available area</option>
                    {zones
                      .filter((z) => z.lga === lga && z.enabled)
                      .map((z) => (
                        <option value={z.id} key={z.id}>
                          {z.neighbourhood || z.lga} · {money(z.fee)}
                        </option>
                      ))}
                  </select>
                  {!zones.some((z) => z.lga === lga && z.enabled) && (
                    <span className="error">
                      This area is not yet available. Contact us on WhatsApp.
                    </span>
                  )}
                </Field>
              )}
              {lga === "pickup" && (
                <p>
                  {settings.pickupInstructions}
                  <br />
                  {settings.address}
                </p>
              )}
              <Field
                label={
                  lga === "pickup"
                    ? "Pickup contact details"
                    : "Full address & landmark"
                }
              >
                <textarea
                  required
                  value={form.address}
                  autoComplete="street-address"
                  onChange={(e) => field("address", e.target.value)}
                />
              </Field>
              {form.zoneId && (
                <p className="help">
                  {zones.find((z) => z.id === form.zoneId)?.eta}
                </p>
              )}
              <Field label="Order notes (optional)">
                <textarea
                  value={form.note}
                  onChange={(e) => field("note", e.target.value)}
                />
              </Field>
              {user?.wholesale_status === "approved" && (
                <Field label="Order pricing">
                  <select
                    value={form.pricing}
                    onChange={(e) => field("pricing", e.target.value)}
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">
                      Wholesale (approved account)
                    </option>
                  </select>
                </Field>
              )}
              <Field
                label="Coupon code (optional)"
                value={form.coupon}
                onChange={(e) => field("coupon", e.target.value.toUpperCase())}
              />
              <h2>How would you like to order?</h2>
              <label className="payment-option">
                <input
                  type="radio"
                  name="channel"
                  checked={form.channel === "paystack"}
                  disabled={!paymentsConfigured}
                  onChange={() => field("channel", "paystack")}
                />
                <div>
                  <b>Pay securely online</b>
                  <small>
                    {paymentsConfigured
                      ? "Card, transfer and available Paystack payment options"
                      : "Online payment setup is pending"}
                  </small>
                </div>
                <ShieldCheck />
              </label>
              <label className="payment-option">
                <input
                  type="radio"
                  name="channel"
                  checked={form.channel === "whatsapp"}
                  onChange={() => field("channel", "whatsapp")}
                />
                <div>
                  <b>Complete on WhatsApp</b>
                  <small>Your order is saved before you open the chat.</small>
                </div>
                <MessageCircle />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  required
                  checked={form.ageConfirmed}
                  onChange={(e) => field("ageConfirmed", e.target.checked)}
                />{" "}
                I am 18 or older and agree to the{" "}
                <Link to="/policy/terms">store terms</Link>.
              </label>
              <ErrorBox>{error}</ErrorBox>
              <Button disabled={busy}>
                {busy ? "Checking…" : "Review order"}
              </Button>
            </div>
            <aside className="summary">
              <p className="eyebrow">YOUR SELECTION</p>
              {cart.map((x) => (
                <div className="summary-line" key={x.id}>
                  <span>
                    {x.qty} × {x.name}
                  </span>
                </div>
              ))}
              {quote ? (
                <>
                  <div className="summary-line">
                    <span>Items</span>
                    <b>{money(quote.subtotal)}</b>
                  </div>
                  <div className="summary-line">
                    <span>Discount</span>
                    <b>−{money(quote.discount)}</b>
                  </div>
                  <div className="summary-line">
                    <span>Delivery</span>
                    <b>{money(quote.delivery)}</b>
                  </div>
                  <div className="summary-total">
                    <span>Total</span>
                    <b>{money(quote.total)}</b>
                  </div>
                  <p>
                    Stock is reserved for 30 minutes when you place the order.
                  </p>
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={place}
                  >
                    {busy
                      ? "Saving order…"
                      : form.channel === "whatsapp"
                        ? "Save order & continue"
                        : "Place order & pay"}
                    <ArrowRight size={17} />
                  </button>
                </>
              ) : (
                <p>
                  Complete your details and review the order to see the
                  confirmed total.
                </p>
              )}
            </aside>
          </form>
        )}
      </section>
    </main>
  );
}
function Account() {
  const { user, refresh, notify } = useStore();
  const [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [orders, setOrders] = useState([]);
  const [params] = useSearchParams();
  useEffect(() => {
    if (user) api("/account/orders").then(setOrders);
  }, [user]);
  const reset = params.get("reset");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (reset) {
        await api("/auth/reset", {
          method: "POST",
          body: { token: reset, password: b.password },
        });
        notify("Password updated. Sign in to continue.");
        location.assign("/account");
      } else if (mode === "forgot") {
        const d = await api("/auth/forgot", { method: "POST", body: b });
        notify(d.message);
      } else if (mode === "register") {
        await api("/auth/register", { method: "POST", body: b });
        await api("/auth/login", {
          method: "POST",
          body: { email: b.email, password: b.password },
        });
        await refresh();
        notify("Welcome to Liquor Plug.");
      } else {
        const d = await api("/auth/login", { method: "POST", body: b });
        setCsrf(d.csrf);
        await refresh();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main>
      <Banner page="account" compact />
      <section className="container section">
        {user ? (
          <>
            <div className="section-title">
              <div>
                <p className="eyebrow">YOUR ACCOUNT</p>
                <h1>Hello, {user.name}.</h1>
                <p>{user.email}</p>
                <p>Wholesale access: {user.wholesale_status}</p>
              </div>
              <button
                className="button outline"
                onClick={async () => {
                  await api("/auth/logout", { method: "POST" });
                  await refresh();
                }}
              >
                Sign out <LogOut size={16} />
              </button>
            </div>
            {["owner", "manager", "staff"].includes(user.role) && (
              <Link className="button" to="/admin">
                Open store dashboard <ArrowUpRight size={16} />
              </Link>
            )}
            <h2 className="mt">Your orders</h2>
            {orders.length ? (
              orders.map((o) => (
                <Link
                  className="order-row"
                  to={"/track?ref=" + o.ref}
                  key={o.ref}
                >
                  <span>
                    <b>{o.ref}</b>
                    <small>{date(o.created_at)}</small>
                  </span>
                  <span>
                    {o.status} · {o.payment_status}
                  </span>
                  <strong>{money(o.total)}</strong>
                  <ArrowUpRight size={18} />
                </Link>
              ))
            ) : (
              <p>No orders yet. Your next great pour is waiting.</p>
            )}
          </>
        ) : (
          <div className="auth-panel">
            <p className="eyebrow">WELCOME TO THE GOOD COMPANY</p>
            <h1>
              {reset
                ? "Choose a new password"
                : mode === "login"
                  ? "Make yourself at home."
                  : mode === "register"
                    ? "Join the good company."
                    : "Let’s get you back in."}
            </h1>
            <form onSubmit={submit}>
              {!reset && mode === "register" && (
                <Field
                  label="Full name"
                  name="name"
                  required
                  autoComplete="name"
                />
              )}
              {!reset && (
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              )}
              {(reset || mode !== "forgot") && (
                <Field
                  label="Password (12+ characters)"
                  name="password"
                  type="password"
                  minLength={12}
                  required
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              )}
              <ErrorBox>{error}</ErrorBox>
              <Button disabled={busy}>
                {busy
                  ? "Please wait…"
                  : reset
                    ? "Reset password"
                    : mode === "login"
                      ? "Sign in"
                      : mode === "register"
                        ? "Create account"
                        : "Send reset link"}
              </Button>
            </form>
            {!reset && (
              <div className="auth-links">
                <button
                  onClick={() => {
                    setError("");
                    setMode(mode === "register" ? "login" : "register");
                  }}
                >
                  {mode === "register"
                    ? "Already a member? Sign in"
                    : "Create an account"}
                </button>
                <button
                  onClick={() =>
                    setMode(mode === "forgot" ? "login" : "forgot")
                  }
                >
                  {mode === "forgot" ? "Back to sign in" : "Forgot password?"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
function Wholesale() {
  const { user, refresh, settings } = useStore();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/wholesale/apply", {
        method: "POST",
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main>
      <Banner page="wholesale" />
      <section className="container section wholesale-layout">
        <div>
          <p className="eyebrow">MORE IN GOOD COMPANY</p>
          <h2>
            Your business.
            <br />
            Our collection.
          </h2>
          <p>
            For bars, restaurants, hospitality and people who bring an occasion
            together. Apply for access to our wholesale prices.
          </p>
          <ul className="clean-list">
            <li>
              <Check /> One wholesale price per product.
            </li>
            <li>
              <Check /> Personal account approval.
            </li>
            <li>
              <Check /> Order online or continue on WhatsApp.
            </li>
          </ul>
          <p>
            {settings.wholesaleQuantityEnabled
              ? "Product minimum quantities apply. "
              : ""}
            {settings.wholesaleValueEnabled
              ? "Minimum order value: " + money(settings.wholesaleMinimum)
              : ""}
          </p>
        </div>
        <div className="form-panel">
          {!user ? (
            <>
              <h2>Let’s start with an account.</h2>
              <p>
                Register or sign in, then submit your business details for
                review.
              </p>
              <Link className="button" to="/account">
                Sign in or register <ArrowUpRight size={17} />
              </Link>
            </>
          ) : ["pending", "approved"].includes(user.wholesale_status) ? (
            <>
              <Check size={32} />
              <h2>
                {user.wholesale_status === "approved"
                  ? "You’re approved."
                  : "Application received."}
              </h2>
              <p>
                {user.wholesale_status === "approved"
                  ? "Your wholesale prices are available when you are signed in."
                  : "We will review your application. Check this account for updates."}
              </p>
              <Link className="button" to="/shop">
                Explore the collection
              </Link>
            </>
          ) : (
            <form onSubmit={submit}>
              <h2>Apply for wholesale</h2>
              <Field
                label="Business or organisation"
                name="business"
                required
              />
              <Field
                label="Contact phone number"
                name="phone"
                type="tel"
                required
              />
              <ErrorBox>{error}</ErrorBox>
              <Button disabled={busy}>
                {busy ? "Submitting…" : "Send application"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
function Track() {
  const { user, settings, notify } = useStore();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [order, setOrder] = useState(null),
    [error, setError] = useState(""),
    [access, setAccess] = useState(""),
    [busy, setBusy] = useState(false);
  const ref = params.get("ref");
  const load = async (reference = ref) => {
    if (!reference || typeof reference !== "string") reference = ref;
    if (!reference) return;
    setBusy(true);
    try {
      const t = access || localStorage.getItem("lp_order_" + reference);
      const d = await api("/orders/" + encodeURIComponent(reference), {
        orderToken: t,
      });
      setOrder(d);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, [ref, user]);
  const verify = async () => {
    setBusy(true);
    try {
      await api("/orders/" + ref + "/verify", {
        method: "POST",
        orderToken: access || localStorage.getItem("lp_order_" + ref),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main>
      <Banner page="track" compact />
      <section className="container section">
        <h1>{order ? "Your order, in good hands." : "Track your order."}</h1>
        <form
          className="track-form"
          onSubmit={(e) => {
            e.preventDefault();
            const d = new FormData(e.currentTarget);
            setParams({ ref: d.get("ref") });
            setOrder(null);
            load(d.get("ref"));
          }}
        >
          <Field
            label="Order reference"
            name="ref"
            defaultValue={ref || ""}
            required
          />
          <Field
            label="Access token (if using a different device)"
            value={access}
            onChange={(e) => setAccess(e.target.value)}
          />
          <Button disabled={busy}>Find order</Button>
        </form>
        <p className="help">
          On the device used to order, access is saved automatically. Account
          orders are also available after signing in.
        </p>
        <ErrorBox>{error}</ErrorBox>
        {order && (
          <div className="checkout-layout mt">
            <div className="form-panel">
              <p className="eyebrow">{order.ref}</p>
              <h2>{order.status.replaceAll("_", " ")}</h2>
              <div className="status-pills">
                <span>{order.payment_status}</span>
                <span>{order.channel}</span>
                <span>{order.pricing}</span>
              </div>
              <p>
                {order.name} · {order.zone}
              </p>
              <p>{order.address}</p>
              {order.items.map((x) => (
                <div className="summary-line" key={x.id}>
                  <span>
                    {x.qty} × {x.name}
                  </span>
                  <b>{money(x.qty * x.unit_price)}</b>
                </div>
              ))}
              <h3>Order timeline</h3>
              {order.events.map((e) => (
                <div className="timeline" key={e.id}>
                  <span className="dot" />
                  <div>
                    {e.message}
                    <small>{date(e.created_at)}</small>
                  </div>
                </div>
              ))}
              <button className="text-link" onClick={load}>
                Refresh status
              </button>
            </div>
            <aside className="summary">
              <h2>{money(order.total)}</h2>
              <div className="summary-line">
                <span>Items</span>
                <span>{money(order.subtotal)}</span>
              </div>
              <div className="summary-line">
                <span>Discount</span>
                <span>−{money(order.discount)}</span>
              </div>
              <div className="summary-line">
                <span>Delivery</span>
                <span>{money(order.delivery)}</span>
              </div>
              {order.payment_status === "unpaid" && (
                <p>Stock reservation ends {date(order.expires_at)}.</p>
              )}
              {order.channel === "whatsapp" && (
                <a
                  className="button"
                  href={
                    location.state?.whatsappUrl ||
                    "https://wa.me/" +
                      settings.whatsapp +
                      "?text=" +
                      encodeURIComponent(
                        `Hello Liquor Plug! Order ${order.ref}\n${order.items.map((x) => `${x.qty} × ${x.name} (${x.size}): NGN ${(x.qty * x.unit_price) / 100}`).join("\n")}\nTotal: NGN ${order.total / 100}\nName: ${order.name}\nPhone: ${order.phone}\nArea: ${order.zone}\nAddress: ${order.address}\nPlease confirm my order.`,
                      )
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open WhatsApp to send order <MessageCircle size={18} />
                </a>
              )}
              {!user && (access || localStorage.getItem("lp_order_" + ref)) && (
                <details className="private-token">
                  <summary>Private access token</summary>
                  <p>
                    Keep this private. It grants access to this order on another
                    device.
                  </p>
                  <code>
                    {access || localStorage.getItem("lp_order_" + ref)}
                  </code>
                </details>
              )}
              {order.channel === "paystack" &&
                order.payment_status === "unpaid" &&
                order.stock_state === "reserved" && (
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const p = await api("/orders/" + ref + "/pay", {
                          method: "POST",
                          orderToken:
                            access || localStorage.getItem("lp_order_" + ref),
                        });
                        window.location.assign(p.url);
                      } catch (e) {
                        setError(e.message);
                        setBusy(false);
                      }
                    }}
                  >
                    Continue payment
                  </button>
                )}
              {order.channel === "whatsapp" && (
                <p className="help">
                  WhatsApp opening does not confirm that a message was sent or
                  payment received.
                </p>
              )}
              {order.channel === "paystack" &&
                order.payment_status === "unpaid" && (
                  <button className="button" disabled={busy} onClick={verify}>
                    Check payment status
                  </button>
                )}
              <button className="button outline" onClick={() => window.print()}>
                Print order summary
              </button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
function Contact() {
  const { settings } = useStore();
  return (
    <main>
      <Banner page="contact" />
      <section className="container section wholesale-layout">
        <div>
          <p className="eyebrow">LET’S TALK GOOD TASTE</p>
          <h1>
            <Copy name="contactTitle">Your next occasion starts here.</Copy>
          </h1>
          <p>
            <Copy name="contactIntro">
              Questions about a bottle, a bulk order or delivery? We’re a
              message away.
            </Copy>
          </p>
          <a
            className="button"
            href={"https://wa.me/" + settings.whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            Chat on WhatsApp <MessageCircle size={18} />
          </a>
        </div>
        <div className="form-panel">
          <h2>Find your plug.</h2>
          <p>WhatsApp: +{settings.whatsapp}</p>
          {settings.email && (
            <p>
              <a href={"mailto:" + settings.email}>{settings.email}</a>
            </p>
          )}
          {settings.address && (
            <p>
              <MapPin size={16} /> {settings.address}
            </p>
          )}
          <p>{settings.hours}</p>
          <Link className="text-link" to="/policy/delivery">
            Delivery information <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
function Policy() {
  const { settings } = useStore();
  const type = useLocation().pathname.split("/").pop();
  return (
    <main>
      <Banner page="policy" compact />
      <article className="container section policy">
        <h1>
          {{
            privacy: "Privacy policy",
            returns: "Returns & refunds",
            delivery: "Delivery policy",
            terms: "Store terms",
          }[type] || "Store policy"}
        </h1>
        <p>
          {settings.policies[type] || "Please contact the store for details."}
        </p>
      </article>
    </main>
  );
}
function AgeGate() {
  const { settings } = useStore();
  const [ok, setOk] = useState(
      () => localStorage.getItem("lp_adult") === "yes",
    ),
    [under, setUnder] = useState(false);
  if (ok || !settings.ageCheck) return null;
  return (
    <div className="age-overlay">
      <section
        className="age-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-title"
      >
        <Wine size={34} />
        <p className="eyebrow">LIQUOR PLUG</p>
        <h1 id="age-title">
          Good taste.
          <br />
          Grown company.
        </h1>
        <p>
          {under
            ? "Alcohol purchases are for adults only. Please close this page."
            : "You must be 18 or older to browse and purchase alcohol. Please confirm your age."}
        </p>
        {!under && (
          <>
            <button
              className="button cream"
              onClick={() => {
                localStorage.setItem("lp_adult", "yes");
                setOk(true);
              }}
            >
              I am 18 or older <ArrowRight size={17} />
            </button>
            <button className="age-no" onClick={() => setUnder(true)}>
              I am under 18
            </button>
          </>
        )}
        <small>
          Enjoy responsibly. Proof of age may be required on delivery.
        </small>
      </section>
    </div>
  );
}
function Footer() {
  const { settings } = useStore();
  return (
    <footer>
      <div className="container footer-main">
        <div>
          <Brand />
          <p className="footer-tagline">{settings.tagline}</p>
          <p>
            <Copy name="footerNote">Good taste. Delivered with care.</Copy>
          </p>
          <small>18+ only. Please drink responsibly.</small>
        </div>
        <div>
          <h3>Explore</h3>
          {settings.navigation.map((x, i) => (
            <Link key={i} to={x.href}>
              {x.label}
            </Link>
          ))}
        </div>
        <div>
          <h3>A little information</h3>
          {settings.footerLinks.map((x, i) => (
            <Link key={i} to={x.href}>
              {x.label}
            </Link>
          ))}
          <Link to="/track">Track your order</Link>
        </div>
        <div>
          <h3>Keep good company</h3>
          <a href={"https://wa.me/" + settings.whatsapp}>
            +{settings.whatsapp}
          </a>
          {settings.email && (
            <a href={"mailto:" + settings.email}>{settings.email}</a>
          )}
          {Object.entries(settings.socials || {})
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noreferrer">
                {k}
              </a>
            ))}
          <Link to="/admin">Store dashboard</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {settings.brand}
        </span>
        <span>Secure payments with Paystack · Built for good company</span>
      </div>
    </footer>
  );
}
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
