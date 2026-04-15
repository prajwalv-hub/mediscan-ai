// ================================================
// MediScan AI — Voice Input (Speech-to-Text)
// ================================================

let recognition = null;
let isRecording = false;
let activeInputId = null;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return null;
    }

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';

    recog.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        if (activeInputId) {
            const input = document.getElementById(activeInputId);
            if (input) {
                if (finalTranscript) {
                    input.value += finalTranscript;
                }
            }
        }
    };

    recog.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceRecording();
        if (event.error === 'not-allowed') {
            showToast('Microphone access denied. Please allow microphone permission.', 'error');
        }
    };

    recog.onend = () => {
        if (isRecording) {
            // Restart if still recording
            try { recog.start(); } catch(e) {}
        }
    };

    return recog;
}

function startVoiceInput(inputId) {
    activeInputId = inputId;
    
    if (!recognition) {
        recognition = initSpeechRecognition();
    }

    if (!recognition) {
        showToast('Voice input is not supported in this browser. Please use Chrome.', 'error');
        return;
    }

    if (isRecording) {
        stopVoiceRecording();
        return;
    }

    // Update language
    recognition.lang = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';

    try {
        recognition.start();
        isRecording = true;

        // Update UI for mic buttons
        const micBtns = document.querySelectorAll('.mic-btn');
        micBtns.forEach(btn => {
            if (btn.id === inputId.replace('Input', 'MicBtn') || btn.id === inputId.replace('Symptoms', 'MicBtn') || btn.id === 'scannerMicBtn' || btn.id === 'chatMicBtn') {
                btn.classList.add('recording');
            }
        });

        showToast('Listening... Speak now', 'info');
    } catch (err) {
        console.error('Could not start recognition:', err);
    }
}

function stopVoiceRecording() {
    isRecording = false;
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
    }

    // Reset all mic buttons
    document.querySelectorAll('.mic-btn').forEach(btn => btn.classList.remove('recording'));
}

function toggleVoiceRecording() {
    activeInputId = 'symptomsInput';
    
    const voiceBtn = document.getElementById('voiceRecordBtn');
    const voiceIcon = document.getElementById('voiceIcon');
    const voiceWaves = document.getElementById('voiceWaves');
    const voiceStatus = document.getElementById('voiceStatus');

    if (isRecording) {
        stopVoiceRecording();
        voiceBtn.classList.remove('recording');
        voiceIcon.style.display = 'inline';
        voiceWaves.style.display = 'none';
        voiceStatus.textContent = 'Tap to speak your symptoms';
    } else {
        if (!recognition) {
            recognition = initSpeechRecognition();
        }
        if (!recognition) {
            showToast('Voice input not supported. Use Chrome browser.', 'error');
            return;
        }

        recognition.lang = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.speechCode || 'en-US';
        
        try {
            recognition.start();
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceIcon.style.display = 'none';
            voiceWaves.style.display = 'flex';
            voiceStatus.textContent = 'Listening... Speak now';
            showToast(`Listening in ${CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English'}...`, 'info');
        } catch(err) {
            console.error('Voice error:', err);
        }
    }
}

// Add symptom tag
function addSymptomTag(btn) {
    btn.classList.toggle('active');
    const input = document.getElementById('symptomsInput');
    const tagText = btn.textContent.replace(/^[^\s]+\s/, ''); // Remove emoji
    
    if (btn.classList.contains('active')) {
        input.value += (input.value ? ', ' : '') + tagText;
    } else {
        input.value = input.value.replace(new RegExp(',?\\s*' + tagText, 'gi'), '').trim();
        if (input.value.startsWith(',')) input.value = input.value.substring(1).trim();
    }
}
