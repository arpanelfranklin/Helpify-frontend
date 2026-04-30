// LOCAL (testing)
// const API_BASE = "http://localhost:8080/api/auth";

// PRODUCTION
const API_BASE = "https://helpify-backend-iv27.onrender.com/api/auth";

// ================= UI HELPERS =================
function showMsg(text, type) {
    const el = document.getElementById('authMsg');
    el.textContent = text;
    el.className = 'auth-msg ' + type;
}

function setLoading(id, on) {
    const btn = document.getElementById(id);
    if (!btn) return;

    if (on) {
        btn.disabled = true;
        btn.dataset.orig = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Please wait...';
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.orig;
    }
}

// ================= SIGNUP =================
async function handleSignup(e) {
    e.preventDefault();

    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const phone = document.getElementById('signupPhone').value.trim();

    if (!username || !email || !password) {
        showMsg('Fill all fields', 'error');
        return;
    }

    setLoading('signupBtn', true);

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password,
                phone
            })
        });

        const data = await res.text();
        if (!res.ok) throw new Error(data);

        showMsg('✓ OTP sent to email', 'success');
        document.getElementById('otpEmail').value = email;

        // Auto-switch to OTP tab
        setTimeout(() => {
            if (typeof switchTab === 'function') {
                switchTab('otp', document.querySelector('[data-tab=otp]'));
            }
        }, 800);

    } catch (err) {
        showMsg(err.message, 'error');
    } finally {
        setLoading('signupBtn', false);
    }
}

// ================= VERIFY OTP =================
async function handleVerifyOtp(e) {
    e.preventDefault();

    const email = document.getElementById('otpEmail').value.trim().toLowerCase();
    const otp = document.getElementById('otpCode').value.trim();

    setLoading('verifyBtn', true);

    try {
        const res = await fetch(`${API_BASE}/verify?email=${email}&otp=${otp}`, {
            method: 'POST'
        });

        const data = await res.text();
        if (!res.ok) throw new Error(data);

        showMsg('✓ Verified! Now login', 'success');

        // Auto-switch to Login tab
        setTimeout(() => {
            if (typeof switchTab === 'function') {
                switchTab('login', document.querySelector('[data-tab=login]'));
                document.getElementById('loginEmail').value = email;
            }
        }, 800);

    } catch (err) {
        showMsg(err.message, 'error');
    } finally {
        setLoading('verifyBtn', false);
    }
}

// ================= LOGIN (JWT VERSION) =================
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showMsg('Fill all fields', 'error');
        return;
    }

    setLoading('loginBtn', true);

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data);

        // 🔥 STORE TOKEN
        localStorage.setItem("token", data.token);

        showMsg('✓ Login successful!', 'success');

        // 🔥 REDIRECT DIRECTLY (NO /me CALL)
        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 500);

    } catch (err) {
        showMsg(err.message || "Login failed", 'error');
    } finally {
        setLoading('loginBtn', false);
    }
}

// ================= AUTO REDIRECT (JWT) =================
(function checkLogin() {
    const token = localStorage.getItem("token");

    if (token) {
        window.location.href = "dashboard.html";
    }
})();
