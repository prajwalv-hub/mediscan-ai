// ================================================
// MediScan AI — Camera Integration
// ================================================

let cameraStream = null;
let facingMode = 'environment'; // 'user' for front camera

async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('cameraFeed');
        video.srcObject = cameraStream;

        document.getElementById('startCameraBtn').style.display = 'none';
        document.getElementById('captureBtn').style.display = 'inline-flex';
        document.getElementById('switchCameraBtn').style.display = 'inline-flex';
        document.getElementById('cameraContainer').classList.add('scanning');

        showToast('Camera started!', 'success');
    } catch (err) {
        console.error('Camera error:', err);
        showToast('Could not access camera. Please allow camera permission.', 'error');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        document.getElementById('cameraFeed').srcObject = null;
        document.getElementById('cameraContainer').classList.remove('scanning');
    }
}

async function switchCamera() {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    await startCamera();
}

function captureImage() {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Get base64 data
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    currentImageData = dataUrl.split(',')[1];
    currentImageMime = 'image/jpeg';

    // Show preview
    document.getElementById('imagePreview').src = dataUrl;
    document.getElementById('imagePreviewContainer').style.display = 'block';
    document.getElementById('analyzeBtn').disabled = false;

    // Stop camera and switch to upload tab view
    stopCamera();
    switchScannerTab('upload');
    document.getElementById('uploadArea').style.display = 'none';

    showToast('Image captured!', 'success');
}
