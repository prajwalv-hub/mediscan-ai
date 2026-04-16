// ================================================
// MediScan AI — Accessibility Features
// ================================================

let ttsEnabled = false;
let highContrastEnabled = false;
let largeTextEnabled = false;

// ==================== TEXT-TO-SPEECH TOGGLE ====================
// Actual speakText() is in voice.js — this just toggles auto-read

function speakResults() {
    if (!lastDiagnosis) return;
    speakSymptomResults();
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('ttsToggle');
    btn.classList.toggle('active', ttsEnabled);

    if (ttsEnabled) {
        showToast('🔊 Auto-read enabled — results will be spoken aloud in your language', 'success');
    } else {
        // Stop any playing audio
        if (typeof stopSpeaking === 'function') stopSpeaking();
        showToast('🔇 Auto-read disabled', 'info');
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
