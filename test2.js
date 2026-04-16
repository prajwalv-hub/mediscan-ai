const API_KEY = process.argv[2];
async function test() {
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-flash-latest'];
    for (const m of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${API_KEY}`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Say hello in one word' }] }],
                    generationConfig: { maxOutputTokens: 10 }
                })
            });
            const data = await res.json();
            if (res.ok) {
                const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';
                console.log(`✅ WORKS: ${m} → "${reply.trim()}"`);
            } else {
                console.log(`❌ FAIL:  ${m} → ${data.error?.message?.substring(0, 80)}`);
            }
        } catch (e) {
            console.log(`❌ ERROR: ${m} → ${e.message}`);
        }
    }
}
test();
