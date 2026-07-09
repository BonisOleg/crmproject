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
