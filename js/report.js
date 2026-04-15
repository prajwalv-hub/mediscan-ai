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

    const prompt = `Analyze this medical report image. Extract all key medical values, provide a summary, and give personalized lifestyle recommendations.

Respond in ${langName}. Provide your analysis in this exact JSON format:
{
    "disclaimer": "This is an AI-assisted analysis. Please verify with your doctor.",
    "reportType": "Type of report (e.g., Blood Test, X-Ray Report, etc.)",
    "summary": "Brief overall summary of the report findings",
    "keyValues": [
        {"name": "Test/Value name", "value": "measured value", "unit": "unit", "status": "normal|low|high|critical", "normalRange": "normal range"},
        {"name": "Another test", "value": "value", "unit": "unit", "status": "normal|low|high", "normalRange": "range"}
    ],
    "concerns": ["Any concerning values or findings"],
    "lifestyle": [
        {"category": "🍎 Diet", "recommendations": "Specific food recommendations based on the report"},
        {"category": "🏃 Exercise", "recommendations": "Exercise recommendations"},
        {"category": "😴 Sleep", "recommendations": "Sleep recommendations"},
        {"category": "💊 Supplements", "recommendations": "Supplement recommendations if needed"},
        {"category": "⚠️ Avoid", "recommendations": "Things to avoid based on report"},
        {"category": "📅 Follow-up", "recommendations": "When to retest or see a doctor"}
    ],
    "patientFriendlyExplanation": "Simple explanation in ${langName}"
}

IMPORTANT: Return ONLY valid JSON.`;

    try {
        const response = await GeminiAPI.sendImageAndText(currentReportData, currentReportMime, prompt);
        const result = GeminiAPI.parseJSON(response);

        if (result) {
            displayReportResults(result);
            saveScanToHistory({
                type: 'report',
                title: result.reportType || 'Medical Report',
                condition: result.reportType,
                date: new Date().toISOString()
            });
            lastDiagnosis = result;
        } else {
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
    valuesGrid.innerHTML = (result.keyValues || []).map(val => {
        const statusColors = {
            normal: 'var(--accent-green)', low: 'var(--accent-yellow)',
            high: '#ff9500', critical: 'var(--accent-red)'
        };
        const color = statusColors[val.status] || 'var(--text-secondary)';
        return `
            <div class="value-item">
                <div class="value-name">${val.name}</div>
                <div class="value-number" style="color: ${color}">${val.value} ${val.unit || ''}</div>
                <div class="value-status" style="color: ${color}">
                    ${val.status === 'normal' ? '✅' : val.status === 'critical' ? '🚨' : '⚠️'} 
                    ${val.status?.toUpperCase()} ${val.normalRange ? `(Normal: ${val.normalRange})` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Lifestyle Recommendations
    const lifestyleGrid = document.getElementById('lifestyleGrid');
    lifestyleGrid.innerHTML = (result.lifestyle || []).map(item => `
        <div class="lifestyle-item">
            <h4>${item.category}</h4>
            <p>${item.recommendations}</p>
        </div>
    `).join('');

    container.scrollIntoView({ behavior: 'smooth' });
    showToast('Report analysis complete!', 'success');
}

function displayRawReportResults(text) {
    const container = document.getElementById('reportResults');
    container.style.display = 'block';
    document.getElementById('reportSummaryContent').innerHTML = `<p>${text}</p>`;
    container.scrollIntoView({ behavior: 'smooth' });
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

function generatePDFReport(data, type) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const pageWidth = doc.internal.pageSize.getWidth();
        let y = 20;

        // Header
        doc.setFillColor(5, 10, 24);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(6, 182, 212);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('MediScan AI', 20, 25);

        doc.setTextColor(148, 163, 184);
        doc.setFontSize(10);
        doc.text('AI-Powered Medical Diagnostic Report', 20, 33);

        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 20, 25, { align: 'right' });
        doc.text(`Report ID: MS-${Date.now().toString(36).toUpperCase()}`, pageWidth - 20, 33, { align: 'right' });

        y = 50;

        // Disclaimer
        doc.setFillColor(40, 40, 20);
        doc.roundedRect(15, y, pageWidth - 30, 16, 3, 3, 'F');
        doc.setTextColor(245, 158, 11);
        doc.setFontSize(8);
        doc.text('⚕️ DISCLAIMER: This is an AI-assisted preliminary screening. This is NOT a medical diagnosis.', 20, y + 7);
        doc.text('Always consult a qualified healthcare professional for medical advice.', 20, y + 12);

        y += 24;
        doc.setTextColor(30, 30, 30);

        if (type === 'scan' || type === 'symptom') {
            // Diagnosis
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Diagnosis', 20, y);
            y += 8;

            doc.setFontSize(18);
            doc.setTextColor(6, 182, 212);
            doc.text(data.condition || data.conditions?.[0]?.name || 'N/A', 20, y);
            y += 10;

            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text(`Confidence: ${data.confidence || 'N/A'}%  |  Severity: ${data.severity || 'N/A'}  |  Health Score: ${data.healthScore || 'N/A'}/100`, 20, y);
            y += 12;

            // Observations
            if (data.observations) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 30, 30);
                doc.text('Key Observations', 20, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                data.observations.forEach(obs => {
                    doc.text('• ' + obs, 24, y);
                    y += 6;
                });
                y += 4;
            }

            // Recommendations
            if (data.recommendations) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Recommendations', 20, y);
                y += 7;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                data.recommendations.forEach(rec => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.text('• ' + rec, 24, y);
                    y += 6;
                });
            }
        } else if (type === 'report') {
            // Report analysis
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Report Analysis: ' + (data.reportType || 'Medical Report'), 20, y);
            y += 10;

            if (data.summary) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                const summaryLines = doc.splitTextToSize(data.summary, pageWidth - 40);
                doc.text(summaryLines, 20, y);
                y += summaryLines.length * 5 + 8;
            }

            // Key Values
            if (data.keyValues && data.keyValues.length > 0) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Key Values', 20, y);
                y += 8;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                data.keyValues.forEach(val => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    const statusIcon = val.status === 'normal' ? '✓' : '!';
                    doc.text(`${statusIcon} ${val.name}: ${val.value} ${val.unit || ''} (${val.status}) [Normal: ${val.normalRange || 'N/A'}]`, 24, y);
                    y += 5;
                });
                y += 6;
            }

            // Lifestyle
            if (data.lifestyle) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('Lifestyle Recommendations', 20, y);
                y += 8;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                data.lifestyle.forEach(item => {
                    if (y > 265) { doc.addPage(); y = 20; }
                    doc.setFont('helvetica', 'bold');
                    doc.text(item.category, 24, y);
                    y += 5;
                    doc.setFont('helvetica', 'normal');
                    const lines = doc.splitTextToSize(item.recommendations, pageWidth - 50);
                    doc.text(lines, 28, y);
                    y += lines.length * 4.5 + 4;
                });
            }
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150, 150, 150);
            doc.text('MediScan AI — AI-Powered Medical Diagnostics | For preliminary screening only', pageWidth / 2, 290, { align: 'center' });
        }

        doc.save(`MediScan_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('PDF report downloaded!', 'success');
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to generate PDF: ' + error.message, 'error');
    }
}
