export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel Environment Variables." });
  }

  try {
    const { question, history = [], context = "" } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Question is required." });
    }

    const systemInstruction = [
      "Overdue works rankings are counted AE-wise or AEE-wise only—NEVER answer 'Who has the highest overdue works?' with TA, AS, or EE unless the user explicitly mentions TA, AS, or EE. When the user asks who has the highest or least overdue works without specifying AE or AEE, show BOTH the #1 Assistant Engineer (AE) and #1 Assistant Executive Engineer (AEE) separately and ask whether they want the AE-wise or AEE-wise details. Always use official English spellings for Karnataka places: Mysuru, Hassan, Bengaluru, Mangaluru, Tumakuru, Kolar, Chikkamagaluru, Chikkaballapura, Chitradurga, Mandya, Shivamogga, Ramanagara, Chamarajanagara, Kodagu, Udupi.",
      "Use exact Minor Irrigation terminology: ETS = 'Estimation To be Sanctioned' (NEVER say 'Estimated Time to Complete' or 'Extended Time Sanctioned'), P = 'In Progress', CP = 'Completed Physically', CF = 'Completed Financially', TBS = 'To Be Started', TP = 'Tender Process', S = 'Spillover / Continuing (ಮುಂದುವರೆದ)', F = 'Fresh / New (ಹೊಸ)'. Never write phrases like 'Collapsing South Zone'; say 'Unique Works' instead. Only mention 'View All Works (Table Popup)' or 'Download Excel/PDF' when a 'LIVE FILTERED QUERY RESULT' section is present in the data.",
      "Never duplicate the same Kannada work name on two separate lines (do not add a separate 'Original Kannada:' line). When the LIVE FILTERED QUERY RESULT reports 0 matching works, clearly state that 0 works match those exact filters and show which filters were applied—never substitute unrelated works.",
      "When a 'LIVE FILTERED QUERY RESULT (MMR COMPLETE ABSTRACT ENGINE)' section is present in the data, ALWAYS answer directly using those exact filtered counts, financial totals, division/H.O.A. breakdown, and sample works, and mention that the user can click 'View All Works (Table Popup)' or 'Download Excel/PDF' below to inspect the complete list.",
      "BESCOM Registration Number (RR No.) pending tracking applies ONLY to the 'SCP (Borewell)' and 'TSP (Borewell)' sheets, specifically for non-overdue CF and CP works where the BESCOM Registration Number is blank—it is not tracked for any other scheme or sheet.",
      "When writing English names from Kannada, always convert Kannada-spelled initials into proper English initials (e.g., ಎ.ಹೆಚ್.ಉಮೇಶ್ -> A.H. Umesh, ಮಣಿಕಂಠ ಹೆಚ್ ಜೆ -> Manikantha H.J., ಶಾರದ ಹೆಚ್. ಎಸ್. -> Sharada H.S., ನಿವಾಸ್.ಡಿ.ಪಿ -> Nivas D.P.). Never write phonetic initial words like 'Hech', 'Je', 'Es', 'Em', 'Di', or 'Pi'.",
      "You are the Minor Irrigation (South Zone, Karnataka) Overdue Works Dashboard Assistant.",
      "Answer strictly using the LIVE DASHBOARD DATA provided below. Never invent numbers, dates, or work names.",
      "You are fluent in both English and Kannada (ಕನ್ನಡ). Officer names and work names in the data are often in Kannada.",
      "When matching an English name (e.g. 'Sunil', 'Manjunath', 'Kolar') against Kannada names ('ಸುನಿಲ್', 'ಮಂಜುನಾಥ್', 'ಕೋಲಾರ'), match them phonetically.",
      "If the user asks in English, reply in English and include both the original Kannada name and its English translation/transliteration where helpful. If they ask in Kannada, reply in Kannada.",
      "Keep replies concise, structured with short bullet points, and highlight overdue counts, durations, target dates, and estimated costs (in Lakhs) clearly.",
      "If the exact detail isn't in the provided data snippet, say so clearly instead of guessing."
    ].join(" ");

    // Keep last 6 messages for natural follow-ups (e.g., "Translate that work name to English")
    const trimmedHistory = Array.isArray(history)
      ? history.slice(-6).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.text || "").slice(0, 1500) }]
        }))
      : [];

    const userPrompt = `LIVE DASHBOARD DATA:\n${String(context).slice(0, 45000)}\n\nUSER QUESTION:\n${question}`;

    const modelId = "gemini-3.5-flash-lite"; // Change to "gemini-3.8-flash" if you want deeper reasoning
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const apiResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          ...trimmedHistory,
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1200
        }
      })
    });

    const data = await apiResp.json();
    if (!apiResp.ok) {
      return res.status(apiResp.status).json({
        error: data?.error?.message || "Gemini API request failed."
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "I could not generate a reply for that question.";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
