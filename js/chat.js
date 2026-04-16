// ================================================
// MediScan AI — AI Doctor Chat
// ================================================

let chatHistory = [];

function sendSuggestion(btn) {
    document.getElementById('chatInput').value = btn.textContent;
    sendChatMessage();
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    // Stop voice if recording
    if (isRecording) stopVoiceRecording();

    // Add user message to UI
    addChatBubble(message, 'user');
    input.value = '';

    // Hide suggestions after first message
    document.getElementById('chatSuggestions').style.display = 'none';

    // Add context from last diagnosis if available
    let contextMessage = message;
    if (chatHistory.length === 0 && lastDiagnosis) {
        const context = lastDiagnosis.condition || lastDiagnosis.conditions?.[0]?.name || '';
        if (context) {
            contextMessage = `[Context: The patient was recently diagnosed with possible "${context}" with ${lastDiagnosis.severity || 'unknown'} severity.]\n\nPatient asks: ${message}`;
        }
    }

    // Add to chat history
    chatHistory.push({ role: 'user', content: contextMessage });

    // Show typing indicator
    const typingId = showTypingIndicator();

    const langName = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English';

    try {
        // Build messages for API
        const apiMessages = [
            { role: 'user', content: CONFIG.getSystemPrompt() + `\n\nRespond in ${langName}. Keep responses helpful, empathetic, and under 200 words. Always remind that you are an AI and not a real doctor.` },
            { role: 'model', content: `I understand. I'm MediScan AI, your health assistant. I'll respond in ${langName}. How can I help you?` },
            ...chatHistory
        ];

        const response = await GeminiAPI.sendChat(apiMessages);

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Add AI response
        chatHistory.push({ role: 'model', content: response });
        addChatBubble(response, 'ai');

        // Auto-read AI response if TTS is enabled
        if (typeof ttsEnabled !== 'undefined' && ttsEnabled) {
            setTimeout(() => speakText(response), 500);
        }

    } catch (error) {
        removeTypingIndicator(typingId);
        console.error('Chat error:', error);
        addChatBubble('Sorry, I encountered an error. Please try again. Error: ' + error.message, 'ai');
    }
}

function addChatBubble(message, sender) {
    const container = document.getElementById('chatMessages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;

    const avatar = sender === 'ai' ? '🤖' : '👤';
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Format message - convert markdown-style formatting
    let formattedMessage = message
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    bubble.innerHTML = `
        <div class="chat-avatar">${avatar}</div>
        <div class="chat-content">
            <p>${formattedMessage}</p>
            <span class="chat-time">${time}</span>
        </div>
    `;

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const id = 'typing-' + Date.now();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ai';
    bubble.id = id;
    bubble.innerHTML = `
        <div class="chat-avatar">🤖</div>
        <div class="chat-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}
