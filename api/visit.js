export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const fwd = req.headers["x-forwarded-for"] || "";
  const ip =
    (Array.isArray(fwd) ? fwd[0] : String(fwd)).split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "";

  const safeDecode = (val) => {
    if (!val) return "";
    try {
      return decodeURIComponent(String(val));
    } catch {
      return String(val);
    }
  };

  const info = {
    ip: ip || "Unknown",
    city: safeDecode(req.headers["x-vercel-ip-city"]) || "",
    region: safeDecode(req.headers["x-vercel-ip-country-region"]) || "",
    country: safeDecode(req.headers["x-vercel-ip-country"]) || "",
    timezone: safeDecode(req.headers["x-vercel-ip-timezone"]) || "",
    isp: "",
    org: "",
    connClass: "Unknown"
  };

  if (ip && ip !== "::1" && ip !== "127.0.0.1") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const geoResp = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,org,mobile,proxy,hosting`,
        { signal: controller.signal }
      );
      if (geoResp.ok) {
        const geo = await geoResp.json();
        if (geo && geo.status === "success") {
          info.city = geo.city || info.city;
          info.region = geo.regionName || info.region;
          info.country = geo.country || info.country;
          info.isp = geo.isp || "";
          info.org = geo.org || "";

          if (geo.proxy || geo.hosting) info.connClass = "VPN / Proxy / Cloud";
          else if (geo.mobile) info.connClass = "Mobile Data / Hotspot";
          else info.connClass = "Broadband / Office Wi-Fi";
        }
      }
    } catch (_) {
      // Fall back to Vercel headers silently
    } finally {
      clearTimeout(timer);
    }
  }

  return res.status(200).json(info);
}
