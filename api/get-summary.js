// api/get-summary.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { data } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    // 將模型名稱改為具體的版本號 gemini-1.5-flash-001 或 gemini-1.5-flash-latest
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

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

        // --- 防撞檢查開始 ---
        
        // 1. 檢查 Google 是否回傳了錯誤物件
        if (json.error) {
            console.error("Google API Error:", json.error);
            return res.status(200).json({ summary: `❌ [API 錯誤]：${json.error.message}` });
        }

        // 2. 安全地讀取 candidates[0]
        if (json.candidates && json.candidates.length > 0 && json.candidates[0].content) {
            const aiText = json.candidates[0].content.parts[0].text;
            return res.status(200).json({ summary: aiText });
        } else {
            // 如果走到這裡，代表回應格式不是我們預期的
            console.log("Unexpected JSON structure:", json);
            return res.status(200).json({ summary: "⚠️ AI 回傳格式異常，可能是該模型不支援此類請求。" });
        }

    } catch (err) {
        console.error("Runtime Error:", err);
        return res.status(200).json({ summary: `🔥 系統崩潰：${err.message}` });
    }
}
