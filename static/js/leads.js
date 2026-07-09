document.addEventListener('DOMContentLoaded', () => {
  initLeadFilters();
});

function initLeadFilters() {
  const filters = document.querySelectorAll('.lead-filter[data-lead-filter]');
  const searchInput = document.querySelector('[data-leads-search]');
  const emptyState = document.querySelector('[data-leads-empty]');
  const visibleCounters = document.querySelectorAll('[data-leads-visible]');
  const resetBtn = document.querySelector('[data-leads-reset]');

  if (!filters.length) return;

  let activeFilter = getInitialFilter(filters);

  const applyFilters = () => {
    const cards = document.querySelectorAll('.lead-card[data-lead-status]');
    const query = (searchInput?.value || '').trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const status = card.dataset.leadStatus;
      const haystack = card.dataset.leadSearch || '';
      const statusMatch = activeFilter === 'all' || status === activeFilter;
      const searchMatch = !query || haystack.includes(query);
      const show = statusMatch && searchMatch;

      card.classList.toggle('lead-card--hidden', !show);
      card.hidden = !show;
      if (show) visible += 1;
    });

    visibleCounters.forEach((el) => {
      el.textContent = visible;
    });

    if (emptyState) {
      emptyState.hidden = visible > 0;
    }

    syncFilterUI(filters, activeFilter);
    updateLeadFilterCounts();
    updateUrl(activeFilter);
  };

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.leadFilter;
      applyFilters();
    });
  });

  searchInput?.addEventListener('input', applyFilters);

  resetBtn?.addEventListener('click', () => {
    activeFilter = 'all';
    if (searchInput) searchInput.value = '';
    applyFilters();
    if (typeof showToast === 'function') {
      showToast('Фільтри скинуто', 'info');
    }
  });

  window.refreshLeadFilters = applyFilters;
  applyFilters();
}

function getInitialFilter(filters) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');

  if (status === 'all' || !status) {
    return 'all';
  }

  const matched = Array.from(filters).find((btn) => btn.dataset.leadFilter === status);
  return matched ? status : 'all';
}

function syncFilterUI(filters, activeFilter) {
  filters.forEach((btn) => {
    const isActive = btn.dataset.leadFilter === activeFilter;
    btn.classList.toggle('lead-filter--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function updateLeadFilterCounts() {
  const cards = document.querySelectorAll('.lead-card[data-lead-status]');
  const counts = { all: cards.length };

  cards.forEach((card) => {
    const status = card.dataset.leadStatus;
    counts[status] = (counts[status] || 0) + 1;
  });

  document.querySelectorAll('.lead-filter[data-lead-filter]').forEach((btn) => {
    const key = btn.dataset.leadFilter;
    const countEl = btn.querySelector('.lead-filter__count');
    if (!countEl) return;
    countEl.textContent = key === 'all' ? counts.all : (counts[key] || 0);
  });
}

function updateUrl(status) {
  const url = new URL(window.location);
  if (status === 'all') {
    url.searchParams.delete('status');
  } else {
    url.searchParams.set('status', status);
  }
  window.history.replaceState({}, '', url);
}
