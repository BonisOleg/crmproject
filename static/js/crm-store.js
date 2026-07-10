const CrmStore = (() => {
  const KEYS = {
    clients: 'autolot-custom-clients',
    leads: 'autolot-custom-leads',
    deals: 'autolot-custom-deals',
    carriers: 'autolot-custom-carriers',
    payments: 'autolot-custom-payments',
    dealOverrides: 'autolot-deal-overrides',
    carrierOverrides: 'autolot-carrier-overrides',
  };

  const HIDDEN_KEY = 'autolot-hidden-items';

  const BASE_IDS = {
    leads: 21,
    deals: 47,
    carriers: 12,
  };

  function read(type) {
    try {
      const raw = localStorage.getItem(KEYS[type]);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function write(type, items) {
    localStorage.setItem(KEYS[type], JSON.stringify(items));
  }

  function readHidden() {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeHidden(data) {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(data));
  }

  function itemKey(type, item) {
    if (type === 'clients') return item.name;
    return item.id;
  }

  function getItems(type) {
    return read(type);
  }

  function addItem(type, item) {
    const items = read(type);
    items.unshift(item);
    write(type, items);
    return item;
  }

  function removeItem(type, key) {
    const items = read(type).filter((item) => itemKey(type, item) !== key);
    write(type, items);
  }

  function markHidden(type, key) {
    const hidden = readHidden();
    if (!hidden[type]) hidden[type] = [];
    if (!hidden[type].includes(key)) hidden[type].push(key);
    writeHidden(hidden);
  }

  function isHidden(type, key) {
    return readHidden()[type]?.includes(key) ?? false;
  }

  function nextId(type) {
    const items = read(type);
    let max = BASE_IDS[type] || 0;

    items.forEach((item) => {
      const match = String(item.id || '').match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    });

    const next = max + 1;

    if (type === 'leads') return `RQ-${String(next).padStart(3, '0')}`;
    if (type === 'deals') return `AL-2026-${String(next).padStart(3, '0')}`;
    if (type === 'carriers') return `TR-${String(next).padStart(3, '0')}`;
    return String(next);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  const FALLBACK_CATALOG = [
    { id: 'AL-2026-047', car: 'BMW X5 xDrive40i', debt: 18500, currency: 'CHF', paid: 0, price: 18500 },
    { id: 'AL-2026-046', car: 'Mercedes GLC 300', debt: 9200, currency: 'EUR', paid: 0, price: 9200 },
    { id: 'AL-2026-045', car: 'Audi Q7 55 TFSI', debt: 0, currency: 'CHF', paid: 42000, price: 42000 },
  ];

  function readCatalog() {
    const node = document.getElementById('crm-deals-catalog');
    if (!node) return FALLBACK_CATALOG;
    try {
      const parsed = JSON.parse(node.textContent || '[]');
      return parsed.length ? parsed : FALLBACK_CATALOG;
    } catch {
      return FALLBACK_CATALOG;
    }
  }

  function readOverrides() {
    try {
      const raw = localStorage.getItem(KEYS.dealOverrides);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeOverrides(data) {
    localStorage.setItem(KEYS.dealOverrides, JSON.stringify(data));
  }

  function readPayments() {
    return read('payments');
  }

  function addPayment(payment) {
    return addItem('payments', payment);
  }

  function getDeal(dealId) {
    const custom = read('deals').find((item) => item.id === dealId);
    const base = readCatalog().find((item) => item.id === dealId);
    const source = custom || base;
    if (!source) return null;
    const override = readOverrides()[dealId] || {};
    return { ...source, ...override };
  }

  function saveDealProfile(dealId, patch) {
    const overrides = readOverrides();
    overrides[dealId] = { ...(overrides[dealId] || {}), ...patch };
    writeOverrides(overrides);

    const items = read('deals');
    const idx = items.findIndex((item) => item.id === dealId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch };
      write('deals', items);
    }

    document.dispatchEvent(new CustomEvent('crm:deal-updated', { detail: { dealId } }));
    return overrides[dealId];
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

  function readCarrierOverrides() {
    try {
      const raw = localStorage.getItem(KEYS.carrierOverrides);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeCarrierOverrides(data) {
    localStorage.setItem(KEYS.carrierOverrides, JSON.stringify(data));
  }

  function getCarrier(carrierId) {
    const custom = read('carriers').find((item) => item.id === carrierId);
    const base = readCarrierCatalog().find((item) => item.id === carrierId);
    const source = custom || base;
    if (!source) return null;
    const override = readCarrierOverrides()[carrierId] || {};
    return { ...source, ...override };
  }

  function saveCarrierProfile(carrierId, patch) {
    const overrides = readCarrierOverrides();
    overrides[carrierId] = { ...(overrides[carrierId] || {}), ...patch };
    writeCarrierOverrides(overrides);

    const items = read('carriers');
    const idx = items.findIndex((item) => item.id === carrierId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch };
      write('carriers', items);
    }

    document.dispatchEvent(new CustomEvent('crm:carrier-updated', { detail: { carrierId } }));
    return overrides[carrierId];
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
    readCatalog().forEach((deal) => map.set(deal.id, { ...deal, ...(readOverrides()[deal.id] || {}) }));
    read('deals').forEach((deal) => map.set(deal.id, { ...deal, ...(readOverrides()[deal.id] || {}) }));
    return Array.from(map.values());
  }

  function saveDealOverride(dealId, patch) {
    const overrides = readOverrides();
    overrides[dealId] = { ...(overrides[dealId] || {}), ...patch };
    writeOverrides(overrides);
    return overrides[dealId];
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
  };
})();

window.CrmStore = CrmStore;
