export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const API_KEY = process.env.GEMINI_API_KEY;
  const { data } = req.body;

  if (!API_KEY) {
    return res.status(200).json({ summary: "❌ [伺服器錯誤]：找不到 GEMINI_API_KEY 環境變數。" });
  }

  try {
    // 【終極修正】：使用 v1beta 與 gemini-1.5-flash-latest
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ 
            text: `你是一位分析 Strategy (MSTR) 的專業財經分析師。請根據以下數據，寫一段 80 字以內的精闢短評（包含對 BTC NAV 的看法）：${data}` 
          }]
        }]
      })
    });

    const json = await response.json();

    // 如果 Google API 回傳錯誤
    if (json.error) {
      console.error("Google API Error:", json.error.message);
      return res.status(200).json({ summary: `❌ [Google API 錯誤]：${json.error.message}` });
    }

    // 解析回傳的文字
    if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ summary: json.candidates[0].content.parts[0].text });
    } else {
      return res.status(200).json({ summary: "⚠️ AI 雖然有回應，但沒有產出有效文字，請再試一次。" });
    }

  } catch (err) {
    return res.status(200).json({ summary: `🔥 [系統崩潰]：${err.message}` });
  }
}
