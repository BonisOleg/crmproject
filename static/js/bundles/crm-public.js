/* === theme.js === */
const THEME_KEY = 'autolot-theme';

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#ececec' : '#161616');
  }

  const isLight = theme === 'light';
  document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
    toggle.setAttribute('aria-checked', isLight ? 'true' : 'false');
    toggle.setAttribute('aria-label', isLight ? 'Увімкнути темну тему' : 'Увімкнути світлу тему');
  });
}

function toggleTheme() {
  const next = getStoredTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getStoredTheme());

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });
});

/* === actions.js === */
document.addEventListener('DOMContentLoaded', () => {
  initActionButtons();
});

function initActionButtons() {
  const skipSelector = [
    '[data-menu-toggle]',
    '.glass-toggle',
    '.view-switcher__btn',
    '[data-lead-filter]',
    '.lead-filter',
    '[data-leads-reset]',
    '[data-open-modal]',
    '[data-report-edit-close]',
    '[data-report-edit-reset]',
    '[data-report-edit-delete]',
    '.filter-chip',
    'button[type="submit"]',
  ].join(',');

  document.querySelectorAll('button.btn').forEach((btn) => {
    if (btn.matches(skipSelector)) return;
    if (btn.dataset.actionBound) return;

    btn.dataset.actionBound = 'true';
    if (!btn.type) btn.type = 'button';

    btn.addEventListener('click', () => {
      const message = btn.dataset.actionMessage || `${cleanLabel(btn)} — прототип UI`;
      showToast(message, btn.dataset.actionType || 'success');
    });
  });
}

function cleanLabel(btn) {
  return btn.textContent.replace(/\s+/g, ' ').trim();
}

function showToast(message, type = 'success') {
  const root = getToastRoot();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  window.setTimeout(() => {
    toast.classList.remove('toast--visible');
    window.setTimeout(() => toast.remove(), 320);
  }, 2800);
}

window.showToast = showToast;

function getToastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'toast-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

