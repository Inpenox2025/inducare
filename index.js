// ═══════════════════════════════════════
// LANDING PAGE CONTROLLER — index.js
// ═══════════════════════════════════════

const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initRegistrationForm();
});

// Navbar Toggles & Styling
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');

  if (!navbar) return;

  // Add background shadow on scroll
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    
    // Close mobile menu on scroll
    if (links.classList.contains('open')) {
      links.classList.remove('open');
      toggle.classList.remove('open');
    }
  });

  // Mobile menu toggle
  if (toggle && links) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      links.classList.toggle('open');
      toggle.classList.toggle('open');
    });

    // Close mobile menu when links are clicked
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.classList.remove('open');
      });
    });

    // Close mobile menu when clicking outside on the page
    document.addEventListener('click', (e) => {
      if (links.classList.contains('open') && !links.contains(e.target) && !toggle.contains(e.target)) {
        links.classList.remove('open');
        toggle.classList.remove('open');
      }
    });
  }
}

// Pre-registration Form Handler
function initRegistrationForm() {
  const form = document.getElementById('registrationForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerHTML;

    btn.innerHTML = 'Creating Profile...';
    btn.disabled = true;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (res.status === 201 || result.success) {
        document.getElementById('registrationFormContent').style.display = 'none';
        document.getElementById('formSuccess').style.display = 'flex';
        showToast('Patient profile registered successfully!', 'success');
      } else {
        showToast(result.error || 'Failed to submit profile', 'error');
      }
    } catch (err) {
      showToast('Connection error. Please try again.', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}

function resetForm() {
  document.getElementById('registrationForm').reset();
  document.getElementById('registrationFormContent').style.display = 'block';
  document.getElementById('formSuccess').style.display = 'none';
}

// Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}
