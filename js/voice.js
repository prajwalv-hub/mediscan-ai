// ================================================
// MediScan AI — Voice Input & Text-to-Speech
// Supports ALL Indian languages via Google Translate TTS
// ================================================

let recognition = null;
let isRecording = false;
let activeInputId = null;
let recordingTimeout = null;
let gotResult = false;

// ==================== SPEECH RECOGNITION ====================

function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.lang = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';

    r.onresult = (e) => {
        let final = '', interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript;
            else interim += e.results[i][0].transcript;
        }
        const status = document.getElementById('voiceStatus');
        if (interim && status) status.textContent = '"' + interim.substring(0, 50) + '..."';
        if (final && activeInputId) {
            const inp = document.getElementById(activeInputId);
            if (inp) { inp.value += (inp.value ? ' ' : '') + final; gotResult = true; }
            showToast('Got: "' + final.substring(0, 40) + '"', 'success');
        }
    };
    r.onerror = (e) => {
        if (e.error === 'not-allowed') showToast('Microphone blocked! Allow in browser settings.', 'error');
        else if (e.error === 'no-speech') showToast('No speech heard. Try again.', 'warning');
        else if (e.error === 'network') showToast('Voice input unavailable on this network. Please type your symptoms instead.', 'warning');
        else if (e.error !== 'aborted') showToast('Voice error: ' + e.error, 'error');
        fullStopRecording();
    };
    r.onend = () => { if (isRecording) try { r.start(); } catch(x) { fullStopRecording(); } };
    return r;
}

function toggleVoiceRecording() {
    activeInputId = 'symptomsInput';
    if (isRecording) { fullStopRecording(); return; }
    startListening();
}

function startListening() {
    if (recognition) try { recognition.stop(); } catch(x) {}
    recognition = initSpeechRecognition();
    if (!recognition) { showToast('Voice not supported. Use Chrome.', 'error'); return; }
    recognition.lang = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';
    gotResult = false;
    try {
        recognition.start();
        isRecording = true;
        const vb = document.getElementById('voiceRecordBtn');
        const vi = document.getElementById('voiceIcon');
        const vw = document.getElementById('voiceWaves');
        const vs = document.getElementById('voiceStatus');
        if (vb) vb.classList.add('recording');
        if (vi) vi.style.display = 'none';
        if (vw) vw.style.display = 'flex';
        if (vs) vs.textContent = 'Listening... Speak now';
        document.querySelectorAll('.mic-btn').forEach(b => b.classList.add('recording'));
        showToast('🎤 Listening in ' + (CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English') + '... Tap again to stop.', 'info');
        clearTimeout(recordingTimeout);
        recordingTimeout = setTimeout(() => { if (isRecording) { fullStopRecording(); showToast('Auto-stopped.', 'info'); } }, 15000);
    } catch(x) { showToast('Mic error.', 'error'); }
}

function fullStopRecording() {
    isRecording = false;
    clearTimeout(recordingTimeout);
    if (recognition) { try { recognition.stop(); } catch(x) {} recognition = null; }
    const vb = document.getElementById('voiceRecordBtn');
    const vi = document.getElementById('voiceIcon');
    const vw = document.getElementById('voiceWaves');
    const vs = document.getElementById('voiceStatus');
    if (vb) vb.classList.remove('recording');
    if (vi) vi.style.display = 'inline';
    if (vw) vw.style.display = 'none';
    if (vs) vs.textContent = gotResult ? 'Done! Tap to speak again' : 'Tap to speak your symptoms';
    document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));
}
function stopVoiceRecording() { fullStopRecording(); }
function startVoiceInput(id) { activeInputId = id; if (isRecording) { fullStopRecording(); return; } startListening(); }

// ==================== SYMPTOM TAGS ====================

function addSymptomTag(btn) {
    btn.classList.toggle('active');
    const input = document.getElementById('symptomsInput');
    const tag = btn.textContent.replace(/^[^\s]+\s/, '');
    if (btn.classList.contains('active')) input.value += (input.value ? ', ' : '') + tag;
    else { input.value = input.value.replace(new RegExp(',?\\s*' + tag, 'gi'), '').trim(); if (input.value.startsWith(',')) input.value = input.value.substring(1).trim(); }
}

// ==================== TEXT-TO-SPEECH ====================
// Strategy:
// 1. If server is available → use Google Translate TTS proxy (supports ALL languages: en, hi, kn, te, ta, mr)
// 2. Fallback → use browser Web Speech API

function speakText(text) {
    if (!text || text.trim() === '') { showToast('Nothing to read', 'warning'); return; }

    // Stop anything currently playing
    stopSpeaking();

    // Clean the text for speech
    let clean = text.replace(/[{}"\\[\]]/g, ' ').replace(/\*\*/g, '').replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();
    if (!clean) return;

    const lang = CONFIG.currentLanguage || 'en';
    const langName = CONFIG.LANGUAGES[lang]?.name || 'English';
    const speechCode = CONFIG.LANGUAGES[lang]?.speechCode || 'en-US';
    const langCode = speechCode.split('-')[0]; // hi, kn, te, ta, mr, en

    // Use Google Translate TTS via server proxy (supports Kannada, Hindi, Telugu, Tamil, Marathi)
    if (CONFIG.isDeployed) {
        speakGoogleTTS(clean, langCode, langName);
    } else {
        // Fallback to browser TTS
        speakBrowserTTS(clean, speechCode, langName);
    }
}

// ==================== GOOGLE TRANSLATE TTS (via server proxy) ====================
// This works for ALL languages including Kannada, Telugu, Tamil, Hindi, Marathi

function speakGoogleTTS(text, lang, langName) {
    showToast('🔊 Reading in ' + langName + '...', 'info');

    // Split into chunks (Google TTS limit ~200 chars)
    const chunks = splitTextForTTS(text, 150);

    let i = 0;
    window._ttsPlaying = true;

    function playNext() {
        if (i >= chunks.length || !window._ttsPlaying) {
            window._ttsPlaying = false;
            if (i >= chunks.length) showToast('✅ Done reading', 'success');
            return;
        }

        const url = '/tts?lang=' + encodeURIComponent(lang) + '&q=' + encodeURIComponent(chunks[i]);
        console.log('TTS chunk', i + 1, '/' + chunks.length, ':', chunks[i].substring(0, 50) + '...');

        const audio = new Audio(url);
        audio.volume = 1.0;
        window._ttsAudio = audio;

        audio.oncanplaythrough = () => {
            console.log('TTS audio ready, playing chunk', i + 1);
        };

        audio.onended = () => {
            i++;
            playNext();
        };

        audio.onerror = (e) => {
            console.error('TTS audio error for chunk', i, ':', e);
            // If server TTS fails, try browser TTS as fallback
            if (i === 0) {
                console.log('Server TTS failed, falling back to browser TTS');
                const speechCode = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';
                speakBrowserTTS(chunks.join(' '), speechCode, langName);
                return;
            }
            i++;
            playNext();
        };

        audio.play().then(() => {
            console.log('TTS playing chunk', i + 1);
        }).catch((e) => {
            console.error('Play blocked:', e);
            // Auto-play blocked — use browser TTS as fallback
            showToast('⚠️ Audio blocked. Using browser voice...', 'warning');
            const speechCode = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';
            speakBrowserTTS(chunks.join(' '), speechCode, langName);
        });
    }

    playNext();
}

// ==================== BROWSER TTS (fallback) ====================

function speakBrowserTTS(text, speechCode, langName) {
    if (!('speechSynthesis' in window)) {
        showToast('Text-to-speech not supported in this browser', 'error');
        return;
    }

    showToast('🔊 Reading in ' + langName + '...', 'info');
    window.speechSynthesis.cancel();

    const chunks = splitTextForTTS(text, 180);
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = speechCode.split('-')[0];

    // Find best voice for the language
    let selectedVoice = voices.find(v => v.lang === speechCode) ||
                        voices.find(v => v.lang.startsWith(langPrefix + '-')) ||
                        voices.find(v => v.lang.startsWith(langPrefix)) ||
                        null;

    let chunkIndex = 0;
    window._ttsPlaying = true;

    function speakNextChunk() {
        if (chunkIndex >= chunks.length || !window._ttsPlaying) {
            window._ttsPlaying = false;
            if (chunkIndex >= chunks.length) showToast('✅ Done reading', 'success');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
        utterance.lang = speechCode;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onend = () => {
            chunkIndex++;
            speakNextChunk();
        };

        utterance.onerror = (e) => {
            console.error('Browser TTS error:', e);
            chunkIndex++;
            speakNextChunk();
        };

        window.speechSynthesis.speak(utterance);
    }

    // Ensure voices are loaded
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            const v = window.speechSynthesis.getVoices();
            selectedVoice = v.find(voice => voice.lang === speechCode) ||
                           v.find(voice => voice.lang.startsWith(langPrefix + '-')) ||
                           v.find(voice => voice.lang.startsWith(langPrefix)) ||
                           null;
            speakNextChunk();
        };
        // Also try after a small delay in case onvoiceschanged doesn't fire
        setTimeout(() => {
            if (chunkIndex === 0 && window._ttsPlaying) speakNextChunk();
        }, 300);
    } else {
        speakNextChunk();
    }
}

// ==================== HELPERS ====================

function splitTextForTTS(text, maxLen) {
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= maxLen) { chunks.push(remaining); break; }
        // Try to split at sentence boundary
        let cut = remaining.lastIndexOf('. ', maxLen);
        if (cut < 20) cut = remaining.lastIndexOf('। ', maxLen); // Hindi/Devanagari sentence end
        if (cut < 20) cut = remaining.lastIndexOf(', ', maxLen);
        if (cut < 20) cut = remaining.lastIndexOf(' ', maxLen);
        if (cut < 20) cut = maxLen;
        chunks.push(remaining.substring(0, cut + 1).trim());
        remaining = remaining.substring(cut + 1).trim();
    }
    return chunks.filter(c => c.length > 0);
}

function stopSpeaking() {
    window._ttsPlaying = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (window._ttsAudio) {
        window._ttsAudio.pause();
        window._ttsAudio.currentTime = 0;
        window._ttsAudio = null;
    }
}

// Pre-load browser voices
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
