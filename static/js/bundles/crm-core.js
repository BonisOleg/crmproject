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

/* === crm-api.js === */
/**
 * Session JSON API client (CSRF cookie).
 */
const CrmApi = (() => {
  function csrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    const input = document.querySelector('[name=csrfmiddlewaretoken]');
    return input ? input.value : '';
  }

  async function request(url, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    const headers = new Headers(opts.headers || {});
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
    if (!isForm && opts.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      headers.set('X-CSRFToken', csrfToken());
    }
    opts.headers = headers;

    const response = await fetch(url, opts);
    let payload = null;
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { ok: false, error: text || 'Невірна відповідь сервера' };
    }

    if (!response.ok || (payload && payload.ok === false)) {
      const err = new Error((payload && payload.error) || `HTTP ${response.status}`);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload?.data !== undefined ? payload.data : payload;
  }

  const get = (url) => request(url);
  const post = (url, body) => request(url, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body || {}),
  });
  const patch = (url, body) => request(url, {
    method: 'PATCH',
    body: JSON.stringify(body || {}),
  });
  const put = (url, body) => request(url, {
    method: 'PUT',
    body: JSON.stringify(body || {}),
  });
  const del = (url) => request(url, { method: 'DELETE' });

  return {
    csrfToken,
    request,
    get,
    post,
    patch,
    put,
    del,
    clients: {
      list: () => get('/api/clients/'),
      create: (data) => post('/api/clients/', data),
      update: (pk, data) => patch(`/api/clients/${pk}/`, data),
      remove: (pk) => del(`/api/clients/${pk}/`),
    },
    deals: {
      list: () => get('/api/deals/'),
      create: (data) => post('/api/deals/', data),
      update: (code, data) => patch(`/api/deals/${encodeURIComponent(code)}/`, data),
      remove: (code) => del(`/api/deals/${encodeURIComponent(code)}/`),
      duePayments: (code, items) => put(
        `/api/deals/${encodeURIComponent(code)}/due-payments/`,
        { items },
      ),
      uploadDoc: (code, formData) => post(
        `/api/deals/${encodeURIComponent(code)}/documents/`,
        formData,
      ),
    },
    leads: {
      list: () => get('/api/leads/'),
      create: (data) => post('/api/leads/', data),
      update: (code, data) => patch(`/api/leads/${encodeURIComponent(code)}/`, data),
      remove: (code) => del(`/api/leads/${encodeURIComponent(code)}/`),
    },
    carriers: {
      list: () => get('/api/carriers/'),
      create: (data) => post('/api/carriers/', data),
      update: (code, data) => patch(`/api/carriers/${encodeURIComponent(code)}/`, data),
      remove: (code) => del(`/api/carriers/${encodeURIComponent(code)}/`),
      uploadDoc: (code, formData) => post(
        `/api/carriers/${encodeURIComponent(code)}/documents/`,
        formData,
      ),
    },
    payments: {
      list: () => get('/api/payments/'),
      create: (data) => post('/api/payments/', data),
    },
    documents: {
      remove: (pk) => del(`/api/documents/${pk}/`),
    },
    reports: {
      rows: (month, type) => get(
        `/api/reports/rows/?month=${encodeURIComponent(month)}&type=${encodeURIComponent(type)}`,
      ),
      add: (data) => post('/api/reports/rows/add/', data),
      update: (pk, data) => patch(`/api/reports/rows/${pk}/`, data),
      remove: (pk) => del(`/api/reports/rows/${pk}/`),
      rollover: () => post('/api/reports/rollover/', {}),
      archive: () => get('/api/reports/archive/'),
    },
    settings: {
      get: () => get('/api/settings/'),
      update: (data) => patch('/api/settings/', data),
    },
    account: {
      get: () => get('/api/account/'),
      update: (data) => patch('/api/account/', data),
    },
  };
})();

window.CrmApi = CrmApi;

/* === crm-store.js === */
/**
 * CRM store — in-memory cache + Django API (не localStorage як SoT).
 */
const CrmStore = (() => {
  const cache = {
    clients: [],
    leads: [],
    deals: [],
    carriers: [],
    payments: [],
  };

  function readCatalog() {
    const node = document.getElementById('crm-deals-catalog');
    if (!node) return [];
    try {
      const parsed = JSON.parse(node.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readCarrierCatalog() {
    const node = document.getElementById('crm-carriers-catalog');
    if (!node) return [];
    try {
      const parsed = JSON.parse(node.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function hydrate() {
    const deals = readCatalog();
    if (deals.length) cache.deals = deals.slice();
    const carriers = readCarrierCatalog();
    if (carriers.length) cache.carriers = carriers.slice();
  }

  function bootFromApi() {
    if (!window.CrmApi) return Promise.resolve();
    return Promise.all([
      CrmApi.deals.list().then((list) => {
        if (Array.isArray(list) && list.length) cache.deals = list.slice();
      }),
      CrmApi.carriers.list().then((list) => {
        if (Array.isArray(list) && list.length) cache.carriers = list.slice();
      }),
    ]).then(() => {
      document.dispatchEvent(new CustomEvent('crm:catalog-ready'));
    }).catch((err) => {
      if (typeof showToast === 'function') {
        showToast(err.message || 'Не вдалося завантажити каталог', 'info');
      }
    });
  }

  let readyPromise = null;

  function ready() {
    if (readyPromise) return readyPromise;
    hydrate();
    const hasInline = cache.deals.length > 0 || cache.carriers.length > 0;
    readyPromise = hasInline ? Promise.resolve() : bootFromApi();
    return readyPromise;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function upsert(type, item, keyFn) {
    const key = keyFn(item);
    const idx = cache[type].findIndex((row) => keyFn(row) === key);
    if (idx >= 0) cache[type][idx] = { ...cache[type][idx], ...item };
    else cache[type].unshift(item);
    return item;
  }

  function getItems(type) {
    return (cache[type] || []).slice();
  }

  function itemKey(type, item) {
    if (type === 'clients') return item.name || item.pk || item.id;
    return item.id || item.pk;
  }

  async function addItem(type, item) {
    if (!window.CrmApi) {
      upsert(type, item, (row) => itemKey(type, row));
      return item;
    }
    let saved = item;
    try {
      if (type === 'clients') {
        saved = await CrmApi.clients.create(item);
      } else if (type === 'leads') {
        saved = await CrmApi.leads.create(item);
      } else if (type === 'deals') {
        saved = await CrmApi.deals.create(item);
      } else if (type === 'carriers') {
        saved = await CrmApi.carriers.create(item);
      } else if (type === 'payments') {
        const result = await CrmApi.payments.create(item);
        saved = result.payment || item;
        if (result.deal) {
          upsert('deals', { id: result.deal.id, ...result.deal }, (row) => row.id);
        }
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Помилка збереження', 'info');
      throw err;
    }
    upsert(type, saved, (row) => itemKey(type, row));
    return saved;
  }

  async function removeItem(type, key) {
    const item = (cache[type] || []).find((row) => itemKey(type, row) === key);
    cache[type] = (cache[type] || []).filter((row) => itemKey(type, row) !== key);
    if (!window.CrmApi) return;
    try {
      if (type === 'clients') {
        let pk = item?.pk;
        if (!pk) {
          const list = await CrmApi.clients.list();
          pk = list.find((row) => row.name === key)?.pk;
        }
        if (pk) await CrmApi.clients.remove(pk);
      } else if (type === 'leads') {
        await CrmApi.leads.remove(item?.id || key);
      } else if (type === 'deals') {
        await CrmApi.deals.remove(item?.id || key);
      } else if (type === 'carriers') {
        await CrmApi.carriers.remove(item?.id || key);
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Помилка видалення', 'info');
      throw err;
    }
  }

  function markHidden() {
    /* soft-delete йде через API; hidden LS більше не SoT */
  }

  function isHidden() {
    return false;
  }

  function nextId(type) {
    const items = getItems(type).concat(type === 'deals' ? readCatalog() : []);
    let max = type === 'leads' ? 21 : type === 'deals' ? 47 : type === 'carriers' ? 12 : 0;
    items.forEach((item) => {
      const match = String(item.id || '').match(/(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    const next = max + 1;
    if (type === 'leads') return `RQ-${String(next).padStart(3, '0')}`;
    if (type === 'deals') {
      const year = new Date().getFullYear();
      return `AL-${year}-${String(next).padStart(3, '0')}`;
    }
    if (type === 'carriers') return `TR-${String(next).padStart(3, '0')}`;
    return String(next);
  }

  function getDeal(dealId) {
    return cache.deals.find((item) => item.id === dealId)
      || readCatalog().find((item) => item.id === dealId)
      || null;
  }

  async function saveDealProfile(dealId, patch) {
    const current = getDeal(dealId) || { id: dealId };
    const merged = { ...current, ...patch, id: dealId };
    upsert('deals', merged, (row) => row.id);
    document.dispatchEvent(new CustomEvent('crm:deal-updated', { detail: { dealId } }));

    if (!window.CrmApi) return merged;
    try {
      const saved = await CrmApi.deals.update(dealId, patch);
      upsert('deals', saved, (row) => row.id);
      if (Array.isArray(patch.due_payments)) {
        await CrmApi.deals.duePayments(dealId, patch.due_payments);
      }
      document.dispatchEvent(new CustomEvent('crm:deal-updated', { detail: { dealId } }));
      return saved;
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Помилка оновлення угоди', 'info');
      throw err;
    }
  }

  function saveDealOverride(dealId, patch) {
    return saveDealProfile(dealId, patch);
  }

  function putDeal(deal) {
    if (!deal?.id) return deal;
    return upsert('deals', deal, (row) => row.id);
  }

  function putCarrier(carrier) {
    if (!carrier?.id) return carrier;
    return upsert('carriers', carrier, (row) => row.id);
  }

  function getCarrier(carrierId) {
    return cache.carriers.find((item) => item.id === carrierId)
      || readCarrierCatalog().find((item) => item.id === carrierId)
      || null;
  }

  async function saveCarrierProfile(carrierId, patch) {
    const current = getCarrier(carrierId) || { id: carrierId };
    const merged = { ...current, ...patch, id: carrierId };
    upsert('carriers', merged, (row) => row.id);
    document.dispatchEvent(new CustomEvent('crm:carrier-updated', { detail: { carrierId } }));

    if (!window.CrmApi) return merged;
    try {
      const saved = await CrmApi.carriers.update(carrierId, patch);
      upsert('carriers', saved, (row) => row.id);
      document.dispatchEvent(new CustomEvent('crm:carrier-updated', { detail: { carrierId } }));
      return saved;
    } catch (err) {
      if (typeof showToast === 'function') showToast(err.message || 'Помилка оновлення рейсу', 'info');
      throw err;
    }
  }

  function dealToReportRow(deal) {
    const cost = deal.cost ?? Math.round((Number(deal.price) || 0) * 0.82);
    const price = Number(deal.price) || 0;
    const paid = Number(deal.paid) || 0;
    const debt = Math.max(0, price - paid);
    const profit = deal.profit ?? Math.max(0, price - cost);
    const deliveryType = deal.delivery_type || 'pickup';
    return {
      deal_id: deal.id,
      car: deal.car,
      client: deal.client,
      stage: deal.execution_label || deal.stage || 'Виграно',
      won_price: Number(deal.won_price) || 0,
      bid: Number(deal.bid) || 0,
      cost,
      price,
      paid,
      debt,
      delivery_cost: deliveryType === 'ours' ? (Number(deal.delivery_cost) || 0) : 0,
      delivery_type: deliveryType,
      profit,
      currency: deal.currency || 'CHF',
      won_currency: deal.won_currency || deal.currency || 'CHF',
      bid_currency: deal.bid_currency || deal.currency || 'CHF',
      cost_currency: deal.cost_currency || deal.currency || 'CHF',
      price_currency: deal.price_currency || deal.currency || 'CHF',
      delivery_currency: deal.delivery_currency || deal.currency || 'CHF',
    };
  }

  function listDealsForSelect() {
    const map = new Map();
    readCatalog().forEach((deal) => map.set(deal.id, deal));
    cache.deals.forEach((deal) => map.set(deal.id, deal));
    return Array.from(map.values());
  }

  async function addPayment(payment) {
    return addItem('payments', payment);
  }

  function readPayments() {
    return getItems('payments');
  }

  return {
    getItems,
    addItem,
    removeItem,
    markHidden,
    isHidden,
    itemKey,
    nextId,
    todayISO,
    getDeal,
    saveDealProfile,
    getCarrier,
    saveCarrierProfile,
    dealToReportRow,
    listDealsForSelect,
    saveDealOverride,
    addPayment,
    readPayments,
    hydrate,
    ready,
    putDeal,
    putCarrier,
  };
})();

window.CrmStore = CrmStore;

/* === crm-payments.js === */
const CrmPayments = (() => {
  const PAYMENT_LABELS = {
    paid: 'Оплачено',
    partial: 'Частково',
    pending: 'Очікує',
    debt: 'Борг',
  };

  function paymentStatus(paid, price, debt) {
    if (debt <= 0) return { payment: 'paid', payment_label: PAYMENT_LABELS.paid };
    if (paid > 0) return { payment: 'partial', payment_label: PAYMENT_LABELS.partial };
    return { payment: 'pending', payment_label: PAYMENT_LABELS.pending };
  }

  function convertAmount(amount, from, to) {
    if (from === to) return amount;
    if (window.CrmCurrency) return Math.round(CrmCurrency.convert(amount, from, to));
    return amount;
  }

  async function record(payment) {
    const deal = CrmStore.getDeal(payment.dealId);
    if (!deal) return null;

    if (window.CrmApi) {
      const result = await CrmApi.payments.create(payment);
      const updated = {
        ...deal,
        ...(result.deal || {}),
        id: (result.deal && result.deal.id) || payment.dealId,
      };
      CrmStore.putDeal?.(updated);
      document.dispatchEvent(new CustomEvent('crm:deal-updated', { detail: { dealId: updated.id } }));
      return {
        dealId: payment.dealId,
        deal: updated,
        payment: result.payment || payment,
      };
    }

    const amountInDealCurrency = convertAmount(payment.amount, payment.currency, deal.currency);
    const paid = Math.min(deal.price, (deal.paid || 0) + amountInDealCurrency);
    const debt = Math.max(0, deal.price - paid);
    const status = paymentStatus(paid, deal.price, debt);
    const patch = {
      paid,
      debt,
      payment: status.payment,
      payment_label: status.payment_label,
    };
    await CrmStore.saveDealOverride(payment.dealId, patch);
    return { dealId: payment.dealId, deal: { ...deal, ...patch }, payment };
  }

  function formatMoney(amount, currency) {
    if (window.CrmCurrency) return CrmCurrency.display(amount, currency);
    return `${Number(amount || 0).toLocaleString('uk-UA')} ${currency}`;
  }

  function updateDealNodes(dealId, deal) {
    document.querySelectorAll(`[data-deal-id="${CSS.escape(dealId)}"]`).forEach((node) => {
      const priceEl = node.querySelector('.deal-row__price, .deal-card__price, .kanban-card__price, [data-deal-price]');
      if (priceEl) {
        priceEl.dataset.money = String(deal.price);
        priceEl.dataset.moneyCurrency = deal.currency;
        priceEl.textContent = formatMoney(deal.price, deal.currency);
      }

      const debtEl = node.querySelector('.deal-row__debt');
      if (debtEl) {
        if (deal.debt > 0) {
          debtEl.classList.remove('text-green');
          debtEl.dataset.money = String(deal.debt);
          debtEl.dataset.moneyCurrency = deal.currency;
          debtEl.dataset.moneyPrefix = 'борг ';
          debtEl.textContent = `борг ${formatMoney(deal.debt, deal.currency)}`;
        } else {
          delete debtEl.dataset.money;
          debtEl.classList.add('text-green');
          debtEl.textContent = '✓ оплачено';
        }
      }

      node.querySelectorAll('.wf-pill, .pill').forEach((pill) => {
        if (pill.textContent.match(/Оплачено|Частково|Очікує|Борг/)) {
          pill.textContent = deal.payment_label;
        }
      });

      node.dataset.dealDebt = String(deal.debt || 0);
    });

    if (window.CrmCurrency) CrmCurrency.applyAll();
  }

  function appendPaymentItem(payment) {
    const list = document.querySelector('[data-payment-list]');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'payment-item';
    item.dataset.paymentId = payment.id;
    item.innerHTML = `
      <div>
        <div class="mono" data-money="${payment.amount}" data-money-currency="${payment.currency}">${formatMoney(payment.amount, payment.currency)}</div>
        <div class="text-muted" style="font-size:12px">${payment.place}</div>
      </div>
      <div class="text-muted">${payment.date}</div>`;
    list.prepend(item);
  }

  function updateDealDetailFinance(deal) {
    const paidEl = document.querySelector('[data-deal-paid]');
    const priceEl = document.querySelector('[data-deal-price-total]');
    const progressEl = document.querySelector('[data-deal-progress]');
    const profitEl = document.querySelector('[data-deal-profit]');

    if (paidEl) {
      paidEl.dataset.money = String(deal.paid);
      paidEl.dataset.moneyCurrency = deal.currency;
      paidEl.textContent = Number(deal.paid).toLocaleString('uk-UA');
    }
    if (priceEl) {
      priceEl.dataset.money = String(deal.price);
      priceEl.dataset.moneyCurrency = deal.currency;
      priceEl.textContent = formatMoney(deal.price, deal.currency);
    }
    if (progressEl && deal.price > 0) {
      progressEl.style.width = `${Math.round((deal.paid / deal.price) * 100)}%`;
    }
    if (profitEl) {
      profitEl.dataset.money = String(deal.profit || 0);
      profitEl.dataset.moneyCurrency = deal.currency;
      profitEl.textContent = `+${formatMoney(deal.profit || 0, deal.currency)}`;
    }

    document.querySelectorAll('.dual-pills .pill, .deal-row__pills .wf-pill').forEach((pill) => {
      if (/Оплачено|Частково|Очікує|Борг/.test(pill.textContent)) {
        pill.innerHTML = `<span class="pill__dot"></span>${deal.payment_label}`;
      }
    });
  }

  function refreshUI(result) {
    if (!result) return;
    updateDealNodes(result.dealId, result.deal);
    appendPaymentItem(result.payment);
    updateDealDetailFinance(result.deal);
  }

  return { record, refreshUI, updateDealDetailFinance, updateDealNodes, PAYMENT_LABELS };
})();

window.CrmPayments = CrmPayments;

/* === crm-validation.js === */
const CrmValidation = (() => {
  const RULES = {
    phone(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть номер телефону' : null;
      if (/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(v)) return 'Лише цифри, +, пробіли та дужки';
      const digits = v.replace(/\D/g, '');
      if (digits.length < 10) return 'Мінімум 10 цифр';
      if (digits.length > 15) return 'Занадто довгий номер';
      return null;
    },

    name(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть це поле' : null;
      if (v.length < 2) return 'Мінімум 2 символи';
      if (/\d/.test(v)) return 'Не використовуйте цифри';
      if (!/^[\p{L}\s.'\-]+$/u.test(v)) return 'Лише літери та пробіли';
      return null;
    },

    text(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть це поле' : null;
      if (v.length < 2) return 'Мінімум 2 символи';
      return null;
    },

    car(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть модель авто' : null;
      if (v.length < 2) return 'Мінімум 2 символи';
      return null;
    },

    criteria(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Опишіть критерії пошуку' : null;
      if (v.length < 8) return 'Мінімум 8 символів';
      return null;
    },

    telegram(value) {
      const v = String(value ?? '').trim();
      if (!v) return null;
      if (!/^@[a-zA-Z0-9_]{3,32}$/.test(v)) return 'Формат: @username (латиниця, цифри, _)';
      return null;
    },

    year(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть рік' : null;
      if (!/^\d{4}$/.test(v)) return '4 цифри, напр. 2021';
      const year = Number(v);
      const max = new Date().getFullYear() + 1;
      if (year < 1990 || year > max) return `Рік від 1990 до ${max}`;
      return null;
    },

    price(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть ціну' : null;
      if (!/^\d+$/.test(v)) return 'Лише цілі числа';
      const num = Number(v);
      if (num <= 0) return 'Ціна має бути більше 0';
      if (num > 9999999) return 'Занадто велика сума';
      return null;
    },

    integer(value, required, field) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Заповніть значення' : null;
      if (!/^\d+$/.test(v)) return 'Лише цілі числа';
      const num = Number(v);
      if (field.min != null && num < field.min) return `Мінімум ${field.min}`;
      if (field.max != null && num > field.max) return `Максимум ${field.max}`;
      return null;
    },

    route(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Вкажіть маршрут' : null;
      if (v.length < 5) return 'Мінімум 5 символів';
      if (!/[→\-–—]/.test(v)) return 'Вкажіть маршрут через → або -';
      return null;
    },

    select(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Оберіть значення зі списку' : null;
      return null;
    },

    paymentAmount(value, required, field, formEl) {
      const priceError = RULES.price(value, required);
      if (priceError) return priceError;
      if (!formEl || !window.CrmStore) return null;

      const dealId = getInput(formEl, 'deal_id')?.value;
      if (!dealId) return 'Спочатку оберіть угоду';

      const deal = CrmStore.getDeal(dealId);
      if (!deal) return 'Угоду не знайдено';
      if ((deal.debt || 0) <= 0) return 'У цієї угоди немає боргу';

      const amount = Number(value);
      const payCurrency = getInput(formEl, 'currency')?.value || deal.currency;
      let inDealCurrency = amount;
      if (window.CrmCurrency && payCurrency !== deal.currency) {
        inDealCurrency = Math.round(CrmCurrency.convert(amount, payCurrency, deal.currency));
      }
      if (inDealCurrency > deal.debt) {
        return `Максимум ${deal.debt.toLocaleString('uk-UA')} ${deal.currency} (поточний борг)`;
      }
      return null;
    },

    date(value, required) {
      const v = String(value ?? '').trim();
      if (!v) return required ? 'Оберіть дату' : null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Некоректна дата';
      return null;
    },
  };

  function sanitizePhone(value) {
    return String(value ?? '').replace(/[^\d+\s\-()]/g, '');
  }

  function sanitizeDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function sanitizeTelegram(value) {
    let v = String(value ?? '').trim();
    if (!v) return '';
    v = v.replace(/\s/g, '');
    if (!v.startsWith('@')) v = `@${v.replace(/^@+/, '')}`;
    return v.replace(/[^@a-zA-Z0-9_]/g, '').slice(0, 33);
  }

  function getInput(formEl, name) {
    return formEl.querySelector(`[name="${name}"]`);
  }

  function clearFieldError(formEl, name) {
    const input = getInput(formEl, name);
    const errEl = formEl.querySelector(`[data-error-for="${name}"]`);
    input?.classList.remove('crm-modal__input--error', 'crm-modal__select--error', 'crm-modal__textarea--error');
    input?.removeAttribute('aria-invalid');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
  }

  function showFieldError(formEl, name, message) {
    const input = getInput(formEl, name);
    const errEl = formEl.querySelector(`[data-error-for="${name}"]`);
    if (input) {
      const cls = input.tagName === 'SELECT'
        ? 'crm-modal__select--error'
        : input.tagName === 'TEXTAREA'
          ? 'crm-modal__textarea--error'
          : 'crm-modal__input--error';
      input.classList.add(cls);
      input.setAttribute('aria-invalid', 'true');
    }
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }

  function clearErrors(formEl) {
    formEl.querySelectorAll('.crm-modal__input, .crm-modal__select, .crm-modal__textarea').forEach((el) => {
      el.classList.remove('crm-modal__input--error', 'crm-modal__select--error', 'crm-modal__textarea--error');
      el.removeAttribute('aria-invalid');
    });
    formEl.querySelectorAll('[data-error-for]').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
  }

  function showErrors(formEl, errors) {
    errors.forEach(({ name, message }) => showFieldError(formEl, name, message));
    formEl.querySelector('.crm-modal__input--error, .crm-modal__select--error, .crm-modal__textarea--error')?.focus();
  }

  function setHint(formEl, name, text, tone = 'neutral') {
    const el = formEl.querySelector(`[data-hint-for="${name}"]`);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('crm-modal__hint--ok', 'crm-modal__hint--warn');
    if (tone === 'ok') el.classList.add('crm-modal__hint--ok');
    if (tone === 'warn') el.classList.add('crm-modal__hint--warn');
  }

  function formatMoney(amount, currency) {
    return `${Number(amount || 0).toLocaleString('uk-UA')} ${currency}`;
  }

  function convertToDealCurrency(amount, from, to) {
    if (from === to) return amount;
    if (window.CrmCurrency) return Math.round(CrmCurrency.convert(amount, from, to));
    return amount;
  }

  function validateField(field, value, formEl) {
    const rule = field.validate || (field.type === 'select' ? 'select' : field.type === 'tel' ? 'phone' : field.type === 'date' ? 'date' : 'text');
    const fn = RULES[rule] || RULES.text;
    if (rule === 'paymentAmount') return fn(value, Boolean(field.required), field, formEl);
    return fn(value, Boolean(field.required), field);
  }

  function validateForm(config, data, formEl) {
    const errors = [];

    config.fields.forEach((field) => {
      const message = validateField(field, data[field.name], formEl);
      if (message) errors.push({ name: field.name, message });
    });

    if (config.storeType === 'carriers' && data.departure && data.eta && data.eta < data.departure) {
      errors.push({ name: 'eta', message: 'ETA не може бути раніше відправлення' });
    }

    if (config.storeType === 'payments' && data.date) {
      const today = CrmStore?.todayISO?.() || new Date().toISOString().slice(0, 10);
      if (data.date > today) {
        errors.push({ name: 'date', message: 'Дата платежу не може бути в майбутньому' });
      }
    }

    return errors;
  }

  function bindInputHandlers(formEl, field) {
    const input = getInput(formEl, field.name);
    if (!input) return;

    const rule = field.validate || (field.type === 'tel' ? 'phone' : null);

    if (rule === 'phone' || field.type === 'tel') {
      input.inputMode = 'tel';
      input.autocomplete = 'tel';
      input.maxLength = 20;
      input.addEventListener('input', () => {
        const next = sanitizePhone(input.value);
        if (next !== input.value) input.value = next;
        clearFieldError(formEl, field.name);
      });
    }

    if (rule === 'telegram') {
      input.autocomplete = 'off';
      input.maxLength = 33;
      input.addEventListener('input', () => {
        const next = sanitizeTelegram(input.value);
        if (next !== input.value) input.value = next;
        clearFieldError(formEl, field.name);
      });
    }

    if (rule === 'year' || rule === 'price' || rule === 'integer' || rule === 'paymentAmount') {
      input.inputMode = 'numeric';
      input.addEventListener('input', () => {
        const next = sanitizeDigits(input.value);
        if (field.validate === 'year') {
          input.value = next.slice(0, 4);
        } else {
          input.value = next.slice(0, 9);
        }
        clearFieldError(formEl, field.name);
      });
    }

    if (rule === 'name' || rule === 'car' || rule === 'text' || rule === 'criteria' || rule === 'route') {
      input.addEventListener('input', () => clearFieldError(formEl, field.name));
    }

    if (field.type === 'date') {
      input.addEventListener('change', () => clearFieldError(formEl, field.name));
    }

    input.addEventListener('blur', () => {
      const message = validateField(field, input.value, formEl);
      if (message) showFieldError(formEl, field.name, message);
    });

    if (field.type === 'select') {
      input.addEventListener('change', () => clearFieldError(formEl, field.name));
    }
  }

  function bindCarrierHints(formEl) {
    const carsInput = getInput(formEl, 'cars');
    const dep = getInput(formEl, 'departure');
    const eta = getInput(formEl, 'eta');

    const refreshCars = () => {
      const num = Number(carsInput?.value || 0);
      if (!num) {
        setHint(formEl, 'cars', 'Від 1 до 20 авто на один рейс');
        return;
      }
      if (num > 4) {
        setHint(formEl, 'cars', `${num} авто — перевищує типовий кузов (4)`, 'warn');
        return;
      }
      setHint(formEl, 'cars', `На возі буде ${num} з 4 місць`, 'ok');
    };

    const refreshDates = () => {
      if (dep?.value && eta?.value && eta.value < dep.value) {
        setHint(formEl, 'eta', 'ETA має бути не раніше дати відправлення', 'warn');
        return;
      }
      if (dep?.value && eta?.value) {
        const days = Math.round((new Date(eta.value) - new Date(dep.value)) / 86400000);
        setHint(formEl, 'eta', days > 0 ? `В дорозі ~${days} дн.` : 'ETA в той самий день', 'ok');
        return;
      }
      setHint(formEl, 'departure', 'Дата завантаження на автовоз');
      setHint(formEl, 'eta', 'Очікувана дата прибуття в Україну');
    };

    carsInput?.addEventListener('input', () => {
      refreshCars();
      clearFieldError(formEl, 'cars');
    });
    dep?.addEventListener('change', () => {
      refreshDates();
      clearFieldError(formEl, 'departure');
    });
    eta?.addEventListener('change', () => {
      refreshDates();
      clearFieldError(formEl, 'eta');
    });

    refreshCars();
    refreshDates();
  }

  function bindPaymentHints(formEl) {
    const dealSelect = getInput(formEl, 'deal_id');
    const amountInput = getInput(formEl, 'amount');
    const currencySelect = getInput(formEl, 'currency');
    const dateInput = getInput(formEl, 'date');

    const refreshDealHint = () => {
      const deal = dealSelect?.value ? CrmStore.getDeal(dealSelect.value) : null;
      if (!deal) {
        setHint(formEl, 'deal_id', 'Оберіть угоду з несплаченим боргом');
        return;
      }
      if ((deal.debt || 0) <= 0) {
        setHint(formEl, 'deal_id', 'У цієї угоди немає боргу — оберіть іншу', 'warn');
      } else {
        setHint(formEl, 'deal_id', `Поточний борг: ${formatMoney(deal.debt, deal.currency)}`);
      }
      if (currencySelect && deal.currency) currencySelect.value = deal.currency;
      refreshAmountHint();
    };

    const refreshAmountHint = () => {
      const deal = dealSelect?.value ? CrmStore.getDeal(dealSelect.value) : null;
      const raw = String(amountInput?.value ?? '').trim();
      if (!deal) {
        setHint(formEl, 'amount', 'Сума часткового або повного погашення боргу');
        return;
      }
      if (!raw) {
        setHint(formEl, 'amount', `Можна внести до ${formatMoney(deal.debt, deal.currency)}`);
        return;
      }
      const amount = Number(raw);
      const payCurrency = currencySelect?.value || deal.currency;
      const inDealCurrency = convertToDealCurrency(amount, payCurrency, deal.currency);
      if (Number.isNaN(amount) || amount <= 0) {
        setHint(formEl, 'amount', 'Вкажіть суму цілим числом', 'warn');
        return;
      }
      if (inDealCurrency > deal.debt) {
        setHint(formEl, 'amount', `Перевищує борг — max ${formatMoney(deal.debt, deal.currency)}`, 'warn');
        return;
      }
      const left = deal.debt - inDealCurrency;
      if (left <= 0) {
        setHint(formEl, 'amount', 'Угода буде повністю оплачена', 'ok');
        return;
      }
      setHint(formEl, 'amount', `Залишиться борг: ${formatMoney(left, deal.currency)}`, 'ok');
    };

    const refreshDateHint = () => {
      const today = CrmStore.todayISO();
      if (!dateInput?.value) {
        setHint(formEl, 'date', 'Дата отримання коштів від клієнта');
        return;
      }
      if (dateInput.value > today) {
        setHint(formEl, 'date', 'Дата не може бути в майбутньому', 'warn');
        return;
      }
      setHint(formEl, 'date', 'Дата платежу коректна', 'ok');
    };

    dealSelect?.addEventListener('change', () => {
      refreshDealHint();
      clearFieldError(formEl, 'deal_id');
    });
    amountInput?.addEventListener('input', () => {
      refreshAmountHint();
      clearFieldError(formEl, 'amount');
    });
    currencySelect?.addEventListener('change', () => {
      refreshAmountHint();
      clearFieldError(formEl, 'amount');
    });
    dateInput?.addEventListener('change', () => {
      refreshDateHint();
      clearFieldError(formEl, 'date');
    });

    refreshDealHint();
    refreshDateHint();
  }

  function bindCrossField(formEl, config) {
    if (config.storeType === 'carriers') {
      const dep = getInput(formEl, 'departure');
      const eta = getInput(formEl, 'eta');
      const check = () => {
        if (dep?.value && eta?.value && eta.value < dep.value) {
          showFieldError(formEl, 'eta', 'ETA не може бути раніше відправлення');
          return;
        }
        if (eta?.value) clearFieldError(formEl, 'eta');
      };
      dep?.addEventListener('change', check);
      eta?.addEventListener('change', check);
      return;
    }

    if (config.storeType === 'payments') {
      const amountInput = getInput(formEl, 'amount');
      const dealSelect = getInput(formEl, 'deal_id');
      const check = () => {
        const field = config.fields.find((f) => f.name === 'amount');
        const message = validateField(field, amountInput?.value, formEl);
        if (message && amountInput?.value) showFieldError(formEl, 'amount', message);
      };
      amountInput?.addEventListener('blur', check);
      dealSelect?.addEventListener('change', check);
    }
  }

  function bindLiveHints(formEl, config) {
    if (config.storeType === 'payments') bindPaymentHints(formEl);
    if (config.storeType === 'deals' && window.CrmClientSuggest) {
      CrmClientSuggest.bind(formEl);
    }
    if (config.storeType === 'carriers') {
      if (window.CrmRoute) CrmRoute.bind(formEl);
      bindCarrierHints(formEl);
    }
  }

  function bindForm(formEl, config) {
    if (!formEl || !config) return;
    config.fields.forEach((field) => bindInputHandlers(formEl, field));
    bindCrossField(formEl, config);
    bindLiveHints(formEl, config);
  }

  return {
    bindForm,
    validateForm,
    clearErrors,
    showErrors,
    showFieldError,
    clearFieldError,
    setHint,
  };
})();

window.CrmValidation = CrmValidation;

/* === crm-route.js === */
/**
 * Автодоповнення міст у полі маршруту (CH → UA)
 */
const CrmRoute = (() => {
  const ARROW = ' → ';

  const CITIES = [
    'Цюрих', 'Берн', 'Женева', 'Базель', 'Люцерн',
    'Гамбург', 'Мюнхен', 'Берлін', 'Франкфурт', 'Штутгарт', 'Кельн',
    'Львів', 'Київ', 'Одеса', 'Харків', 'Дніпро', 'Запоріжжя', 'Вінниця',
    'Відень', 'Прага',
  ];

  function normalize(str) {
    return String(str ?? '').trim().toLowerCase();
  }

  function parseRoute(value) {
    const match = String(value ?? '').match(/^(.+?)\s*[→\-–—]\s*(.*)$/);
    if (match) {
      return {
        origin: match[1].trim(),
        destination: match[2].trim(),
        hasArrow: true,
      };
    }
    return { origin: String(value ?? '').trim(), destination: '', hasArrow: false };
  }

  function filterCities(query, limit = 8) {
    const q = normalize(query);
    if (!q) return CITIES.slice(0, limit);
    return CITIES.filter((city) => normalize(city).includes(q)).slice(0, limit);
  }

  function bind(formEl) {
    const input = formEl.querySelector('[name="route"]');
    if (!input) return;

    const wrap = input.closest('[data-route-combo]') || input.parentElement;
    let list = wrap.querySelector('.crm-modal__suggest');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'crm-modal__suggest';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      wrap.appendChild(list);
    }

    let hideTimer = null;

    function hideSuggestions() {
      list.hidden = true;
      list.innerHTML = '';
    }

    function showSuggestions(items, onPick) {
      list.innerHTML = '';
      if (!items.length) {
        hideSuggestions();
        return;
      }
      items.forEach((city) => {
        const li = document.createElement('li');
        li.className = 'crm-modal__suggest-item';
        li.setAttribute('role', 'option');
        li.textContent = city;
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          onPick(city);
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    function updateHint() {
      if (!window.CrmValidation?.setHint) return;
      const parsed = parseRoute(input.value);
      if (!parsed.origin) {
        CrmValidation.setHint(formEl, 'route', 'Почніть вводити місто відправлення');
        return;
      }
      if (!parsed.hasArrow) {
        CrmValidation.setHint(formEl, 'route', 'Оберіть місто зі списку — стрілку → додамо автоматично');
        return;
      }
      if (!parsed.destination) {
        CrmValidation.setHint(formEl, 'route', 'Тепер оберіть місто прибуття в Україну');
        return;
      }
      CrmValidation.setHint(formEl, 'route', 'Маршрут виглядає коректно', 'ok');
    }

    function pickCity(city) {
      const parsed = parseRoute(input.value);
      if (!parsed.hasArrow) {
        input.value = `${city}${ARROW}`;
        input.focus();
        const pos = input.value.length;
        input.setSelectionRange(pos, pos);
        showSuggestions(filterCities(''), pickCity);
        updateHint();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      input.value = `${parsed.origin}${ARROW}${city}`;
      hideSuggestions();
      updateHint();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function refreshSuggestions() {
      const parsed = parseRoute(input.value);
      if (parsed.hasArrow && parsed.destination) {
        const exact = CITIES.find((c) => normalize(c) === normalize(parsed.destination));
        if (exact) {
          hideSuggestions();
          updateHint();
          return;
        }
      }

      const query = parsed.hasArrow ? parsed.destination : parsed.origin;
      showSuggestions(filterCities(query), pickCity);
      updateHint();
    }

    input.addEventListener('input', () => {
      window.clearTimeout(hideTimer);
      refreshSuggestions();
      if (window.CrmValidation?.clearFieldError) {
        CrmValidation.clearFieldError(formEl, 'route');
      }
    });

    input.addEventListener('focus', refreshSuggestions);

    input.addEventListener('blur', () => {
      hideTimer = window.setTimeout(hideSuggestions, 180);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideSuggestions();
    });

    updateHint();
  }

  return { bind, parseRoute, ARROW, CITIES };
})();

window.CrmRoute = CrmRoute;

/* === crm-client-suggest.js === */
/**
 * Автодоповнення імені клієнта в формі створення угоди (icontains API).
 */
const CrmClientSuggest = (() => {
  const ENDPOINT = '/api/clients/suggest/';
  const MIN_CHARS = 1;
  const DEBOUNCE_MS = 180;

  function bind(formEl) {
    const input = formEl.querySelector('[name="client"]');
    if (!input || input.dataset.clientSuggestBound === '1') return;
    input.dataset.clientSuggestBound = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'words');
    input.setAttribute('spellcheck', 'false');

    const wrap = input.closest('[data-client-combo]') || input.parentElement;
    if (wrap && !wrap.classList.contains('crm-modal__combo')) {
      wrap.classList.add('crm-modal__combo');
    }

    let list = wrap.querySelector('.crm-modal__suggest');
    if (!list) {
      list = document.createElement('ul');
      list.className = 'crm-modal__suggest';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      wrap.appendChild(list);
    }

    let timer = null;
    let abortCtrl = null;
    let activeIndex = -1;

    function hide() {
      list.hidden = true;
      list.innerHTML = '';
      activeIndex = -1;
    }

    function pick(name) {
      input.value = name;
      hide();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }

    function render(items) {
      list.innerHTML = '';
      activeIndex = -1;
      if (!items.length) {
        hide();
        return;
      }
      items.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'crm-modal__suggest-item';
        li.setAttribute('role', 'option');
        li.dataset.index = String(idx);
        li.textContent = item.name;
        li.addEventListener('mousedown', (event) => {
          event.preventDefault();
          pick(item.name);
        });
        list.appendChild(li);
      });
      list.hidden = false;
    }

    function highlight(next) {
      const items = list.querySelectorAll('.crm-modal__suggest-item');
      if (!items.length) return;
      activeIndex = (next + items.length) % items.length;
      items.forEach((el, i) => {
        el.classList.toggle('crm-modal__suggest-item--active', i === activeIndex);
      });
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function fetchSuggest(q) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();
      const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=8`;
      fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: abortCtrl.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((payload) => {
          const rows = Array.isArray(payload?.data) ? payload.data : (payload?.data?.results || []);
          const items = (Array.isArray(rows) ? rows : [])
            .map((row) => ({ name: String(row.name || row).trim() }))
            .filter((row) => row.name);
          render(items);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          hide();
        });
    }

    input.addEventListener('input', () => {
      const q = input.value.trim();
      window.clearTimeout(timer);
      if (q.length < MIN_CHARS) {
        hide();
        return;
      }
      // Стан: очікування debounce → запит API → dropdown
      timer = window.setTimeout(() => fetchSuggest(q), DEBOUNCE_MS);
    });

    input.addEventListener('keydown', (event) => {
      if (list.hidden) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlight(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlight(activeIndex - 1);
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        const el = list.querySelector(`.crm-modal__suggest-item[data-index="${activeIndex}"]`);
        if (el) pick(el.textContent);
      } else if (event.key === 'Escape') {
        hide();
      }
    });

    input.addEventListener('blur', () => {
      window.setTimeout(hide, 120);
    });
  }

  return { bind };
})();

window.CrmClientSuggest = CrmClientSuggest;

/* === crm-render.js === */
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
      <img src="${escapeHtml(deal.image || DEFAULT_CAR_IMAGE)}" alt="${escapeHtml(deal.car)}" class="deal-row__thumb" loading="lazy" referrerpolicy="no-referrer">
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
      return Boolean(document.querySelector(
        `[data-deals-list] [data-deal-id="${CSS.escape(item.id)}"],`
        + `[data-deals-table] [data-deal-id="${CSS.escape(item.id)}"],`
        + `.kanban-board [data-deal-id="${CSS.escape(item.id)}"],`
        + `[data-recent-deals] [data-deal-id="${CSS.escape(item.id)}"]`
      ));
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
    /* На сторінці звіту ніколи не чіпати #report-table-body */
    if (document.getElementById('report-table-body') && !document.querySelector('[data-deals-table]')) {
      return null;
    }
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

    const tbody = document.querySelector('[data-deals-table] tbody');
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
    const onReportPage = Boolean(document.getElementById('report-table-body'));
    ['clients', 'leads', 'deals', 'carriers'].forEach((type) => {
      if (type === 'deals' && onReportPage) return;
      CrmStore.getItems(type).forEach((item) => {
        append(type, item, { animate: false });
      });
    });
    document.dispatchEvent(new CustomEvent('crm:render-mounted'));
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
  const start = () => {
    CrmRender.mountAll();
    if (window.CrmCurrency) CrmCurrency.applyAll();
  };
  if (window.CrmStore && typeof CrmStore.ready === 'function') {
    CrmStore.ready().then(start);
    return;
  }
  start();
});

/* === crm-due-payments.js === */
/**
 * Блок «Місце оплати»
 * Ввод — у валюті toolbar (CHF/EUR/USD) або форми; збереження — у валюті угоди/рядка
 */
const CrmDuePayments = (() => {
  const PLACES = ['На офісі', 'Біля авто', 'На місці', 'Банк'];

  function sanitizeDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseComposerAmount(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return 0;
    const digits = sanitizeDigits(text);
    if (digits) {
      const n = Number(digits);
      return Number.isFinite(n) ? n : 0;
    }
    if (window.CrmCurrency?.parseAmount) {
      const n = Math.round(CrmCurrency.parseAmount(text));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  function getComposerInput(root) {
    return root?.querySelector?.('input[data-due-amount]') || null;
  }

  function getInputCurrency(storedCurrency, syncWithToolbar) {
    const stored = storedCurrency || 'CHF';
    if (syncWithToolbar !== false && window.CrmCurrency && CrmCurrency.isActive()) {
      return CrmCurrency.get();
    }
    return stored;
  }

  function convertAmount(amount, from, to) {
    const value = Number(amount) || 0;
    if (from === to) return value;
    if (window.CrmCurrency) return Math.round(CrmCurrency.convert(value, from, to));
    return value;
  }

  function toInputAmount(amount, storedCurrency, inputCurrency) {
    return convertAmount(amount, storedCurrency, inputCurrency);
  }

  function toStoredAmount(amount, storedCurrency, inputCurrency) {
    return convertAmount(amount, inputCurrency, storedCurrency);
  }

  function formatLabel(amount, currency) {
    const code = currency || 'CHF';
    const value = Number(amount) || 0;
    if (window.CrmCurrency) return CrmCurrency.label(value, code);
    return `${value.toLocaleString('uk-UA')} ${code}`;
  }

  function formatAmount(amount, storedCurrency, syncWithToolbar = true) {
    const input = getInputCurrency(storedCurrency, syncWithToolbar);
    return formatLabel(toInputAmount(amount, storedCurrency, input), input);
  }

  function itemsToInput(items, storedCurrency, inputCurrency) {
    return items.map((item) => ({
      ...item,
      amount: toInputAmount(item.amount, storedCurrency, inputCurrency),
    }));
  }

  function reconvertItems(items, storedCurrency, fromInput, toInput) {
    return items.map((item) => ({
      ...item,
      amount: toInputAmount(toStoredAmount(item.amount, storedCurrency, fromInput), storedCurrency, toInput),
    }));
  }

  function placeOptions(selected) {
    return PLACES.map((place) => (
      `<option value="${escapeHtml(place)}"${place === selected ? ' selected' : ''}>${escapeHtml(place)}</option>`
    )).join('');
  }

  function setAmountError(root, message) {
    const box = root.querySelector('[data-due-amount-box]');
    const err = root.querySelector('[data-due-amount-error]');
    box?.classList.toggle('crm-due-widget__amount-box--error', Boolean(message));
    if (err) {
      err.hidden = !message;
      err.textContent = message || '';
    }
  }

  function readList(root) {
    const items = [];
    root.querySelectorAll('[data-due-item]').forEach((row) => {
      items.push({
        id: row.dataset.dueId,
        amount: Number(row.dataset.dueItemAmount) || 0,
        place: row.dataset.duePlace || PLACES[0],
      });
    });
    return items;
  }

  function updateAmountPreview(root, inputCurrency) {
    const input = getComposerInput(root);
    const preview = root.querySelector('[data-due-preview]');
    const codeEl = root.querySelector('[data-due-currency-code]');
    const code = inputCurrency || 'CHF';

    if (codeEl) codeEl.textContent = code;

    if (!preview || !input) return;
    const amount = parseComposerAmount(input.value);
    preview.textContent = amount ? formatLabel(amount, code) : '';
  }

  function renderList(root, items, inputCurrency) {
    const list = root.querySelector('[data-due-list]');
    if (!list) return;

    root.dataset.inputCurrency = inputCurrency;

    if (!items.length) {
      list.innerHTML = '';
      root.classList.remove('crm-due-widget--filled');
      return;
    }

    root.classList.add('crm-due-widget--filled');
    list.innerHTML = items.map((item) => `
      <div
        class="crm-due-widget__item"
        data-due-item
        data-due-id="${escapeHtml(item.id)}"
        data-due-item-amount="${item.amount}"
        data-due-place="${escapeHtml(item.place)}"
      >
        <span class="crm-due-widget__badge">${escapeHtml(item.place)}</span>
        <span class="mono crm-due-widget__item-amount">${formatLabel(item.amount, inputCurrency)}</span>
        <button type="button" class="crm-due-widget__remove" data-due-remove="${escapeHtml(item.id)}" aria-label="Видалити ${escapeHtml(item.place)}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');

    list.querySelectorAll('[data-due-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = readList(root).filter((row) => row.id !== btn.dataset.dueRemove);
        renderList(root, next, inputCurrency);
        root.dispatchEvent(new CustomEvent('crm:due-changed', { bubbles: true }));
      });
    });
  }

  function bindAdd(root, ctx) {
    const addBtn = root.querySelector('[data-due-add]');
    let lastKnownAmount = 0;

    const syncKnownAmount = () => {
      const amountInput = getComposerInput(root);
      lastKnownAmount = parseComposerAmount(amountInput?.value);
      return lastKnownAmount;
    };

    root.addEventListener('input', (event) => {
      const amountInput = event.target?.closest?.('input[data-due-amount]');
      if (!amountInput || !root.contains(amountInput)) return;
      amountInput.value = sanitizeDigits(amountInput.value).slice(0, 9);
      setAmountError(root, '');
      syncKnownAmount();
      updateAmountPreview(root, ctx.getInput());
    });

    // iOS Safari: значення інколи «губиться» між blur і click — фіксуємо на pointerdown
    root.addEventListener('pointerdown', (event) => {
      if (!event.target?.closest?.('[data-due-add]')) return;
      syncKnownAmount();
    }, true);

    const addItem = ({ silent = false } = {}) => {
      const amountInput = getComposerInput(root);
      const inputCurrency = ctx.getInput();
      const amount = parseComposerAmount(amountInput?.value) || lastKnownAmount || 0;
      const place = root.querySelector('[data-due-place]')?.value || PLACES[0];

      if (!amount) {
        if (!silent) {
          setAmountError(root, 'Вкажіть суму');
          if (typeof showToast === 'function') showToast('Вкажіть суму', 'info');
          amountInput?.focus();
        }
        return false;
      }

      const items = readList(root);
      items.push({ id: `due-${Date.now()}-${items.length}`, amount, place });
      if (amountInput) amountInput.value = '';
      lastKnownAmount = 0;
      setAmountError(root, '');
      updateAmountPreview(root, inputCurrency);
      renderList(root, items, inputCurrency);
      root.dispatchEvent(new CustomEvent('crm:due-changed', { bubbles: true }));
      return true;
    };

    addBtn?.addEventListener('click', (event) => {
      event.preventDefault();
      addItem();
    });

    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (!event.target?.closest?.('input[data-due-amount]')) return;
      event.preventDefault();
      addItem();
    });

    root.__crmDueAddItem = addItem;
  }

  function mount(root, options = {}) {
    if (!root) return null;
    let storedCurrency = options.currency || 'CHF';
    const syncWithToolbar = options.syncWithToolbar !== false;
    const inputClass = options.inputClass || 'crm-due-widget__input';
    const storedItems = Array.isArray(options.items) ? options.items : [];

    root.innerHTML = `
      <div class="crm-due-widget" data-due-widget>
        <div class="crm-due-widget__list-wrap">
          <div class="crm-due-widget__list" data-due-list></div>
        </div>
        <div class="crm-due-widget__composer">
          <div class="crm-due-widget__row">
            <div class="crm-due-widget__cell crm-due-widget__cell--amount">
              <span class="crm-due-widget__label">Сума</span>
              <div class="crm-due-widget__amount-box" data-due-amount-box>
                <input class="${inputClass}" type="text" data-due-amount inputmode="numeric" maxlength="9" placeholder="1500" autocomplete="off" enterkeyhint="done">
                <span class="crm-due-widget__amount-currency" data-due-currency-code></span>
              </div>
              <p class="crm-due-widget__error" data-due-amount-error hidden></p>
            </div>
            <div class="crm-due-widget__cell crm-due-widget__cell--place">
              <span class="crm-due-widget__label">Місце</span>
              <select class="${inputClass}" data-due-place>${placeOptions(PLACES[0])}</select>
            </div>
            <div class="crm-due-widget__cell crm-due-widget__cell--action">
              <span class="crm-due-widget__label crm-due-widget__label--ghost" aria-hidden="true">&nbsp;</span>
              <button type="button" class="crm-due-widget__submit" data-due-add>Додати</button>
            </div>
          </div>
          <span class="crm-due-widget__preview mono" data-due-preview aria-live="polite"></span>
        </div>
      </div>`;

    const widget = root.querySelector('[data-due-widget]') || root;
    const ctx = {
      getStored: () => storedCurrency,
      getInput: () => getInputCurrency(storedCurrency, syncWithToolbar),
      syncWithToolbar,
    };

    renderList(widget, itemsToInput(storedItems, storedCurrency, ctx.getInput()), ctx.getInput());
    bindAdd(widget, ctx);
    updateAmountPreview(widget, ctx.getInput());

    const onToolbarChange = () => {
      if (!syncWithToolbar) return;
      const fromInput = widget.dataset.inputCurrency || ctx.getInput();
      const toInput = getInputCurrency(storedCurrency, syncWithToolbar);
      if (fromInput === toInput) return;
      const items = reconvertItems(readList(widget), storedCurrency, fromInput, toInput);
      renderList(widget, items, toInput);
      updateAmountPreview(widget, toInput);
    };
    document.addEventListener('crm:currency-change', onToolbarChange);

    return {
      read: () => {
        // Якщо сума введена, але «Додати» не натиснули — підхоплюємо чернетку
        widget.__crmDueAddItem?.({ silent: true });
        const inputCurrency = ctx.getInput();
        return readList(widget).map((item) => ({
          ...item,
          amount: toStoredAmount(item.amount, storedCurrency, inputCurrency),
        }));
      },
      commitDraft() {
        return Boolean(widget.__crmDueAddItem?.({ silent: true }));
      },
      setCurrency(nextCurrency) {
        const fromInput = ctx.getInput();
        storedCurrency = nextCurrency || 'CHF';
        const toInput = ctx.getInput();
        const items = reconvertItems(readList(widget), storedCurrency, fromInput, toInput);
        renderList(widget, items, toInput);
        updateAmountPreview(widget, toInput);
      },
      destroy() {
        document.removeEventListener('crm:currency-change', onToolbarChange);
        delete widget.__crmDueAddItem;
      },
    };
  }

  function read(root) {
    const widget = root?.querySelector('[data-due-widget]') || root;
    if (!widget) return [];
    widget.__crmDueAddItem?.({ silent: true });
    return readList(widget);
  }

  return { mount, read, formatAmount, PLACES };
})();

window.CrmDuePayments = CrmDuePayments;

/* === crm-documents.js === */
/**
 * Прикріплення документів до угоди / рядка звіту
 */
const CrmDocuments = (() => {
  const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function todayISO() {
    return window.CrmStore?.todayISO?.() || new Date().toISOString().slice(0, 10);
  }

  function readList(root) {
    const items = [];
    root.querySelectorAll('[data-doc-item]').forEach((row) => {
      items.push({
        id: row.dataset.docId,
        name: row.dataset.docName || '',
        added: row.dataset.docAdded || '',
      });
    });
    return items;
  }

  function renderList(root, items) {
    const list = root.querySelector('[data-doc-list]');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = '';
      root.classList.remove('crm-doc-widget--filled');
      return;
    }

    root.classList.add('crm-doc-widget--filled');
    list.innerHTML = items.map((doc) => `
      <div class="crm-doc-widget__item" data-doc-item data-doc-id="${escapeHtml(doc.id)}" data-doc-name="${escapeHtml(doc.name)}" data-doc-added="${escapeHtml(doc.added || '')}">
        <span class="crm-doc-widget__icon" aria-hidden="true">📄</span>
        <div class="crm-doc-widget__body">
          <div class="crm-doc-widget__name">${escapeHtml(doc.name)}</div>
          <div class="crm-doc-widget__meta">${escapeHtml(doc.added || '')}</div>
        </div>
        <button type="button" class="crm-doc-widget__remove" data-doc-remove="${escapeHtml(doc.id)}" aria-label="Видалити ${escapeHtml(doc.name)}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`).join('');

    list.querySelectorAll('[data-doc-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = readList(root).filter((row) => row.id !== btn.dataset.docRemove);
        renderList(root, next);
        root.dispatchEvent(new CustomEvent('crm:doc-changed', { bubbles: true }));
      });
    });
  }

  function bindUpload(root) {
    const input = root.querySelector('[data-doc-input]');
    input?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const items = readList(root);
      items.unshift({
        id: `doc-${Date.now()}`,
        name: file.name,
        added: todayISO(),
      });
      renderList(root, items);
      root.dispatchEvent(new CustomEvent('crm:doc-changed', { bubbles: true }));
      if (typeof showToast === 'function') showToast(`Файл «${file.name}» прикріплено`, 'success');
      event.target.value = '';
    });
  }

  function mount(root, options = {}) {
    if (!root) return null;
    const items = Array.isArray(options.items) ? options.items : [];
    const title = options.title || 'Документи';

    root.innerHTML = `
      <div class="crm-doc-widget" data-doc-widget>
        <div class="crm-doc-widget__head">
          <span class="crm-doc-widget__title">${escapeHtml(title)}</span>
          <label class="crm-doc-widget__upload">
            Прикріпити
            <input type="file" data-doc-input accept="${ACCEPT}">
          </label>
        </div>
        <div class="crm-doc-widget__list" data-doc-list></div>
      </div>`;

    const widget = root.querySelector('[data-doc-widget]') || root;
    renderList(widget, items);
    bindUpload(widget);

    return {
      read: () => readList(widget),
    };
  }

  function read(root) {
    const widget = root?.querySelector('[data-doc-widget]') || root;
    return widget ? readList(widget) : [];
  }

  return { mount, read };
})();

window.CrmDocuments = CrmDocuments;

/* === modal.js === */
const CrmModal = (() => {
  const FORMS = {
    client: {
      title: 'Новий клієнт',
      submit: 'Додати клієнта',
      storeType: 'clients',
      fields: [
        { name: 'name', label: 'ПІБ / назва', type: 'text', required: true, validate: 'name', placeholder: 'Олександр К.' },
        { name: 'phone', label: 'Телефон', type: 'tel', required: true, validate: 'phone', placeholder: '+380 67 123 4567' },
        { name: 'telegram', label: 'Telegram', type: 'text', validate: 'telegram', placeholder: '@username' },
        {
          name: 'currency',
          label: 'Валюта',
          type: 'select',
          options: [{ value: 'CHF', label: 'CHF' }, { value: 'EUR', label: 'EUR' }],
          default: 'CHF',
        },
      ],
      build(data) {
        return {
          name: data.name.trim(),
          phone: data.phone.trim(),
          telegram: data.telegram.trim(),
          deals: 0,
          debt: 0,
          currency: data.currency,
        };
      },
    },
    lead: {
      title: 'Новий VIP-запит',
      submit: 'Створити запит',
      storeType: 'leads',
      fields: [
        { name: 'client', label: 'Клієнт', type: 'text', required: true, validate: 'name', placeholder: 'Імʼя та прізвище' },
        { name: 'phone', label: 'Телефон', type: 'tel', required: true, validate: 'phone', placeholder: '+380 XX XXX XXXX' },
        {
          name: 'criteria',
          label: 'Критерії пошуку',
          type: 'textarea',
          required: true,
          validate: 'criteria',
          placeholder: 'Марка, рік, бюджет…',
        },
      ],
      build(data) {
        return {
          id: CrmStore.nextId('leads'),
          client: data.client.trim(),
          phone: data.phone.trim(),
          criteria: data.criteria.trim(),
          date: CrmStore.todayISO(),
          manager: 'Тимофій',
          status: 'new',
          status_label: 'Новий',
          candidates: 0,
        };
      },
    },
    deal: {
      title: 'Нова угода',
      submit: 'Створити угоду',
      storeType: 'deals',
      fields: [
        { name: 'car', label: 'Авто', type: 'text', required: true, validate: 'car', placeholder: 'BMW X5 xDrive40d' },
        { name: 'year', label: 'Рік', type: 'text', required: true, validate: 'year', placeholder: '2021' },
        { name: 'client', label: 'Клієнт', type: 'text', required: true, validate: 'name', autocomplete: 'client', placeholder: 'Олександр К.' },
        { name: 'phone', label: 'Телефон', type: 'tel', validate: 'phone', placeholder: '+380 67 123 4567' },
        { name: 'lot_url', label: 'Посилання auto-lot.com', type: 'lot_url', placeholder: 'https://auto-lot.com/lot/12345' },
        { name: 'won_price', label: 'Виграна', type: 'amount_currency', currencyName: 'won_currency', validate: 'price', placeholder: '38000' },
        { name: 'bid', label: 'Ставка', type: 'amount_currency', currencyName: 'bid_currency', validate: 'price', placeholder: '37500' },
        { name: 'cost', label: 'Собівартість', type: 'amount_currency', currencyName: 'cost_currency', validate: 'price', placeholder: '34000' },
        { name: 'price', label: 'Клієнту', type: 'amount_currency', currencyName: 'price_currency', required: true, validate: 'price', placeholder: '42500' },
        { name: 'delivery_cost', label: 'Доставка (якщо наша)', type: 'amount_currency', currencyName: 'delivery_currency', validate: 'price', placeholder: '1800' },
        { name: 'commission', label: 'Комісія', type: 'text', validate: 'price', placeholder: '2100', hint: 'Вводиться вручну' },
        {
          name: 'execution',
          label: 'Етап виконання',
          type: 'select',
          options: [
            { value: 'won', label: 'Виграно' },
            { value: 'confirmed', label: 'Підтверджено' },
            { value: 'picked', label: 'Забрано' },
            { value: 'in_transit', label: 'В дорозі' },
            { value: 'customs', label: 'Розмитнено' },
            { value: 'delivered', label: 'Доставлено' },
          ],
          default: 'won',
        },
        { name: 'due_payments', label: 'Місце оплати', type: 'due_payments' },
        { name: 'documents', label: 'Документи', type: 'documents' },
      ],
      build(data) {
        const price = Number(data.price) || 0;
        const EXEC_LABELS = {
          won: 'Виграно', confirmed: 'Підтверджено', picked: 'Забрано',
          in_transit: 'В дорозі', customs: 'Розмитнено', delivered: 'Доставлено',
        };
        return {
          id: CrmStore.nextId('deals'),
          car: data.car.trim(),
          year: Number(data.year),
          client: data.client.trim(),
          phone: data.phone.trim(),
          lot_url: (data.lot_url || '').trim(),
          won_price: Number(data.won_price) || 0,
          bid: Number(data.bid) || 0,
          cost: Number(data.cost) || Math.round(price * 0.82),
          delivery_cost: Number(data.delivery_cost) || 0,
          commission: Number(data.commission) || 0,
          execution: data.execution,
          execution_label: EXEC_LABELS[data.execution] || data.execution,
          payment: 'pending',
          payment_label: 'Очікує',
          price,
          paid: 0,
          debt: price,
          currency: data.price_currency || 'CHF',
          won_currency: data.won_currency || 'CHF',
          bid_currency: data.bid_currency || 'CHF',
          cost_currency: data.cost_currency || 'CHF',
          price_currency: data.price_currency || 'CHF',
          delivery_currency: data.delivery_currency || 'CHF',
          profit: Math.round(price * 0.08),
          vin: '',
          image: _fetchedLotImage || (window.CrmRender ? CrmRender.DEFAULT_CAR_IMAGE : ''),
          delivery_type: Number(data.delivery_cost) > 0 ? 'ours' : 'pickup',
        };
      },
    },
    carrier: {
      title: 'Новий рейс',
      submit: 'Додати рейс',
      storeType: 'carriers',
      fields: [
        { name: 'driver', label: 'Водій', type: 'text', required: true, placeholder: 'Михайло Коваль' },
        { name: 'plate', label: 'Номер автовоза', type: 'text', required: true, placeholder: 'CH-ZH 4821' },
        { name: 'route', label: 'Маршрут', type: 'text', required: true, validate: 'route', autocomplete: 'route', placeholder: 'Цюрих', hint: 'Оберіть місто відправлення, потім прибуття' },
        { name: 'cars', label: 'Кількість авто', type: 'text', required: true, validate: 'integer', min: 1, max: 20, placeholder: '4', hint: 'Від 1 до 20 авто на рейс' },
        { name: 'departure', label: 'Відправлення', type: 'date', required: true, validate: 'date', hint: 'Дата завантаження на автовоз' },
        { name: 'eta', label: 'ETA', type: 'date', required: true, validate: 'date', hint: 'Очікувана дата прибуття в UA' },
        {
          name: 'status',
          label: 'Статус',
          type: 'select',
          options: [
            { value: 'loading', label: 'Завантаження' },
            { value: 'in_transit', label: 'В дорозі' },
          ],
          default: 'loading',
        },
        { name: 'assigned_deals', label: 'Авто на борту (виграні/підтверджені)', type: 'carrier_deals' },
      ],
      build(data) {
        const labels = { loading: 'Завантаження', in_transit: 'В дорозі' };
        const assigned = [];
        document.querySelectorAll('[data-carrier-deal-check]:checked').forEach((el) => {
          assigned.push(el.value);
        });
        return {
          id: CrmStore.nextId('carriers'),
          driver: (data.driver || '').trim(),
          plate: (data.plate || '').trim(),
          route: data.route.trim(),
          cars: Number(data.cars) || 1,
          departure: data.departure,
          eta: data.eta,
          status: data.status,
          status_label: labels[data.status] || data.status,
          assigned_deals: assigned,
          documents: [],
        };
      },
    },
    payment: {
      title: 'Новий платіж',
      submit: 'Записати платіж',
      storeType: 'payments',
      fields: [
        {
          name: 'deal_id',
          label: 'Призначення платежу',
          type: 'select',
          required: true,
          validate: 'select',
          options: [],
          dynamic: 'deals',
          hint: 'Оберіть угоду з несплаченим боргом',
        },
        {
          name: 'amount',
          label: 'Сума',
          type: 'text',
          required: true,
          validate: 'paymentAmount',
          placeholder: '15000',
          hint: 'Часткове або повне погашення боргу',
        },
        {
          name: 'currency',
          label: 'Валюта',
          type: 'select',
          options: [
            { value: 'CHF', label: 'CHF' },
            { value: 'EUR', label: 'EUR' },
            { value: 'USD', label: 'USD' },
          ],
          default: 'CHF',
        },
        {
          name: 'place',
          label: 'Де оплачено',
          type: 'select',
          options: [
            { value: 'На офісі', label: 'На офісі' },
            { value: 'Біля авто', label: 'Біля авто' },
            { value: 'На місці', label: 'На місці' },
            { value: 'Банк', label: 'Банк' },
          ],
          default: 'На офісі',
        },
        {
          name: 'date',
          label: 'Дата',
          type: 'date',
          required: true,
          validate: 'date',
          hint: 'Коли клієнт фактично оплатив',
        },
      ],
      build(data) {
        return {
          id: `PAY-${Date.now()}`,
          dealId: data.deal_id,
          amount: Number(data.amount),
          currency: data.currency,
          place: data.place,
          date: data.date,
        };
      },
    },
  };

  let modalEl;
  let formEl;
  let titleEl;
  let activeType = null;
  let lastFocus = null;
  let openOptions = {};
  let dealDueWidget = null;
  let dealDocWidget = null;
  let _fetchedLotImage = '';
  let scrollLockY = 0;

  function lockBodyScroll() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollLockY}px`;
  }

  function unlockBodyScroll() {
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, scrollLockY);
  }

  function init() {
    modalEl = document.getElementById('crm-modal');
    formEl = document.getElementById('crm-modal-form');
    titleEl = document.getElementById('crm-modal-title');
    if (!modalEl || !formEl) return;

    document.querySelectorAll('[data-open-modal]').forEach((btn) => {
      btn.dataset.actionBound = 'true';
      btn.addEventListener('click', () => {
        const type = btn.dataset.openModal;
        if (window.CrmPackages && !CrmPackages.guardModal(type)) return;
        open(type, {
          dealId: btn.dataset.paymentDeal || '',
          carrierPreset: btn.dataset.carrierPreset || '',
        });
      });
    });

    modalEl.addEventListener('click', (event) => {
      if (event.target.closest('[data-modal-close]')) {
        close();
      }
    });

    formEl.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKeydown);
  }

  function open(type, options = {}) {
    const config = FORMS[type];
    if (!config || !modalEl) return;

    activeType = type;
    openOptions = options;
    lastFocus = document.activeElement;
    titleEl.textContent = type === 'carrier' && options.carrierPreset
      ? 'Зібрати автовоз'
      : config.title;
    const bindConfig = type === 'payment' ? resolveConfig(config, options) : config;
    formEl.innerHTML = buildFormHtml(bindConfig);
    formEl.dataset.modalType = type;
    setDefaultDates(type);
    applyOpenOptions(type, options);

    if (type === 'carrier' && options.carrierPreset) {
      const submitBtn = formEl.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Зібрати автовоз';
    }

    if (window.CrmValidation) CrmValidation.bindForm(formEl, bindConfig);

    _fetchedLotImage = '';

    if (type === 'deal') {
      const fetchBtn = formEl.querySelector('[data-fetch-lot-photo]');
      const lotInput = formEl.querySelector('[name="lot_url"]');
      const preview = formEl.querySelector('[data-lot-preview]');
      if (fetchBtn && lotInput && preview) {
        const hidePreview = () => {
          preview.hidden = true;
          preview.removeAttribute('src');
          preview.setAttribute('aria-hidden', 'true');
        };
        hidePreview();

        preview.addEventListener('error', () => {
          _fetchedLotImage = '';
          hidePreview();
          if (typeof showToast === 'function') showToast('Не вдалося завантажити фото', 'info');
        });

        fetchBtn.addEventListener('click', () => {
          const url = lotInput.value.trim();
          if (!url) { if (typeof showToast === 'function') showToast('Введіть посилання', 'info'); return; }
          fetchBtn.disabled = true;
          fetchBtn.textContent = '…';
          hidePreview();
          fetch('/api/fetch-lot-photo/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
            body: JSON.stringify({ url }),
          })
            .then((r) => r.json())
            .then((resp) => {
              const imageUrl = resp.image_url || resp.data?.image_url;
              if (imageUrl) {
                _fetchedLotImage = imageUrl;
                preview.onload = () => {
                  preview.hidden = false;
                  preview.setAttribute('aria-hidden', 'false');
                  preview.onload = null;
                  if (typeof showToast === 'function') showToast('Фото підтягнуто', 'success');
                };
                preview.src = imageUrl;
              } else {
                if (typeof showToast === 'function') showToast(resp.error || 'Фото не знайдено', 'info');
              }
            })
            .catch(() => { if (typeof showToast === 'function') showToast('Помилка мережі', 'info'); })
            .finally(() => { fetchBtn.disabled = false; fetchBtn.textContent = 'Підтягнути фото'; });
        });
      }
    }

    if (type === 'deal' && window.CrmDuePayments) {
      const dueRoot = formEl.querySelector('[data-due-root]');
      const currency = formEl.querySelector('[name="currency"]')?.value || 'CHF';
      dealDueWidget?.destroy?.();
      dealDueWidget = CrmDuePayments.mount(dueRoot, {
        items: [],
        currency,
        syncWithToolbar: false,
      });
      const currencySelect = formEl.querySelector('[name="currency"]');
      currencySelect?.addEventListener('change', () => {
        dealDueWidget?.setCurrency(currencySelect.value);
      });
    } else {
      dealDueWidget?.destroy?.();
      dealDueWidget = null;
    }

    if (type === 'deal' && window.CrmDocuments) {
      const docRoot = formEl.querySelector('[data-doc-root]');
      dealDocWidget = CrmDocuments.mount(docRoot, {
        items: [],
        title: 'Документи',
      });
    } else {
      dealDocWidget = null;
    }

    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    lockBodyScroll();

    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) {
      const firstInput = formEl.querySelector('.crm-modal__input, .crm-modal__select, .crm-modal__textarea');
      window.requestAnimationFrame(() => firstInput?.focus());
    } else {
      formEl.scrollTop = 0;
      modalEl.querySelector('.crm-modal__dialog')?.scrollTo?.(0, 0);
    }
  }

  function close() {
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    formEl.innerHTML = '';
    activeType = null;
    openOptions = {};
    _fetchedLotImage = '';
    dealDueWidget?.destroy?.();
    dealDueWidget = null;
    dealDocWidget = null;
    lastFocus?.focus?.();
  }

  function resolveConfig(config, options) {
    if (config.storeType !== 'payments') return config;
    const deals = CrmStore.listDealsForSelect()
      .filter((deal) => deal.debt > 0)
      .map((deal) => ({
        value: deal.id,
        label: `${deal.id} · ${deal.car} · борг ${Number(deal.debt).toLocaleString('uk-UA')} ${deal.currency}`,
      }));
    if (!deals.length) {
      CrmStore.listDealsForSelect().forEach((deal) => {
        deals.push({
          value: deal.id,
          label: `${deal.id} · ${deal.car}`,
        });
      });
    }
    return {
      ...config,
      fields: config.fields.map((field) => (
        field.name === 'deal_id'
          ? { ...field, options: deals, default: options.dealId || deals[0]?.value }
          : field
      )),
    };
  }

  function applyOpenOptions(type, options) {
    if (type === 'payment') {
      const dealSelect = formEl.querySelector('[name="deal_id"]');
      const currencySelect = formEl.querySelector('[name="currency"]');
      const dateInput = formEl.querySelector('[name="date"]');
      if (dealSelect && options.dealId) dealSelect.value = options.dealId;
      if (dateInput && !dateInput.value) dateInput.value = CrmStore.todayISO();
      if (dealSelect && currencySelect) {
        const deal = CrmStore.getDeal(dealSelect.value);
        if (deal?.currency) currencySelect.value = deal.currency;
        dealSelect.addEventListener('change', () => {
          const selected = CrmStore.getDeal(dealSelect.value);
          if (selected?.currency) currencySelect.value = selected.currency;
        });
      }
      return;
    }

    if (type === 'carrier' && options.carrierPreset === 'ch-ua') {
      const route = formEl.querySelector('[name="route"]');
      const cars = formEl.querySelector('[name="cars"]');
      if (route && !route.value) route.value = 'Цюрих → Львів';
      if (cars && !cars.value) cars.value = '4';
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && !modalEl.hidden) {
      event.preventDefault();
      close();
    }
  }

  function buildFormHtml(config) {
    const fieldsHtml = config.fields.map((field) => renderField(field)).join('');
    return `
      <div class="crm-modal__fields">${fieldsHtml}</div>
      <div class="crm-modal__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-modal-close>Скасувати</button>
        <button type="submit" class="btn btn--primary btn--sm">${config.submit}</button>
      </div>`;
  }

  const CURRENCIES = ['CHF', 'EUR', 'USD'];

  function renderCurrencySelect(name, defaultVal) {
    const opts = CURRENCIES.map((c) => `<option value="${c}"${c === (defaultVal || 'CHF') ? ' selected' : ''}>${c}</option>`).join('');
    return `<select class="crm-modal__currency-select" name="${escapeHtml(name)}">${opts}</select>`;
  }

  function renderField(field) {
    const req = field.required ? '<span aria-hidden="true"> *</span>' : '';
    const id = `crm-field-${field.name}`;

    if (field.type === 'due_payments') {
      return `
        <div class="crm-modal__group crm-modal__group--wide crm-modal__group--due">
          <span class="crm-modal__group-label">${field.label}${req}</span>
          <div data-due-root id="${id}"></div>
        </div>`;
    }

    if (field.type === 'documents') {
      return `
        <div class="crm-modal__group crm-modal__group--wide crm-modal__group--docs">
          <span class="crm-modal__group-label">${field.label}${req}</span>
          <div data-doc-root id="${id}"></div>
        </div>`;
    }

    if (field.type === 'lot_url') {
      return `
        <div class="crm-modal__group crm-modal__group--wide">
          <label for="${id}">${field.label}</label>
          <div class="crm-modal__lot-row">
            <input class="crm-modal__input" id="${id}" type="url" name="${field.name}" placeholder="${escapeHtml(field.placeholder || '')}">
            <button type="button" class="btn btn--ghost btn--sm" data-fetch-lot-photo>Підтягнути фото</button>
          </div>
          <img class="crm-modal__lot-preview" data-lot-preview hidden alt="" aria-hidden="true" referrerpolicy="no-referrer">
          <p class="crm-modal__error" data-error-for="${field.name}" hidden></p>
        </div>`;
    }

    if (field.type === 'amount_currency') {
      const hintHtml = field.hint ? `<p class="crm-modal__hint">${escapeHtml(field.hint)}</p>` : '';
      return `
        <div class="crm-modal__group">
          <label for="${id}">${escapeHtml(field.label)}${req}</label>
          <div class="crm-modal__amount-row">
            <input class="crm-modal__input" id="${id}" type="text" name="${field.name}" inputmode="numeric" maxlength="9" placeholder="${escapeHtml(field.placeholder || '')}"${field.required ? ' required' : ''}>
            ${renderCurrencySelect(field.currencyName, 'CHF')}
          </div>
          ${hintHtml}
          <p class="crm-modal__error" data-error-for="${field.name}" hidden></p>
        </div>`;
    }

    if (field.type === 'carrier_deals') {
      const deals = window.CrmStore
        ? CrmStore.listDealsForSelect().filter((d) => d.execution === 'won' || d.execution === 'confirmed')
        : [];
      if (!deals.length) return '';
      const checkboxes = deals.map((d) => `
        <label class="crm-modal__deal-check">
          <input type="checkbox" name="assigned_deals" value="${escapeHtml(d.id)}" data-carrier-deal-check>
          <span>${escapeHtml(d.id)} · ${escapeHtml(d.car)} (${escapeHtml(d.execution_label || d.execution)})</span>
        </label>`).join('');
      return `
        <div class="crm-modal__group crm-modal__group--wide">
          <span class="crm-modal__group-label">${escapeHtml(field.label)}</span>
          <div class="crm-modal__deal-list">${checkboxes}</div>
        </div>`;
    }

    let control = '';

    if (field.type === 'select') {
      const opts = field.options || [];
      const needsPlaceholder = field.dynamic === 'deals' || field.name === 'deal_id';
      const placeholder = needsPlaceholder
        ? `<option value="" disabled${field.default ? '' : ' selected'}>Оберіть угоду…</option>`
        : '';
      const options = opts.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const selected = field.default && val === field.default ? ' selected' : '';
        return `<option value="${escapeHtml(val)}"${selected}>${escapeHtml(label)}</option>`;
      }).join('');
      control = `<select class="crm-modal__select" id="${id}" name="${field.name}"${field.required ? ' required' : ''}>${placeholder}${options}</select>`;
    } else if (field.type === 'textarea') {
      control = `<textarea class="crm-modal__textarea" id="${id}" name="${field.name}" placeholder="${field.placeholder || ''}"${field.required ? ' required' : ''}></textarea>`;
    } else {
      const inputType = field.validate === 'year' || field.validate === 'price' || field.validate === 'integer' || field.validate === 'paymentAmount'
        ? 'text'
        : field.type;
      const attrs = [
        field.required ? 'required' : '',
        field.placeholder ? `placeholder="${field.placeholder}"` : '',
        field.min != null ? `min="${field.min}"` : '',
        field.max != null ? `max="${field.max}"` : '',
        field.validate === 'phone' || field.type === 'tel' ? 'inputmode="tel" autocomplete="tel" maxlength="20"' : '',
        field.validate === 'year' ? 'inputmode="numeric" maxlength="4"' : '',
        field.validate === 'price' || field.validate === 'integer' || field.validate === 'paymentAmount' ? 'inputmode="numeric" maxlength="9"' : '',
        field.validate === 'telegram' ? 'autocomplete="off" maxlength="33"' : '',
      ].filter(Boolean).join(' ');
      control = `<input class="crm-modal__input" id="${id}" type="${inputType}" name="${field.name}" ${attrs}>`;
      if (field.autocomplete === 'route') {
        control = `<div class="crm-modal__combo" data-route-combo>${control}</div>`;
      }
      if (field.autocomplete === 'client') {
        control = `<div class="crm-modal__combo" data-client-combo>${control}</div>`;
      }
    }

    const rowClass = field.half ? 'crm-modal__group crm-modal__row' : 'crm-modal__group';
    const hintHtml = field.hint
      ? `<p class="crm-modal__hint" data-hint-for="${field.name}">${escapeHtml(field.hint)}</p>`
      : '';
    return `
      <div class="${rowClass}">
        <label for="${id}">${field.label}${req}</label>
        ${control}
        ${hintHtml}
        <p class="crm-modal__error" data-error-for="${field.name}" hidden></p>
      </div>`;
  }

  function setDefaultDates(type) {
    if (type === 'carrier') {
      const dep = formEl.querySelector('[name="departure"]');
      const eta = formEl.querySelector('[name="eta"]');
      const today = CrmStore.todayISO();
      if (dep && !dep.value) dep.value = today;
      if (eta && !eta.value) {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        eta.value = date.toISOString().slice(0, 10);
      }
      return;
    }
    if (type === 'payment') {
      const dateInput = formEl.querySelector('[name="date"]');
      if (dateInput && !dateInput.value) dateInput.value = CrmStore.todayISO();
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (formEl.dataset.submitting === '1') return;
    const type = formEl.dataset.modalType;
    const config = FORMS[type];
    if (!config) return;

    const resolved = type === 'payment' ? resolveConfig(config, openOptions) : config;

    clearErrors();
    const data = readFormData(formEl);
    const errors = window.CrmValidation
      ? CrmValidation.validateForm(resolved, data, formEl)
      : validateLegacy(resolved, data);
    if (errors.length) {
      if (window.CrmValidation) {
        CrmValidation.showErrors(formEl, errors);
      } else {
        showErrors(errors);
      }
      return;
    }

    const item = config.build(data);
    const storeType = config.storeType;
    const submitBtn = formEl.querySelector('[type="submit"], button.btn--primary, .modal__submit');
    formEl.dataset.submitting = '1';
    if (submitBtn) submitBtn.disabled = true;

    if (storeType === 'payments') {
      try {
        const result = await CrmPayments.record(item);
        if (!result) {
          if (typeof showToast === 'function') showToast('Угоду не знайдено', 'info');
          return;
        }
        CrmPayments.refreshUI(result);
        close();
        if (typeof showToast === 'function') {
          showToast(successMessage('payment', item, result.deal), 'success');
        }
      } catch {
        /* toast у CrmApi/CrmStore */
      } finally {
        formEl.dataset.submitting = '0';
        if (submitBtn) submitBtn.disabled = false;
      }
      return;
    }

    try {
      const saved = await CrmStore.addItem(storeType, item);
      CrmRender.append(storeType, saved);
      CrmRender.notifyAdded(storeType, saved);

      if (type === 'deal') {
        const dueRoot = formEl.querySelector('[data-due-root]');
        const docRoot = formEl.querySelector('[data-doc-root]');
        dealDueWidget?.commitDraft?.();
        const due_payments = dealDueWidget?.read() || (window.CrmDuePayments ? CrmDuePayments.read(dueRoot) : []);
        const documents = dealDocWidget?.read() || (window.CrmDocuments ? CrmDocuments.read(docRoot) : []);
        await CrmStore.saveDealProfile(saved.id, {
          auction: 'BCP',
          due_payments,
          documents,
          notes: '',
          image: saved.image || item.image || '',
          lot_url: saved.lot_url || item.lot_url || '',
          year: saved.year || item.year || '',
          logistics: {
            confirmed: CrmStore.todayISO(),
            picked: null,
            transit: null,
            customs: null,
            delivered: null,
          },
        });
        if (window.CrmReport) CrmReport.addDealFromStore(CrmStore.getDeal(saved.id));
      }

      close();
      if (typeof showToast === 'function') {
        showToast(successMessage(type, saved), 'success');
      }

      if (type === 'carrier' && window.location.pathname.includes('/cockpit')) {
        window.setTimeout(() => {
          window.location.href = '/carriers/';
        }, 700);
      }
    } catch {
      /* toast у CrmApi/CrmStore */
    } finally {
      formEl.dataset.submitting = '0';
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function readFormData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  function validateLegacy(config, data) {
    const errors = [];
    config.fields.forEach((field) => {
      const value = String(data[field.name] ?? '').trim();
      if (field.required && !value) {
        errors.push({ name: field.name, message: 'Заповніть це поле' });
      }
    });

    if (config.storeType === 'carriers' && data.departure && data.eta && data.eta < data.departure) {
      errors.push({ name: 'eta', message: 'ETA не може бути раніше відправлення' });
    }

    return errors;
  }

  function clearErrors() {
    if (window.CrmValidation) {
      CrmValidation.clearErrors(formEl);
      return;
    }
    formEl.querySelectorAll('.crm-modal__input, .crm-modal__select, .crm-modal__textarea')
      .forEach((el) => el.classList.remove('crm-modal__input--error', 'crm-modal__select--error', 'crm-modal__textarea--error'));
    formEl.querySelectorAll('[data-error-for]').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
  }

  function showErrors(errors) {
    errors.forEach(({ name, message }) => {
      const input = formEl.querySelector(`[name="${name}"]`);
      const errEl = formEl.querySelector(`[data-error-for="${name}"]`);
      if (input) {
        input.classList.add(
          input.tagName === 'SELECT' ? 'crm-modal__select--error' : input.tagName === 'TEXTAREA' ? 'crm-modal__textarea--error' : 'crm-modal__input--error'
        );
      }
      if (errEl) {
        errEl.textContent = message;
        errEl.hidden = false;
      }
    });
    formEl.querySelector('.crm-modal__input--error, .crm-modal__select--error, .crm-modal__textarea--error')?.focus();
  }

  function successMessage(type, item, deal) {
    switch (type) {
      case 'client': return `Клієнта «${item.name}» додано`;
      case 'lead': return `Запит ${item.id} створено`;
      case 'deal': return `Угоду ${item.id} створено`;
      case 'carrier': return `Рейс ${item.id} додано`;
      case 'payment': return `Платіж ${Number(item.amount).toLocaleString('uk-UA')} ${item.currency} · ${deal?.client || item.dealId}`;
      default: return 'Збережено';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCsrfToken() {
    const meta = document.querySelector('[name="csrfmiddlewaretoken"]');
    if (meta) return meta.value;
    const cookie = document.cookie.split(';').find((c) => c.trim().startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1].trim() : '';
  }

  function confirm({ title, message, confirmLabel = 'Видалити', onConfirm }) {
    if (!modalEl || !formEl) return;

    lastFocus = document.activeElement;
    titleEl.textContent = title;
    formEl.innerHTML = `
      <p class="crm-modal__message">${escapeHtml(message)}</p>
      <div class="crm-modal__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-modal-close>Скасувати</button>
        <button type="button" class="btn btn--danger btn--sm" id="crm-modal-confirm-btn">${escapeHtml(confirmLabel)}</button>
      </div>`;
    formEl.dataset.modalType = 'confirm';

    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    lockBodyScroll();

    const confirmBtn = document.getElementById('crm-modal-confirm-btn');
    confirmBtn?.focus();
    confirmBtn?.addEventListener('click', () => {
      onConfirm?.();
      close();
    }, { once: true });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { open, close, confirm };
})();

window.CrmModal = CrmModal;

/* === crm-delete.js === */
const CrmDelete = (() => {
  const TRASH_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>`;

  const CARD_RULES = [
    {
      type: 'clients',
      selector: '[data-clients-list] .client-card',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.clientId
          || card.querySelector('.client-card__name')?.textContent?.trim();
      },
      label(card) {
        return card.querySelector('.client-card__name')?.textContent?.trim() || 'клієнта';
      },
    },
    {
      type: 'leads',
      selector: '[data-leads-list] .lead-card',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.leadId
          || card.querySelector('.lead-card__id')?.textContent?.trim();
      },
      label(card) {
        const id = card.querySelector('.lead-card__id')?.textContent?.trim();
        const name = card.querySelector('.lead-card__name')?.textContent?.trim();
        return id && name ? `${id} · ${name}` : (name || 'запит');
      },
    },
    {
      type: 'carriers',
      selector: '[data-carriers-list] .carrier-card',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.carrierId
          || card.querySelector('.mono.text-accent')?.textContent?.trim();
      },
      label(card) {
        const id = card.querySelector('.mono.text-accent')?.textContent?.trim();
        const route = card.querySelector('.carrier-card__route')?.textContent?.trim();
        return id && route ? `${id} · ${route}` : (route || 'рейс');
      },
    },
    {
      type: 'deals',
      selector: '[data-crm-card="deals"]',
      readKey(card) {
        return card.dataset.crmKey
          || card.dataset.dealId
          || card.querySelector('.deal-card__id, .kanban-card__id')?.textContent?.trim();
      },
      label(card) {
        const id = card.querySelector('.deal-card__id, .kanban-card__id')?.textContent?.trim();
        const title = card.querySelector('.deal-card__title, .kanban-card__title')?.textContent?.trim();
        return id && title ? `${id} · ${title}` : (title || 'угоду');
      },
    },
  ];

  function init() {
    enhanceAll();
    purgeHidden();
    document.addEventListener('crm:added', onItemAdded);
  }

  function onItemAdded() {
    enhanceAll();
  }

  function enhanceAll() {
    CARD_RULES.forEach((rule) => {
      document.querySelectorAll(rule.selector).forEach((card) => {
        enhanceCard(card, rule);
      });
    });
  }

  function createDeleteButton(card, rule) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-delete-btn';
    btn.dataset.crmDelete = '';
    btn.setAttribute('aria-label', 'Видалити');
    btn.innerHTML = TRASH_ICON;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      requestDelete(card, rule);
    });
    return btn;
  }

  function enhanceCard(card, rule) {
    if (!rule) {
      rule = CARD_RULES.find((item) => card.matches(item.selector));
    }
    if (!rule) return card;

    /* Звіт: ніколи не додавати 9-й td зі смітником — зсуває колонки */
    if (card.closest('#report-table-body') || card.matches('[data-report-row]')) {
      return card;
    }

    const key = rule.readKey(card);
    if (!key) return card;

    card.dataset.crmCard = rule.type;
    card.dataset.crmKey = key;
    card.classList.add('crm-card--deletable');

    if (rule.type === 'clients') card.dataset.clientId = key;
    if (rule.type === 'leads') card.dataset.leadId = key;
    if (rule.type === 'carriers') card.dataset.carrierId = key;
    if (rule.type === 'deals') card.dataset.dealId = key;

    const existingBtn = card.querySelector('[data-crm-delete]');
    if (existingBtn) {
      existingBtn.remove();
    }

    const btn = createDeleteButton(card, rule);

    if (card.tagName === 'TR') {
      let actionsCell = card.querySelector('.data-table__actions');
      if (!actionsCell) {
        actionsCell = document.createElement('td');
        actionsCell.className = 'data-table__actions';
        actionsCell.addEventListener('click', (event) => event.stopPropagation());
        card.appendChild(actionsCell);
      }
      actionsCell.appendChild(btn);
      return card;
    }

    card.appendChild(btn);
    return card;
  }

  function purgeHidden() {
    document.querySelectorAll('[data-crm-card][data-crm-key]').forEach((card) => {
      const type = card.dataset.crmCard;
      const key = card.dataset.crmKey;
      if (type && key && CrmStore.isHidden(type, key)) {
        card.remove();
      }
    });
  }

  function requestDelete(card, rule) {
    const type = card.dataset.crmCard || rule?.type;
    const key = card.dataset.crmKey;
    if (!type || !key) return;

    const activeRule = rule || CARD_RULES.find((item) => item.type === type);
    const label = activeRule ? activeRule.label(card) : 'запис';

    if (typeof CrmModal?.confirm !== 'function') {
      if (window.confirm(`Видалити «${label}»?`)) {
        performDelete(type, key, card.dataset.customItem === 'true');
      }
      return;
    }

    CrmModal.confirm({
      title: 'Видалити?',
      message: `«${label}» буде прибрано зі списку.`,
      onConfirm: () => performDelete(type, key, card.dataset.customItem === 'true'),
    });
  }

  async function performDelete(type, key, isCustom) {
    try {
      await CrmStore.removeItem(type, key);
    } catch {
      return;
    }

    removeFromDom(type, key);
    notifyRemoved(type);

    if (typeof showToast === 'function') {
      showToast('Запис видалено', 'info');
    }
  }

  function removeFromDom(type, key) {
    document.querySelectorAll(`[data-crm-card="${type}"]`).forEach((node) => {
      if (node.dataset.crmKey !== key) return;
      node.classList.add('card--removing');
      window.setTimeout(() => node.remove(), 260);
    });
  }

  function notifyRemoved(type) {
    document.dispatchEvent(new CustomEvent('crm:removed', { detail: { type } }));
    if (type === 'leads' && typeof window.refreshLeadFilters === 'function') {
      window.refreshLeadFilters();
    }
    if (type === 'deals' && typeof window.refreshDealFilters === 'function') {
      window.refreshDealFilters();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  return { enhanceCard, enhanceAll };
})();

window.CrmDelete = CrmDelete;

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

/* === packages.js === */
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

/* === currency.js === */
/**
 * Мультивалютність Autolot CRM (CHF · EUR · USD)
 * Курси через CHF; EUR з налаштувань (44.85/47.20 UAH)
 */
const CrmCurrency = (() => {
  const STORAGE_KEY = 'autolot-currency';
  const CODES = ['CHF', 'EUR', 'USD'];

  /** Скільки CHF в 1 одиниці валюти */
  const TO_CHF = {
    CHF: 1,
    EUR: 44.85 / 47.2,
    USD: 0.892,
  };

  function get() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CODES.includes(saved) ? saved : 'CHF';
  }

  function isActive() {
    return !window.CrmPackages || CrmPackages.has('currency_switch');
  }

  function convert(amount, from, to) {
    const value = parseAmount(amount);
    const src = TO_CHF[from] ?? 1;
    const dst = TO_CHF[to] ?? 1;
    if (from === to) return value;
    return (value * src) / dst;
  }

  function formatNum(value) {
    return Math.round(Number(value) || 0).toLocaleString('uk-UA');
  }

  /** Парсить суми з data-атрибутів (uk: "4800,00" / "4 800,00"). */
  function parseAmount(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    let raw = String(value ?? '').trim();
    if (!raw) return 0;
    raw = raw.replace(/\s/g, '').replace(/'/g, '');
    if (raw.includes(',') && raw.includes('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else if (raw.includes(',')) {
      raw = raw.replace(',', '.');
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function label(amount, currency) {
    return `${formatNum(amount)} ${currency}`;
  }

  function display(amount, fromCurrency, targetCurrency) {
    const target = targetCurrency || (isActive() ? get() : fromCurrency);
    if (!isActive() || target === fromCurrency) {
      return label(amount, fromCurrency);
    }
    return label(convert(amount, fromCurrency, target), target);
  }

  function saveOriginal(el, prop) {
    const key = prop === 'html' ? 'moneyOriginalHtml' : 'moneyOriginalText';
    if (el.dataset[key] == null) {
      el.dataset[key] = prop === 'html' ? el.innerHTML : el.textContent;
    }
  }

  function restore(el, prop) {
    const key = prop === 'html' ? 'moneyOriginalHtml' : 'moneyOriginalText';
    if (el.dataset[key] != null) {
      if (prop === 'html') el.innerHTML = el.dataset[key];
      else el.textContent = el.dataset[key];
    }
  }

  function applyMoneyNodes() {
    document.querySelectorAll('[data-money]').forEach((el) => {
      saveOriginal(el, 'text');
      if (!isActive()) {
        restore(el, 'text');
        return;
      }
      const amount = parseAmount(el.dataset.money);
      const from = el.dataset.moneyCurrency || 'CHF';
      const prefix = el.dataset.moneyPrefix || '';
      const sign = el.dataset.moneySign || '';
      const converted = convert(amount, from, get());
      const value = `${formatNum(converted)} ${get()}`;
      if (sign === '+') {
        el.textContent = `${prefix}+${value}`;
      } else if (sign === '−' || sign === '-') {
        el.textContent = `${prefix}−${value}`;
      } else {
        el.textContent = `${prefix}${value}`;
      }
    });
  }

  function applyCompositeNodes() {
    document.querySelectorAll('[data-money-composite]').forEach((el) => {
      const mode = el.dataset.moneyCompositeMode || 'breakdown';
      const storeAs = mode === 'total' ? 'text' : 'html';
      saveOriginal(el, storeAs);
      el.hidden = false;

      if (!isActive()) {
        restore(el, storeAs);
        return;
      }

      let parts;
      try {
        parts = JSON.parse(el.dataset.moneyComposite);
      } catch {
        return;
      }

      const target = get();
      const prefix = el.dataset.moneyPrefix || '';

      if (mode === 'total') {
        if (target === 'CHF') {
          el.hidden = true;
          return;
        }
        const total = parts.reduce(
          (sum, part) => sum + convert(part.amount, part.currency, target),
          0
        );
        el.textContent = prefix + label(total, target);
        return;
      }

      if (target === 'CHF') {
        const totalAmount = el.dataset.moneyCompositeTotal;
        const totalCurrency = el.dataset.moneyCompositeTotalCurrency || 'CHF';
        if (totalAmount) {
          el.textContent = label(parseAmount(totalAmount), totalCurrency);
        } else {
          const total = parts.reduce(
            (sum, part) => sum + convert(part.amount, part.currency, 'CHF'),
            0
          );
          el.textContent = label(total, 'CHF');
        }
        return;
      }

      const lines = parts.map((part) => label(convert(part.amount, part.currency, target), target));
      el.innerHTML = lines.join('<br>');
    });
  }

  function applyReportNote() {
    document.querySelectorAll('[data-report-currency-note]').forEach((el) => {
      saveOriginal(el, 'text');
      if (!isActive()) {
        restore(el, 'text');
        return;
      }
      const month = el.dataset.reportMonth || '';
      const count = el.dataset.reportCount || '';
      el.textContent = `${month} · усі суми у ${get()} · ${count} угод`;
    });
  }

  function applyToolbar() {
    const group = document.querySelector('.wf-currency');
    if (!group) return;
    const active = get();
    group.querySelectorAll('[data-currency]').forEach((btn) => {
      btn.classList.toggle('wf-currency__btn--active', btn.dataset.currency === active);
    });
    document.documentElement.dataset.currency = active;
  }

  function applyAll() {
    applyToolbar();
    applyMoneyNodes();
    applyCompositeNodes();
    applyReportNote();
  }

  function set(code) {
    if (!CODES.includes(code)) return;
    if (!isActive()) {
      if (window.CrmPackages) CrmPackages.notifyLocked('currency_switch');
      return;
    }
    localStorage.setItem(STORAGE_KEY, code);
    applyAll();
    document.dispatchEvent(new CustomEvent('crm:currency-change', { detail: { currency: code } }));
    if (typeof showToast === 'function') {
      showToast(`Валюта відображення: ${code}`, 'success');
    }
  }

  function initToolbar() {
    const group = document.querySelector('.wf-currency');
    if (!group) return;

    group.querySelectorAll('[data-currency]').forEach((btn) => {
      if (btn.dataset.currencyBound) return;
      btn.dataset.currencyBound = 'true';
      btn.addEventListener('click', () => set(btn.dataset.currency));
    });

    applyToolbar();
    applyAll();
  }

  document.documentElement.dataset.currency = get();

  return {
    get,
    set,
    convert,
    display,
    label,
    formatNum,
    parseAmount,
    isActive,
    applyAll,
    initToolbar,
    TO_CHF,
  };
})();

window.CrmCurrency = CrmCurrency;

document.addEventListener('crm:added', () => {
  CrmCurrency.applyAll();
});

/* === wireframe.js === */
document.addEventListener('DOMContentLoaded', () => {
  initPackageBar();
  if (window.CrmCurrency) CrmCurrency.initToolbar();
  if (window.CrmPackages) CrmPackages.applyAll();
});

document.addEventListener('crm:package-change', () => {
  if (window.CrmPackages) CrmPackages.applyAll();
  if (window.CrmCurrency) CrmCurrency.applyAll();
});

document.addEventListener('crm:currency-change', () => {
  if (window.CrmCurrency) CrmCurrency.applyAll();
});

function initPackageBar() {
  const bar = document.querySelector('.package-bar');
  if (!bar || !window.CrmPackages) return;

  const buttons = bar.querySelectorAll('[data-package]');

  const paint = () => {
    const active = CrmPackages.get();
    buttons.forEach((btn) => {
      const isActive = btn.dataset.package === active;
      btn.classList.toggle('wf-panel-btn--active', isActive);
      btn.style.opacity = isActive ? '1' : '0.72';
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      CrmPackages.set(btn.dataset.package);
      paint();
      const m = CrmPackages.meta(btn.dataset.package);
      if (typeof showToast === 'function') {
        showToast(`Пакет: ${m.label} (${m.code})`, 'success');
      }
    });
  });

  paint();
}

/* === app.js === */
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

