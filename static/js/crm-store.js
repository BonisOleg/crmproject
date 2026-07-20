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

  hydrate();

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
    putDeal,
    putCarrier,
  };
})();

window.CrmStore = CrmStore;
