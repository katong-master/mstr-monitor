// api/get-summary.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { data } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    // 將模型名稱改為具體的版本號 gemini-1.5-flash-001 或 gemini-1.5-flash-latest
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `你是一位加密貨幣分析師。請針對以下 Strategy (MSTR) 的最新數據提供簡短評估：${data}` 
                    }]
                }]
            })
        });

        const json = await response.json();

        if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            return res.status(200).json({ summary: json.candidates[0].content.parts[0].text });
        } else {
            // 如果還是失敗，我們會把 Google 給出的完整錯誤傳回前端，請看網頁顯示什麼
            return res.status(200).json({ summary: `AI 回應異常: ${json.error?.message || "無法解析回應"}` });
        }
    } catch (err) {
        return res.status(500).json({ error: '連線失敗' });
    }
}
