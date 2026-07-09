document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initViewSwitcher();
  initFilterChips();
});

const TABLET_MAX = 1024;

function initMobileNav() {
  const menuBtn = document.querySelector('[data-menu-toggle]');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');

  if (!menuBtn || !sidebar) return;

  const isMobileLayout = () => window.innerWidth <= TABLET_MAX;

  const toggle = (open) => {
    sidebar.classList.toggle('sidebar--open', open);
    overlay?.classList.toggle('sidebar-overlay--visible', open);
    document.body.classList.toggle('nav-open', open);
  };

  const close = () => toggle(false);

  menuBtn.addEventListener('click', () => {
    toggle(!sidebar.classList.contains('sidebar--open'));
  });

  const bindOverlayClose = (event) => {
    if (event.target !== overlay) return;
    event.preventDefault();
    close();
  };

  overlay?.addEventListener('click', bindOverlayClose);
  overlay?.addEventListener('touchend', bindOverlayClose, { passive: false });

  sidebar.querySelectorAll('.nav-item').forEach((link) => {
    link.addEventListener('click', () => {
      if (isMobileLayout()) close();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('sidebar--open')) {
      close();
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobileLayout() && sidebar.classList.contains('sidebar--open')) {
      close();
    }
  });
}

function initViewSwitcher() {
  document.querySelectorAll('.view-switcher__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view) return;
      if (window.CrmPackages && !CrmPackages.guardView(view)) return;
      const url = new URL(window.location);
      url.searchParams.set('view', view);
      window.location.href = url.toString();
    });
  });
}

function initFilterChips() {
  if (document.querySelector('[data-deals-filters]')) return;

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => {
        c.classList.remove('filter-chip--active');
      });
      chip.classList.add('filter-chip--active');
      notifyFilter(chip.textContent.trim());
    });
  });
}

function notifyFilter(label) {
  if (typeof showToast !== 'function') return;
  showToast(`Фільтр: ${label}`, 'info');
}
