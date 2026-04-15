// ================================================
// MediScan AI — Blood Bank / Donor Network
// ================================================

let donorMap = null;
let donorMarkers = [];
let allDonors = [];

// Sample donor data (for demo — in production this would be a database)
const SAMPLE_DONORS = [
    { name: "Rahul Sharma", blood: "A+", phone: "+91 98765 43210", lat: 17.3850, lng: 78.4867, distance: "0.8 km" },
    { name: "Priya Reddy", blood: "O+", phone: "+91 98765 43211", lat: 17.3900, lng: 78.4900, distance: "1.2 km" },
    { name: "Amit Kumar", blood: "B+", phone: "+91 98765 43212", lat: 17.3780, lng: 78.4950, distance: "1.5 km" },
    { name: "Sneha Patel", blood: "AB+", phone: "+91 98765 43213", lat: 17.3920, lng: 78.4800, distance: "1.8 km" },
    { name: "Vikram Singh", blood: "O-", phone: "+91 98765 43214", lat: 17.3750, lng: 78.4820, distance: "2.1 km" },
    { name: "Ananya Rao", blood: "A-", phone: "+91 98765 43215", lat: 17.3960, lng: 78.4750, distance: "2.4 km" },
    { name: "Karthik Nair", blood: "B-", phone: "+91 98765 43216", lat: 17.3700, lng: 78.4900, distance: "2.8 km" },
    { name: "Meera Joshi", blood: "O+", phone: "+91 98765 43217", lat: 17.3880, lng: 78.5000, distance: "3.0 km" },
    { name: "Suresh Reddy", blood: "A+", phone: "+91 98765 43218", lat: 17.4000, lng: 78.4850, distance: "3.2 km" },
    { name: "Lakshmi Devi", blood: "B+", phone: "+91 98765 43219", lat: 17.3650, lng: 78.4780, distance: "3.5 km" },
    { name: "Ravi Teja", blood: "AB-", phone: "+91 98765 43220", lat: 17.3820, lng: 78.5050, distance: "3.8 km" },
    { name: "Divya Kumari", blood: "O+", phone: "+91 98765 43221", lat: 17.4050, lng: 78.4700, distance: "4.0 km" },
    { name: "Arun Prasad", blood: "A+", phone: "+91 98765 43222", lat: 17.3580, lng: 78.4900, distance: "4.2 km" },
    { name: "Pooja Sharma", blood: "B-", phone: "+91 98765 43223", lat: 17.3950, lng: 78.5100, distance: "4.5 km" },
    { name: "Manoj Kumar", blood: "O-", phone: "+91 98765 43224", lat: 17.3500, lng: 78.4850, distance: "4.8 km" },
    { name: "Kavitha Rani", blood: "AB+", phone: "+91 98765 43225", lat: 17.4100, lng: 78.4950, distance: "5.0 km" },
    { name: "Venkat Rao", blood: "A-", phone: "+91 98765 43226", lat: 17.3620, lng: 78.4650, distance: "5.2 km" },
    { name: "Swathi Nair", blood: "B+", phone: "+91 98765 43227", lat: 17.4020, lng: 78.5050, distance: "5.5 km" },
    { name: "Ganesh Reddy", blood: "O+", phone: "+91 98765 43228", lat: 17.3450, lng: 78.4750, distance: "5.8 km" },
    { name: "Bhavani Sri", blood: "A+", phone: "+91 98765 43229", lat: 17.4150, lng: 78.4800, distance: "6.0 km" },
    { name: "Rajesh Khanna", blood: "B+", phone: "+91 98765 43230", lat: 17.3550, lng: 78.5000, distance: "6.2 km" },
    { name: "Sanjay Gupta", blood: "O-", phone: "+91 98765 43231", lat: 17.4080, lng: 78.4680, distance: "6.5 km" },
    { name: "Neha Agarwal", blood: "AB+", phone: "+91 98765 43232", lat: 17.3720, lng: 78.5120, distance: "6.8 km" },
    { name: "Deepak Verma", blood: "A-", phone: "+91 98765 43233", lat: 17.4200, lng: 78.4920, distance: "7.0 km" }
];

function initBloodBankMap() {
    // Add custom registered donors from localStorage
    const registeredDonors = JSON.parse(localStorage.getItem('mediscan_donors') || '[]');
    allDonors = [...SAMPLE_DONORS, ...registeredDonors];

    // Update donor count on home
    document.getElementById('donorCount').textContent = allDonors.length;

    if (donorMap) {
        donorMap.invalidateSize();
        return;
    }

    // Try to get user location, fallback to Hyderabad
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                createMap(pos.coords.latitude, pos.coords.longitude);
            },
            () => {
                // Fallback to Hyderabad center
                createMap(17.3850, 78.4867);
            }
        );
    } else {
        createMap(17.3850, 78.4867);
    }

    // Populate donor list
    renderDonorList(allDonors);
}

function createMap(lat, lng) {
    donorMap = L.map('donorMap', {
        zoomControl: true,
        attributionControl: false
    }).setView([lat, lng], 13);

    // Dark theme map tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(donorMap);

    // Add user location marker
    const userIcon = L.divIcon({
        html: '<div style="background: #06b6d4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(6,182,212,0.5);"></div>',
        className: 'user-marker',
        iconSize: [16, 16]
    });
    L.marker([lat, lng], { icon: userIcon }).addTo(donorMap)
        .bindPopup('<strong>📍 Your Location</strong>');

    // Add donor markers
    addDonorMarkers(allDonors);
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
            }
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
