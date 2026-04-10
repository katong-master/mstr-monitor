// api/get-summary.js 修正版
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const API_KEY = process.env.GEMINI_API_KEY;
    const { data } = req.body;

    if (!API_KEY) {
        return res.status(200).json({ summary: "❌ [伺服器錯誤]：找不到 GEMINI_API_KEY。" });
    }

    try {
        // 【關鍵修改】：將 v1beta 改為 v1，並使用 gemini-1.5-flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `你是一位分析 Strategy (MSTR) 的分析師。請根據以下數據寫一段 80 字以內的專業短評：${data}` 
                    }]
                }]
            })
        });

        const json = await response.json();

        // 捕捉 Google 的錯誤訊息
        if (json.error) {
            return res.status(200).json({ summary: `❌ [Google API 錯誤]：${json.error.message}` });
        }

        if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            return res.status(200).json({ summary: json.candidates[0].content.parts[0].text });
        } else {
            return res.status(200).json({ summary: "⚠️ [回傳異常]：AI 已回應但無內容，請稍後再試。" });
        }

    } catch (err) {
        return res.status(200).json({ summary: `🔥 [系統崩潰]：${err.message}` });
    }
}
