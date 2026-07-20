/**
 * Картка автовоза: редагування + документи
 */
const CrmCarrierCard = (() => {
  const STATUS_LABELS = {
    loading: 'Завантаження',
    in_transit: 'В дорозі',
  };

  let carrierId = null;
  let carrier = null;
  let docWidget = null;

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

  function loadCarrier() {
    carrier = CrmStore.getCarrier(carrierId);
    return carrier || null;
  }

  function fillForm() {
    const form = document.getElementById('carrier-unified-form');
    if (!form || !carrier) return;

    form.driver.value = carrier.driver || '';
    form.plate.value = carrier.plate || '';
    form.route.value = carrier.route || '';
    form.cars.value = String(carrier.cars || 0);
    form.status.value = carrier.status || 'loading';
    form.departure.value = carrier.departure || '';
    form.eta.value = carrier.eta || '';

    const statusEl = document.querySelector('[data-carrier-save-status]');
    if (statusEl) statusEl.textContent = 'Зміни зберігаються у картці автовоза';
  }

  function mountDocuments() {
    const root = document.querySelector('[data-doc-root]');
    if (!root || !window.CrmDocuments) return;
    docWidget = CrmDocuments.mount(root, {
      items: carrier?.documents || [],
      title: 'Документи автовоза',
    });
    root.addEventListener('crm:doc-changed', () => saveProfile(false));
  }

  function refreshInfo() {
    if (!carrier) return;

    const titleEl = document.querySelector('[data-carrier-page-title]');
    if (titleEl) titleEl.textContent = carrier.id;

    const subEl = document.querySelector('[data-carrier-page-sub]');
    if (subEl) {
      subEl.textContent = `${carrier.route || '—'} · ${carrier.status_label || STATUS_LABELS[carrier.status] || carrier.status}`;
    }

    const pillEl = document.querySelector('[data-carrier-status-pill]');
    if (pillEl) pillEl.textContent = carrier.status_label || STATUS_LABELS[carrier.status] || carrier.status;

    const map = {
      driver: carrier.driver || '—',
      plate: carrier.plate || '—',
      route: carrier.route || '—',
      cars: String(carrier.cars ?? 0),
      departure: carrier.departure || '—',
      eta: carrier.eta || '—',
    };
    Object.keys(map).forEach((key) => {
      const el = document.querySelector(`[data-carrier-info="${key}"]`);
      if (el) el.textContent = map[key];
    });

    const dealsList = document.querySelector('[data-carrier-deals-list]');
    const dealsCount = document.querySelector('[data-carrier-deals-count]');
    const deals = Array.isArray(carrier.assigned_deals) ? carrier.assigned_deals : [];
    if (dealsCount) dealsCount.textContent = String(deals.length);
    if (dealsList) {
      if (!deals.length) {
        dealsList.innerHTML = '<p class="carrier-deals-empty text-muted">Немає призначених угод</p>';
      } else {
        dealsList.innerHTML = deals.map((dealId) => (
          `<a href="/deals/${encodeURIComponent(dealId)}/" class="carrier-deal-chip">${escapeHtml(dealId)}</a>`
        )).join('');
      }
    }
  }

  async function saveProfile(showNotice = true) {
    const form = document.getElementById('carrier-unified-form');
    if (!form || !carrierId) return;

    const status = form.status.value;
    const statusLabel = STATUS_LABELS[status] || status;
    const cars = Number(sanitizeDigits(form.cars.value)) || 0;
    const docRoot = document.querySelector('[data-doc-root]');
    const documents = docWidget?.read() || (window.CrmDocuments ? CrmDocuments.read(docRoot) : []);

    const patch = {
      driver: form.driver.value.trim(),
      plate: form.plate.value.trim(),
      route: form.route.value.trim(),
      cars,
      status,
      status_label: statusLabel,
      departure: form.departure.value,
      eta: form.eta.value,
      documents,
      assigned_deals: Array.isArray(carrier?.assigned_deals) ? carrier.assigned_deals : [],
    };

    try {
      await CrmStore.saveCarrierProfile(carrierId, patch);
      carrier = CrmStore.getCarrier(carrierId);
      refreshInfo();
      if (showNotice && typeof showToast === 'function') {
        showToast('Картку автовоза збережено', 'success');
      }
    } catch {
      /* toast у CrmStore */
    }
  }

  function bindForm() {
    const form = document.getElementById('carrier-unified-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      saveProfile(true);
    });

    form.cars?.addEventListener('input', () => {
      form.cars.value = sanitizeDigits(form.cars.value).slice(0, 2);
    });
  }

  function init() {
    const page = document.querySelector('[data-carrier-page]');
    if (!page) return;

    carrierId = page.dataset.carrierId;
    if (!loadCarrier()) return;

    fillForm();
    mountDocuments();
    refreshInfo();
    bindForm();
  }

  return { init };
})();

window.CrmCarrierCard = CrmCarrierCard;

document.addEventListener('DOMContentLoaded', () => {
  CrmCarrierCard.init();
});
