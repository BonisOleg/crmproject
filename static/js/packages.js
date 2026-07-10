/**
 * Пакети Autolot CRM (ТЗ v1.0):
 * MVP (Економ) ⊂ Std (Стандарт) ⊂ VIP
 */
const CrmPackages = (() => {
  const STORAGE_KEY = 'autolot-package';

  const LEVEL = { econom: 0, standard: 1, vip: 2 };

  const META = {
    econom: { label: 'Економ', code: 'MVP', desc: 'Мінімальний робочий продукт' },
    standard: { label: 'Стандарт', code: 'Std', desc: 'MVP + канбан, автовози, клієнти, дебіторка' },
    vip: { label: 'VIP', code: 'VIP', desc: 'Std + запити, налаштування, аналітика, Telegram' },
  };

  /** Мінімальний пакет для функції (з розділів 4–6 ТЗ) */
  const FEATURES = {
    nav_cockpit: 'econom',
    nav_deals: 'econom',
    nav_reports: 'econom',
    nav_carriers: 'standard',
    nav_clients: 'standard',
    nav_money: 'standard',
    nav_leads: 'vip',
    nav_settings: 'vip',

    deals_cards: 'econom',
    deals_table: 'econom',
    deals_search: 'econom',
    deals_kanban: 'standard',

    currency_switch: 'econom',
    pull_from_site: 'standard',
    accruals: 'standard',

    cockpit_stats: 'econom',
    cockpit_key_queues: 'econom',
    cockpit_all_queues: 'standard',
    cockpit_pipeline: 'standard',
    cockpit_quick_actions: 'standard',
    cockpit_telegram: 'vip',

    reports_monthly: 'econom',
    analytics: 'vip',

    modal_deal: 'econom',
    modal_payment: 'standard',
    modal_client: 'standard',
    modal_carrier: 'standard',
    modal_lead: 'vip',
  };

  const PAGE_GATE = {
    cockpit: 'nav_cockpit',
    deals: 'nav_deals',
    reports: 'nav_reports',
    carriers: 'nav_carriers',
    clients: 'nav_clients',
    money: 'nav_money',
    leads: 'nav_leads',
    settings: 'nav_settings',
  };

  const MODAL_GATE = {
    deal: 'modal_deal',
    payment: 'modal_payment',
    client: 'modal_client',
    carrier: 'modal_carrier',
    lead: 'modal_lead',
  };

  const VIEW_GATE = {
    kanban: 'deals_kanban',
    table: 'deals_table',
    cards: 'deals_cards',
  };

  function get() {
    return 'vip';
  }

  function set(_pkg) {
    // Пакетний gate вимкнено — усі функції доступні
  }

  function has(feature) {
    const required = FEATURES[feature];
    if (!required) return true;
    return LEVEL[get()] >= LEVEL[required];
  }

  function meta(pkg) {
    return META[pkg] || META.econom;
  }

  function requiredMeta(feature) {
    const required = FEATURES[feature];
    return required ? meta(required) : meta('econom');
  }

  function requiredLabel(feature) {
    const m = requiredMeta(feature);
    return `${m.label} (${m.code})`;
  }

  function notifyLocked(feature) {
    const need = requiredMeta(feature);
    const msg = `Доступно з пакета «${need.label}» (${need.code}). Перемкніть пакет у панелі зверху.`;
    if (typeof showToast === 'function') showToast(msg, 'info');
  }

  function applyNav() {
    document.querySelectorAll('[data-package-feature]').forEach((el) => {
      const feature = el.dataset.packageFeature;
      const mode = el.dataset.packageMode || (el.classList.contains('nav-item') || el.classList.contains('bottom-nav__item') ? 'lock' : 'hide');
      const allowed = has(feature);

      el.classList.toggle('package-gated--hidden', !allowed && mode === 'hide');
      el.classList.toggle('package-gated--locked', !allowed && mode === 'lock');
      el.toggleAttribute('aria-disabled', !allowed && mode === 'lock');

      if (el.dataset.packageBound) return;
      el.dataset.packageBound = 'true';

      if (el.tagName === 'A' && mode === 'lock') {
        el.addEventListener('click', (event) => {
          if (has(feature)) return;
          event.preventDefault();
          notifyLocked(feature);
        });
      }

      if (el.tagName === 'BUTTON' && mode === 'lock') {
        el.addEventListener('click', (event) => {
          if (has(feature)) return;
          event.preventDefault();
          event.stopPropagation();
          notifyLocked(feature);
        });
      }
    });
  }

  function applyPageGate() {
    const shell = document.querySelector('[data-page]');
    const page = shell?.dataset.page;
    if (!page) return;

    const feature = PAGE_GATE[page];
    const main = document.querySelector('.page-content');
    if (!main) return;

    const existing = main.querySelector('.package-lock');
    const allowed = !feature || has(feature);

    main.querySelectorAll(':scope > *:not(.package-lock)').forEach((el) => {
      el.hidden = !allowed;
    });

    if (allowed) {
      existing?.remove();
      return;
    }

    if (existing) return;

    const need = requiredMeta(feature);
    const lock = document.createElement('div');
    lock.className = 'package-lock card';
    lock.innerHTML = `
      <p class="package-lock__code">${need.code}</p>
      <h2 class="package-lock__title">Модуль «${pageLabel(page)}»</h2>
      <p class="package-lock__text">У пакеті «${meta(get()).label}» (${meta(get()).code}) цей розділ недоступний.</p>
      <p class="package-lock__hint">Потрібен пакет <strong>${need.label}</strong> (${need.code}) або вище.</p>
      <div class="package-lock__actions">
        <button type="button" class="wf-panel-btn wf-panel-btn--green" data-package-upgrade="${needKey(feature)}">Увімкнути ${need.code}</button>
        <a href="/cockpit/" class="wf-panel-btn wf-panel-btn--blue">На кокпіт</a>
      </div>`;
    main.prepend(lock);

    lock.querySelector('[data-package-upgrade]')?.addEventListener('click', () => {
      set(needKey(feature));
      if (typeof showToast === 'function') {
        showToast(`Пакет: ${need.label} (${need.code})`, 'success');
      }
    });
  }

  function needKey(feature) {
    return FEATURES[feature] || 'vip';
  }

  function pageLabel(page) {
    const labels = {
      cockpit: 'Кокпіт',
      deals: 'Угоди',
      reports: 'Звіт',
      carriers: 'Автовози',
      clients: 'Клієнти',
      money: 'Гроші',
      leads: 'Запити',
      settings: 'Налаштування',
    };
    return labels[page] || page;
  }

  function applyViewModes() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (!view || !VIEW_GATE[view]) return;
    if (has(VIEW_GATE[view])) return;

    if (window.location.pathname.includes('/deals')) {
      params.set('view', 'cards');
      const url = `${window.location.pathname}?${params.toString()}`;
      window.location.replace(url);
    }
  }

  function applyViewSwitcher() {
    document.querySelectorAll('.view-switcher__btn[data-view]').forEach((btn) => {
      const view = btn.dataset.view;
      const feature = VIEW_GATE[view];
      if (!feature) return;
      const allowed = has(feature);
      btn.classList.toggle('package-gated--locked', !allowed);
      btn.toggleAttribute('aria-disabled', !allowed);
    });
  }

  function applyCurrency() {
    const group = document.querySelector('.wf-currency');
    if (!group) return;
    const allowed = has('currency_switch');
    group.classList.toggle('package-gated--hidden', !allowed);
    group.querySelectorAll('button').forEach((btn) => {
      btn.disabled = !allowed;
    });
    if (window.CrmCurrency) CrmCurrency.applyAll();
  }

  function applyPackageBadge() {
    const m = meta(get());
    document.querySelectorAll('[data-package-badge]').forEach((badge) => {
      badge.textContent = m.code;
      badge.title = `${m.label} — ${m.desc}`;
    });
  }

  function applyAll() {
    applyNav();
    applyPageGate();
    applyViewModes();
    applyViewSwitcher();
    applyCurrency();
    applyPackageBadge();
  }

  function canOpenModal(type) {
    const feature = MODAL_GATE[type];
    return !feature || has(feature);
  }

  function guardModal(type) {
    const feature = MODAL_GATE[type];
    if (!feature || has(feature)) return true;
    notifyLocked(feature);
    return false;
  }

  function guardView(view) {
    const feature = VIEW_GATE[view];
    if (!feature || has(feature)) return true;
    notifyLocked(feature);
    return false;
  }

  document.documentElement.dataset.package = 'vip';

  return {
    get,
    set,
    has,
    meta,
    requiredLabel,
    notifyLocked,
    applyAll,
    canOpenModal,
    guardModal,
    guardView,
    FEATURES,
    PAGE_GATE,
  };
})();

window.CrmPackages = CrmPackages;
