export default async function handler(req, res) {
  // Handle CORS preflight requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const defaultUrl =
    "https://docs.google.com/spreadsheets/d/13W04z-fdU3RhuVJ5vQFRpK4BBSQRJWfscPqpr7Oj2Y8/edit?usp=sharing";
  const rawUrl = (req.query && req.query.url) ? String(req.query.url).trim() : defaultUrl;

  // Extract the Google Spreadsheet ID
  const match = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match || !match[1]) {
    return res.status(400).json({ error: "Invalid Google Spreadsheet URL." });
  }

  const sheetId = match[1];
  const exportUrls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&t=${Date.now()}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}&t=${Date.now()}`
  ];

  let lastError = "Unknown download error";

  for (let attempt = 0; attempt < exportUrls.length; attempt++) {
    try {
      const response = await fetch(exportUrls[attempt], {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Accept":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*"
        },
        redirect: "follow",
        cache: "no-store"
      });

      if (!response.ok) {
        lastError = `Google Sheets returned HTTP ${response.status}`;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Verify we received a valid workbook and not an empty/error response
      if (buffer.length < 1000) {
        lastError = "Downloaded file is too small or empty.";
        continue;
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      res.setHeader("Content-Length", buffer.length);

      return res.status(200).send(buffer);
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  return res.status(502).json({
    error: `Failed to fetch workbook from Google Sheets: ${lastError}`
  });
}
