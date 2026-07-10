// ═══════════════════════════════════════
// LANDING PAGE CONTROLLER — index.js
// ═══════════════════════════════════════

const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
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

// Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 4000);
}
