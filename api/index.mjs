import { getApp } from "../server/runtime.mjs";
export default async function handler(req, res) {
  try {
    const params = new URL(req.url, "https://local.invalid").searchParams;
    for (const [key, value] of Object.entries(req.query || {}))
      if (!params.has(key)) params.set(key, String(value));
    const apiPath = params.get("api_path"),
      renderPath = params.get("render_path");
    params.delete("api_path");
    params.delete("render_path");
    if (renderPath)
      req.url = "/api/render?path=" + encodeURIComponent(renderPath);
    else if (apiPath)
      req.url = apiPath + (params.size ? "?" + params.toString() : "");
    return (await getApp())(req, res);
  } catch {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error:
          "Store setup is incomplete. Check database and environment configuration.",
      }),
    );
  }
}
