import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Paintbrush,
  MapPin,
  Ticket,
  Layers,
  Upload,
  Download,
  Plus,
  Search,
  ArrowUpRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  Save,
  Eye,
  Check,
  X,
  Shield,
  Activity,
  Mail,
  Bell,
  History,
  ImagePlus,
} from "lucide-react";
import { useStore, Banner, Field, Button, ErrorBox, Busy } from "./main";
import { api, money, date, slug } from "./api";
import {SocialEditor,EditorialEditor,AdvertisingEditor,FooterEditor} from "./ContentExtras";
const tabs = [
  ["overview", "Overview", LayoutDashboard],
  ["orders", "Orders", ShoppingBag],
  ["products", "Products", Package],
  ["inventory", "Inventory", Layers],
  ["customers", "Customers", Users],
  ["content", "Website editor", Paintbrush],
  ["zones", "Delivery areas", MapPin],
  ["coupons", "Promotions", Ticket],
  ["taxonomy", "Categories & brands", Layers],
  ["import", "Import & export", Upload],
  ["team", "Team access", Shield],
  ["audit", "Activity log", Activity],
  ["notifications", "Notifications", Bell],
  ["system", "System status", Activity],
];
const managerTabs = tabs.map((x) => x[0]).filter((x) => x !== "team");
const kobo = (v) => Math.round(Number(v || 0) * 100);
const inputMoney = (v) => (v === null ? "" : Number(v || 0) / 100);
function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = () => {
    setError("");
    return api(path)
      .then(setData)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    setData(null);
    load();
  }, [path]);
  return { data, error, reload: load };
}
function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function SaveForm({ children, onSave, label = "Save changes" }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(e);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <ErrorBox>{error}</ErrorBox>
      <Button type="submit" disabled={busy}>
        <Save size={16} />
        {busy ? "Saving…" : label}
      </Button>
    </form>
  );
}
function ImageField({ label, value, onChange }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="field image-field">
      <span>{label}</span>
      <div className="image-control">
        <img src={value || "/placeholder.svg"} alt="Preview" />
        <div>
          <input
            aria-label={label + " URL"}
            value={value || ""}
            placeholder="/media/image.webp or https://…"
            onChange={(e) => onChange(e.target.value)}
          />
          <label className="upload-button">
            <ImagePlus size={15} />
            {busy ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                setBusy(true);
                setError("");
                try {
                  const form = new FormData();
                  form.append("file", f);
                  const r = await api("/admin/upload", {
                    method: "POST",
                    body: form,
                  });
                  onChange(r.url);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <small>PNG, JPEG or WebP · Maximum 5 MB</small>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
    </div>
  );
}
function Table({
  columns,
  rows,
  keyField = "id",
  empty = "Nothing here yet.",
}) {
  if (!rows.length)
    return (
      <div className="empty small">
        <Package size={28} />
        <p>{empty}</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[keyField] || i}>
              {columns.map((c) => (
                <td key={c.label}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function PageHeader({ title, subtitle, children }) {
  return (
    <div className="admin-page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="admin-toolbar">{children}</div>
    </div>
  );
}
export default function Admin() {
  const { user } = useStore();
  const path = useLocation().pathname.split("/")[2] || "overview";
  const navigate = useNavigate();
  if (!user)
    return (
      <main>
        <Banner page="admin" compact />
        <div className="container section">
          <h1>Store dashboard</h1>
          <p>Sign in with your store account to continue.</p>
          <Link className="button" to="/account">
            Sign in <ArrowUpRight size={16} />
          </Link>
        </div>
      </main>
    );
  if (!["owner", "manager", "staff"].includes(user.role))
    return (
      <main className="container section">
        <h1>Store access required</h1>
        <p>This account has customer permissions.</p>
        <Link to="/account">Back to your account</Link>
      </main>
    );
  const allowed =
    user.role === "owner"
      ? tabs.map((x) => x[0])
      : user.role === "manager"
        ? managerTabs
        : ["orders", "notifications"];
  const current = allowed.includes(path) ? path : allowed[0];
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-label">
          STORE CONTROL <small>{user.role}</small>
        </div>
        <nav>
          {tabs
            .filter((t) => allowed.includes(t[0]))
            .map(([key, label, Icon]) => (
              <Link
                to={"/admin/" + key}
                className={current === key ? "active" : ""}
                key={key}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
        </nav>
        <Link className="admin-store-link" to="/">
          View storefront <ArrowUpRight size={16} />
        </Link>
      </aside>
      <div className="admin-main">
        <Banner page="admin" compact />
        <div className="admin-mobile-nav">
          <select
            aria-label="Dashboard section"
            value={current}
            onChange={(e) => navigate("/admin/" + e.target.value)}
          >
            {tabs
              .filter((t) => allowed.includes(t[0]))
              .map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        {
          {
            overview: <Overview />,
            orders: <Orders />,
            products: <Products />,
            inventory: <Inventory />,
            customers: <Customers />,
            content: <Content />,
            zones: <Zones />,
            coupons: <Coupons />,
            taxonomy: <Taxonomy />,
            import: <Imports />,
            team: <Team />,
            audit: <Audit />,
            notifications: <Notifications />,
            system: <SystemStatus/>,
          }[current]
        }
      </div>
    </main>
  );
}
function Overview() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const { data, error } = useData(
    "/admin/summary?from=" +
      (from ? new Date(from + "T00:00:00").getTime() : 0) +
      "&to=" +
      (to ? new Date(to + "T00:00:00").getTime() + 86399999 : ""),
  );
  return (
    <>
      <PageHeader
        title="A view of your store."
        subtitle="Sales, orders and the details that keep things moving."
      >
        <Field
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Field
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </PageHeader>
      <ErrorBox>{error}</ErrorBox>
      {data ? (
        <>
          <div className="stat-grid">
            {[
              ["Sales collected", money(data.sales), "/admin/orders"],
              ["Orders", data.orders, "/admin/orders"],
              ["Payment confirmed", data.paidOrders, "/admin/orders"],
              [
                "Wholesale applications",
                data.pendingWholesale,
                "/admin/customers",
              ],
            ].map(([label, value, to]) => (
              <Link to={to} key={label}>
                <span>
                  {label}
                  <ArrowUpRight size={16} />
                </span>
                <strong>{value}</strong>
              </Link>
            ))}
          </div>
          <div className="admin-two">
            <section className="admin-card">
              <h2>Sales breakdown</h2>
              {[
                ...data.revenueByChannel.map((x) => ({
                  label: x.channel,
                  amount: x.amount,
                })),
                ...data.revenueByPricing.map((x) => ({
                  label: x.pricing,
                  amount: x.amount,
                })),
              ].map((x) => (
                <div className="summary-line" key={x.label}>
                  <span>{x.label}</span>
                  <b>{money(x.amount)}</b>
                </div>
              ))}
              <div className="summary-line">
                <span>Delivery fees collected</span>
                <b>{money(data.delivery)}</b>
              </div>
              <div className="summary-line">
                <span>Discounts applied</span>
                <b>{money(data.discounts)}</b>
              </div>
              <div className="summary-line">
                <span>Completed refunds</span>
                <b>{money(data.refunds)}</b>
              </div>
            </section>
            <section className="admin-card">
              <h2>Stock to keep an eye on</h2>
              <p>Available stock excludes active checkout reservations.</p>
              {data.lowStock.slice(0, 10).map((x) => (
                <div className="summary-line" key={x.id}>
                  <span>{x.name}</span>
                  <b className="danger-text">{x.stock}</b>
                </div>
              ))}
              <Link className="text-link" to="/admin/inventory">
                Manage inventory <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
          <section className="admin-card">
            <h2>Product performance</h2>
            <Table
              rows={data.products}
              keyField="name"
              columns={[
                { label: "Product", key: "name" },
                { label: "Category", key: "category" },
                { label: "Units", key: "units" },
                { label: "Revenue", render: (r) => money(r.revenue) },
              ]}
            />
          </section>
        </>
      ) : (
        !error && <Busy />
      )}
    </>
  );
}
const blankProduct = () => ({
  name: "",
  slug: "",
  sku: "LP-" + Date.now().toString(36).toUpperCase(),
  description: "",
  category: "",
  brand: "",
  size: "",
  price: 0,
  wholesale_price: null,
  wholesale_min: 6,
  sale_price: null,
  sale_start: null,
  sale_end: null,
  low_stock: 5,
  image: "/placeholder.svg",
  gallery: [],
  visible: 1,
  featured: 0,
});
function ProductEditor({ product, onClose, onSaved }) {
  const { categories, brands, notify } = useStore();
  const [p, setP] = useState(structuredClone(product));
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const save = async () => {
    await api("/admin/products" + (p.id ? "/" + p.id : ""), {
      method: p.id ? "PUT" : "POST",
      body: p,
    });
    notify("Product saved");
    await onSaved();
    onClose();
  };
  return (
    <Modal title={p.id ? "Edit product" : "Add product"} onClose={onClose}>
      <SaveForm onSave={save}>
        <div className="form-row">
          <Field
            label="Product name"
            required
            value={p.name}
            onChange={(e) =>
              setP({
                ...p,
                name: e.target.value,
                ...(!p.id ? { slug: slug(e.target.value) } : {}),
              })
            }
          />
          <Field
            label="Product URL slug"
            required
            value={p.slug}
            onChange={(e) => set("slug", e.target.value)}
          />
        </div>
        <div className="form-row">
          <Field
            label="SKU"
            required
            value={p.sku}
            onChange={(e) => set("sku", e.target.value)}
          />
          <Field
            label="Bottle / pack size"
            value={p.size}
            onChange={(e) => set("size", e.target.value)}
          />
        </div>
        <div className="form-row">
          <Field label="Category">
            <input
              list="categories"
              required
              value={p.category}
              onChange={(e) => set("category", e.target.value)}
            />
            <datalist id="categories">
              {categories.map((x) => (
                <option key={x.id}>{x.name}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Brand">
            <input
              list="brands"
              value={p.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
            <datalist id="brands">
              {brands.map((x) => (
                <option key={x.id}>{x.name}</option>
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={p.description}
            rows={4}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <div className="form-row">
          <Field
            label="Retail price ₦"
            type="number"
            min="0"
            step="0.01"
            required
            value={inputMoney(p.price)}
            onChange={(e) => set("price", kobo(e.target.value))}
          />
          <Field
            label="Wholesale price ₦ (blank = unavailable)"
            type="number"
            min="0"
            step="0.01"
            value={inputMoney(p.wholesale_price)}
            onChange={(e) =>
              set(
                "wholesale_price",
                e.target.value === "" ? null : kobo(e.target.value),
              )
            }
          />
        </div>
        <div className="form-row">
          <Field
            label="Wholesale minimum quantity"
            type="number"
            min="1"
            required
            value={p.wholesale_min}
            onChange={(e) => set("wholesale_min", Number(e.target.value))}
          />
          <Field
            label="Low-stock threshold"
            type="number"
            min="0"
            value={p.low_stock}
            onChange={(e) => set("low_stock", Number(e.target.value))}
          />
        </div>
        <h3>Scheduled sale</h3>
        <Field
          label="Sale price ₦ (blank = no sale)"
          type="number"
          min="0"
          step="0.01"
          value={inputMoney(p.sale_price)}
          onChange={(e) =>
            set(
              "sale_price",
              e.target.value === "" ? null : kobo(e.target.value),
            )
          }
        />
        <div className="form-row">
          {["sale_start", "sale_end"].map((k) => (
            <Field
              key={k}
              label={k === "sale_start" ? "Starts" : "Ends"}
              type="datetime-local"
              value={
                p[k]
                  ? new Date(
                      Number(p[k]) - new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                set(
                  k,
                  e.target.value ? new Date(e.target.value).getTime() : null,
                )
              }
            />
          ))}
        </div>
        <ImageField
          label="Main product image"
          value={p.image}
          onChange={(v) => set("image", v)}
        />
        <h3>Image gallery</h3>
        {p.gallery.map((im, i) => (
          <div className="editor-block" key={i}>
            <ImageField
              label={"Gallery image " + (i + 1)}
              value={im}
              onChange={(v) =>
                set(
                  "gallery",
                  p.gallery.map((x, j) => (i === j ? v : x)),
                )
              }
            />
            <button
              className="text-link"
              type="button"
              onClick={() =>
                set(
                  "gallery",
                  p.gallery.filter((_, j) => i !== j),
                )
              }
            >
              Remove image
            </button>
          </div>
        ))}
        <button
          className="button outline"
          type="button"
          onClick={() => set("gallery", [...p.gallery, "/placeholder.svg"])}
        >
          <Plus size={16} /> Add gallery image
        </button>
        <div className="checks">
          <label className="check">
            <input
              type="checkbox"
              checked={!!p.visible}
              onChange={(e) => set("visible", e.target.checked ? 1 : 0)}
            />{" "}
            Visible in store
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={!!p.featured}
              onChange={(e) => set("featured", e.target.checked ? 1 : 0)}
            />{" "}
            Featured product
          </label>
        </div>
        <p className="help">
          Inventory is managed separately so every adjustment has a history.
        </p>
      </SaveForm>
    </Modal>
  );
}
function Products() {
  const { data, error, reload } = useData("/admin/products");
  const [q, setQ] = useState(""),
    [edit, setEdit] = useState(null),
    [page, setPage] = useState(1);
  const { notify } = useStore();
  const rows = (data || []).filter((p) =>
    (p.name + " " + p.sku + " " + p.brand)
      .toLowerCase()
      .includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Your collection."
        subtitle={
          data
            ? `${data.length} products · keep prices and availability up to date.`
            : ""
        }
      >
        <button className="button" onClick={() => setEdit(blankProduct())}>
          <Plus size={16} /> Add product
        </button>
      </PageHeader>
      <div className="admin-card">
        <div className="admin-toolbar">
          <Field
            label="Search products"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <a className="button outline" href="/api/admin/export/products">
            <Download size={16} /> Export
          </a>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {data ? (
          <>
            <Table
              rows={rows.slice((page - 1) * 30, page * 30)}
              columns={[
                {
                  label: "Product",
                  render: (p) => (
                    <div className="product-cell">
                      <img
                        src={p.image}
                        alt=""
                        onError={(e) =>
                          (e.currentTarget.src = "/placeholder.svg")
                        }
                      />
                      <div>
                        <b>{p.name}</b>
                        <small>
                          {p.sku} · {p.size}
                        </small>
                      </div>
                    </div>
                  ),
                },
                { label: "Retail", render: (p) => money(p.price) },
                {
                  label: "Wholesale",
                  render: (p) =>
                    p.wholesale_price === null
                      ? "Not set"
                      : money(p.wholesale_price),
                },
                { label: "Available", key: "stock" },
                {
                  label: "Visibility",
                  render: (p) => (p.visible ? "Visible" : "Hidden"),
                },
                {
                  label: "Actions",
                  render: (p) => (
                    <div className="actions">
                      <button onClick={() => setEdit(p)}>Edit</button>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              "Archive " +
                                p.name +
                                "? Existing order history will remain.",
                            )
                          )
                            return;
                          await api("/admin/products/" + p.id, {
                            method: "DELETE",
                          });
                          notify("Product archived");
                          reload();
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  ),
                },
              ]}
            />
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>
                {page} / {Math.max(1, Math.ceil(rows.length / 30))}
              </span>
              <button
                disabled={page * 30 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          !error && <Busy />
        )}
      </div>
      {edit && (
        <ProductEditor
          product={edit}
          onClose={() => setEdit(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
function Inventory() {
  const { data, error, reload } = useData("/admin/products");
  const [edit, setEdit] = useState(null),
    [q, setQ] = useState("");
  const history = useData("/admin/stock");
  const {notify}=useStore();const [restocking,setRestocking]=useState(false),[stockError,setStockError]=useState('');
  const minimum=async()=>{if(!confirm('Set every active product with fewer than 10 available units to 10? This adds inventory and is recorded in the stock history.'))return;setRestocking(true);setStockError('');try{const result=await api('/admin/stock/minimum',{method:'POST'});notify(`${result.changed} products updated`);await reload();await history.reload();}catch(e){setStockError(e.message);}finally{setRestocking(false);}};
  return (
    <>
      <PageHeader
        title="Every bottle accounted for."
        subtitle="Adjust available stock and retain a record of each change."
      />
      <section className="admin-card"><h2>Opening stock</h2><p>The initial update sets a minimum of 10 units once. Use this button only when those units are available in store.</p><button className="button outline" disabled={restocking} onClick={minimum}>{restocking?'Updating…':'Set minimum stock to 10'}</button><ErrorBox>{stockError}</ErrorBox></section>
      <section className="admin-card">
        <Field
          label="Find a product"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ErrorBox>{error}</ErrorBox>
        {data ? (
          <Table
            rows={data
              .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 80)}
            columns={[
              { label: "Product", key: "name" },
              { label: "Available", key: "stock" },
              { label: "Alert threshold", key: "low_stock" },
              {
                label: "Action",
                render: (p) => (
                  <button onClick={() => setEdit(p)}>Adjust stock</button>
                ),
              },
            ]}
          />
        ) : (
          <Busy />
        )}
        <p className="help">
          Showing up to 80 matching products. Search to narrow the list.
        </p>
      </section>
      <section className="admin-card">
        <h2>Stock movement history</h2>
        {history.data && (
          <Table
            rows={history.data.slice(0, 100)}
            columns={[
              { label: "When", render: (r) => date(r.created_at) },
              { label: "Product", key: "name" },
              { label: "Change", key: "delta" },
              { label: "Reason", key: "reason" },
              { label: "By", key: "actor" },
            ]}
          />
        )}
      </section>
      {edit && (
        <Modal
          title={"Adjust stock · " + edit.name}
          onClose={() => setEdit(null)}
        >
          <SaveForm
            onSave={async (e) => {
              const f = new FormData(e.currentTarget);
              await api("/admin/stock", {
                method: "POST",
                body: {
                  productId: edit.id,
                  delta: Number(f.get("delta")),
                  reason: f.get("reason"),
                },
              });
              setEdit(null);
              reload();
              history.reload();
            }}
          >
            <p>Available stock: {edit.stock}</p>
            <Field
              label="Adjustment (+ add / − remove)"
              name="delta"
              type="number"
              required
            />
            <Field label="Reason" name="reason" required minLength={3} />
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
function Orders() {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null);
  const { data, error, reload } = useData(
    "/admin/orders?q=" + encodeURIComponent(q) + "&status=" + status,
  );
  return (
    <>
      <PageHeader
        title="From bag to doorstep."
        subtitle="Online and WhatsApp orders, together in one place."
      >
        <a className="button outline" href="/api/admin/export/orders">
          <Download size={16} /> Export orders
        </a>
      </PageHeader>
      <section className="admin-card">
        <div className="admin-toolbar">
          <Field
            label="Search reference, name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {[
                "new",
                "confirmed",
                "processing",
                "ready",
                "shipped",
                "delivered",
                "cancelled",
                "expired",
                "payment_review",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorBox>{error}</ErrorBox>
        {data ? (
          <Table
            rows={data}
            columns={[
              {
                label: "Order",
                render: (r) => (
                  <button
                    className="text-link"
                    onClick={() => setSelected(r.ref)}
                  >
                    {r.ref}
                  </button>
                ),
              },
              {
                label: "Customer",
                render: (r) => (
                  <>
                    <b>{r.name}</b>
                    <small>{r.email}</small>
                  </>
                ),
              },
              { label: "Total", render: (r) => money(r.total) },
              { label: "Channel", key: "channel" },
              { label: "Payment", key: "payment_status" },
              { label: "Fulfilment", key: "status" },
              { label: "Created", render: (r) => date(r.created_at) },
            ]}
          />
        ) : (
          !error && <Busy />
        )}
      </section>
      {selected && (
        <OrderEditor
          reference={selected}
          onClose={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function OrderEditor({ reference, onClose }) {
  const { user, notify } = useStore();
  const { data: o, error, reload } = useData("/admin/orders/" + reference);
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const action = async (path, body) => {
    setBusy(true);
    setErr("");
    try {
      await api("/admin/orders/" + reference + path, { method: "POST", body });
      await reload();
      notify("Order updated");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={"Order " + reference} onClose={onClose}>
      <ErrorBox>{error || err}</ErrorBox>
      {o ? (
        <>
          <div className="status-pills">
            <span>{o.status}</span>
            <span>{o.payment_status}</span>
            <span>{o.stock_state}</span>
            <span>{o.pricing}</span>
          </div>
          {o.status === "payment_review" && user.role !== "staff" && (
            <div className="editor-block">
              <p>
                Payment was received after the reservation ended. Add inventory
                if needed, then allocate stock or arrange a refund.
              </p>
              <button
                className="button"
                disabled={busy}
                onClick={() => action("/allocate", {})}
              >
                Allocate available stock
              </button>
            </div>
          )}
          <p>
            <b>{o.name}</b>
            <br />
            {o.email}
            <br />
            {o.phone}
            <br />
            {o.address}
            <br />
            {o.zone}
          </p>
          {o.note && <p>Customer note: {o.note}</p>}
          <Table
            rows={o.items}
            columns={[
              { label: "Product", key: "name" },
              { label: "Qty", key: "qty" },
              { label: "Unit price", render: (r) => money(r.unit_price) },
              {
                label: "Line total",
                render: (r) => money(r.qty * r.unit_price),
              },
            ]}
          />
          <div className="summary-line">
            <span>Items / Discount / Delivery</span>
            <span>
              {money(o.subtotal)} / −{money(o.discount)} / {money(o.delivery)}
            </span>
          </div>
          <h2>Total {money(o.total)}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              action("/status", {
                status: d.get("status"),
                note: d.get("note"),
              });
            }}
          >
            <h3>Update fulfilment</h3>
            <Field label="New status">
              <select name="status">
                {[
                  "confirmed",
                  "processing",
                  "ready",
                  "shipped",
                  "delivered",
                  "cancelled",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Internal note" name="note" />
            <Button disabled={busy}>Update order</Button>
          </form>
          {o.channel === "whatsapp" &&
            o.payment_status === "unpaid" &&
            user.role !== "staff" && (
              <form
                className="editor-block"
                onSubmit={(e) => {
                  e.preventDefault();
                  action("/manual-payment", {
                    evidence: new FormData(e.currentTarget).get("evidence"),
                  });
                }}
              >
                <h3>Confirm received WhatsApp payment</h3>
                <p>Confirm only after checking your bank or payment records.</p>
                <Field
                  label="Transfer reference / confirmation evidence"
                  name="evidence"
                  minLength={5}
                  required
                />
                <Button disabled={busy}>Confirm payment received</Button>
              </form>
            )}
          {o.channel === "paystack" && o.payment_status === "unpaid" && (
            <button
              className="button outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/orders/" + reference + "/verify", {
                    method: "POST",
                  });
                  await reload();
                } catch (e) {
                  setErr(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Verify with Paystack
            </button>
          )}
          <form
            className="editor-block"
            onSubmit={(e) => {
              e.preventDefault();
              action("/note", {
                note: new FormData(e.currentTarget).get("note"),
              });
              e.currentTarget.reset();
            }}
          >
            <Field label="Add internal note" name="note" required />
            <Button disabled={busy}>Add note</Button>
          </form>
          {user.role !== "staff" &&
            ["paid", "partially_refunded"].includes(o.payment_status) && (
              <form
                className="editor-block"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  action("/refund", {
                    amount: kobo(d.get("amount")),
                    reason: d.get("reason"),
                    status: d.get("status"),
                  });
                }}
              >
                <h3>Refund record</h3>
                <p>
                  This records a refund; it does not transfer funds. Complete
                  the transfer through your bank or Paystack first.
                </p>
                <Field
                  label="Amount ₦"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
                <Field label="Reason" name="reason" minLength={3} required />
                <Field label="Status">
                  <select name="status">
                    <option value="recorded">Pending / recorded</option>
                    <option value="completed">Transfer completed</option>
                  </select>
                </Field>
                <Button disabled={busy}>Save refund record</Button>
              </form>
            )}
          <h3>Timeline & internal notes</h3>
          {o.events.map((e) => (
            <div className="timeline" key={e.id}>
              <span className="dot" />
              <div>
                {e.internal ? "Internal: " : ""}
                {e.message}
                <small>{date(e.created_at)}</small>
              </div>
            </div>
          ))}
          {o.refunds.length > 0 && (
            <>
              <h3>Refunds</h3>
              {o.refunds.map((r) => (
                <p key={r.id}>
                  {money(r.amount)} · {r.status} · {r.reason}
                </p>
              ))}
            </>
          )}
          <button className="button outline" onClick={() => window.print()}>
            Print order
          </button>
        </>
      ) : (
        <Busy />
      )}
    </Modal>
  );
}
function Customers() {
  const { data, error, reload } = useData("/admin/customers");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  return (
    <>
      <PageHeader
        title="The good company."
        subtitle="Customer accounts and wholesale applications."
      >
        <a className="button outline" href="/api/admin/export/customers">
          Export customers <Download size={16} />
        </a>
      </PageHeader>
      <section className="admin-card">
        <Field
          label="Search customers"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ErrorBox>{error}</ErrorBox>
        {data && (
          <Table
            rows={data.filter((r) =>
              (r.name + " " + r.email + " " + r.business)
                .toLowerCase()
                .includes(q.toLowerCase()),
            )}
            columns={[
              {
                label: "Customer",
                render: (r) => (
                  <>
                    <b>{r.name}</b>
                    <small>{r.email}</small>
                    <small>{r.phone}</small>
                  </>
                ),
              },
              { label: "Business", key: "business" },
              { label: "Wholesale", key: "wholesale_status" },
              {
                label: "Contact",
                render: (r) => (
                  <button onClick={() => setEdit(r)}>Edit details</button>
                ),
              },
              {
                label: "Action",
                render: (r) => (
                  <select
                    aria-label={"Wholesale status for " + r.name}
                    value={r.wholesale_status}
                    onChange={async (e) => {
                      await api("/admin/customers/" + r.id + "/wholesale", {
                        method: "POST",
                        body: { status: e.target.value },
                      });
                      reload();
                    }}
                  >
                    {["none", "pending", "approved", "rejected"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ),
              },
            ]}
          />
        )}
      </section>
      {edit && (
        <Modal title="Edit customer details" onClose={() => setEdit(null)}>
          <SaveForm
            onSave={async () => {
              await api("/admin/customers/" + edit.id, {
                method: "POST",
                body: {
                  name: edit.name,
                  phone: edit.phone,
                  business: edit.business,
                },
              });
              setEdit(null);
              reload();
            }}
          >
            {[
              ["name", "Full name"],
              ["phone", "Phone"],
              ["business", "Business"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                value={edit[key]}
                onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
              />
            ))}
            <p className="help">
              Existing order contact details are kept as recorded at checkout.
              Email/login identity is unchanged.
            </p>
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
function Content() {
  const { data, error, reload } = useData("/admin/content");
  const [draft, setDraft] = useState(null),
    [tab, setTab] = useState("banners"),
    [page, setPage] = useState("home"),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const { setPreview, refresh, notify } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (data) setDraft(data.draft);
  }, [data]);
  if (!draft)
    return (
      <>
        <ErrorBox>{error}</ErrorBox>
        <Busy />
      </>
    );
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const bannerChange = (i, k, v) =>
    set("banners", {
      ...draft.banners,
      [page]: draft.banners[page].map((x, j) =>
        i === j ? { ...x, [k]: v } : x,
      ),
    });
  const save = () => api("/admin/content", { method: "PUT", body: draft });
  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Make it your own."
        subtitle="Edit predefined sections, save a draft, then publish when ready."
      >
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await save();
              notify("Draft saved");
            })
          }
        >
          <Save size={16} /> Save draft
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await save();
              setPreview(draft);
              navigate("/");
            })
          }
        >
          <Eye size={16} /> Preview
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await save();
              await api("/admin/content/publish", { method: "POST" });
              await refresh();
              notify("Website published");
              reload();
            })
          }
        >
          Publish changes <ArrowUpRight size={16} />
        </button>
      </PageHeader>
      <ErrorBox>{err}</ErrorBox>
      <div className="editor-tabs">
        {[
          "banners",
          "sections",
          "copy",
          "branding",
          "navigation",
          "business",
          "social media",
          "discovery & recipes",
          "advertising",
          "footer banners",
          "policies",
          "seo",
          "versions",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section className="admin-card">
        {tab === "banners" ? (
          <>
            <h2>Banner carousels</h2>
            <label className="check"><input type="checkbox" checked={draft.carousel?.autoplay!==false} onChange={e=>set('carousel',{...draft.carousel,autoplay:e.target.checked})}/>Automatically advance slides</label>
            <Field label="Seconds between slides" type="number" min="3" max="20" value={(draft.carousel?.interval||6500)/1000} onChange={e=>set('carousel',{...draft.carousel,interval:Math.round(Number(e.target.value)*1000)})}/>
            <p className="help">The promotions carousel supplies the banners between every 20 shop products. Each slide has its own editable Shop now link.</p>
            <p>
              Each page has its own slides. Optional mobile images can use a different crop. Full artwork keeps the entire image visible.
            </p>
            <Field label="Page">
              <select value={page} onChange={(e) => setPage(e.target.value)}>
                {Object.keys(draft.banners).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            {draft.banners[page].map((b, i) => (
              <div className="editor-block" key={i}>
                <div className="section-title">
                  <h3>Slide {i + 1}</h3>
                  <button
                    onClick={() =>
                      set("banners", {
                        ...draft.banners,
                        [page]: draft.banners[page].filter((_, j) => i !== j),
                      })
                    }
                  >
                    Remove slide
                  </button>
                </div>
                <label className="check"><input type="checkbox" checked={b.visible!==false} onChange={e=>bannerChange(i,'visible',e.target.checked)}/>Show this slide</label>
                <Field label="Image layout"><select value={b.layout||'editorial'} onChange={e=>bannerChange(i,'layout',e.target.value)}><option value="editorial">Background image with headline</option><option value="artwork">Full artwork without cropping</option></select></Field>
                <Field label="Headline">
                  <textarea
                    value={b.title}
                    onChange={(e) => bannerChange(i, "title", e.target.value)}
                  />
                </Field>
                <Field
                  label="Supporting text"
                  value={b.subtitle}
                  onChange={(e) => bannerChange(i, "subtitle", e.target.value)}
                />
                <div className="form-row">
                  <Field
                    label="Button text"
                    value={b.button}
                    onChange={(e) => bannerChange(i, "button", e.target.value)}
                  />
                  <Field
                    label="Button link"
                    value={b.href}
                    onChange={(e) => bannerChange(i, "href", e.target.value)}
                  />
                </div>
                <ImageField
                  label="Desktop image"
                  value={b.image}
                  onChange={(v) => bannerChange(i, "image", v)}
                />
                <ImageField
                  label="Mobile image"
                  value={b.mobileImage}
                  onChange={(v) => bannerChange(i, "mobileImage", v)}
                />
                <div className="form-row">
                  {["startsAt", "endsAt"].map((k) => (
                    <Field
                      label={
                        k === "startsAt"
                          ? "Show from (optional)"
                          : "Hide after (optional)"
                      }
                      key={k}
                      type="datetime-local"
                      value={
                        b[k]
                          ? new Date(
                              Number(b[k]) -
                                new Date().getTimezoneOffset() * 60000,
                            )
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        bannerChange(
                          i,
                          k,
                          e.target.value
                            ? new Date(e.target.value).getTime()
                            : 0,
                        )
                      }
                    />
                  ))}
                </div>
                <div className="actions">
                  <button
                    disabled={i === 0}
                    onClick={() => {
                      const arr = [...draft.banners[page]];
                      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                      set("banners", { ...draft.banners, [page]: arr });
                    }}
                  >
                    Move up
                  </button>
                  <button
                    disabled={i === draft.banners[page].length - 1}
                    onClick={() => {
                      const arr = [...draft.banners[page]];
                      [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                      set("banners", { ...draft.banners, [page]: arr });
                    }}
                  >
                    Move down
                  </button>
                </div>
              </div>
            ))}
            <button
              className="button outline"
              onClick={() =>
                set("banners", {
                  ...draft.banners,
                  [page]: [
                    ...draft.banners[page],
                    {
                      title: "Your next great pour.",
                      subtitle: "",
                      image: "",
                      mobileImage: "",
                      button: "Shop now",
                      href: "/shop",
                      startsAt: 0,
                      endsAt: 0,
                    },
                  ],
                })
              }
            >
              <Plus size={16} /> Add slide
            </button>
          </>
        ) : tab === "sections" ? (
          <>
            <h2>Homepage sections</h2>
            {draft.sections.map((s, i) => (
              <div className="editor-block" key={i}>
                <p className="eyebrow">{s.type}</p>
                <Field
                  label="Heading"
                  value={s.title}
                  onChange={(e) =>
                    set(
                      "sections",
                      draft.sections.map((x, j) =>
                        i === j ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Field
                  label="Supporting text"
                  value={s.subtitle}
                  onChange={(e) =>
                    set(
                      "sections",
                      draft.sections.map((x, j) =>
                        i === j ? { ...x, subtitle: e.target.value } : x,
                      ),
                    )
                  }
                />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={s.visible}
                    onChange={(e) =>
                      set(
                        "sections",
                        draft.sections.map((x, j) =>
                          i === j ? { ...x, visible: e.target.checked } : x,
                        ),
                      )
                    }
                  />{" "}
                  Visible
                </label>
                <div className="actions">
                  <button
                    disabled={!i}
                    onClick={() => {
                      const a = [...draft.sections];
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      set("sections", a);
                    }}
                  >
                    Move up
                  </button>
                  <button
                    disabled={i === draft.sections.length - 1}
                    onClick={() => {
                      const a = [...draft.sections];
                      [a[i + 1], a[i]] = [a[i], a[i + 1]];
                      set("sections", a);
                    }}
                  >
                    Move down
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : tab === "branding" ? (
          <>
            <h2>Branding</h2>
            <Field
              label="Store name"
              value={draft.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
            <Field
              label="Tagline"
              value={draft.tagline}
              onChange={(e) => set("tagline", e.target.value)}
            />
            <ImageField
              label="Logo"
              value={draft.logo}
              onChange={(v) => set("logo", v)}
            />
            <div className="form-row">
              <Field
                label="Brand colour"
                type="color"
                value={draft.primary}
                onChange={(e) => set("primary", e.target.value)}
              />
              <Field
                label="Dark background"
                type="color"
                value={draft.background}
                onChange={(e) => set("background", e.target.value)}
              />
            </div>
            <Field label="Typography">
              <select
                value={draft.font}
                onChange={(e) => set("font", e.target.value)}
              >
                <option value="sans">
                  Modern sans with editorial headings
                </option>
                <option value="serif">Classic serif</option>
              </select>
            </Field>
          </>
        ) : tab === "navigation" ? (
          <>
            {["navigation", "footerLinks"].map((k) => (
              <div key={k}>
                <h2>{k === "navigation" ? "Header links" : "Footer links"}</h2>
                {draft[k].map((l, i) => (
                  <div className="form-row editor-block" key={i}>
                    <Field
                      label="Label"
                      value={l.label}
                      onChange={(e) =>
                        set(
                          k,
                          draft[k].map((x, j) =>
                            i === j ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <Field
                      label="Link"
                      value={l.href}
                      onChange={(e) =>
                        set(
                          k,
                          draft[k].map((x, j) =>
                            i === j ? { ...x, href: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <button
                      onClick={() =>
                        set(
                          k,
                          draft[k].filter((_, j) => i !== j),
                        )
                      }
                    >
                      Remove link
                    </button>
                  </div>
                ))}
                <button
                  className="button outline"
                  onClick={() =>
                    set(k, [...draft[k], { label: "New link", href: "/shop" }])
                  }
                >
                  Add link
                </button>
              </div>
            ))}
          </>
        ) : tab === "social media" ? <SocialEditor draft={draft} set={set}/>
          : tab === "discovery & recipes" ? <EditorialEditor draft={draft} set={set} ImageField={ImageField}/>
          : tab === "advertising" ? <AdvertisingEditor draft={draft} set={set} ImageField={ImageField}/>
          : tab === "footer banners" ? <FooterEditor draft={draft} set={set} ImageField={ImageField}/>
          : tab === "business" ? (
          <>
            <h2>Contact & business settings</h2>
            {[
              ["whatsapp", "WhatsApp number (international digits only)"],
              ["email", "Contact email"],
              ["address", "Store / pickup address"],
              ["hours", "Opening hours"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                value={draft[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            ))}
            <h3>Wholesale rules</h3>
            {[
              [
                "wholesaleQuantityEnabled",
                "Enforce product minimum quantities",
              ],
              ["wholesaleValueEnabled", "Enforce minimum total order value"],
              ["pickupEnabled", "Enable store pickup"],
              ["ageCheck", "Show age confirmation screen"],
            ].map(([k, label]) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={draft[k]}
                  onChange={(e) => set(k, e.target.checked)}
                />
                {label}
              </label>
            ))}
            <Field
              label="Wholesale minimum order ₦"
              type="number"
              min="0"
              value={inputMoney(draft.wholesaleMinimum)}
              onChange={(e) => set("wholesaleMinimum", kobo(e.target.value))}
            />
            <Field label="Pickup instructions">
              <textarea
                value={draft.pickupInstructions}
                onChange={(e) => set("pickupInstructions", e.target.value)}
              />
            </Field>
          </>
        ) : tab === "copy" ? (
          <>
            <h2>Page copy</h2>
            <p>
              Edit the headings and supporting text in predefined storefront
              sections.
            </p>
            {Object.entries(draft.copy || {}).map(([key, value]) => (
              <Field key={key} label={key}>
                <textarea
                  value={value}
                  onChange={(e) =>
                    set("copy", { ...draft.copy, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
          </>
        ) : tab === "policies" ? (
          <>
            <h2>Store policies</h2>
            <p>
              Replace the starter wording with policies that match your business
              operations before launch.
            </p>
            {Object.entries(draft.policies).map(([k, v]) => (
              <Field key={k} label={k}>
                <textarea
                  rows={8}
                  value={v}
                  onChange={(e) =>
                    set("policies", { ...draft.policies, [k]: e.target.value })
                  }
                />
              </Field>
            ))}
          </>
        ) : tab === "seo" ? (
          <>
            <h2>Search & sharing</h2>
            <ImageField
              label="Social sharing image"
              value={draft.socialImage || "/social-card.svg"}
              onChange={(v) => set("socialImage", v)}
            />
            <Field
              label="Site title"
              value={draft.seoTitle}
              onChange={(e) => set("seoTitle", e.target.value)}
            />
            <Field label="Site description">
              <textarea
                value={draft.seoDescription}
                onChange={(e) => set("seoDescription", e.target.value)}
              />
            </Field>
            <p>
              Product URLs use their editable slugs. Product page titles are
              generated from product names. Sitemap: /sitemap.xml
            </p>
          </>
        ) : (
          <>
            <h2>Previous published versions</h2>
            <p>Restore a version to the draft, preview it, then publish.</p>
            {data.versions.map((v) => (
              <div className="summary-line" key={v.id}>
                <span>
                  {date(v.created_at)}
                  <small>{v.actor}</small>
                </span>
                <button
                  onClick={() =>
                    run(async () => {
                      await api("/admin/content/restore", {
                        method: "POST",
                        body: { id: v.id },
                      });
                      await reload();
                      notify("Version restored to draft");
                    })
                  }
                >
                  Restore to draft
                </button>
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}
function Zones() {
  const { data, error, reload } = useData("/admin/zones");
  const [edit, setEdit] = useState(null);
  const { refresh } = useStore();
  return (
    <>
      <PageHeader
        title="Lagos, one area at a time."
        subtitle="Only enabled areas can accept orders. Review fees and serviceability before enabling."
      >
        <button
          className="button"
          onClick={() =>
            setEdit({
              lga: "",
              neighbourhood: "",
              fee: 0,
              minimum: 0,
              eta: "Delivery time confirmed after ordering",
              enabled: 0,
            })
          }
        >
          <Plus size={16} /> Add neighbourhood
        </button>
      </PageHeader>
      <section className="admin-card">
        <ErrorBox>{error}</ErrorBox>
        {data ? (
          <Table
            rows={data}
            columns={[
              { label: "LGA", key: "lga" },
              {
                label: "Neighbourhood",
                render: (r) => r.neighbourhood || "LGA default",
              },
              { label: "Delivery fee", render: (r) => money(r.fee) },
              { label: "Minimum order", render: (r) => money(r.minimum) },
              {
                label: "Status",
                render: (r) => (r.enabled ? "Enabled" : "Disabled"),
              },
              {
                label: "Action",
                render: (r) => <button onClick={() => setEdit(r)}>Edit</button>,
              },
            ]}
          />
        ) : (
          <Busy />
        )}
      </section>
      {edit && (
        <Modal title="Delivery area" onClose={() => setEdit(null)}>
          <SaveForm
            onSave={async () => {
              await api("/admin/zones", { method: "POST", body: edit });
              setEdit(null);
              await reload();
              refresh();
            }}
          >
            {[
              ["lga", "LGA"],
              ["neighbourhood", "Neighbourhood (blank for LGA default)"],
              ["eta", "Estimated delivery time"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                required={k !== "neighbourhood"}
                value={edit[k]}
                onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
              />
            ))}
            {[
              ["fee", "Delivery fee ₦"],
              ["minimum", "Minimum order ₦"],
            ].map(([k, label]) => (
              <Field
                key={k}
                label={label}
                type="number"
                min="0"
                value={inputMoney(edit[k])}
                onChange={(e) =>
                  setEdit({ ...edit, [k]: kobo(e.target.value) })
                }
              />
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={!!edit.enabled}
                onChange={(e) =>
                  setEdit({ ...edit, enabled: e.target.checked ? 1 : 0 })
                }
              />{" "}
              Enable this delivery area
            </label>
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
function Coupons() {
  const { data, error, reload } = useData("/admin/coupons");
  const [edit, setEdit] = useState(null);
  return (
    <>
      <PageHeader
        title="A little extra incentive."
        subtitle="Coupons apply to full-price retail orders; offers do not stack."
      >
        <button
          className="button"
          onClick={() =>
            setEdit({
              code: "",
              type: "percent",
              value: 10,
              minimum: 0,
              max_uses: 100,
              enabled: 1,
              starts_at: null,
              expires_at: null,
            })
          }
        >
          <Plus size={16} /> Create coupon
        </button>
      </PageHeader>
      <section className="admin-card">
        <ErrorBox>{error}</ErrorBox>
        {data && (
          <Table
            rows={data}
            columns={[
              { label: "Code", key: "code" },
              {
                label: "Discount",
                render: (r) =>
                  r.type === "percent" ? r.value + "%" : money(r.value),
              },
              { label: "Minimum", render: (r) => money(r.minimum) },
              {
                label: "Uses",
                render: (r) => (r.uses || 0) + " / " + r.max_uses,
              },
              {
                label: "Status",
                render: (r) => (r.enabled ? "Enabled" : "Disabled"),
              },
              {
                label: "Action",
                render: (r) => <button onClick={() => setEdit(r)}>Edit</button>,
              },
            ]}
          />
        )}
      </section>
      {edit && (
        <Modal title="Coupon" onClose={() => setEdit(null)}>
          <SaveForm
            onSave={async () => {
              await api("/admin/coupons", { method: "POST", body: edit });
              setEdit(null);
              reload();
            }}
          >
            <Field
              label="Coupon code"
              value={edit.code}
              required
              onChange={(e) =>
                setEdit({ ...edit, code: e.target.value.toUpperCase() })
              }
            />
            <Field label="Discount type">
              <select
                value={edit.type}
                onChange={(e) =>
                  setEdit({ ...edit, type: e.target.value, value: 0 })
                }
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            <Field
              label={edit.type === "percent" ? "Percentage" : "Amount ₦"}
              type="number"
              min="0"
              value={
                edit.type === "percent" ? edit.value : inputMoney(edit.value)
              }
              onChange={(e) =>
                setEdit({
                  ...edit,
                  value:
                    edit.type === "percent"
                      ? Number(e.target.value)
                      : kobo(e.target.value),
                })
              }
            />
            <Field
              label="Minimum spend ₦"
              type="number"
              min="0"
              value={inputMoney(edit.minimum)}
              onChange={(e) =>
                setEdit({ ...edit, minimum: kobo(e.target.value) })
              }
            />
            <Field
              label="Maximum uses"
              type="number"
              min="1"
              value={edit.max_uses}
              onChange={(e) =>
                setEdit({ ...edit, max_uses: Number(e.target.value) })
              }
            />
            {["starts_at", "expires_at"].map((k) => (
              <Field
                key={k}
                label={k === "starts_at" ? "Starts" : "Expires"}
                type="datetime-local"
                value={
                  edit[k]
                    ? new Date(
                        Number(edit[k]) -
                          new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    [k]: e.target.value
                      ? new Date(e.target.value).getTime()
                      : null,
                  })
                }
              />
            ))}
            <label className="check">
              <input
                type="checkbox"
                checked={!!edit.enabled}
                onChange={(e) =>
                  setEdit({ ...edit, enabled: e.target.checked ? 1 : 0 })
                }
              />{" "}
              Enabled
            </label>
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
function Taxonomy() {
  const { data, error, reload } = useData("/admin/taxonomy");
  const [edit, setEdit] = useState(null),
    [kind, setKind] = useState("categories");
  const { refresh } = useStore();
  return (
    <>
      <PageHeader title="Keep the collection organised.">
        <button
          className="button"
          onClick={() =>
            setEdit({ kind, name: "", slug: "", image: "/placeholder.svg" })
          }
        >
          <Plus size={16} /> Add {kind === "brands" ? "brand" : "category"}
        </button>
      </PageHeader>
      <section className="admin-card">
        <Field label="Collection type">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="categories">Categories</option>
            <option value="brands">Brands</option>
          </select>
        </Field>
        <ErrorBox>{error}</ErrorBox>
        {data && (
          <Table
            rows={data.filter((r) => r.kind === kind)}
            columns={[
              { label: "Name", key: "name" },
              { label: "Slug", key: "slug" },
              {
                label: "Actions",
                render: (r) => (
                  <div className="actions">
                    <button onClick={() => setEdit(r)}>Edit</button>
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            "Remove this navigation entry? Products keep their existing category/brand.",
                          )
                        ) {
                          await api("/admin/taxonomy/" + r.id, {
                            method: "DELETE",
                          });
                          reload();
                          refresh();
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>
      {edit && (
        <Modal title="Category / brand" onClose={() => setEdit(null)}>
          <SaveForm
            onSave={async () => {
              await api("/admin/taxonomy", { method: "POST", body: edit });
              setEdit(null);
              reload();
              refresh();
            }}
          >
            <Field
              label="Name"
              value={edit.name}
              required
              onChange={(e) =>
                setEdit({
                  ...edit,
                  name: e.target.value,
                  ...(!edit.id ? { slug: slug(e.target.value) } : {}),
                })
              }
            />
            <Field
              label="URL slug"
              value={edit.slug}
              required
              onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
            />
            <ImageField
              label="Collection image"
              value={edit.image}
              onChange={(v) => setEdit({ ...edit, image: v })}
            />
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
function Imports() {
  const [file, setFile] = useState(null),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (commit = false) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const f = new FormData();
      f.append("file", file);
      f.append("commit", String(commit));
      setResult(await api("/admin/import", { method: "POST", body: f }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="More bottles. Less typing."
        subtitle="Upload CSV or XLSX, review the preview, then commit the import."
      />
      <section className="admin-card">
        <h2>Import products</h2>
        <p>
          Prices in the spreadsheet are in naira. Existing SKUs are updated. New
          products start with zero stock. Update inventory separately.
        </p>
        <p>
          <a className="text-link" href="/import-template.csv" download>
            Download the CSV template <Download size={16} />
          </a>
        </p>
        <Field label="Product file (.csv or .xlsx)">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setResult(null);
            }}
          />
        </Field>
        <button
          className="button"
          disabled={!file || busy}
          onClick={() => run()}
        >
          {busy ? "Reading…" : "Preview file"}
        </button>
        <ErrorBox>{error}</ErrorBox>
        {result && (
          <>
            <h3>
              {result.committed ? "Import complete" : "Preview"} ·{" "}
              {result.total} products
            </h3>
            {result.errors.map((e, i) => (
              <ErrorBox key={i}>
                Row {e.row}: {e.message}
              </ErrorBox>
            ))}
            <Table
              rows={result.rows}
              keyField="sku"
              columns={[
                { label: "SKU", key: "sku" },
                { label: "Product", key: "name" },
                { label: "Retail", render: (r) => money(r.price) },
                { label: "Category", key: "category" },
              ]}
            />
            {!result.committed && (
              <button
                className="button"
                disabled={busy || result.errors.length > 0}
                onClick={() => run(true)}
              >
                Confirm import
              </button>
            )}
          </>
        )}
      </section>
      <section className="admin-card">
        <h2>Exports</h2>
        <div className="admin-toolbar">
          {["products", "orders", "customers", "stock"].map((t) => (
            <a
              className="button outline"
              key={t}
              href={"/api/admin/export/" + t}
            >
              {t} CSV <Download size={16} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
function Team() {
  const { data, error, reload } = useData("/admin/team");
  const [add, setAdd] = useState(false);
  return (
    <>
      <PageHeader
        title="The people behind the pour."
        subtitle="Owners manage access. Managers manage store settings. Staff process orders."
      >
        <button className="button" onClick={() => setAdd(true)}>
          Add team member <Plus size={16} />
        </button>
      </PageHeader>
      <section className="admin-card">
        <ErrorBox>{error}</ErrorBox>
        {data && (
          <Table
            rows={data}
            columns={[
              { label: "Name", key: "name" },
              { label: "Email", key: "email" },
              {
                label: "Role",
                render: (r) =>
                  r.role === "owner" ? (
                    "Owner"
                  ) : (
                    <select
                      aria-label={"Role for " + r.name}
                      value={r.role}
                      onChange={async (e) => {
                        await api("/admin/team/" + r.id, {
                          method: "POST",
                          body: { role: e.target.value },
                        });
                        reload();
                      }}
                    >
                      <option value="manager">Manager</option>
                      <option value="staff">Staff</option>
                      <option value="customer">Remove staff access</option>
                    </select>
                  ),
              },
            ]}
          />
        )}
      </section>
      {add && (
        <Modal title="Add team member" onClose={() => setAdd(false)}>
          <SaveForm
            onSave={async (e) => {
              await api("/admin/team", {
                method: "POST",
                body: Object.fromEntries(new FormData(e.currentTarget)),
              });
              setAdd(false);
              reload();
            }}
          >
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" required />
            <Field
              label="Temporary password (12+ characters)"
              name="password"
              type="password"
              minLength={12}
              required
            />
            <Field label="Role">
              <select name="role">
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
          </SaveForm>
        </Modal>
      )}
    </>
  );
}
function Audit() {
  const { data, error } = useData("/admin/audit");
  return (
    <>
      <PageHeader
        title="A clear trail."
        subtitle="Administrative changes are recorded for accountability."
      />
      <section className="admin-card">
        <ErrorBox>{error}</ErrorBox>
        {data && (
          <Table
            rows={data}
            columns={[
              { label: "When", render: (r) => date(r.created_at) },
              { label: "Who", key: "actor" },
              { label: "Action", key: "action" },
              { label: "Details", key: "detail" },
            ]}
          />
        )}
      </section>
    </>
  );
}
function Notifications() {
  const { data, error, reload } = useData("/admin/notifications");
  const { user, notify } = useStore();
  const email = useData(
    user.role === "staff" ? "/admin/notifications" : "/admin/email-status",
  );
  return (
    <>
      <PageHeader
        title="Keep things flowing."
        subtitle="Low-stock alerts and email delivery status."
      />
      <section className="admin-card">
        <ErrorBox>{error}</ErrorBox>
        {data?.map((r) => (
          <div className="notification" key={r.id}>
            <Bell size={18} />
            <div>
              <p>{r.message}</p>
              <small>{date(r.created_at)}</small>
            </div>
          </div>
        ))}
        {data?.length === 0 && <p>No alerts yet.</p>}
      </section>
      {user.role !== "staff" && (
        <section className="admin-card">
          <h2>Email delivery</h2>
          <p>
            {email.data?.configured
              ? "SMTP is configured."
              : "SMTP is not configured. Set the SMTP variables before relying on email notifications."}
          </p>
          {email.data?.queue?.map((r) => (
            <p key={r.state}>
              {r.state}: {r.count}
            </p>
          ))}
          <button
            className="button outline"
            onClick={async () => {
              const r = await api("/admin/maintenance", { method: "POST" });
              notify(
                `${r.expired} expired reservations released; ${r.mail.sent} emails sent.`,
              );
              reload();
              email.reload();
            }}
          >
            Run maintenance & retry emails
          </button>
        </section>
      )}
    </>
  );
}

function SystemStatus(){
 const {data,error,reload}=useData('/admin/system');
 return <><PageHeader title="Store configuration" subtitle="Private checks for the database and connected services."><button className="button outline" onClick={reload}>Refresh checks</button></PageHeader><ErrorBox>{error}</ErrorBox>{data&&<section className="admin-card"><h2>Services</h2><dl className="system-status">{Object.entries(data).filter(([key])=>key!=='recentErrors').map(([key,value])=><React.Fragment key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{typeof value==='boolean'?(value?'Ready':'Not configured'):String(value)}</dd></React.Fragment>)}</dl><p className="help">Configured means environment values are present. Run a real payment, email and upload test to verify each provider.</p><h3>Recent errors on this server instance</h3>{data.recentErrors?.length?<Table rows={data.recentErrors} columns={[{label:'Reference',key:'id'},{label:'Code',key:'code'},{label:'Path',key:'path'},{label:'When',key:'time'}]}/>:<p>No recent errors on this instance.</p>}</section>}</>;
}
