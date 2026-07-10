/**
 * Редагування місячного звіту (localStorage)
 */
const CrmReport = (() => {
  const OVERRIDE_KEY = 'autolot-report-overrides';
  const EXTRA_KEY = 'autolot-report-extras';
  const COL_COUNT = 8;

  let baseSections = [];
  let modalEl;
  let formEl;
  let tbodyEl;
  let lastFocus = null;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readBase() {
    const node = document.getElementById('crm-report-catalog');
    if (!node) return [];
    try {
      return JSON.parse(node.textContent || '[]');
    } catch {
      return [];
    }
  }

  function sanitizeDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function recalcRow(row) {
    const price = Number(row.price) || 0;
    const cost = Number(row.cost) || 0;
    const profit = Math.max(0, price - cost);
    return {
      ...row,
      profit,
      currency: row.currency || 'CHF',
      won_currency: row.won_currency || row.currency || 'CHF',
      bid_currency: row.bid_currency || row.currency || 'CHF',
      cost_currency: row.cost_currency || row.currency || 'CHF',
      price_currency: row.price_currency || row.currency || 'CHF',
      delivery_currency: row.delivery_currency || row.currency || 'CHF',
    };
  }

  function applyDealSync(row) {
    const dealId = row.deal_id || (/^AL-2026-\d+$/.test(String(row.id || '')) ? row.id : null);
    if (!dealId || !window.CrmStore) return row;
    const deal = CrmStore.getDeal(dealId);
    if (!deal) return row;
    return {
      ...row,
      ...CrmStore.dealToReportRow(deal),
      id: row.id,
      deal_id: dealId,
    };
  }

  function mergeRow(row, overrides) {
    if (row.deal_id || /^AL-2026-\d+$/.test(String(row.id || ''))) {
      return recalcRow(applyDealSync(row));
    }
    return recalcRow({ ...row, ...(overrides[row.id] || {}) });
  }

  function mergeSections() {
    const overrides = readJson(OVERRIDE_KEY, {});
    const extras = readJson(EXTRA_KEY, {});

    return baseSections.map((section) => {
      const baseRows = section.rows.map((row) => mergeRow(row, overrides));
      const extraRows = (extras[section.name] || []).map((row) => mergeRow(row, overrides));
      return { ...section, rows: [...baseRows, ...extraRows] };
    });
  }

  function formatNum(value) {
    return Math.round(Number(value) || 0).toLocaleString('uk-UA');
  }

  function resolveRowDealId(row) {
    return row.deal_id || (/^AL-2026-\d+$/.test(String(row.id || '')) ? row.id : null);
  }

  function getRowDuePayments(row) {
    if (Array.isArray(row.due_payments) && row.due_payments.length) {
      return row.due_payments;
    }
    const dealId = resolveRowDealId(row);
    if (dealId && window.CrmStore) {
      return CrmStore.getDeal(dealId)?.due_payments || [];
    }
    return row.due_payments || [];
  }

  function getRowDocuments(row) {
    if (Array.isArray(row.documents) && row.documents.length) {
      return row.documents;
    }
    const dealId = resolveRowDealId(row);
    if (dealId && window.CrmStore) {
      return CrmStore.getDeal(dealId)?.documents || [];
    }
    return row.documents || [];
  }

  function formatDocBadge(row) {
    const count = getRowDocuments(row).length;
    if (!count) return '';
    return `<span class="report-table__doc-badge" title="${count} док.">📄 ${count}</span>`;
  }

  function getRowCurrency(row) {
    const dealId = resolveRowDealId(row);
    if (dealId && window.CrmStore) {
      return CrmStore.getDeal(dealId)?.currency || row.currency || 'CHF';
    }
    return row.currency || 'CHF';
  }

  function formatDuePlan(row) {
    const items = getRowDuePayments(row);
    if (!items.length) return '—';
    const currency = getRowCurrency(row);
    return items.map((item) => {
      const amountText = window.CrmDuePayments
        ? CrmDuePayments.formatAmount(item.amount, currency)
        : `${formatNum(item.amount)} ${currency}`;
      return `<span class="report-table__due-item"><span class="mono">${escapeHtml(amountText)}</span> · ${escapeHtml(item.place)}</span>`;
    }).join('');
  }

  function renderCarCell(row) {
    const badge = formatDocBadge(row);
    if (!row.deal_id) return `<strong>${escapeHtml(row.car)}</strong>${badge}`;
    return `<a href="/deals/${encodeURIComponent(row.deal_id)}/" class="report-table__deal-link">${escapeHtml(row.car)}</a>${badge}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isEdited(id) {
    const overrides = readJson(OVERRIDE_KEY, {});
    const extras = readJson(EXTRA_KEY, {});
    const isExtra = Object.values(extras).some((rows) => rows.some((row) => row.id === id));
    return Boolean(overrides[id]) || isExtra;
  }

  function isCustomRow(id) {
    const extras = readJson(EXTRA_KEY, {});
    return Object.values(extras).some((rows) => rows.some((row) => row.id === id));
  }

  function renderTable() {
    if (!tbodyEl) return;
    const sections = mergeSections();
    const overrides = readJson(OVERRIDE_KEY, {});

    tbodyEl.innerHTML = sections.map((section) => {
      const header = `
        <tr class="report-table__section" data-report-section="${escapeHtml(section.name)}">
          <td colspan="${COL_COUNT}">● ${escapeHtml(section.name.toUpperCase())}</td>
        </tr>`;

      const rows = section.rows.map((row) => {
        const edited = overrides[row.id] || isCustomRow(row.id) || row.deal_id;
        const deliveryCost = Number(row.delivery_cost) || 0;
        const deliveryCell = row.delivery_type === 'ours' && deliveryCost > 0
          ? `<span class="mono">${formatNum(deliveryCost)}</span> <span class="report-table__cur">${escapeHtml(row.delivery_currency || row.currency)}</span>`
          : '—';
        const dealAttr = row.deal_id ? ` data-deal-id="${escapeHtml(row.deal_id)}"` : '';
        return `
          <tr
            class="report-table__row${edited ? ' report-table__row--edited' : ''}"
            data-report-row
            data-report-id="${escapeHtml(row.id)}"
            data-report-section="${escapeHtml(section.name)}"${dealAttr}
            tabindex="0"
            role="button"
            aria-label="Редагувати ${escapeHtml(row.car)}"
          >
            <td>${renderCarCell(row)}</td>
            <td>${escapeHtml(row.client)}</td>
            <td class="mono report-table__num" data-field="won_price" data-money="${row.won_price || 0}" data-money-currency="${row.won_currency || row.currency}">${formatNum(row.won_price || 0)} <span class="report-table__cur">${escapeHtml(row.won_currency || row.currency)}</span></td>
            <td class="mono report-table__num" data-field="bid" data-money="${row.bid || 0}" data-money-currency="${row.bid_currency || row.currency}">${formatNum(row.bid || 0)} <span class="report-table__cur">${escapeHtml(row.bid_currency || row.currency)}</span></td>
            <td class="mono report-table__num" data-field="cost" data-money="${row.cost}" data-money-currency="${row.cost_currency || row.currency}">${formatNum(row.cost)} <span class="report-table__cur">${escapeHtml(row.cost_currency || row.currency)}</span></td>
            <td class="mono report-table__num" data-field="price" data-money="${row.price}" data-money-currency="${row.price_currency || row.currency}">${formatNum(row.price)} <span class="report-table__cur">${escapeHtml(row.price_currency || row.currency)}</span></td>
            <td class="report-table__delivery">${deliveryCell}</td>
            <td class="mono report-table__num text-green" data-field="profit" data-money="${row.profit}" data-money-currency="${row.currency}" data-money-sign="+">+${formatNum(row.profit)} <span class="report-table__cur">${escapeHtml(row.currency)}</span></td>
          </tr>`;
      }).join('');

      return header + rows;
    }).join('');

    bindRowHandlers();
    if (window.CrmCurrency) CrmCurrency.applyAll();
  }

  function findRow(id) {
    for (const section of mergeSections()) {
      const row = section.rows.find((item) => item.id === id);
      if (row) return { section: section.name, row };
    }
    return null;
  }

  function fillSectionSelect(selected) {
    const select = document.getElementById('report-edit-section-select');
    if (!select) return;
    select.innerHTML = baseSections.map((section) => (
      `<option value="${escapeHtml(section.name)}"${section.name === selected ? ' selected' : ''}>${escapeHtml(section.name)}</option>`
    )).join('');
  }

  function updateCalcPreview() {
    const cost = Number(sanitizeDigits(formEl.cost?.value || '0')) || 0;
    const price = Number(sanitizeDigits(formEl.price?.value || '0')) || 0;
    const profit = Math.max(0, price - cost);
    const el = document.getElementById('report-edit-profit');
    if (el) el.textContent = formatNum(profit);
  }

  function mountModal() {
    if (modalEl && modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
  }

  function openEditor(id) {
    const found = findRow(id);
    if (!found || !modalEl || !formEl) return;

    lastFocus = document.activeElement;
    fillSectionSelect(found.section);

    formEl.row_id.value = found.row.id;
    formEl.section.value = found.section;
    formEl.section_select.value = found.section;
    formEl.car.value = found.row.car;
    formEl.client.value = found.row.client;
    formEl.stage.value = found.row.stage;
    if (formEl.won_price) formEl.won_price.value = String(found.row.won_price || 0);
    if (formEl.bid) formEl.bid.value = String(found.row.bid || 0);
    formEl.cost.value = String(found.row.cost || 0);
    formEl.price.value = String(found.row.price || 0);
    if (formEl.delivery_cost) formEl.delivery_cost.value = String(found.row.delivery_cost || 0);
    if (formEl.won_currency) formEl.won_currency.value = found.row.won_currency || 'CHF';
    if (formEl.bid_currency) formEl.bid_currency.value = found.row.bid_currency || 'CHF';
    if (formEl.cost_currency) formEl.cost_currency.value = found.row.cost_currency || 'CHF';
    if (formEl.price_currency) formEl.price_currency.value = found.row.price_currency || 'CHF';
    if (formEl.delivery_currency) formEl.delivery_currency.value = found.row.delivery_currency || 'CHF';
    if (formEl.delivery_type) formEl.delivery_type.value = found.row.delivery_type || 'pickup';

    const deleteBtn = formEl.querySelector('[data-report-edit-delete]');
    const resetBtn = formEl.querySelector('[data-report-edit-reset]');
    if (deleteBtn) deleteBtn.hidden = !isCustomRow(found.row.id);
    if (resetBtn) resetBtn.hidden = !isEdited(found.row.id) || isCustomRow(found.row.id);

    updateCalcPreview();
    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => formEl.car.focus());
  }

  function openNewRow(sectionName) {
    const id = `RPT-NEW-${Date.now()}`;
    const extras = readJson(EXTRA_KEY, {});
    const section = sectionName || baseSections[0]?.name || 'У роботі';
    if (!extras[section]) extras[section] = [];
    extras[section].push({
      id,
      car: 'Нове авто',
      client: 'Клієнт',
      stage: 'Виграно',
      won_price: 0,
      bid: 0,
      cost: 0,
      price: 0,
      delivery_cost: 0,
      delivery_type: 'pickup',
      profit: 0,
      currency: 'CHF',
      won_currency: 'CHF',
      bid_currency: 'CHF',
      cost_currency: 'CHF',
      price_currency: 'CHF',
      delivery_currency: 'CHF',
    });
    writeJson(EXTRA_KEY, extras);
    renderTable();
    openEditor(id);
  }

  function closeEditor() {
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    lastFocus?.focus?.();
  }

  function saveRow(event) {
    event.preventDefault();
    const id = formEl.row_id.value;
    const oldSection = formEl.section.value;
    const newSection = formEl.section_select.value;
    const payload = recalcRow({
      car: formEl.car.value.trim(),
      client: formEl.client.value.trim(),
      stage: formEl.stage.value,
      won_price: Number(sanitizeDigits(formEl.won_price?.value || '0')) || 0,
      bid: Number(sanitizeDigits(formEl.bid?.value || '0')) || 0,
      cost: Number(sanitizeDigits(formEl.cost.value)) || 0,
      price: Number(sanitizeDigits(formEl.price.value)) || 0,
      delivery_cost: Number(sanitizeDigits(formEl.delivery_cost?.value || '0')) || 0,
      delivery_type: formEl.delivery_type?.value || 'pickup',
      currency: formEl.price_currency?.value || 'CHF',
      won_currency: formEl.won_currency?.value || 'CHF',
      bid_currency: formEl.bid_currency?.value || 'CHF',
      cost_currency: formEl.cost_currency?.value || 'CHF',
      price_currency: formEl.price_currency?.value || 'CHF',
      delivery_currency: formEl.delivery_currency?.value || 'CHF',
    });

    if (!payload.car || !payload.client) {
      if (typeof showToast === 'function') showToast('Заповніть авто та клієнта', 'info');
      return;
    }

    const found = findRow(id);
    const dealId = found?.row ? resolveRowDealId(found.row) : null;

    if (dealId && window.CrmStore) {
      CrmStore.saveDealProfile(dealId, {
        car: payload.car,
        client: payload.client,
        execution_label: payload.stage,
        won_price: payload.won_price,
        bid: payload.bid,
        cost: payload.cost,
        price: payload.price,
        delivery_cost: payload.delivery_cost,
        delivery_type: payload.delivery_type,
        profit: payload.profit,
        currency: payload.price_currency || payload.currency,
        won_currency: payload.won_currency,
        bid_currency: payload.bid_currency,
        cost_currency: payload.cost_currency,
        price_currency: payload.price_currency,
        delivery_currency: payload.delivery_currency,
      });
    } else if (isCustomRow(id)) {
      const extras = readJson(EXTRA_KEY, {});
      Object.keys(extras).forEach((name) => {
        extras[name] = extras[name].map((row) => (row.id === id ? { ...row, ...payload, id } : row));
      });
      if (oldSection !== newSection) {
        let moved = null;
        Object.keys(extras).forEach((name) => {
          extras[name] = extras[name].filter((row) => {
            if (row.id === id) { moved = { ...row, ...payload, id }; return false; }
            return true;
          });
        });
        if (moved) {
          if (!extras[newSection]) extras[newSection] = [];
          extras[newSection].push(moved);
        }
      }
      writeJson(EXTRA_KEY, extras);
    } else {
      const overrides = readJson(OVERRIDE_KEY, {});
      overrides[id] = { ...payload };
      writeJson(OVERRIDE_KEY, overrides);
    }

    renderTable();
    closeEditor();
    if (typeof showToast === 'function') showToast('Рядок звіту збережено', 'success');
  }

  function resetRow() {
    const id = formEl.row_id.value;
    const overrides = readJson(OVERRIDE_KEY, {});
    delete overrides[id];
    writeJson(OVERRIDE_KEY, overrides);
    renderTable();
    closeEditor();
    if (typeof showToast === 'function') showToast('Рядок повернуто до початкових даних', 'info');
  }

  function deleteRow() {
    const id = formEl.row_id.value;
    if (!isCustomRow(id)) return;
    const extras = readJson(EXTRA_KEY, {});
    Object.keys(extras).forEach((name) => {
      extras[name] = extras[name].filter((row) => row.id !== id);
    });
    writeJson(EXTRA_KEY, extras);
    const overrides = readJson(OVERRIDE_KEY, {});
    delete overrides[id];
    writeJson(OVERRIDE_KEY, overrides);
    renderTable();
    closeEditor();
    if (typeof showToast === 'function') showToast('Рядок видалено', 'info');
  }

  function addDealFromStore(deal) {
    if (!deal?.id) return;
    const extras = readJson(EXTRA_KEY, {});
    const section = 'У роботі';
    const rows = extras[section] || [];
    if (rows.some((row) => row.deal_id === deal.id || row.id === deal.id)) return;
    rows.unshift({
      id: deal.id,
      deal_id: deal.id,
      ...(window.CrmStore ? CrmStore.dealToReportRow(deal) : {}),
    });
    extras[section] = rows;
    writeJson(EXTRA_KEY, extras);
    if (tbodyEl) renderTable();
  }

  function exportCsv() {
    const sections = mergeSections();
    const monthLabel = document.querySelector('[data-report-month]')?.dataset.reportMonth || '2026';
    const lines = [['Секція', 'Авто', 'Клієнт', 'Стадія', 'Виграна', 'Ставка', 'Собівартість', 'Клієнту', 'Доставка', 'Прибуток']];
    sections.forEach((section) => {
      section.rows.forEach((row) => {
        const delivery = row.delivery_type === 'ours' ? (Number(row.delivery_cost) || 0) : '';
        lines.push([
          section.name,
          row.car,
          row.client,
          row.stage,
          `${row.won_price || 0} ${row.won_currency || row.currency}`,
          `${row.bid || 0} ${row.bid_currency || row.currency}`,
          `${row.cost} ${row.cost_currency || row.currency}`,
          `${row.price} ${row.price_currency || row.currency}`,
          delivery ? `${delivery} ${row.delivery_currency || row.currency}` : '',
          `${row.profit} ${row.currency}`,
        ]);
      });
    });
    const safeMonth = String(monthLabel).replace(/\s+/g, '-').toLowerCase();
    const csv = `\ufeff${lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zvit-${safeMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('CSV завантажено', 'success');
  }

  function bindRowHandlers() {
    tbodyEl.querySelectorAll('[data-report-row]').forEach((rowEl) => {
      if (rowEl.dataset.reportBound) return;
      rowEl.dataset.reportBound = 'true';
      const open = () => openEditor(rowEl.dataset.reportId);
      rowEl.addEventListener('click', (event) => {
        if (event.target.closest('.report-table__deal-link')) return;
        open();
      });
      rowEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function bindMoneyInputs() {
    ['won_price', 'bid', 'cost', 'price', 'delivery_cost'].forEach((name) => {
      formEl[name]?.addEventListener('input', () => {
        formEl[name].value = sanitizeDigits(formEl[name].value).slice(0, 9);
        updateCalcPreview();
      });
    });
  }

  function init() {
    if (!document.getElementById('report-table-body')) return;

    baseSections = readBase();
    modalEl = document.getElementById('report-edit');
    formEl = document.getElementById('report-edit-form');
    tbodyEl = document.getElementById('report-table-body');

    mountModal();
    renderTable();

    formEl?.addEventListener('submit', saveRow);
    bindMoneyInputs();

    modalEl?.querySelectorAll('[data-report-edit-close]').forEach((btn) => {
      btn.addEventListener('click', closeEditor);
    });
    formEl?.querySelector('[data-report-edit-reset]')?.addEventListener('click', resetRow);
    formEl?.querySelector('[data-report-edit-delete]')?.addEventListener('click', deleteRow);

    document.querySelector('[data-report-add-row]')?.addEventListener('click', () => {
      openNewRow(baseSections[0]?.name);
    });
    document.querySelector('[data-report-export-csv]')?.addEventListener('click', exportCsv);
    document.querySelector('[data-report-print]')?.addEventListener('click', () => {
      window.print();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modalEl && !modalEl.hidden) {
        event.preventDefault();
        closeEditor();
      }
    });

    document.addEventListener('crm:currency-change', renderTable);
    document.addEventListener('crm:deal-updated', renderTable);
  }

  return { init, mergeSections, renderTable, addDealFromStore };
})();

window.CrmReport = CrmReport;

document.addEventListener('DOMContentLoaded', () => {
  CrmReport.init();
});
