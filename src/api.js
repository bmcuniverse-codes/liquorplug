let csrf = "";
export function setCsrf(t) {
  csrf = t;
}
export async function api(path, options = {}) {
  const { body, orderToken, ...rest } = options;
  const headers = { ...options.headers };
  if (options.method && options.method !== "GET")
    headers["x-csrf-token"] = csrf;
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (orderToken) headers["x-order-token"] = orderToken;
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    ...rest,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  let d;
  try {
    d = await r.json();
  } catch {
    throw Error("The server returned an unexpected response.");
  }
  if (!r.ok) throw Error((d.error || "Request failed")+(d.reference?` (Reference: ${d.reference})`:''));
  return d;
}
export const money = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(n || 0) / 100);
export const date = (n) =>
  new Date(Number(n)).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
