// ================================================
// MediScan AI — Gemini API Integration
// ================================================

const GeminiAPI = {
    // Send text-only request
    async sendText(prompt) {
        if (!CONFIG.API_KEY) {
            showToast('Please set your Gemini API key first', 'error');
            throw new Error('No API key');
        }

        const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: CONFIG.getSystemPrompt() + '\n\n' + prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';
    },

    // Send image + text request
    async sendImageAndText(base64Image, mimeType, prompt) {
        if (!CONFIG.API_KEY) {
            showToast('Please set your Gemini API key first', 'error');
            throw new Error('No API key');
        }

        const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: CONFIG.getSystemPrompt() + '\n\n' + prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 3000,
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';
    },

    // Send chat message with history
    async sendChat(messages) {
        if (!CONFIG.API_KEY) {
            showToast('Please set your Gemini API key first', 'error');
            throw new Error('No API key');
        }

        const contents = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Prepend system message
        if (contents.length > 0 && contents[0].role !== 'user') {
            contents.unshift({
                role: 'user',
                parts: [{ text: CONFIG.getSystemPrompt() }]
            });
            contents.splice(1, 0, {
                role: 'model',
                parts: [{ text: 'I understand. I am MediScan AI, ready to help with medical queries. How can I assist you?' }]
            });
        }

        const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${CONFIG.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1500,
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received';
    },

    // Parse JSON from Gemini response (handles markdown code blocks)
    parseJSON(text) {
        try {
            // Try direct parse first
            return JSON.parse(text);
        } catch {
            // Try extracting JSON from markdown code block
            const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[1]);
                } catch {
                    // Fall through
                }
            }
            // Try finding JSON object in text
            const objMatch = text.match(/\{[\s\S]*\}/);
            if (objMatch) {
                try {
                    return JSON.parse(objMatch[0]);
                } catch {
                    // Fall through
                }
            }
            return null;
        }
    }
};
