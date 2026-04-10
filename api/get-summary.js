// api/get-summary.js
export default async function handler(req, res) {
    const { indicatorData } = req.body; // 接收前端傳來的數據
    const API_KEY = process.env.GEMINI_API_KEY; // 從環境變數讀取 Key

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `你是一位資深金融分析師。請根據以下 MSTR 的 mNAV 數據提供 100 字以內的專業簡評與趨勢分析：${indicatorData}` }]
            }]
        })
    });

    const data = await response.json();
    const summary = data.candidates[0].content.parts[0].text;
    
    res.status(200).json({ summary });
}
