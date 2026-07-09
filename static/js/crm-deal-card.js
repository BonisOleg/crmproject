/**
 * Єдина картка угоди: редагування, план оплат, документи → звіт
 */
const CrmDealCard = (() => {
  const EXECUTION_OPTIONS = [
    { value: 'won', label: 'Виграно' },
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
    form.cost.value = String(deal.cost ?? Math.round((deal.price || 0) * 0.82));
    form.price.value = String(deal.price || 0);
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
    const paid = Number(deal.paid) || 0;
    const debt = Math.max(0, price - paid);
    const profit = Math.max(0, price - cost);
    const dueRoot = document.querySelector('[data-due-root]');
    const docRoot = document.querySelector('[data-doc-root]');
    const due_payments = dueWidget?.read() || CrmDuePayments.read(dueRoot);
    const documents = docWidget?.read() || CrmDocuments.read(docRoot);

    const patch = {
      car: form.car.value.trim(),
      client: form.client.value.trim(),
      phone: form.phone.value.trim(),
      vin: form.vin.value.trim(),
      auction: form.auction.value,
      execution,
      execution_label: executionLabel,
      cost,
      price,
      debt,
      profit,
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
