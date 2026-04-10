export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.GEMINI_API_KEY;
    const { data } = req.body;

    if (!API_KEY) {
        return res.status(200).json({ summary: "❌ [系統錯誤]：未設定 GEMINI_API_KEY。" });
    }

    try {
        // 使用 v1 正式版網址，這是 2026 年最穩定的路徑
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `你是一位分析 Strategy (MSTR) 的財經專家。請根據數據寫一段 80 字內的分析：${data}` 
                    }]
                }]
            })
        });

        const json = await response.json();

        // 核心錯誤排查邏輯
        if (json.error) {
            // 如果還是報 not found，代表你的 API Key 權限有問題
            let errorMsg = json.error.message;
            if (errorMsg.includes("not found")) {
                errorMsg = "Google 找不到此模型。這通常是因為：\n1. API Key 地區受限 (香港/內地暫不支援)\n2. 該 Key 未在 Google AI Studio 啟用 Gemini API";
            }
            return res.status(200).json({ summary: `❌ [API 錯誤]：${errorMsg}` });
        }

        if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            return res.status(200).json({ summary: json.candidates[0].content.parts[0].text });
        } else {
            return res.status(200).json({ summary: "⚠️ AI 已回應但無內容，請確認數據是否包含敏感資訊。" });
        }

    } catch (err) {
        return res.status(200).json({ summary: `🔥 [系統崩潰]：${err.message}` });
    }
}
