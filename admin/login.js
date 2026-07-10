// ═══════════════════════════════════════
// STAFF PORTAL LOGIN LOGIC — login.js
// ═══════════════════════════════════════

const API_BASE = '/api';

// Check if already logged in and redirect
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('hospital_token');
  if (token) {
    verifyAndRedirect(token);
  }

  // Bind password toggle visibility action
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPass = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPass ? 'text' : 'password');
      passwordToggle.textContent = isPass ? '🙈' : '👁️';
    });
  }
});

async function verifyAndRedirect(token) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      window.location.href = '/admin/dashboard.html';
    } else {
      localStorage.removeItem('hospital_token');
      localStorage.removeItem('hospital_user');
    }
  } catch {
    // Network error or database not ready
  }
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errorMsg = document.getElementById('errorMsg');
  const originalHtml = btn.innerHTML;

  errorMsg.style.color = '#ef4444';
  errorMsg.textContent = '';
  btn.innerHTML = '<span class="spinner"></span> Signing in...';
  btn.disabled = true;

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('hospital_token', data.token);
      localStorage.setItem('hospital_user', JSON.stringify(data.user));
      window.location.href = '/admin/dashboard.html';
    } else {
      errorMsg.textContent = data.error || 'Invalid credentials';
    }
  } catch (err) {
    errorMsg.textContent = 'Network error. Please try again.';
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
});

// Handle database setup initialization link
document.getElementById('setupDbLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  
  errorMsg.style.color = '#00bba8';
  errorMsg.textContent = '⚙️ Initializing database tables, please wait...';
  
  try {
    const res = await fetch(`${API_BASE}/setup`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      errorMsg.style.color = '#20e383';
      errorMsg.textContent = '🎉 Setup complete! Try: admin / admin123';
    } else {
      errorMsg.style.color = '#ef4444';
      errorMsg.textContent = '❌ Setup failed: ' + (data.error || 'Check server connection');
    }
  } catch (err) {
    errorMsg.style.color = '#ef4444';
    errorMsg.textContent = '❌ Network error connecting to setup endpoint.';
  }
});
