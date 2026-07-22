document.addEventListener('DOMContentLoaded', () => {
  initDealFilters();
});

function initDealFilters() {
  const filtersRoot = document.querySelector('[data-deals-filters]');
  if (!filtersRoot) return;

  const filters = filtersRoot.querySelectorAll('[data-deal-filter]');
  const searchInput = document.querySelector('[data-deals-search]');
  const emptyState = document.querySelector('[data-deals-empty]');
  const visibleCounter = document.querySelector('[data-deals-visible]');

  if (!filters.length) return;

  let activeFilter = getInitialDealFilter(filters);

  const matchesFilter = (item, filterKey) => {
    const status = item.dataset.dealStatus || '';
    const debt = window.CrmCurrency
      ? CrmCurrency.parseAmount(item.dataset.dealDebt || '0')
      : parseFloat(String(item.dataset.dealDebt || '0').replace(',', '.')) || 0;

    if (filterKey === 'all') return true;
    if (filterKey === 'debt') return debt > 0;
    if (filterKey === 'delivered') return status === 'delivered';
    if (filterKey === 'active') return status !== 'delivered';
    return status === filterKey;
  };

  const applyFilters = () => {
    const items = document.querySelectorAll('[data-deal-item]');
    const query = (searchInput?.value || '').trim().toLowerCase();
    let visible = 0;

    items.forEach((item) => {
      const haystack = item.dataset.dealSearch || '';
      const statusMatch = matchesFilter(item, activeFilter);
      const searchMatch = !query || haystack.includes(query);
      const show = statusMatch && searchMatch;

      item.classList.toggle('deal-item--hidden', !show);
      item.hidden = !show;
      if (show) visible += 1;
    });

    if (visibleCounter) {
      visibleCounter.textContent = visible;
    }

    if (emptyState) {
      emptyState.hidden = visible > 0;
    }

    syncDealFilterUI(filters, activeFilter);
    updateKanbanCounts();
    updateUrl(activeFilter);
  };

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.dealFilter;
      applyFilters();
    });
  });

  searchInput?.addEventListener('input', applyFilters);

  window.refreshDealFilters = applyFilters;
  applyFilters();
}

function getInitialDealFilter(filters) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('filter');
  const valid = new Set(['all', 'active', 'debt', 'delivered', 'won', 'in_transit', 'picked', 'customs']);

  if (!status || status === 'all' || !valid.has(status)) {
    return 'all';
  }

  const matched = Array.from(filters).find((btn) => btn.dataset.dealFilter === status);
  return matched ? status : 'all';
}

function syncDealFilterUI(filters, activeFilter) {
  filters.forEach((btn) => {
    const isActive = btn.dataset.dealFilter === activeFilter;
    btn.classList.toggle('filter-chip--active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateKanbanCounts() {
  document.querySelectorAll('.kanban-column').forEach((column) => {
    const countEl = column.querySelector('.kanban-column__count');
    if (!countEl) return;

    const visible = column.querySelectorAll(
      '[data-deal-item]:not(.deal-item--hidden):not([hidden])'
    ).length;
    countEl.textContent = visible;
  });
}

function updateUrl(filterKey) {
  const url = new URL(window.location);
  if (filterKey === 'all') {
    url.searchParams.delete('filter');
  } else {
    url.searchParams.set('filter', filterKey);
  }
  window.history.replaceState({}, '', url);
}
