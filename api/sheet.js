export default async function handler(req, res) {
  const sheetUrl =
    req.query.url ||
    process.env.SHEET_URL ||
    "https://docs.google.com/spreadsheets/d/13W04z-fdU3RhuVJ5vQFRpK4BBSQRJWfscPqpr7Oj2Y8/edit?gid=270221191#gid=270221191";

  const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    return res.status(400).json({ error: "Invalid Google Spreadsheet URL" });
  }

  const key = match[1];
  const exportUrl = `https://docs.google.com/spreadsheets/d/${key}/export?format=xlsx&t=${Date.now()}`;

  try {
    const response = await fetch(exportUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
