// ================================================
// MediScan AI — Configuration
// ================================================

const CONFIG = {
    // Gemini API
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    API_KEY: localStorage.getItem('mediscan_api_key') || '',

    // Language settings
    LANGUAGES: {
        en: { name: 'English', speechCode: 'en-US', label: 'English' },
        hi: { name: 'Hindi', speechCode: 'hi-IN', label: 'हिन्दी' },
        te: { name: 'Telugu', speechCode: 'te-IN', label: 'తెలుగు' },
        ta: { name: 'Tamil', speechCode: 'ta-IN', label: 'தமிழ்' },
        kn: { name: 'Kannada', speechCode: 'kn-IN', label: 'ಕನ್ನಡ' },
        mr: { name: 'Marathi', speechCode: 'mr-IN', label: 'मराठी' }
    },

    // Current language
    currentLanguage: localStorage.getItem('mediscan_lang') || 'en',

    // System prompt
    SYSTEM_PROMPT: `You are MediScan AI, a medical diagnostic assistant built for preliminary health screening in underserved communities. You are NOT a replacement for doctors. Always include appropriate disclaimers. Be professional but empathetic. Respond in {LANGUAGE}.`,

    // Get system prompt with language
    getSystemPrompt() {
        const lang = this.LANGUAGES[this.currentLanguage]?.name || 'English';
        return this.SYSTEM_PROMPT.replace('{LANGUAGE}', lang);
    }
};
