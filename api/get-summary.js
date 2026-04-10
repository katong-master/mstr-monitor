// api/get-summary.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    const { data } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    // 這裡完全採用你原本成功的 URL 格式
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `你是一位加密貨幣國庫分析師。我將提供 Strategy (MSTR) 的最新數據，請針對該公司的 BTC NAV per Share 提供一句話的現況描述，以及一句話的投資趨勢建議。數據如下：${data}` 
                    }]
                }]
            })
        });

        const json = await response.json();

        // 增加一點防禦性檢查，避免 API 回傳錯誤時崩潰
        if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            const aiText = json.candidates[0].content.parts[0].text;
            return res.status(200).json({ summary: aiText });
        } else {
            // 如果 API 報錯，回傳具體的 Google 錯誤訊息方便偵錯
            return res.status(200).json({ summary: `AI 回應異常: ${json.error?.message || "未知錯誤"}` });
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'AI 服務暫時無法連線' });
    }
}
