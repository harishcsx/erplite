const loginForm = document.getElementById('login-form');
const erpUrlInput = document.getElementById('erp-url');
const portalFrame = document.getElementById('portal-frame');
const dashboard = document.getElementById('dashboard');
const loginSection = document.getElementById('login-section');
const appNav = document.getElementById('app-nav');
const loader = document.getElementById('loader');

let currentSessionId = localStorage.getItem('unilite_session');

async function initSession() {
    if (!currentSessionId) {
        const res = await fetch('/api/session/new');
        const data = await res.json();
        currentSessionId = data.sessionId;
        localStorage.setItem('unilite_session', currentSessionId);
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await initSession();

    const url = erpUrlInput.value;
    showLoader(true);

    try {
        const proxyUrl = `/proxy?url=${encodeURIComponent(url)}&sessionId=${currentSessionId}`;
        const response = await fetch(proxyUrl);

        if (response.status === 401) {
            handleSessionExpired();
            return;
        }

        const html = await response.text();
        renderIframe(html);

        loginSection.classList.add('hidden');
        dashboard.classList.remove('hidden');
        appNav.classList.remove('hidden');

        // Cache-First stats
        loadStatsFromCache();
        fetchStats();

    } catch (err) {
        alert('Connection error. Showing cached data if available.');
        loadStatsFromCache();
    } finally {
        showLoader(false);
    }
});

function renderIframe(html) {
    const doc = portalFrame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
}

function handleSessionExpired() {
    alert('Session expired. Please log in again.');
    loginSection.classList.remove('hidden');
    dashboard.classList.add('hidden');
    appNav.classList.add('hidden');
}

function loadStatsFromCache() {
    ['attendance', 'results', 'fees'].forEach(type => {
        const val = localStorage.getItem(`cache_${type}`);
        if (val) document.getElementById(`val-${type}`).textContent = val;
    });
}

async function fetchStats() {
    ['attendance', 'results', 'fees'].forEach(async (type) => {
        try {
            const res = await fetch(`/api/data?type=${type}&sessionId=${currentSessionId}`);
            const json = await res.json();
            document.getElementById(`val-${type}`).textContent = json.data;
            localStorage.setItem(`cache_${type}`, json.data);
        } catch (e) {
            console.error(e);
        }
    });
}

function showLoader(show) {
    if (show) {
        loader.classList.remove('hidden');
        loader.classList.add('loader');
    } else {
        loader.classList.add('hidden');
        loader.classList.remove('loader');
    }
}

function showStats() {
    dashboard.scrollIntoView({ behavior: 'smooth' });
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('unilite_session');
        localStorage.removeItem('cache_');
        localStorage.removeItem('cache_results');
        localStorage.removeItem('cache_fees');
        location.reload();
    }
}

// Network status monitoring
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

function updateStatus() {
    const status = document.getElementById('network-status');
    if (navigator.onLine) {
        status.textContent = 'Online';
        status.style.color = '#10b981';
    } else {
        status.textContent = 'Offline (Cached Mode)';
        status.style.color = '#f59e0b';
    }
}
updateStatus();
