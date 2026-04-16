// Quick test to find which Gemini model works
// Run: node test-models.js YOUR_API_KEY_HERE

const API_KEY = process.argv[2];
if (!API_KEY) {
    console.log('Usage: node test-models.js YOUR_API_KEY');
    process.exit(1);
}

const models = [
    { v: 'v1beta', m: 'gemini-2.0-flash-lite' },
    { v: 'v1beta', m: 'gemini-2.0-flash' },
    { v: 'v1', m: 'gemini-2.0-flash' },
    { v: 'v1', m: 'gemini-2.0-flash-lite' },
    { v: 'v1', m: 'gemini-1.5-flash' },
    { v: 'v1beta', m: 'gemini-1.5-flash' },
    { v: 'v1', m: 'gemini-pro' },
    { v: 'v1beta', m: 'gemini-pro' },
];

async function test() {
    console.log('Testing models with your API key...\n');
    
    // First list available models
    try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const listData = await listRes.json();
        if (listData.models) {
            const genModels = listData.models.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
            console.log(`Found ${genModels.length} models that support generateContent:`);
            genModels.forEach(m => console.log(`  ✅ ${m.name}`));
            console.log('');
        } else {
            console.log('Error listing models:', listData.error?.message);
        }
    } catch (e) {
        console.log('Could not list models:', e.message);
    }

    // Test each
    for (const entry of models) {
        const url = `https://generativelanguage.googleapis.com/${entry.v}/models/${entry.m}:generateContent?key=${API_KEY}`;
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
                console.log(`✅ WORKS: ${entry.v}/${entry.m} → "${reply.trim()}"`);
            } else {
                console.log(`❌ FAIL:  ${entry.v}/${entry.m} → ${data.error?.message?.substring(0, 80)}`);
            }
        } catch (e) {
            console.log(`❌ ERROR: ${entry.v}/${entry.m} → ${e.message}`);
        }
    }
}

test();
