/**
 * Редагування місячного звіту (localStorage)
 */
const CrmReport = (() => {
  const OVERRIDE_KEY = 'autolot-report-overrides';
  const EXTRA_KEY = 'autolot-report-extras';
  const COL_COUNT = 10;

  let baseSections = [];
  let modalEl;
  let formEl;
  let tbodyEl;
  let lastFocus = null;
  let reportDueWidget = null;
  let reportDocWidget = null;

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
    const paid = Number(row.paid) || 0;
    const cost = Number(row.cost) || 0;
    const debt = Math.max(0, price - paid);
    const profit = Math.max(0, price - cost);
    return { ...row, debt, profit, currency: row.currency || 'CHF' };
  }

  function applyDealSync(row) {
    const dealId = row.deal_id || (/^AL-2026-\d+$/.test(String(row.id || '')) ? row.id : null);
    if (!dealId || !window.CrmStore) return row;
    const deal = CrmStore.getDeal(dealId);
    if (!deal) return row;
    return {
      ...row,
      ...CrmStore.dealToReportRow(deal),
      due_payments: deal.due_payments || [],
      documents: deal.documents || [],
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
        const debtClass = row.debt > 0 ? 'text-red' : 'text-green';
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
            <td>${escapeHtml(row.auction)}</td>
            <td>${escapeHtml(row.stage)}</td>
            <td class="mono report-table__num" data-field="cost" data-money="${row.cost}" data-money-currency="${row.currency}">${formatNum(row.cost)}</td>
            <td class="mono report-table__num" data-field="price" data-money="${row.price}" data-money-currency="${row.currency}">${formatNum(row.price)}</td>
            <td class="mono report-table__num" data-field="paid" data-money="${row.paid}" data-money-currency="${row.currency}">${formatNum(row.paid)}</td>
            <td class="mono report-table__num ${debtClass}" data-field="debt" data-money="${row.debt}" data-money-currency="${row.currency}">${formatNum(row.debt)}</td>
            <td class="report-table__due-plan">${formatDuePlan(row)}</td>
            <td class="mono report-table__num text-green" data-field="profit" data-money="${row.profit}" data-money-currency="${row.currency}" data-money-sign="+">+${formatNum(row.profit)}</td>
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
    const cost = Number(sanitizeDigits(formEl.cost.value)) || 0;
    const price = Number(sanitizeDigits(formEl.price.value)) || 0;
    const paid = Number(sanitizeDigits(formEl.paid.value)) || 0;
    const debt = Math.max(0, price - paid);
    const profit = Math.max(0, price - cost);
    document.getElementById('report-edit-debt').textContent = formatNum(debt);
    document.getElementById('report-edit-profit').textContent = formatNum(profit);
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
    formEl.auction.value = found.row.auction;
    formEl.stage.value = found.row.stage;
    formEl.cost.value = String(found.row.cost || 0);
    formEl.price.value = String(found.row.price || 0);
    formEl.paid.value = String(found.row.paid || 0);

    const deleteBtn = formEl.querySelector('[data-report-edit-delete]');
    const resetBtn = formEl.querySelector('[data-report-edit-reset]');
    if (deleteBtn) deleteBtn.hidden = !isCustomRow(found.row.id);
    if (resetBtn) resetBtn.hidden = !isEdited(found.row.id) || isCustomRow(found.row.id);

    const dueSection = document.getElementById('report-edit-due');
    const dueRoot = document.getElementById('report-edit-due-root');
    if (window.CrmDuePayments && dueSection && dueRoot) {
      dueSection.hidden = false;
      reportDueWidget?.destroy?.();
      reportDueWidget = CrmDuePayments.mount(dueRoot, {
        items: getRowDuePayments(found.row),
        currency: getRowCurrency(found.row),
        inputClass: 'report-edit__input crm-due-widget__input',
        syncWithToolbar: true,
      });
    } else {
      reportDueWidget?.destroy?.();
      reportDueWidget = null;
      if (dueRoot) dueRoot.innerHTML = '';
    }

    const docRoot = document.getElementById('report-edit-doc-root');
    if (window.CrmDocuments && docRoot) {
      reportDocWidget = CrmDocuments.mount(docRoot, {
        items: getRowDocuments(found.row),
      });
    } else {
      reportDocWidget = null;
      if (docRoot) docRoot.innerHTML = '';
    }

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
      auction: 'BCP',
      stage: 'Виграно',
      cost: 0,
      price: 0,
      paid: 0,
      debt: 0,
      profit: 0,
      currency: 'CHF',
      due_payments: [],
      documents: [],
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
    reportDueWidget?.destroy?.();
    reportDueWidget = null;
    reportDocWidget = null;
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
      auction: formEl.auction.value,
      stage: formEl.stage.value,
      cost: Number(sanitizeDigits(formEl.cost.value)) || 0,
      price: Number(sanitizeDigits(formEl.price.value)) || 0,
      paid: Number(sanitizeDigits(formEl.paid.value)) || 0,
      currency: 'CHF',
    });

    if (!payload.car || !payload.client) {
      if (typeof showToast === 'function') showToast('Заповніть авто та клієнта', 'info');
      return;
    }

    const found = findRow(id);
    const dealId = found?.row ? resolveRowDealId(found.row) : null;
    const dueRoot = document.getElementById('report-edit-due-root');
    const docRoot = document.getElementById('report-edit-doc-root');
    const due_payments = reportDueWidget?.read() || (window.CrmDuePayments ? CrmDuePayments.read(dueRoot) : []);
    const documents = reportDocWidget?.read() || (window.CrmDocuments ? CrmDocuments.read(docRoot) : []);

    if (dealId && window.CrmStore) {
      CrmStore.saveDealProfile(dealId, {
        car: payload.car,
        client: payload.client,
        auction: payload.auction,
        execution_label: payload.stage,
        cost: payload.cost,
        price: payload.price,
        paid: payload.paid,
        debt: payload.debt,
        profit: payload.profit,
        due_payments,
        documents,
      });
    } else if (isCustomRow(id)) {
      const extras = readJson(EXTRA_KEY, {});
      Object.keys(extras).forEach((name) => {
        extras[name] = extras[name].map((row) => (
          row.id === id ? { ...row, ...payload, due_payments, documents, id } : row
        ));
      });
      if (oldSection !== newSection) {
        let moved = null;
        Object.keys(extras).forEach((name) => {
          extras[name] = extras[name].filter((row) => {
            if (row.id === id) {
              moved = { ...row, ...payload, due_payments, documents, id };
              return false;
            }
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
      overrides[id] = { ...payload, due_payments, documents };
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
    const lines = [['Секція', 'Авто', 'Клієнт', 'Аукціон', 'Стадія', 'Собівартість', 'Клієнту', 'Оплачено', 'Баланс', 'Місце оплати', 'Прибуток']];
    sections.forEach((section) => {
      section.rows.forEach((row) => {
        const duePlan = formatDuePlan(row).replace(/<[^>]+>/g, ' · ').replace(/\s+/g, ' ').trim();
        lines.push([
          section.name,
          row.car,
          row.client,
          row.auction,
          row.stage,
          row.cost,
          row.price,
          row.paid,
          row.debt,
          duePlan === '—' ? '' : duePlan,
          row.profit,
        ]);
      });
    });
    const csv = `\ufeff${lines.map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zvit-cherven-2026.csv';
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
    ['cost', 'price', 'paid'].forEach((name) => {
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
