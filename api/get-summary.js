export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { data } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  console.log("收到的數據數據:", data);
  console.log("API Key 是否存在:", !!API_KEY);

  if (!API_KEY) {
    return res.status(500).json({ summary: "部署錯誤：找不到 GEMINI_API_KEY 環境變數。" });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `請分析以下數據：${data}` }] }]
      })
    });

    const json = await response.json();

    // 如果 Google 回傳錯誤，這行會在 Vercel Logs 顯示原因
    if (json.error) {
      console.error("Gemini API 回傳錯誤原始碼:", JSON.stringify(json.error));
      return res.status(200).json({ summary: `AI 服務拒絕請求：${json.error.message}` });
    }

    if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ summary: json.candidates[0].content.parts[0].text });
    } else {
      console.error("Gemini 回傳格式異常:", JSON.stringify(json));
      return res.status(200).json({ summary: "AI 回傳格式不正確，請檢查日誌。" });
    }

  } catch (err) {
    console.error("伺服器端崩潰:", err.message);
    return res.status(500).json({ error: "伺服器內部錯誤: " + err.message });
  }
}
