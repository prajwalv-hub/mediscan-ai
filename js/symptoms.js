// ================================================
// MediScan AI — Symptom Checker
// ================================================

async function analyzeSymptoms() {
    const symptoms = document.getElementById('symptomsInput').value.trim();
    if (!symptoms) {
        showToast('Please describe your symptoms first', 'error');
        return;
    }

    // Stop voice if recording
    if (isRecording) {
        stopVoiceRecording();
        const voiceBtn = document.getElementById('voiceRecordBtn');
        const voiceIcon = document.getElementById('voiceIcon');
        const voiceWaves = document.getElementById('voiceWaves');
        const voiceStatus = document.getElementById('voiceStatus');
        voiceBtn.classList.remove('recording');
        voiceIcon.style.display = 'inline';
        voiceWaves.style.display = 'none';
        voiceStatus.textContent = 'Tap to speak your symptoms';
    }

    const btn = document.getElementById('symptomAnalyzeBtn');
    const btnText = document.getElementById('symptomBtnText');
    const btnLoader = document.getElementById('symptomBtnLoader');

    btn.disabled = true;
    btnText.textContent = 'Analyzing...';
    btnLoader.style.display = 'inline-block';

    const langName = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English';

    const prompt = `The patient reports these symptoms: "${symptoms}"

Analyze these symptoms. Respond ONLY with a raw JSON object (no markdown, no code blocks, no extra text).

IMPORTANT: ALL text values in the JSON MUST be written in ${langName} language. Do NOT use English if the language is ${langName}.

The JSON must follow this exact structure:
{"disclaimer":"AI screening only - not a diagnosis","conditions":[{"name":"Condition name in ${langName}","likelihood":65,"description":"Brief description in ${langName}"},{"name":"Second possibility in ${langName}","likelihood":20,"description":"Brief description in ${langName}"},{"name":"Third possibility in ${langName}","likelihood":10,"description":"Brief description in ${langName}"}],"severity":"Low","healthScore":40,"redFlags":["Warning sign in ${langName}"],"recommendations":["Step 1 in ${langName}","Step 2 in ${langName}","Step 3 in ${langName}"],"patientFriendlyExplanation":"Simple explanation in ${langName}"}

Rules: ALL text must be in ${langName}. Output ONLY the JSON. No thinking. No explanation. No markdown.`;

    try {
        const response = await GeminiAPI.sendText(prompt);
        console.log('Raw API response:', response.substring(0, 200));
        let result = GeminiAPI.parseJSON(response);

        if (result && result.conditions) {
            displaySymptomResults(result);
            saveScanToHistory({
                type: 'symptom',
                title: symptoms.substring(0, 50) + '...',
                condition: result.conditions?.[0]?.name || 'Analysis',
                severity: result.severity,
                healthScore: result.healthScore,
                date: new Date().toISOString()
            });
            lastDiagnosis = result;
        } else {
            // If JSON parse failed, display a formatted version of the text
            displayFormattedSymptomResults(response);
        }
    } catch (error) {
        console.error('Symptom analysis error:', error);
        showToast('Analysis failed: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = '🧬 Analyze Symptoms';
        btnLoader.style.display = 'none';
    }
}

function displaySymptomResults(result) {
    const container = document.getElementById('symptomsResults');
    container.style.display = 'block';

    // Conditions list
    const conditionsList = document.getElementById('conditionsList');
    conditionsList.innerHTML = (result.conditions || []).map((cond, i) => {
        const colors = ['var(--accent-primary)', 'var(--accent-secondary)', 'var(--accent-yellow)'];
        return `
            <div class="condition-card result-appear">
                <div class="condition-header">
                    <span class="condition-name">${cond.name}</span>
                    <span class="condition-likelihood" style="color: ${colors[i] || colors[0]}">${cond.likelihood}%</span>
                </div>
                <div class="confidence-bar" style="margin: 8px 0;">
                    <div class="confidence-fill" style="width: ${cond.likelihood}%; background: ${colors[i] || colors[0]}; transition: width 1s ease ${i * 0.2}s;"></div>
                </div>
                <p class="condition-desc">${cond.description}</p>
            </div>
        `;
    }).join('');

    // Red flags
    if (result.redFlags && result.redFlags.length > 0 && result.redFlags[0]) {
        document.getElementById('redFlagsCard').style.display = 'block';
        document.getElementById('redFlagsList').innerHTML = result.redFlags.map(f => `<li>${f}</li>`).join('');
    } else {
        document.getElementById('redFlagsCard').style.display = 'none';
    }

    // Recommendations
    document.getElementById('symptomRecsList').innerHTML = (result.recommendations || []).map(r => `<li>${r}</li>`).join('');

    container.scrollIntoView({ behavior: 'smooth' });
    showToast('Symptom analysis complete!', 'success');

    // Auto-read results aloud if TTS toggle is enabled
    if (typeof ttsEnabled !== 'undefined' && ttsEnabled) {
        setTimeout(() => speakSymptomResults(), 800);
    }
}

function displayFormattedSymptomResults(text) {
    const container = document.getElementById('symptomsResults');
    container.style.display = 'block';
    
    // Aggressively clean the response
    let cleaned = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json\s*/gi, '').replace(/```/g, '')
        .replace(/^json\s*/i, '')
        .trim();
    
    // Try to extract and parse JSON
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            let jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1').replace(/\n/g, ' ');
            const parsed = JSON.parse(jsonStr);
            if (parsed && parsed.conditions) {
                displaySymptomResults(parsed);
                lastDiagnosis = parsed;
                return;
            }
        } catch {}
    }

    // Try the standard parser one more time
    const lastTry = GeminiAPI.parseJSON(cleaned);
    if (lastTry && lastTry.conditions) {
        displaySymptomResults(lastTry);
        lastDiagnosis = lastTry;
        return;
    }
    
    // Final fallback: strip JSON artifacts and show clean text
    let formatted = cleaned
        .replace(/[{}"[\]]/g, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
    document.getElementById('conditionsList').innerHTML = `
        <div class="condition-card">
            <div class="condition-header">
                <span class="condition-name">AI Analysis</span>
            </div>
            <p class="condition-desc" style="line-height:1.8;">${formatted}</p>
        </div>
    `;
    document.getElementById('symptomRecsList').innerHTML = '<li>Please consult a healthcare professional for proper diagnosis.</li>';
    document.getElementById('redFlagsCard').style.display = 'none';
    container.scrollIntoView({ behavior: 'smooth' });
    showToast('Analysis complete!', 'success');
}

function speakSymptomResults() {
    if (!lastDiagnosis) {
        showToast('No results to read', 'warning');
        return;
    }

    // Priority: use patientFriendlyExplanation if available (it's in the user's language)
    if (lastDiagnosis.patientFriendlyExplanation) {
        let text = lastDiagnosis.patientFriendlyExplanation;

        // Append conditions and recommendations in the response language
        if (lastDiagnosis.conditions && lastDiagnosis.conditions.length > 0) {
            lastDiagnosis.conditions.forEach((c, i) => {
                text += '. ' + c.name + ', ' + c.likelihood + '%. ' + (c.description || '');
            });
        }

        if (lastDiagnosis.recommendations && lastDiagnosis.recommendations.length > 0) {
            lastDiagnosis.recommendations.forEach(r => {
                text += '. ' + r;
            });
        }

        speakText(text);
        return;
    }

    // Fallback: build speech from structured data
    let text = '';

    if (lastDiagnosis.conditions && lastDiagnosis.conditions.length > 0) {
        lastDiagnosis.conditions.forEach((c, i) => {
            text += c.name + ', ' + c.likelihood + '%. ' + (c.description || '') + '. ';
        });
    }

    if (lastDiagnosis.recommendations && lastDiagnosis.recommendations.length > 0) {
        lastDiagnosis.recommendations.forEach(r => {
            text += r + '. ';
        });
    }

    if (lastDiagnosis.redFlags && lastDiagnosis.redFlags.length > 0) {
        lastDiagnosis.redFlags.forEach(f => {
            text += f + '. ';
        });
    }

    if (!text) {
        text = 'Analysis complete. Please consult a doctor for proper diagnosis.';
    }

    speakText(text);
}

function downloadSymptomReport() {
    if (!lastDiagnosis) {
        showToast('No results to download', 'error');
        return;
    }
    generatePDFReport(lastDiagnosis, 'symptom');
}
