// ================================================
// MediScan AI — Main App Logic
// ================================================

// Mobile menu toggle
function toggleMobileMenu() {
    const panel = document.getElementById('mobileMenuPanel');
    if (panel) panel.classList.toggle('open');
}

// Close mobile menu when tapping outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('mobileMenuPanel');
    const btn = document.getElementById('mobileMenuBtn');
    if (panel && panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
    }
});

// State
let currentPage = 'home';
let currentImageData = null;
let currentImageMime = null;
let currentReportData = null;
let currentReportMime = null;
let lastDiagnosis = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const loadingFill = document.getElementById('loadingBarFill');
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 25;
        if (progress > 100) progress = 100;
        loadingFill.style.width = progress + '%';
        if (progress >= 100) {
            clearInterval(loadingInterval);
            setTimeout(() => {
                document.getElementById('loadingScreen').classList.add('hidden');
                if (CONFIG.isDeployed) {
                    // On Vercel: API key is on server, skip to disclaimer
                    document.getElementById('disclaimerModal').style.display = 'flex';
                } else if (!CONFIG.API_KEY) {
                    // Local: need API key from user
                    document.getElementById('apiKeyModal').style.display = 'flex';
                } else {
                    document.getElementById('disclaimerModal').style.display = 'flex';
                }
            }, 500);
        }
    }, 200);

    setupDragAndDrop('uploadArea', 'imageInput');
    setupDragAndDrop('reportUploadArea', 'reportInput');
    updateHomeStats();
    loadRecentActivity();

    // Sync language dropdown with stored preference
    const langDropdown = document.getElementById('languageSelect');
    if (langDropdown) {
        langDropdown.value = CONFIG.currentLanguage;
    }
}

// ==================== API KEY & DISCLAIMER ====================

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) { showToast('Please enter your API key', 'error'); return; }
    localStorage.setItem('mediscan_api_key', key);
    CONFIG.API_KEY = key;
    document.getElementById('apiKeyModal').style.display = 'none';
    document.getElementById('disclaimerModal').style.display = 'flex';
    showToast('API key saved!', 'success');
}

function acceptDisclaimer() {
    document.getElementById('disclaimerModal').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
}

// ==================== NAVIGATION ====================

function navigateTo(page) {
    // Update current page
    currentPage = page;

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    const targetPage = document.getElementById('page-' + page);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Special init for pages
    if (page === 'bloodbank') {
        setTimeout(() => initBloodBankMap(), 100);
    }
    if (page === 'history') {
        loadHistory();
    }

    // Scroll to top
    document.querySelector('.main-content').scrollTo(0, 0);
}

// ==================== SCANNER TAB SWITCHING ====================

function switchScannerTab(tab) {
    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById('tab-' + tab).classList.add('active');

    // Stop camera if switching away
    if (tab !== 'camera') {
        stopCamera();
    }
}

// ==================== IMAGE UPLOAD ====================

function setupDragAndDrop(areaId, inputId) {
    const area = document.getElementById(areaId);
    if (!area) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        area.addEventListener(eventName, () => area.classList.add('drag-over'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, () => area.classList.remove('drag-over'));
    });

    area.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const input = document.getElementById(inputId);
            input.files = files;
            input.dispatchEvent(new Event('change'));
        }
    });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('Image must be under 10MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Full = e.target.result;
        currentImageData = base64Full.split(',')[1];
        currentImageMime = file.type;

        // Show preview
        document.getElementById('imagePreview').src = base64Full;
        document.getElementById('imagePreviewContainer').style.display = 'block';
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('analyzeBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearImage() {
    currentImageData = null;
    currentImageMime = null;
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('imageInput').value = '';
    document.getElementById('analyzeBtn').disabled = true;
}

// ==================== REPORT UPLOAD ====================

function handleReportUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Full = e.target.result;
        currentReportData = base64Full.split(',')[1];
        currentReportMime = file.type;

        document.getElementById('reportPreview').src = base64Full;
        document.getElementById('reportPreviewContainer').style.display = 'block';
        document.getElementById('reportUploadArea').style.display = 'none';
        document.getElementById('reportAnalyzeBtn').disabled = false;
    };
    reader.readAsDataURL(file);
}

function clearReport() {
    currentReportData = null;
    currentReportMime = null;
    document.getElementById('reportPreviewContainer').style.display = 'none';
    document.getElementById('reportUploadArea').style.display = 'block';
    document.getElementById('reportInput').value = '';
    document.getElementById('reportAnalyzeBtn').disabled = true;
}

// ==================== LANGUAGE ====================

function changeLanguage(lang) {
    CONFIG.currentLanguage = lang;
    localStorage.setItem('mediscan_lang', lang);
    const langName = CONFIG.LANGUAGES[lang]?.name || 'English';
    showToast('🌍 Language: ' + langName + ' — AI will now respond in ' + langName, 'success');

    // Stop voice/TTS if active
    if (typeof isRecording !== 'undefined' && isRecording) fullStopRecording();
    if (typeof stopSpeaking === 'function') stopSpeaking();

    // Clear previous diagnosis so next analysis uses the new language
    lastDiagnosis = null;

    // Update the dropdown to match
    const dropdown = document.getElementById('languageSelect');
    if (dropdown) dropdown.value = lang;
}

// ==================== UTILITY FUNCTIONS ====================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateHomeStats() {
    const history = JSON.parse(localStorage.getItem('mediscan_history') || '[]');
    document.getElementById('totalScans').textContent = history.length;

    if (history.length > 0) {
        const scores = history.filter(h => h.healthScore).map(h => h.healthScore);
        if (scores.length > 0) {
            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            document.getElementById('avgScore').textContent = avg;
        }
    }
}

function loadRecentActivity() {
    const history = JSON.parse(localStorage.getItem('mediscan_history') || '[]');
    const container = document.getElementById('recentActivity');

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>No scans yet. Start your first scan above!</p>
            </div>
        `;
        return;
    }

    const recent = history.slice(-3).reverse();
    container.innerHTML = recent.map(item => `
        <div class="history-item">
            <div class="history-type-icon">${item.type === 'image' ? '🔬' : item.type === 'symptom' ? '🩺' : '📑'}</div>
            <div class="history-details">
                <div class="history-title">${item.condition || item.title || 'Analysis'}</div>
                <div class="history-meta">${formatDate(item.date)} • ${item.severity || 'N/A'}</div>
            </div>
            ${item.healthScore ? `<div class="history-score">${item.healthScore}</div>` : ''}
        </div>
    `).join('');
}

function newScan() {
    clearImage();
    document.getElementById('scannerResults').style.display = 'none';
    document.getElementById('scannerSymptoms').value = '';
    switchScannerTab('upload');
}

function newSymptomCheck() {
    document.getElementById('symptomsInput').value = '';
    document.getElementById('symptomsResults').style.display = 'none';
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
}

function shareLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                if (navigator.share) {
                    navigator.share({
                        title: '🚨 Emergency - MediScan AI',
                        text: 'I need immediate medical help! My location:',
                        url: mapUrl
                    });
                } else {
                    navigator.clipboard.writeText(mapUrl);
                    showToast('Location link copied to clipboard!', 'success');
                }
            },
            () => showToast('Could not get location', 'error')
        );
    }
}
