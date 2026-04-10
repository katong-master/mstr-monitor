// api/get-summary.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const API_KEY = process.env.GEMINI_API_KEY; 
    const { data } = req.body;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `你是一位加密貨幣分析師。請根據以下數據提供 80 字以內的簡短市場評論：${data}` }]
                }]
            })
        });

        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        res.status(200).json({ summary: text });
    } catch (error) {
        res.status(500).json({ error: 'AI 連線失敗' });
    }
}