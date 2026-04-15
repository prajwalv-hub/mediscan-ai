// ================================================
// MediScan AI — LocalStorage & History Management
// ================================================

function saveScanToHistory(scanData) {
    const history = JSON.parse(localStorage.getItem('mediscan_history') || '[]');
    history.push(scanData);
    
    // Keep last 50 scans only
    if (history.length > 50) {
        history.splice(0, history.length - 50);
    }
    
    localStorage.setItem('mediscan_history', JSON.stringify(history));
    
    // Update home stats
    updateHomeStats();
    loadRecentActivity();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('mediscan_history') || '[]');
    const container = document.getElementById('historyList');

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>No history yet. Complete a scan to see it here.</p>
            </div>
        `;
        return;
    }

    const typeIcons = {
        image: '🔬',
        symptom: '🩺',
        report: '📑'
    };

    const typeLabels = {
        image: 'Image Scan',
        symptom: 'Symptom Check',
        report: 'Report Analysis'
    };

    container.innerHTML = history.slice().reverse().map((item, i) => `
        <div class="history-item" style="animation-delay: ${i * 0.05}s;">
            <div class="history-type-icon">${typeIcons[item.type] || '📋'}</div>
            <div class="history-details">
                <div class="history-title">${item.condition || item.title || 'Analysis'}</div>
                <div class="history-meta">
                    ${typeLabels[item.type] || 'Scan'} • ${formatDate(item.date)}
                    ${item.severity ? ` • <span class="badge badge-${item.severity === 'Low' ? 'green' : item.severity === 'Moderate' ? 'yellow' : 'red'}">${item.severity}</span>` : ''}
                </div>
            </div>
            ${item.healthScore ? `<div class="history-score">${item.healthScore}</div>` : ''}
        </div>
    `).join('');
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        localStorage.removeItem('mediscan_history');
        loadHistory();
        updateHomeStats();
        loadRecentActivity();
        showToast('History cleared', 'info');
    }
}
