export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.GEMINI_API_KEY;
    const { data } = req.body;

    if (!API_KEY) {
        return res.status(200).json({ summary: "❌ [伺服器錯誤]：找不到環境變數 GEMINI_API_KEY。" });
    }

    try {
        // 使用目前最標準的 v1beta 搭配 gemini-1.5-flash 字串
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `你是一位分析 Strategy (MSTR) 的財經分析師。請根據以下數據寫一段 80 字內的短評：${data}` 
                    }]
                }]
            })
        });

        const json = await response.json();

        // 捕捉 Google 的錯誤
        if (json.error) {
            // 如果這行報錯，通常與 API Key 的權限或地區有關
            return res.status(200).json({ summary: `❌ [Google API 錯誤]：${json.error.message}` });
        }

        if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            return res.status(200).json({ summary: json.candidates[0].content.parts[0].text });
        } else {
            return res.status(200).json({ summary: "⚠️ AI 回傳格式不正確，可能是內容遭安全過濾。" });
        }

    } catch (err) {
        return res.status(200).json({ summary: `🔥 系統崩潰：${err.message}` });
    }
}
