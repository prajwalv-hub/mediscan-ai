const http = require('http');
const fs = require('fs');
const path = require('path');

// Read API key from .env file
const envPath = path.join(__dirname, '.env');
let API_KEY = '';
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);
    if (match) API_KEY = match[1].trim();
}

if (!API_KEY) {
    console.error('❌ No API key found! Add GEMINI_API_KEY=your_key to .env file');
    process.exit(1);
}

const PORT = 3000;
const DIR = __dirname;
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

// Helper: delay for rate limit retries
const delay = ms => new Promise(r => setTimeout(r, ms));

const server = http.createServer(async (req, res) => {
    // API Proxy endpoint
    if (req.url === '/api/gemini' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const requestBody = JSON.parse(body);
                let lastError = null;

                for (const model of MODELS) {
                    try {
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
                        console.log(`🤖 Trying model: ${model}`);
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });

                        if (response.ok) {
                            const data = await response.json();
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            console.log(`✅ Success with ${model} (${text.length} chars)`);

                            // Pre-parse JSON on server side for reliability
                            let parsed = null;
                            try {
                                let clean = text.trim();
                                // Remove thinking tags
                                clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                                // Remove markdown code blocks
                                clean = clean.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
                                // Remove "json" prefix
                                clean = clean.replace(/^json\s*/i, '').trim();
                                // Find JSON boundaries
                                const first = clean.indexOf('{');
                                const last = clean.lastIndexOf('}');
                                if (first !== -1 && last > first) {
                                    let jsonStr = clean.substring(first, last + 1);
                                    
                                    // Strategy 1: Direct parse
                                    try {
                                        parsed = JSON.parse(jsonStr);
                                    } catch {
                                        // Strategy 2: Fix newlines and whitespace
                                        let fixed = jsonStr.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
                                        fixed = fixed.replace(/,\s*([}\]])/g, '$1');
                                        try {
                                            parsed = JSON.parse(fixed);
                                        } catch {
                                            // Strategy 3: Fix control characters inside string values
                                            let fixed2 = jsonStr;
                                            // Replace literal control characters
                                            fixed2 = fixed2.replace(/[\x00-\x1F\x7F]/g, (ch) => {
                                                if (ch === '\n' || ch === '\r' || ch === '\t') return ' ';
                                                return '';
                                            });
                                            fixed2 = fixed2.replace(/\s+/g, ' ');
                                            fixed2 = fixed2.replace(/,\s*([}\]])/g, '$1');
                                            // Fix unescaped backslashes
                                            fixed2 = fixed2.replace(/\\(?!["\\/bfnrt])/g, '\\\\');
                                            try {
                                                parsed = JSON.parse(fixed2);
                                            } catch (e3) {
                                                console.log(`⚠️ All parse strategies failed: ${e3.message}`);
                                            }
                                        }
                                    }
                                    if (parsed) {
                                        console.log(`📦 JSON parsed on server (keys: ${Object.keys(parsed).join(', ')})`);
                                    }
                                }
                            } catch (parseErr) {
                                console.log(`⚠️ Server JSON parse error: ${parseErr.message}`);
                            }

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, text, parsed, model }));
                            return;
                        }

                        const errData = await response.json().catch(() => ({}));
                        lastError = errData.error?.message || `HTTP ${response.status}`;
                        console.log(`⚠️ ${model}: ${lastError}`);

                        if (response.status === 401 || response.status === 403) {
                            res.writeHead(401, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Invalid API key. Get a new one at https://aistudio.google.com/apikey' }));
                            return;
                        }

                        // Rate limited (429) — wait and try next model
                        if (response.status === 429) {
                            console.log(`⏳ Rate limited on ${model}, waiting 2s then trying next...`);
                            await delay(2000);
                        }

                        continue;
                    } catch (e) {
                        lastError = e.message;
                        console.log(`❌ ${model} error: ${e.message}`);
                        continue;
                    }
                }

                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: lastError || 'All models failed' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request: ' + e.message }));
            }
        });
        return;
    }

    // MAP TILE PROXY — fetches tiles server-side to avoid browser blocking
    if (req.url.startsWith('/tiles/')) {
        const tilePath = req.url.replace('/tiles/', '');
        const tileUrl = `https://a.tile.openstreetmap.org/${tilePath}`;
        try {
            const tileRes = await fetch(tileUrl);
            if (tileRes.ok) {
                const buffer = Buffer.from(await tileRes.arrayBuffer());
                res.writeHead(200, { 
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=86400'
                });
                res.end(buffer);
            } else {
                res.writeHead(404);
                res.end('Tile not found');
            }
        } catch (e) {
            res.writeHead(500);
            res.end('Tile fetch error');
        }
        return;
    }

    // TTS PROXY — Google Translate TTS through server for ALL Indian languages
    // Supports: en, hi, kn, te, ta, mr (and more)
    if (req.url.startsWith('/tts?')) {
        const params = new URL('http://localhost' + req.url).searchParams;
        const ttsLang = params.get('lang') || 'en';
        const ttsText = params.get('q') || '';

        if (!ttsText) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No text provided' }));
            return;
        }

        console.log(`🔊 TTS: lang=${ttsLang}, text="${ttsText.substring(0, 50)}..."`);

        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(ttsText)}`;
        try {
            const ttsRes = await fetch(ttsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://translate.google.com/'
                }
            });
            if (ttsRes.ok) {
                const buffer = Buffer.from(await ttsRes.arrayBuffer());
                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(buffer);
            } else {
                console.error(`TTS error: HTTP ${ttsRes.status}`);
                res.writeHead(ttsRes.status);
                res.end('TTS error: ' + ttsRes.status);
            }
        } catch (e) {
            console.error('TTS fetch error:', e.message);
            res.writeHead(500);
            res.end('TTS fetch error: ' + e.message);
        }
        return;
    }

    // Static file serving
    let filePath = path.join(DIR, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 
            'Content-Type': MIME[ext] || 'text/plain',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  🏥 MediScan AI running at: http://localhost:${PORT}`);
    console.log(`  ✅ API Key loaded from .env (hidden from GitHub)`);
    console.log(`  🔒 Key is server-side only — never sent to browser\n`);
});
