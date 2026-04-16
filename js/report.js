// ================================================
// MediScan AI — Report Analyzer & PDF Generation
// ================================================

// ==================== REPORT ANALYZER ====================

async function analyzeReport() {
    if (!currentReportData) {
        showToast('Please upload a medical report first', 'error');
        return;
    }

    const btn = document.getElementById('reportAnalyzeBtn');
    const btnText = document.getElementById('reportBtnText');
    const btnLoader = document.getElementById('reportBtnLoader');

    btn.disabled = true;
    btnText.textContent = 'Analyzing report...';
    btnLoader.style.display = 'inline-block';

    const langName = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English';

    const prompt = `Analyze this medical report image. Extract all key medical values, provide a summary, and give personalized lifestyle recommendations. Respond in ${langName}.

Return a JSON object with this exact structure:
{
    "disclaimer": "This is an AI-assisted analysis. Please verify with your doctor.",
    "reportType": "Type of report",
    "summary": "Brief overall summary of findings",
    "keyValues": [
        {"name": "Test name", "value": "measured value", "unit": "unit", "status": "normal or low or high or critical", "normalRange": "normal range"}
    ],
    "concerns": ["Any concerning values"],
    "lifestyle": [
        {"category": "Diet", "recommendations": "Specific food recommendations"},
        {"category": "Exercise", "recommendations": "Exercise recommendations"},
        {"category": "Sleep", "recommendations": "Sleep recommendations"},
        {"category": "Supplements", "recommendations": "Supplement recommendations"},
        {"category": "Avoid", "recommendations": "Things to avoid"},
        {"category": "Follow-up", "recommendations": "When to retest or see doctor"}
    ],
    "patientFriendlyExplanation": "Simple explanation in ${langName}"
}

Important: Include ALL test values you can read from the report in keyValues. Include at least 4 lifestyle recommendations.`;

    try {
        let response, result;
        
        // Try JSON-mode API call first (forces valid JSON)
        try {
            response = await GeminiAPI.sendImageForJSON(currentReportData, currentReportMime, prompt);
            // With JSON mode, response should already be valid JSON
            result = typeof response === 'string' ? robustParseJSON(response) : response;
        } catch (jsonError) {
            console.warn('JSON mode failed, trying standard mode:', jsonError.message);
            // Fallback to standard mode
            response = await GeminiAPI.sendImageAndText(currentReportData, currentReportMime, prompt);
            result = robustParseJSON(response);
        }
        
        // If server already parsed it, use that
        if (!result && GeminiAPI._serverParsed) {
            result = GeminiAPI._serverParsed;
            GeminiAPI._serverParsed = null;
        }

        if (result && (result.reportType || result.summary || result.keyValues)) {
            displayReportResults(result);
            saveScanToHistory({
                type: 'report',
                title: result.reportType || 'Medical Report',
                condition: result.reportType,
                date: new Date().toISOString()
            });
            lastDiagnosis = result;
        } else {
            // Fallback: display formatted text
            displayRawReportResults(response);
        }
    } catch (error) {
        console.error('Report analysis error:', error);
        showToast('Analysis failed: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = '📑 Analyze Report';
        btnLoader.style.display = 'none';
    }
}

// Robust JSON parser with multiple strategies
function robustParseJSON(text) {
    if (!text) return null;

    // Strategy 1: Use server-parsed data
    if (GeminiAPI._serverParsed) {
        console.log('✅ Using server-parsed JSON');
        const result = GeminiAPI._serverParsed;
        GeminiAPI._serverParsed = null;
        return result;
    }

    // Strategy 2: Clean and parse
    try {
        let clean = text.trim();
        // Remove thinking tags
        clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        // Remove markdown code blocks
        clean = clean.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        // Remove "json" prefix
        clean = clean.replace(/^json\s*/i, '').trim();

        // Find JSON boundaries
        const first = clean.indexOf('{');
        const last = clean.lastIndexOf('}');
        if (first === -1 || last <= first) return null;

        let jsonStr = clean.substring(first, last + 1);

        // Try direct parse first
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.log('Direct parse failed, trying cleanup...');
        }

        // Strategy 3: Aggressive cleanup
        // Fix unescaped newlines within string values
        jsonStr = jsonStr.replace(/\r?\n/g, ' ');
        // Collapse excessive whitespace
        jsonStr = jsonStr.replace(/\s+/g, ' ');
        // Fix trailing commas
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.log('Cleanup parse failed, trying field extraction...');
        }

        // Strategy 4: Fix common issues — unescaped quotes in values
        jsonStr = jsonStr.replace(/:\s*"([^"]*?)"\s*([,}\]])/g, (match, value, end) => {
            // Re-escape any unescaped quotes inside the value
            const escaped = value.replace(/(?<!\\)"/g, '\\"');
            return ': "' + escaped + '"' + end;
        });

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.log('Quote-fix parse failed, trying manual extraction...');
        }

        // Strategy 5: Manual field extraction as last resort
        return extractFieldsManually(clean);

    } catch (e) {
        console.warn('All JSON parse strategies failed:', e.message);
        return null;
    }
}

// Extract fields manually from malformed JSON/text
function extractFieldsManually(text) {
    const result = {};

    // Extract reportType
    const typeMatch = text.match(/"reportType"\s*:\s*"([^"]+)"/);
    if (typeMatch) result.reportType = typeMatch[1];

    // Extract summary
    const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/);
    if (summaryMatch) result.summary = summaryMatch[1];

    // Extract patientFriendlyExplanation
    const explainMatch = text.match(/"patientFriendlyExplanation"\s*:\s*"([^"]+)"/);
    if (explainMatch) result.patientFriendlyExplanation = explainMatch[1];

    // Extract keyValues array
    const keyValuesMatch = text.match(/"keyValues"\s*:\s*\[([\s\S]*?)\]/);
    if (keyValuesMatch) {
        const items = keyValuesMatch[1].match(/\{[^}]+\}/g);
        if (items) {
            result.keyValues = items.map(item => {
                const obj = {};
                const nameM = item.match(/"name"\s*:\s*"([^"]+)"/);
                const valM = item.match(/"value"\s*:\s*"([^"]+)"/);
                const unitM = item.match(/"unit"\s*:\s*"([^"]+)"/);
                const statusM = item.match(/"status"\s*:\s*"([^"]+)"/);
                const rangeM = item.match(/"normalRange"\s*:\s*"([^"]+)"/);
                if (nameM) obj.name = nameM[1];
                if (valM) obj.value = valM[1];
                if (unitM) obj.unit = unitM[1];
                if (statusM) obj.status = statusM[1];
                if (rangeM) obj.normalRange = rangeM[1];
                return obj;
            }).filter(obj => obj.name);
        }
    }

    // Extract lifestyle array
    const lifestyleMatch = text.match(/"lifestyle"\s*:\s*\[([\s\S]*?)\]\s*[,}]/);
    if (lifestyleMatch) {
        const items = lifestyleMatch[1].match(/\{[^}]+\}/g);
        if (items) {
            result.lifestyle = items.map(item => {
                const obj = {};
                const catM = item.match(/"category"\s*:\s*"([^"]+)"/);
                const recM = item.match(/"recommendations"\s*:\s*"([^"]+)"/);
                if (catM) obj.category = catM[1];
                if (recM) obj.recommendations = recM[1];
                return obj;
            }).filter(obj => obj.category);
        }
    }

    // Extract concerns array
    const concernsMatch = text.match(/"concerns"\s*:\s*\[([\s\S]*?)\]/);
    if (concernsMatch) {
        const items = concernsMatch[1].match(/"([^"]+)"/g);
        if (items) {
            result.concerns = items.map(i => i.replace(/"/g, ''));
        }
    }

    // Only return if we extracted meaningful data
    if (result.reportType || result.summary || result.keyValues) {
        console.log('✅ Manual extraction recovered fields:', Object.keys(result).join(', '));
        return result;
    }

    return null;
}

function displayReportResults(result) {
    const container = document.getElementById('reportResults');
    container.style.display = 'block';

    // Summary
    document.getElementById('reportSummaryContent').innerHTML = `
        <p class="mb-10"><strong>Report Type:</strong> ${result.reportType || 'Medical Report'}</p>
        <p>${result.summary || ''}</p>
        ${result.patientFriendlyExplanation ? `<p class="mt-10" style="color: var(--accent-primary);">${result.patientFriendlyExplanation}</p>` : ''}
    `;

    // Key Values
    const valuesGrid = document.getElementById('reportValuesGrid');
    if (result.keyValues && result.keyValues.length > 0) {
        document.getElementById('reportValuesCard').style.display = 'block';
        valuesGrid.innerHTML = result.keyValues.map(val => {
            const statusColors = {
                normal: 'var(--accent-green)', low: 'var(--accent-yellow)',
                high: '#ff9500', critical: 'var(--accent-red)'
            };
            const status = (val.status || 'normal').toLowerCase();
            const color = statusColors[status] || 'var(--text-secondary)';
            return `
                <div class="value-item">
                    <div class="value-name">${val.name || 'N/A'}</div>
                    <div class="value-number" style="color: ${color}">${val.value || 'N/A'} ${val.unit || ''}</div>
                    <div class="value-status" style="color: ${color}">
                        ${status === 'normal' ? '✅' : status === 'critical' ? '🚨' : '⚠️'} 
                        ${status.toUpperCase()} ${val.normalRange ? `(Normal: ${val.normalRange})` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        document.getElementById('reportValuesCard').style.display = 'none';
    }

    // Lifestyle Recommendations
    const lifestyleGrid = document.getElementById('lifestyleGrid');
    if (result.lifestyle && result.lifestyle.length > 0) {
        document.getElementById('lifestyleCard').style.display = 'block';
        // Add emoji prefixes if not present
        const emojiMap = {
            'diet': '🍎', 'exercise': '🏃', 'sleep': '😴',
            'supplements': '💊', 'avoid': '⚠️', 'follow-up': '📅',
            'follow up': '📅', 'followup': '📅'
        };
        lifestyleGrid.innerHTML = result.lifestyle.map(item => {
            let category = item.category || '';
            // Add emoji if missing
            const catLower = category.toLowerCase();
            const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(category);
            if (!hasEmoji) {
                for (const [key, emoji] of Object.entries(emojiMap)) {
                    if (catLower.includes(key)) {
                        category = emoji + ' ' + category;
                        break;
                    }
                }
            }
            return `
                <div class="lifestyle-item">
                    <h4>${category}</h4>
                    <p>${item.recommendations || ''}</p>
                </div>
            `;
        }).join('');
    } else {
        document.getElementById('lifestyleCard').style.display = 'none';
    }

    // Concerns
    if (result.concerns && result.concerns.length > 0 && result.concerns[0]) {
        const concernsHTML = result.concerns.map(c => `<li>${c}</li>`).join('');
        // Check if we have a concerns card, if not create one dynamically
        let concernsCard = document.getElementById('reportConcernsCard');
        if (!concernsCard) {
            concernsCard = document.createElement('div');
            concernsCard.className = 'result-card glass-card';
            concernsCard.id = 'reportConcernsCard';
            const summaryCard = document.getElementById('reportSummaryCard');
            summaryCard.parentNode.insertBefore(concernsCard, summaryCard.nextSibling);
        }
        concernsCard.style.display = 'block';
        concernsCard.innerHTML = `
            <h3 style="color: var(--accent-red);">⚠️ Concerns</h3>
            <ul class="result-list red-list">${concernsHTML}</ul>
        `;
    }

    container.scrollIntoView({ behavior: 'smooth' });
    showToast('Report analysis complete!', 'success');

    // Auto-read results if TTS is enabled
    if (typeof ttsEnabled !== 'undefined' && ttsEnabled) {
        setTimeout(() => {
            let text = result.patientFriendlyExplanation || result.summary || 'Report analysis complete.';
            if (result.lifestyle && result.lifestyle.length > 0) {
                result.lifestyle.forEach(item => {
                    text += '. ' + item.category + ': ' + item.recommendations;
                });
            }
            speakText(text);
        }, 800);
    }
}

function displayRawReportResults(text) {
    // One more aggressive attempt to parse
    let cleaned = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json\s*/gi, '').replace(/```/g, '')
        .replace(/^json\s*/i, '')
        .trim();

    // Try manual extraction
    const extracted = extractFieldsManually(cleaned);
    if (extracted && (extracted.reportType || extracted.summary || extracted.keyValues)) {
        displayReportResults(extracted);
        lastDiagnosis = extracted;
        return;
    }

    // Try the standard parser one more time
    const lastTry = GeminiAPI.parseJSON(cleaned);
    if (lastTry) {
        displayReportResults(lastTry);
        lastDiagnosis = lastTry;
        return;
    }

    // Final fallback: format text nicely for display
    const container = document.getElementById('reportResults');
    container.style.display = 'block';

    // Strip JSON artifacts to make it readable
    let formatted = cleaned
        .replace(/[{}\[\]]/g, '')
        .replace(/"/g, '')
        .replace(/,\s*/g, '\n')
        .replace(/:\s*/g, ': ')
        .replace(/disclaimer:/gi, '⚠️ Note: ')
        .replace(/reportType:/gi, '📋 Report Type: ')
        .replace(/summary:/gi, '📝 Summary: ')
        .replace(/patientFriendlyExplanation:/gi, '💡 Explanation: ')
        .replace(/name:/gi, '• Test: ')
        .replace(/value:/gi, ' Value: ')
        .replace(/status:/gi, ' Status: ')
        .replace(/normalRange:/gi, ' Normal: ')
        .replace(/category:/gi, '\n🏷️ ')
        .replace(/recommendations:/gi, ': ')
        .replace(/\n+/g, '<br>')
        .trim();

    document.getElementById('reportSummaryContent').innerHTML = `<p style="line-height:1.8;">${formatted}</p>`;
    document.getElementById('reportValuesCard').style.display = 'none';
    document.getElementById('lifestyleCard').style.display = 'none';
    container.scrollIntoView({ behavior: 'smooth' });
    showToast('Analysis complete!', 'success');
}

function speakReportResults() {
    if (!lastDiagnosis) return;
    const text = lastDiagnosis.patientFriendlyExplanation || lastDiagnosis.summary || 'Report analysis complete.';
    speakText(text);
}

// ==================== PDF REPORT GENERATION ====================

function downloadReport() {
    if (!lastDiagnosis) {
        showToast('No results to download', 'error');
        return;
    }
    generatePDFReport(lastDiagnosis, 'scan');
}

function downloadReportPDF() {
    if (!lastDiagnosis) {
        showToast('No results to download', 'error');
        return;
    }
    generatePDFReport(lastDiagnosis, 'report');
}

async function generatePDFReport(data, type) {
    // Dynamically load jsPDF if needed
    if (!window.jspdf) {
        try {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
        } catch(e) { /* ignore */ }
    }
    if (!window.jspdf) {
        showToast('Could not load PDF library.', 'error');
        return;
    }

    // For English: use clean text-based PDF (looks professional)
    // For other languages: use html2canvas (supports Indic scripts)
    const isEnglish = CONFIG.currentLanguage === 'en';
    
    if (isEnglish) {
        generateSimplePDF(data, type);
        return;
    }

    // Non-English: need html2canvas for Indic script support
    // Try loading html2canvas from multiple CDNs if not already loaded
    if (typeof html2canvas === 'undefined') {
        const cdns = [
            'js/html2canvas.min.js',
            'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
            'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
        ];
        for (const cdn of cdns) {
            try {
                await loadScript(cdn);
                if (typeof html2canvas !== 'undefined') break;
            } catch(e) { /* try next */ }
        }
    }

    // If html2canvas still not available, fall back to text PDF
    if (typeof html2canvas === 'undefined') {
        showToast('Generating PDF (non-English text may not display correctly)...', 'warning');
        generateSimplePDF(data, type);
        return;
    }

    showToast('Generating PDF...', 'info');

    try {
        // Build a temporary styled container for html2canvas to render
        const tempDiv = document.createElement('div');
        tempDiv.id = 'pdf-render-container';
        tempDiv.style.cssText = `
            position: fixed; left: -9999px; top: 0;
            width: 800px; padding: 40px;
            background: #ffffff; color: #1a1a2e;
            font-family: 'Inter', 'Noto Sans', 'Noto Sans Kannada', 'Noto Sans Telugu', 'Noto Sans Tamil', 'Noto Sans Devanagari', sans-serif;
            font-size: 14px; line-height: 1.6;
        `;

        const langName = CONFIG.LANGUAGES[CONFIG.currentLanguage]?.name || 'English';
        const dateStr = new Date().toLocaleString('en-IN');
        const reportId = 'MS-' + Date.now().toString(36).toUpperCase();

        // Build HTML content
        let html = `
            <div style="background: linear-gradient(135deg, #050a18, #0a1628); padding: 24px 32px; border-radius: 12px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 28px; font-weight: 800; color: #06b6d4; font-family: 'Space Grotesk', sans-serif;">🏥 MediScan AI</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">AI-Powered Medical Diagnostic Report</div>
                    </div>
                    <div style="text-align: right; color: #94a3b8; font-size: 11px;">
                        <div>Generated: ${dateStr}</div>
                        <div>Report ID: ${reportId}</div>
                        <div>Language: ${langName}</div>
                    </div>
                </div>
            </div>

            <div style="background: #fff8dc; border: 1px solid #f0e68c; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <div style="font-weight: 700; color: #785000; font-size: 12px;">⚠️ DISCLAIMER</div>
                <div style="color: #785000; font-size: 11px;">This is an AI-assisted preliminary screening. This is NOT a medical diagnosis. Always consult a qualified healthcare professional.</div>
            </div>
        `;

        if (type === 'scan' || type === 'symptom') {
            // Diagnosis
            const condName = data.condition || data.conditions?.[0]?.name || 'N/A';
            html += `
                <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                    <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🩺 Diagnosis</div>
                    <div style="font-size: 22px; font-weight: 700; color: #0682a0; margin-bottom: 8px;">${condName}</div>
                    <div style="font-size: 13px; color: #555;">Severity: <strong>${data.severity || 'N/A'}</strong> &nbsp;|&nbsp; Health Score: <strong>${data.healthScore || 'N/A'}</strong>/100</div>
                </div>
            `;

            // Conditions (symptom type)
            if (data.conditions && data.conditions.length > 0) {
                html += `<div style="margin-bottom: 16px;">
                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">📋 Possible Conditions</div>`;
                data.conditions.forEach(c => {
                    html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 8px;">
                        <div style="font-weight: 600;">${c.name} <span style="color: #06b6d4;">(${c.likelihood}%)</span></div>
                        <div style="font-size: 12px; color: #666; margin-top: 4px;">${c.description || ''}</div>
                    </div>`;
                });
                html += `</div>`;
            }

            // Observations
            if (data.observations && data.observations.length > 0) {
                html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">🔍 Key Observations</div>
                    <ul style="margin: 0; padding-left: 20px;">`;
                data.observations.forEach(obs => html += `<li style="margin-bottom: 6px; color: #444;">${obs}</li>`);
                html += `</ul></div>`;
            }

            // Recommendations
            if (data.recommendations && data.recommendations.length > 0) {
                html += `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">💡 Recommendations</div>
                    <ul style="margin: 0; padding-left: 20px;">`;
                data.recommendations.forEach(rec => html += `<li style="margin-bottom: 6px; color: #444;">${rec}</li>`);
                html += `</ul></div>`;
            }

        } else if (type === 'report') {
            // Report type + summary
            html += `
                <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                    <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📋 Report Type</div>
                    <div style="font-size: 20px; font-weight: 700; color: #0682a0; margin-bottom: 12px;">${data.reportType || 'Medical Report'}</div>
                    <div style="font-size: 13px; color: #444;">${data.summary || ''}</div>
                    ${data.patientFriendlyExplanation ? `<div style="margin-top: 10px; padding: 10px; background: #e0f7fa; border-radius: 6px; color: #00838f; font-size: 13px;">${data.patientFriendlyExplanation}</div>` : ''}
                </div>
            `;

            // Key Values
            if (data.keyValues && data.keyValues.length > 0) {
                html += `<div style="margin-bottom: 16px;">
                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">🔢 Key Values</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
                const statusColors = { normal: '#16a34a', low: '#ca8a04', high: '#ea580c', critical: '#dc2626' };
                data.keyValues.forEach(val => {
                    const status = (val.status || 'normal').toLowerCase();
                    const color = statusColors[status] || '#666';
                    const icon = status === 'normal' ? '✅' : status === 'critical' ? '🚨' : '⚠️';
                    html += `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                        <div style="font-size: 11px; color: #888;">${val.name || 'N/A'}</div>
                        <div style="font-size: 18px; font-weight: 700; color: ${color};">${val.value || 'N/A'} ${val.unit || ''}</div>
                        <div style="font-size: 10px; color: ${color};">${icon} ${status.toUpperCase()} ${val.normalRange ? '(Normal: ' + val.normalRange + ')' : ''}</div>
                    </div>`;
                });
                html += `</div></div>`;
            }

            // Lifestyle
            if (data.lifestyle && data.lifestyle.length > 0) {
                html += `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin-bottom: 16px;">
                    <div style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">🏃 Lifestyle Recommendations</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">`;
                data.lifestyle.forEach(item => {
                    html += `<div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">${item.category || ''}</div>
                        <div style="font-size: 12px; color: #555;">${item.recommendations || ''}</div>
                    </div>`;
                });
                html += `</div></div>`;
            }
        }

        // Footer
        html += `
            <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 10px; color: #aaa;">MediScan AI — AI-Powered Medical Diagnostics | For preliminary screening only</div>
                <div style="font-size: 10px; color: #aaa;">Generated: ${dateStr}</div>
            </div>
        `;

        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv);

        // Render to canvas with html2canvas
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false
        });

        // Remove temp container
        document.body.removeChild(tempDiv);

        // Create PDF and add image
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pageHeight = 297; // A4 height in mm

        const doc = new jsPDF('p', 'mm', 'a4');
        let position = 0;
        let remainingHeight = imgHeight;

        // Add image, splitting across pages if needed
        while (remainingHeight > 0) {
            if (position > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, -position, imgWidth, imgHeight);
            remainingHeight -= pageHeight;
            position += pageHeight;
        }

        doc.save('MediScan_Report_' + new Date().toISOString().slice(0, 10) + '.pdf');
        showToast('PDF report downloaded!', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to generate PDF: ' + error.message, 'error');
    }
}

// Helper to load a script dynamically and return a promise
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Remove any failed previous attempts
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) existing.remove();
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load: ' + src));
        document.head.appendChild(script);
    });
}

// Fallback PDF generator using jsPDF only (for when html2canvas fails to load)
// Uses English labels with transliterated content where possible
function generateSimplePDF(data, type) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pw = doc.internal.pageSize.getWidth();
        const margin = 20;
        const maxW = pw - margin * 2;
        let y = 20;

        function checkPage(needed) {
            if (y + needed > 275) { doc.addPage(); y = 20; }
        }

        // Header
        doc.setFillColor(5, 10, 24);
        doc.rect(0, 0, pw, 38, 'F');
        doc.setTextColor(6, 182, 212);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('MediScan AI', margin, 22);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(9);
        doc.text('AI-Powered Medical Diagnostic Report', margin, 30);
        doc.setFontSize(8);
        doc.text('Generated: ' + new Date().toLocaleString('en-IN'), pw - margin, 22, { align: 'right' });
        y = 46;

        // Disclaimer
        doc.setFillColor(255, 248, 220);
        doc.roundedRect(margin, y, maxW, 12, 2, 2, 'F');
        doc.setTextColor(120, 80, 0);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('DISCLAIMER: AI-assisted screening only. NOT a medical diagnosis. Consult a healthcare professional.', margin + 4, y + 7);
        y += 20;
        doc.setTextColor(30, 30, 30);

        if (type === 'report') {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Report Analysis', margin, y);
            y += 10;

            if (data.reportType) {
                doc.setFontSize(10);
                doc.text('Report Type: ' + stripNonLatin(data.reportType), margin, y);
                y += 8;
            }
            if (data.summary) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                const lines = doc.splitTextToSize(stripNonLatin(data.summary), maxW);
                doc.text(lines, margin, y);
                y += lines.length * 5 + 6;
            }
            if (data.keyValues && data.keyValues.length > 0) {
                checkPage(15);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('Key Values', margin, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                data.keyValues.forEach(val => {
                    checkPage(6);
                    const icon = (val.status || '').toLowerCase() === 'normal' ? '[OK]' : '[!!]';
                    const line = `${icon} ${val.name}: ${val.value} ${val.unit || ''} (${val.status || 'N/A'}) [Normal: ${val.normalRange || 'N/A'}]`;
                    const lines = doc.splitTextToSize(line, maxW - 4);
                    doc.text(lines, margin + 4, y);
                    y += lines.length * 4 + 2;
                });
                y += 6;
            }
            if (data.lifestyle && data.lifestyle.length > 0) {
                checkPage(15);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('Lifestyle Recommendations', margin, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                data.lifestyle.forEach(item => {
                    checkPage(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(stripNonLatin(item.category || ''), margin + 4, y);
                    y += 5;
                    doc.setFont('helvetica', 'normal');
                    const lines = doc.splitTextToSize(stripNonLatin(item.recommendations || ''), maxW - 12);
                    doc.text(lines, margin + 8, y);
                    y += lines.length * 4 + 4;
                });
            }
        } else {
            const condName = data.condition || data.conditions?.[0]?.name || 'N/A';
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Diagnosis: ' + stripNonLatin(condName), margin, y);
            y += 8;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('Severity: ' + (data.severity || 'N/A') + '  |  Health Score: ' + (data.healthScore || 'N/A') + '/100', margin, y);
            y += 10;

            if (data.conditions && data.conditions.length > 0) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('Conditions', margin, y);
                y += 7;
                doc.setFontSize(9);
                data.conditions.forEach(c => {
                    checkPage(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(stripNonLatin(c.name) + ' (' + c.likelihood + '%)', margin + 4, y);
                    y += 5;
                    doc.setFont('helvetica', 'normal');
                    const lines = doc.splitTextToSize(stripNonLatin(c.description || ''), maxW - 8);
                    doc.text(lines, margin + 4, y);
                    y += lines.length * 4 + 4;
                });
            }

            if (data.observations && data.observations.length > 0) {
                checkPage(12);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('Observations', margin, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                data.observations.forEach(obs => {
                    checkPage(7);
                    const lines = doc.splitTextToSize('- ' + stripNonLatin(obs), maxW - 4);
                    doc.text(lines, margin + 4, y);
                    y += lines.length * 4 + 2;
                });
            }

            if (data.recommendations && data.recommendations.length > 0) {
                checkPage(12);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('Recommendations', margin, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                data.recommendations.forEach(rec => {
                    checkPage(7);
                    const lines = doc.splitTextToSize('- ' + stripNonLatin(rec), maxW - 4);
                    doc.text(lines, margin + 4, y);
                    y += lines.length * 4 + 2;
                });
            }
        }

        // Footer
        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text('MediScan AI | For preliminary screening only | Page ' + i + '/' + pages, pw / 2, 288, { align: 'center' });
        }

        doc.save('MediScan_Report_' + new Date().toISOString().slice(0, 10) + '.pdf');
        showToast('PDF downloaded! (Note: Non-English text may show as placeholders)', 'success');
    } catch (error) {
        console.error('Simple PDF error:', error);
        showToast('PDF generation failed: ' + error.message, 'error');
    }
}

// Strip non-Latin characters (fallback for when html2canvas is unavailable)
function stripNonLatin(text) {
    if (!text) return '';
    // Keep ASCII, basic punctuation, numbers — replace others with '?'
    // But first, try to keep the text as-is (jsPDF will just show blanks for unsupported chars)
    return text;
}

