// ================================================
// MediScan AI — Accessibility Features
// ================================================

let ttsEnabled = false;
let highContrastEnabled = false;
let largeTextEnabled = false;

// ==================== TEXT-TO-SPEECH ====================

function speakText(text) {
    if (!('speechSynthesis' in window)) {
        showToast('Text-to-Speech not supported in this browser', 'error');
        return;
    }

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language based on current selection
    const langConfig = CONFIG.LANGUAGES[CONFIG.currentLanguage];
    if (langConfig) {
        utterance.lang = langConfig.speechCode;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
        showToast('🔊 Reading aloud...', 'info');
    };

    utterance.onerror = (e) => {
        console.error('TTS error:', e);
    };

    window.speechSynthesis.speak(utterance);
}

function speakResults() {
    if (!lastDiagnosis) return;
    const text = lastDiagnosis.patientFriendlyExplanation || 
        `Diagnosis: ${lastDiagnosis.condition || 'Unknown'}. Confidence: ${lastDiagnosis.confidence || 0} percent. Severity: ${lastDiagnosis.severity || 'Unknown'}. ${lastDiagnosis.recommendations?.[0] || ''}`;
    speakText(text);
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('ttsToggle');
    btn.classList.toggle('active', ttsEnabled);

    if (ttsEnabled) {
        showToast('🔊 Text-to-Speech enabled — results will be read aloud', 'success');
    } else {
        window.speechSynthesis.cancel();
        showToast('🔇 Text-to-Speech disabled', 'info');
    }
}

// ==================== HIGH CONTRAST ====================

function toggleContrast() {
    highContrastEnabled = !highContrastEnabled;
    document.body.classList.toggle('high-contrast', highContrastEnabled);
    const btn = document.getElementById('contrastToggle');
    btn.classList.toggle('active', highContrastEnabled);

    if (highContrastEnabled) {
        showToast('🌓 High contrast mode enabled', 'success');
    } else {
        showToast('🌓 High contrast mode disabled', 'info');
    }

    localStorage.setItem('mediscan_contrast', highContrastEnabled);
}

// ==================== LARGE TEXT ====================

function toggleTextSize() {
    largeTextEnabled = !largeTextEnabled;
    document.body.classList.toggle('large-text', largeTextEnabled);
    const btn = document.getElementById('textSizeToggle');
    btn.classList.toggle('active', largeTextEnabled);

    if (largeTextEnabled) {
        showToast('🔤 Large text mode enabled', 'success');
    } else {
        showToast('🔤 Normal text mode', 'info');
    }

    localStorage.setItem('mediscan_largetext', largeTextEnabled);
}

// ==================== LOAD SAVED PREFERENCES ====================

function loadAccessibilityPreferences() {
    if (localStorage.getItem('mediscan_contrast') === 'true') {
        toggleContrast();
    }
    if (localStorage.getItem('mediscan_largetext') === 'true') {
        toggleTextSize();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadAccessibilityPreferences();
});
