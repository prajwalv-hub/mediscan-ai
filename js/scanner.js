// ================================================
// MediScan AI — Image Scanner & Analysis
// ================================================

async function analyzeImage() {
    if (!currentImageData) {
        showToast('Please upload or capture an image first', 'error');
        return;
    }

    const btn = document.getElementById('analyzeBtn');
    const btnText = document.getElementById('analyzeBtnText');
    const btnLoader = document.getElementById('analyzeBtnLoader');

    // Show loading
    btn.disabled = true;
    btnText.textContent = 'Analyzing...';
    btnLoader.style.display = 'inline-block';

    const symptoms = document.getElementById('scannerSymptoms').value.trim();
    const langName = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English';

    let prompt;
    if (symptoms) {
        // Combined analysis (cross-validation)
        prompt = `Analyze this medical image AND the following patient-reported symptoms for a cross-validated diagnosis.

Patient symptoms: "${symptoms}"

Cross-validate the image findings with the reported symptoms. If they correlate, increase confidence. If they conflict, note the discrepancy.

Respond in ${langName}. Provide your analysis in this exact JSON format:
{
    "disclaimer": "This is an AI-assisted preliminary screening and should NOT replace professional medical diagnosis.",
    "condition": "Primary detected condition name",
    "confidence": 82,
    "severity": "Low|Moderate|High|Critical",
    "healthScore": 65,
    "observations": ["observation 1", "observation 2", "observation 3"],
    "differentials": [
        {"condition": "condition name", "likelihood": 15},
        {"condition": "condition name", "likelihood": 8}
    ],
    "recommendations": ["step 1", "step 2", "step 3"],
    "urgency": "routine|soon|urgent|emergency",
    "redFlags": ["red flag if any"],
    "crossValidation": "How image and symptoms correlate or conflict",
    "patientFriendlyExplanation": "Simple explanation in ${langName}"
}

IMPORTANT: Return ONLY valid JSON, no extra text.`;
    } else {
        prompt = `Analyze this medical image for potential health conditions.

Respond in ${langName}. Provide your analysis in this exact JSON format:
{
    "disclaimer": "This is an AI-assisted preliminary screening and should NOT replace professional medical diagnosis.",
    "condition": "Primary detected condition name",
    "confidence": 78,
    "severity": "Low|Moderate|High|Critical",
    "healthScore": 70,
    "observations": ["observation 1", "observation 2", "observation 3"],
    "differentials": [
        {"condition": "condition name", "likelihood": 15},
        {"condition": "condition name", "likelihood": 8}
    ],
    "recommendations": ["step 1", "step 2", "step 3"],
    "urgency": "routine|soon|urgent|emergency",
    "redFlags": ["red flag if any"],
    "patientFriendlyExplanation": "Simple explanation in ${langName}"
}

IMPORTANT: Return ONLY valid JSON, no extra text.`;
    }

    try {
        const response = await GeminiAPI.sendImageAndText(currentImageData, currentImageMime, prompt);
        const result = GeminiAPI.parseJSON(response);

        if (result) {
            displayScanResults(result, symptoms);
            // Save to history
            saveScanToHistory({
                type: 'image',
                condition: result.condition,
                confidence: result.confidence,
                severity: result.severity,
                healthScore: result.healthScore,
                date: new Date().toISOString()
            });
            lastDiagnosis = result;
        } else {
            // Fallback: display raw text
            displayRawResults(response);
        }
    } catch (error) {
        console.error('Analysis error:', error);
        showToast('Analysis failed: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = '🧬 Analyze with AI';
        btnLoader.style.display = 'none';
    }
}

function displayScanResults(result, hasSymptoms) {
    const container = document.getElementById('scannerResults');
    container.style.display = 'block';

    // Health Score Gauge
    const score = result.healthScore || 50;
    updateGauge(score);

    // Diagnosis
    document.getElementById('diagnosisName').textContent = result.condition || 'Unknown';
    document.getElementById('confidenceValue').textContent = (result.confidence || 0) + '%';

    // Confidence bar
    setTimeout(() => {
        document.getElementById('confidenceFill').style.width = (result.confidence || 0) + '%';
    }, 300);

    // Severity badge
    const severityBadge = document.getElementById('severityBadge');
    const severity = (result.severity || 'Unknown').toLowerCase();
    severityBadge.textContent = result.severity || 'Unknown';
    severityBadge.className = 'severity-badge severity-' + severity;

    // Observations
    const obsList = document.getElementById('observationsList');
    obsList.innerHTML = (result.observations || []).map(obs => `<li>${obs}</li>`).join('');

    // Recommendations
    const recsList = document.getElementById('recommendationsList');
    recsList.innerHTML = (result.recommendations || []).map(rec => `<li>${rec}</li>`).join('');

    // Cross-validation
    if (hasSymptoms && result.crossValidation) {
        document.getElementById('crossValidationCard').style.display = 'block';
        document.getElementById('crossValidationText').textContent = result.crossValidation;
    } else {
        document.getElementById('crossValidationCard').style.display = 'none';
    }

    // Emergency detection
    if (result.urgency === 'emergency' || severity === 'critical') {
        document.getElementById('emergencyAlert').style.display = 'block';
        document.getElementById('emergencyText').textContent =
            result.patientFriendlyExplanation || 'Critical condition detected. Seek immediate medical attention.';
    } else {
        document.getElementById('emergencyAlert').style.display = 'none';
    }

    // Scroll to results
    container.scrollIntoView({ behavior: 'smooth' });
    showToast('Analysis complete!', 'success');

    // Auto-read results if TTS is enabled
    if (typeof ttsEnabled !== 'undefined' && ttsEnabled) {
        setTimeout(() => {
            const text = result.patientFriendlyExplanation ||
                (result.condition + '. ' + (result.observations || []).join('. ') + '. ' + (result.recommendations || []).join('. '));
            speakText(text);
        }, 800);
    }
}

function updateGauge(score) {
    const circumference = 2 * Math.PI * 85; // r=85
    const offset = circumference - (score / 100) * circumference;
    const gaugeFill = document.getElementById('gaugeFill');
    const gaugeNumber = document.getElementById('gaugeNumber');

    // Determine color based on score (inverted - higher = worse)
    let colorClass = 'gauge-green';
    let textColor = 'var(--accent-green)';
    if (score > 70) { colorClass = 'gauge-red'; textColor = 'var(--accent-red)'; }
    else if (score > 50) { colorClass = 'gauge-orange'; textColor = '#ff9500'; }
    else if (score > 30) { colorClass = 'gauge-yellow'; textColor = 'var(--accent-yellow)'; }

    gaugeFill.className = 'gauge-fill ' + colorClass;
    gaugeNumber.style.color = textColor;

    // Animate
    setTimeout(() => {
        gaugeFill.style.strokeDashoffset = offset;
        animateCounter(gaugeNumber, 0, score, 1500);
    }, 200);
}

function animateCounter(element, start, end, duration) {
    let startTime = null;
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value;
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

function displayRawResults(text) {
    const container = document.getElementById('scannerResults');
    container.style.display = 'block';

    document.getElementById('diagnosisName').textContent = 'Analysis Complete';
    document.getElementById('observationsList').innerHTML = `<li>${text}</li>`;
    document.getElementById('recommendationsList').innerHTML = '<li>Please consult a healthcare professional for proper diagnosis.</li>';
    container.scrollIntoView({ behavior: 'smooth' });
}
