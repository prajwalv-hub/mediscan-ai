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

Analyze and provide your assessment. Respond in ${langName}.

Provide your analysis in this exact JSON format:
{
    "disclaimer": "This is an AI-assisted preliminary screening and should NOT replace professional medical diagnosis.",
    "conditions": [
        {"name": "Most likely condition", "likelihood": 65, "description": "Brief description"},
        {"name": "Second possibility", "likelihood": 20, "description": "Brief description"},
        {"name": "Third possibility", "likelihood": 10, "description": "Brief description"}
    ],
    "severity": "Low|Moderate|High|Critical",
    "healthScore": 40,
    "questions": ["Question a doctor would ask 1", "Question 2"],
    "redFlags": ["Warning sign to watch for"],
    "recommendations": ["What to do step 1", "Step 2", "Step 3"],
    "urgency": "routine|soon|urgent|emergency",
    "patientFriendlyExplanation": "Simple, empathetic explanation in ${langName}"
}

IMPORTANT: Return ONLY valid JSON, no extra text.`;

    try {
        const response = await GeminiAPI.sendText(prompt);
        const result = GeminiAPI.parseJSON(response);

        if (result) {
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
            displayRawSymptomResults(response);
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
}

function displayRawSymptomResults(text) {
    const container = document.getElementById('symptomsResults');
    container.style.display = 'block';
    document.getElementById('conditionsList').innerHTML = `
        <div class="condition-card">
            <p class="condition-desc">${text}</p>
        </div>
    `;
    document.getElementById('symptomRecsList').innerHTML = '<li>Please consult a healthcare professional.</li>';
    container.scrollIntoView({ behavior: 'smooth' });
}

function speakSymptomResults() {
    if (!lastDiagnosis) return;
    const text = lastDiagnosis.patientFriendlyExplanation || 
        `Analysis shows possible ${lastDiagnosis.conditions?.[0]?.name}. ${lastDiagnosis.recommendations?.[0] || ''}`;
    speakText(text);
}

function downloadSymptomReport() {
    if (!lastDiagnosis) {
        showToast('No results to download', 'error');
        return;
    }
    generatePDFReport(lastDiagnosis, 'symptom');
}
