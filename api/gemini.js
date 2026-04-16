// Vercel Serverless Function: /api/gemini
// This replaces the /api/gemini route from server.js

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
const delay = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured in Vercel environment variables' });
    }

    try {
        const requestBody = req.body;
        let lastError = null;

        for (const model of MODELS) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    const data = await response.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                    // Pre-parse JSON on server side for reliability
                    let parsed = null;
                    try {
                        let clean = text.trim();
                        clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                        clean = clean.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
                        clean = clean.replace(/^json\s*/i, '').trim();
                        const first = clean.indexOf('{');
                        const last = clean.lastIndexOf('}');
                        if (first !== -1 && last > first) {
                            let jsonStr = clean.substring(first, last + 1);
                            try {
                                parsed = JSON.parse(jsonStr);
                            } catch {
                                let fixed = jsonStr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
                                fixed = fixed.replace(/,\s*([}\]])/g, '$1');
                                try {
                                    parsed = JSON.parse(fixed);
                                } catch {
                                    let fixed2 = jsonStr;
                                    fixed2 = fixed2.replace(/[\x00-\x1F\x7F]/g, (ch) => {
                                        if (ch === '\n' || ch === '\r' || ch === '\t') return ' ';
                                        return '';
                                    });
                                    fixed2 = fixed2.replace(/\s+/g, ' ');
                                    fixed2 = fixed2.replace(/,\s*([}\]])/g, '$1');
                                    fixed2 = fixed2.replace(/\\(?!["\\\/bfnrt])/g, '\\\\');
                                    try { parsed = JSON.parse(fixed2); } catch {}
                                }
                            }
                        }
                    } catch {}

                    return res.status(200).json({ success: true, text, parsed, model });
                }

                const errData = await response.json().catch(() => ({}));
                lastError = errData.error?.message || `HTTP ${response.status}`;

                if (response.status === 401 || response.status === 403) {
                    return res.status(401).json({ error: 'Invalid API key' });
                }

                if (response.status === 429) {
                    await delay(2000);
                }

                continue;
            } catch (e) {
                lastError = e.message;
                continue;
            }
        }

        return res.status(500).json({ error: lastError || 'All models failed' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
