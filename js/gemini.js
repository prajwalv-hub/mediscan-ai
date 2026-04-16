// ================================================
// MediScan AI — Gemini API (dual mode: backend or direct)
// ================================================

const GeminiAPI = {

    // Stores server-side pre-parsed JSON
    _serverParsed: null,

    // Smart API call — uses backend on localhost, direct API on file://
    async callAPI(body) {
        this._serverParsed = null; // Reset before each call
        if (CONFIG.isDeployed) {
            return await this.callBackend(body);
        } else {
            return await this.callDirect(body);
        }
    },

    // Call Node.js backend (API key on server, JSON pre-parsed)
    async callBackend(body) {
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) {
            let errMsg = data.error || data.details || 'API failed';
            if (errMsg.includes('quota') || errMsg.includes('rate') || errMsg.includes('exceeded') || response.status === 429) {
                showToast('⏳ AI is busy — please wait 30 seconds and try again', 'warning');
                throw new Error('Rate limit reached. Please wait ~30 seconds and try again.');
            }
            if (errMsg.includes('expired') || errMsg.includes('invalid') || errMsg.includes('Invalid')) {
                showToast('🔑 API key expired! Get a new one at aistudio.google.com/apikey', 'error');
                throw new Error('API key expired. Get a new one at https://aistudio.google.com/apikey');
            }
            throw new Error(errMsg);
        }

        // Server pre-parses JSON — use it directly
        if (data.parsed) {
            this._serverParsed = data.parsed;
        }

        return data.text || 'No response';
    },

    // Call Gemini directly (for local file:// testing)
    async callDirect(body) {
        if (!CONFIG.API_KEY) {
            showToast('Please set your API key first', 'error');
            throw new Error('No API key. Enter it in the modal.');
        }

        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
        let lastError = null;

        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.API_KEY}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('✅ Using:', model);
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
                }

                const err = await response.json().catch(() => ({}));
                lastError = err.error?.message || 'Error';
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Invalid API key');
                }
                continue;
            } catch (e) {
                if (e.message.includes('Invalid API key')) throw e;
                lastError = e.message;
                continue;
            }
        }
        throw new Error(lastError || 'All models failed');
    },

    // Send text-only request
    async sendText(prompt) {
        return await this.callAPI({
            contents: [{ parts: [{ text: CONFIG.getSystemPrompt() + '\n\n' + prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        });
    },

    // Send image + text request
    async sendImageAndText(base64Image, mimeType, prompt) {
        return await this.callAPI({
            contents: [{
                parts: [
                    { text: CONFIG.getSystemPrompt() + '\n\n' + prompt },
                    { inline_data: { mime_type: mimeType, data: base64Image } }
                ]
            }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
        });
    },

    // Send image + text request with forced JSON output (for report analysis)
    async sendImageForJSON(base64Image, mimeType, prompt) {
        return await this.callAPI({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Image } }
                ]
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 8000,
                responseMimeType: 'application/json'
            }
        });
    },

    // Send chat with history
    async sendChat(messages) {
        const contents = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        if (contents.length > 0 && contents[0].role !== 'user') {
            contents.unshift({ role: 'user', parts: [{ text: CONFIG.getSystemPrompt() }] });
            contents.splice(1, 0, { role: 'model', parts: [{ text: 'I am MediScan AI, ready to help.' }] });
        }

        return await this.callAPI({
            contents: contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
        });
    },

    // Parse JSON — uses server-parsed data first, then client-side fallback
    parseJSON(text) {
        // Priority 1: Server already parsed it (most reliable)
        if (this._serverParsed) {
            console.log('✅ Using server-parsed JSON');
            const result = this._serverParsed;
            this._serverParsed = null; // Clear after use
            return result;
        }

        // Priority 2: Client-side parsing
        if (!text) return null;

        try {
            // Clean the response
            let clean = text.trim();
            clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            clean = clean.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
            clean = clean.replace(/^json\s*/i, '').trim();

            // Find JSON boundaries
            const first = clean.indexOf('{');
            const last = clean.lastIndexOf('}');
            if (first === -1 || last <= first) return null;

            // Extract and fix JSON string
            let jsonStr = clean.substring(first, last + 1);
            jsonStr = jsonStr.replace(/\r?\n/g, ' ');  // Fix newlines in strings
            jsonStr = jsonStr.replace(/\s+/g, ' ');     // Collapse whitespace
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1'); // Fix trailing commas

            return JSON.parse(jsonStr);
        } catch (e) {
            console.warn('Client JSON parse failed:', e.message);
            return null;
        }
    }
};
