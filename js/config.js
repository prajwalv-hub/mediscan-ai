// ================================================
// MediScan AI — Configuration
// ================================================

const CONFIG = {
    // Backend API endpoint (used when deployed on Vercel)
    API_ENDPOINT: '/api/gemini',
    
    // Direct Gemini API (used for local file:// testing)
    GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    API_KEY: localStorage.getItem('mediscan_api_key') || '',
    
    // Auto-detect: on localhost/Vercel use server proxy, on file:// use direct API
    isDeployed: window.location.protocol !== 'file:',

    // Language settings
    LANGUAGES: {
        en: { name: 'English', speechCode: 'en-US', label: 'English' },
        hi: { name: 'Hindi', speechCode: 'hi-IN', label: 'हिन्दी' },
        te: { name: 'Telugu', speechCode: 'te-IN', label: 'తెలుగు' },
        ta: { name: 'Tamil', speechCode: 'ta-IN', label: 'தமிழ்' },
        kn: { name: 'Kannada', speechCode: 'kn-IN', label: 'ಕನ್ನಡ' },
        mr: { name: 'Marathi', speechCode: 'mr-IN', label: 'मराठी' }
    },

    currentLanguage: localStorage.getItem('mediscan_lang') || 'en',

    SYSTEM_PROMPT: `You are MediScan AI, a medical diagnostic assistant built for preliminary health screening in underserved communities. You are NOT a replacement for doctors. Always include appropriate disclaimers. Be professional but empathetic. Respond in {LANGUAGE}.`,

    getSystemPrompt() {
        const lang = this.LANGUAGES[this.currentLanguage]?.name || 'English';
        return this.SYSTEM_PROMPT.replace('{LANGUAGE}', lang);
    }
};
