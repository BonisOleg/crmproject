/**
 * Єдина картка угоди: редагування, план оплат, документи → звіт
 */
const CrmDealCard = (() => {
  const EXECUTION_OPTIONS = [
    { value: 'won', label: 'Виграно' },
    { value: 'confirmed', label: 'Підтверджено' },
    { value: 'picked', label: 'Забрано' },
    { value: 'in_transit', label: 'В дорозі' },
    { value: 'customs', label: 'Розмитнено' },
    { value: 'delivered', label: 'Доставлено' },
  ];

  let dealId = null;
  let deal = null;
  let dueWidget = null;
  let docWidget = null;

  function sanitizeDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function loadDeal() {
    deal = CrmStore.getDeal(dealId);
    return deal || null;
  }

  function fillForm() {
    const form = document.getElementById('deal-unified-form');
    if (!form || !deal) return;

    form.car.value = deal.car || '';
    form.client.value = deal.client || '';
    form.phone.value = deal.phone || '';
    form.vin.value = deal.vin || '';
    form.auction.value = deal.auction || 'BCP';
    form.execution.value = deal.execution || 'won';
    if (form.won_price) form.won_price.value = String(deal.won_price || 0);
    if (form.bid) form.bid.value = String(deal.bid || 0);
    form.cost.value = String(deal.cost ?? Math.round((deal.price || 0) * 0.82));
    form.price.value = String(deal.price || 0);
    if (form.delivery_cost) form.delivery_cost.value = String(deal.delivery_cost || 0);
    if (form.commission) form.commission.value = String(deal.commission || 0);
    if (form.logistics_cost) form.logistics_cost.value = String(deal.logistics_cost || 0);
    if (form.won_currency) form.won_currency.value = deal.won_currency || 'CHF';
    if (form.bid_currency) form.bid_currency.value = deal.bid_currency || 'CHF';
    if (form.cost_currency) form.cost_currency.value = deal.cost_currency || 'CHF';
    if (form.price_currency) form.price_currency.value = deal.price_currency || deal.currency || 'CHF';
    if (form.delivery_currency) form.delivery_currency.value = deal.delivery_currency || 'CHF';
    form.notes.value = deal.notes || '';

    const statusEl = document.querySelector('[data-deal-save-status]');
    if (statusEl) statusEl.textContent = 'Зміни зберігаються автоматично у картці та звіті';
  }

  function mountDuePayments() {
    const root = document.querySelector('[data-due-root]');
    if (!root || !window.CrmDuePayments) return;
    dueWidget = CrmDuePayments.mount(root, {
      items: deal?.due_payments || [],
      currency: deal?.currency || 'CHF',
      inputClass: 'deal-unified__input crm-due-widget__input',
    });
    root.addEventListener('crm:due-changed', () => saveProfile(false));
  }

  function mountDocuments() {
    const root = document.querySelector('[data-doc-root]');
    if (!root || !window.CrmDocuments) return;
    docWidget = CrmDocuments.mount(root, {
      items: deal?.documents || [],
    });
    root.addEventListener('crm:doc-changed', () => saveProfile(false));
  }

  function refreshFinance() {
    if (!deal) return;
    CrmPayments.updateDealDetailFinance(deal);
    CrmPayments.updateDealNodes(dealId, deal);

    const titleEl = document.querySelector('[data-deal-page-title]');
    if (titleEl) titleEl.textContent = deal.car;
    const subEl = document.querySelector('[data-deal-page-sub]');
    if (subEl) subEl.textContent = `${deal.year || ''} · ${deal.client}`;
  }

  function saveProfile(showNotice = true) {
    const form = document.getElementById('deal-unified-form');
    if (!form || !dealId) return;

    const execution = form.execution.value;
    const executionLabel = EXECUTION_OPTIONS.find((opt) => opt.value === execution)?.label || execution;
    const price = Number(sanitizeDigits(form.price.value)) || 0;
    const cost = Number(sanitizeDigits(form.cost.value)) || 0;
    const wonPrice = Number(sanitizeDigits(form.won_price?.value || '0')) || 0;
    const bid = Number(sanitizeDigits(form.bid?.value || '0')) || 0;
    const deliveryCost = Number(sanitizeDigits(form.delivery_cost?.value || '0')) || 0;
    const commission = Number(sanitizeDigits(form.commission?.value || '0')) || 0;
    const logisticsCost = Number(sanitizeDigits(form.logistics_cost?.value || '0')) || 0;
    const paid = Number(deal.paid) || 0;
    const debt = Math.max(0, price - paid);
    const profit = Math.max(0, price - cost);
    const dueRoot = document.querySelector('[data-due-root]');
    const docRoot = document.querySelector('[data-doc-root]');
    const due_payments = dueWidget?.read() || (window.CrmDuePayments ? CrmDuePayments.read(dueRoot) : []);
    const documents = docWidget?.read() || (window.CrmDocuments ? CrmDocuments.read(docRoot) : []);

    const patch = {
      car: form.car.value.trim(),
      client: form.client.value.trim(),
      phone: form.phone.value.trim(),
      vin: form.vin.value.trim(),
      auction: form.auction.value,
      execution,
      execution_label: executionLabel,
      won_price: wonPrice,
      bid,
      cost,
      price,
      delivery_cost: deliveryCost,
      delivery_type: deliveryCost > 0 ? 'ours' : (deal.delivery_type || 'pickup'),
      commission,
      logistics_cost: logisticsCost,
      debt,
      profit,
      currency: form.price_currency?.value || deal.currency || 'CHF',
      won_currency: form.won_currency?.value || 'CHF',
      bid_currency: form.bid_currency?.value || 'CHF',
      cost_currency: form.cost_currency?.value || 'CHF',
      price_currency: form.price_currency?.value || 'CHF',
      delivery_currency: form.delivery_currency?.value || 'CHF',
      notes: form.notes.value.trim(),
      due_payments,
      documents,
    };

    CrmStore.saveDealProfile(dealId, patch);
    deal = CrmStore.getDeal(dealId);
    refreshFinance();

    if (showNotice && typeof showToast === 'function') {
      showToast('Картку угоди збережено · звіт оновлено', 'success');
    }
  }

  function bindForm() {
    const form = document.getElementById('deal-unified-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveProfile(true);
    });

    ['cost', 'price'].forEach((name) => {
      form[name]?.addEventListener('input', () => {
        form[name].value = sanitizeDigits(form[name].value).slice(0, 9);
      });
    });
  }

  function init() {
    const page = document.querySelector('[data-deal-page]');
    if (!page) return;

    dealId = page.dataset.dealId;
    if (!loadDeal()) return;

    fillForm();
    mountDuePayments();
    mountDocuments();
    refreshFinance();
    bindForm();
  }

  return { init };
})();

window.CrmDealCard = CrmDealCard;

document.addEventListener('DOMContentLoaded', () => {
  CrmDealCard.init();
});
