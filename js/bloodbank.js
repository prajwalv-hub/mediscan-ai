// ================================================
// MediScan AI — Blood Bank / Donor Network
// Features: Live GPS location, interactive map, donor registration
// ================================================

let donorMap = null;
let donorMarkers = [];
let allDonors = [];
let userLocationMarker = null;
let userAccuracyCircle = null;
let locationWatchId = null;

// Generate sample donors around any location (for demo purposes)
const DONOR_NAMES = [
    "Rahul Sharma", "Priya Reddy", "Amit Kumar", "Sneha Patel", "Vikram Singh",
    "Ananya Rao", "Karthik Nair", "Meera Joshi", "Suresh Reddy", "Lakshmi Devi",
    "Ravi Teja", "Divya Kumari", "Arun Prasad", "Pooja Sharma", "Manoj Kumar",
    "Kavitha Rani", "Venkat Rao", "Swathi Nair", "Ganesh Reddy", "Bhavani Sri",
    "Rajesh Khanna", "Sanjay Gupta", "Neha Agarwal", "Deepak Verma"
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function generateDonorsNearLocation(lat, lng) {
    return DONOR_NAMES.map((name, i) => {
        const angle = (i / DONOR_NAMES.length) * Math.PI * 2;
        const radius = 0.005 + Math.random() * 0.03; // 0.5km to 3km spread
        const dLat = lat + Math.cos(angle) * radius + (Math.random() - 0.5) * 0.01;
        const dLng = lng + Math.sin(angle) * radius + (Math.random() - 0.5) * 0.01;
        const dist = (radius * 111).toFixed(1); // rough km conversion
        return {
            name,
            blood: BLOOD_GROUPS[i % BLOOD_GROUPS.length],
            phone: `+91 98765 ${43210 + i}`,
            lat: dLat,
            lng: dLng,
            distance: dist + ' km'
        };
    });
}

function initBloodBankMap() {
    const registeredDonors = JSON.parse(localStorage.getItem('mediscan_donors') || '[]');

    if (donorMap) {
        // Stop any previous location watch
        if (locationWatchId) {
            navigator.geolocation.clearWatch(locationWatchId);
            locationWatchId = null;
        }
        donorMap.remove();
        donorMap = null;
        userLocationMarker = null;
        userAccuracyCircle = null;
    }

    showToast('📍 Getting your live location...', 'info');

    if (navigator.geolocation) {
        // First, get current position quickly
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const accuracy = pos.coords.accuracy;
                console.log(`📍 Location: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
                showToast(`📍 Location found! Accuracy: ${Math.round(accuracy)}m`, 'success');

                allDonors = [...generateDonorsNearLocation(lat, lng), ...registeredDonors];
                document.getElementById('donorCount').textContent = allDonors.length;
                createMap(lat, lng, accuracy);
                renderDonorList(allDonors);

                // Start watching for live location updates
                startLocationWatch();
            },
            (err) => {
                console.warn('Geolocation error:', err.message);
                let msg = 'Location access denied.';
                if (err.code === 1) msg = '📍 Location blocked! Please allow location in browser settings.';
                else if (err.code === 2) msg = '📍 Location unavailable. Using default location.';
                else if (err.code === 3) msg = '📍 Location timed out. Using default location.';
                showToast(msg, 'warning');

                // Fallback to Hyderabad
                allDonors = [...generateDonorsNearLocation(17.3850, 78.4867), ...registeredDonors];
                document.getElementById('donorCount').textContent = allDonors.length;
                createMap(17.3850, 78.4867, 5000);
                renderDonorList(allDonors);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 30000
            }
        );
    } else {
        showToast('Geolocation not supported', 'error');
        allDonors = [...generateDonorsNearLocation(17.3850, 78.4867), ...registeredDonors];
        document.getElementById('donorCount').textContent = allDonors.length;
        createMap(17.3850, 78.4867, 5000);
        renderDonorList(allDonors);
    }
}

function startLocationWatch() {
    if (!navigator.geolocation) return;

    locationWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;
            console.log(`📍 Live update: ${lat.toFixed(5)}, ${lng.toFixed(5)} (${Math.round(accuracy)}m)`);

            updateUserLocation(lat, lng, accuracy);
        },
        (err) => {
            console.warn('Watch position error:', err.message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        }
    );
}

function updateUserLocation(lat, lng, accuracy) {
    if (!donorMap) return;

    // Update user marker position
    if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lng]);
    }

    // Update accuracy circle
    if (userAccuracyCircle) {
        userAccuracyCircle.setLatLng([lat, lng]);
        userAccuracyCircle.setRadius(accuracy);
    }
}

function createMap(lat, lng, accuracy) {
    donorMap = L.map('donorMap', {
        zoomControl: true,
        attributionControl: false
    }).setView([lat, lng], 14);

    // OpenStreetMap tiles — works directly from localhost
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(donorMap);

    // Accuracy circle (shows GPS accuracy)
    userAccuracyCircle = L.circle([lat, lng], {
        radius: accuracy || 100,
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.08,
        weight: 1,
        opacity: 0.3
    }).addTo(donorMap);

    // User location marker with pulsing animation
    const userIcon = L.divIcon({
        html: `<div class="live-location-marker">
            <div class="live-pulse-ring"></div>
            <div class="live-pulse-ring" style="animation-delay: 0.5s;"></div>
            <div class="live-dot"></div>
        </div>`,
        className: 'user-marker-container',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    userLocationMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(donorMap)
        .bindPopup(`<strong>📍 Your Live Location</strong><br><small>Accuracy: ~${Math.round(accuracy || 100)}m</small>`);

    // Add donor markers
    addDonorMarkers(allDonors);

    // Re-center button
    addRecenterButton(lat, lng);
}

function addRecenterButton(lat, lng) {
    const recenterBtn = L.control({ position: 'bottomright' });
    recenterBtn.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar');
        div.innerHTML = `<a href="#" title="Re-center on my location" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:white;font-size:18px;text-decoration:none;" onclick="event.preventDefault();recenterMap()">📍</a>`;
        return div;
    };
    recenterBtn.addTo(donorMap);
}

function recenterMap() {
    if (userLocationMarker && donorMap) {
        donorMap.setView(userLocationMarker.getLatLng(), 14, { animate: true });
        showToast('📍 Re-centered on your location', 'info');
    }
}

function addDonorMarkers(donors) {
    // Clear existing markers
    donorMarkers.forEach(m => donorMap.removeLayer(m));
    donorMarkers = [];

    donors.forEach(donor => {
        const bloodColors = {
            'A+': '#ef4444', 'A-': '#f87171', 'B+': '#3b82f6', 'B-': '#60a5fa',
            'AB+': '#8b5cf6', 'AB-': '#a78bfa', 'O+': '#10b981', 'O-': '#34d399'
        };
        const color = bloodColors[donor.blood] || '#ef4444';

        const icon = L.divIcon({
            html: `<div style="background: ${color}; color: white; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; font-family: Inter, sans-serif; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.3);">${donor.blood}</div>`,
            className: 'donor-marker',
            iconSize: [40, 24],
            iconAnchor: [20, 12]
        });

        const marker = L.marker([donor.lat, donor.lng], { icon: icon }).addTo(donorMap);
        marker.bindPopup(`
            <div style="font-family: Inter, sans-serif; min-width: 180px;">
                <strong style="font-size: 14px;">${donor.name}</strong><br>
                <span style="color: ${color}; font-weight: 700;">🩸 ${donor.blood}</span><br>
                <span style="color: #666;">📍 ${donor.distance} away</span><br>
                <a href="tel:${donor.phone}" style="display: inline-block; margin-top: 8px; padding: 6px 14px; background: #10b981; color: white; border-radius: 20px; text-decoration: none; font-size: 12px; font-weight: 600;">📞 Call Donor</a>
            </div>
        `);

        marker.donorData = donor;
        donorMarkers.push(marker);
    });
}

function filterDonors(bloodGroup) {
    // Update active button
    document.querySelectorAll('.blood-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === bloodGroup || (bloodGroup === 'all' && btn.textContent === 'All'));
    });

    let filtered = allDonors;
    if (bloodGroup !== 'all') {
        filtered = allDonors.filter(d => d.blood === bloodGroup);
    }

    addDonorMarkers(filtered);
    renderDonorList(filtered);

    if (filtered.length === 0) {
        showToast(`No ${bloodGroup} donors found nearby`, 'warning');
    } else {
        showToast(`Showing ${filtered.length} ${bloodGroup === 'all' ? '' : bloodGroup + ' '}donors`, 'info');
    }
}

function renderDonorList(donors) {
    const container = document.getElementById('donorList');
    if (donors.length === 0) {
        container.innerHTML = '<p class="text-muted text-center" style="padding: 20px;">No donors found</p>';
        return;
    }

    container.innerHTML = donors.slice(0, 10).map(donor => `
        <div class="donor-item">
            <div class="donor-blood">${donor.blood}</div>
            <div class="donor-info">
                <div class="name">${donor.name}</div>
                <div class="distance">📍 ${donor.distance} away</div>
            </div>
            <a href="tel:${donor.phone}" class="donor-call-btn">📞 Call</a>
        </div>
    `).join('');
}

function registerDonor() {
    const name = document.getElementById('donorName').value.trim();
    const blood = document.getElementById('donorBloodGroup').value;
    const phone = document.getElementById('donorPhone').value.trim();
    const consent = document.getElementById('donorConsent').checked;

    if (!name || !blood || !phone) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    if (!consent) {
        showToast('Please give your consent to register', 'error');
        return;
    }

    // Get approximate location
    if (navigator.geolocation) {
        showToast('📍 Getting your location for registration...', 'info');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                // Add small random offset for privacy (approximate location)
                const lat = pos.coords.latitude + (Math.random() - 0.5) * 0.01;
                const lng = pos.coords.longitude + (Math.random() - 0.5) * 0.01;

                const donor = { name, blood, phone, lat, lng, distance: "< 1 km" };

                // Save to localStorage
                const donors = JSON.parse(localStorage.getItem('mediscan_donors') || '[]');
                donors.push(donor);
                localStorage.setItem('mediscan_donors', JSON.stringify(donors));

                // Add to current list
                allDonors.push(donor);
                addDonorMarkers(allDonors);
                renderDonorList(allDonors);

                // Clear form
                document.getElementById('donorName').value = '';
                document.getElementById('donorBloodGroup').value = '';
                document.getElementById('donorPhone').value = '';
                document.getElementById('donorConsent').checked = false;

                showToast('🩸 Registered as donor! Thank you for saving lives!', 'success');
            },
            () => {
                showToast('Could not get your location. Please allow location access.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        showToast('Location not supported in this browser', 'error');
    }
}

function requestBlood() {
    const bloodGroup = prompt('Which blood group do you need? (e.g., A+, B-, O+)');
    if (bloodGroup) {
        filterDonors(bloodGroup.toUpperCase());
        showToast(`🚨 Showing ${bloodGroup.toUpperCase()} donors near you`, 'warning');
    }
}
