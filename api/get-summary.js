export default async function handler(req, res) {
  // 只允許 POST 請求
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { data } = req.body; // 接收來自 HTML fetchAI 傳來的數據字串
  const API_KEY = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ 
            // 這裡的 Prompt 稍微優化，讓 AI 針對數據中的「變化率」進行分析
            text: `你是一位專業的加密貨幣與財經分析師。
            我將提供 Strategy (MSTR) 的最新國庫數據。
            請根據這些數據，提供一段 100 字以內的專業簡評，
            包含對目前「每股淨資產 (NAV)」的解讀，以及對 30 天變動趨勢的看法。
            
            數據內容：
            ${data}` 
          }]
        }]
      })
    });

    const json = await response.json();
    
    // 檢查 Gemini API 是否回傳錯誤
    if (json.error) {
      return res.status(500).json({ summary: "AI 服務目前無法回應，請檢查 API Key 設定。" });
    }

    const aiText = json.candidates[0].content.parts[0].text;
    return res.status(200).json({ summary: aiText });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
}