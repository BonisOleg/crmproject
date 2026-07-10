const CrmRender = (() => {
  const LEAD_STAGES = [
    'new', 'searching', 'review', 'agreed', 'negotiating', 'won', 'lost', 'closed',
  ];

  const LEAD_LABELS = {
    new: 'Новий',
    searching: 'У пошуку',
    review: 'Є кандидати',
    agreed: 'Погоджено',
    negotiating: 'Торгуємось',
    won: 'Виграли',
    lost: 'Не виграли',
    closed: 'Закрито',
  };

  const EXECUTION_LABELS = {
    won: 'Виграно',
    picked: 'Забрано',
    in_transit: 'В дорозі',
    customs: 'Розмитнено',
    delivered: 'Доставлено',
  };

  const DEFAULT_CAR_IMAGE =
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&h=260&fit=crop';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNum(value) {
    return Number(value || 0).toLocaleString('uk-UA');
  }

  function moneyText(amount, currency, options = {}) {
    const prefix = options.prefix || '';
    const sign = options.sign || '';
    const attrs = `data-money="${amount}" data-money-currency="${escapeHtml(currency)}"`;
    const extra = [
      prefix ? `data-money-prefix="${escapeHtml(prefix)}"` : '',
      sign ? `data-money-sign="${escapeHtml(sign)}"` : '',
    ].filter(Boolean).join(' ');
    const display = window.CrmCurrency
      ? CrmCurrency.display(amount, currency)
      : `${formatNum(amount)} ${currency}`;
    let text = display;
    if (sign === '+') text = `+${formatNum(amount)} ${currency}`;
    if (sign === '−' || sign === '-') text = `−${formatNum(amount)} ${currency}`;
    if (prefix) text = `${prefix}${text.replace(/^борг /, 'борг ')}`;
    return `<span ${attrs}${extra ? ` ${extra}` : ''}>${escapeHtml(text)}</span>`;
  }

  function buildFunnel(status) {
    const idx = LEAD_STAGES.indexOf(status);
    return LEAD_STAGES.map((key, i) => {
      let cls = `lead-funnel__step lead-funnel__step--${key}`;
      if (i < idx) cls += ' lead-funnel__step--done';
      if (key === status) cls += ' lead-funnel__step--current';
      return `<span class="${cls}" title="${escapeHtml(LEAD_LABELS[key])}"></span>`;
    }).join('');
  }

  function markNew(el) {
    el.classList.add('card--new-item');
    el.dataset.customItem = 'true';
    return el;
  }

  function buildClientCard(client) {
    const debtClass = client.debt > 0 ? 'text-red' : 'text-green';
    const el = document.createElement('div');
    el.className = 'card client-card crm-card--deletable';
    el.dataset.clientId = client.name;
    el.dataset.crmCard = 'clients';
    el.dataset.crmKey = client.name;
    el.innerHTML = `
      <div class="client-card__avatar">${escapeHtml(client.name.slice(0, 1))}</div>
      <div>
        <div class="client-card__name">${escapeHtml(client.name)}</div>
        <div class="client-card__meta">${client.deals || 0} угоди · оборот ${moneyText(client.debt, client.currency)}</div>
        <div class="client-card__tags">
          <span class="client-card__tag">DEAL-013</span>
        </div>
      </div>
      <div>
        <div class="client-card__debt-label">винен</div>
        <div class="client-card__debt-value ${debtClass}">${moneyText(client.debt, client.currency)}</div>
      </div>`;
    return markNew(el);
  }

  function buildLeadCard(lead) {
    const el = document.createElement('article');
    el.className = 'card lead-card lead-card--glass hover-lift';
    el.dataset.leadId = lead.id;
    el.dataset.crmCard = 'leads';
    el.dataset.crmKey = lead.id;
    el.dataset.leadStatus = lead.status;
    el.dataset.leadSearch = `${lead.client} ${lead.phone} ${lead.criteria} ${lead.id}`.toLowerCase();
    el.innerHTML = `
      <div class="lead-card__top">
        <div class="lead-card__avatar">${escapeHtml(lead.client.slice(0, 1))}</div>
        <div class="lead-card__head">
          <div class="lead-card__row">
            <span class="lead-card__id mono">${escapeHtml(lead.id)}</span>
            <span class="lead-status lead-status--${lead.status}">${escapeHtml(lead.status_label)}</span>
          </div>
          <h3 class="lead-card__name">${escapeHtml(lead.client)}</h3>
          <p class="lead-card__phone mono">${escapeHtml(lead.phone)}</p>
        </div>
      </div>
      <p class="lead-card__criteria">${escapeHtml(lead.criteria)}</p>
      <div class="lead-funnel" aria-label="Прогрес у воронці">${buildFunnel(lead.status)}</div>
      <div class="lead-card__footer">
        <div class="lead-card__meta">
          <span>${escapeHtml(lead.date)}</span>
          <span>${escapeHtml(lead.manager)}</span>
          <span>${lead.candidates || 0} канд.</span>
        </div>
        <span class="lead-card__link text-muted">Деталі</span>
      </div>`;
    return markNew(el);
  }

  function buildDealCard(deal) {
    return buildDealRow(deal);
  }

  function buildDealRow(deal) {
    const el = document.createElement('a');
    el.href = `/deals/${encodeURIComponent(deal.id)}/`;
    el.className = 'deal-row crm-card--deletable';
    el.dataset.dealId = deal.id;
    el.dataset.crmCard = 'deals';
    el.dataset.crmKey = deal.id;
    el.setAttribute('data-deal-item', '');
    el.dataset.dealStatus = deal.execution;
    el.dataset.dealDebt = String(deal.debt || 0);
    el.dataset.dealSearch = `${deal.id} ${deal.car} ${deal.client} ${deal.year}`.toLowerCase();
    const debtHtml = deal.debt > 0
      ? `<div class="deal-row__debt">${moneyText(deal.debt, deal.currency, { prefix: 'борг ' })}</div>`
      : '<div class="deal-row__debt text-green">✓ оплачено</div>';
    el.innerHTML = `
      <img src="${escapeHtml(deal.image || DEFAULT_CAR_IMAGE)}" alt="${escapeHtml(deal.car)}" class="deal-row__thumb" loading="lazy">
      <div class="deal-row__main">
        <div class="deal-row__top">
          <span class="deal-row__title">${escapeHtml(deal.car)}</span>
          <span class="deal-row__badge">${escapeHtml(deal.auction || 'BCP')}</span>
        </div>
        <div class="deal-row__sub">${escapeHtml(deal.client)} · ${escapeHtml(deal.id)}</div>
        <div class="deal-row__pills">
          <span class="wf-pill">${escapeHtml(deal.execution_label || EXECUTION_LABELS[deal.execution] || deal.execution)}</span>
          <span class="wf-pill">${escapeHtml(deal.payment_label || deal.payment)}</span>
        </div>
      </div>
      <div class="deal-row__money">
        <div class="deal-row__price mono">${moneyText(deal.price, deal.currency)}</div>
        ${debtHtml}
      </div>`;
    return markNew(el);
  }

  function buildKanbanCard(deal) {
    const el = document.createElement('a');
    el.href = `/deals/${encodeURIComponent(deal.id)}/`;
    el.className = 'kanban-card hover-lift';
    el.dataset.dealId = deal.id;
    el.dataset.crmCard = 'deals';
    el.dataset.crmKey = deal.id;
    el.setAttribute('data-deal-item', '');
    el.dataset.dealStatus = deal.execution;
    el.dataset.dealDebt = String(deal.debt || 0);
    el.dataset.dealSearch = `${deal.id} ${deal.car} ${deal.client} ${deal.year}`.toLowerCase();
    const debtHtml = deal.debt > 0
      ? `<span class="kanban-card__debt mono">${moneyText(deal.debt, deal.currency, { sign: '−' })}</span>`
      : '';
    el.innerHTML = `
      <div class="kanban-card__head">
        <span class="kanban-card__id">${escapeHtml(deal.id)}</span>
        ${debtHtml}
      </div>
      <div class="kanban-card__title">${escapeHtml(deal.car)}</div>
      <div class="kanban-card__client">${escapeHtml(deal.client)} · ${deal.year}</div>
      <div class="kanban-card__footer">
        <span class="pill pill--${deal.payment}"><span class="pill__dot"></span>${escapeHtml(deal.payment_label)}</span>
        <span class="kanban-card__price mono">${moneyText(deal.price, deal.currency)}</span>
      </div>`;
    return markNew(el);
  }

  function buildDealTableRow(deal) {
    const tr = document.createElement('tr');
    tr.dataset.dealId = deal.id;
    tr.dataset.crmCard = 'deals';
    tr.dataset.crmKey = deal.id;
    tr.setAttribute('data-deal-item', '');
    tr.dataset.dealStatus = deal.execution;
    tr.dataset.dealDebt = String(deal.debt || 0);
    tr.dataset.dealSearch = `${deal.id} ${deal.car} ${deal.client} ${deal.year}`.toLowerCase();
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      window.location.href = `/deals/${encodeURIComponent(deal.id)}/`;
    });
    const debtClass = deal.debt > 0 ? 'text-red' : 'text-green';
    tr.innerHTML = `
      <td><strong>${escapeHtml(deal.car)}</strong></td>
      <td>${escapeHtml(deal.client)}</td>
      <td>${escapeHtml(deal.execution_label || EXECUTION_LABELS[deal.execution] || deal.execution)}</td>
      <td class="mono">${moneyText(deal.price, deal.currency)}</td>
      <td class="mono ${debtClass}">${moneyText(deal.debt, deal.currency)}</td>
      <td class="mono text-green">${moneyText(deal.profit || 0, deal.currency, { sign: '+' })}</td>`;
    return markNew(tr);
  }

  function buildCarrierCard(carrier) {
    const el = document.createElement('div');
    el.className = 'card trip-card crm-card--deletable';
    el.dataset.carrierId = carrier.id;
    el.dataset.crmCard = 'carriers';
    el.dataset.crmKey = carrier.id;
    const detailUrl = `/carriers/${encodeURIComponent(carrier.id)}/`;
    const driverHtml = carrier.driver
      ? `<div class="trip-card__driver">👤 ${escapeHtml(carrier.driver)}</div>`
      : '';
    const plateHtml = carrier.plate
      ? `<div class="trip-card__plate">🚛 ${escapeHtml(carrier.plate)}</div>`
      : '';
    const deals = Array.isArray(carrier.assigned_deals) ? carrier.assigned_deals : [];
    const dealsHtml = deals.length
      ? `<div class="trip-card__deals">
          <span class="trip-card__deals-label">Авто на борту:</span>
          ${deals.map((dealId) => (
            `<a href="/deals/${encodeURIComponent(dealId)}/" class="trip-card__deal-chip">${escapeHtml(dealId)}</a>`
          )).join('')}
        </div>`
      : '';
    el.innerHTML = `
      <a href="${detailUrl}" class="trip-card__main-link">
        <div class="trip-card__head">
          <span class="trip-card__id">${escapeHtml(carrier.id)}</span>
          <span class="wf-pill">${escapeHtml(carrier.status_label)}</span>
        </div>
        <div class="trip-card__meta">
          ${escapeHtml(carrier.route)} · ${carrier.cars} авто · ${escapeHtml(carrier.departure)} → ${escapeHtml(carrier.eta)}
        </div>
        <div class="trip-card__info">
          ${driverHtml}
          ${plateHtml}
        </div>
      </a>
      ${dealsHtml}
      <a href="${detailUrl}" class="trip-card__open">Відкрити</a>`;
    return markNew(el);
  }

  function exists(type, item) {
    if (type === 'clients') {
      return Boolean(document.querySelector(`[data-client-id="${CSS.escape(item.name)}"]`));
    }
    if (type === 'leads') {
      return Boolean(document.querySelector(`[data-lead-id="${CSS.escape(item.id)}"]`));
    }
    if (type === 'deals') {
      return Boolean(document.querySelector(`[data-deal-id="${CSS.escape(item.id)}"]`));
    }
    if (type === 'carriers') {
      return Boolean(document.querySelector(`[data-carrier-id="${CSS.escape(item.id)}"]`));
    }
    return false;
  }

  function appendClient(item, options = {}) {
    if (exists('clients', item)) return null;
    const list = document.querySelector('[data-clients-list]');
    if (!list) return null;
    const el = buildClientCard(item);
    list.prepend(el);
    window.CrmDelete?.enhanceCard?.(el);
    if (options.animate !== false) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return el;
  }

  function appendLead(item, options = {}) {
    if (exists('leads', item)) return null;
    const list = document.querySelector('[data-leads-list]');
    if (!list) return null;
    const el = buildLeadCard(item);
    list.prepend(el);
    window.CrmDelete?.enhanceCard?.(el);
    if (options.animate !== false) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return el;
  }

  function appendDeal(item, options = {}) {
    if (exists('deals', item)) return null;
    const grid = document.querySelector('[data-deals-list]');
    let cardEl = null;
    if (grid) {
      cardEl = buildDealCard(item);
      grid.prepend(cardEl);
      window.CrmDelete?.enhanceCard?.(cardEl);
    }

    const kanbanCol = document.querySelector(
      `.kanban-column--${item.execution} .kanban-column__cards`
    );
    if (kanbanCol) {
      const kanbanEl = buildKanbanCard(item);
      kanbanCol.prepend(kanbanEl);
      window.CrmDelete?.enhanceCard?.(kanbanEl);
    }

    const tbody = document.querySelector('.data-table tbody');
    if (tbody) {
      const rowEl = buildDealTableRow(item);
      tbody.prepend(rowEl);
      window.CrmDelete?.enhanceCard?.(rowEl);
    }

    const recent = document.querySelector('[data-recent-deals]');
    if (recent) {
      const recentEl = buildDealCard(item);
      recent.prepend(recentEl);
      window.CrmDelete?.enhanceCard?.(recentEl);
    }

    if (options.animate !== false && cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return cardEl;
  }

  function appendCarrier(item, options = {}) {
    if (exists('carriers', item)) return null;
    const list = document.querySelector('[data-carriers-list]');
    if (!list) return null;
    const el = buildCarrierCard(item);
    list.prepend(el);
    window.CrmDelete?.enhanceCard?.(el);
    if (options.animate !== false) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return el;
  }

  const appenders = {
    clients: appendClient,
    leads: appendLead,
    deals: appendDeal,
    carriers: appendCarrier,
  };

  function append(type, item, options) {
    const fn = appenders[type];
    return fn ? fn(item, options) : null;
  }

  function mountAll() {
    ['clients', 'leads', 'deals', 'carriers'].forEach((type) => {
      CrmStore.getItems(type).forEach((item) => {
        append(type, item, { animate: false });
      });
    });
  }

  function notifyAdded(type, item) {
    document.dispatchEvent(new CustomEvent('crm:added', { detail: { type, item } }));
    if (typeof window.refreshLeadFilters === 'function') window.refreshLeadFilters();
    if (typeof window.refreshDealFilters === 'function') window.refreshDealFilters();
    if (window.CrmCurrency) CrmCurrency.applyAll();
  }

  return {
    append,
    mountAll,
    notifyAdded,
    LEAD_LABELS,
    EXECUTION_LABELS,
    DEFAULT_CAR_IMAGE,
  };
})();

window.CrmRender = CrmRender;

document.addEventListener('DOMContentLoaded', () => {
  CrmRender.mountAll();
  if (window.CrmCurrency) CrmCurrency.applyAll();
});
